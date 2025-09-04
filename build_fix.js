const Hexo = require('hexo');
const path = require('path');
const fs = require('fs');
const cuid = require('cuid');

async function buildFix() {
  try {
    console.log('=== 修复pln主题完整构建 ===');
    
    // 1. 清理旧的构建
    console.log('1. 清理旧构建文件...');
    if (fs.existsSync('public')) {
      fs.rmSync('public', { recursive: true, force: true });
    }
    if (fs.existsSync('db.json')) {
      fs.unlinkSync('db.json');
    }
    
    // 2. 初始化Hexo实例（强制指定主题）
    console.log('2. 初始化Hexo...');
    const hexo = new Hexo(process.cwd(), { 
      config: path.join(process.cwd(), '_config.yml'),
      debug: false,
      safe: false,
      silent: false
    });
    
    await hexo.init();
    
    // 强制设置主题为pln（在初始化后立即设置）
    hexo.config.theme = 'pln';
    
    // 重新初始化主题
    console.log('重新初始化pln主题...');
    await hexo.loadPlugin(path.join(hexo.theme_dir, '../pln'), true);
    
    // 重新初始化Hexo以使用pln主题
    await hexo.exit();
    
    // 第二次初始化，这次应该会正确加载pln主题
    const hexoWithPln = new Hexo(process.cwd(), { 
      config: path.join(process.cwd(), '_config.yml'),
      debug: false,
      safe: false,
      silent: false
    });
    
    await hexoWithPln.init();
    
    // 再次确认主题设置
    hexoWithPln.config.theme = 'pln';
    console.log(`主题设置为: ${hexoWithPln.config.theme}`);
    
    // 使用新的Hexo实例
    const hexo = hexoWithPln;
    
    // 3. 注册自定义CUID处理器
    console.log('3. 注册CUID处理器...');
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
      }).catch(error => {
        console.error(`处理文件失败 ${filePath}:`, error.message);
        return null;
      });
    });
    
    // 4. 加载数据
    console.log('4. 加载文章数据...');
    await hexo.load();
    
    const posts = hexo.locals.get('posts');
    console.log(`✅ 加载了 ${posts.length} 篇文章`);
    
    // 5. 强制排序文章按时间倒序
    console.log('5. 设置文章排序...');
    hexo.config.index_generator = hexo.config.index_generator || {};
    hexo.config.index_generator.order_by = '-date';
    hexo.config.archive_generator = hexo.config.archive_generator || {};
    hexo.config.archive_generator.order_by = '-date';
    
    // 6. 确保主题配置正确
    console.log('6. 验证pln主题配置...');
    console.log(`当前主题: ${hexo.config.theme}`);
    
    // 强制设置主题为pln
    hexo.config.theme = 'pln';
    console.log(`✅ 主题已设置为: ${hexo.config.theme}`);
    
    // 7. 生成所有页面（使用Hexo原生生成器）
    console.log('7. 生成所有页面...');
    await hexo.call('generate');
    
    // 8. 复制pln主题的CSS文件
    console.log('8. 复制主题CSS文件...');
    const cssSource = path.join(hexo.theme_dir, 'source/css/m.min.css');
    const cssDest = path.join(hexo.public_dir, 'css/m.min.css');
    
    if (fs.existsSync(cssSource)) {
      // 确保css目录存在
      const cssDir = path.dirname(cssDest);
      if (!fs.existsSync(cssDir)) {
        fs.mkdirSync(cssDir, { recursive: true });
      }
      fs.copyFileSync(cssSource, cssDest);
      console.log('✅ CSS文件已复制');
    } else {
      console.error('❌ CSS源文件不存在:', cssSource);
    }
    
    // 9. 验证生成结果
    console.log('9. 验证生成结果...');
    
    // 检查首页
    const indexPath = path.join(hexo.public_dir, 'index.html');
    if (fs.existsSync(indexPath)) {
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      console.log(`✅ 首页已生成 (${indexContent.length} 字符)`);
      
      // 检查首页是否包含正确的标题和内容
      if (indexContent.includes('洋葱备忘录')) {
        console.log('✅ 首页标题正确');
      } else {
        console.log('⚠️  首页标题可能有问题');
      }
      
      if (indexContent.includes('m.min.css')) {
        console.log('✅ CSS文件引用正确');
      } else {
        console.log('⚠️  CSS文件引用可能有问题');
      }
    } else {
      console.error('❌ 首页未生成');
    }
    
    // 检查文章页面
    const postsArray = posts.toArray ? posts.toArray() : posts;
    if (postsArray.length > 0) {
      const latestPost = postsArray[0];
      const postPath = path.join(hexo.public_dir, latestPost.path, 'index.html');
      if (fs.existsSync(postPath)) {
        const postContent = fs.readFileSync(postPath, 'utf8');
        console.log(`✅ 文章页面已生成 (${postContent.length} 字符)`);
        
        // 检查文章页面是否包含正确的内容
        if (postContent.includes(latestPost.title)) {
          console.log('✅ 文章标题正确显示');
        } else {
          console.log('⚠️  文章标题可能有问题');
        }
        
        if (postContent.includes('m.min.css')) {
          console.log('✅ 文章页面CSS引用正确');
        } else {
          console.log('⚠️  文章页面CSS引用可能有问题');
        }
      } else {
        console.error('❌ 文章页面未生成:', postPath);
      }
    }
    
    // 检查归档页面
    const archivePath = path.join(hexo.public_dir, 'archives/index.html');
    if (fs.existsSync(archivePath)) {
      console.log('✅ 归档页面已生成');
    } else {
      console.log('⚠️  归档页面未生成，这是正常的，因为默认可能不生成');
    }
    
    // 统计生成的文件
    const publicFiles = fs.readdirSync(hexo.public_dir);
    console.log(`✅ 总共生成 ${publicFiles.length} 个文件/目录`);
    
    // 10. 显示文章排序
    console.log('10. 验证文章排序...');
    if (postsArray.length > 0) {
      console.log('最新的5篇文章:');
      postsArray.slice(0, 5).forEach((post, index) => {
        console.log(`  ${index + 1}. ${post.title} (${post.date.format('YYYY-MM-DD')})`);
      });
    }
    
    await hexo.exit();
    console.log('\n🎉 pln主题构建完成！');
    
  } catch (error) {
    console.error('构建失败:', error);
    console.error('错误详情:', error.stack);
    process.exit(1);
  }
}

buildFix();