const Hexo = require('hexo');
const path = require('path');
const fs = require('fs');
const cuid = require('cuid');

async function createIndex() {
  try {
    const hexo = new Hexo(process.cwd(), { 
      config: path.join(process.cwd(), '_config.yml'),
      debug: false,
      safe: false,
      silent: false
    });
    
    await hexo.init();
    
    // 注册使用真正CUID的文章处理器
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
    
    await hexo.load();
    
    const posts = hexo.locals.get('posts');
    console.log(`\u5df2\u52a0\u8f7d ${posts.length} \u7bc7\u6587\u7ae0`);
    
    // \u624b\u52a8\u521b\u5efa\u4e00\u4e2a\u7b80\u5355\u7684\u9996\u9875
    const indexHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset=\"utf-8\">
  <title>${hexo.config.title}</title>
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
  <link rel=\"stylesheet\" href=\"/css/style.css\">
</head>
<body>
  <div id=\"container\">
    <div id=\"header\">
      <h1><a href=\"/\">${hexo.config.title}</a></h1>
      <p>${hexo.config.description}</p>
    </div>
    <div id=\"main\">
      <div id=\"content\">
        <h2>\u6700\u65b0\u6587\u7ae0</h2>
        <div class=\"posts\">`;
    
    let postsHtml = '';
    const postArray = posts.toArray ? posts.toArray() : posts;
    const recentPosts = postArray.slice(0, 10); // \u663e\u793a\u6700\u65b010\u7bc7\u6587\u7ae0
    
    recentPosts.forEach(post => {
      postsHtml += `
        <article class=\"post\">
          <h3><a href=\"/${post.path}\">${post.title}</a></h3>
          <p class=\"meta\">\u53d1\u5e03\u4e8e ${post.date.format('YYYY-MM-DD')}</p>
          <div class=\"excerpt\">${post.excerpt || post.content.substring(0, 200) + '...'}</div>
        </article>`;
    });
    
    const footerHtml = `
        </div>
        <div class=\"archive-link\">
          <p><a href=\"/archives/\">\u67e5\u770b\u6240\u6709\u6587\u7ae0 (${posts.length} \u7bc7)</a></p>
        </div>
      </div>
    </div>
    <div id=\"footer\">
      <p>&copy; ${new Date().getFullYear()} ${hexo.config.author}</p>
    </div>
  </div>
</body>
</html>`;
    
    const fullHtml = indexHtml + postsHtml + footerHtml;
    
    // \u5199\u5165index.html
    fs.writeFileSync('public/index.html', fullHtml);
    console.log('\u2705 \u624b\u52a8\u521b\u5efaindex.html\u6210\u529f');
    
    // \u521b\u5efa\u4e00\u4e2a\u7b80\u5355\u7684archives\u9875\u9762
    const archivesHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset=\"utf-8\">
  <title>\u6587\u7ae0\u5f52\u6863 - ${hexo.config.title}</title>
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
  <link rel=\"stylesheet\" href=\"/css/style.css\">
</head>
<body>
  <div id=\"container\">
    <div id=\"header\">
      <h1><a href=\"/\">${hexo.config.title}</a></h1>
    </div>
    <div id=\"main\">
      <div id=\"content\">
        <h2>\u6587\u7ae0\u5f52\u6863 (${posts.length} \u7bc7)</h2>
        <div class=\"archives\">`;
    
    let archivesListHtml = '';
    postArray.forEach(post => {
      archivesListHtml += `
        <div class=\"archive-item\">
          <span class=\"date\">${post.date.format('YYYY-MM-DD')}</span>
          <a href=\"/${post.path}\">${post.title}</a>
        </div>`;
    });
    
    const archivesFooterHtml = `
        </div>
      </div>
    </div>
    <div id=\"footer\">
      <p><a href=\"/\">\u8fd4\u56de\u9996\u9875</a></p>
    </div>
  </div>
</body>
</html>`;
    
    const fullArchivesHtml = archivesHtml + archivesListHtml + archivesFooterHtml;
    
    // \u521b\u5efaarchives\u76ee\u5f55\u5e76\u5199\u5165index.html
    if (!fs.existsSync('public/archives')) {
      fs.mkdirSync('public/archives');
    }
    fs.writeFileSync('public/archives/index.html', fullArchivesHtml);
    console.log('\u2705 \u521b\u5efa\u6587\u7ae0\u5f52\u6863\u9875\u9762\u6210\u529f');
    
    await hexo.exit();
    console.log('\u9996\u9875\u521b\u5efa\u5b8c\u6210!');
    
  } catch (error) {
    console.error('\u521b\u5efa\u9996\u9875\u5931\u8d25:', error);
  }
}

createIndex();