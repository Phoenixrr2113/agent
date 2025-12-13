#!/usr/bin/env node
import 'dotenv/config';
import { startServer } from '@agent/server';

const port = Number(process.env['PORT']) ?? 3000;
const workspaceRoot = process.env['WORKSPACE_ROOT'] ?? process.cwd();

startServer({ port, workspaceRoot }).catch((error: any) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

