import { requireNativeModule } from 'expo-modules-core'

interface AgentAccessibilityModule {
  isAccessibilityEnabled(): boolean
  click(x: number, y: number): Promise<boolean>
  longPress(x: number, y: number, durationMs: number): Promise<boolean>
  swipe(x1: number, y1: number, x2: number, y2: number, duration: number): Promise<boolean>
  type(text: string): Promise<boolean>
  pressKey(keyAction: string): Promise<boolean>
  screenshot(): Promise<string | null>
  getUITree(): Promise<string | null>
  showOverlay(): boolean
  hideOverlay(): boolean
}

let AgentAccessibility: AgentAccessibilityModule | null = null

try {
  AgentAccessibility = requireNativeModule('AgentAccessibility')
} catch {
  console.warn('AgentAccessibility native module not available (web or iOS platform)')
}

export function isAccessibilityEnabled(): boolean {
  if (!AgentAccessibility) return false
  return AgentAccessibility.isAccessibilityEnabled()
}

export async function click(x: number, y: number): Promise<boolean> {
  if (!AgentAccessibility) {
    console.warn('AgentAccessibility not available on this platform')
    return false
  }
  return await AgentAccessibility.click(x, y)
}

export async function longPress(x: number, y: number, durationMs = 500): Promise<boolean> {
  if (!AgentAccessibility) {
    console.warn('AgentAccessibility not available on this platform')
    return false
  }
  return await AgentAccessibility.longPress(x, y, durationMs)
}

export async function swipe(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  duration = 300
): Promise<boolean> {
  if (!AgentAccessibility) {
    console.warn('AgentAccessibility not available on this platform')
    return false
  }
  return await AgentAccessibility.swipe(x1, y1, x2, y2, duration)
}

export async function type(text: string): Promise<boolean> {
  if (!AgentAccessibility) {
    console.warn('AgentAccessibility not available on this platform')
    return false
  }
  return await AgentAccessibility.type(text)
}

export async function pressKey(keyAction: string): Promise<boolean> {
  if (!AgentAccessibility) {
    console.warn('AgentAccessibility not available on this platform')
    return false
  }
  return await AgentAccessibility.pressKey(keyAction)
}

export async function screenshot(): Promise<string | null> {
  if (!AgentAccessibility) {
    console.warn('AgentAccessibility not available on this platform')
    return null
  }
  return await AgentAccessibility.screenshot()
}

export async function getUITree(): Promise<string | null> {
  if (!AgentAccessibility) {
    console.warn('AgentAccessibility not available on this platform')
    return null
  }
  return await AgentAccessibility.getUITree()
}

export function showOverlay(): boolean {
  if (!AgentAccessibility) {
    console.warn('AgentAccessibility not available on this platform')
    return false
  }
  return AgentAccessibility.showOverlay()
}

export function hideOverlay(): boolean {
  if (!AgentAccessibility) {
    console.warn('AgentAccessibility not available on this platform')
    return false
  }
  return AgentAccessibility.hideOverlay()
}

