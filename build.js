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
    
    console.log('为pln主题创建首页...');
    // 为pln主题手动创建首页
    const postsArray = posts.toArray ? posts.toArray() : posts;
    const recentPosts = postsArray.slice(0, 10);
    
    const plnIndexHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>洋葱备忘录</title>
  <meta name="description" content="洋葱的个人博客">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/css/m.min.css">
</head>
<body>
  <a id="top"></a>
  <div id="main">
    <div class="main-ctnr">
      <div class="navigation">
        <div class="nav-left">
          <a href="/" class="logo">洋葱备忘录</a>
        </div>
        <div class="nav-right">
          <a href="https://github.com/onionmili/">Github</a>
        </div>
      </div>
      <ul class="posts">`;
    
    let postsListHtml = '';
    recentPosts.forEach(post => {
      const postDate = post.date.format('YYYY-MM-DD');
      postsListHtml += `
        <li class="post">
          <h2 class="post-title">
            <a href="/${post.path}">${post.title}</a>
          </h2>
          <p class="post-meta">
            <time datetime="${post.date.toISOString()}">${postDate}</time>
          </p>
          <div class="post-excerpt">
            ${post.excerpt || post.content.substring(0, 120) + '...'}
          </div>
        </li>`;
    });
    
    const plnFooterHtml = `
      </ul>
      <div class="pagination">
        <span class="page-info">显示 ${recentPosts.length} / ${posts.length} 篇文章</span>
      </div>
    </div>
  </div>
  <footer class="page-footer">
    <p>© ${new Date().getFullYear()} 洋葱</p>
  </footer>
</body>
</html>`;
    
    const fullPlnHtml = plnIndexHtml + postsListHtml + plnFooterHtml;
    fs.writeFileSync('public/index.html', fullPlnHtml);
    
    console.log('构建完成!');
    
    // 检查生成结果
    if (fs.existsSync('public/index.html')) {
      console.log('✅ index.html 已生成');
      const indexContent = fs.readFileSync('public/index.html', 'utf8');
      console.log(`✅ 首页内容长度: ${indexContent.length} 字符`);
    } else {
      console.log('❌ index.html 未生成');
    }
    
    // 检查生成的文件
    const publicFiles = fs.readdirSync('public');
    console.log(`✅ 已生成 ${publicFiles.length} 个文件/目录`);
    
    await hexo.exit();
  } catch (error) {
    console.error('构建失败:', error);
    process.exit(1);
  }
}

build();