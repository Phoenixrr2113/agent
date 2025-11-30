# Complex Agent Test Prompt

This prompt is designed to test the full capabilities of the agent system, including:
- Multi-step planning and execution
- Tool usage (web search, file operations, calculations)
- Memory extraction and persistence
- Error handling and recovery
- Context management across multiple turns
- Autonomous decision-making

## Test Prompt

I need you to help me research and analyze programming language trends. Here's what I need:

**Phase 1: Research**
1. Search the web for the top 5 most popular programming languages in 2025
2. For each language, find:
   - Primary use cases
   - Key strengths
   - Major companies using it
   - Recent major updates or releases

**Phase 2: Analysis**
3. Compare the languages across these dimensions:
   - Performance characteristics
   - Learning curve for beginners
   - Ecosystem maturity (libraries, frameworks, tools)
   - Job market demand

**Phase 3: Personal Context**
4. Remember that I'm a backend developer with 8 years of Python experience
5. Remember that I'm interested in learning a new language for building high-performance APIs
6. Remember that I prefer statically-typed languages with good tooling

**Phase 4: Recommendation**
7. Based on the research and my personal context, recommend the top 2 languages I should learn
8. For each recommendation, explain:
   - Why it's a good fit for my background and goals
   - What resources I should use to learn it
   - What kind of projects I could build to practice

**Phase 5: Action Plan**
9. Create a 30-day learning plan for the top recommended language
10. Include specific milestones and practice projects

**Requirements:**
- Use web search to get current, accurate information
- Remember my personal context (backend dev, Python experience, API focus, static typing preference)
- Show your reasoning at each step
- If you encounter any errors or missing information, explain how you're handling it
- Break down the work into clear steps and execute them systematically

**Expected Behavior:**
- The agent should make multiple tool calls (web search)
- The agent should extract and store facts about my preferences and background
- The agent should synthesize information from multiple sources
- The agent should demonstrate multi-step planning
- The agent should provide a comprehensive, personalized response

## Success Criteria

✅ Agent uses web search tool multiple times
✅ Agent extracts and stores user preferences to memory
✅ Agent demonstrates multi-step planning (doesn't try to do everything in one step)
✅ Agent provides specific, actionable recommendations
✅ Agent handles the full workflow from research → analysis → recommendation → action plan
✅ Memory system captures key facts about user (backend dev, Python, APIs, static typing)
✅ Agent shows reasoning and explains decisions
✅ Response is comprehensive and well-structured

## Alternative Simpler Test Prompts

### Test 1: Memory + Multi-Step Planning
```
I'm planning a trip to Japan. I've never been there before, and I'm interested in:
- Traditional culture and temples
- Modern technology and gaming
- Good food (I'm vegetarian)
- I have a $3000 budget
- I can travel for 10 days

Help me plan this trip. Search for information about:
1. Best cities to visit for my interests
2. Estimated costs for accommodation and food
3. Must-see attractions
4. Vegetarian-friendly restaurants

Then create a day-by-day itinerary with budget breakdown.

Remember my preferences for future conversations.
```

### Test 2: Research + Analysis + Synthesis
```
I'm deciding between three cloud providers for my startup: AWS, Google Cloud, and Azure.

My requirements:
- Hosting a Node.js API
- PostgreSQL database
- ~10,000 users initially
- Budget: $500/month
- Need good developer experience

Research each provider and:
1. Compare pricing for my use case
2. Compare developer tools and documentation
3. Find reviews from other startups
4. Check for any current promotions or credits

Then recommend which one I should choose and why.

Remember my tech stack and budget constraints.
```

### Test 3: Error Handling + Recovery
```
I need to analyze the performance of my website. The URL is https://example-that-does-not-exist-12345.com

Try to:
1. Fetch the website
2. If that fails, explain what went wrong
3. Instead, explain what tools and metrics I should use to analyze website performance
4. Recommend 3 specific tools with their pros and cons
5. Create a checklist for website performance optimization

Remember that I'm interested in website performance optimization.
```

## Usage

To test the agent with this prompt:

```bash
# Clean the database first
rm -f memory.db

# Run chat mode
pnpm chat

# Paste the main test prompt or one of the alternatives
```

Then verify:
1. Check logs for tool usage
2. Check memory.db for extracted facts
3. Verify multi-step execution
4. Confirm comprehensive response

