const Hexo = require('hexo');
const path = require('path');
const fs = require('fs');
const cuid = require('cuid');

async function build() {
  try {
    const hexo = new Hexo(process.cwd(), { 
      config: path.join(process.cwd(), '_config.yml'),
      debug: false,
      safe: false,
      silent: false
    });
    
    console.log('初始化Hexo...');
    await hexo.init();
    
    // 注册使用真正CUID的文章处理器
    console.log('注册CUID文章处理器...');
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
          
          // 使用真正的CUID库生成ID
          const postId = cuid();
          
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
          
          // 检查是否已存在
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
      }).catch(error => {
        console.error(`处理文件失败 ${filePath}:`, error.message);
        return null;
      });
    });
    
    console.log('加载数据...');
    await hexo.load();
    
    const posts = hexo.locals.get('posts');
    console.log(`加载了 ${posts.length} 篇文章`);
    
    console.log('生成静态文件...');
    await hexo.call('generate');
    
    console.log('创建首页和归档页...');
    // 手动创建首页
    const posts = hexo.locals.get('posts');
    const indexHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${hexo.config.title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <div id="container">
    <div id="header">
      <h1><a href="/">${hexo.config.title}</a></h1>
      <p>${hexo.config.description}</p>
    </div>
    <div id="main">
      <div id="content">
        <h2>最新文章</h2>
        <div class="posts">`;
    
    let postsHtml = '';
    const postArray = posts.toArray ? posts.toArray() : posts;
    const recentPosts = postArray.slice(0, 10);
    
    recentPosts.forEach(post => {
      postsHtml += `
        <article class="post">
          <h3><a href="/${post.path}">${post.title}</a></h3>
          <p class="meta">发布于 ${post.date.format('YYYY-MM-DD')}</p>
          <div class="excerpt">${post.excerpt || post.content.substring(0, 200) + '...'}</div>
        </article>`;
    });
    
    const footerHtml = `
        </div>
        <div class="archive-link">
          <p><a href="/archives/">查看所有文章 (${posts.length} 篇)</a></p>
        </div>
      </div>
    </div>
    <div id="footer">
      <p>&copy; ${new Date().getFullYear()} ${hexo.config.author}</p>
    </div>
  </div>
</body>
</html>`;
    
    const fullHtml = indexHtml + postsHtml + footerHtml;
    fs.writeFileSync('public/index.html', fullHtml);
    
    // 创建归档页面
    const archivesHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>文章归档 - ${hexo.config.title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <div id="container">
    <div id="header">
      <h1><a href="/">${hexo.config.title}</a></h1>
    </div>
    <div id="main">
      <div id="content">
        <h2>文章归档 (${posts.length} 篇)</h2>
        <div class="archives">`;
    
    let archivesListHtml = '';
    postArray.forEach(post => {
      archivesListHtml += `
        <div class="archive-item">
          <span class="date">${post.date.format('YYYY-MM-DD')}</span>
          <a href="/${post.path}">${post.title}</a>
        </div>`;
    });
    
    const archivesFooterHtml = `
        </div>
      </div>
    </div>
    <div id="footer">
      <p><a href="/">返回首页</a></p>
    </div>
  </div>
</body>
</html>`;
    
    const fullArchivesHtml = archivesHtml + archivesListHtml + archivesFooterHtml;
    
    if (!fs.existsSync('public/archives')) {
      fs.mkdirSync('public/archives');
    }
    fs.writeFileSync('public/archives/index.html', fullArchivesHtml);
    
    console.log('构建完成!');
    
    // 检查生成结果
    if (fs.existsSync('public/index.html')) {
      console.log('✅ index.html 已生成');
    } else {
      console.log('❌ index.html 未生成');
    }
    
    await hexo.exit();
  } catch (error) {
    console.error('构建失败:', error);
    process.exit(1);
  }
}

build();