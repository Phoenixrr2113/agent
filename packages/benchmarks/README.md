# @agent/benchmarks

Benchmark adapters for testing the agent against HAL, τ-bench, and other evaluation harnesses.

## Installation

```bash
pnpm install
pnpm build
```

## Usage

### CLI

```bash
# Run HAL-style tasks
pnpm agent-benchmark hal --task-file tasks.json --output results.json

# Run τ-bench evaluation
pnpm agent-benchmark tau-bench --domain retail --task-file tasks.json

# Show available benchmarks
pnpm agent-benchmark info
```

### Programmatic API

```typescript
import { run as halRun, createTauBenchAgent } from '@agent/benchmarks';

// HAL adapter
const result = await halRun('task-001', {
  id: 'task-001',
  prompt: 'Solve this problem...',
});

// τ-bench adapter
const agent = await createTauBenchAgent({ domain: 'retail' });
const action = await agent(messages, tools);
```

## HAL Harness Integration

To integrate with the [HAL Harness](https://github.com/princeton-pli/hal-harness):

1. Create a Python wrapper that calls this adapter via subprocess or HTTP
2. Point HAL to your wrapper as the agent directory

Example Python wrapper (`agents/universal-agent/main.py`):

```python
import subprocess
import json

def run(task_id: str, task: dict, **agent_args):
    result = subprocess.run(
        ['npx', 'agent-benchmark', 'hal', '--task-file', '-'],
        input=json.dumps([{**task, 'id': task_id}]),
        capture_output=True,
        text=True
    )
    return json.loads(result.stdout)
```

## Task File Formats

### HAL Format

```json
[
  {
    "id": "task-001",
    "prompt": "What is 2 + 2?",
    "context": {}
  }
]
```

### τ-bench Format

```json
[
  {
    "id": "task-001",
    "messages": [
      {"role": "user", "content": "I want to return my order"}
    ],
    "tools": [
      {
        "name": "get_order_details",
        "description": "Get details of an order",
        "parameters": {"order_id": {"type": "string"}}
      }
    ]
  }
]
```

## Supported Benchmarks

| Benchmark | Status | Description |
|-----------|--------|-------------|
| HAL | ✅ Ready | Holistic Agent Leaderboard adapter |
| τ-bench | ✅ Ready | Customer service evaluation |
| GAIA | 🔄 Via HAL | General AI assistant tasks |
| SWE-bench | 🔄 Via HAL | Software engineering tasks |

