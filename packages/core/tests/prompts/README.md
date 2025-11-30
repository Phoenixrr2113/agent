# Agent Test Prompts

This directory contains test prompts for evaluating the agent's capabilities.

## Usage

Run any test prompt using the test runner:

```bash
npm run test-agent tests/prompts/<prompt-file>
```

### Examples

```bash
# Test web research capabilities
npm run test-agent tests/prompts/1-web-research.txt

# Test code analysis
npm run test-agent tests/prompts/2-code-analysis.txt

# Test multi-step execution
npm run test-agent tests/prompts/3-multi-step-task.txt

# Test memory extraction and retrieval
npm run test-agent tests/prompts/4-memory-test.txt

# Test complex integration planning
npm run test-agent tests/prompts/5-complex-integration.txt

# Ultimate comprehensive test (all capabilities)
npm run test-agent tests/prompts/6-ultimate-test.txt
```

## Test Prompts

### 1. Web Research (`1-web-research.txt`)
**Tests:** Web search, information synthesis, structured output

**What it does:**
- Searches for AI coding assistant information
- Compares multiple products
- Identifies trends
- Provides tailored recommendations

**Success criteria:**
- Uses web search tool multiple times
- Provides structured comparison
- Cites sources
- Tailors output to user context

---

### 2. Code Analysis (`2-code-analysis.txt`)
**Tests:** Codebase search, code understanding, technical analysis

**What it does:**
- Searches codebase for memory system
- Analyzes architecture and components
- Identifies optimizations
- Suggests improvements

**Success criteria:**
- Uses codebase search effectively
- Understands code structure
- Provides concrete examples
- Makes actionable suggestions

---

### 3. Multi-Step Task (`3-multi-step-task.txt`)
**Tests:** Multi-phase execution, systematic approach, web + code search

**What it does:**
- Executes 4 distinct phases
- Combines codebase and web research
- Analyzes and compares approaches
- Provides structured recommendations

**Success criteria:**
- Completes all phases in order
- Shows clear reasoning
- Combines multiple information sources
- Provides detailed explanations

---

### 4. Memory Test (`4-memory-test.txt`)
**Tests:** Memory extraction, fact storage, information retrieval

**What it does:**
- Receives user preferences and context
- Performs web research
- Recalls stored information
- Applies both to recommendations

**Success criteria:**
- Extracts facts from conversation
- Stores user preferences
- Retrieves information accurately
- Combines memory with research

**Note:** Check memory database after running:
```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('memory.db', { readonly: true });
console.log('Facts:', db.prepare('SELECT content FROM facts').all());
db.close();
"
```

---

### 5. Complex Integration (`5-complex-integration.txt`)
**Tests:** Full capabilities - research, analysis, design, planning

**What it does:**
- Researches task planning approaches
- Analyzes existing codebase
- Designs new feature architecture
- Plans implementation steps
- Provides proof of concept

**Success criteria:**
- Completes all 5 phases
- Uses multiple tools (web search, codebase search)
- Provides detailed design
- Shows code examples
- Considers constraints and edge cases

---

### 6. Ultimate Test (`6-ultimate-test.txt`)
**Tests:** ALL capabilities - comprehensive integration test

**What it does:**
- 6 phases testing every major capability
- Memory extraction and retrieval
- Web research and codebase analysis
- Information synthesis across sources
- Personalized recommendations
- Technical depth with code examples

**Success criteria:**
- Completes all 6 phases systematically
- Uses web search and codebase search
- Extracts facts to memory
- Retrieves facts accurately
- Synthesizes information from multiple sources
- Provides personalized, actionable recommendations
- Shows technical depth

**Note:** This is the most comprehensive test. Run it after verifying individual capabilities work.

---

## Creating Custom Test Prompts

Test prompts should be plain text files (`.txt`) with clear instructions.

**Good prompt structure:**
1. Clear objective
2. Specific tasks/phases
3. Expected outputs
4. Constraints or preferences
5. Success criteria (optional, for your evaluation)

**Example:**
```
I need you to research X and do Y.

Tasks:
1. Search for information about...
2. Analyze the results and...
3. Provide recommendations on...

Please be thorough and cite sources.
```

## Viewing Results

The test runner shows:
- Full agent response
- Execution time
- Tools used
- Number of steps
- Completion status

**Example output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ AGENT RESPONSE:

[Agent's full response here]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 EXECUTION SUMMARY:

⏱️  Duration: 45.23 seconds
🔧 Tools Used: web_search, codebase_search, grep_search
📈 Steps: 12
✓  Completed: Yes
❓ Needs Input: No
```

## Tips

1. **Start simple:** Begin with `1-web-research.txt` to test basic capabilities
2. **Check logs:** Set `LOG_FILE=logs/test.log` in `.env` to capture detailed logs
3. **Verify memory:** After memory tests, check the database to confirm extraction
4. **Iterate:** Modify prompts based on results to test specific scenarios
5. **Compare:** Run the same prompt multiple times to test consistency

## Troubleshooting

**Agent doesn't use tools:**
- Check if the prompt clearly requires external information
- Ensure API keys are set in `.env` (TAVILY_API_KEY, BRAVE_API_KEY)

**Execution times out:**
- Complex prompts may take several minutes
- Check logs for errors
- Simplify the prompt to isolate issues

**Memory not working:**
- Ensure memory.db exists and is writable
- Check logs for extraction errors
- Verify facts with database query (see Memory Test section)

