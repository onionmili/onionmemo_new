const Hexo = require('hexo');
const path = require('path');
const fs = require('fs');

async function diagnose() {
  try {
    const hexo = new Hexo(process.cwd(), { 
      config: path.join(process.cwd(), '_config.yml'),
      debug: true,
      safe: false,
      silent: false
    });
    
    console.log('Initializing Hexo...');
    await hexo.init();
    
    // Check source directory
    const sourceDir = path.join(process.cwd(), 'source', '_posts');
    const files = fs.readdirSync(sourceDir);
    console.log(`Found ${files.length} files in source/_posts`);
    
    // Try to load a sample file
    const sampleFile = files.find(f => f.endsWith('.md'));
    if (sampleFile) {
      console.log(`Checking sample file: ${sampleFile}`);
      const filePath = path.join(sourceDir, sampleFile);
      const content = fs.readFileSync(filePath, 'utf8');
      console.log('First 200 characters:');
      console.log(content.substring(0, 200));
      console.log('---');
      
      // Try to parse front matter
      const frontMatter = require('hexo-front-matter');
      try {
        const parsed = frontMatter(content);
        console.log('Front matter parsed successfully:');
        console.log('Title:', parsed.title);
        console.log('Date:', parsed.date);
        console.log('Tags:', parsed.tags);
      } catch (err) {
        console.error('Front matter parsing failed:', err.message);
      }
    }
    
    console.log('Loading data...');
    await hexo.load();
    
    const posts = hexo.locals.get('posts');
    console.log(`Loaded ${posts.length} posts`);
    
    await hexo.exit();
  } catch (error) {
    console.error('Diagnosis failed:', error);
  }
}

diagnose();