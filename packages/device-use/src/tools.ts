
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'

import { logger } from '@agent/shared'
import type { ActionResult, ScreenshotData } from '@agent/shared'
import { anthropic } from '@ai-sdk/anthropic'

import type { ComputerAction, ComputerActionResult, DeviceUseConfig } from './types.js'
import { SafetyValidator } from './utils/safety.js'

import type { DeviceDriver } from './driver.js'

export async function createDeviceTools(config: DeviceUseConfig) {
  let driver: DeviceDriver

  if (config.driver) {
    driver = config.driver
  } else {
    const { DesktopDriver } = await import('./drivers/desktop.js')
    driver = new DesktopDriver()
  }

  const safetyValidator = new SafetyValidator(config)

  const computerTool = anthropic.tools.computer_20250124({
    displayWidthPx: config.displayWidth,
    displayHeightPx: config.displayHeight,
    execute: async ({ action, coordinate, text }: { action: string; coordinate?: [number, number]; text?: string }): Promise<ComputerActionResult> => {
      logger.info(`[device-use] Executing action: ${action}`)

      const validation = safetyValidator.validateAction(action as ComputerAction)
      if (!validation.valid) {
        const error = `Action blocked: ${validation.reason}`
        logger.warn(`[device-use] ${error}`)
        return error
      }

      const coordValidation = safetyValidator.validateCoordinate(coordinate)
      if (!coordValidation.valid) {
        const error = `Invalid coordinate: ${coordValidation.reason}`
        logger.warn(`[device-use] ${error}`)
        return error
      }

      safetyValidator.recordAction(action as ComputerAction)

      try {
        switch (action) {
          case 'screenshot': {
            const result = await driver.execute({ type: 'screenshot', payload: { format: 'png' } })
            if (result.success && result.data && typeof result.data === 'object' && 'base64' in result.data) {
              return { type: 'image', data: (result.data as ScreenshotData).base64 }
            }
            return formatError(result)
          }

          case 'mouse_move':
            return 'mouse_move action not supported in unified driver interface'

          case 'left_click': {
            if (coordinate) {
              const result = await driver.execute({
                type: 'tap',
                payload: { x: coordinate[0], y: coordinate[1] },
              })
              return formatResult(result, 'Performed left_click')
            }
            return 'left_click requires coordinate'
          }

          case 'right_click':
            return 'right_click action not supported in unified driver interface'

          case 'middle_click':
            return 'middle_click not supported in driver interface'

          case 'double_click': {
            if (coordinate) {
              const result = await driver.execute({
                type: 'double_tap',
                payload: { x: coordinate[0], y: coordinate[1] },
              })
              return formatResult(result, 'Performed double_click')
            }
            return 'double_click requires coordinate'
          }

          case 'triple_click':
            return 'triple_click not supported in driver interface'

          case 'left_click_drag': {
            if (!coordinate || coordinate.length < 2) {
              return 'Error: left_click_drag requires start and end coordinates'
            }
            const result = await driver.execute({
              type: 'drag',
              payload: { fromX: 0, fromY: 0, toX: coordinate[0], toY: coordinate[1] },
            })
            return formatResult(result, 'Performed left_click_drag')
          }

          case 'left_mouse_down':
          case 'left_mouse_up':
            return `${action} not supported in driver interface`

          case 'type': {
            if (!text) {
              return 'Error: type action requires text'
            }
            const result = await driver.execute({
              type: 'type',
              payload: { text },
            })
            return formatResult(result, `Typed: ${text}`)
          }

          case 'key': {
            if (!text) {
              return 'Error: key action requires text (key name)'
            }
            const result = await driver.execute({
              type: 'key',
              payload: { key: text },
            })
            return formatResult(result, `Pressed key: ${text}`)
          }

          case 'hold_key':
            return 'hold_key not supported in driver interface'

          case 'cursor_position':
            return 'cursor_position not supported in unified driver interface'

          case 'scroll': {
            if (!coordinate) {
              return 'Error: scroll requires coordinate'
            }
            const result = await driver.execute({
              type: 'scroll',
              payload: { deltaX: coordinate[0], deltaY: coordinate[1] },
            })
            return formatResult(result, `Scrolled by (${coordinate[0]}, ${coordinate[1]})`)
          }

          case 'wait':
            return 'wait action completed'

          default:
            return `Unknown action: ${action}`
        }
      } catch (error) {
        const errorMessage = `Action failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        logger.error(`[device-use] ${errorMessage}`)
        return errorMessage
      }
    },
    experimental_toToolResultContent(result: ComputerActionResult) {
      if (typeof result === 'string') {
        return [{ type: 'text', text: result }]
      } else {
        return [{ type: 'image', data: result.data, mimeType: 'image/png' }]
      }
    },
  })

  const bashTool = anthropic.tools.bash_20250124({
    execute: async ({ command, restart }: { command: string; restart?: boolean }): Promise<string> => {
      logger.info(`[device-use] Executing bash command: ${command}`)

      if (restart) {
        logger.warn('[device-use] Bash restart requested but not implemented')
      }

      try {
        const result = execSync(command, {
          encoding: 'utf-8',
          maxBuffer: 1024 * 1024,
          timeout: 30000,
        })
        return result
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        logger.error(`[device-use] Bash command failed: ${errorMessage}`)
        return `Error: ${errorMessage}`
      }
    },
  })

  const textEditorTool = anthropic.tools.textEditor_20250124({
    execute: async ({
      command,
      path,
      file_text,
      insert_line,
      new_str,
      old_str,
      view_range,
    }: {
      command: string
      path: string
      file_text?: string
      insert_line?: number
      new_str?: string
      old_str?: string
      view_range?: number[]
    }): Promise<string> => {
      logger.info(`[device-use] Executing text editor command: ${command} on ${path}`)

      try {
        switch (command) {
          case 'view': {
            if (!existsSync(path)) {
              return `Error: File not found: ${path}`
            }
            const content = await readFile(path, 'utf-8')
            const lines = content.split('\n')

            if (view_range && view_range.length >= 2) {
              const start = view_range[0]!
              const end = view_range[1]!
              const viewLines = lines.slice(start - 1, end)
              return viewLines.join('\n')
            }

            return content
          }

          case 'create': {
            if (!file_text) {
              return 'Error: create requires file_text'
            }
            if (existsSync(path)) {
              return `Error: File already exists: ${path}`
            }
            await writeFile(path, file_text, 'utf-8')
            return `Created file: ${path}`
          }

          case 'str_replace': {
            if (!old_str || !new_str) {
              return 'Error: str_replace requires old_str and new_str'
            }
            if (!existsSync(path)) {
              return `Error: File not found: ${path}`
            }

            const content = await readFile(path, 'utf-8')
            if (!content.includes(old_str)) {
              return `Error: old_str not found in file`
            }

            const newContent = content.replace(old_str, new_str)
            await writeFile(path, newContent, 'utf-8')
            return `Replaced text in ${path}`
          }

          case 'insert': {
            if (!file_text || insert_line === undefined) {
              return 'Error: insert requires file_text and insert_line'
            }
            if (!existsSync(path)) {
              return `Error: File not found: ${path}`
            }

            const content = await readFile(path, 'utf-8')
            const lines = content.split('\n')
            lines.splice(insert_line, 0, file_text)
            await writeFile(path, lines.join('\n'), 'utf-8')
            return `Inserted text at line ${insert_line} in ${path}`
          }

          case 'undo_edit': {
            return 'Error: undo_edit not implemented - use version control (git) instead'
          }

          default:
            return `Unknown command: ${command}`
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        logger.error(`[device-use] Text editor command failed: ${errorMessage}`)
        return `Error: ${errorMessage}`
      }
    },
  })

  return {
    computer: computerTool,
    bash: bashTool,
    text_editor: textEditorTool,
  }
}

function formatResult(result: ActionResult, successMessage: string): string {
  if (result.success) {
    return successMessage
  }
  return `Error: ${result.error}`
}

function formatError(result: ActionResult): string {
  if (!result.success) {
    return `Error: ${result.error}`
  }
  return 'Unexpected empty result'
}

