# Competitive Analysis: AI Coding Agents

> **⚠️ IMPORTANT NOTE:** This analysis was created before clarifying the project vision. Most features here are for **interactive human-in-the-loop coding assistants** (Aider, Gemini CLI, Cline), which require human approval for changes.
>
> **Our vision is different:** A fully **autonomous self-building agent** that operates without human supervision, like an inflatable house that expands and maintains itself.
>
> **See [AUTONOMOUS_AGENT_DESIGN.md](AUTONOMOUS_AGENT_DESIGN.md) for features aligned with the autonomous vision.**

Analysis of leading AI coding CLI agents and proposed features for our agent.

## Agents Analyzed

1. **Gemini CLI** (Google) - 41.6k+ stars, Apache 2.0
2. **Aider** - 38.6k stars, 3.9M installs, Apache 2.0
3. **Continue** - 30k stars, Apache 2.0
4. **Cline** - Autonomous VS Code/CLI agent
5. **Claude Code** - Anthropic's official CLI

## Feature Comparison

### Core Features We Have ✅

| Feature | Our Agent | Notes |
|---------|-----------|-------|
| MCP Support | ✅ | Full MCP integration via mcp-client.ts |
| Approval Modes | ✅ | auto/manual via APPROVAL_MODE env |
| Model Routing | ✅ | Infrastructure ready (fast/standard/reasoning/powerful) |
| Ollama Support | ✅ | Local model support via ollama-ai-provider-v2 |
| Multi-Agent | ✅ | Planner/Implementer/Evaluator (planned in ARCHITECTURE.md) |
| Plan Tracking | ✅ | plan_tool for task management |
| Validation | ✅ | validation_tool runs tsc/tests |
| Git Operations | ✅ | Via MCP filesystem tools |
| Codebase Search | ✅ | RAG semantic search + grep |
| Sequential Thinking | ✅ | Chain-of-thought reasoning tool |
| Human-in-Loop | ✅ | ask_user tool with approval modes |

### Features We're Missing 🔴

| Feature | Found In | Priority | Complexity |
|---------|----------|----------|------------|
| Checkpointing/Session Management | Gemini CLI, Cline | **HIGH** | Medium |
| Auto-commit with AI messages | Aider | **HIGH** | Low |
| Diff Preview Before Execution | Cline, Aider | **HIGH** | Medium |
| Watch Mode | Aider | **HIGH** | Medium |
| Auto-run Linters/Tests | Aider | Medium | Low |
| Custom Context Files (PROJECT.md) | Gemini CLI | Medium | Low |
| Non-interactive/Scripting Mode | Gemini CLI | Medium | Medium |
| Structured Output (JSON) | Gemini CLI | Medium | Low |
| Voice Input | Aider | Low | High |
| Multi-directory Context | Gemini CLI | Medium | Low |
| Workspace Snapshots | Cline | Medium | Medium |
| @url Web Content Integration | Cline | Medium | Low |
| Google Search Grounding | Gemini CLI | Low | Medium |
| Intelligent Codebase Mapping | Aider | **HIGH** | High |
| IDE Integration | Aider, Cline | Low | High |

## Detailed Feature Analysis

### 1. Checkpointing/Session Management 🔥

**What it does:**
- Saves conversation state at any point
- Resume from specific checkpoint later
- Create branches from checkpoints (what-if scenarios)
- Persist full conversation history + file states

**Implementation:**
Gemini CLI automatically creates checkpoints before file modifications. Users can:
- List checkpoints: `gemini checkpoints list`
- Resume from checkpoint: `gemini --resume <checkpoint-id>`
- Branch from checkpoint to try alternative approaches

**Value Proposition:**
- Safe experimentation with rollback
- Long-running tasks can be paused/resumed
- Cost savings (no re-explaining context)
- Session persistence across terminal restarts

**Implementation Strategy:**
```typescript
// Save checkpoint before file operations
interface Checkpoint {
  id: string;
  timestamp: number;
  conversationHistory: Message[];
  workingDirectory: string;
  gitState: { branch: string; commitHash: string };
  metadata: { description: string };
}

// Store in ~/.agent/checkpoints/
const saveCheckpoint = (messages: Message[]) => {
  const checkpoint = {
    id: generateId(),
    timestamp: Date.now(),
    conversationHistory: messages,
    workingDirectory: process.cwd(),
    gitState: getCurrentGitState(),
    metadata: { description: 'Auto-saved before file modifications' },
  };
  fs.writeFileSync(`~/.agent/checkpoints/${checkpoint.id}.json`, JSON.stringify(checkpoint));
};

// Resume from checkpoint
const resumeFromCheckpoint = (checkpointId: string) => {
  const checkpoint = JSON.parse(fs.readFileSync(`~/.agent/checkpoints/${checkpointId}.json`));
  return checkpoint.conversationHistory;
};
```

### 2. Auto-commit with AI-Generated Messages 🔥

**What it does:**
- Automatically commits file changes after modifications
- Generates meaningful commit messages describing changes
- Uses git diff to understand what changed
- Follows conventional commits format

**Implementation:**
Aider commits every change with descriptive messages like:
- `feat: add user authentication with JWT`
- `fix: resolve race condition in async file handler`
- `refactor: extract database logic into separate module`

**Value Proposition:**
- Clean git history without manual commits
- Never lose work (every change is committed)
- Easy rollback with git revert
- Professional commit messages

**Implementation Strategy:**
```typescript
async function autoCommit(filesChanged: string[]) {
  const diff = await execAsync('git diff');

  const commitMessage = await agent.generate({
    prompt: `Generate a concise conventional commit message for these changes:
${diff}

Format: <type>: <description>
Types: feat, fix, refactor, docs, test, chore

Rules:
- One line, under 72 characters
- Describe WHAT changed and WHY, not HOW
- Use imperative mood (add, fix, not added, fixed)`,
  });

  await execAsync(`git add ${filesChanged.join(' ')}`);
  await execAsync(`git commit -m "${commitMessage.text}"`);
  console.log(`✓ Committed: ${commitMessage.text}`);
}
```

### 3. Diff Preview Before Execution 🔥

**What it does:**
- Shows unified diff before applying file changes
- Highlights additions/deletions in color
- Asks for user approval before writing
- Prevents unwanted modifications

**Implementation:**
Cline and Aider both show diffs before applying:
```diff
--- src/main.ts
+++ src/main.ts
@@ -10,6 +10,8 @@
 const agent = createAgent({
   model: models.standard(),
+  prepareStep: trimContext,
+  maxSteps: 50,
 });
```

**Value Proposition:**
- User sees exactly what will change
- Catch mistakes before they happen
- Learn what the agent is doing
- Builds trust through transparency

**Implementation Strategy:**
```typescript
import diff from 'diff';
import chalk from 'chalk';

async function applyFileChanges(filePath: string, newContent: string) {
  const oldContent = fs.readFileSync(filePath, 'utf-8');
  const patch = diff.createPatch(filePath, oldContent, newContent);

  console.log(chalk.bold(`\nProposed changes to ${filePath}:`));
  console.log(formatDiff(patch));

  if (APPROVAL_MODE === 'manual') {
    const answer = await rl.question('\nApply these changes? (y/n) ');
    if (answer.toLowerCase() !== 'y') {
      console.log('Changes rejected');
      return false;
    }
  }

  fs.writeFileSync(filePath, newContent);
  return true;
}
```

### 4. Watch Mode 🔥

**What it does:**
- Monitors codebase for file changes
- Responds to comments in code (e.g., `// TODO: fix this`)
- Integrates with IDE workflow
- Auto-runs on detected changes

**Implementation:**
Aider's watch mode:
1. Developer adds comment: `// AIDER: add input validation here`
2. Save file
3. Aider detects change, reads comment
4. Makes suggested modification
5. Auto-commits result

**Value Proposition:**
- Seamless IDE integration
- Natural workflow (just add comments)
- No context switching
- Async task execution

**Implementation Strategy:**
```typescript
import chokidar from 'chokidar';

function startWatchMode() {
  console.log('👀 Watch mode enabled. Add comments like "// AGENT: your request" to trigger actions.');

  const watcher = chokidar.watch('src/**/*', { ignoreInitial: true });

  watcher.on('change', async (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const agentComments = extractAgentComments(content);

    if (agentComments.length > 0) {
      console.log(`\n📝 Found ${agentComments.length} agent comment(s) in ${filePath}`);

      for (const comment of agentComments) {
        await agent.generate({
          prompt: `${comment.text}\n\nFile: ${filePath}\nLine: ${comment.line}`,
        });
      }
    }
  });
}

function extractAgentComments(content: string) {
  const regex = /\/\/ AGENT: (.+)/g;
  const matches = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    matches.push({ text: match[1], line: content.substring(0, match.index).split('\n').length });
  }

  return matches;
}
```

### 5. Intelligent Codebase Mapping 🔥

**What it does:**
- Creates semantic map of entire codebase
- Identifies function dependencies
- Understands code relationships
- Enables better context selection

**Implementation:**
Aider creates repo maps showing:
- File structure
- Function/class definitions
- Import relationships
- Call graphs

**Value Proposition:**
- Better context awareness in large projects
- Smarter file selection for edits
- Understands ripple effects of changes
- Reduces hallucinations

**Implementation Strategy:**
```typescript
// Use tree-sitter to parse codebase
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';

interface CodeMap {
  files: Map<string, FileMetadata>;
  dependencies: Map<string, string[]>;
  exports: Map<string, Symbol[]>;
}

async function createCodebaseMap(): Promise<CodeMap> {
  const parser = new Parser();
  parser.setLanguage(TypeScript.typescript);

  const files = await glob('src/**/*.ts');
  const codeMap: CodeMap = {
    files: new Map(),
    dependencies: new Map(),
    exports: new Map(),
  };

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const tree = parser.parse(content);

    const metadata = extractMetadata(tree, file);
    codeMap.files.set(file, metadata);
    codeMap.dependencies.set(file, metadata.imports);
    codeMap.exports.set(file, metadata.exports);
  }

  return codeMap;
}
```

### 6. Non-interactive/Scripting Mode

**What it does:**
- Run agent headless in CI/CD
- Structured output (JSON, stream-JSON)
- Exit codes for automation
- No user prompts

**Implementation:**
Gemini CLI supports:
```bash
gemini -p "fix type errors" --output-format json --non-interactive
```

**Value Proposition:**
- CI/CD integration
- Automated code reviews
- Scheduled tasks
- Scripting workflows

**Implementation Strategy:**
```typescript
if (process.env.NON_INTERACTIVE === 'true') {
  const result = await agent.generate({ prompt: process.argv[2] });

  if (process.env.OUTPUT_FORMAT === 'json') {
    console.log(JSON.stringify({
      success: true,
      text: result.text,
      toolCalls: result.steps.flatMap(s => s.toolCalls),
    }));
  }

  process.exit(0);
}
```

### 7. Custom Context Files (PROJECT.md)

**What it does:**
- Project-specific instructions for the agent
- Coding standards, preferences
- Auto-loaded on agent start
- Per-project customization

**Implementation:**
Gemini CLI reads `GEMINI.md` from project root:
```markdown
# Project Context

This is a TypeScript agent using AI SDK 5.

## Code Style
- No comments except for non-obvious logic
- Use zod for validation
- Prefer functional patterns

## Commands
Before any file changes, run: npm run lint
```

**Value Proposition:**
- Consistent behavior per-project
- Team-wide agent configuration
- Reduce repetitive instructions
- Better code consistency

**Implementation Strategy:**
```typescript
const contextFile = path.join(process.cwd(), 'AGENT.md');

if (fs.existsSync(contextFile)) {
  const projectContext = fs.readFileSync(contextFile, 'utf-8');
  systemPrompt += `\n\n## Project-Specific Instructions\n${projectContext}`;
}
```

### 8. Auto-run Linters/Tests

**What it does:**
- Automatically run linters after code changes
- Run relevant tests
- Auto-fix linter errors
- Report results to agent

**Implementation:**
Aider runs linters and tests, then asks agent to fix errors.

**Value Proposition:**
- Catch errors immediately
- Auto-fix simple issues
- Ensure code quality
- Faster feedback loop

**Implementation Strategy:**
```typescript
async function validateAndFix(filesChanged: string[]) {
  const lintResult = await execAsync('npm run lint');

  if (lintResult.exitCode !== 0) {
    console.log('⚠️  Linter errors detected, asking agent to fix...');

    await agent.generate({
      prompt: `Fix these linter errors:\n${lintResult.stderr}\n\nFiles: ${filesChanged.join(', ')}`,
    });

    await execAsync('npm run lint');
  }

  await execAsync('npm test');
}
```

## Proposed Implementation Priority

### Phase 1: Quick Wins (1-2 weeks)
1. ✅ **Auto-commit workflow** - Low complexity, high value
2. ✅ **Custom context files (AGENT.md)** - Low complexity, medium value
3. ✅ **Diff preview before execution** - Medium complexity, high value
4. ✅ **Structured output (JSON)** - Low complexity, medium value

### Phase 2: Core Features (2-4 weeks)
5. ✅ **Checkpointing/Session Management** - Medium complexity, high value
6. ✅ **Watch Mode** - Medium complexity, high value
7. ✅ **Auto-run linters/tests** - Low complexity, medium value
8. ✅ **Multi-directory context** - Low complexity, medium value

### Phase 3: Advanced (4-8 weeks)
9. ✅ **Intelligent Codebase Mapping** - High complexity, high value
10. ✅ **Workspace Snapshots** - Medium complexity, medium value
11. ✅ **@url Web Content Integration** - Low complexity, medium value
12. ✅ **Non-interactive/Scripting Mode** - Medium complexity, medium value

### Phase 4: Optional (Future)
13. ⚠️ **Voice Input** - High complexity, low value (nice-to-have)
14. ⚠️ **Google Search Grounding** - Medium complexity, low value (MCP can add this)
15. ⚠️ **IDE Integration** - High complexity, low value (watch mode covers this)

## Feature Priorities Summary

### Must-Have (Implement ASAP)
- Auto-commit workflow
- Diff preview before execution
- Checkpointing/session management
- Watch mode
- Custom context files

### Should-Have (High Value)
- Intelligent codebase mapping
- Auto-run linters/tests
- Multi-directory context
- Structured output

### Nice-to-Have (Lower Priority)
- Non-interactive mode
- Workspace snapshots
- @url integration
- Voice input

## Key Takeaways

1. **User Trust is Critical** - Diff previews, approval modes, checkpoints all build trust
2. **Developer Workflow Integration** - Watch mode, auto-commit, IDE integration reduce friction
3. **Safety First** - Checkpoints, diffs, rollback are table stakes
4. **Extensibility Matters** - MCP support, custom context files enable customization
5. **Quality Automation** - Auto-run tests/linters ensures code quality

## Recommended Next Steps

1. Implement Phase 1 features (quick wins)
2. Add comprehensive testing for each feature
3. Document new features in README
4. Gather user feedback
5. Iterate based on actual usage patterns
