const { withAndroidManifest } = require('@expo/config-plugins');

const withAccessibilityService = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.application[0];

    // Check if service already exists
    const serviceName = 'agent.accessibility.AgentAccessibilityService';
    const existingService = mainApplication.service?.find(
      (s) => s.$['android:name'] === serviceName
    );

    if (!androidManifest.manifest['uses-permission']) {
      androidManifest.manifest['uses-permission'] = [];
    }
    const hasOverlayPermission = androidManifest.manifest['uses-permission'].some(
      (p) => p.$['android:name'] === 'android.permission.SYSTEM_ALERT_WINDOW'
    );
    if (!hasOverlayPermission) {
      androidManifest.manifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.SYSTEM_ALERT_WINDOW' },
      });
    }

    if (!existingService) {
      if (!mainApplication.service) {
        mainApplication.service = [];
      }

      mainApplication.service.push({
        $: {
          'android:name': serviceName,
          'android:permission': 'android.permission.BIND_ACCESSIBILITY_SERVICE',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.accessibilityservice.AccessibilityService',
                },
              },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.accessibilityservice',
              'android:resource': '@xml/accessibility_service_config',
            },
          },
        ],
      });
    }

    return config;
  });
};

module.exports = withAccessibilityService;
