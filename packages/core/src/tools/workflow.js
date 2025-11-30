import { tool } from 'ai';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
let currentPlan = null;
export const planTool = tool({
    description: 'Manage implementation plan. Create plan at task start, update as you progress through steps.',
    inputSchema: z.object({
        action: z.enum(['create', 'update_status', 'add_note', 'add_step', 'view']).describe('Action to perform'),
        title: z.string().optional().describe('Plan title (for create action)'),
        steps: z.array(z.string()).optional().describe('Step names (for create action)'),
        stepName: z.string().optional().describe('Step to update'),
        status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).optional().describe('New status'),
        note: z.string().optional().describe('Note to add to step'),
    }),
    // eslint-disable-next-line @typescript-eslint/require-await
    execute: async ({ action, title, steps, stepName, status, note }) => {
        switch (action) {
            case 'create':
                if (!title || !steps) {
                    return JSON.stringify({ error: 'Title and steps required for create action' });
                }
                currentPlan = {
                    title,
                    steps: steps.map(name => ({ name, status: 'pending' })),
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                };
                return JSON.stringify({
                    message: `Plan created: "${title}" with ${steps.length} steps`,
                    plan: currentPlan,
                });
            case 'view':
                if (!currentPlan) {
                    return JSON.stringify({ message: 'No active plan' });
                }
                const completed = currentPlan.steps.filter(s => s.status === 'completed').length;
                const total = currentPlan.steps.length;
                return JSON.stringify({
                    plan: currentPlan,
                    progress: `${completed}/${total} steps completed (${Math.round((completed / total) * 100)}%)`,
                });
            case 'update_status':
                if (!currentPlan || !stepName || !status) {
                    return JSON.stringify({ error: 'Active plan, stepName, and status required' });
                }
                const step = currentPlan.steps.find(s => s.name === stepName);
                if (!step) {
                    return JSON.stringify({ error: `Step not found: ${stepName}` });
                }
                step.status = status;
                currentPlan.updatedAt = Date.now();
                const completedCount = currentPlan.steps.filter(s => s.status === 'completed').length;
                return JSON.stringify({
                    message: `Updated "${stepName}" to ${status}`,
                    progress: `${completedCount}/${currentPlan.steps.length} completed`,
                });
            case 'add_note':
                if (!currentPlan || !stepName || !note) {
                    return JSON.stringify({ error: 'Active plan, stepName, and note required' });
                }
                const noteStep = currentPlan.steps.find(s => s.name === stepName);
                if (!noteStep) {
                    return JSON.stringify({ error: `Step not found: ${stepName}` });
                }
                noteStep.notes = note;
                currentPlan.updatedAt = Date.now();
                return JSON.stringify({ message: `Note added to "${stepName}"` });
            case 'add_step':
                if (!currentPlan || !stepName) {
                    return JSON.stringify({ error: 'Active plan and stepName required' });
                }
                currentPlan.steps.push({ name: stepName, status: 'pending' });
                currentPlan.updatedAt = Date.now();
                return JSON.stringify({
                    message: `Added step: "${stepName}"`,
                    totalSteps: currentPlan.steps.length,
                });
            default:
                return JSON.stringify({ error: 'Invalid action' });
        }
    },
});
export const validationTool = tool({
    description: 'Validate code after making changes. Checks TypeScript types, runs tests, and verifies quality.',
    inputSchema: z.object({
        checkTypes: z.boolean().optional().describe('Run TypeScript type checking (default: true)'),
        runTests: z.boolean().optional().describe('Run test suite (default: false)'),
        filesChanged: z.array(z.string()).optional().describe('Files that were modified'),
    }),
    execute: async ({ checkTypes = true, runTests = false, filesChanged = [] }) => {
        const results = [];
        let allPassed = true;
        if (checkTypes) {
            try {
                const { stdout, stderr } = await execAsync('pnpm exec tsc --noEmit', {
                    timeout: 30000,
                    maxBuffer: 10 * 1024 * 1024,
                });
                const output = stdout || stderr || '';
                results.push({
                    check: 'TypeScript type check',
                    passed: true,
                    details: output ? output.substring(0, 500) : 'No type errors found'
                });
            }
            catch (error) {
                allPassed = false;
                const errorOutput = error.stderr || error.stdout || error.message;
                results.push({
                    check: 'TypeScript type check',
                    passed: false,
                    details: errorOutput.substring(0, 1000),
                });
            }
        }
        if (runTests) {
            try {
                const { stdout } = await execAsync('pnpm test', {
                    timeout: 60000,
                    maxBuffer: 10 * 1024 * 1024,
                });
                const testSummary = stdout.split('\n').slice(-10).join('\n');
                results.push({
                    check: 'Test suite',
                    passed: true,
                    details: testSummary || 'All tests passed'
                });
            }
            catch (error) {
                allPassed = false;
                const errorOutput = error.stderr || error.stdout || error.message;
                results.push({
                    check: 'Test suite',
                    passed: false,
                    details: errorOutput.substring(0, 1000),
                });
            }
        }
        return JSON.stringify({
            allPassed,
            results,
            filesChanged,
            recommendation: allPassed
                ? 'All checks passed. Safe to proceed.'
                : 'Some checks failed. Fix errors before continuing.',
        });
    },
});
export const toolGroups = {
    planning: {
        plan_tool: planTool,
    },
    implementation: {
        plan_tool: planTool,
        validation_tool: validationTool,
    },
    evaluation: {
        validation_tool: validationTool,
    },
    all: {
        plan_tool: planTool,
        validation_tool: validationTool,
    },
};
