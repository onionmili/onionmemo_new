const Hexo = require('hexo');
const path = require('path');
const fs = require('fs');

async function fixHexo() {
  try {
    const hexo = new Hexo(process.cwd(), { 
      config: path.join(process.cwd(), '_config.yml'),
      debug: true,
      safe: false,
      silent: false
    });
    
    console.log('Initializing Hexo...');
    await hexo.init();
    
    // Before loading, let's try to force a clean slate
    const database = hexo.database;
    console.log('Clearing database...');
    database.model('Post').remove({});
    database.model('Page').remove({});
    database.model('Category').remove({});
    database.model('Tag').remove({});
    
    console.log('Loading data...');
    await hexo.load();
    
    // Check posts
    const posts = hexo.locals.get('posts');
    console.log(`Posts found: ${posts.length}`);
    
    // If still no posts, try to manually process them
    if (posts.length === 0) {
      console.log('Manually processing posts...');
      const postsDir = path.join(hexo.source_dir, '_posts');
      const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
      console.log(`Found ${files.length} markdown files`);
      
      // Try to manually process using Hexo's post processor
      const Post = hexo.model('Post');
      const fm = require('hexo-front-matter');
      
      for (let i = 0; i < Math.min(5, files.length); i++) { // Process first 5 files as a test
        const file = files[i];
        try {
          const filePath = path.join(postsDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const parsed = fm.parse(content);
          
          console.log(`Processing ${file}:`, parsed.title);
          
          // Create post data manually
          const postData = {
            _id: file.replace('.md', ''),
            title: parsed.title,
            date: new Date(parsed.date || Date.now()),
            content: parsed._content,
            source: `_posts/${file}`,
            slug: file.replace('.md', ''),
            published: true,
            path: file.replace('.md', '.html'),
            tags: parsed.tags || [],
            categories: parsed.categories || []
          };
          
          console.log('Creating post with data:', {
            title: postData.title,
            date: postData.date,
            slug: postData.slug
          });
          
          // Insert into database
          const post = Post.insert(postData);
          console.log('Post inserted:', post._id);
          
        } catch (fileError) {
          console.log(`Error processing ${file}:`, fileError.message);
        }
      }
      
      // Check posts again
      const postsAfter = hexo.locals.get('posts');
      console.log(`Posts after manual processing: ${postsAfter.length}`);
    }
    
    console.log('Generating site...');
    await hexo.call('generate');
    
    console.log('Build completed!');
    
    // Check generated files
    const publicFiles = fs.readdirSync('public');
    console.log('Generated files:', publicFiles.length);
    
    if (fs.existsSync('public/index.html')) {
      console.log('✅ index.html generated successfully');
    } else {
      console.log('❌ index.html not found');
    }
    
    await hexo.exit();
  } catch (error) {
    console.error('Fix failed:', error);
    process.exit(1);
  }
}

fixHexo();