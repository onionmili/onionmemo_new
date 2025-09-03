const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Function to generate safe filename
function generateSafeFilename(originalName) {
  // Remove .md extension for processing
  const nameWithoutExt = originalName.replace('.md', '');
  
  // Extract date if present at beginning
  const dateMatch = nameWithoutExt.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  
  if (dateMatch) {
    const date = dateMatch[1];
    const title = dateMatch[2];
    
    // Generate a short hash for the title
    const hash = crypto.createHash('md5').update(title).digest('hex').substring(0, 8);
    return `${date}-${hash}.md`;
  } else {
    // No date found, just generate hash
    const hash = crypto.createHash('md5').update(nameWithoutExt).digest('hex').substring(0, 8);
    return `${hash}.md`;
  }
}

function renameFiles() {
  const postsDir = path.join(__dirname, 'source', '_posts');
  const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
  
  console.log(`Found ${files.length} markdown files to check`);
  
  const renames = [];
  
  for (const file of files) {
    // Check if filename contains non-ASCII characters
    if (!/^[a-zA-Z0-9._-]+$/.test(file)) {
      const newName = generateSafeFilename(file);
      renames.push({
        old: file,
        new: newName
      });
    }
  }
  
  console.log(`Need to rename ${renames.length} files`);
  
  // Show what will be renamed
  renames.forEach(rename => {
    console.log(`  ${rename.old} -> ${rename.new}`);
  });
  
  if (renames.length > 0) {
    console.log('\\nProceed with renaming? This will modify your files.');
    console.log('Make sure you have a backup!');
    
    // For now, just perform the renames automatically
    for (const rename of renames) {
      const oldPath = path.join(postsDir, rename.old);
      const newPath = path.join(postsDir, rename.new);
      
      try {
        fs.renameSync(oldPath, newPath);
        console.log(`✅ Renamed: ${rename.old} -> ${rename.new}`);
      } catch (error) {
        console.log(`❌ Failed to rename ${rename.old}: ${error.message}`);
      }
    }
    
    console.log('\\nFile renaming completed!');
  }
}

renameFiles();