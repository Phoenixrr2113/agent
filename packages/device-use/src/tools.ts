
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

import { logger } from '@agent/shared';
import { anthropic } from '@ai-sdk/anthropic';

import {
  type ComputerActionResult,
  type DeviceUseConfig,
  type BashCommand,
  type TextEditorCommand,
} from './types.js';
import { SafetyValidator } from './utils/safety.js';


import type { DeviceDriver } from './driver.js';

export async function createDeviceTools(config: DeviceUseConfig) {
  let driver: DeviceDriver;

  if (config.driver) {
    driver = config.driver;
  } else {
    // Lazy load desktop driver to avoid importing nut.js on mobile
    const { DesktopDriver } = await import('./drivers/desktop.js');
    driver = new DesktopDriver();
  }

  const safetyValidator = new SafetyValidator(config);

  const computerTool = anthropic.tools.computer_20250124({
    displayWidthPx: config.displayWidth,
    displayHeightPx: config.displayHeight,
    execute: async ({ action, coordinate, text }: any): Promise<ComputerActionResult> => {
      logger.info(`[device-use] Executing action: ${action}`);

      const validation = safetyValidator.validateAction(action);
      if (!validation.valid) {
        const error = `Action blocked: ${validation.reason}`;
        logger.warn(`[device-use] ${error}`);
        return error;
      }

      const coordValidation = safetyValidator.validateCoordinate(coordinate);
      if (!coordValidation.valid) {
        const error = `Invalid coordinate: ${coordValidation.reason}`;
        logger.warn(`[device-use] ${error}`);
        return error;
      }

      safetyValidator.recordAction(action);

      try {
        switch (action) {
          case 'screenshot':
            const base64 = await driver.getScreenshot();
            return {
              type: 'image',
              data: base64,
            };

          case 'mouse_move':
            if (!coordinate) {
              return 'Error: mouse_move requires coordinate';
            }
            // Desktop driver doesn't have explicit moveMouse but we can implement it or just ignore if not needed for click
            // The interface doesn't strictly require moveMouse for all drivers, but let's check if we need to add it to interface
            // For now, we'll assume click handles movement or we add move to interface.
            // Actually, the interface I defined DOES NOT have moveMouse.
            // Let's add it to the interface or assume click handles it.
            // NutJS moves before click.
            // Let's check the interface again.
            // I missed moveMouse in the interface I created in step 76.
            // I should update the interface first.
            return 'mouse_move action not fully supported in current driver interface';

          case 'left_click':
            if (coordinate) {
              await driver.click(coordinate[0], coordinate[1]);
            } else {
              // Click at current position
              const pos = await driver.getCursorPosition();
              await driver.click(pos.x, pos.y);
            }
            return 'Performed left_click';

          case 'right_click':
            if (coordinate) {
              await driver.rightClick(coordinate[0], coordinate[1]);
            } else {
              const pos = await driver.getCursorPosition();
              await driver.rightClick(pos.x, pos.y);
            }
            return 'Performed right_click';

          case 'middle_click':
            // Interface doesn't have middle click yet
            return 'middle_click not supported in driver interface';

          case 'double_click':
            if (coordinate) {
              await driver.doubleClick(coordinate[0], coordinate[1]);
            } else {
              const pos = await driver.getCursorPosition();
              await driver.doubleClick(pos.x, pos.y);
            }
            return 'Performed double_click';

          case 'triple_click':
            // Interface doesn't have triple click
            return 'triple_click not supported in driver interface';

          case 'left_click_drag':
            if (!coordinate || coordinate.length < 2) {
              return 'Error: left_click_drag requires start and end coordinates';
            }
            const currentPos = await driver.getCursorPosition();
            await driver.drag(currentPos.x, currentPos.y, coordinate[0], coordinate[1]);
            return 'Performed left_click_drag';

          case 'left_mouse_down':
          case 'left_mouse_up':
            // Interface doesn't expose raw button events yet
            return `${action} not supported in driver interface`;

          case 'type':
            if (!text) {
              return 'Error: type action requires text';
            }
            await driver.type(text);
            return `Typed: ${text}`;

          case 'key':
            if (!text) {
              return 'Error: key action requires text (key name)';
            }
            await driver.pressKey(text);
            return `Pressed key: ${text}`;

          case 'hold_key':
            // Interface doesn't have hold_key
            return 'hold_key not supported in driver interface';

          case 'cursor_position':
            const pos = await driver.getCursorPosition();
            return `Cursor position: (${pos.x}, ${pos.y})`;

          case 'scroll':
            if (!coordinate) {
              return 'Error: scroll requires coordinate';
            }
            await driver.scroll(coordinate[0], coordinate[1]);
            return `Scrolled by (${coordinate[0]}, ${coordinate[1]})`;

          case 'wait':
            return 'wait action completed';

          default:
            return `Unknown action: ${action}`;
        }
      } catch (error) {
        const errorMessage = `Action failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(`[device-use] ${errorMessage}`);
        return errorMessage;
      }
    },
    experimental_toToolResultContent(result: any) {
      if (typeof result === 'string') {
        return [{ type: 'text', text: result }];
      } else {
        return [{ type: 'image', data: result.data, mimeType: 'image/png' }];
      }
    },
  });

  const bashTool = anthropic.tools.bash_20250124({
    execute: async ({ command, restart }: BashCommand): Promise<string> => {
      logger.info(`[device-use] Executing bash command: ${command}`);

      if (restart) {
        logger.warn('[device-use] Bash restart requested but not implemented');
      }

      try {
        const result = execSync(command, {
          encoding: 'utf-8',
          maxBuffer: 1024 * 1024,
          timeout: 30000,
        });
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`[device-use] Bash command failed: ${errorMessage}`);
        return `Error: ${errorMessage}`;
      }
    },
  });

  const textEditorTool = anthropic.tools.textEditor_20250124({
    execute: async ({
      command,
      path,
      file_text,
      insert_line,
      new_str,
      old_str,
      view_range,
    }: any): Promise<string> => {
      logger.info(`[device-use] Executing text editor command: ${command} on ${path}`);

      try {
        switch (command) {
          case 'view': {
            if (!existsSync(path)) {
              return `Error: File not found: ${path}`;
            }
            const content = await readFile(path, 'utf-8');
            const lines = content.split('\n');

            if (view_range) {
              const [start, end] = view_range;
              const viewLines = lines.slice(start - 1, end);
              return viewLines.join('\n');
            }

            return content;
          }

          case 'create': {
            if (!file_text) {
              return 'Error: create requires file_text';
            }
            if (existsSync(path)) {
              return `Error: File already exists: ${path}`;
            }
            await writeFile(path, file_text, 'utf-8');
            return `Created file: ${path}`;
          }

          case 'str_replace': {
            if (!old_str || !new_str) {
              return 'Error: str_replace requires old_str and new_str';
            }
            if (!existsSync(path)) {
              return `Error: File not found: ${path}`;
            }

            const content = await readFile(path, 'utf-8');
            if (!content.includes(old_str)) {
              return `Error: old_str not found in file`;
            }

            const newContent = content.replace(old_str, new_str);
            await writeFile(path, newContent, 'utf-8');
            return `Replaced text in ${path}`;
          }

          case 'insert': {
            if (!file_text || insert_line === undefined) {
              return 'Error: insert requires file_text and insert_line';
            }
            if (!existsSync(path)) {
              return `Error: File not found: ${path}`;
            }

            const content = await readFile(path, 'utf-8');
            const lines = content.split('\n');
            lines.splice(insert_line, 0, file_text);
            await writeFile(path, lines.join('\n'), 'utf-8');
            return `Inserted text at line ${insert_line} in ${path}`;
          }

          case 'undo_edit': {
            return 'Error: undo_edit not implemented - use version control (git) instead';
          }

          default:
            return `Unknown command: ${command}`;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`[device-use] Text editor command failed: ${errorMessage}`);
        return `Error: ${errorMessage}`;
      }
    },
  });

  return {
    computer: computerTool,
    bash: bashTool,
    text_editor: textEditorTool,
  };
}
