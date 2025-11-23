# E2E Test Suite

Comprehensive end-to-end tests validating the full Generic Agent Template system.

## Overview

**Total E2E Tests:** 41 tests across 6 test suites
**Test Coverage:** ~1,340 lines of test code

## Test Suites

### 1. Interactive Mode (`interactive-mode.e2e.test.ts`) - 4 tests
Tests the human-in-the-loop CLI interface:
- ✅ `ask_user` tool for clarification
- ✅ `task_complete` tool signaling completion
- ✅ Dynamic stop conditions based on task completion
- ✅ Conversation history maintenance across turns

**Purpose:** Validates the primary user interface mode where the agent interacts with users.

### 2. Multi-Step Workflows (`multi-step-workflow.e2e.test.ts`) - 5 tests
Tests complex agent workflows:
- ✅ Search → Read → Analyze workflow
- ✅ Write file → Read back → Verify workflow
- ✅ Grep → Read files → Analyze pattern workflow
- ✅ Tool chaining with dependencies
- ✅ Error recovery and workflow continuation

**Purpose:** Ensures the agent can execute complex multi-step tasks that require tool chaining.

### 3. Real MCP Servers (`mcp-servers.e2e.test.ts`) - 8 tests
Tests integration with actual MCP servers:
- ✅ Filesystem server read/write operations
- ✅ Directory listing and navigation
- ✅ Memory server entity creation
- ✅ Memory server relation creation
- ✅ Combining filesystem + memory in workflows
- ✅ Multiple simultaneous client connections
- ✅ Proper client cleanup
- ✅ Complex argument handling

**Purpose:** Validates integration with real MCP protocol servers (not mocked).

### 4. Caching & Performance (`caching-performance.e2e.test.ts`) - 10 tests
Tests RAG caching and performance:
- ✅ Embedding cache for unchanged files
- ✅ Cache invalidation on content changes
- ✅ Incremental indexing efficiency
- ✅ Cached results for identical queries
- ✅ Large codebase handling
- ✅ Cache directory structure maintenance
- ✅ Efficient search across large result sets
- ✅ Concurrent indexing requests
- ✅ Re-indexing after file deletion
- ✅ Accurate cache statistics

**Purpose:** Ensures the RAG system performs efficiently with proper caching.

### 5. Agent Self-Awareness (`agent-self-awareness.e2e.test.ts`) - 7 tests
Tests the agent's ability to understand itself:
- ✅ Using `search_codebase` to understand own implementation
- ✅ Using `grep` to find specific patterns in own code
- ✅ Assessing own capabilities using tools
- ✅ Understanding tool ecosystem
- ✅ End-to-end system validation
- ✅ Combining search + grep for code understanding
- ✅ Full agent stack integration validation

**Purpose:** Validates that the agent can introspect and understand its own codebase.

### 6. Original Agent Tests (`agent.e2e.test.ts`) - 7 tests
Original e2e tests for core functionality:
- ✅ RAG integration with codebase search
- ✅ Grep integration
- ✅ MCP tools integration
- ✅ Tool combination
- ✅ Full agent iteration
- ✅ Multiple tool calls in sequence
- ✅ Re-indexing after iterations

**Purpose:** Core integration tests for fundamental agent capabilities.

## Running Tests

### Run All E2E Tests
```bash
pnpm test:e2e
```

### Run Specific Test Suite
```bash
pnpm vitest run tests/e2e/interactive-mode.e2e.test.ts
pnpm vitest run tests/e2e/multi-step-workflow.e2e.test.ts
pnpm vitest run tests/e2e/mcp-servers.e2e.test.ts
pnpm vitest run tests/e2e/caching-performance.e2e.test.ts
pnpm vitest run tests/e2e/agent-self-awareness.e2e.test.ts
```

### Run All Tests (Unit + Integration + E2E)
```bash
pnpm test:all
```

## Requirements

Most e2e tests require API keys to run:

```env
OPENROUTER_API_KEY=sk-or-v1-...       # For LLM interactions
GOOGLE_GENERATIVE_AI_API_KEY=AIza...  # For embeddings
MODEL=qwen/qwen3-coder:free           # Free model
```

**Without API keys:** Tests are automatically skipped (not failed).

## Test Structure

All e2e tests follow this pattern:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const hasAPIKey = !!process.env.REQUIRED_API_KEY;

describe.skipIf(!hasAPIKey)('Test Suite Name', () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await setupTestWorkspace('test-name');
  });

  afterEach(async () => {
    await teardownTestWorkspace(workspace);
  });

  it('should test specific behavior', async () => {
    // Test implementation
    expect(result).toBeDefined();
  });
});
```

## Coverage Summary

| Category | Tests | Coverage |
|----------|-------|----------|
| Interactive Mode | 4 | User interaction, dynamic stops, history |
| Multi-Step Workflows | 5 | Complex task chains, error recovery |
| MCP Server Integration | 8 | Real protocol servers, multiple clients |
| Caching & Performance | 10 | RAG efficiency, incremental indexing |
| Self-Awareness | 7 | Code introspection, capability assessment |
| Core Functionality | 7 | RAG, grep, tools, agent loops |
| **Total** | **41** | **Full system validation** |

## What's Validated

### ✅ Core Features
- RAG-powered semantic search with Gemini embeddings
- Regex-based grep for exact pattern matching
- MCP protocol client integration
- Tool mapping and execution
- Multi-step agent workflows

### ✅ Interactive Features
- Human-in-the-loop via `ask_user` tool
- Task completion signaling via `task_complete`
- Dynamic stop conditions (agent-controlled)
- Conversation history management

### ✅ Performance
- Embedding caching for unchanged files
- Cache invalidation on content changes
- Incremental indexing
- Large codebase handling
- Concurrent operations

### ✅ Integration
- Real MCP servers (filesystem, memory)
- Multiple simultaneous clients
- Proper resource cleanup
- Complex argument handling

### ✅ Agent Intelligence
- Self-introspection using search tools
- Capability assessment
- Tool ecosystem understanding
- End-to-end system validation

## Test Utilities

Located in `tests/helpers/`:
- `test-utils.ts` - Workspace setup/teardown, file operations
- `test-mcp-server.ts` - Mock MCP server for testing

## Continuous Integration

All tests run in CI with:
- Unit tests (no API keys required)
- Integration tests (real implementations)
- E2E tests (skipped if no API keys)

Current status: **91 tests passing, 52 skipped (requires API keys)**

## Future Enhancements

Potential additions:
- Git operations workflow tests
- Fetch tool web content tests
- Sequential thinking integration tests
- Rate limiting and retry tests
- Multi-modal content handling tests
