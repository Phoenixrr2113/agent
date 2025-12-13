package agent.accessibility

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.util.Log
import android.graphics.PixelFormat
import android.graphics.Bitmap
import android.graphics.Rect
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Display
import java.io.ByteArrayOutputStream
import android.util.Base64
import org.json.JSONObject
import org.json.JSONArray

class AgentAccessibilityService : AccessibilityService() {
    companion object {
        var instance: AgentAccessibilityService? = null
    }

    private var windowManager: WindowManager? = null
    private var overlayView: FrameLayout? = null

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        Log.d("AgentAccessibility", "Service Connected")
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    }

    fun typeText(text: String): Boolean {
        val focused = findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
        if (focused != null) {
            val args = Bundle()
            args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
            val result = focused.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
            focused.recycle()
            Log.d("AgentAccessibility", "typeText: $result")
            return result
        }
        Log.w("AgentAccessibility", "typeText: No focused input field")
        return false
    }

    fun pressKey(keyAction: String): Boolean {
        val action = when (keyAction.lowercase()) {
            "back" -> GLOBAL_ACTION_BACK
            "home" -> GLOBAL_ACTION_HOME
            "recents" -> GLOBAL_ACTION_RECENTS
            "notifications" -> GLOBAL_ACTION_NOTIFICATIONS
            "quick_settings" -> GLOBAL_ACTION_QUICK_SETTINGS
            "power_dialog" -> GLOBAL_ACTION_POWER_DIALOG
            else -> {
                Log.w("AgentAccessibility", "Unknown key action: $keyAction")
                return false
            }
        }
        val result = performGlobalAction(action)
        Log.d("AgentAccessibility", "pressKey $keyAction: $result")
        return result
    }

    fun takeScreenshotAsync(callback: (String?) -> Unit) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            takeScreenshot(
                Display.DEFAULT_DISPLAY,
                applicationContext.mainExecutor,
                object : TakeScreenshotCallback {
                    override fun onSuccess(result: ScreenshotResult) {
                        try {
                            val bitmap = Bitmap.wrapHardwareBuffer(result.hardwareBuffer, result.colorSpace)
                            if (bitmap != null) {
                                val stream = ByteArrayOutputStream()
                                bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
                                val base64 = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
                                result.hardwareBuffer.close()
                                callback(base64)
                            } else {
                                callback(null)
                            }
                        } catch (e: Exception) {
                            Log.e("AgentAccessibility", "Screenshot encoding failed", e)
                            callback(null)
                        }
                    }

                    override fun onFailure(errorCode: Int) {
                        Log.e("AgentAccessibility", "Screenshot failed with error: $errorCode")
                        callback(null)
                    }
                }
            )
        } else {
            Log.w("AgentAccessibility", "Screenshot requires API 30+")
            callback(null)
        }
    }

    fun getUITree(): JSONObject? {
        val root = rootInActiveWindow
        if (root == null) {
            Log.w("AgentAccessibility", "getUITree: No root window")
            return null
        }
        val result = traverseNode(root)
        root.recycle()
        return result
    }

    private fun traverseNode(node: AccessibilityNodeInfo): JSONObject {
        val rect = Rect()
        node.getBoundsInScreen(rect)

        val obj = JSONObject()
        obj.put("id", node.viewIdResourceName ?: "")
        obj.put("type", mapClassName(node.className?.toString() ?: ""))
        obj.put("bounds", JSONObject().apply {
            put("x", rect.left)
            put("y", rect.top)
            put("width", rect.width())
            put("height", rect.height())
        })
        obj.put("text", node.text?.toString() ?: "")
        obj.put("contentDescription", node.contentDescription?.toString() ?: "")
        obj.put("clickable", node.isClickable)
        obj.put("focusable", node.isFocusable)
        obj.put("enabled", node.isEnabled)
        obj.put("visible", node.isVisibleToUser)

        val children = JSONArray()
        for (i in 0 until node.childCount) {
            val child = node.getChild(i)
            if (child != null) {
                children.put(traverseNode(child))
                child.recycle()
            }
        }
        obj.put("children", children)

        return obj
    }

    private fun mapClassName(className: String): String {
        return when {
            className.contains("Button") -> "button"
            className.contains("TextView") -> "text"
            className.contains("EditText") -> "input"
            className.contains("ImageView") -> "image"
            className.contains("Layout") || className.contains("ViewGroup") -> "container"
            else -> "unknown"
        }
    }

    fun showOverlay() {
        if (overlayView != null) return

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT
        )

        params.gravity = Gravity.TOP or Gravity.START
        params.x = 0
        params.y = 100

        overlayView = FrameLayout(this)
        val button = Button(this)
        button.text = "Agent"
        button.setOnClickListener {
            Log.d("AgentAccessibility", "Overlay Clicked")
        }
        overlayView?.addView(button)

        try {
            windowManager?.addView(overlayView, params)
        } catch (e: Exception) {
            Log.e("AgentAccessibility", "Error adding overlay view", e)
        }
    }

    fun hideOverlay() {
        if (overlayView != null) {
            try {
                windowManager?.removeView(overlayView)
                overlayView = null
            } catch (e: Exception) {
                Log.e("AgentAccessibility", "Error removing overlay view", e)
            }
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {}

    override fun onInterrupt() {
        instance = null
        hideOverlay()
        Log.d("AgentAccessibility", "Service Interrupted")
    }

    override fun onDestroy() {
        super.onDestroy()
        hideOverlay()
        instance = null
    }
}

