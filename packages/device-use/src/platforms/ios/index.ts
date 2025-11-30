import { PlatformImplementation, ScreenshotResult } from '../../types.js';

export class IOSPlatform implements PlatformImplementation {
  constructor() {
    throw new Error(
      'iOS platform requires native implementation. ' +
      'This will be available when the React Native mobile app is implemented in Phase 3. ' +
      'iOS device control requires native Swift/Objective-C code or React Native bridges for: ' +
      '- UIGraphicsGetImageFromCurrentImageContext for screenshots ' +
      '- UIAccessibility APIs for touch simulation ' +
      '- UIKeyboard APIs for keyboard input'
    );
  }

  async screenshot(): Promise<ScreenshotResult> {
    throw new Error('Not implemented - requires native iOS code');
  }

  async moveMouse(x: number, y: number): Promise<string> {
    throw new Error('Not implemented - iOS uses touch, not mouse');
  }

  async click(
    action: 'left_click' | 'right_click' | 'middle_click' | 'double_click',
    coordinate?: [number, number]
  ): Promise<string> {
    throw new Error('Not implemented - iOS uses touch gestures');
  }

  async drag(fromX: number, fromY: number, toX: number, toY: number): Promise<string> {
    throw new Error('Not implemented - requires native touch simulation');
  }

  async typeText(text: string): Promise<string> {
    throw new Error('Not implemented - requires UIKeyboard integration');
  }

  async pressKey(key: string): Promise<string> {
    throw new Error('Not implemented - requires UIKeyboard integration');
  }

  async scroll(x: number, y: number): Promise<string> {
    throw new Error('Not implemented - requires touch scroll simulation');
  }

  async getCursorPosition(): Promise<string> {
    throw new Error('Not applicable - iOS does not have a cursor');
  }
}
