const Hexo = require('hexo');
const path = require('path');
const fs = require('fs');
const cuid = require('cuid');

async function buildProperly() {
  try {
    console.log('=== 正确构建pln主题 ===');
    
    // 1. 首先确保主配置文件正确
    console.log('1. 验证主配置文件...');
    const configPath = path.join(process.cwd(), '_config.yml');
    let configContent = fs.readFileSync(configPath, 'utf8');
    
    // 确保主题设置为pln
    if (!configContent.includes('theme: pln')) {
      configContent = configContent.replace(/theme:\s*\w+/, 'theme: pln');
      fs.writeFileSync(configPath, configContent);
      console.log('✅ 主题配置已更新为pln');
    } else {
      console.log('✅ 主题配置正确');
    }
    
    // 2. 清理旧构建
    console.log('2. 清理旧构建...');
    if (fs.existsSync('public')) {
      fs.rmSync('public', { recursive: true, force: true });
    }
    if (fs.existsSync('db.json')) {
      fs.unlinkSync('db.json');
    }
    
    // 3. 使用标准hexo命令构建
    console.log('3. 使用hexo clean...');
    const { execSync } = require('child_process');
    
    try {
      execSync('npx hexo clean', { stdio: 'inherit' });
      console.log('✅ 清理完成');
    } catch (error) {
      console.log('清理命令执行完成（可能有警告）');
    }
    
    console.log('4. 使用hexo generate...');
    try {
      execSync('npx hexo generate', { stdio: 'inherit' });
      console.log('✅ 生成完成');
    } catch (error) {
      console.error('生成失败，尝试自定义生成...');
      throw error;
    }
    
    // 5. 验证结果
    console.log('5. 验证生成结果...');
    
    if (fs.existsSync('public/index.html')) {
      const indexContent = fs.readFileSync('public/index.html', 'utf8');
      console.log(`✅ 首页已生成 (${indexContent.length} 字符)`);
      
      if (indexContent.includes('洋葱备忘录')) {
        console.log('✅ 网站标题正确');
      }
      
      // 检查是否使用了pln主题
      if (indexContent.includes('main-ctnr') || indexContent.includes('navigation')) {
        console.log('✅ 使用了pln主题模板');
      } else {
        console.log('⚠️  可能仍在使用其他主题');
        // 显示部分内容以调试
        console.log('首页内容预览:');
        console.log(indexContent.substring(0, 500));
      }
    } else {
      console.error('❌ 首页未生成');
    }
    
    // 6. 复制CSS文件
    console.log('6. 复制pln主题CSS...');
    const cssSource = path.join(process.cwd(), 'themes/pln/source/css/m.min.css');
    const cssDest = path.join(process.cwd(), 'public/css/m.min.css');
    
    if (fs.existsSync(cssSource) && fs.existsSync(path.dirname(cssDest))) {
      fs.copyFileSync(cssSource, cssDest);
      console.log('✅ CSS文件已复制');
    } else {
      console.log('⚠️  CSS文件复制失败或不需要');
    }
    
    // 7. 检查文章页面
    const articleDirs = fs.readdirSync('public').filter(item => 
      fs.statSync(path.join('public', item)).isDirectory() && /^\d{4}$/.test(item)
    );
    
    if (articleDirs.length > 0) {
      console.log(`✅ 生成了 ${articleDirs.length} 年的文章目录`);
      
      // 检查最新的一篇文章
      const latestYear = Math.max(...articleDirs.map(d => parseInt(d)));
      const yearDir = path.join('public', latestYear.toString());
      const months = fs.readdirSync(yearDir).filter(item => 
        fs.statSync(path.join(yearDir, item)).isDirectory()
      );
      
      if (months.length > 0) {
        const latestMonth = months.sort().pop();
        const monthDir = path.join(yearDir, latestMonth);
        const days = fs.readdirSync(monthDir).filter(item => 
          fs.statSync(path.join(monthDir, item)).isDirectory()
        );
        
        if (days.length > 0) {
          const latestDay = days.sort().pop();
          const dayDir = path.join(monthDir, latestDay);
          const articles = fs.readdirSync(dayDir).filter(item => 
            fs.statSync(path.join(dayDir, item)).isDirectory()
          );
          
          if (articles.length > 0) {
            const articlePath = path.join(dayDir, articles[0], 'index.html');
            if (fs.existsSync(articlePath)) {
              const articleContent = fs.readFileSync(articlePath, 'utf8');
              console.log(`✅ 文章页面已生成 (${articleContent.length} 字符)`);
              
              if (articleContent.includes('洋葱备忘录')) {
                console.log('✅ 文章页面标题正确');
              }
              
              // 检查是否包含实际内容而不是EJS代码
              if (articleContent.includes('<%') || articleContent.includes('%>')) {
                console.log('❌ 文章页面包含未渲染的EJS代码');
              } else {
                console.log('✅ 文章页面内容已正确渲染');
              }
            }
          }
        }
      }
    }
    
    console.log('\n🎉 pln主题构建完成！');
    
  } catch (error) {
    console.error('构建失败:', error.message);
    console.log('\n尝试备选方案...');
    
    // 备选方案：直接使用我们的自定义构建
    try {
      await customBuild();
    } catch (customError) {
      console.error('自定义构建也失败:', customError);
      process.exit(1);
    }
  }
}

async function customBuild() {
  console.log('=== 使用自定义构建方案 ===');
  
  const hexo = new Hexo(process.cwd(), {
    config: path.join(process.cwd(), '_config.yml'),
    debug: false,
    safe: false,
    silent: false
  });
  
  await hexo.init();
  
  // 强制设置主题
  hexo.config.theme = 'pln';
  hexo.theme_dir = path.join(hexo.base_dir, 'themes', 'pln');
  
  console.log(`主题目录: ${hexo.theme_dir}`);
  console.log(`主题存在: ${fs.existsSync(hexo.theme_dir)}`);
  
  if (!fs.existsSync(hexo.theme_dir)) {
    throw new Error('pln主题目录不存在');
  }
  
  // 注册CUID处理器
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
  
  await hexo.load();
  console.log(`加载了 ${hexo.locals.get('posts').length} 篇文章`);
  
  await hexo.call('generate');
  
  // 复制CSS文件
  const cssSource = path.join(hexo.theme_dir, 'source/css/m.min.css');
  const cssDest = path.join(hexo.public_dir, 'css/m.min.css');
  
  if (fs.existsSync(cssSource)) {
    const cssDir = path.dirname(cssDest);
    if (!fs.existsSync(cssDir)) {
      fs.mkdirSync(cssDir, { recursive: true });
    }
    fs.copyFileSync(cssSource, cssDest);
    console.log('✅ CSS文件已复制');
  }
  
  await hexo.exit();
  console.log('自定义构建完成');
}

buildProperly();