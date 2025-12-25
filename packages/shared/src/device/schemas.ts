import { z } from 'zod'

export const DevicePlatformSchema = z.enum(['desktop', 'android', 'ios', 'web'])

export const DeviceActionTypeSchema = z.enum([
  'tap',
  'double_tap',
  'long_press',
  'type',
  'key',
  'swipe',
  'scroll',
  'drag',
  'screenshot',
  'get_ui_tree',
])

export const TapPayloadSchema = z.object({
  x: z.number(),
  y: z.number(),
  elementId: z.string().optional(),
})

export const TypePayloadSchema = z.object({
  text: z.string(),
  elementId: z.string().optional(),
})

export const KeyPayloadSchema = z.object({
  key: z.string(),
  modifiers: z.array(z.enum(['ctrl', 'alt', 'shift', 'meta'])).optional(),
})

export const SwipePayloadSchema = z.object({
  fromX: z.number(),
  fromY: z.number(),
  toX: z.number(),
  toY: z.number(),
  durationMs: z.number().optional(),
})

export const ScrollPayloadSchema = z.object({
  deltaX: z.number(),
  deltaY: z.number(),
  x: z.number().optional(),
  y: z.number().optional(),
})

export const DragPayloadSchema = z.object({
  fromX: z.number(),
  fromY: z.number(),
  toX: z.number(),
  toY: z.number(),
})

export const ScreenshotPayloadSchema = z.object({
  format: z.enum(['png', 'jpeg']).optional(),
  quality: z.number().min(0).max(100).optional(),
})

export const UITreePayloadSchema = z.object({
  depth: z.number().optional(),
  includeInvisible: z.boolean().optional(),
})

export const DeviceActionPayloadSchema = z.union([
  TapPayloadSchema,
  TypePayloadSchema,
  KeyPayloadSchema,
  SwipePayloadSchema,
  ScrollPayloadSchema,
  DragPayloadSchema,
  ScreenshotPayloadSchema,
  UITreePayloadSchema,
])

export const DeviceActionSchema = z.object({
  type: DeviceActionTypeSchema,
  payload: z.record(z.unknown()),
})

export const ScreenSizeSchema = z.object({
  width: z.number(),
  height: z.number(),
})

export const DeviceCapabilitiesSchema = z.object({
  platform: DevicePlatformSchema,
  deviceId: z.string(),
  deviceName: z.string(),
  screenSize: ScreenSizeSchema,
  supportedActions: z.array(DeviceActionTypeSchema),
  hasKeyboard: z.boolean(),
  hasUITree: z.boolean(),
})

export const ActionErrorCodeSchema = z.enum([
  'NOT_SUPPORTED',
  'PERMISSION_DENIED',
  'ELEMENT_NOT_FOUND',
  'TIMEOUT',
  'NOT_FOUND',
  'UNKNOWN',
])

export const UIElementTypeSchema = z.enum([
  'button',
  'text',
  'input',
  'image',
  'container',
  'unknown',
])

export const BoundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
})

interface UIElementInput {
  id: string
  type: 'button' | 'text' | 'input' | 'image' | 'container' | 'unknown'
  bounds: { x: number; y: number; width: number; height: number }
  text?: string | undefined
  contentDescription?: string | undefined
  clickable: boolean
  focusable: boolean
  enabled: boolean
  visible: boolean
  children: UIElementInput[]
}

export const UIElementSchema: z.ZodType<UIElementInput> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: UIElementTypeSchema,
    bounds: BoundsSchema,
    text: z.string().optional(),
    contentDescription: z.string().optional(),
    clickable: z.boolean(),
    focusable: z.boolean(),
    enabled: z.boolean(),
    visible: z.boolean(),
    children: z.array(UIElementSchema),
  })
)

export const UITreeDataSchema = z.object({
  type: z.literal('ui_tree'),
  root: UIElementSchema,
})

export const ScreenshotDataSchema = z.object({
  type: z.literal('screenshot'),
  base64: z.string(),
  format: z.enum(['png', 'jpeg']),
  width: z.number(),
  height: z.number(),
})

export const ActionSuccessSchema = z.object({
  success: z.literal(true),
  data: z.union([ScreenshotDataSchema, UITreeDataSchema, z.string()]).optional(),
})

export const ActionErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: ActionErrorCodeSchema,
})

export const ActionResultSchema = z.discriminatedUnion('success', [
  ActionSuccessSchema,
  ActionErrorSchema,
])

export type DevicePlatform = z.infer<typeof DevicePlatformSchema>
export type DeviceActionType = z.infer<typeof DeviceActionTypeSchema>
export type TapPayload = z.infer<typeof TapPayloadSchema>
export type TypePayload = z.infer<typeof TypePayloadSchema>
export type KeyPayload = z.infer<typeof KeyPayloadSchema>
export type SwipePayload = z.infer<typeof SwipePayloadSchema>
export type ScrollPayload = z.infer<typeof ScrollPayloadSchema>
export type DragPayload = z.infer<typeof DragPayloadSchema>
export type ScreenshotPayload = z.infer<typeof ScreenshotPayloadSchema>
export type UITreePayload = z.infer<typeof UITreePayloadSchema>
export type DeviceActionPayload = z.infer<typeof DeviceActionPayloadSchema>
export type DeviceAction = z.infer<typeof DeviceActionSchema>
export type ScreenSize = z.infer<typeof ScreenSizeSchema>
export type DeviceCapabilities = z.infer<typeof DeviceCapabilitiesSchema>
export type ActionErrorCode = z.infer<typeof ActionErrorCodeSchema>
export type UIElementType = z.infer<typeof UIElementTypeSchema>
export type Bounds = z.infer<typeof BoundsSchema>
export type UIElement = z.infer<typeof UIElementSchema>
export type UITreeData = z.infer<typeof UITreeDataSchema>
export type ScreenshotData = z.infer<typeof ScreenshotDataSchema>
export type ActionSuccess = z.infer<typeof ActionSuccessSchema>
export type ActionError = z.infer<typeof ActionErrorSchema>
export type ActionResult = z.infer<typeof ActionResultSchema>
