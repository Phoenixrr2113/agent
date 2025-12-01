package agent.accessibility

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.util.Log

class AgentAccessibilityService : AccessibilityService() {
    companion object {
        var instance: AgentAccessibilityService? = null
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        Log.d("AgentAccessibility", "Service Connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Listen to events if needed
    }

    override fun onInterrupt() {
        instance = null
        Log.d("AgentAccessibility", "Service Interrupted")
    }
    
    override fun onDestroy() {
        super.onDestroy()
        instance = null
    }
}
