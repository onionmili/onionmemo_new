const Hexo = require('hexo');
const path = require('path');
const fs = require('fs');

async function build() {
  try {
    const hexo = new Hexo(process.cwd(), { 
      config: path.join(process.cwd(), '_config.yml'),
      debug: false,
      safe: false,
      silent: false
    });
    
    console.log('Initializing Hexo...');
    await hexo.init();
    
    console.log('Loading data...');
    await hexo.load();
    
    const posts = hexo.locals.get('posts');
    console.log(`Found ${posts.length} posts`);
    
    if (posts.length > 0) {
      console.log('Sample posts:');
      posts.take(5).forEach(post => {
        console.log(`- ${post.title} (${post.date.format('YYYY-MM-DD')})`);
      });
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