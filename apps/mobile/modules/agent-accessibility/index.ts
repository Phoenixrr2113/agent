import { requireNativeModule } from 'expo-modules-core';

const AgentAccessibility = requireNativeModule('AgentAccessibility');

export function isAccessibilityEnabled(): boolean {
  return AgentAccessibility.isAccessibilityEnabled();
}

export async function click(x: number, y: number): Promise<boolean> {
  return await AgentAccessibility.click(x, y);
}

export async function swipe(x1: number, y1: number, x2: number, y2: number, duration: number = 300): Promise<boolean> {
  return await AgentAccessibility.swipe(x1, y1, x2, y2, duration);
}
