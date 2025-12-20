# Gemini CLI Tool Reference

Reference patterns from [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli) for implementing our consolidated tools.

---

## Source Files

| Feature | Gemini CLI Source |
|---------|-------------------|
| **Base Tool Pattern** | [tools.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/tools/tools.ts) |
| **Tool Registry** | [tool-registry.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/tools/tool-registry.ts) |
| **Error Types** | [tool-error.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/tools/tool-error.ts) |
| **Tool Names** | [tool-names.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/tools/tool-names.ts) |

---

## File Operations

### Read File
**Source**: [read-file.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/tools/read-file.ts)

Key patterns:
- `offset` and `limit` params for pagination
- Truncation message with next offset hint:
```typescript
llmContent = `
IMPORTANT: The file content has been truncated.
Status: Showing lines ${start}-${end} of ${total} total lines.
Action: To read more, use offset: ${nextOffset}.
--- FILE CONTENT (truncated) ---
${content}`;
```

### Read Many Files
**Source**: [read-many-files.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/tools/read-many-files.ts)

Key patterns:
- Glob patterns for include/exclude
- Separator format: `--- {filePath} ---`
- Default excludes from config
- `useDefaultExcludes` option

### Write File
**Source**: [write-file.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/tools/write-file.ts)

Key patterns:
- `ensureCorrectFileContent()` - LLM correction for new files
- `ensureCorrectEdit()` - LLM correction for edits
- Diff generation for confirmation
- Telemetry logging per operation

### Smart Edit (Fuzzy Matching)
**Source**: [smart-edit.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/tools/smart-edit.ts)

Key patterns:
```typescript
// 1. Try exact match
const exactOccurrences = normalizedCode.split(normalizedSearch).length - 1;

// 2. Try flexible match (whitespace-normalized)
const searchLinesStripped = normalizedSearch.split('\n').map(line => line.trim());

// 3. Use LLM to fix if both fail
const { params } = await FixLLMEditWithInstruction(...);
```

---

## Directory Operations

### List Directory
**Source**: [ls.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/tools/ls.ts)

Key patterns:
- Returns `FileEntry[]` with: name, path, isDirectory, size, modifiedTime
- Respects `.gitignore` and `.geminiignore`
- Glob-based ignore patterns

### Glob Search
**Source**: [glob.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/tools/glob.ts)

Key patterns:
- Recency-based sorting (recent files first):
```typescript
function sortFileEntries(entries, nowTimestamp, recencyThresholdMs) {
  // Recent files sorted by mtime (newest first)
  // Older files sorted alphabetically
}
```
- Workspace boundary validation
- `.gitignore` and `.geminiignore` support

### Grep (Regex Search)
**Source**: [grep.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/tools/grep.ts)

### Ripgrep (Fast Search)
**Source**: [ripGrep.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/tools/ripGrep.ts)

Key patterns:
- Auto-downloads ripgrep binary if not present
- Falls back to JS grep if ripgrep unavailable
- `DEFAULT_TOTAL_MAX_MATCHES = 20000`

---

## Shell Execution

**Source**: [shell.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/tools/shell.ts)

Key patterns:
- Command allowlisting:
```typescript
const commandsToConfirm = rootCommands.filter(cmd => !allowlist.has(cmd));
if (commandsToConfirm.length === 0) return false; // already approved
```
- Confirmation flow with outcomes:
  - `ProceedAlways` - add to session allowlist
  - `ProceedAlwaysAndSave` - persist to config
- Streaming output with `OUTPUT_UPDATE_INTERVAL_MS = 1000`
- Non-interactive mode throws if command not in allowed list

---

## Web Operations

### Web Fetch
**Source**: [web-fetch.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/tools/web-fetch.ts)

### Web Search
**Source**: [web-search.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/tools/web-search.ts)

---

## Base Tool Pattern

**Source**: [tools.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/tools/tools.ts)

```typescript
interface ToolInvocation<TParams, TResult> {
  params: TParams;
  getDescription(): string;
  toolLocations(): ToolLocation[];
  shouldConfirmExecute(signal): Promise<ConfirmationDetails | false>;
  execute(signal, updateOutput?, shellConfig?): Promise<TResult>;
}

abstract class BaseToolInvocation<TParams, TResult> {
  // Confirmation flow via MessageBus
  // Policy update for "always allow"
  // Abort signal handling
}
```

---

## Error Types

**Source**: [tool-error.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/tools/tool-error.ts)

```typescript
enum ToolErrorType {
  FILE_NOT_FOUND,
  PATH_NOT_IN_WORKSPACE,
  PATH_IS_NOT_A_DIRECTORY,
  PERMISSION_DENIED,
  // etc.
}
```

---

## Todos Tool
**Source**: [write-todos.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/tools/write-todos.ts)

Interesting pattern - writes structured todo list for the LLM to track its own work.
