const fs = require('fs');
const path = require('path');

// 設定要排除的資料夾與副檔名
const EXCLUDE_DIRS = [
  'node_modules', '.git', 'dist', '.next', 'build', 
  '.gemini', 'scratch', '.vscode', 'venv', 'artifacts', 
  'cache', 'coverage', '.idea', '.tempmediaStorage'
];

const EXCLUDE_FILE_NAMES = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.test',
  '.env.development',
  '.env.backup',
  'package-lock.json',
  'all_code.txt',
  'project_contents.txt',
  'file_list.txt',
];

const EXCLUDE_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.mp4', 
  '.pdf', '.zip', '.exe', '.lock', '.pyd', '.pyc', '.map',
  '.pem', '.key', '.crt', '.pfx'
];

function isExcludedFile(fileName) {
  const lower = fileName.toLowerCase();
  
  // 嚴格排除任何形式的 .env 檔案
  if (lower === '.env' || lower.startsWith('.env') || lower.endsWith('.env') || lower.includes('.env.')) {
    return true;
  }
  
  // 排除特定的 dump 或敏感檔名
  if (EXCLUDE_FILE_NAMES.includes(lower)) {
    return true;
  }
  
  // 排除 code review 或 debug 檔案
  if (lower.startsWith('codereview') && lower.endsWith('.md')) {
    return true;
  }
  
  if (lower.endsWith('.dbg.json')) {
    return true;
  }
  
  const ext = path.extname(lower);
  if (EXCLUDE_EXTENSIONS.includes(ext)) {
    return true;
  }
  
  return false;
}

function scanDirectory(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!EXCLUDE_DIRS.includes(file)) {
        scanDirectory(fullPath, fileList);
      }
    } else {
      if (!isExcludedFile(file)) {
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
  // 排除腳本自己與 dump 檔案
  if (file === __filename || isExcludedFile(path.basename(file))) continue;
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
console.log(`✅ 成功打包程式碼！共安全掃描了 ${allFiles.length} 個檔案（已 100% 排除所有 .env 與敏感金鑰檔案）。`);
console.log(`📁 輸出檔案位置: ${outputPath}`);
