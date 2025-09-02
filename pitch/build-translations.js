#!/usr/bin/env node

/**
 * Localized HTML Builder
 * 
 * This script generates localized HTML files from a template and translation JSON files.
 * It reads pitch-template.html and replaces all {{placeholders}} with values from
 * translation files, handling nested JSON structures and HTML content preservation.
 * 
 * Requirements:
 * - pitch/pitch-template.html (template file)
 * - pitch/translations/*.json (language files)
 * - Node.js built-in modules only (fs, path)
 * 
 * Usage: node pitch/build-translations.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const TEMPLATE_FILE = path.join(__dirname, 'pitch-template.html');
const TRANSLATIONS_DIR = path.join(__dirname, 'translations');
const OUTPUT_DIR = path.join(__dirname, 'output');

/**
 * Get nested property value from object using dot notation
 * @param {Object} obj - The object to traverse
 * @param {string} path - The dot-separated path (e.g., "meta.title")
 * @returns {*} The value at the path or undefined if not found
 */
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
}

/**
 * Replace all placeholders in template with translation values
 * @param {string} template - The HTML template string
 * @param {Object} translations - The translation object
 * @returns {string} The processed HTML with replacements
 */
function replacePlaceholders(template, translations) {
    let result = template;
    
    // Create an enhanced translations object with fallbacks
    const enhancedTranslations = { ...translations };
    
    // Handle common fallbacks
    if (!enhancedTranslations.meta) {
        enhancedTranslations.meta = {};
    }
    
    // If meta.lang is missing but top-level lang exists, use it as fallback
    if (!enhancedTranslations.meta.lang && enhancedTranslations.lang) {
        enhancedTranslations.meta.lang = enhancedTranslations.lang;
    }
    
    // Find all placeholders in the format {{key.nested.path}}
    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    let match;
    const missingKeys = new Set();
    
    while ((match = placeholderRegex.exec(template)) !== null) {
        const placeholder = match[0]; // Full placeholder: {{key.path}}
        const keyPath = match[1].trim(); // Just the key path: key.path
        
        // Get the value from the enhanced translation object
        const value = getNestedValue(enhancedTranslations, keyPath);
        
        if (value !== undefined) {
            // Replace the placeholder with the translation value
            // Use a global replace to handle multiple occurrences of the same placeholder
            const globalPlaceholderRegex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            result = result.replace(globalPlaceholderRegex, value);
        } else {
            // Track missing keys for warning
            missingKeys.add(keyPath);
        }
    }
    
    // Warn about missing translation keys
    if (missingKeys.size > 0) {
        console.warn(`⚠️  Warning: Missing translation keys for ${translations.lang || 'unknown'}: ${Array.from(missingKeys).join(', ')}`);
    }
    
    return result;
}

/**
 * Process a single language file and generate HTML output
 * @param {string} langFile - Path to the language JSON file
 * @param {string} template - The HTML template string
 */
function processLanguage(langFile, template) {
    try {
        console.log(`📖 Reading translation file: ${path.basename(langFile)}`);
        
        // Read and parse the translation file
        const translationData = fs.readFileSync(langFile, 'utf8');
        
        if (!translationData.trim()) {
            throw new Error(`Translation file is empty: ${path.basename(langFile)}`);
        }
        
        const translations = JSON.parse(translationData);
        
        // Validate that we have a proper translation object
        if (!translations || typeof translations !== 'object') {
            throw new Error(`Invalid translation format in ${path.basename(langFile)} - expected JSON object`);
        }
        
        // Get language code from the translation file or filename
        const langCode = translations.lang || translations.meta?.lang || path.basename(langFile, '.json');
        
        if (!langCode) {
            throw new Error(`Could not determine language code for ${path.basename(langFile)}`);
        }
        
        console.log(`🔧 Processing language: ${langCode}`);
        
        // Replace placeholders in the template
        const processedHtml = replacePlaceholders(template, translations);
        
        // Check if we actually replaced anything meaningful
        const remainingPlaceholders = (processedHtml.match(/\{\{[^}]+\}\}/g) || []).length;
        const totalPlaceholders = (template.match(/\{\{[^}]+\}\}/g) || []).length;
        const replacedCount = totalPlaceholders - remainingPlaceholders;
        
        if (replacedCount > 0) {
            console.log(`   🔄 Replaced ${replacedCount}/${totalPlaceholders} placeholders`);
        }
        
        // Generate output filename
        const outputFile = path.join(OUTPUT_DIR, `pitch-${langCode}.html`);
        
        // Write the processed HTML to output file
        fs.writeFileSync(outputFile, processedHtml, 'utf8');
        
        console.log(`✅ Generated: ${path.basename(outputFile)}`);
        
    } catch (error) {
        if (error instanceof SyntaxError) {
            console.error(`❌ JSON parsing error in ${path.basename(langFile)}: ${error.message}`);
        } else {
            console.error(`❌ Error processing ${path.basename(langFile)}: ${error.message}`);
        }
        process.exitCode = 1;
    }
}

/**
 * Main build function
 */
function build() {
    console.log('🚀 Starting localized HTML build process...\n');
    
    try {
        // Check if template file exists
        if (!fs.existsSync(TEMPLATE_FILE)) {
            throw new Error(`Template file not found: ${TEMPLATE_FILE}`);
        }
        
        // Check if translations directory exists
        if (!fs.existsSync(TRANSLATIONS_DIR)) {
            throw new Error(`Translations directory not found: ${TRANSLATIONS_DIR}`);
        }
        
        // Create output directory if it doesn't exist
        if (!fs.existsSync(OUTPUT_DIR)) {
            console.log(`📁 Creating output directory: ${OUTPUT_DIR}`);
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }
        
        // Read the template file
        console.log(`📄 Reading template: ${path.basename(TEMPLATE_FILE)}`);
        const template = fs.readFileSync(TEMPLATE_FILE, 'utf8');
        
        // Find all JSON files in the translations directory
        const translationFiles = fs.readdirSync(TRANSLATIONS_DIR)
            .filter(file => file.endsWith('.json'))
            .map(file => path.join(TRANSLATIONS_DIR, file));
        
        if (translationFiles.length === 0) {
            throw new Error(`No JSON translation files found in: ${TRANSLATIONS_DIR}`);
        }
        
        console.log(`📚 Found ${translationFiles.length} translation file(s)\n`);
        
        // Process each translation file
        translationFiles.forEach(langFile => {
            processLanguage(langFile, template);
        });
        
        console.log(`\n🎉 Build completed successfully!`);
        console.log(`📂 Output files generated in: ${OUTPUT_DIR}`);
        
        // List generated files
        const outputFiles = fs.readdirSync(OUTPUT_DIR)
            .filter(file => file.startsWith('pitch-') && file.endsWith('.html'));
        
        console.log(`📋 Generated files:`);
        outputFiles.forEach(file => {
            const filePath = path.join(OUTPUT_DIR, file);
            const stats = fs.statSync(filePath);
            const size = (stats.size / 1024).toFixed(1);
            console.log(`   • ${file} (${size} KB)`);
        });
        
    } catch (error) {
        console.error(`\n❌ Build failed: ${error.message}`);
        process.exitCode = 1;
    }
}

// Handle unhandled errors gracefully
process.on('uncaughtException', (error) => {
    console.error(`\n💥 Unexpected error: ${error.message}`);
    process.exitCode = 1;
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(`\n💥 Unhandled promise rejection: ${reason}`);
    process.exitCode = 1;
});

// Run the build process
build();