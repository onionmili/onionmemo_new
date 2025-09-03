const Hexo = require('hexo');
const path = require('path');
const fs = require('fs');

async function forceRebuild() {
  try {
    console.log('=== FORCE REBUILD SESSION ===');
    
    // 1. 清理所有缓存
    console.log('1. Cleaning cache...');
    if (fs.existsSync('db.json')) {
      fs.unlinkSync('db.json');
      console.log('  - Removed db.json');
    }
    
    if (fs.existsSync('public')) {
      fs.rmSync('public', { recursive: true, force: true });
      console.log('  - Removed public directory');
    }
    
    if (fs.existsSync('.deploy_git')) {
      fs.rmSync('.deploy_git', { recursive: true, force: true });
      console.log('  - Removed .deploy_git directory');
    }
    
    // 2. 重新初始化Hexo
    console.log('\n2. Initializing fresh Hexo instance...');
    const hexo = new Hexo(process.cwd(), { 
      config: path.join(process.cwd(), '_config.yml'),
      debug: false,
      safe: false,
      silent: false
    });
    
    await hexo.init();
    
    // 3. 强制清空数据库
    console.log('3. Clearing database...');
    const database = hexo.database;
    database.model('Post').remove({});
    database.model('Page').remove({});
    database.model('Category').remove({});
    database.model('Tag').remove({});
    
    // 4. 手动注册一个简单的文章处理器
    console.log('4. Registering custom processor...');
    
    hexo.extend.processor.register('_posts/*.md', function(file) {
      const Post = this.model('Post');
      const path = file.path;
      
      if (file.type === 'skip') return;
      
      if (file.type === 'delete') {
        const doc = Post.findOne({source: path});
        if (doc) return doc.remove();
        return;
      }
      
      return Promise.resolve(file.read()).then(content => {
        if (!content) return;
        
        const fm = require('hexo-front-matter');
        const parsed = fm.parse(content);
        const { slugize } = require('hexo-util');
        const crypto = require('crypto');
        
        // 生成安全的ID
        const safeId = 'c' + crypto.createHash('sha256').update(path + Date.now()).digest('hex').substring(0, 23);
        
        // 生成slug
        let slug = parsed.slug;
        if (!slug) {
          slug = path.substring(path.lastIndexOf('/') + 1, path.lastIndexOf('.'));
          slug = slugize(slug, {transform: 1});
        }
        
        // 处理日期
        let date = new Date();
        if (parsed.date) {
          date = new Date(parsed.date);
          if (isNaN(date.getTime())) {
            date = new Date();
          }
        }
        
        // 处理路径
        const postPath = this.config.permalink
          .replace(/:year/g, date.getFullYear())
          .replace(/:month/g, String(date.getMonth() + 1).padStart(2, '0'))
          .replace(/:day/g, String(date.getDate()).padStart(2, '0'))
          .replace(/:title/g, slug);
        
        const postData = {
          _id: safeId,
          title: parsed.title || slug,
          date: date,
          updated: parsed.updated ? new Date(parsed.updated) : date,
          content: parsed._content || '',
          excerpt: parsed.excerpt || '',
          source: path,
          slug: slug,
          path: postPath,
          permalink: this.config.url + '/' + postPath,
          published: parsed.published !== false,
          layout: parsed.layout || 'post',
          comments: parsed.comments !== false,
          tags: parsed.tags || [],
          categories: parsed.categories || [],
          author: parsed.author || this.config.author,
          photos: parsed.photos || []
        };
        
        console.log(`  -> Creating post: ${postData.title}`);
        
        return Post.insert(postData);
      });
    });
    
    // 5. 加载数据
    console.log('\n5. Loading data...');
    await hexo.load();
    
    // 6. 检查结果
    const posts = hexo.locals.get('posts');
    const dbPosts = database.model('Post').toArray();
    
    console.log(`\n6. Results:`);
    console.log(`  Posts in locals: ${posts.length}`);
    console.log(`  Posts in database: ${dbPosts.length}`);
    
    if (posts.length > 0) {
      console.log('\n  Sample posts:');
      posts.take(5).forEach(post => {
        console.log(`    - ${post.title} (${post.date.format('YYYY-MM-DD')})`);
      });
    }
    
    // 7. 生成站点
    console.log('\n7. Generating site...');
    await hexo.call('generate');
    
    // 8. 检查生成的文件
    console.log('\n8. Checking generated files...');
    if (fs.existsSync('public')) {
      const publicFiles = fs.readdirSync('public');
      console.log(`  Generated files: ${publicFiles.length}`);
      console.log(`  Files: ${publicFiles}`);
      
      if (fs.existsSync('public/index.html')) {
        console.log('  ✅ index.html found');
        const indexContent = fs.readFileSync('public/index.html', 'utf8');
        const hasArticles = indexContent.includes('<article') || indexContent.includes('class="post');
        console.log(`  ✅ Index contains articles: ${hasArticles}`);
        
        if (hasArticles) {
          console.log('  🎉 SUCCESS! Site generated with articles!');
        }
      } else {
        console.log('  ❌ index.html not found');
      }
    } else {
      console.log('  ❌ public directory not created');
    }
    
    await hexo.exit();
    console.log('\n=== FORCE REBUILD COMPLETE ===');
    
  } catch (error) {
    console.error('Force rebuild failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

forceRebuild();