import { spawn } from 'child_process';
import { unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { PlatformImplementation, ScreenshotResult } from '../../types.js';
import { imageToBase64 } from '../../utils/image.js';

async function executeCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed: ${stderr || stdout}`));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

export class MacOSPlatform implements PlatformImplementation {
  async screenshot(): Promise<ScreenshotResult> {
    const tempPath = join(tmpdir(), `screenshot-${Date.now()}.png`);

    try {
      await executeCommand('screencapture', ['-x', tempPath]);
      const base64 = await imageToBase64(tempPath);
      await unlink(tempPath);

      return {
        type: 'image',
        data: base64,
      };
    } catch (error) {
      throw new Error(`Screenshot failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async moveMouse(x: number, y: number): Promise<string> {
    try {
      const script = `
        tell application "System Events"
          set mouseLocation to {${x}, ${y}}
        end tell
      `;
      await executeCommand('osascript', ['-e', script]);
      return `Moved mouse to (${x}, ${y})`;
    } catch (error) {
      throw new Error(`Mouse move failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async click(
    action: 'left_click' | 'right_click' | 'middle_click' | 'double_click',
    coordinate?: [number, number]
  ): Promise<string> {
    try {
      if (coordinate) {
        await this.moveMouse(coordinate[0], coordinate[1]);
      }

      const clickMap = {
        'left_click': 'click',
        'right_click': 'right click',
        'middle_click': 'middle click',
        'double_click': 'double click',
      };

      const script = `
        tell application "System Events"
          ${clickMap[action]}
        end tell
      `;
      await executeCommand('osascript', ['-e', script]);

      return `Performed ${action}${coordinate ? ` at (${coordinate[0]}, ${coordinate[1]})` : ''}`;
    } catch (error) {
      throw new Error(`Click failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async drag(fromX: number, fromY: number, toX: number, toY: number): Promise<string> {
    try {
      const script = `
        tell application "System Events"
          set mouseLocation to {${fromX}, ${fromY}}
          mouse down
          delay 0.1
          set mouseLocation to {${toX}, ${toY}}
          delay 0.1
          mouse up
        end tell
      `;
      await executeCommand('osascript', ['-e', script]);
      return `Dragged from (${fromX}, ${fromY}) to (${toX}, ${toY})`;
    } catch (error) {
      throw new Error(`Drag failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async typeText(text: string): Promise<string> {
    try {
      const escapedText = text.replace(/"/g, '\\"');
      const script = `
        tell application "System Events"
          keystroke "${escapedText}"
        end tell
      `;
      await executeCommand('osascript', ['-e', script]);
      return `Typed text: ${text}`;
    } catch (error) {
      throw new Error(`Type text failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async pressKey(key: string): Promise<string> {
    try {
      const keyMap: Record<string, string> = {
        'Return': 'return',
        'Enter': 'return',
        'Tab': 'tab',
        'Space': 'space',
        'Escape': 'escape',
        'Delete': 'delete',
        'Backspace': 'delete',
        'Up': 'up arrow',
        'Down': 'down arrow',
        'Left': 'left arrow',
        'Right': 'right arrow',
      };

      const mappedKey = keyMap[key] || key.toLowerCase();
      const script = `
        tell application "System Events"
          key code ${mappedKey}
        end tell
      `;
      await executeCommand('osascript', ['-e', script]);
      return `Pressed key: ${key}`;
    } catch (error) {
      throw new Error(`Press key failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async scroll(x: number, y: number): Promise<string> {
    try {
      const script = `
        tell application "System Events"
          scroll ${y} 0
        end tell
      `;
      await executeCommand('osascript', ['-e', script]);
      return `Scrolled by (${x}, ${y})`;
    } catch (error) {
      throw new Error(`Scroll failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCursorPosition(): Promise<string> {
    try {
      const script = `
        tell application "System Events"
          get position of mouse
        end tell
      `;
      const result = await executeCommand('osascript', ['-e', script]);
      return `Cursor position: ${result}`;
    } catch (error) {
      throw new Error(`Get cursor position failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
