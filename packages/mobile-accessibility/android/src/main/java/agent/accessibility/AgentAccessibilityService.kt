package agent.accessibility

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.util.Log
import android.graphics.PixelFormat
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.content.Context
import android.content.Intent

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
            // TODO: Send event to React Native
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

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Listen to events if needed
    }

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
