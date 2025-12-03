import { requireNativeModule } from 'expo-modules-core';

let AgentAccessibility: any = null;

try {
  AgentAccessibility = requireNativeModule('AgentAccessibility');
} catch (e) {
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

export async function swipe(x1: number, y1: number, x2: number, y2: number, duration: number = 300): Promise<boolean> {
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
