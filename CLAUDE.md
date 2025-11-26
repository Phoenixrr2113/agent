## CURRENT REFACTORING PLAN: Minimal Tool Architecture

### Goal
Replace 50+ MCP-based tools with 6 native tools:
1. **shell** - Bash execution (covers git, fs, grep, glob, etc.)
2. **web_search** - Brave + Tavily APIs
3. **fetch_page** - Parse web content with readability
4. **memory** - FalkorDB/Graphiti graph-based persistent memory
5. **ask_user** - Get user input (already exists)
6. **task_complete** - Signal completion (already exists)

### Tasks
- [ ] **Phase 1: Shell Tool**
  - [ ] Create `src/tools/shell.ts` with bash execution
  - [ ] Add safety measures (confirmation for destructive commands)
  - [ ] Test with git, filesystem, grep commands

- [ ] **Phase 2: Web Tools**
  - [ ] Create `src/tools/web-search.ts` with Brave + Tavily
  - [ ] Create `src/tools/fetch-page.ts` with readability parsing
  - [ ] Add API keys to .env.example
  - [ ] Test search and page fetching

- [ ] **Phase 3: Memory**
  - [ ] Research FalkorDB Node.js client
  - [ ] Create `src/tools/memory.ts` with graph operations
  - [ ] Docker setup for FalkorDB
  - [ ] Test entity creation, relationships, queries

- [ ] **Phase 4: Cleanup**
  - [ ] Remove MCP initialization from `src/application/initialization.ts`
  - [ ] Remove MCP client code
  - [ ] Update tool registration in agent runtime
  - [ ] Remove unused dependencies

- [ ] **Phase 5: Integration**
  - [ ] Update system prompt for new tools
  - [ ] Update agent runtime to use native tools
  - [ ] End-to-end testing
  - [ ] Update documentation

### API Keys Needed
- `BRAVE_API_KEY` - https://brave.com/search/api/
- `TAVILY_API_KEY` - https://tavily.com/
- FalkorDB runs locally via Docker

---

## PROCESS (FOLLOW EXACTLY)
1. **UNDERSTAND**: Read request fully, ask if uncertain
2. **PLAN**: For complex tasks, create a plan:
   ```md
   ## Task: [description]
   - [ ] Step 1: Search existing patterns 
   - [ ] Step 2: Read related files
   - [ ] Step 3: Read documentation understand the libraries been used. (Versions changes all the time)
   - [ ] Step 4: Implement changes
   ```
3. **RESEARCH**:
   - Search codebase for similar code
   - Read ALL related files completely
4. **IMPLEMENT**:
   - ONE change at a time
   - Follow existing patterns
5. **VERIFY**:
   - Unit Tests are written for functionality implemented 
   - No TS errors
   - Functionality preserved
   - No Simulated functionality
   - No mock data in the code
   - No comments
   - No "simplified" logic or functionality. Don't be lazy. Write the code as if it was for production.
   - No partial implementation
## NEVER
- Create summary documents. it wastes tokens.
- Skip planning for complex tasks
- Skip writing unit tests for your changes
- Make assumptions - always verify everything
- Implement partially
- Change unrelated code
- Write any code for backwards compatibility unless I tell you to.
- Remove pre-existing functionality
- Use mock data
- Include dates and year when search the web
- Write a summary of changes in .md files
- Simulate functionality
- Ignore breaking changes - warn first
- Write code to simulate any functionality
- Write "In a real system, we would..." or "In a production..., we would...". everything we work on should be production ready so treat it as such and respect the codebase as if it was production.
## Critical
NO deviations from plan, feature isolation
- We are solving for the future, not the past. no backwards compatibility hacks/changes
