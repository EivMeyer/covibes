#!/usr/bin/env python3
"""
Claude hook for validating git operations.
This hook runs before git commands to ensure proper workflow.
"""

import sys
import os
import json
import subprocess
from pathlib import Path

def get_current_branch():
    """Get the current git branch name."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return None

def check_staging_workflow():
    """Ensure we're following the staging branch workflow."""
    current_branch = get_current_branch()
    
    if not current_branch:
        return True  # Not in a git repo, allow operation
    
    # Check if trying to commit to main/master
    if current_branch in ["main", "master"]:
        print("⚠️  Warning: You're on the main/master branch.")
        print("   Consider switching to staging branch:")
        print("   git checkout -b staging")
        print("   or: git checkout staging")
        # Don't block, just warn
        return True
    
    return True

def validate_commit_message(message):
    """Validate commit message follows conventions."""
    if not message:
        return True
    
    # Check for conventional commit format
    valid_prefixes = [
        "feat:", "fix:", "docs:", "style:", "refactor:",
        "test:", "chore:", "perf:", "ci:", "build:"
    ]
    
    has_valid_prefix = any(message.startswith(prefix) for prefix in valid_prefixes)
    
    if not has_valid_prefix:
        print("💡 Tip: Consider using conventional commit format:")
        print("   feat: for new features")
        print("   fix: for bug fixes")
        print("   test: for test changes")
        print("   docs: for documentation")
        # Don't block, just suggest
    
    return True

def main():
    """Main validation function."""
    # Get the command being run (if available)
    command = os.environ.get("CLAUDE_GIT_COMMAND", "")
    
    # Always check staging workflow
    check_staging_workflow()
    
    # If it's a commit, check the message
    if "commit" in command:
        commit_message = os.environ.get("CLAUDE_GIT_MESSAGE", "")
        validate_commit_message(commit_message)
    
    # Always return success (non-blocking)
    return 0

if __name__ == "__main__":
    sys.exit(main())