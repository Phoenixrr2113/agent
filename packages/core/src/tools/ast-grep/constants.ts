import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';

import { getCachedBinaryPath } from './downloader.js';

export const CLI_LANGUAGES = [
  'bash',
  'c',
  'cpp',
  'csharp',
  'css',
  'elixir',
  'go',
  'haskell',
  'html',
  'java',
  'javascript',
  'json',
  'kotlin',
  'lua',
  'nix',
  'php',
  'python',
  'ruby',
  'rust',
  'scala',
  'solidity',
  'swift',
  'typescript',
  'tsx',
  'yaml',
] as const;

export const NAPI_LANGUAGES = ['html', 'javascript', 'tsx', 'css', 'typescript'] as const;

export const LANG_EXTENSIONS: Record<string, string[]> = {
  bash: ['.bash', '.sh', '.zsh', '.bats'],
  c: ['.c', '.h'],
  cpp: ['.cpp', '.cc', '.cxx', '.hpp', '.hxx', '.h'],
  csharp: ['.cs'],
  css: ['.css'],
  elixir: ['.ex', '.exs'],
  go: ['.go'],
  haskell: ['.hs', '.lhs'],
  html: ['.html', '.htm'],
  java: ['.java'],
  javascript: ['.js', '.jsx', '.mjs', '.cjs'],
  json: ['.json'],
  kotlin: ['.kt', '.kts'],
  lua: ['.lua'],
  nix: ['.nix'],
  php: ['.php'],
  python: ['.py', '.pyi'],
  ruby: ['.rb', '.rake'],
  rust: ['.rs'],
  scala: ['.scala', '.sc'],
  solidity: ['.sol'],
  swift: ['.swift'],
  typescript: ['.ts', '.cts', '.mts'],
  tsx: ['.tsx'],
  yaml: ['.yml', '.yaml'],
};

export const DEFAULT_TIMEOUT_MS = 300_000;
export const DEFAULT_MAX_OUTPUT_BYTES = 1 * 1024 * 1024;
export const DEFAULT_MAX_MATCHES = 500;

function isValidBinary(filePath: string): boolean {
  try {
    return statSync(filePath).size > 10000;
  } catch {
    return false;
  }
}

function getPlatformPackageName(): string | null {
  const platform = process.platform;
  const arch = process.arch;

  const platformMap: Record<string, string> = {
    'darwin-arm64': '@ast-grep/cli-darwin-arm64',
    'darwin-x64': '@ast-grep/cli-darwin-x64',
    'linux-arm64': '@ast-grep/cli-linux-arm64-gnu',
    'linux-x64': '@ast-grep/cli-linux-x64-gnu',
    'win32-x64': '@ast-grep/cli-win32-x64-msvc',
    'win32-arm64': '@ast-grep/cli-win32-arm64-msvc',
  };

  return platformMap[`${platform}-${arch}`] ?? null;
}

function getDataDir(): string {
  const homeDir = homedir();
  if (process.platform === 'win32') {
    const localAppData = process.env['LOCALAPPDATA'] || process.env['APPDATA'];
    return localAppData || join(homeDir, 'AppData', 'Local');
  }
  const xdgData = process.env['XDG_DATA_HOME'];
  return xdgData || join(homeDir, '.local', 'share');
}

let cachedCliPath: string | null = null;

export function findSgCliPath(): string | null {
  if (cachedCliPath && existsSync(cachedCliPath)) {
    return cachedCliPath;
  }

  const binaryName = process.platform === 'win32' ? 'sg.exe' : 'sg';

  // Check cached binary first (from downloader)
  const cachedPath = getCachedBinaryPath();
  if (cachedPath && isValidBinary(cachedPath)) {
    cachedCliPath = cachedPath;
    return cachedPath;
  }

  // Check agent data directory
  const agentBinPath = join(getDataDir(), 'agent', 'bin', binaryName);
  if (existsSync(agentBinPath) && isValidBinary(agentBinPath)) {
    cachedCliPath = agentBinPath;
    return agentBinPath;
  }

  // Check @ast-grep/cli npm package
  try {
    const require = createRequire(import.meta.url);
    const cliPkgPath = require.resolve('@ast-grep/cli/package.json');
    const cliDir = dirname(cliPkgPath);
    const sgPath = join(cliDir, binaryName);

    if (existsSync(sgPath) && isValidBinary(sgPath)) {
      cachedCliPath = sgPath;
      return sgPath;
    }
  } catch {
    // @ast-grep/cli not installed
  }

  // Check platform-specific npm package
  const platformPkg = getPlatformPackageName();
  if (platformPkg) {
    try {
      const require = createRequire(import.meta.url);
      const pkgPath = require.resolve(`${platformPkg}/package.json`);
      const pkgDir = dirname(pkgPath);
      const astGrepName = process.platform === 'win32' ? 'ast-grep.exe' : 'ast-grep';
      const binaryPath = join(pkgDir, astGrepName);

      if (existsSync(binaryPath) && isValidBinary(binaryPath)) {
        cachedCliPath = binaryPath;
        return binaryPath;
      }
    } catch {
      // Platform-specific package not installed
    }
  }

  // Check homebrew paths on macOS
  if (process.platform === 'darwin') {
    const homebrewPaths = ['/opt/homebrew/bin/sg', '/usr/local/bin/sg'];
    for (const path of homebrewPaths) {
      if (existsSync(path) && isValidBinary(path)) {
        cachedCliPath = path;
        return path;
      }
    }
  }

  // Check system PATH
  try {
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? 'where' : 'which';
    const result = spawnSync(cmd, ['sg'], { encoding: 'utf-8', timeout: 5000 });
    if (result.status === 0 && result.stdout.trim()) {
      const path = result.stdout.trim().split('\n')[0]!;
      if (existsSync(path)) {
        cachedCliPath = path;
        return path;
      }
    }
  } catch {
    // sg not in PATH
  }

  return null;
}

export function getSgCliPath(): string {
  const path = findSgCliPath();
  return path ?? 'sg';
}

export function setSgCliPath(path: string): void {
  cachedCliPath = path;
}

export function resetCliCache(): void {
  cachedCliPath = null;
}

// Alias for compatibility with oh-my-opencode naming
export const findSgCliPathSync = findSgCliPath;

export interface EnvironmentCheckResult {
  cli: {
    available: boolean;
    path: string;
    error?: string;
  };
  napi: {
    available: boolean;
    error?: string;
  };
}

export function checkEnvironment(): EnvironmentCheckResult {
  const cliPath = getSgCliPath();
  const result: EnvironmentCheckResult = {
    cli: {
      available: false,
      path: cliPath,
    },
    napi: {
      available: false,
    },
  };

  if (existsSync(cliPath)) {
    result.cli.available = true;
  } else if (cliPath === 'sg') {
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? 'where' : 'which';
    const whichResult = spawnSync(cmd, ['sg'], { encoding: 'utf-8', timeout: 5000 });
    result.cli.available = whichResult.status === 0 && !!whichResult.stdout?.trim();
    if (!result.cli.available) {
      result.cli.error = 'sg binary not found in PATH';
    }
  } else {
    result.cli.error = `Binary not found: ${cliPath}`;
  }

  // Check NAPI availability
  try {
    createRequire(import.meta.url)('@ast-grep/napi');
    result.napi.available = true;
  } catch (e) {
    result.napi.available = false;
    result.napi.error = `@ast-grep/napi not installed: ${e instanceof Error ? e.message : String(e)}`;
  }

  return result;
}

export function formatEnvironmentCheck(result: EnvironmentCheckResult): string {
  const lines: string[] = ['ast-grep Environment Status:', ''];

  if (result.cli.available) {
    lines.push(`✓ CLI: Available (${result.cli.path})`);
  } else {
    lines.push(`✗ CLI: Not available`);
    if (result.cli.error) {
      lines.push(`  Error: ${result.cli.error}`);
    }
    lines.push(`  Install: npm add -D @ast-grep/cli`);
  }

  if (result.napi.available) {
    lines.push(`✓ NAPI: Available`);
  } else {
    lines.push(`✗ NAPI: Not available`);
    if (result.napi.error) {
      lines.push(`  Error: ${result.napi.error}`);
    }
    lines.push(`  Install: npm add -D @ast-grep/napi`);
  }

  lines.push('');
  lines.push(`CLI supports ${CLI_LANGUAGES.length} languages`);
  lines.push(`NAPI supports ${NAPI_LANGUAGES.length} languages: ${NAPI_LANGUAGES.join(', ')}`);

  return lines.join('\n');
}
