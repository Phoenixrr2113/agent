import { createDeviceTools } from './src/tools.js';

async function test() {
  console.log('Creating device tools...');
  const tools = await createDeviceTools({
    displayWidth: 1920,
    displayHeight: 1080,
  });
  console.log('Tools created:', Object.keys(tools));
  
  if (tools.computer && tools.bash && tools.text_editor) {
    console.log('All tools present');
  } else {
    console.error('Missing tools');
    process.exit(1);
  }
}

test().catch(console.error);
