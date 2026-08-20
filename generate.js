const fs = require('fs');
const path = require('path');

const targetFolder = __dirname;
const outputFile = path.join(__dirname, 'project_contents.txt');

const includeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.json', '.md', '.py', '.txt', '.yaml', '.yml'];
const excludePatterns = ['node_modules', '.git', '__pycache__', 'venv', '.next', 'dist', 'package-lock.json', 'project_contents.txt'];

function walkSync(dir, filelist = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    if (excludePatterns.some(p => filepath.includes(path.sep + p + path.sep) || file === p)) {
      continue;
    }
    const stat = fs.statSync(filepath);
    if (stat.isDirectory()) {
      filelist = walkSync(filepath, filelist);
    } else {
      const ext = path.extname(filepath).toLowerCase();
      if (includeExtensions.includes(ext) && filepath !== outputFile) {
        filelist.push(filepath);
      }
    }
  }
  return filelist;
}

try {
  console.log("Start reading files...");
  const files = walkSync(targetFolder);
  
  let outContent = "=== 專案程式碼總覽 ===\n";
  for (const f of files) {
    const relPath = path.relative(targetFolder, f);
    outContent += `\n\n========================================================================\n`;
    outContent += `File: ${relPath}\n`;
    outContent += `========================================================================\n`;
    try {
      outContent += fs.readFileSync(f, 'utf8');
    } catch (e) {
      outContent += "[無法讀取此檔案內容或編碼不支援]";
    }
  }
  
  fs.writeFileSync(outputFile, outContent, 'utf8');
  console.log("Done! File saved to: " + outputFile);
} catch (err) {
  console.error("Error:", err);
}
