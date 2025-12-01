# Tool Activation System - Integration Test

This document demonstrates the complete end-to-end flow of the tool activation system.

## Test Scenario

An agent needs to:
1. Start with basic tools (shell, plan, task_complete, ask_user)
2. Search for a specialized tool (e.g., web_search)
3. Activate the deferred tool
4. Use the newly activated tool

## Expected Flow

### Step 1: Agent starts with active tools only

**Active Tools (always available):**
- `shell` - Execute shell commands
- `plan` - Manage implementation plans
- `task_complete` - Mark task as complete
- `ask_user` - Ask user questions
- `search_tools` - Search for available tools
- `activate_tool` - Activate deferred tools

**Deferred Tools (require activation):**
- `web_search` - Search the web
- `fetch_page` - Fetch web page content
- `memory_*` - Memory operations (search, get_episodes, get_fact, get_entity, get_related)
- `validate` - Run validation checks
- `search_codebase` - Search code with RAG
- `grep_codebase` - Grep search in code

### Step 2: Agent searches for a tool

**Agent calls:** `search_tools`
```json
{
  "query": "web search",
  "limit": 5
}
```

**Response:**
```json
{
  "found": true,
  "count": 1,
  "searchType": "semantic",
  "tools": [
    {
      "name": "web_search",
      "description": "Search the web. Use 'brave' for general discovery, 'tavily' for research/fact-finding (includes AI summary).",
      "tags": [],
      "requiresActivation": true,
      "isActivated": false
    }
  ],
  "summary": {
    "activeTools": 0,
    "deferredTools": 1,
    "message": "Found 1 specialized tool(s) that require activation using 'activate_tool'."
  }
}
```

### Step 3: Agent tries to use deferred tool (FAILS)

**Agent calls:** `web_search`
```json
{
  "query": "latest news",
  "engine": "tavily"
}
```

**Response (ERROR):**
```json
{
  "error": "TOOL_NOT_ACTIVATED",
  "message": "Tool \"web_search\" requires activation before use.",
  "instruction": "Please use the 'activate_tool' tool with toolName=\"web_search\" to activate this tool, then try again.",
  "toolName": "web_search"
}
```

### Step 4: Agent activates the tool

**Agent calls:** `activate_tool`
```json
{
  "toolName": "web_search"
}
```

**Response (SUCCESS):**
```json
{
  "success": true,
  "message": "Tool \"web_search\" is now activated and ready to use",
  "tool": {
    "name": "web_search",
    "description": "Search the web. Use 'brave' for general discovery, 'tavily' for research/fact-finding (includes AI summary).",
    "tags": []
  },
  "activeToolsCount": 1
}
```

### Step 5: Agent uses the activated tool (SUCCESS)

**Agent calls:** `web_search`
```json
{
  "query": "latest news",
  "engine": "tavily"
}
```

**Response (SUCCESS):**
```json
{
  "tavily": [
    {
      "title": "News Article 1",
      "url": "https://example.com/article1",
      "content": "Article content...",
      "score": 0.95
    }
  ],
  "answer": "AI-generated summary of the news..."
}
```

## Test Cases

### Test Case 1: Activate Deferred Tool
- **Setup:** Tool is registered with `deferLoading: true`
- **Action:** Call `activate_tool` with tool name
- **Expected:** Tool becomes usable, activation manager tracks it
- **Status:** ✅ PASS

### Test Case 2: Try to Activate Active Tool
- **Setup:** Tool is registered with `deferLoading: false`
- **Action:** Call `activate_tool` with tool name
- **Expected:** Error message saying tool is already active
- **Status:** ✅ PASS

### Test Case 3: Use Deferred Tool Before Activation
- **Setup:** Tool is deferred and not activated
- **Action:** Call the deferred tool directly
- **Expected:** Error with activation instruction
- **Status:** ✅ PASS

### Test Case 4: Use Deferred Tool After Activation
- **Setup:** Tool is deferred and activated
- **Action:** Call the deferred tool directly
- **Expected:** Tool executes successfully
- **Status:** ✅ PASS

### Test Case 5: Search Shows Activation Status
- **Setup:** Registry has mix of active and deferred tools
- **Action:** Call `search_tools`
- **Expected:** Results show `requiresActivation` and `isActivated` flags
- **Status:** ✅ PASS

### Test Case 6: Multiple Activations
- **Setup:** Multiple deferred tools
- **Action:** Activate tools one by one
- **Expected:** Each activation works, manager tracks all
- **Status:** ✅ PASS

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Agent (ToolLoopAgent)                    │
│  - Starts with all tools (active + wrapped deferred)        │
│  - Can call any tool by name                                │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     Tool Registry                            │
│  - Stores tool metadata                                     │
│  - Tracks deferLoading flag                                 │
│  - Provides search functionality                            │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              ToolActivationManager                           │
│  - Tracks activated tools in Set                            │
│  - Creates wrapped deferred tools                           │
│  - Checks activation status on execution                    │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    ┌──────────┴──────────┐
                    ▼                     ▼
        ┌──────────────────┐    ┌──────────────────┐
        │  Active Tools    │    │ Deferred Tools   │
        │  (unwrapped)     │    │  (wrapped)       │
        └──────────────────┘    └──────────────────┘
        - shell                 - web_search
        - plan                  - fetch_page
        - task_complete         - memory_*
        - ask_user              - validate
        - search_tools          - *_codebase
        - activate_tool
```

## Benefits of This Design

1. **Zero Breaking Changes:** Agent sees all tools from the start
2. **Clear Feedback:** Deferred tools provide helpful error messages
3. **Lazy Loading:** Heavy tools only fully activate when needed
4. **Discoverable:** Search tool helps agent find what it needs
5. **Trackable:** Activation manager maintains state
6. **Testable:** Each component can be tested in isolation

## Migration from Old System

**Before (Broken):**
- All tools registered as active
- `activate_tool` updated a Set that was never read
- No actual activation occurred

**After (Working):**
- Tools split into active vs deferred
- Deferred tools wrapped with activation check
- `activate_tool` updates manager that controls execution
- Clear workflow: search → activate → use
