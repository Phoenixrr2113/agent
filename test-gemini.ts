import 'dotenv/config';
import { embedMany } from 'ai';
import { google } from '@ai-sdk/google';

async function testGeminiEmbedding() {
  console.log('Testing Google Gemini embedding API...\n');

  try {
    const result = await embedMany({
      model: google.textEmbedding('text-embedding-004'),
      values: ['Hello, world!', 'This is a test embedding'],
    });

    console.log('✅ Success! Gemini embeddings are working.');
    console.log(`Generated ${result.embeddings.length} embeddings`);
    console.log(`Embedding dimension: ${result.embeddings[0].length}`);
    console.log(`\nFirst embedding (first 10 values): ${result.embeddings[0].slice(0, 10).join(', ')}...`);

    if (result.usage) {
      console.log(`\nToken usage: ${JSON.stringify(result.usage)}`);
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);

    if (error.message.includes('API key')) {
      console.error('\nMake sure your GOOGLE_GENERATIVE_AI_API_KEY is set correctly in .env');
    }
  }
}

testGeminiEmbedding();
