export type ActionResult = ActionSuccess | ActionError

export interface ActionSuccess {
  success: true
  data?: ScreenshotData | UITreeData | string
}

export interface ActionError {
  success: false
  error: string
  code:
    | 'NOT_SUPPORTED'
    | 'PERMISSION_DENIED'
    | 'ELEMENT_NOT_FOUND'
    | 'TIMEOUT'
    | 'NOT_FOUND'
    | 'UNKNOWN'
}

export interface ScreenshotData {
  type: 'screenshot'
  base64: string
  format: 'png' | 'jpeg'
  width: number
  height: number
}

export interface UITreeData {
  type: 'ui_tree'
  root: UIElement
}

export interface UIElement {
  id: string
  type: 'button' | 'text' | 'input' | 'image' | 'container' | 'unknown'
  bounds: { x: number; y: number; width: number; height: number }
  text?: string
  contentDescription?: string
  clickable: boolean
  focusable: boolean
  enabled: boolean
  visible: boolean
  children: UIElement[]
}
