import { mouse, keyboard, screen, Button, Key, Point } from '@nut-tree-fork/nut-js';
import { DeviceDriver } from '../driver.js';

export class DesktopDriver implements DeviceDriver {
  async getScreenshot(): Promise<string> {
    try {
      const image = await screen.grab();
      return (image as any).data.toString('base64');
    } catch (error) {
      throw new Error(`Screenshot failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async click(x: number, y: number): Promise<void> {
    await mouse.setPosition(new Point(x, y));
    await mouse.click(Button.LEFT);
  }

  async doubleClick(x: number, y: number): Promise<void> {
    await mouse.setPosition(new Point(x, y));
    await mouse.doubleClick(Button.LEFT);
  }

  async rightClick(x: number, y: number): Promise<void> {
    await mouse.setPosition(new Point(x, y));
    await mouse.click(Button.RIGHT);
  }

  async type(text: string): Promise<void> {
    await keyboard.type(text);
  }

  async pressKey(key: string): Promise<void> {
    const nutKey = this.mapKeyToNutJS(key);
    await keyboard.type(nutKey);
  }

  async scroll(dx: number, dy: number): Promise<void> {
    if (dy > 0) {
      await mouse.scrollDown(Math.abs(dy));
    } else if (dy < 0) {
      await mouse.scrollUp(Math.abs(dy));
    }

    if (dx > 0) {
      await mouse.scrollRight(Math.abs(dx));
    } else if (dx < 0) {
      await mouse.scrollLeft(Math.abs(dx));
    }
  }

  async drag(x1: number, y1: number, x2: number, y2: number): Promise<void> {
    await mouse.setPosition(new Point(x1, y1));
    await mouse.drag([new Point(x2, y2)]);
  }

  async getScreenSize(): Promise<{ width: number; height: number }> {
    const width = await screen.width();
    const height = await screen.height();
    return { width, height };
  }

  async getCursorPosition(): Promise<{ x: number; y: number }> {
    const position = await mouse.getPosition();
    return { x: position.x, y: position.y };
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
