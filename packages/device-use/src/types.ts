export type Platform = 'macos' | 'linux' | 'windows' | 'ios' | 'android';

export type ComputerAction =
  | 'key'
  | 'type'
  | 'mouse_move'
  | 'left_click'
  | 'left_click_drag'
  | 'right_click'
  | 'middle_click'
  | 'double_click'
  | 'screenshot'
  | 'cursor_position'
  | 'hold_key'
  | 'left_mouse_down'
  | 'left_mouse_up'
  | 'triple_click'
  | 'scroll'
  | 'wait';

export interface ComputerActionParams {
  action: ComputerAction;
  coordinate?: [number, number];
  text?: string;
}

export interface ScreenshotResult {
  type: 'image';
  data: string;
}

export type ComputerActionResult = string | ScreenshotResult;

export interface PlatformImplementation {
  screenshot(): Promise<ScreenshotResult>;
  moveMouse(x: number, y: number): Promise<string>;
  click(action: 'left_click' | 'right_click' | 'middle_click' | 'double_click', coordinate?: [number, number]): Promise<string>;
  drag(fromX: number, fromY: number, toX: number, toY: number): Promise<string>;
  typeText(text: string): Promise<string>;
  pressKey(key: string): Promise<string>;
  scroll(x: number, y: number): Promise<string>;
  getCursorPosition(): Promise<string>;
}

export interface DeviceUseConfig {
  displayWidth: number;
  displayHeight: number;
  platform?: Platform;
  safeMode?: boolean;
  maxActionsPerMinute?: number;
  allowedApps?: string[];
  blockedApps?: string[];
  requireConfirmation?: ComputerAction[];
}

export interface BashCommand {
  command: string;
  restart?: boolean;
}

export interface TextEditorCommand {
  command: 'view' | 'create' | 'str_replace' | 'insert' | 'undo_edit';
  path: string;
  file_text?: string;
  insert_line?: number;
  new_str?: string;
  old_str?: string;
  view_range?: [number, number];
}
