package agent.accessibility

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.util.Log

class AgentAccessibilityModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AgentAccessibility")

    Function("isAccessibilityEnabled") {
      return@Function AgentAccessibilityService.instance != null
    }

    AsyncFunction("click") { x: Float, y: Float ->
      val service = AgentAccessibilityService.instance ?: throw Exception("Accessibility Service not enabled")
      
      val path = Path()
      path.moveTo(x, y)
      val builder = GestureDescription.Builder()
      val gestureDescription = builder
        .addStroke(GestureDescription.StrokeDescription(path, 0, 50))
        .build()
        
      val result = service.dispatchGesture(gestureDescription, null, null)
      Log.d("AgentAccessibility", "Click at $x, $y: $result")
      return@AsyncFunction result
    }
    
    AsyncFunction("swipe") { x1: Float, y1: Float, x2: Float, y2: Float, duration: Long ->
        val service = AgentAccessibilityService.instance ?: throw Exception("Accessibility Service not enabled")
        
        val path = Path()
        path.moveTo(x1, y1)
        path.lineTo(x2, y2)
        
        val builder = GestureDescription.Builder()
        val gestureDescription = builder
            .addStroke(GestureDescription.StrokeDescription(path, 0, duration))
            .build()
            
        val result = service.dispatchGesture(gestureDescription, null, null)
        Log.d("AgentAccessibility", "Swipe from $x1,$y1 to $x2,$y2: $result")
        return@AsyncFunction result
    }

    Function("showOverlay") {
      val service = AgentAccessibilityService.instance
      if (service != null) {
        service.showOverlay()
        return@Function true
      }
      return@Function false
    }

    Function("hideOverlay") {
      val service = AgentAccessibilityService.instance
      if (service != null) {
        service.hideOverlay()
        return@Function true
      }
      return@Function false
    }
  }
}
