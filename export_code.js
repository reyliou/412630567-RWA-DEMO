const fs = require('fs');
const path = require('path');

// 設定要排除的資料夾與副檔名
const EXCLUDE_DIRS = ['node_modules', '.git', 'dist', '.next', 'build', '.gemini', 'scratch', '.vscode', 'venv', 'artifacts', 'cache', 'coverage'];
const EXCLUDE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.mp4', '.pdf', '.zip', '.exe', '.lock', '.env', '.pyd', '.pyc', '.map'];

function scanDirectory(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!EXCLUDE_DIRS.includes(file)) {
        scanDirectory(fullPath, fileList);
      }
    } else {
      const ext = path.extname(file).toLowerCase();
      // 排除不必要的檔案與大檔案
      if (
        !EXCLUDE_EXTENSIONS.includes(ext) && 
        file !== 'package-lock.json' && 
        !file.endsWith('.dbg.json') &&
        !file.endsWith('project_contents.txt') &&
        !file.endsWith('all_code.txt')
      ) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

const rootDir = __dirname;
const allFiles = scanDirectory(rootDir);
let outputContent = '';

for (const file of allFiles) {
  // 排除腳本自己跟輸出的檔案
  if (file === __filename || file.endsWith('all_code.txt')) continue;
  try {
    const content = fs.readFileSync(file, 'utf8');
    const relativePath = path.relative(rootDir, file);
    outputContent += `\n\n================================================================\n`;
    outputContent += `File: ${relativePath}\n`;
    outputContent += `================================================================\n\n`;
    outputContent += content;
  } catch (e) {
    console.error(`Error reading ${file}: ${e.message}`);
  }
}

const outputPath = path.join(rootDir, 'all_code.txt');
fs.writeFileSync(outputPath, outputContent, 'utf8');
console.log(`✅ 成功打包所有程式碼！共掃描了 ${allFiles.length} 個檔案。`);
console.log(`📁 輸出檔案位置: ${outputPath}`);
