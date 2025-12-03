#!/usr/bin/env node
import 'dotenv/config';
import { createAgentRuntime, type AgentSession } from '@agent/core';
import { logger } from '@agent/shared';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

logger.reconfigure();

// Benchmark categories
const BENCHMARK_CATEGORIES = [
  'reasoning',
  'coding',
  'tool-use',
  'codebase-comprehension',
  'bug-fixing',
  'multi-step-planning',
] as const;

type BenchmarkCategory = (typeof BENCHMARK_CATEGORIES)[number];

interface BenchmarkTask {
  id: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  prompt: string;
  expected_answer?: string;
  expected_pattern?: string;
  expected_concepts?: string[];
  grading: {
    type: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface BenchmarkResult {
  taskId: string;
  category: string;
  difficulty: string;
  success: boolean;
  response: string;
  durationMs: number;
  toolsUsed: string[];
  score?: number;
  feedback?: string;
  error?: string;
}

interface BenchmarkSummary {
  totalTasks: number;
  successCount: number;
  failureCount: number;
  averageDuration: number;
  byCategory: Record<string, { total: number; success: number; avgDuration: number }>;
  byDifficulty: Record<string, { total: number; success: number; avgScore: number }>;
  results: BenchmarkResult[];
}

let runtime: Awaited<ReturnType<typeof createAgentRuntime>> | null = null;
let session: AgentSession | null = null;

async function getOrCreateSession(workspace?: string): Promise<AgentSession> {
  if (!runtime) {
    runtime = await createAgentRuntime({
      workspaceRoot: workspace || process.cwd(),
    });
  }
  if (!session) {
    session = runtime.createSession();
  }
  return session;
}

async function resetSession(): Promise<void> {
  if (session) {
    session.clearHistory();
  }
  session = null;
}

async function shutdown(): Promise<void> {
  if (runtime) {
    await runtime.shutdown();
    runtime = null;
    session = null;
  }
}

async function loadBenchmark(category: BenchmarkCategory): Promise<BenchmarkTask[]> {
  const filePath = path.join(__dirname, '../custom', `${category}.json`);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    logger.warn(`Failed to load benchmark: ${category}`, { error: String(error) });
    return [];
  }
}

async function runTask(task: BenchmarkTask, workspace?: string): Promise<BenchmarkResult> {
  const startTime = Date.now();

  try {
    logger.info('Running task', {
      taskId: task.id,
      category: task.category,
      difficulty: task.difficulty,
    });

    const agentSession = await getOrCreateSession(workspace);
    const result = await agentSession.send(task.prompt);

    const durationMs = Date.now() - startTime;

    // Basic scoring
    let score = 0;
    let feedback = '';

    if (task.expected_answer) {
      const responseLower = result.text.toLowerCase();
      const expectedLower = task.expected_answer.toLowerCase();
      if (responseLower.includes(expectedLower) || expectedLower.includes(responseLower)) {
        score = 1.0;
        feedback = 'Answer matches expected result';
      } else {
        score = 0.0;
        feedback = 'Answer does not match expected result';
      }
    }

    if (task.expected_concepts && task.expected_concepts.length > 0) {
      const responseLower = result.text.toLowerCase();
      const matchedConcepts = task.expected_concepts.filter(concept =>
        responseLower.includes(concept.toLowerCase())
      );
      score = matchedConcepts.length / task.expected_concepts.length;
      feedback = `Matched ${matchedConcepts.length}/${task.expected_concepts.length} concepts`;
    }

    logger.info('Task completed', {
      taskId: task.id,
      success: result.completed,
      durationMs,
      score,
    });

    return {
      taskId: task.id,
      category: task.category,
      difficulty: task.difficulty,
      success: result.completed,
      response: result.text,
      durationMs,
      toolsUsed: result.toolsUsed || [],
      score,
      feedback,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Task failed', {
      taskId: task.id,
      error: errorMessage,
    });

    return {
      taskId: task.id,
      category: task.category,
      difficulty: task.difficulty,
      success: false,
      response: '',
      durationMs: Date.now() - startTime,
      toolsUsed: [],
      score: 0,
      error: errorMessage,
    };
  }
}

async function runBenchmarkCategory(
  category: BenchmarkCategory,
  options: { difficulty?: string; limit?: number; workspace?: string } = {}
): Promise<BenchmarkResult[]> {
  const tasks = await loadBenchmark(category);

  let filteredTasks = tasks;
  if (options.difficulty) {
    filteredTasks = tasks.filter(t => t.difficulty === options.difficulty);
  }
  if (options.limit) {
    filteredTasks = filteredTasks.slice(0, options.limit);
  }

  logger.info(`Running ${filteredTasks.length} tasks from ${category}`, {
    total: tasks.length,
    filtered: filteredTasks.length,
  });

  const results: BenchmarkResult[] = [];

  for (const task of filteredTasks) {
    await resetSession();
    const result = await runTask(task, options.workspace);
    results.push(result);
  }

  return results;
}

async function runAllBenchmarks(options: {
  categories?: BenchmarkCategory[];
  difficulty?: string;
  limit?: number;
  workspace?: string;
  outputFile?: string;
}): Promise<BenchmarkSummary> {
  const categories = options.categories || BENCHMARK_CATEGORIES;
  const allResults: BenchmarkResult[] = [];

  for (const category of categories) {
    logger.info(`\n${'='.repeat(60)}`);
    logger.info(`Starting category: ${category}`);
    logger.info('='.repeat(60));

    const categoryResults = await runBenchmarkCategory(category, {
      difficulty: options.difficulty,
      limit: options.limit,
      workspace: options.workspace,
    });

    allResults.push(...categoryResults);
  }

  // Calculate summary statistics
  const summary = calculateSummary(allResults);

  // Save results if output file specified
  if (options.outputFile) {
    await fs.writeFile(
      options.outputFile,
      JSON.stringify({ summary, results: allResults }, null, 2)
    );
    logger.info('Results saved', { path: options.outputFile });
  }

  // Print summary
  printSummary(summary);

  await shutdown();

  return summary;
}

function calculateSummary(results: BenchmarkResult[]): BenchmarkSummary {
  const byCategory: Record<string, { total: number; success: number; avgDuration: number }> = {};
  const byDifficulty: Record<string, { total: number; success: number; avgScore: number }> = {};

  for (const result of results) {
    // By category
    if (!byCategory[result.category]) {
      byCategory[result.category] = { total: 0, success: 0, avgDuration: 0 };
    }
    byCategory[result.category].total++;
    if (result.success) byCategory[result.category].success++;
    byCategory[result.category].avgDuration += result.durationMs;

    // By difficulty
    if (!byDifficulty[result.difficulty]) {
      byDifficulty[result.difficulty] = { total: 0, success: 0, avgScore: 0 };
    }
    byDifficulty[result.difficulty].total++;
    if (result.success) byDifficulty[result.difficulty].success++;
    byDifficulty[result.difficulty].avgScore += result.score || 0;
  }

  // Calculate averages
  for (const cat in byCategory) {
    byCategory[cat].avgDuration /= byCategory[cat].total;
  }
  for (const diff in byDifficulty) {
    byDifficulty[diff].avgScore /= byDifficulty[diff].total;
  }

  const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);

  return {
    totalTasks: results.length,
    successCount: results.filter(r => r.success).length,
    failureCount: results.filter(r => !r.success).length,
    averageDuration: totalDuration / results.length,
    byCategory,
    byDifficulty,
    results,
  };
}

function printSummary(summary: BenchmarkSummary): void {
  console.log('\n' + '='.repeat(80));
  console.log('BENCHMARK SUMMARY');
  console.log('='.repeat(80));

  console.log(`\nOverall Results:`);
  console.log(`  Total Tasks: ${summary.totalTasks}`);
  console.log(`  Success: ${summary.successCount} (${((summary.successCount / summary.totalTasks) * 100).toFixed(1)}%)`);
  console.log(`  Failure: ${summary.failureCount} (${((summary.failureCount / summary.totalTasks) * 100).toFixed(1)}%)`);
  console.log(`  Avg Duration: ${summary.averageDuration.toFixed(2)}ms`);

  console.log(`\nBy Category:`);
  for (const [category, stats] of Object.entries(summary.byCategory)) {
    const successRate = ((stats.success / stats.total) * 100).toFixed(1);
    console.log(`  ${category}:`);
    console.log(`    Success: ${stats.success}/${stats.total} (${successRate}%)`);
    console.log(`    Avg Duration: ${stats.avgDuration.toFixed(2)}ms`);
  }

  console.log(`\nBy Difficulty:`);
  for (const [difficulty, stats] of Object.entries(summary.byDifficulty)) {
    const successRate = ((stats.success / stats.total) * 100).toFixed(1);
    console.log(`  ${difficulty}:`);
    console.log(`    Success: ${stats.success}/${stats.total} (${successRate}%)`);
    console.log(`    Avg Score: ${stats.avgScore.toFixed(2)}`);
  }

  console.log('\n' + '='.repeat(80));
}

// CLI interface - ES module entry point detection
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const args = process.argv.slice(2);
  const category = args[0] as BenchmarkCategory | 'all' | undefined;
  const difficulty = args.find(a => a.startsWith('--difficulty='))?.split('=')[1];
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || undefined;
  const workspace = args.find(a => a.startsWith('--workspace='))?.split('=')[1];
  const outputFile = args.find(a => a.startsWith('--output='))?.split('=')[1];

  if (!category || category === 'all') {
    runAllBenchmarks({ difficulty, limit, workspace, outputFile }).catch(error => {
      logger.error('Benchmark failed', { error: String(error) });
      process.exit(1);
    });
  } else if (BENCHMARK_CATEGORIES.includes(category)) {
    runBenchmarkCategory(category, { difficulty, limit, workspace })
      .then(results => {
        const summary = calculateSummary(results);
        printSummary(summary);
        if (outputFile) {
          fs.writeFile(outputFile, JSON.stringify({ summary, results }, null, 2));
        }
        return shutdown();
      })
      .catch(error => {
        logger.error('Benchmark failed', { error: String(error) });
        process.exit(1);
      });
  } else {
    console.error(`Unknown category: ${category}`);
    console.log(`Available categories: ${BENCHMARK_CATEGORIES.join(', ')}, all`);
    process.exit(1);
  }
}

export {
  runBenchmarkCategory,
  runAllBenchmarks,
  runTask,
  loadBenchmark,
  calculateSummary,
  printSummary,
  type BenchmarkTask,
  type BenchmarkResult,
  type BenchmarkSummary,
};
