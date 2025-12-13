// eslint-disable-next-line import/no-relative-parent-imports
import type { ComputerAction, DeviceUseConfig } from '../types.js';

interface ActionRecord {
  timestamp: number;
  action: ComputerAction;
}

export class SafetyValidator {
  private actionHistory: ActionRecord[] = [];
  private config: Required<Omit<DeviceUseConfig, 'driver'>>;

  constructor(config: DeviceUseConfig) {
    this.config = {
      displayWidth: config.displayWidth,
      displayHeight: config.displayHeight,
      platform: config.platform ?? this.detectPlatform(),
      safeMode: config.safeMode ?? true,
      maxActionsPerMinute: config.maxActionsPerMinute ?? 60,
      allowedApps: config.allowedApps ?? [],
      blockedApps: config.blockedApps ?? [],
      requireConfirmation: config.requireConfirmation ?? [],
    };
  }

  private detectPlatform(): 'macos' | 'linux' | 'windows' | 'ios' | 'android' {
    const platform = process.platform;
    if (platform === 'darwin') return 'macos';
    if (platform === 'linux') return 'linux';
    if (platform === 'win32') return 'windows';
    throw new Error(`Unsupported platform: ${platform}`);
  }

  validateAction(action: ComputerAction): { valid: boolean; reason?: string } {
    if (this.config.requireConfirmation.includes(action)) {
      return { valid: false, reason: 'Action requires user confirmation' };
    }

    if (!this.checkRateLimit()) {
      return { valid: false, reason: 'Rate limit exceeded' };
    }

    return { valid: true };
  }

  private checkRateLimit(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    this.actionHistory = this.actionHistory.filter(
      record => record.timestamp > oneMinuteAgo
    );

    return this.actionHistory.length < this.config.maxActionsPerMinute;
  }

  recordAction(action: ComputerAction): void {
    this.actionHistory.push({
      timestamp: Date.now(),
      action,
    });
  }

  validateCoordinate(coordinate?: [number, number]): { valid: boolean; reason?: string } {
    if (!coordinate) {
      return { valid: true };
    }

    const [x, y] = coordinate;
    if (x < 0 || x > this.config.displayWidth || y < 0 || y > this.config.displayHeight) {
      return {
        valid: false,
        reason: `Coordinate out of bounds: [${x}, ${y}] (max: [${this.config.displayWidth}, ${this.config.displayHeight}])`,
      };
    }

    return { valid: true };
  }

  getConfig(): Required<Omit<DeviceUseConfig, 'driver'>> {
    return this.config;
  }
}
