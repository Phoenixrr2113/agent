# Custom Benchmark Suite

A comprehensive, self-contained benchmark suite for testing AI agent capabilities without requiring external datasets.

## Overview

This benchmark suite tests the same capabilities as state-of-the-art benchmarks (GAIA, SWE-bench, τ-bench) but is **fully self-contained** and **easy to run**.

## Benchmark Categories

### 1. **Reasoning** (`reasoning.json`)
Tests multi-step logical reasoning and problem-solving.

**Inspired by**: GAIA benchmark
**Difficulty levels**: Easy (3 tasks), Medium (3 tasks), Hard (3 tasks)
**Example tasks**:
- Classic logic puzzles (water jug problem)
- Mathematical reasoning (bat and ball problem)
- Physics problems (rope and pulley)
- Information theory (100 prisoners problem)

### 2. **Coding** (`coding.json`)
Tests code generation, algorithm implementation, and TypeScript proficiency.

**Inspired by**: SWE-bench
**Difficulty levels**: Easy (2 tasks), Medium (3 tasks), Hard (3 tasks)
**Example tasks**:
- Basic algorithms (palindrome check, array filtering)
- Data structures (LRU cache, event emitter)
- Advanced patterns (debounce, retry with backoff, dependency injection)

### 3. **Tool Use** (`tool-use.json`)
Tests ability to orchestrate multiple tools to accomplish tasks.

**Inspired by**: τ-bench
**Difficulty levels**: Easy (2 tasks), Medium (3 tasks), Hard (4 tasks)
**Example tasks**:
- File operations (create directories, read/write files)
- Codebase analysis (search files, grep patterns)
- Report generation (catalog tools, analyze dependencies)
- Complex analysis (code complexity metrics, test counting)

### 4. **Codebase Comprehension** (`codebase-comprehension.json`)
Tests understanding of the actual codebase architecture.

**Difficulty levels**: Easy (2 tasks), Medium (3 tasks), Hard (3 tasks)
**Example tasks**:
- Explain specific classes and their purposes
- Trace execution flows through the codebase
- Map dependency graphs
- Understand architectural patterns

### 5. **Bug Fixing** (`bug-fixing.json`)
Tests debugging, problem diagnosis, and code repair skills.

**Inspired by**: SWE-bench real-world issues
**Difficulty levels**: Easy (2 tasks), Medium (2 tasks), Hard (3 tasks)
**Example tasks**:
- Fix type errors
- Debug tool activation issues
- Fix race conditions
- Resolve memory leaks
- Optimize performance bottlenecks

### 6. **Multi-Step Planning** (`multi-step-planning.json`)
Tests long-horizon planning and complex feature implementation.

**Difficulty levels**: Medium (2 tasks), Hard (3 tasks)
**Example tasks**:
- Implement complete new features (20+ steps)
- Refactor large subsystems
- Build full-stack applications
- Migrate infrastructure components

## Prerequisites

Before running benchmarks, you need to set up your API keys:

1. **Create `.env` file** in the project root:
   ```bash
   cp .env.example .env
   ```

2. **Add your Google API key** to `.env`:
   ```bash
   GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
   ```

   Get your API key from: https://aistudio.google.com/app/apikey

3. **Build the benchmarks package**:
   ```bash
   cd packages/benchmarks
   npm run build
   ```

## Quick Start

### Method 1: Shell Script (Easiest)

```bash
cd packages/benchmarks

# Quick test (2 easy tasks per category)
./run-benchmarks.sh --quick

# Run specific category
./run-benchmarks.sh --category=reasoning

# Run with filters
./run-benchmarks.sh --category=coding --difficulty=easy --limit=3

# Run all benchmarks
./run-benchmarks.sh --category=all --output=my-results.json
```

### Method 2: Direct Node Execution

```bash
cd packages/benchmarks

# Build first
npm run build

# Run specific category
node dist/custom-runner.js reasoning

# Run with options
node dist/custom-runner.js coding --difficulty=easy --limit=2

# Run all
node dist/custom-runner.js all --output=results.json
```

### Method 3: NPM Scripts

Add to your root `package.json`:

```json
{
  "scripts": {
    "bench:quick": "cd packages/benchmarks && ./run-benchmarks.sh --quick",
    "bench:all": "cd packages/benchmarks && ./run-benchmarks.sh",
    "bench:reasoning": "cd packages/benchmarks && ./run-benchmarks.sh --category=reasoning",
    "bench:coding": "cd packages/benchmarks && ./run-benchmarks.sh --category=coding"
  }
}
```

Then run:
```bash
npm run bench:quick
```

## Command-Line Options

| Option | Description | Example |
|--------|-------------|---------|
| `--category=<name>` | Run specific category or 'all' | `--category=reasoning` |
| `--difficulty=<level>` | Filter by difficulty (easy\|medium\|hard) | `--difficulty=easy` |
| `--limit=<number>` | Limit tasks per category | `--limit=3` |
| `--workspace=<path>` | Workspace root path | `--workspace=/path/to/repo` |
| `--output=<file>` | Results output file | `--output=results.json` |
| `--quick` | Quick mode: 2 easy tasks per category | `--quick` |

## Output Format

Results are saved as JSON with detailed statistics:

```json
{
  "summary": {
    "totalTasks": 50,
    "successCount": 42,
    "failureCount": 8,
    "averageDuration": 2341.5,
    "byCategory": {
      "reasoning": {
        "total": 9,
        "success": 8,
        "avgDuration": 1500.2
      }
    },
    "byDifficulty": {
      "easy": { "total": 15, "success": 14, "avgScore": 0.93 },
      "medium": { "total": 20, "success": 16, "avgScore": 0.80 },
      "hard": { "total": 15, "success": 12, "avgScore": 0.72 }
    }
  },
  "results": [
    {
      "taskId": "reasoning-easy-001",
      "category": "reasoning",
      "difficulty": "easy",
      "success": true,
      "response": "5 minutes...",
      "durationMs": 1234,
      "toolsUsed": ["search_codebase"],
      "score": 1.0,
      "feedback": "Answer matches expected result"
    }
  ]
}
```

## Analyzing Results

```bash
# View summary
cat results.json | jq '.summary'

# View success rates by category
cat results.json | jq '.summary.byCategory'

# View success rates by difficulty
cat results.json | jq '.summary.byDifficulty'

# View failed tasks
cat results.json | jq '.results[] | select(.success == false)'

# View slow tasks (>5s)
cat results.json | jq '.results[] | select(.durationMs > 5000)'

# Get average score by difficulty
cat results.json | jq '.summary.byDifficulty | to_entries | map({difficulty: .key, avgScore: .value.avgScore})'
```

## Benchmark Statistics

| Category | Total Tasks | Easy | Medium | Hard |
|----------|-------------|------|--------|------|
| Reasoning | 8 | 2 | 3 | 3 |
| Coding | 8 | 2 | 3 | 3 |
| Tool Use | 9 | 2 | 3 | 4 |
| Codebase Comprehension | 8 | 2 | 3 | 3 |
| Bug Fixing | 7 | 2 | 2 | 3 |
| Multi-Step Planning | 5 | 0 | 2 | 3 |
| **Total** | **45** | **10** | **16** | **19** |

## Capabilities Tested

Based on research of state-of-the-art benchmarks:

### From GAIA
✅ Multi-step reasoning
✅ Logical problem solving
✅ Real-world knowledge application
✅ Tool coordination

### From SWE-bench
✅ Code comprehension
✅ Bug fixing and debugging
✅ Multi-file coordination
✅ Test-driven development
✅ System-level reasoning

### From τ-bench
✅ Sequential tool usage
✅ API integration
✅ Multi-turn task completion
✅ Information gathering

### Additional Capabilities
✅ Long-horizon planning (20+ steps)
✅ Error handling and recovery
✅ Performance optimization
✅ Architectural understanding
✅ Cross-package coordination

## Performance Targets

Based on current state-of-the-art agent performance:

| Difficulty | Human | Target Agent |
|------------|-------|--------------|
| Easy | 95-100% | 80-90% |
| Medium | 90-95% | 60-75% |
| Hard | 70-85% | 30-50% |

## Extending the Benchmark Suite

To add new tasks:

1. Edit the appropriate JSON file in `custom/`
2. Follow the task schema:
   ```json
   {
     "id": "category-difficulty-###",
     "category": "category-name",
     "difficulty": "easy|medium|hard",
     "prompt": "Task description for the agent",
     "expected_answer": "Expected response (optional)",
     "expected_concepts": ["concept1", "concept2"],
     "grading": {
       "type": "grading_type",
       "check_accuracy": true
     }
   }
   ```
3. Run the benchmarks to test

## Continuous Integration

Add to your CI pipeline:

```yaml
# .github/workflows/benchmark.yml
name: Benchmarks
on: [push, pull_request]

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build
      - name: Run benchmarks
        env:
          GOOGLE_GENERATIVE_AI_API_KEY: ${{ secrets.GOOGLE_API_KEY }}
        run: cd packages/benchmarks && ./run-benchmarks.sh --quick
      - uses: actions/upload-artifact@v3
        with:
          name: benchmark-results
          path: packages/benchmarks/benchmark-results-*.json
```

## Troubleshooting

### "API key missing"
Create a `.env` file in the project root (if it doesn't exist):
```bash
# From project root
cp .env.example .env
# Then edit .env and add your API key
```

Your `.env` file should contain:
```bash
GOOGLE_GENERATIVE_AI_API_KEY=your_actual_api_key_here
```

Get your API key from: https://aistudio.google.com/app/apikey

### "dist/custom-runner.js not found"
Build the benchmarks package:
```bash
cd packages/benchmarks
npm run build
```

### "Permission denied"
Make the script executable:
```bash
chmod +x run-benchmarks.sh
```

## Comparison with External Benchmarks

| Feature | GAIA | SWE-bench | τ-bench | Custom Suite |
|---------|------|-----------|---------|--------------|
| **Setup** | Download dataset | Download dataset | Configure APIs | ✅ No setup |
| **Size** | 466 tasks | 2,294 tasks | Varies | 45 tasks |
| **Difficulty** | 3 levels | Real bugs | 2 domains | 3 levels |
| **Self-contained** | ❌ | ❌ | ❌ | ✅ |
| **Easy to run** | ❌ | ❌ | ❌ | ✅ |
| **Codebase-specific** | ❌ | ❌ | ❌ | ✅ |

## Future Enhancements

- [ ] Add web interaction tasks (WebArena-style)
- [ ] Add multimodal tasks (image understanding)
- [ ] Add adversarial robustness tests
- [ ] Implement automatic grading for code tasks
- [ ] Add performance regression tracking
- [ ] Create visualization dashboard
- [ ] Add comparative benchmarking against other agents

## License

Same as parent project.
