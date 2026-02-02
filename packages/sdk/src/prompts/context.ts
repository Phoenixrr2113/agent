/**
 * @agent/sdk - System Context Builder
 * Builds dynamic context information for agent system prompts
 */

// ============================================================================
// Types
// ============================================================================

export interface UserLocation {
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  timezone?: string;
}

export interface UserPreferences {
  name?: string;
  language?: string;
  communicationStyle?: 'concise' | 'detailed' | 'technical' | 'casual';
  codeStyle?: {
    indentation?: 'tabs' | 'spaces';
    indentSize?: number;
    quoteStyle?: 'single' | 'double';
  };
  customPreferences?: Record<string, unknown>;
}

export interface SystemContext {
  // Time
  currentTime: string;
  currentDate: string;
  timezone: string;
  
  // Environment
  platform: string;
  hostname: string;
  username: string;
  locale: string;
  
  // Workspace
  workspaceRoot?: string;
  workspaceMap?: string;
  
  // User
  userLocation?: UserLocation;
  userPreferences?: UserPreferences;
  userProfileBlock?: string;
}

export interface ContextOptions {
  workspaceRoot?: string;
  includeWorkspaceMap?: boolean;
  userLocation?: UserLocation;
  userPreferences?: UserPreferences;
  fetchLocation?: boolean; // If true, attempt to get location from IP
}

// ============================================================================
// Runtime Detection
// ============================================================================

const isNode = typeof process !== 'undefined' && process.versions?.node;

async function getNodeInfo(): Promise<{ platform: string; hostname: string; username: string }> {
  if (!isNode) {
    return {
      platform: 'browser',
      hostname: 'browser',
      username: 'user',
    };
  }
  
  const os = await import('node:os');
  return {
    platform: os.platform(),
    hostname: os.hostname(),
    username: os.userInfo().username,
  };
}

function getLocale(): string {
  if (typeof Intl !== 'undefined') {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  }
  return 'en-US';
}

// ============================================================================
// Location (Optional)
// ============================================================================

async function fetchUserLocation(): Promise<UserLocation | undefined> {
  try {
    // Use ip-api.com (free, no API key required)
    const response = await fetch('http://ip-api.com/json/?fields=city,regionName,country,countryCode,timezone');
    if (!response.ok) return undefined;
    
    const data = await response.json() as {
      city?: string;
      regionName?: string;
      country?: string;
      countryCode?: string;
      timezone?: string;
    };
    
    return {
      city: data.city,
      region: data.regionName,
      country: data.country,
      countryCode: data.countryCode,
      timezone: data.timezone,
    };
  } catch {
    return undefined;
  }
}

// ============================================================================
// Workspace Map
// ============================================================================

async function generateWorkspaceMap(workspaceRoot: string): Promise<string> {
  if (!isNode) return '';
  
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    
    if (!fs.existsSync(workspaceRoot)) return '';
    
    const entries = fs.readdirSync(workspaceRoot);
    const topLevel = entries
      .filter(e => !e.startsWith('.'))
      .slice(0, 20)
      .map(e => {
        const fullPath = path.join(workspaceRoot, e);
        const isDir = fs.statSync(fullPath).isDirectory();
        if (isDir) {
          const children = fs.readdirSync(fullPath).filter(c => !c.startsWith('.')).slice(0, 5);
          return `${e}/: ${children.join(', ')}${children.length >= 5 ? '...' : ''}`;
        }
        return e;
      });
    return topLevel.join('\n');
  } catch {
    return '';
  }
}

// ============================================================================
// Context Builder
// ============================================================================

export async function buildSystemContext(options: ContextOptions = {}): Promise<SystemContext> {
  const {
    workspaceRoot,
    includeWorkspaceMap = false,
    userLocation,
    userPreferences,
    fetchLocation = false,
  } = options;

  const now = new Date();
  const nodeInfo = await getNodeInfo();

  // Optionally fetch location
  let location = userLocation;
  if (!location && fetchLocation) {
    location = await fetchUserLocation();
  }

  const context: SystemContext = {
    currentTime: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    currentDate: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    timezone: location?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    platform: nodeInfo.platform,
    hostname: nodeInfo.hostname,
    username: nodeInfo.username,
    locale: getLocale(),
    workspaceRoot,
    userLocation: location,
    userPreferences,
  };

  if (includeWorkspaceMap && workspaceRoot) {
    context.workspaceMap = await generateWorkspaceMap(workspaceRoot);
  }

  return context;
}

// ============================================================================
// Formatting
// ============================================================================

export function formatSystemContextBlock(context: SystemContext): string {
  const lines = [
    '# Current Environment',
    '',
    `- **Date**: ${context.currentDate}`,
    `- **Time**: ${context.currentTime} (${context.timezone})`,
    `- **Locale**: ${context.locale}`,
    `- **Platform**: ${context.platform}`,
    `- **User**: ${context.username}`,
  ];

  // Location
  if (context.userLocation) {
    const loc = context.userLocation;
    const locationParts = [loc.city, loc.region, loc.country].filter(Boolean);
    if (locationParts.length > 0) {
      lines.push(`- **Location**: ${locationParts.join(', ')}`);
    }
  }

  // Workspace
  if (context.workspaceRoot) {
    lines.push(`- **Workspace**: ${context.workspaceRoot}`);
  }

  if (context.workspaceMap) {
    lines.push('');
    lines.push('## Workspace Structure');
    lines.push('```');
    lines.push(context.workspaceMap);
    lines.push('```');
  }

  // User Preferences
  if (context.userPreferences) {
    const prefs = context.userPreferences;
    lines.push('');
    lines.push('## User Preferences');
    
    if (prefs.name) lines.push(`- **Name**: ${prefs.name}`);
    if (prefs.language) lines.push(`- **Preferred Language**: ${prefs.language}`);
    if (prefs.communicationStyle) lines.push(`- **Communication Style**: ${prefs.communicationStyle}`);
    
    if (prefs.codeStyle) {
      lines.push('- **Code Style**:');
      if (prefs.codeStyle.indentation) lines.push(`  - Indentation: ${prefs.codeStyle.indentation}`);
      if (prefs.codeStyle.indentSize) lines.push(`  - Indent Size: ${prefs.codeStyle.indentSize}`);
      if (prefs.codeStyle.quoteStyle) lines.push(`  - Quote Style: ${prefs.codeStyle.quoteStyle}`);
    }
    
    if (prefs.customPreferences && Object.keys(prefs.customPreferences).length > 0) {
      for (const [key, value] of Object.entries(prefs.customPreferences)) {
        lines.push(`- **${key}**: ${String(value)}`);
      }
    }
  }

  // Appended profile block (from memory system)
  if (context.userProfileBlock) {
    lines.push('');
    lines.push(context.userProfileBlock);
  }

  return lines.join('\n');
}

// ============================================================================
// Convenience Function
// ============================================================================

export async function buildDynamicSystemPrompt(
  basePrompt: string,
  options: ContextOptions = {}
): Promise<string> {
  const context = await buildSystemContext(options);
  const contextBlock = formatSystemContextBlock(context);
  return `${basePrompt}\n\n${contextBlock}`;
}

// Legacy overload for backward compatibility
export async function buildSystemContextLegacy(
  workspaceRoot?: string, 
  includeWorkspaceMap = false
): Promise<SystemContext> {
  return buildSystemContext({ workspaceRoot, includeWorkspaceMap });
}

