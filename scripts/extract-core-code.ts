#!/usr/bin/env tsx

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const CORE_DIR = join(process.cwd(), 'packages/core/src');
const OUTPUT_FILE = join(process.cwd(), 'core-code-extract.txt');

const INCLUDE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json'];
const EXCLUDE_DIRS = ['node_modules', 'dist', '.git'];
const EXCLUDE_FILES = ['.db', '.db-shm', '.db-wal', 'tsconfig.tsbuildinfo'];

function shouldIncludeFile(filename: string): boolean {
  if (EXCLUDE_FILES.some(ext => filename.endsWith(ext))) {
    return false;
  }
  return INCLUDE_EXTENSIONS.some(ext => filename.endsWith(ext));
}

function shouldIncludeDir(dirname: string): boolean {
  return !EXCLUDE_DIRS.includes(dirname);
}

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  const files = readdirSync(dir);

  files.forEach(file => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      if (shouldIncludeDir(file)) {
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
  console.log(`Extracting code from: ${CORE_DIR}`);
  
  const files = getAllFiles(CORE_DIR);
  files.sort();

  console.log(`Found ${files.length} files to extract`);

  let output = '';
  output += '='.repeat(80) + '\n';
  output += 'CODE EXTRACTION FROM packages/core/\n';
  output += `Generated: ${new Date().toISOString()}\n`;
  output += `Total Files: ${files.length}\n`;
  output += '='.repeat(80) + '\n\n';

  files.forEach((filePath, index) => {
    const relativePath = relative(CORE_DIR, filePath);
    console.log(`[${index + 1}/${files.length}] ${relativePath}`);

    output += '\n' + '='.repeat(80) + '\n';
    output += `FILE: ${relativePath}\n`;
    output += '='.repeat(80) + '\n\n';

    try {
      const content = readFileSync(filePath, 'utf-8');
      output += content;
      output += '\n\n';
    } catch (error) {
      output += `ERROR: Could not read file - ${error}\n\n`;
    }
  });

  writeFileSync(OUTPUT_FILE, output, 'utf-8');
  console.log(`\nExtraction complete!`);
  console.log(`Output written to: ${OUTPUT_FILE}`);
  console.log(`Total size: ${(output.length / 1024).toFixed(2)} KB`);
}

extractCode();

