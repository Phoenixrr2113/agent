# Testing the Agent

## Quick Start

### Interactive Chat Mode
```bash
pnpm chat
```
Type your requests interactively. Type `exit` to quit.

### Test with Prompt Files
```bash
npm run test-agent tests/prompts/1-web-research.txt
```
Run pre-written test prompts non-interactively.

## Available Test Prompts

| Prompt | Tests | Complexity |
|--------|-------|------------|
| `1-web-research.txt` | Web search, synthesis | ⭐⭐ Easy |
| `2-code-analysis.txt` | Codebase search, analysis | ⭐⭐⭐ Medium |
| `3-multi-step-task.txt` | Multi-phase execution | ⭐⭐⭐⭐ Hard |
| `4-memory-test.txt` | Memory extraction/retrieval | ⭐⭐⭐ Medium |
| `5-complex-integration.txt` | Full capabilities | ⭐⭐⭐⭐⭐ Expert |
| `6-ultimate-test.txt` | **ALL capabilities** | ⭐⭐⭐⭐⭐⭐ Ultimate |

## Running Tests

### Basic Usage
```bash
# Run a specific test
npm run test-agent tests/prompts/1-web-research.txt

# With logging to file
LOG_FILE=logs/test.log npm run test-agent tests/prompts/2-code-analysis.txt

# With workspace for codebase tools
WORKSPACE_ROOT=/path/to/project npm run test-agent tests/prompts/2-code-analysis.txt
```

### What You'll See

```
🧪 Agent Test Runner

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 Prompt File: tests/prompts/1-web-research.txt
📝 Prompt Length: 847 characters
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PROMPT:

[Your prompt text here]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🤖 Starting agent execution...

[Agent logs and execution...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ AGENT RESPONSE:

[Agent's response]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 EXECUTION SUMMARY:

⏱️  Duration: 45.23 seconds
🔧 Tools Used: web_search, codebase_search
📈 Steps: 8
✓  Completed: Yes
❓ Needs Input: No

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Creating Custom Test Prompts

1. Create a `.txt` file in `tests/prompts/`
2. Write your prompt in plain text
3. Run with `npm run test-agent tests/prompts/your-prompt.txt`

**Example prompt:**
```
Please research the latest trends in AI agents and summarize the top 3 findings.

Include:
1. Brief description of each trend
2. Why it matters
3. Example applications

Use web search to find current information.
```

## Verifying Memory Extraction

After running a test that should extract memories:

```bash
# View all facts
node -e "
const Database = require('better-sqlite3');
const db = new Database('memory.db', { readonly: true });
const facts = db.prepare('SELECT content, valid_from FROM facts WHERE invalidated_at IS NULL').all();
facts.forEach(f => console.log('✓', f.content));
db.close();
"

# View all entities
node -e "
const Database = require('better-sqlite3');
const db = new Database('memory.db', { readonly: true });
const entities = db.prepare('SELECT name, entity_type FROM entities').all();
entities.forEach(e => console.log('•', e.name, '(' + e.entity_type + ')'));
db.close();
"

# Clear memory database
rm -f memory.db
```

## Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run specific test file
npm run test:unit src/core/memory/extractor.test.ts

# Watch mode
npm run test:watch
```

## Logging

### Console Only (Default)
```bash
pnpm chat
```

### File Logging
```bash
# Set in .env
LOG_FILE=logs/agent.log

# Or set inline
LOG_FILE=logs/test.log npm run test-agent tests/prompts/1-web-research.txt

# View logs in real-time
tail -f logs/agent.log
```

### Log Levels
```bash
# Debug (most verbose)
LOG_LEVEL=debug pnpm chat

# Info (default)
LOG_LEVEL=info pnpm chat

# Warn (warnings only)
LOG_LEVEL=warn pnpm chat

# Error (errors only)
LOG_LEVEL=error pnpm chat
```

## Troubleshooting

### Agent doesn't use tools
- Ensure API keys are set in `.env`
- Check that the prompt requires external information
- Verify tools are registered (check logs)

### Memory not persisting
- Check `memory.db` file exists
- Verify write permissions
- Check logs for extraction errors

### Tests timeout
- Increase complexity gradually
- Check API rate limits
- Verify network connectivity

### Build errors
```bash
# Clean and rebuild
rm -rf dist
npm run build
```

## Best Practices

1. **Start simple** - Test basic capabilities before complex scenarios
2. **Use logging** - Enable file logging for debugging
3. **Check memory** - Verify facts are extracted correctly
4. **Iterate** - Refine prompts based on results
5. **Clean state** - Clear memory.db between tests if needed

## Examples

### Test web search
```bash
npm run test-agent tests/prompts/1-web-research.txt
```

### Test with logging
```bash
LOG_FILE=logs/test.log LOG_LEVEL=debug npm run test-agent tests/prompts/2-code-analysis.txt
tail -f logs/test.log
```

### Test memory system
```bash
rm -f memory.db  # Start fresh
npm run test-agent tests/prompts/4-memory-test.txt

# Verify extraction
node -e "
const Database = require('better-sqlite3');
const db = new Database('memory.db', { readonly: true });
console.log('Facts:', db.prepare('SELECT content FROM facts').all());
db.close();
"
```

### Interactive testing
```bash
pnpm chat
# Then paste or type your request
```

