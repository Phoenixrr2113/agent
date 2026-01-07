import { existsSync, mkdirSync, chmodSync, unlinkSync, readdirSync, renameSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';

const RG_VERSION = '14.1.1';

const PLATFORM_CONFIG: Record<string, { platform: string; extension: 'tar.gz' | 'zip' } | undefined> = {
  'arm64-darwin': { platform: 'aarch64-apple-darwin', extension: 'tar.gz' },
  'arm64-linux': { platform: 'aarch64-unknown-linux-gnu', extension: 'tar.gz' },
  'x64-darwin': { platform: 'x86_64-apple-darwin', extension: 'tar.gz' },
  'x64-linux': { platform: 'x86_64-unknown-linux-musl', extension: 'tar.gz' },
  'x64-win32': { platform: 'x86_64-pc-windows-msvc', extension: 'zip' },
};

function getPlatformKey(): string {
  return `${process.arch}-${process.platform}`;
}

function getInstallDir(): string {
  const homeDir = homedir();
  return join(homeDir, '.cache', 'agent', 'bin');
}

function getRgPath(): string {
  const isWindows = process.platform === 'win32';
  return join(getInstallDir(), isWindows ? 'rg.exe' : 'rg');
}

function findFileRecursive(dir: string, filename: string): string | null {
  try {
    const entries = readdirSync(dir, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name === filename) {
        return join(entry.parentPath ?? dir, entry.name);
      }
    }
  } catch {
    return null;
  }
  return null;
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  await writeFile(destPath, Buffer.from(buffer));
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

async function extractTarGz(archivePath: string, destDir: string): Promise<void> {
  const platformKey = getPlatformKey();

  const args = ['tar', '-xzf', archivePath, '--strip-components=1'];

  if (platformKey.endsWith('-darwin')) {
    args.push('--include=*/rg');
  } else if (platformKey.endsWith('-linux')) {
    args.push('--wildcards', '*/rg');
  }

  const { exitCode, stderr } = await spawnAsync(args, destDir);
  if (exitCode !== 0) {
    throw new Error(`Failed to extract tar.gz: ${stderr}`);
  }
}

async function extractZipWindows(archivePath: string, destDir: string): Promise<void> {
  const { exitCode } = await spawnAsync([
    'powershell',
    '-Command',
    `Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force`,
  ]);

  if (exitCode !== 0) {
    throw new Error('Failed to extract zip with PowerShell');
  }

  const foundPath = findFileRecursive(destDir, 'rg.exe');
  if (foundPath) {
    const destPath = join(destDir, 'rg.exe');
    if (foundPath !== destPath) {
      renameSync(foundPath, destPath);
    }
  }
}

async function extractZipUnix(archivePath: string, destDir: string): Promise<void> {
  const { exitCode } = await spawnAsync(['unzip', '-o', archivePath, '-d', destDir]);
  if (exitCode !== 0) {
    throw new Error('Failed to extract zip');
  }

  const foundPath = findFileRecursive(destDir, 'rg');
  if (foundPath) {
    const destPath = join(destDir, 'rg');
    if (foundPath !== destPath) {
      renameSync(foundPath, destPath);
    }
  }
}

async function extractZip(archivePath: string, destDir: string): Promise<void> {
  if (process.platform === 'win32') {
    await extractZipWindows(archivePath, destDir);
  } else {
    await extractZipUnix(archivePath, destDir);
  }
}

export async function downloadAndInstallRipgrep(): Promise<string> {
  const platformKey = getPlatformKey();
  const config = PLATFORM_CONFIG[platformKey];

  if (!config) {
    throw new Error(`Unsupported platform: ${platformKey}`);
  }

  const installDir = getInstallDir();
  const rgPath = getRgPath();

  if (existsSync(rgPath)) {
    return rgPath;
  }

  mkdirSync(installDir, { recursive: true });

  const filename = `ripgrep-${RG_VERSION}-${config.platform}.${config.extension}`;
  const url = `https://github.com/BurntSushi/ripgrep/releases/download/${RG_VERSION}/${filename}`;
  const archivePath = join(installDir, filename);

  try {
    await downloadFile(url, archivePath);

    if (config.extension === 'tar.gz') {
      await extractTarGz(archivePath, installDir);
    } else {
      await extractZip(archivePath, installDir);
    }

    if (process.platform !== 'win32') {
      chmodSync(rgPath, 0o755);
    }

    if (!existsSync(rgPath)) {
      throw new Error('ripgrep binary not found after extraction');
    }

    return rgPath;
  } finally {
    if (existsSync(archivePath)) {
      try {
        unlinkSync(archivePath);
      } catch {
        // Cleanup failures are non-critical
      }
    }
  }
}

export function getInstalledRipgrepPath(): string | null {
  const rgPath = getRgPath();
  return existsSync(rgPath) ? rgPath : null;
}
