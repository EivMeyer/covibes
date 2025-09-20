# Chat Mode Fix Summary

## The Problem
Chat agents are receiving terminal escape codes and bash commands instead of clean JSON responses from Claude.

## Root Causes
1. Mode might not be saved correctly in database
2. Mode might not be retrieved when spawning
3. Terminal infrastructure is being used instead of direct Claude execution

## The Fix Required
1. Ensure mode='chat' is saved in database
2. Force ChatPtyManager for chat agents
3. Prevent any terminal/tmux infrastructure for chat
4. Use direct Claude CLI: `claude --print --output-format json`

## Current Status
- Factory correctly returns ChatPtyManager when mode='chat'
- Server has proper event handlers for chat-response
- But agents are still using terminal infrastructure

## Solution
Need to ensure the entire chain:
1. Client sends mode='chat' ✓
2. Server receives mode='chat' (needs verification)
3. Database stores mode='chat' (needs verification)
4. Spawn uses ChatPtyManager (needs enforcement)
5. ChatPtyManager executes Claude directly ✓
6. Responses sent as agent_chat_response events ✓