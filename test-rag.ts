import 'dotenv/config';
import { createCodebaseRAG } from './src/rag.js';
import fs from 'fs/promises';
import path from 'path';

async function testRAG() {
  console.log('Testing RAG with Gemini embeddings...\n');

  const testWorkspace = path.join(process.cwd(), 'test-workspace');

  try {
    await fs.mkdir(testWorkspace, { recursive: true });

    await fs.writeFile(
      path.join(testWorkspace, 'example.ts'),
      `function calculateSum(a: number, b: number): number {
  return a + b;
}

function calculateProduct(a: number, b: number): number {
  return a * b;
}

class MathOperations {
  add(x: number, y: number) {
    return x + y;
  }

  multiply(x: number, y: number) {
    return x * y;
  }
}`
    );

    console.log('✅ Created test workspace');

    const rag = createCodebaseRAG(testWorkspace);

    console.log('📊 Indexing codebase...');
    await rag.indexCodebase();

    const stats = rag.getStats();
    console.log(`✅ Indexed ${stats.totalChunks} chunks from ${stats.files} files\n`);

    console.log('🔍 Searching for "calculate sum"...');
    const results = await rag.searchCodebase('calculate sum', 3);

    console.log(`Found ${results.length} results:\n`);
    results.forEach((result, i) => {
      console.log(`${i + 1}. ${result.filePath}:${result.startLine}-${result.endLine}`);
      console.log(`   ${result.content.substring(0, 100)}...\n`);
    });

    await fs.rm(testWorkspace, { recursive: true, force: true });
    console.log('✅ Test completed successfully!');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await fs.rm(testWorkspace, { recursive: true, force: true });
  }
}

testRAG();
