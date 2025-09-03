const Hexo = require('hexo');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Function to generate safe ID for posts
function generateSafeId(filename) {
  // Create a hash-based ID that's CUID-safe
  const hash = crypto.createHash('sha256').update(filename).digest('hex').substring(0, 24);
  return 'c' + hash; // Add 'c' prefix to make it CUID-like
}

async function safeBuild() {
  try {
    const hexo = new Hexo(process.cwd(), { 
      config: path.join(process.cwd(), '_config.yml'),
      debug: false,
      safe: false,
      silent: false
    });
    
    console.log('Initializing Hexo...');
    await hexo.init();
    
    // Override the post processor to handle Chinese filenames
    console.log('Setting up custom post processor...');
    
    const fm = require('hexo-front-matter');
    const { slugize } = require('hexo-util');
    
    // Remove existing post processors to avoid conflicts
    hexo.extend.processor.store = [];
    
    // Add our custom post processor
    hexo.extend.processor.register('_posts/*.md', function(file) {
      const Post = this.model('Post');
      const path = file.path;
      const data = file.params;
      
      if (file.type === 'skip') return;
      
      if (file.type === 'delete') {
        const doc = Post.findOne({source: path});
        if (doc) {
          return doc.remove();
        }
        return;
      }
      
      return Promise.resolve(file.read()).then(content => {
        if (!content) return;
        
        const parsed = fm.parse(content);
        const config = this.config;
        
        // Generate safe ID
        const safeId = generateSafeId(path);
        
        // Process slug
        let slug = parsed.slug;
        if (!slug) {
          slug = path.substring(path.lastIndexOf('/') + 1, path.lastIndexOf('.'));
          slug = slugize(slug, {transform: 1});
        }
        
        const meta = {
          _id: safeId,
          title: parsed.title || slug,
          date: parsed.date ? new Date(parsed.date) : new Date(),
          updated: parsed.updated ? new Date(parsed.updated) : new Date(),
          comments: parsed.comments !== false,
          layout: parsed.layout || config.default_layout,
          content: parsed._content || '',
          source: path,
          slug: slug,
          photos: parsed.photos || [],
          link: parsed.link || '',
          raw: content,
          published: parsed.published !== false,
          tags: parsed.tags || [],
          categories: parsed.categories || []
        };
        
        // Create post path
        const date = meta.date;
        meta.path = config.permalink
          .replace(/:year/g, date.getFullYear())
          .replace(/:month/g, String(date.getMonth() + 1).padStart(2, '0'))
          .replace(/:day/g, String(date.getDate()).padStart(2, '0'))
          .replace(/:title/g, meta.slug);
        
        console.log(`Processing: ${meta.title} (${meta.slug})`);
        
        const doc = Post.findById(safeId);
        if (doc) {
          return doc.replace(meta);
        } else {
          return Post.insert(meta);
        }
      });
    });
    
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
      
      // Show a snippet of the index file
      const indexContent = fs.readFileSync('public/index.html', 'utf8');
      const hasArticles = indexContent.includes('<article') || indexContent.includes('class="post');
      console.log(`✅ Index contains articles: ${hasArticles}`);
    } else {
      console.log('❌ index.html not found');
    }
    
    await hexo.exit();
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

safeBuild();