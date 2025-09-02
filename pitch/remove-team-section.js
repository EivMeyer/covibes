#!/usr/bin/env node

/**
 * Remove Team Section Script
 * 
 * This script creates versions of the pitch deck HTML files without the team section.
 * It reads the generated HTML files and removes the team section, saving new versions.
 * 
 * Usage: node pitch/remove-team-section.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const OUTPUT_DIR = path.join(__dirname, 'output');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function processFile(inputFile) {
  const baseName = path.basename(inputFile, '.html');
  const outputFile = path.join(OUTPUT_DIR, `${baseName}-noteam.html`);
  
  try {
    // Read the HTML file
    let html = fs.readFileSync(inputFile, 'utf8');
    
    // Remove the team section
    // The team section starts with <section id="team" and ends with </section>
    const teamSectionRegex = /<section\s+id="team"[^>]*>[\s\S]*?<\/section>/gi;
    
    // Check if team section exists
    if (teamSectionRegex.test(html)) {
      // Reset regex lastIndex
      teamSectionRegex.lastIndex = 0;
      
      // Remove the team section
      html = html.replace(teamSectionRegex, '');
      
      // Also remove any navigation links to the team section
      html = html.replace(/<a[^>]*href="#team"[^>]*>.*?<\/a>/gi, '');
      
      // Write the modified HTML
      fs.writeFileSync(outputFile, html, 'utf8');
      
      const fileSize = (fs.statSync(outputFile).size / 1024).toFixed(1);
      log(`✅ Created: ${path.basename(outputFile)} (${fileSize} KB)`, colors.green);
      
      return true;
    } else {
      log(`⚠️  No team section found in ${path.basename(inputFile)}`, colors.yellow);
      return false;
    }
  } catch (error) {
    log(`❌ Error processing ${path.basename(inputFile)}: ${error.message}`, colors.red);
    return false;
  }
}

function main() {
  log('🚀 Starting team section removal process...', colors.cyan);
  
  // Check if output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    log(`❌ Output directory not found: ${OUTPUT_DIR}`, colors.red);
    log('   Please run build-translations.js first.', colors.yellow);
    process.exit(1);
  }
  
  // Find all pitch HTML files (excluding -noteam versions)
  const htmlFiles = fs.readdirSync(OUTPUT_DIR)
    .filter(file => file.startsWith('pitch-') && file.endsWith('.html') && !file.includes('-noteam'))
    .map(file => path.join(OUTPUT_DIR, file));
  
  if (htmlFiles.length === 0) {
    log('❌ No pitch HTML files found in output directory', colors.red);
    log('   Please run build-translations.js first.', colors.yellow);
    process.exit(1);
  }
  
  log(`📄 Found ${htmlFiles.length} HTML file(s) to process`, colors.cyan);
  
  let successCount = 0;
  
  // Process each file
  htmlFiles.forEach(file => {
    if (processFile(file)) {
      successCount++;
    }
  });
  
  // Summary
  console.log('');
  if (successCount === htmlFiles.length) {
    log(`🎉 Successfully created ${successCount} no-team version(s)!`, colors.green);
  } else if (successCount > 0) {
    log(`⚠️  Created ${successCount} of ${htmlFiles.length} no-team versions`, colors.yellow);
  } else {
    log('❌ No files were processed successfully', colors.red);
  }
  
  // List generated files
  if (successCount > 0) {
    log('📋 Generated files:', colors.cyan);
    const noteamFiles = fs.readdirSync(OUTPUT_DIR)
      .filter(file => file.includes('-noteam.html'));
    
    noteamFiles.forEach(file => {
      const filePath = path.join(OUTPUT_DIR, file);
      const fileSize = (fs.statSync(filePath).size / 1024).toFixed(1);
      console.log(`   • ${file} (${fileSize} KB)`);
    });
  }
}

// Run the script
main();