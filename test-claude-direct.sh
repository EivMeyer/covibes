#!/bin/bash

echo "🧪 Testing Claude directly with non-interactive mode..."

# Test Claude with print mode
claude --print --output-format text "Say hello and tell me what you can help with in one sentence"

echo ""
echo "✅ Test complete!"