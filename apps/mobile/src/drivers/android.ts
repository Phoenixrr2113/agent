import { DeviceDriver } from '@agent/device-use/dist/driver';
import * as AgentAccessibility from 'agent-accessibility';

export class AndroidDriver implements DeviceDriver {
  async click(x: number, y: number): Promise<void> {
    // @ts-ignore
    await AgentAccessibility.click(x, y);
  }

  async doubleClick(x: number, y: number): Promise<void> {
    // Android doesn't have native double click gesture, simulate with two clicks
    // @ts-ignore
    await AgentAccessibility.click(x, y);
    // @ts-ignore
    await AgentAccessibility.click(x, y);
  }

  async rightClick(x: number, y: number): Promise<void> {
    // Android doesn't have right click, maybe long press?
    // For now, just click
    // @ts-ignore
    await AgentAccessibility.click(x, y);
  }

  async type(text: string): Promise<void> {
    // Not implemented yet - requires AccessibilityService input method or ADB
    console.warn('type() not implemented on AndroidDriver yet');
  }

  async pressKey(key: string): Promise<void> {
    // Not implemented yet
    console.warn('pressKey() not implemented on AndroidDriver yet');
  }

  async scroll(dx: number, dy: number): Promise<void> {
    // Implement swipe for scroll
    // This is a simplification, we need current position or center of screen
    const { width, height } = await this.getScreenSize();
    const cx = width / 2;
    const cy = height / 2;
    
    // Scroll down = swipe up
    // Scroll up = swipe down
    const startY = cy;
    const endY = cy - dy; 
    
    // @ts-ignore
    await AgentAccessibility.swipe(cx, startY, cx, endY, 300);
  }

  async drag(x1: number, y1: number, x2: number, y2: number): Promise<void> {
    // @ts-ignore
    await AgentAccessibility.swipe(x1, y1, x2, y2, 500);
  }

  async getScreenSize(): Promise<{ width: number; height: number }> {
    // We can get this from React Native Dimensions
    const { Dimensions } = require('react-native');
    const { width, height } = Dimensions.get('screen');
    return { width, height };
  }

  async getScreenshot(): Promise<string> {
    // Requires MediaProjection API or AccessibilityService takeScreenshot (API 30+)
    // For now, return empty or implement later
    console.warn('getScreenshot() not implemented on AndroidDriver yet');
    return '';
  }

  async getCursorPosition(): Promise<{ x: number; y: number }> {
    // Android doesn't have a cursor
    return { x: 0, y: 0 };
  }
}
