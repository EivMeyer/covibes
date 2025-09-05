# Pitch Compilation Guide

## How the Pitch Build System Works

The pitch uses a template-based multi-language build system:

1. **Source Template**: `pitch-template.html` - Contains placeholders like `{{hero.title}}`
2. **Translation Files**: `translations/en.json`, `translations/de.json`, `translations/no.json` - Contains all text content
3. **Output Files**: Generated in `output/` directory - Final HTML files with text replaced

## To Make Text Changes

**IMPORTANT**: Never edit the files in `output/` directly - they will be overwritten!

1. Edit the appropriate translation file in `translations/` folder:
   - `en.json` for English
   - `de.json` for German  
   - `no.json` for Norwegian

2. Run the build command:
   ```bash
   node build-translations.js
   ```

3. The updated HTML files will be generated in `output/` folder

## Output Files

After building, you'll find:
- `output/pitch-en.html` - English version with team section
- `output/pitch-en-noteam.html` - English version without team section
- `output/pitch-de.html` - German version with team section
- `output/pitch-de-noteam.html` - German version without team section
- `output/pitch-no.html` - Norwegian version with team section
- `output/pitch-no-noteam.html` - Norwegian version without team section

## Making the Pitch Sound Less AI-Generated

When editing translations, focus on:
- Using specific examples instead of generic claims
- Adding concrete numbers and metrics
- Removing corporate buzzwords
- Making headers conversational
- Adding personality and opinions
- Breaking perfect symmetry in comparisons

## File Structure

```
pitch/
├── pitch-template.html          # HTML template with {{placeholders}}
├── build-translations.js        # Build script
├── translations/               
│   ├── en.json                 # English text content
│   ├── de.json                 # German text content
│   └── no.json                 # Norwegian text content
├── output/                     
│   ├── pitch-en.html           # Generated English version
│   ├── pitch-de.html           # Generated German version
│   └── pitch-no.html           # Generated Norwegian version
└── CLAUDE.md                   # This file
```