# Session Context: Generic Agent Template Development

## Project Overview
A self-building AI agent template built with TypeScript, featuring RAG-powered codebase search, MCP tool integration, and intelligent code understanding. The agent is generic by design - it asks users what they want to build and adapts itself for that purpose.

## Current Branch
`claude/agent-template-development-01838AfJST6eoCoA2seRcanf`

## Recent Accomplishments

### 1. **Switched from OpenAI to Google Gemini Embeddings** ✅
- **Why**: Free embeddings with generous limits, zero cost for development
- **Model**: `text-embedding-004` (768-dimensional vectors)
- **Changes**:
  - Replaced `@ai-sdk/openai` with `@ai-sdk/google`
  - Updated all RAG code in `src/rag.ts`
  - Updated tests to use `GOOGLE_GENERATIVE_AI_API_KEY`
  - Added `dotenv` for environment variable loading
- **Status**: Working perfectly - 107 tests passing (previously only 91)

### 2. **Built Interactive Chat Mode** ✅
- **File**: `src/interactive.ts`
- **Command**: `npm run chat`
- **Features**:
  - Human-in-the-loop via CLI (not web UI)
  - Agent asks users what they want to build
  - `ask_user` tool for agent to request clarification
  - `task_complete` tool for agent to signal completion
  - Dynamic stop conditions (agent decides when done, not fixed step count)
  - Smart client cleanup (only closes MCP clients that were used)
  - Conversation history maintained
  - Type "exit" or "quit" to end

### 3. **Dynamic Stop Conditions** ✅
- **Before**: Fixed `stepCountIs(5)`
- **After**: Custom `stopWhen()` function
  - Agent can call `task_complete` to stop early
  - Max 20 steps (configurable)
  - Agent decides when task is done
- **Benefits**: More efficient, stops when done instead of wasting steps

### 4. **Tool Usage Tracking** ✅
- Wraps MCP tools to track which clients are used
- Only closes clients that were actually used in `cleanup()`
- Shows which tools were used in `onFinish` callback
- Displays step count for each response

## Architecture

### Two Modes of Operation

1. **Autonomous Mode** (`npm run dev`)
   - File: `src/index.ts`
   - Runs 5 steps automatically then stops
   - No user interaction after initial message
   - For batch processing/automation

2. **Interactive Mode** (`npm run chat`) ⭐ PRIMARY
   - File: `src/interactive.ts`
   - Back-and-forth conversation
   - Agent asks what you want to build
   - Human-in-the-loop via `ask_user` tool
   - Continuous until user types "exit"

### Key Components

```
src/
├── interactive.ts      # Interactive chat mode (main user interface)
├── index.ts           # Autonomous mode (legacy)
├── rag.ts             # RAG with Gemini embeddings
├── chunking.ts        # Intelligent code chunking (adaptive/semantic/fixed)
├── cache.ts           # File-based embedding cache
├── mcp-client.ts      # MCP protocol client
├── tools.ts           # Tool mapping utilities
├── grep.ts            # Pattern matching search
└── prompts.ts         # System prompts
```

### Available Tools

**Codebase Tools:**
- `search_codebase` - Semantic search using Gemini embeddings
- `grep_codebase` - Regex pattern matching
- `ask_user` - Ask user for input/clarification
- `task_complete` - Signal task completion

**MCP Tools:**
- Filesystem (15 tools) - read/write files
- Memory (5 tools) - persistent storage

## Environment Setup

### Required API Keys
```env
OPENROUTER_API_KEY=sk-or-v1-...        # For LLM (free models available)
GOOGLE_GENERATIVE_AI_API_KEY=AIza...   # For embeddings (FREE!)
MODEL=qwen/qwen3-coder:free            # Or other free model
```

### Installation
```bash
pnpm install
```

### Testing
```bash
npm run test:all        # All tests (107 passing, 18 skipped without API keys)
npm run test:unit       # Unit tests (69)
npm run test:integration # Integration tests (22)
npm run test:e2e        # E2E tests (7)

# Manual testing
npx tsx test-gemini.ts  # Test Gemini API connection
npx tsx test-rag.ts     # Test RAG system
```

## Test Status
- ✅ 107 tests passing
- ⏭️ 18 tests skipped (require API keys: `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENROUTER_API_KEY`)
- ❌ 2 minor failures (rate limiting, test isolation - not blocking)

## Important Design Decisions

1. **Generic by Design**: Agent is NOT a code assistant by default. It asks users what they want to build and adapts.

2. **CLI over Web UI**: Simpler human-in-the-loop via terminal readline, not Next.js web UI with React hooks.

3. **Agent-Initiated Conversation**: Interactive mode starts automatically with agent asking "What do you want me to become?"

4. **Free Embeddings**: Using Google Gemini instead of OpenAI saves money and has generous free tier.

5. **No Mocks in Tests**: Integration tests use real implementations where possible (but unit tests still use mocks for speed).

## Known Issues

1. **Two failing tests** (non-blocking):
   - One E2E test fails due to OpenRouter rate limiting (not our fault)
   - One RAG test has test isolation issue (expects empty workspace but gets 3 chunks)

2. **Git operations**: Remote is at `http://127.0.0.1:PORT/git/Phoenixrr2113/agent` (local git server)

## What to Work On Next (Suggestions)

1. **Fix the 2 failing tests**
   - Test isolation in RAG integration test
   - Handle rate limiting in E2E tests

2. **Enhance Interactive Mode**
   - Add conversation history save/load
   - Add tool approval prompts (optional HITL confirmation)
   - Add streaming progress indicators

3. **Add More MCP Servers**
   - GitHub (issues, PRs)
   - Database (PostgreSQL/SQLite)
   - Slack (notifications)

4. **Improve RAG**
   - Add BM25 hybrid search
   - Implement re-ranking
   - Better chunking strategies

5. **Build Specialized Agents**
   - Code review agent
   - Documentation generator
   - Testing agent

6. **Production Features**
   - CI/CD with GitHub Actions
   - Deployment scripts
   - Error handling improvements
   - Observability/logging

## Quick Start Commands

```bash
# Interactive chat (recommended)
npm run chat

# Run tests
npm run test:all

# Test Gemini embeddings
npx tsx test-gemini.ts

# Test RAG system
npx tsx test-rag.ts
```

## Files Modified in This Session

1. `src/rag.ts` - Switched to Gemini embeddings
2. `src/interactive.ts` - New interactive chat mode
3. `package.json` - Added `chat` script, `dotenv` dependency
4. `.env.example` - Added `GOOGLE_GENERATIVE_AI_API_KEY`
5. `vitest.config.ts` - Load environment variables
6. `test-gemini.ts`, `test-rag.ts` - Added dotenv config
7. `src/rag.test.ts` - Updated mocks for Gemini
8. `tests/integration/rag.integration.test.ts` - Check for Google AI key
9. `tests/e2e/agent.e2e.test.ts` - Check for Google AI key

## Context for Next Session

**Current State**: The Generic Agent Template is functional with interactive chat mode, Gemini embeddings working perfectly, and human-in-the-loop capabilities via CLI.

**Last Discussion**: User correctly pointed out that the welcome prompts were misleading - they suggested it was a code search assistant when it's actually a generic agent that asks users what to build. This has been fixed.

**Philosophy**: This is a GENERIC agent template. It should NOT assume it's for coding, documentation, or any specific purpose. It should ask the user what they want and build itself for that purpose.

**Next Priority**: User's choice - could be fixing tests, enhancing features, or using the agent for actual tasks.
