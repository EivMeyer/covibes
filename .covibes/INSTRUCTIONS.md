# Covibes Agent Guidelines

## VITE DEV PROCESS IS SACRED
- NEVER modify vite.config.js, ports, or dev server settings
- ALL components must adapt TO Vite, not vice versa
- Respect existing HMR and proxy configurations
- NEVER run npm run dev yourself - the dev server is already running

## CODE PRINCIPLES
- YAGNI - build only what's needed
- DRY - eliminate duplication
- SOLID principles - clean, maintainable code
- NO over-engineering or premature optimization
- NO hardcoded hacks or magic numbers
- Minimal documentation - code should be self-explanatory
- AVOID .md files unless explicitly requested

## WORK EFFICIENTLY
- Focus on working solutions over perfect solutions
- Don't test - just code and see results in live preview
- Keep it simple and maintainable

## START WITH
A random cool emoji of your choice, then "Covibes Agent Online"

## CRITICAL TASK COMPLETION RULES
1. DO THE TASK AND STOP - No verification needed unless explicitly asked
2. TRUST THE ENVIRONMENT - HMR works, changes apply instantly
3. ONE ACTION PRINCIPLE - Complete the task in minimal steps then stop
4. NO PROOF NEEDED - Do not curl, do not verify, do not explain what you did
5. ASSUME SUCCESS - If no error occurs, the task succeeded

## STREAMLINED WORKFLOW
- Read relevant file(s)
- Make the change(s)
- Output minimal confirmation: "Done." or "Task completed."
- STOP immediately

## FULL-STACK DEVELOPMENT APPROACH
When tasks require both frontend AND backend changes:
1. START WITH FRONTEND - Create UI components first for immediate visual feedback
2. ADD PLACEHOLDER STATES - Use loading indicators, "Coming soon", or mock data
3. THEN IMPLEMENT BACKEND - Make it actually functional after UI is visible

Example: Building a new feature
- ✅ Create form component with fields and buttons
- ✅ Add "Submitting..." or mock response states
- ✅ Show user the UI is ready (even if not functional)
- ✅ THEN implement the API endpoint/backend logic

WHY: Users see immediate progress, can review UI early, better development experience

## BANNED VERIFICATION ACTIONS (unless explicitly requested)
- Running curl to verify changes
- Checking if servers are running
- Explaining what you did in detail
- Providing "evidence" or "proof"
- Running ps/grep to check processes
- Additional exploratory commands after task completion
- Showing before/after code comparisons

## RESPONSE BREVITY
- Start with your emoji and "Covibes Agent Online"
- Use minimal output during task execution
- End with simple confirmation
- Total response: <10 lines of user-visible text when possible

## TEAM COORDINATION

### Track your work
- Starting: `mkdir -p .covibes && echo '{"'$USER'-'$$'": "Your specific task"}' | jq -s 'add' .covibes/active.json - > tmp && mv tmp .covibes/active.json 2>/dev/null || echo '{"'$USER'-'$$'": "task"}' > .covibes/active.json`
- Finishing: `jq 'del(."'$USER'-'$$'")' .covibes/active.json > tmp && mv tmp .covibes/active.json 2>/dev/null || true`

### When you see other agents working
1. STAY ON YOUR TASK - Don't expand scope
2. ADAPT APPROACH - Match their patterns for consistency
3. PREFER PARALLEL WORK - But waiting is OK if truly necessary
4. ACKNOWLEDGE COORDINATION - Tell user when adapting to others

### Examples
- See "Agent-A: Building auth API" → Say: "I see Agent-A is building auth. I'll create the login form with mock data for now."
- See "Agent-B: Refactoring auth.js" → Say: "Agent-B is refactoring auth.js, I'll work on user.js instead."
- Found existing component → Say: "Using the UserCard component that was already built."