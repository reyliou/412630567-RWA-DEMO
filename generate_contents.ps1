$TargetFolder = "C:\Users\reyliou\Desktop\412630567-RWA-DEMO-main"
$OutputFile = "C:\Users\reyliou\Desktop\412630567-RWA-DEMO-main\project_contents.txt"

# 只讀取這些副檔名的檔案，避免讀到圖片或執行檔變成亂碼
$IncludeExtensions = @('.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.json', '.md', '.py', '.txt', '.yaml', '.yml')

Write-Host "Start reading files..."

# 建立或清空檔案
Out-File -FilePath $OutputFile -Encoding utf8 -InputObject "=== 專案程式碼總覽 ==="

Get-ChildItem -Path $TargetFolder -Recurse -File | 
Where-Object { 
    $_.FullName -notmatch '\\node_modules\\' -and 
    $_.FullName -notmatch '\\\.git\\' -and 
    $_.FullName -notmatch '\\__pycache__\\' -and 
    $_.FullName -notmatch '\\venv\\' -and
    $_.FullName -notmatch '\\\.next\\' -and
    $_.FullName -notmatch '\\dist\\' -and
    $_.FullName -notmatch 'package-lock\.json' -and
    $_.FullName -ne $OutputFile -and
    $IncludeExtensions -contains $_.Extension.ToLower()
} | 
ForEach-Object {
    $filePath = $_.FullName
    $relativePath = $filePath.Substring($TargetFolder.Length + 1)
    
    # 寫入檔名標題
    $header = "`n`n========================================================================`n"
    $header += "File: $relativePath`n"
    $header += "========================================================================`n"
    Add-Content -Path $OutputFile -Value $header -Encoding utf8
    
    # 讀取並寫入檔案內容
    try {
        $content = Get-Content -Path $filePath -Encoding UTF8 -Raw -ErrorAction Stop
        Add-Content -Path $OutputFile -Value $content -Encoding utf8
    } catch {
        Add-Content -Path $OutputFile -Value "[無法讀取此檔案內容或編碼不支援]" -Encoding utf8
    }
}

Write-Host "Done! File saved to: $OutputFile"
Pause
