import { requireNativeModule } from 'expo-modules-core';

interface AgentAccessibilityModule {
  isAccessibilityEnabled(): boolean;
  click(x: number, y: number): Promise<boolean>;
  swipe(x1: number, y1: number, x2: number, y2: number, duration: number): Promise<boolean>;
  showOverlay(): boolean;
  hideOverlay(): boolean;
}

let AgentAccessibility: AgentAccessibilityModule | null = null;

try {
  AgentAccessibility = requireNativeModule('AgentAccessibility');
} catch {
  console.warn('AgentAccessibility native module not available (web or iOS platform)');
}

export function isAccessibilityEnabled(): boolean {
  if (!AgentAccessibility) return false;
  return AgentAccessibility.isAccessibilityEnabled();
}

export async function click(x: number, y: number): Promise<boolean> {
  if (!AgentAccessibility) {
    console.warn('AgentAccessibility not available on this platform');
    return false;
  }
  return await AgentAccessibility.click(x, y);
}

// eslint-disable-next-line max-params
export async function swipe(x1: number, y1: number, x2: number, y2: number, duration = 300): Promise<boolean> {
  if (!AgentAccessibility) {
    console.warn('AgentAccessibility not available on this platform');
    return false;
  }
  return await AgentAccessibility.swipe(x1, y1, x2, y2, duration);
}

export function showOverlay(): boolean {
  if (!AgentAccessibility) {
    console.warn('AgentAccessibility not available on this platform');
    return false;
  }
  return AgentAccessibility.showOverlay();
}

export function hideOverlay(): boolean {
  if (!AgentAccessibility) {
    console.warn('AgentAccessibility not available on this platform');
    return false;
  }
  return AgentAccessibility.hideOverlay();
}
