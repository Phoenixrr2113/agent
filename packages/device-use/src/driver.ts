export interface DeviceDriver {
  click(x: number, y: number): Promise<void>;
  doubleClick(x: number, y: number): Promise<void>;
  rightClick(x: number, y: number): Promise<void>;
  type(text: string): Promise<void>;
  pressKey(key: string): Promise<void>;
  scroll(dx: number, dy: number): Promise<void>;
  drag(x1: number, y1: number, x2: number, y2: number): Promise<void>;
  getScreenSize(): Promise<{ width: number; height: number }>;
  getScreenshot(): Promise<string>; // Base64
  getCursorPosition(): Promise<{ x: number; y: number }>;
}
