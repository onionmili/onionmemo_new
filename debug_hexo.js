const Hexo = require('hexo');
const path = require('path');
const fs = require('fs');

async function debugHexo() {
  try {
    const hexo = new Hexo(process.cwd(), { 
      config: path.join(process.cwd(), '_config.yml'),
      debug: true,
      safe: false,
      silent: false
    });
    
    console.log('Initializing Hexo...');
    await hexo.init();
    
    console.log('Hexo config summary:');
    console.log('- source_dir:', hexo.source_dir);
    console.log('- public_dir:', hexo.public_dir);
    console.log('- post_asset_folder:', hexo.config.post_asset_folder);
    console.log('- render_drafts:', hexo.config.render_drafts);
    console.log('- future:', hexo.config.future);
    
    console.log('\nLoading data...');
    await hexo.load();
    
    // Check posts before and after processing
    const posts = hexo.locals.get('posts');
    console.log(`Posts in locals: ${posts.length}`);
    
    // Check database directly
    const database = hexo.database;
    const Post = database.model('Post');
    const allPosts = Post.toArray();
    console.log(`Posts in database: ${allPosts.length}`);
    
    if (allPosts.length > 0) {
      console.log('First post in database:');
      const firstPost = allPosts[0];
      console.log('- _id:', firstPost._id);
      console.log('- title:', firstPost.title);
      console.log('- date:', firstPost.date);
      console.log('- published:', firstPost.published);
      console.log('- path:', firstPost.path);
    }
    
    // Let's try to manually process a single post
    console.log('\nTrying to manually process test-post.md...');
    const testPostPath = path.join(hexo.source_dir, '_posts', 'test-post.md');
    if (fs.existsSync(testPostPath)) {
      try {
        const content = fs.readFileSync(testPostPath, 'utf8');
        const Processor = hexo.extend.processor;
        console.log('Available processors:', Object.keys(Processor.store));
        
        // Check processor patterns
        console.log('Processor details:');
        Object.keys(Processor.store).forEach(key => {
          const processor = Processor.store[key];
          console.log(`Processor ${key}:`, processor.pattern.toString());
        });
        
        // Try to use front-matter parser directly
        const fm = require('hexo-front-matter');
        const parsed = fm.parse(content);
        console.log('Front matter parsed successfully:');
        console.log('- title:', parsed.title);
        console.log('- date:', parsed.date);
        console.log('- tags:', parsed.tags);
        console.log('- categories:', parsed.categories);
        
        // Check if the file path matches any processor pattern
        const relativePath = '_posts/test-post.md';
        console.log('Checking if file matches processor patterns:');
        Object.keys(Processor.store).forEach(key => {
          const processor = Processor.store[key];
          const matches = processor.pattern.test(relativePath);
          console.log(`  ${key}: ${matches}`);
        });
        
      } catch (parseError) {
        console.log('Manual parsing error:', parseError.message);
      }
    }
    
    await hexo.exit();
  } catch (error) {
    console.error('Debug failed:', error);
    process.exit(1);
  }
}

debugHexo();