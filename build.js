const Hexo = require('hexo');
const path = require('path');
const fs = require('fs');

async function build() {
  try {
    const hexo = new Hexo(process.cwd(), { 
      config: path.join(process.cwd(), '_config.yml'),
      debug: true,
      safe: false,
      silent: false
    });
    
    console.log('Initializing Hexo...');
    await hexo.init();
    
    console.log('Loading data...');
    console.log('Source directory:', hexo.source_dir);
    console.log('Post directory:', path.join(hexo.source_dir, '_posts'));
    
    // Check if source directory exists
    if (fs.existsSync(hexo.source_dir)) {
      console.log('✅ Source directory exists');
      const postsDir = path.join(hexo.source_dir, '_posts');
      if (fs.existsSync(postsDir)) {
        const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
        console.log(`✅ Posts directory exists with ${files.length} .md files`);
        console.log('Sample files:', files.slice(0, 5));
      } else {
        console.log('❌ Posts directory does not exist');
      }
    } else {
      console.log('❌ Source directory does not exist');
    }
    
    await hexo.load();
    
    const posts = hexo.locals.get('posts');
    console.log(`Found ${posts.length} posts`);
    
    // Check for any source files that were parsed
    const database = hexo.database;
    const sourceFiles = database.model('Post').toArray();
    console.log(`Database contains ${sourceFiles.length} post entries`);
    
    if (sourceFiles.length === 0) {
      console.log('No posts in database. Checking for parsing errors...');
      
      // Try to manually check a few files
      const testFiles = ['test-post.md', 'hello-world.md'];
      for (const file of testFiles) {
        try {
          const filePath = path.join(hexo.source_dir, '_posts', file);
          if (fs.existsSync(filePath)) {
            console.log(`Checking ${file}:`);
            const content = fs.readFileSync(filePath, 'utf8');
            console.log('First 200 chars:', JSON.stringify(content.substring(0, 200)));
          }
        } catch (err) {
          console.log(`Error reading ${file}:`, err.message);
        }
      }
    }
    
    if (posts.length > 0) {
      console.log('Sample posts:');
      posts.take(5).forEach(post => {
        console.log(`- ${post.title} (${post.date.format('YYYY-MM-DD')})`);
      });
    } else {
      console.log('No posts found in hexo.locals!');
    }
    
    console.log('Generating site...');
    await hexo.call('generate');
    
    console.log('Build completed successfully!');
    
    // Check generated files
    const publicFiles = fs.readdirSync('public');
    console.log('Generated files:', publicFiles.length);
    
    // Check for index.html
    if (fs.existsSync('public/index.html')) {
      console.log('✅ index.html generated successfully');
    } else {
      console.log('❌ index.html not found');
    }
    
    await hexo.exit();
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();