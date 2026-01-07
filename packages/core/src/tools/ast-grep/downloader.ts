import { existsSync, mkdirSync, chmodSync, unlinkSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';

const REPO = 'ast-grep/ast-grep';

// IMPORTANT: Update this when bumping @ast-grep/cli in package.json
// This is only used as fallback when @ast-grep/cli package.json cannot be read
const DEFAULT_VERSION = '0.40.0';

function getAstGrepVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require('@ast-grep/cli/package.json') as { version: string };
    return pkg.version;
  } catch {
    return DEFAULT_VERSION;
  }
}

interface PlatformInfo {
  arch: string;
  os: string;
}

const PLATFORM_MAP: Record<string, PlatformInfo> = {
  'darwin-arm64': { arch: 'aarch64', os: 'apple-darwin' },
  'darwin-x64': { arch: 'x86_64', os: 'apple-darwin' },
  'linux-arm64': { arch: 'aarch64', os: 'unknown-linux-gnu' },
  'linux-x64': { arch: 'x86_64', os: 'unknown-linux-gnu' },
  'win32-x64': { arch: 'x86_64', os: 'pc-windows-msvc' },
  'win32-arm64': { arch: 'aarch64', os: 'pc-windows-msvc' },
  'win32-ia32': { arch: 'i686', os: 'pc-windows-msvc' },
};

export function getCacheDir(): string {
  if (process.platform === 'win32') {
    const localAppData = process.env['LOCALAPPDATA'] || process.env['APPDATA'];
    const base = localAppData || join(homedir(), 'AppData', 'Local');
    return join(base, 'agent', 'bin');
  }

  const xdgCache = process.env['XDG_CACHE_HOME'];
  const base = xdgCache || join(homedir(), '.cache');
  return join(base, 'agent', 'bin');
}

export function getBinaryName(): string {
  return process.platform === 'win32' ? 'sg.exe' : 'sg';
}

export function getCachedBinaryPath(): string | null {
  const binaryPath = join(getCacheDir(), getBinaryName());
  return existsSync(binaryPath) ? binaryPath : null;
}

async function spawnAsync(command: string[], cwd?: string): Promise<{ exitCode: number; stderr: string }> {
  return new Promise((resolve) => {
    const [cmd, ...args] = command;
    const proc = spawn(cmd!, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ exitCode: code ?? 1, stderr });
    });

    proc.on('error', (err) => {
      resolve({ exitCode: 1, stderr: err.message });
    });
  });
}

async function extractZip(archivePath: string, destDir: string): Promise<void> {
  let result: { exitCode: number; stderr: string };

  if (process.platform === 'win32') {
    result = await spawnAsync([
      'powershell',
      '-command',
      `Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force`,
    ]);
  } else {
    result = await spawnAsync(['unzip', '-o', archivePath, '-d', destDir]);
  }

  if (result.exitCode !== 0) {
    const toolHint =
      process.platform === 'win32'
        ? 'Ensure PowerShell is available on your system.'
        : "Please install 'unzip' (e.g., apt install unzip, brew install unzip).";
    throw new Error(`zip extraction failed (exit ${result.exitCode}): ${result.stderr}\n\n${toolHint}`);
  }
}

export async function downloadAstGrep(version: string = DEFAULT_VERSION): Promise<string | null> {
  const platformKey = `${process.platform}-${process.arch}`;
  const platformInfo = PLATFORM_MAP[platformKey];

  if (!platformInfo) {
    console.error(`[agent] Unsupported platform for ast-grep: ${platformKey}`);
    return null;
  }

  const cacheDir = getCacheDir();
  const binaryName = getBinaryName();
  const binaryPath = join(cacheDir, binaryName);

  if (existsSync(binaryPath)) {
    return binaryPath;
  }

  const { arch, os } = platformInfo;
  const assetName = `app-${arch}-${os}.zip`;
  const downloadUrl = `https://github.com/${REPO}/releases/download/${version}/${assetName}`;

  console.log(`[agent] Downloading ast-grep binary...`);

  try {
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }

    const response = await fetch(downloadUrl, { redirect: 'follow' });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const archivePath = join(cacheDir, assetName);
    const arrayBuffer = await response.arrayBuffer();
    await writeFile(archivePath, Buffer.from(arrayBuffer));

    await extractZip(archivePath, cacheDir);

    if (existsSync(archivePath)) {
      unlinkSync(archivePath);
    }

    if (process.platform !== 'win32' && existsSync(binaryPath)) {
      chmodSync(binaryPath, 0o755);
    }

    console.log(`[agent] ast-grep binary ready.`);

    return binaryPath;
  } catch (err) {
    console.error(`[agent] Failed to download ast-grep: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

export async function ensureAstGrepBinary(): Promise<string | null> {
  const cachedPath = getCachedBinaryPath();
  if (cachedPath) {
    return cachedPath;
  }

  const version = getAstGrepVersion();
  return downloadAstGrep(version);
}
