import { mouse, keyboard, screen, Button, Key, Point } from '@nut-tree-fork/nut-js';
import { ScreenshotResult } from '../types.js';

export class NutJSPlatform {
  async screenshot(): Promise<ScreenshotResult> {
    try {
      const image = await screen.grab();

      const base64 = (image as any).data.toString('base64');

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
      await mouse.setPosition(new Point(x, y));
      return `Moved mouse to (${x}, ${y})`;
    } catch (error) {
      throw new Error(`Mouse move failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async click(
    action: 'left_click' | 'right_click' | 'middle_click' | 'double_click' | 'triple_click',
    coordinate?: [number, number]
  ): Promise<string> {
    try {
      if (coordinate) {
        await mouse.setPosition(new Point(coordinate[0], coordinate[1]));
      }

      switch (action) {
        case 'left_click':
          await mouse.click(Button.LEFT);
          break;
        case 'right_click':
          await mouse.click(Button.RIGHT);
          break;
        case 'middle_click':
          await mouse.click(Button.MIDDLE);
          break;
        case 'double_click':
          await mouse.doubleClick(Button.LEFT);
          break;
        case 'triple_click':
          await mouse.click(Button.LEFT);
          await mouse.click(Button.LEFT);
          await mouse.click(Button.LEFT);
          break;
      }

      return `Performed ${action}${coordinate ? ` at (${coordinate[0]}, ${coordinate[1]})` : ''}`;
    } catch (error) {
      throw new Error(`Click failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async drag(fromX: number, fromY: number, toX: number, toY: number): Promise<string> {
    try {
      await mouse.setPosition(new Point(fromX, fromY));
      await mouse.drag([new Point(toX, toY)]);
      return `Dragged from (${fromX}, ${fromY}) to (${toX}, ${toY})`;
    } catch (error) {
      throw new Error(`Drag failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async pressButton(action: 'left_mouse_down' | 'left_mouse_up'): Promise<string> {
    try {
      if (action === 'left_mouse_down') {
        await mouse.pressButton(Button.LEFT);
        return 'Left mouse button pressed';
      } else {
        await mouse.releaseButton(Button.LEFT);
        return 'Left mouse button released';
      }
    } catch (error) {
      throw new Error(`Press button failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async typeText(text: string): Promise<string> {
    try {
      await keyboard.type(text);
      return `Typed text: ${text}`;
    } catch (error) {
      throw new Error(`Type text failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async pressKey(key: string): Promise<string> {
    try {
      const nutKey = this.mapKeyToNutJS(key);
      await keyboard.type(nutKey);
      return `Pressed key: ${key}`;
    } catch (error) {
      throw new Error(`Press key failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async holdKey(key: string): Promise<string> {
    try {
      const nutKey = this.mapKeyToNutJS(key);
      await keyboard.pressKey(nutKey);
      return `Holding key: ${key}`;
    } catch (error) {
      throw new Error(`Hold key failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async releaseKey(key: string): Promise<string> {
    try {
      const nutKey = this.mapKeyToNutJS(key);
      await keyboard.releaseKey(nutKey);
      return `Released key: ${key}`;
    } catch (error) {
      throw new Error(`Release key failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async scroll(x: number, y: number): Promise<string> {
    try {
      if (y > 0) {
        await mouse.scrollDown(Math.abs(y));
      } else if (y < 0) {
        await mouse.scrollUp(Math.abs(y));
      }

      if (x > 0) {
        await mouse.scrollRight(Math.abs(x));
      } else if (x < 0) {
        await mouse.scrollLeft(Math.abs(x));
      }

      return `Scrolled by (${x}, ${y})`;
    } catch (error) {
      throw new Error(`Scroll failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCursorPosition(): Promise<string> {
    try {
      const position = await mouse.getPosition();
      return `Cursor position: (${position.x}, ${position.y})`;
    } catch (error) {
      throw new Error(`Get cursor position failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private mapKeyToNutJS(key: string): Key {
    const keyMap: Record<string, Key> = {
      'Return': Key.Return,
      'Enter': Key.Return,
      'Tab': Key.Tab,
      'Space': Key.Space,
      'Escape': Key.Escape,
      'Esc': Key.Escape,
      'Delete': Key.Delete,
      'Backspace': Key.Backspace,
      'Up': Key.Up,
      'Down': Key.Down,
      'Left': Key.Left,
      'Right': Key.Right,
      'Home': Key.Home,
      'End': Key.End,
      'PageUp': Key.PageUp,
      'PageDown': Key.PageDown,
      'F1': Key.F1,
      'F2': Key.F2,
      'F3': Key.F3,
      'F4': Key.F4,
      'F5': Key.F5,
      'F6': Key.F6,
      'F7': Key.F7,
      'F8': Key.F8,
      'F9': Key.F9,
      'F10': Key.F10,
      'F11': Key.F11,
      'F12': Key.F12,
      'LeftAlt': Key.LeftAlt,
      'RightAlt': Key.RightAlt,
      'LeftControl': Key.LeftControl,
      'LeftCtrl': Key.LeftControl,
      'RightControl': Key.RightControl,
      'RightCtrl': Key.RightControl,
      'LeftShift': Key.LeftShift,
      'RightShift': Key.RightShift,
      'LeftSuper': Key.LeftSuper,
      'LeftCmd': Key.LeftSuper,
      'LeftWin': Key.LeftSuper,
      'RightSuper': Key.RightSuper,
      'RightCmd': Key.RightSuper,
      'RightWin': Key.RightSuper,
    };

    return keyMap[key] || Key[key as keyof typeof Key] || key as unknown as Key;
  }
}
