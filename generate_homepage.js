const Hexo = require('hexo');
const path = require('path');
const fs = require('fs');

async function generateHomepage() {
  try {
    console.log('=== 生成首页和索引页 ===');
    
    const hexo = new Hexo(process.cwd(), { 
      config: path.join(process.cwd(), '_config.yml'),
      debug: false,
      safe: false,
      silent: false
    });
    
    await hexo.init();
    await hexo.load();
    
    console.log('检查文章数量:', hexo.locals.get('posts').length);
    
    // 强制生成首页
    console.log('生成首页...');
    await hexo.call('generate', {force: true});
    
    console.log('检查生成结果...');
    if (fs.existsSync('public/index.html')) {
      console.log('✅ index.html 已生成');
      
      // 检查内容
      const content = fs.readFileSync('public/index.html', 'utf8');
      const hasArticles = content.includes('<article') || content.includes('post-');
      console.log('✅ 首页包含文章:', hasArticles);
      
      if (!hasArticles) {
        console.log('首页内容预览:');
        console.log(content.substring(0, 1000));
      }
    } else {
      console.log('❌ index.html 仍未生成');
      
      // 列出public目录内容
      const publicFiles = fs.readdirSync('public');
      console.log('public目录内容:', publicFiles);
    }
    
    await hexo.exit();
    
  } catch (error) {
    console.error('生成首页失败:', error);
  }
}

generateHomepage();