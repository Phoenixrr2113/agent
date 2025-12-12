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

Need to track state that changes over time?
├─ Yes: Is state complex (multiple interdependent pieces)?
│   ├─ Yes → Use a class
│   │   Examples: SessionManager, TaskManager, ThinkingEngine
│   └─ No → Use closure (factory function returning object)
│       Examples: createBM25Index, createEventBus
└─ No: Is it a collection of related operations?
    ├─ Yes → Return object literal from factory function
    │   Examples: createMemoryStore, createSearchEngine
    └─ No → Just export plain functions
        Examples: validatePath, cosineSimilarity, loadConfig