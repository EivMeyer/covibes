# Voice Input for Agent Chat

## Overview
Voice-to-text capability is now available in the agent chat interface, allowing hands-free input using your browser's built-in speech recognition with persistent voice mode for continuous conversation.

## Features
- 🎙️ Toggle voice mode for continuous listening
- 🚀 Auto-send messages after transcription
- 🟢 Visual indicators: Green (listening), Red (recording)
- 📝 Automatic transcription and sending
- 🔄 Persistent mode - stays active between messages
- 🌐 Works in Chrome, Edge, Safari (with Web Speech API support)

## How to Use

### Voice Mode (Recommended)
1. Click the microphone button to enable voice mode
2. Allow microphone permission when prompted
3. Mic turns green - it's listening for your voice
4. Start speaking - mic turns red while recording
5. When you pause, message is automatically transcribed and sent
6. Continue speaking for the next message
7. Click mic again to disable voice mode

### Single Recording (Legacy)
1. Hold the microphone button
2. Speak your message
3. Release to stop recording
4. Text appears in input field for review

## Browser Support
- ✅ Chrome/Chromium (best support)
- ✅ Microsoft Edge
- ✅ Safari (macOS/iOS)
- ⚠️ Firefox (limited support)

## Technical Details
- Uses Web Speech API for instant recognition
- No server processing required - runs entirely in browser
- Fallback to Sherpa-ONNX WebAssembly when models are downloaded
- Privacy-first: audio never leaves your device

## Troubleshooting

### Microphone Permission Denied
- Check browser settings for microphone permissions
- Ensure the site has permission to use microphone
- Try refreshing the page after granting permission

### No Speech Detected
- Speak clearly and closer to the microphone
- Check microphone is working in system settings
- Try again with less background noise

### Browser Not Supported
- Update to latest browser version
- Try Chrome or Edge for best compatibility
- Voice input button will be disabled if unsupported

## Future Enhancements (Not in MVP)
- Streaming real-time transcription
- Multiple language support
- Custom vocabulary for technical terms
- Voice commands for agent control

## Privacy
- Audio is processed locally in your browser
- No audio data is sent to servers
- Microphone access is only active during recording