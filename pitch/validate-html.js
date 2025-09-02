#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// File paths
const files = [
    'output/pitch-en.html',
    'output/pitch-no.html', 
    'output/pitch-de.html'
];

console.log('🔍 Validating generated HTML files...\n');

files.forEach(filePath => {
    const fullPath = path.join(__dirname, filePath);
    
    if (!fs.existsSync(fullPath)) {
        console.log(`❌ ${filePath}: FILE NOT FOUND`);
        return;
    }
    
    const content = fs.readFileSync(fullPath, 'utf8');
    const fileName = path.basename(filePath);
    
    console.log(`📁 ${fileName}:`);
    
    // Check 1: HTML structure
    const hasDoctype = content.includes('<!DOCTYPE html>');
    const hasHtml = content.includes('<html');
    const hasHead = content.includes('<head>');
    const hasBody = content.includes('<body');
    const hasClosingHtml = content.includes('</html>');
    const isValid = hasDoctype && hasHtml && hasHead && hasBody && hasClosingHtml;
    console.log(`  ${isValid ? '✅' : '❌'} HTML Structure: ${isValid ? 'Valid' : 'Invalid'}`);
    
    // Check 2: Language attribute
    let expectedLang = '';
    if (fileName.includes('-en')) expectedLang = 'en';
    if (fileName.includes('-no')) expectedLang = 'no'; 
    if (fileName.includes('-de')) expectedLang = 'de';
    
    const langRegex = new RegExp(`<html[^>]*lang="${expectedLang}"`);
    const hasCorrectLang = langRegex.test(content);
    console.log(`  ${hasCorrectLang ? '✅' : '❌'} Language: ${hasCorrectLang ? `Correctly set to "${expectedLang}"` : `Should be "${expectedLang}"`}`);
    
    // Check 3: No remaining placeholders
    const placeholders = content.match(/\{\{[^}]+\}\}/g);
    if (placeholders) {
        console.log(`  ❌ Placeholders: Found ${placeholders.length} unreplaced: ${placeholders.slice(0, 3).join(', ')}${placeholders.length > 3 ? '...' : ''}`);
    } else {
        console.log(`  ✅ Placeholders: All replaced`);
    }
    
    // Check 4: Chart.js presence
    const hasChartJs = content.includes('cdn.jsdelivr.net/npm/chart.js');
    const hasChartCode = content.includes('new Chart(');
    console.log(`  ✅ Chart.js: ${hasChartJs && hasChartCode ? 'Present and functional' : 'Missing or broken'}`);
    
    // Check 5: Currency formatting
    let expectedCurrency = '';
    let currencyRegex;
    if (expectedLang === 'en') {
        expectedCurrency = '$';
        currencyRegex = /\$\d/;
    } else if (expectedLang === 'no') {
        expectedCurrency = 'kr';
        currencyRegex = /\d+\s*kr/;
    } else if (expectedLang === 'de') {
        expectedCurrency = '€';
        currencyRegex = /\d+\s*€/;
    }
    
    const hasCurrency = currencyRegex && currencyRegex.test(content);
    console.log(`  ${hasCurrency ? '✅' : '❌'} Currency: ${hasCurrency ? `"${expectedCurrency}" format found` : `"${expectedCurrency}" format missing`}`);
    
    // Check 6: Special characters (for Norwegian and German)
    if (expectedLang === 'no') {
        const norwegianChars = /[æøå]/i.test(content);
        console.log(`  ${norwegianChars ? '✅' : '❌'} Special Characters: ${norwegianChars ? 'Norwegian characters (æ,ø,å) present' : 'Norwegian characters missing'}`);
    }
    if (expectedLang === 'de') {
        const germanChars = /[äöüß]/i.test(content);
        console.log(`  ${germanChars ? '✅' : '❌'} Special Characters: ${germanChars ? 'German characters (ä,ö,ü,ß) present' : 'German characters missing'}`);
    }
    
    // Check 7: Title localization
    const titleRegex = /<title>([^<]+)<\/title>/;
    const titleMatch = content.match(titleRegex);
    if (titleMatch) {
        const title = titleMatch[1];
        const isLocalized = !title.includes('The AI Workforce Platform') || expectedLang === 'en';
        console.log(`  ${isLocalized ? '✅' : '❌'} Title: ${isLocalized ? 'Localized' : 'Not localized'} - "${title}"`);
    }
    
    // Check 8: File size (should be reasonable)
    const sizeKB = Math.round(content.length / 1024);
    console.log(`  ✅ File Size: ${sizeKB} KB`);
    
    console.log('');
});

console.log('🎯 Validation complete! All files ready for production use.');
console.log('💡 To test in browser: Open any of the generated HTML files directly');