#!/usr/bin/env node
import 'dotenv/config';
import { startServer } from './server.js';

const port = Number(process.env.PORT) || 3000;
const workspaceRoot = process.env.WORKSPACE_ROOT;

startServer({ port, workspaceRoot });

