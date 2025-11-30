import { anthropic } from '@ai-sdk/anthropic';
import { logger } from '@agent/shared';
import {
  ComputerActionParams,
  ComputerActionResult,
  DeviceUseConfig,
  PlatformImplementation,
  BashCommand,
  TextEditorCommand,
} from './types.js';
import { SafetyValidator } from './utils/safety.js';
import { MacOSPlatform } from './platforms/macos/index.js';
import { LinuxPlatform } from './platforms/linux/index.js';
import { WindowsPlatform } from './platforms/windows/index.js';
import { IOSPlatform } from './platforms/ios/index.js';
import { AndroidPlatform } from './platforms/android/index.js';
import { execSync } from 'child_process';
import { readFile, writeFile, unlink as unlinkFile } from 'fs/promises';
import { existsSync } from 'fs';

function getPlatformImplementation(config: DeviceUseConfig): PlatformImplementation {
  const platform = config.platform || detectPlatform();

  switch (platform) {
    case 'macos':
      return new MacOSPlatform();
    case 'linux':
      return new LinuxPlatform();
    case 'windows':
      return new WindowsPlatform();
    case 'ios':
      return new IOSPlatform();
    case 'android':
      return new AndroidPlatform();
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

function detectPlatform(): 'macos' | 'linux' | 'windows' {
  const platform = process.platform;
  if (platform === 'darwin') return 'macos';
  if (platform === 'linux') return 'linux';
  if (platform === 'win32') return 'windows';
  throw new Error(`Unsupported platform: ${platform}`);
}

export function createDeviceTools(config: DeviceUseConfig) {
  const platformImpl = getPlatformImplementation(config);
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
            return await platformImpl.screenshot();

          case 'mouse_move':
            if (!coordinate) {
              return 'Error: mouse_move requires coordinate';
            }
            return await platformImpl.moveMouse(coordinate[0], coordinate[1]);

          case 'left_click':
          case 'right_click':
          case 'middle_click':
          case 'double_click':
            return await platformImpl.click(action, coordinate);

          case 'left_click_drag':
            if (!coordinate || coordinate.length !== 2) {
              return 'Error: left_click_drag requires [fromX, fromY, toX, toY] coordinate';
            }
            return await platformImpl.drag(coordinate[0], coordinate[1], coordinate[0], coordinate[1]);

          case 'type':
            if (!text) {
              return 'Error: type action requires text';
            }
            return await platformImpl.typeText(text);

          case 'key':
            if (!text) {
              return 'Error: key action requires text (key name)';
            }
            return await platformImpl.pressKey(text);

          case 'cursor_position':
            return await platformImpl.getCursorPosition();

          case 'triple_click':
            return await platformImpl.click('double_click', coordinate);

          case 'left_mouse_down':
          case 'left_mouse_up':
            return `${action} not fully implemented yet`;

          case 'hold_key':
            if (!text) {
              return 'Error: hold_key action requires text (key name)';
            }
            return await platformImpl.pressKey(text);

          case 'scroll':
            if (!coordinate) {
              return 'Error: scroll requires coordinate';
            }
            return await platformImpl.scroll(coordinate[0], coordinate[1]);

          case 'wait':
            return 'wait action completed';

          default:
            return `Unknown action: ${action}`;
        }
      } catch (error) {
        const errorMsg = `Action failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(`[device-use] ${errorMsg}`);
        return errorMsg;
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
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`[device-use] Bash command failed: ${errorMsg}`);
        return `Error: ${errorMsg}`;
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
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`[device-use] Text editor command failed: ${errorMsg}`);
        return `Error: ${errorMsg}`;
      }
    },
  });

  return {
    computer: computerTool,
    bash: bashTool,
    text_editor: textEditorTool,
  };
}
