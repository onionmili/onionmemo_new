const Hexo = require('hexo');
const path = require('path');
const fs = require('fs');
const cuid = require('cuid');

async function finalFix() {
  try {
    console.log('=== FINAL FIX WITH REAL CUID ===');
    
    // 1. 清理所有缓存和之前的构建
    console.log('1. 清理缓存和构建文件...');
    const cleanupFiles = ['db.json', 'public', '.deploy_git', 'node_modules/.cache'];
    
    for (const file of cleanupFiles) {
      if (fs.existsSync(file)) {
        if (fs.statSync(file).isDirectory()) {
          fs.rmSync(file, { recursive: true, force: true });
        } else {
          fs.unlinkSync(file);
        }
        console.log(`  - 删除了 ${file}`);
      }
    }
    
    // 2. 初始化全新的Hexo实例
    console.log('\n2. 初始化Hexo...');
    const hexo = new Hexo(process.cwd(), { 
      config: path.join(process.cwd(), '_config.yml'),
      debug: false,
      safe: false,
      silent: false
    });
    
    await hexo.init();
    
    // 3. 完全重置数据库
    console.log('3. 重置数据库...');
    const database = hexo.database;
    database.model('Post').remove({});
    database.model('Page').remove({});
    database.model('Category').remove({});
    database.model('Tag').remove({});
    
    // 4. 注册使用真正CUID的文章处理器
    console.log('4. 注册新的文章处理器（使用真正的CUID）...');
    
    hexo.extend.processor.register('_posts/*.md', function(file) {
      const Post = this.model('Post');
      const filePath = file.path;
      
      if (file.type === 'skip') return;
      
      if (file.type === 'delete') {
        const doc = Post.findOne({source: filePath});
        if (doc) return doc.remove();
        return;
      }
      
      return Promise.resolve(file.read()).then(content => {
        if (!content) return;
        
        console.log(`  处理文件: ${filePath}`);
        
        const fm = require('hexo-front-matter');
        const { slugize } = require('hexo-util');
        
        try {
          const parsed = fm.parse(content);
          
          // 使用真正的CUID库生成ID
          const postId = cuid();
          console.log(`  生成CUID: ${postId}`);
          
          // 生成slug
          let slug = parsed.slug;
          if (!slug) {
            const filename = filePath.substring(filePath.lastIndexOf('/') + 1, filePath.lastIndexOf('.'));
            slug = slugize(filename, {transform: 1});
          }
          
          // 处理日期
          let date = new Date();
          if (parsed.date) {
            const parsedDate = new Date(parsed.date);
            if (!isNaN(parsedDate.getTime())) {
              date = parsedDate;
            }
          }
          
          // 生成路径
          const postPath = this.config.permalink
            .replace(/:year/g, date.getFullYear())
            .replace(/:month/g, String(date.getMonth() + 1).padStart(2, '0'))
            .replace(/:day/g, String(date.getDate()).padStart(2, '0'))
            .replace(/:title/g, slug);
          
          const postData = {
            _id: postId,  // 使用真正的CUID
            title: parsed.title || slug,
            date: date,
            updated: parsed.updated ? new Date(parsed.updated) : date,
            content: parsed._content || '',
            excerpt: parsed.excerpt || '',
            source: filePath,
            slug: slug,
            path: postPath,
            permalink: this.config.url + '/' + postPath,
            published: parsed.published !== false,
            layout: parsed.layout || 'post',
            comments: parsed.comments !== false,
            tags: Array.isArray(parsed.tags) ? parsed.tags : (parsed.tags ? [parsed.tags] : []),
            categories: Array.isArray(parsed.categories) ? parsed.categories : (parsed.categories ? [parsed.categories] : []),
            author: parsed.author || this.config.author || '',
            photos: parsed.photos || []
          };
          
          console.log(`  创建文章: ${postData.title}`);
          
          // 检查是否已存在
          const existingPost = Post.findOne({source: filePath});
          if (existingPost) {
            console.log(`  更新现有文章: ${existingPost._id}`);
            return existingPost.replace(postData);
          } else {
            console.log(`  插入新文章: ${postId}`);
            return Post.insert(postData);
          }
          
        } catch (parseError) {
          console.error(`  解析错误 ${filePath}:`, parseError.message);
          throw parseError;
        }
      }).catch(error => {
        console.error(`  处理文件失败 ${filePath}:`, error.message);
        // 不要抛出错误，继续处理其他文件
        return null;
      });
    });
    
    // 5. 加载数据
    console.log('\n5. 加载数据...');
    await hexo.load();
    
    // 6. 检查结果
    console.log('\n6. 检查加载结果...');
    const posts = hexo.locals.get('posts');
    const dbPosts = database.model('Post').toArray();
    
    console.log(`  本地文章数量: ${posts.length}`);
    console.log(`  数据库文章数量: ${dbPosts.length}`);
    
    if (posts.length > 0) {
      console.log('\n  前5篇文章:');
      const postArray = posts.toArray ? posts.toArray() : posts;
      const firstFive = postArray.slice(0, 5);
      firstFive.forEach(post => {
        console.log(`    - ${post.title} (${post.date.format('YYYY-MM-DD')}) [${post._id}]`);
      });
    } else {
      console.log('  ❌ 没有找到文章！');
      
      // 如果还是没有文章，尝试手动检查
      console.log('\n  手动检查文章文件...');
      const postsDir = path.join(hexo.source_dir, '_posts');
      if (fs.existsSync(postsDir)) {
        const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
        console.log(`  发现 ${files.length} 个markdown文件`);
        
        if (files.length > 0) {
          console.log('  文件列表（前10个）:');
          files.slice(0, 10).forEach(file => {
            console.log(`    - ${file}`);
          });
        }
      }
    }
    
    // 7. 生成站点
    console.log('\n7. 生成站点...');
    await hexo.call('generate');
    
    // 8. 验证生成结果
    console.log('\n8. 验证生成结果...');
    if (fs.existsSync('public')) {
      const publicFiles = fs.readdirSync('public');
      console.log(`  生成的文件数量: ${publicFiles.length}`);
      
      if (fs.existsSync('public/index.html')) {
        console.log('  ✅ index.html 已生成');
        
        // 检查index.html的内容
        const indexContent = fs.readFileSync('public/index.html', 'utf8');
        const hasArticles = indexContent.includes('<article') || 
                           indexContent.includes('class="post') || 
                           indexContent.includes('class="article');
        
        console.log(`  ✅ 首页包含文章: ${hasArticles}`);
        
        if (hasArticles) {
          console.log('\n  🎉 成功！网站已生成并包含文章！');
        } else {
          console.log('\n  ⚠️  网站已生成但首页没有文章内容');
          // 显示index.html的一部分内容进行调试
          console.log('  首页内容预览:');
          console.log(indexContent.substring(0, 500) + '...');
        }
      } else {
        console.log('  ❌ index.html 未找到');
      }
      
      // 检查是否有文章页面生成
      const htmlFiles = publicFiles.filter(f => f.endsWith('.html'));
      console.log(`  HTML文件数量: ${htmlFiles.length}`);
      
    } else {
      console.log('  ❌ public 目录未创建');
    }
    
    await hexo.exit();
    console.log('\n=== 最终修复完成 ===');
    
  } catch (error) {
    console.error('最终修复失败:', error);
    console.error('错误详情:', error.stack);
    process.exit(1);
  }
}

finalFix();