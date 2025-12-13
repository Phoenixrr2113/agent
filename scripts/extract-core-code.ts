#!/usr/bin/env tsx

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const CORE_DIR = join(process.cwd(), 'packages/core/src');
const OUTPUT_FILE = join(process.cwd(), 'core-code-extract.txt');

const INCLUDE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json'];
const EXCLUDE_DIRS = ['node_modules', 'dist', '.git'];
const EXCLUDE_FILES = ['.db', '.db-shm', '.db-wal', 'tsconfig.tsbuildinfo'];

function shouldIncludeFile(filename: string): boolean {
  if (EXCLUDE_FILES.some(extension => filename.endsWith(extension))) {
    return false;
  }
  return INCLUDE_EXTENSIONS.some(extension => filename.endsWith(extension));
}

function shouldIncludeDirectory(dirname: string): boolean {
  return !EXCLUDE_DIRS.includes(dirname);
}

function getAllFiles(directory: string, fileList: string[] = []): string[] {
  const files = readdirSync(directory);

  files.forEach(file => {
    const filePath = join(directory, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      if (shouldIncludeDirectory(file)) {
        getAllFiles(filePath, fileList);
      }
    } else {
      if (shouldIncludeFile(file)) {
        fileList.push(filePath);
      }
    }
  });

  return fileList;
}

function extractCode(): void {
  console.warn(`Extracting code from: ${CORE_DIR}`);
  
  const files = getAllFiles(CORE_DIR);
  files.sort();

  console.warn(`Found ${String(files.length)} files to extract`);

  let output = '';
  output += '='.repeat(80) + '\n';
  output += 'CODE EXTRACTION FROM packages/core/\n';
  output += `Generated: ${new Date().toISOString()}\n`;
  output += `Total Files: ${String(files.length)}\n`;
  output += '='.repeat(80) + '\n\n';

  files.forEach((filePath, index) => {
    const relativePath = relative(CORE_DIR, filePath);
    console.warn(`[${String(index + 1)}/${String(files.length)}] ${relativePath}`);

    output += '\n' + '='.repeat(80) + '\n';
    output += `FILE: ${relativePath}\n`;
    output += '='.repeat(80) + '\n\n';

    try {
      const content = readFileSync(filePath, 'utf-8');
      output += content;
      output += '\n\n';
    } catch (error) {
      output += `ERROR: Could not read file - ${String(error)}\n\n`;
    }
  });

  writeFileSync(OUTPUT_FILE, output, 'utf-8');
  console.warn(`\nExtraction complete!`);
  console.warn(`Output written to: ${OUTPUT_FILE}`);
  console.warn(`Total size: ${(output.length / 1024).toFixed(2)} KB`);
}

extractCode();

