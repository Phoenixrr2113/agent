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

export class LinuxPlatform implements PlatformImplementation {
  async screenshot(): Promise<ScreenshotResult> {
    const tempPath = join(tmpdir(), `screenshot-${Date.now()}.png`);

    try {
      try {
        await executeCommand('scrot', [tempPath]);
      } catch {
        await executeCommand('gnome-screenshot', ['-f', tempPath]);
      }

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
      await executeCommand('xdotool', ['mousemove', x.toString(), y.toString()]);
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
        'left_click': '1',
        'right_click': '3',
        'middle_click': '2',
        'double_click': '1',
      };

      if (action === 'double_click') {
        await executeCommand('xdotool', ['click', '--repeat', '2', clickMap[action]]);
      } else {
        await executeCommand('xdotool', ['click', clickMap[action]]);
      }

      return `Performed ${action}${coordinate ? ` at (${coordinate[0]}, ${coordinate[1]})` : ''}`;
    } catch (error) {
      throw new Error(`Click failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async drag(fromX: number, fromY: number, toX: number, toY: number): Promise<string> {
    try {
      await executeCommand('xdotool', [
        'mousemove',
        fromX.toString(),
        fromY.toString(),
        'mousedown', '1',
        'mousemove',
        toX.toString(),
        toY.toString(),
        'mouseup', '1'
      ]);
      return `Dragged from (${fromX}, ${fromY}) to (${toX}, ${toY})`;
    } catch (error) {
      throw new Error(`Drag failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async typeText(text: string): Promise<string> {
    try {
      await executeCommand('xdotool', ['type', '--', text]);
      return `Typed text: ${text}`;
    } catch (error) {
      throw new Error(`Type text failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async pressKey(key: string): Promise<string> {
    try {
      const keyMap: Record<string, string> = {
        'Return': 'Return',
        'Enter': 'Return',
        'Tab': 'Tab',
        'Space': 'space',
        'Escape': 'Escape',
        'Delete': 'Delete',
        'Backspace': 'BackSpace',
        'Up': 'Up',
        'Down': 'Down',
        'Left': 'Left',
        'Right': 'Right',
      };

      const mappedKey = keyMap[key] || key;
      await executeCommand('xdotool', ['key', mappedKey]);
      return `Pressed key: ${key}`;
    } catch (error) {
      throw new Error(`Press key failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async scroll(x: number, y: number): Promise<string> {
    try {
      const direction = y > 0 ? '5' : '4';
      const amount = Math.abs(y);
      await executeCommand('xdotool', ['click', '--repeat', amount.toString(), direction]);
      return `Scrolled by (${x}, ${y})`;
    } catch (error) {
      throw new Error(`Scroll failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCursorPosition(): Promise<string> {
    try {
      const result = await executeCommand('xdotool', ['getmouselocation']);
      return `Cursor position: ${result}`;
    } catch (error) {
      throw new Error(`Get cursor position failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
