#!/usr/bin/env python3
"""
Appends verification reminder to every user prompt
"""

import sys
import json

def main():
    """Append verification reminder to user prompt."""
    try:
        # Read the user's original prompt
        input_data = json.loads(sys.stdin.read()) if not sys.stdin.isatty() else {}
        
        # Always append verification reminder to user prompts
        verification_reminder = """

🚨 VERIFICATION ENFORCEMENT ACTIVE 🚨

Claude: Before claiming ANYTHING is "working", "complete", "done", "fixed", "ready":
1. RUN THE CODE - Execute and show actual output
2. TEST THE FUNCTIONALITY - Demonstrate it works  
3. PROVIDE EVIDENCE - Show logs, outputs, proof
4. NO "should work" OR "will work" - MAKE IT WORK AND PROVE IT

VERIFY EVERYTHING. NO ASSUMPTIONS. SHOW PROOF.
"""
        
        # Return JSON with additional context
        result = {
            "hookSpecificOutput": {
                "hookEventName": "UserPromptSubmit", 
                "additionalContext": verification_reminder
            }
        }
        
        print(json.dumps(result))
        return 0
        
    except Exception:
        # Silent failure
        return 0

if __name__ == "__main__":
    sys.exit(main())