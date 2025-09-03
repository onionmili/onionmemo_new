const fs = require('fs');
const path = require('path');

function fixFrontMatter(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if it has front matter
    if (!content.startsWith('---')) {
      return false;
    }
    
    // Find the ending ---
    const firstEnd = content.indexOf('\n---\n', 4);
    const secondEnd = content.indexOf('\n---', firstEnd + 1);
    
    if (firstEnd === -1) {
      console.log(`No proper front matter ending found in ${path.basename(filePath)}`);
      return false;
    }
    
    // Extract front matter and content
    const frontMatter = content.substring(0, firstEnd + 1);
    const restContent = content.substring(secondEnd + 4);
    
    // Check for excessive blank lines in front matter
    const lines = frontMatter.split('\n');
    let hasExcessiveLines = false;
    let fixedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '' && i > 0 && i < lines.length - 1) {
        // Skip excessive blank lines in front matter
        if (!hasExcessiveLines) {
          hasExcessiveLines = true;
        }
        continue;
      }
      fixedLines.push(lines[i]);
    }
    
    if (hasExcessiveLines) {
      const newContent = fixedLines.join('\n') + '\n---' + restContent;
      fs.writeFileSync(filePath, newContent);
      console.log(`Fixed: ${path.basename(filePath)}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

const postsDir = path.join(__dirname, 'source', '_posts');
const files = fs.readdirSync(postsDir);
let fixedCount = 0;

files.forEach(file => {
  if (file.endsWith('.md')) {
    const filePath = path.join(postsDir, file);
    if (fixFrontMatter(filePath)) {
      fixedCount++;
    }
  }
});

console.log(`Fixed ${fixedCount} files`);