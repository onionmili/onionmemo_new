const Hexo = require('hexo');
const path = require('path');
const fs = require('fs');

async function deepDebug() {
  try {
    const hexo = new Hexo(process.cwd(), { 
      config: path.join(process.cwd(), '_config.yml'),
      debug: true,
      safe: false,
      silent: false
    });
    
    console.log('=== DEEP DEBUG SESSION ===');
    console.log('Working directory:', process.cwd());
    console.log('Config file:', path.join(process.cwd(), '_config.yml'));
    
    console.log('\n1. Initializing Hexo...');
    await hexo.init();
    
    console.log('\n2. Checking processors...');
    const processors = hexo.extend.processor.list();
    console.log('Number of processors:', processors.length);
    processors.forEach((processor, i) => {
      console.log(`Processor ${i}:`, processor.pattern.toString());
    });
    
    console.log('\n3. Manual file check...');
    const postsDir = path.join(hexo.source_dir, '_posts');
    console.log('Posts directory:', postsDir);
    console.log('Posts directory exists:', fs.existsSync(postsDir));
    
    if (fs.existsSync(postsDir)) {
      const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
      console.log(`Found ${files.length} markdown files`);
      
      // Test first few files
      const testFiles = files.slice(0, 3);
      console.log('Testing files:', testFiles);
      
      for (const file of testFiles) {
        const filePath = path.join(postsDir, file);
        const relativePath = `_posts/${file}`;
        
        console.log(`\n--- Testing ${file} ---`);
        console.log('Full path:', filePath);
        console.log('Relative path:', relativePath);
        
        // Check if any processor matches
        let matched = false;
        processors.forEach((processor, i) => {
          if (processor.pattern.test(relativePath)) {
            console.log(`✅ Matches processor ${i}`);
            matched = true;
          }
        });
        
        if (!matched) {
          console.log('❌ No processor matches this file');
        }
        
        // Try to read and parse manually
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const fm = require('hexo-front-matter');
          const parsed = fm.parse(content);
          console.log('✅ Front matter parsed successfully');
          console.log('  Title:', parsed.title);
          console.log('  Date:', parsed.date);
          console.log('  Content length:', parsed._content ? parsed._content.length : 0);
        } catch (parseError) {
          console.log('❌ Front matter parsing failed:', parseError.message);
        }
      }
    }
    
    console.log('\n4. Loading data with detailed tracking...');
    
    // Hook into the source processing
    let processedCount = 0;
    hexo.extend.processor.register('_posts/*.md', function(file) {
      console.log(`Processing file: ${file.path}`);
      processedCount++;
      
      const Post = this.model('Post');
      const path = file.path;
      
      if (file.type === 'skip') {
        console.log('  -> SKIPPED');
        return;
      }
      
      if (file.type === 'delete') {
        console.log('  -> DELETE');
        const doc = Post.findOne({source: path});
        if (doc) {
          return doc.remove();
        }
        return;
      }
      
      return Promise.resolve(file.read()).then(content => {
        if (!content) {
          console.log('  -> NO CONTENT');
          return;
        }
        
        console.log('  -> CONTENT EXISTS, parsing...');
        
        const fm = require('hexo-front-matter');
        const parsed = fm.parse(content);
        const { slugize } = require('hexo-util');
        const crypto = require('crypto');
        
        // Generate safe ID
        const safeId = 'c' + crypto.createHash('sha256').update(path).digest('hex').substring(0, 23);
        
        let slug = parsed.slug;
        if (!slug) {
          slug = path.substring(path.lastIndexOf('/') + 1, path.lastIndexOf('.'));
          slug = slugize(slug, {transform: 1});
        }
        
        const postData = {
          _id: safeId,
          title: parsed.title || slug,
          date: parsed.date ? new Date(parsed.date) : new Date(),
          content: parsed._content || '',
          source: path,
          slug: slug,
          published: parsed.published !== false,
          tags: parsed.tags || [],
          categories: parsed.categories || []
        };
        
        console.log('  -> Creating post:', postData.title);
        
        try {
          const doc = Post.findById(safeId);
          if (doc) {
            console.log('  -> UPDATING existing post');
            return doc.replace(postData);
          } else {
            console.log('  -> INSERTING new post');
            return Post.insert(postData);
          }
        } catch (dbError) {
          console.log('  -> DATABASE ERROR:', dbError.message);
          throw dbError;
        }
      }).catch(error => {
        console.log('  -> PROCESSING ERROR:', error.message);
        throw error;
      });
    });
    
    await hexo.load();
    
    console.log(`\n5. Processing summary:`);
    console.log(`Files processed: ${processedCount}`);
    
    const posts = hexo.locals.get('posts');
    console.log(`Posts in locals: ${posts.length}`);
    
    const database = hexo.database;
    const Post = database.model('Post');
    const dbPosts = Post.toArray();
    console.log(`Posts in database: ${dbPosts.length}`);
    
    if (dbPosts.length > 0) {
      console.log('\nFirst few posts in database:');
      dbPosts.slice(0, 3).forEach(post => {
        console.log(`  - ${post.title} (${post.slug})`);
      });
    }
    
    console.log('\n6. Attempting to generate...');
    await hexo.call('generate');
    
    const publicFiles = fs.readdirSync('public');
    console.log(`Generated files: ${publicFiles.length}`);
    console.log('Files:', publicFiles);
    
    if (fs.existsSync('public/index.html')) {
      console.log('✅ index.html generated successfully');
    } else {
      console.log('❌ index.html not found');
    }
    
    await hexo.exit();
    console.log('\n=== DEBUG SESSION COMPLETE ===');
    
  } catch (error) {
    console.error('Deep debug failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

deepDebug();