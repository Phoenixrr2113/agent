# Agent Tools Inventory

> **Generated**: 2025-12-19 | **Total Tools**: 45

## Overview

All tools are defined in `packages/core/src/tools/` and assembled in `packages/core/src/application/initialization.ts`. Tools use the Vercel AI SDK `tool()` wrapper and are instrumented with timing/logging via `tool-instrumentation.ts`.

---

## Tool Categories

| Category | Count | Source File |
|----------|-------|-------------|
| Filesystem | 12 | `filesystem/tools.ts` |
| Memory | 6 | `memory.ts` |
| Background Tasks | 7 | `background-tasks/tools.ts` |
| Chaining | 3 | `chaining/tools.ts` |
| Registry | 3 | `registry/tools.ts` |
| Workflow | 2 | `workflow.ts` |
| Codebase/RAG | 2 | `codebase.ts` |
| Device | 3 | `device-use/tools.ts` |
| Agent | 2 | `agent.ts` |
| Other | 5 | Various |

---

## Detailed Tool List

### Filesystem Tools (`filesystem/tools.ts`)
Created via `createFilesystemTools(workspaceRoot)` factory.

| Tool | Description |
|------|-------------|
| `read_text_file` | Read file with optional head/tail |
| `read_media_file` | Read binary files (images, audio) as base64 |
| `read_multiple_files` | Batch read multiple files |
| `write_file` | Create/overwrite file atomically |
| `edit_file` | Line-based text replacement with diff |
| `create_directory` | Create directories recursively |
| `list_directory` | List dir contents with [FILE]/[DIR] prefixes |
| `list_directory_with_sizes` | List with sizes and sorting |
| `directory_tree` | Recursive JSON tree structure |
| `search_files` | Glob pattern search |
| `get_file_info` | File metadata (size, timestamps, permissions) |
| `move_file` | Rename/move files |

### Memory Tools (`memory.ts`)
Graphiti-backed long-term memory.

| Tool | Description |
|------|-------------|
| `memory_add` | Add facts to memory |
| `memory_search` | Search memory for relevant facts |
| `memory_get_episodes` | Retrieve conversation history |
| `memory_get_fact` | Get specific fact by ID |
| `memory_get_entity` | Get entity information |
| `memory_get_related` | Get related facts/entities |

### Background Tasks (`background-tasks/tools.ts`)
Persistent task management for long-running operations.

| Tool | Description |
|------|-------------|
| `start_background_task` | Start detached background command |
| `check_task_status` | Poll task status with optional wait |
| `get_task_output` | Retrieve stdout/stderr from task |
| `cancel_task` | Cancel running task (SIGTERM) |
| `list_tasks` | List all tasks with filters |
| `cleanup_old_tasks` | Remove old task logs |
| `spawn_agent` | Spawn autonomous sub-agent |

### Chaining Tools (`chaining/tools.ts`)
Tool chaining for multi-step operations.

| Tool | Description | Uses Lifecycle Hooks? |
|------|-------------|---------------------|
| `plan_chain` | Plan sequence of tool calls | ❌ No |
| `await_chain` | Execute chain and wait for results | ❌ No |
| `cancel_chain` | Cancel pending chain | ❌ No |

### Registry Tools (`registry/tools.ts`)
Dynamic tool discovery and activation.

| Tool | Description |
|------|-------------|
| `tool_search` | Search for tools by name/description |
| `activate_tool` | Activate deferred tool |
| `deactivate_tool` | Deactivate tool to free context |

### Workflow Tools (`workflow.ts`)
Task planning and validation.

| Tool | Description |
|------|-------------|
| `plan` | Create/track task checklists |
| `validate` | Run type checks and tests |

### Codebase Tools (`codebase.ts`)
RAG-powered code search (when indexing enabled).

| Tool | Description |
|------|-------------|
| `search_codebase` | Semantic code search |
| `get_codebase_context` | Get context for code section |

### Device Tools (`device-use/tools.ts`)
Anthropic native tools for computer control.

| Tool | Description | Source |
|------|-------------|--------|
| `computer` | Mouse, keyboard, screenshots | Anthropic SDK |
| `bash` | Execute shell commands | Anthropic SDK |
| `text_editor` | File editing operations | Anthropic SDK |

### Agent Tools (`agent.ts`)
User interaction and task completion.

| Tool | Description |
|------|-------------|
| `ask_user` | Get input from user |
| `task_complete` | Signal task completion |

### Other Tools

| Tool | Source | Description |
|------|--------|-------------|
| `shell` | `shell.ts` | Execute shell commands with timeout |
| `web_search` | `web-search.ts` | Search the internet |
| `fetch_page` | `fetch-page.ts` | Fetch and parse web pages |
| `sequential_thinking` | `sequential-thinking.ts` | Deep reasoning for complex problems |

---

## Architecture

```
initialization.ts
    │
    ├── Creates tools from various sources
    │   ├── createFilesystemTools(workspaceRoot)
    │   ├── memoryTools
    │   ├── persistentBackgroundTaskTools
    │   ├── chainingTools
    │   ├── createAgentTools(readline)
    │   ├── createDeviceTools(config)
    │   └── standalone tools (shell, web_search, etc.)
    │
    ├── Registers all tools in ToolRegistry
    │
    ├── Generates embeddings for semantic search
    │
    ├── Creates registry meta-tools
    │   ├── tool_search
    │   ├── activate_tool
    │   └── deactivate_tool
    │
    └── Wraps with instrumentTools() for timing/logging
```

---

## Lifecycle Hooks Status

**Current State**: None of the tools use lifecycle hooks. All tools use the AI SDK `tool()` wrapper directly.

**Existing Patterns**:
- `tool-instrumentation.ts` - Adds timing/logging wrapper around `execute()`
- `ToolFactory` class in `factory.ts` - Unused factory pattern
- `ToolActivationManager` - Manages deferred tool activation

**Needed for Tool Chaining**:
- `beforeExecute` - Pre-execution validation, context setup
- `afterExecute` - Result processing, cleanup
- `onError` - Error handling, retry logic
- `onCancel` - Cleanup on chain cancellation

---

## Migration Priority

### High Priority (Core tools used frequently)
1. Filesystem tools (12 tools)
2. Shell tool
3. Background task tools (7 tools)

### Medium Priority (Specialized tools)
4. Memory tools (6 tools)
5. Chaining tools (3 tools)
6. Web/fetch tools

### Low Priority (Meta/utility tools)
7. Registry tools (3 tools)
8. Workflow tools (2 tools)
9. Agent tools (2 tools)
