import { PlatformImplementation, ScreenshotResult } from '../../types.js';

export class AndroidPlatform implements PlatformImplementation {
  constructor() {
    throw new Error(
      'Android platform requires native implementation. ' +
      'This will be available when the React Native mobile app is implemented in Phase 3. ' +
      'Android device control requires native Java/Kotlin code or React Native bridges for: ' +
      '- MediaProjection API for screenshots ' +
      '- AccessibilityService for touch simulation ' +
      '- InputConnection API for keyboard input ' +
      'Alternatively, rooted devices can use adb shell commands: ' +
      '- screencap for screenshots ' +
      '- input tap/swipe for touch ' +
      '- input text for typing'
    );
  }

  async screenshot(): Promise<ScreenshotResult> {
    throw new Error('Not implemented - requires native Android code or adb');
  }

  async moveMouse(x: number, y: number): Promise<string> {
    throw new Error('Not implemented - Android uses touch, not mouse');
  }

  async click(
    action: 'left_click' | 'right_click' | 'middle_click' | 'double_click',
    coordinate?: [number, number]
  ): Promise<string> {
    throw new Error('Not implemented - Android uses touch gestures');
  }

  async drag(fromX: number, fromY: number, toX: number, toY: number): Promise<string> {
    throw new Error('Not implemented - requires native touch simulation or adb');
  }

  async typeText(text: string): Promise<string> {
    throw new Error('Not implemented - requires InputConnection or adb input text');
  }

  async pressKey(key: string): Promise<string> {
    throw new Error('Not implemented - requires InputConnection or adb input keyevent');
  }

  async scroll(x: number, y: number): Promise<string> {
    throw new Error('Not implemented - requires touch scroll simulation or adb');
  }

  async getCursorPosition(): Promise<string> {
    throw new Error('Not applicable - Android does not have a cursor');
  }
}
