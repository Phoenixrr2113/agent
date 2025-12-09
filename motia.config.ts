import { defineConfig } from 'motia';

export default defineConfig({
  state: {
    adapter: 'memory',
  },
  streams: {
    adapter: 'memory',
  },
});
