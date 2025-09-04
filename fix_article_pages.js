const Hexo = require('hexo');
const path = require('path');
const fs = require('fs');
const cuid = require('cuid');

async function fixArticlePages() {
  try {
    console.log('=== 修复文章页面显示问题 ===');
    
    // 1. 初始化Hexo
    const hexo = new Hexo(process.cwd(), {
      config: path.join(process.cwd(), '_config.yml'),
      debug: false,
      safe: false,
      silent: false
    });
    
    await hexo.init();
    hexo.config.theme = 'pln';
    
    // 2. 注册CUID处理器
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
        
        const fm = require('hexo-front-matter');
        const { slugize } = require('hexo-util');
        
        try {
          const parsed = fm.parse(content);
          const postId = cuid();
          
          let slug = parsed.slug;
          if (!slug) {
            const filename = filePath.substring(filePath.lastIndexOf('/') + 1, filePath.lastIndexOf('.'));
            slug = slugize(filename, {transform: 1});
          }
          
          let date = new Date();
          if (parsed.date) {
            const parsedDate = new Date(parsed.date);
            if (!isNaN(parsedDate.getTime())) {
              date = parsedDate;
            }
          }
          
          const postPath = this.config.permalink
            .replace(/:year/g, date.getFullYear())
            .replace(/:month/g, String(date.getMonth() + 1).padStart(2, '0'))
            .replace(/:day/g, String(date.getDate()).padStart(2, '0'))
            .replace(/:title/g, slug);
          
          const postData = {
            _id: postId,
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
          
          const existingPost = Post.findOne({source: filePath});
          if (existingPost) {
            return existingPost.replace(postData);
          } else {
            return Post.insert(postData);
          }
          
        } catch (parseError) {
          console.error(`解析错误 ${filePath}:`, parseError.message);
          return null;
        }
      });
    });
    
    // 3. 加载数据
    await hexo.load();
    const posts = hexo.locals.get('posts');
    console.log(`加载了 ${posts.length} 篇文章`);
    
    // 4. 手动为每篇文章生成正确的pln主题HTML
    console.log('4. 为每篇文章生成正确的pln主题HTML...');
    
    const postsArray = posts.toArray ? posts.toArray() : posts;
    const sortedPosts = postsArray.sort((a, b) => b.date - a.date);
    
    let processedCount = 0;
    
    for (const post of sortedPosts) {
      try {
        // 生成pln主题风格的文章页面HTML
        const articleHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>${post.title} - 洋葱备忘录</title>
  <meta name="description" content="${post.excerpt || post.title}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/css/m.min.css">
</head>
<body>
  <a id="top"></a>
  <div id="main">
    <div class="main-ctnr">
      <div class="behind">
        <a href="/" class="back black-color">
          <svg class="i-close" viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentcolor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3">
            <path d="M2 30 L30 2 M30 30 L2 2"></path>
          </svg>
        </a>
        <div class="description">
          &nbsp;回到首页
        </div>
      </div>
      
      <article class="standard post">
        <div class="title">
          <h1>${post.title}</h1>
        </div>
        <div class="meta center">
          <time datetime="${post.date.toISOString()}">${post.date.format('YYYY-MM-DD')}</time>
          ${post.categories && post.categories.length > 0 ? `• ${post.categories.map(cat => cat.name || cat).join(', ')}` : ''}
        </div>
        <hr>
        <div class="picture-container">
          ${post.photos && post.photos.length > 0 ? post.photos.map(photo => `<img src="${photo}" alt="文章图片">`).join('') : ''}
        </div>
        <div class="post-content">
          ${post.content}
        </div>
      </article>
      
      <script async src="//busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js"></script>
      <div class="busuanzi center">
        阅读次数:&nbsp;<span id="busuanzi_value_page_pv"></span>&nbsp;・&nbsp;
        网站访问:&nbsp;<span id="busuanzi_value_site_pv"></span>&nbsp;・&nbsp;
        访客数量:&nbsp;<span id="busuanzi_value_site_uv"></span>
      </div>
    </div>
  </div>
  <footer class="page-footer">
    <p>© 洋葱 2015-${new Date().getFullYear()}</p>
  </footer>
</body>
</html>`;
        
        // 确保文章目录存在
        const articleDir = path.join('public', post.path);
        if (!fs.existsSync(articleDir)) {
          fs.mkdirSync(articleDir, { recursive: true });
        }
        
        // 写入正确的HTML文件
        const articlePath = path.join(articleDir, 'index.html');
        fs.writeFileSync(articlePath, articleHtml);
        
        processedCount++;
        
        if (processedCount % 20 === 0) {
          console.log(`  已处理 ${processedCount}/${sortedPosts.length} 篇文章`);
        }
        
      } catch (error) {
        console.error(`处理文章失败 ${post.title}:`, error.message);
      }
    }
    
    console.log(`✅ 成功处理了 ${processedCount} 篇文章`);
    
    // 5. 验证一些文章页面
    console.log('5. 验证文章页面...');
    
    if (sortedPosts.length > 0) {
      const testPosts = sortedPosts.slice(0, 3); // 测试前3篇文章
      
      testPosts.forEach(post => {
        const articlePath = path.join('public', post.path, 'index.html');
        if (fs.existsSync(articlePath)) {
          const content = fs.readFileSync(articlePath, 'utf8');
          if (content.includes('<%') || content.includes('%>')) {
            console.log(`❌ ${post.title} 仍包含EJS代码`);
          } else if (content.includes(post.title) && content.includes('洋葱备忘录')) {
            console.log(`✅ ${post.title} 页面正确生成`);
          } else {
            console.log(`⚠️  ${post.title} 页面可能有问题`);
          }
        } else {
          console.log(`❌ ${post.title} 页面文件不存在`);
        }
      });
    }
    
    await hexo.exit();
    
    console.log('\n🎉 文章页面修复完成！');
    console.log('现在所有文章页面都应该正确显示pln主题的内容，而不是EJS代码。');
    
  } catch (error) {
    console.error('修复失败:', error);
    process.exit(1);
  }
}

fixArticlePages();