# Pitch Deck - Multi-Language Versions

## Available Versions

### With Team Section
- **English**: `pitch-en.html` 
- **Norwegian**: `pitch-no.html`
- **German**: `pitch-de.html`

### Without Team Section
- **English**: `pitch-en-noteam.html`
- **Norwegian**: `pitch-no-noteam.html` 
- **German**: `pitch-de-noteam.html`

## File Locations

### Development
- Template & Build System: `/pitch/`
- Generated Files: `/pitch/output/`
- Public Access: `/client/public/pitch/`

### URLs
- English: `http://localhost:3000/pitch/pitch-en.html`
- English (no team): `http://localhost:3000/pitch/pitch-en-noteam.html`
- Norwegian: `http://localhost:3000/pitch/pitch-no.html`
- Norwegian (no team): `http://localhost:3000/pitch/pitch-no-noteam.html`
- German: `http://localhost:3000/pitch/pitch-de.html`
- German (no team): `http://localhost:3000/pitch/pitch-de-noteam.html`

## How to Update

### 1. Edit Content
- Edit language files in `pitch/translations/`:
  - `en.json` - English content
  - `no.json` - Norwegian content
  - `de.json` - German content

### 2. Edit Structure
- Edit `pitch/pitch-template.html` for layout changes

### 3. Rebuild
```bash
cd pitch

# Generate all versions with team section
node build-translations.js

# Generate versions without team section
node remove-team-section.js

# Copy to public directory
cp output/*.html ../client/public/pitch/
```

## Language Details

### English (en)
- Currency: USD ($)
- Tone: Professional, direct
- Market: Global

### Norwegian (no)
- Currency: NOK (kr)
- Tone: Informal "du" form
- Market: Norwegian tech companies

### German (de)
- Currency: EUR (€)
- Tone: Formal "Sie" form
- Market: DACH region (Germany, Austria, Switzerland)

## File Sizes
- With team: ~73-77 KB
- Without team: ~69-73 KB (saves ~4-5 KB)

## Assets
- Founder images: `/pitch/output/founders/`
- Required for team section versions

## Export to PDF
Each HTML file can be directly printed to PDF from the browser:
1. Open the HTML file in browser
2. Press Ctrl/Cmd + P
3. Select "Save as PDF"
4. Adjust settings as needed