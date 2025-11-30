import { logger } from '@agent/shared';
export function instrumentTool(toolName, execute) {
    return async (args) => {
        const startTime = performance.now();
        logger.info(`⏱️  [${toolName}] Starting`, { args });
        try {
            const result = await execute(args);
            const endTime = performance.now();
            const durationMs = endTime - startTime;
            logger.info(`⏱️  [${toolName}] Completed`, {
                durationMs: durationMs.toFixed(2),
                durationSec: (durationMs / 1000).toFixed(3),
            });
            if (typeof result === 'string') {
                try {
                    const parsed = JSON.parse(result);
                    parsed._timing = { durationMs: durationMs.toFixed(2) };
                    return JSON.stringify(parsed);
                }
                catch {
                    return result;
                }
            }
            return result;
        }
        catch (error) {
            const endTime = performance.now();
            const durationMs = endTime - startTime;
            logger.error(`⏱️  [${toolName}] Failed`, {
                durationMs: durationMs.toFixed(2),
                error: String(error),
            });
            throw error;
        }
    };
}
export function instrumentTools(tools) {
    const instrumented = {};
    for (const [name, tool] of Object.entries(tools)) {
        if (tool && typeof tool === 'object' && 'execute' in tool) {
            instrumented[name] = {
                ...tool,
                execute: instrumentTool(name, tool.execute),
            };
        }
        else {
            instrumented[name] = tool;
        }
    }
    return instrumented;
}
