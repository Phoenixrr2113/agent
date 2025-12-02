#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { logger } from '@agent/shared';

logger.reconfigure();
import { run as halRun, shutdown as halShutdown, resetSession } from './adapters/hal.js';
import { runTauBenchTask, shutdown as tauShutdown } from './adapters/tau-bench.js';
import {
  runGAIATask,
  shutdown as gaiaShutdown,
  resetSession as gaiaResetSession,
  scoreGAIAResults,
  type GAIATask,
} from './adapters/gaia.js';
import {
  runSWEBenchTask,
  shutdown as sweBenchShutdown,
  resetSession as sweBenchResetSession,
  scoreSWEBenchResults,
  type SWEBenchTask,
} from './adapters/swe-bench.js';
import type { BenchmarkResult, BenchmarkTask } from './types.js';
import * as fs from 'node:fs';

const program = new Command();

program
  .name('agent-benchmark')
  .description('Run benchmarks against the agent')
  .version('0.1.0');

program
  .command('hal')
  .description('Run a task using the HAL adapter')
  .requiredOption('--task-file <path>', 'Path to JSON file containing task definition')
  .option('--workspace <path>', 'Workspace root for the agent')
  .option('--output <path>', 'Output file for results')
  .action(async (options) => {
    try {
      const taskContent = fs.readFileSync(options.taskFile, 'utf-8');
      const tasks: BenchmarkTask[] = JSON.parse(taskContent);

      const results: Record<string, unknown> = {};

      for (const task of tasks) {
        await resetSession();
        const result = await halRun(task.id, task, {
          workspace: options.workspace,
        });
        Object.assign(results, result);
      }

      if (options.output) {
        fs.writeFileSync(options.output, JSON.stringify(results, null, 2));
        logger.info('Results written to', { path: options.output });
      } else {
        console.log(JSON.stringify(results, null, 2));
      }

      await halShutdown();
    } catch (error) {
      logger.error('HAL benchmark failed', { error: String(error) });
      process.exit(1);
    }
  });

program
  .command('tau-bench')
  .description('Run tau-bench style evaluation')
  .requiredOption('--domain <domain>', 'Domain: retail or airline')
  .requiredOption('--task-file <path>', 'Path to JSON file containing task definition')
  .option('--output <path>', 'Output file for results')
  .action(async (options) => {
    try {
      const taskContent = fs.readFileSync(options.taskFile, 'utf-8');
      const tasks = JSON.parse(taskContent);

      const results: BenchmarkResult[] = [];

      for (const task of tasks) {
        const result = await runTauBenchTask(
          { domain: options.domain },
          task
        );
        results.push(result);
      }

      if (options.output) {
        fs.writeFileSync(options.output, JSON.stringify(results, null, 2));
        logger.info('Results written to', { path: options.output });
      } else {
        console.log(JSON.stringify(results, null, 2));
      }

      await tauShutdown();
    } catch (error) {
      logger.error('Tau-bench failed', { error: String(error) });
      process.exit(1);
    }
  });

program
  .command('gaia')
  .description('Run GAIA benchmark tasks')
  .requiredOption('--task-file <path>', 'Path to JSON file containing GAIA tasks')
  .option('--level <level>', 'Filter by level (1, 2, 3, or all)', 'all')
  .option('--workspace <path>', 'Workspace root for the agent')
  .option('--data-dir <path>', 'Directory containing associated files')
  .option('--output <path>', 'Output file for results')
  .action(async (options) => {
    try {
      const taskContent = fs.readFileSync(options.taskFile, 'utf-8');
      let tasks: GAIATask[] = JSON.parse(taskContent);

      if (options.level !== 'all') {
        const level = parseInt(options.level, 10);
        tasks = tasks.filter((t) => t.Level === level);
      }

      const results = [];

      for (const task of tasks) {
        await gaiaResetSession();
        const result = await runGAIATask(
          {
            workspace: options.workspace,
            dataDir: options.dataDir,
            level: options.level === 'all' ? 'all' : (parseInt(options.level, 10) as 1 | 2 | 3),
          },
          task
        );
        results.push(result);
      }

      const scores = scoreGAIAResults(results);
      console.log('\nGAIA Results:');
      console.log(`Overall: ${(scores.overall * 100).toFixed(1)}%`);
      console.log(`Level 1: ${(scores.byLevel[1] * 100).toFixed(1)}%`);
      console.log(`Level 2: ${(scores.byLevel[2] * 100).toFixed(1)}%`);
      console.log(`Level 3: ${(scores.byLevel[3] * 100).toFixed(1)}%`);

      if (options.output) {
        fs.writeFileSync(options.output, JSON.stringify({ results, scores }, null, 2));
        logger.info('Results written to', { path: options.output });
      }

      await gaiaShutdown();
    } catch (error) {
      logger.error('GAIA benchmark failed', { error: String(error) });
      process.exit(1);
    }
  });

program
  .command('swe-bench')
  .description('Run SWE-bench tasks')
  .requiredOption('--task-file <path>', 'Path to JSON file containing SWE-bench tasks')
  .option('--workspace <path>', 'Workspace root for the agent')
  .option('--include-hints', 'Include hints from issue comments')
  .option('--output <path>', 'Output file for results')
  .action(async (options) => {
    try {
      const taskContent = fs.readFileSync(options.taskFile, 'utf-8');
      const tasks: SWEBenchTask[] = JSON.parse(taskContent);

      const results = [];

      for (const task of tasks) {
        await sweBenchResetSession();
        const result = await runSWEBenchTask(
          {
            workspace: options.workspace,
            includeHints: options.includeHints,
          },
          task
        );
        results.push(result);
      }

      const scores = scoreSWEBenchResults(results);
      console.log('\nSWE-bench Results:');
      console.log(`Resolved: ${scores.resolved}/${scores.total}`);
      console.log(`Resolve Rate: ${(scores.resolveRate * 100).toFixed(1)}%`);

      if (options.output) {
        fs.writeFileSync(options.output, JSON.stringify({ results, scores }, null, 2));
        logger.info('Results written to', { path: options.output });
      }

      await sweBenchShutdown();
    } catch (error) {
      logger.error('SWE-bench failed', { error: String(error) });
      process.exit(1);
    }
  });

program
  .command('info')
  .description('Show information about available benchmarks')
  .action(() => {
    console.log(`
Available Benchmarks:
=====================

1. HAL (Holistic Agent Leaderboard)
   - Standardized evaluation across multiple benchmarks
   - Usage: agent-benchmark hal --task-file tasks.json

2. τ-bench (Tau-bench)
   - Customer service agent evaluation
   - Domains: retail, airline
   - Usage: agent-benchmark tau-bench --domain retail --task-file tasks.json

3. GAIA (General AI Assistants)
   - 450 questions at 3 difficulty levels
   - Tests reasoning, tool use, and web search
   - Usage: agent-benchmark gaia --task-file tasks.json [--level 1|2|3|all]

4. SWE-bench
   - Real-world GitHub issue resolution
   - Tests code generation and debugging
   - Usage: agent-benchmark swe-bench --task-file tasks.json [--include-hints]

Task File Formats:
------------------
See examples/ directory for sample task files.
`);
  });

program.parse();

