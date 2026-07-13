$TargetFolder = "C:\Users\reyliou\Desktop\412630567-RWA-DEMO-main"
$OutputFile = "C:\Users\reyliou\Desktop\412630567-RWA-DEMO-main\file_list.txt"

Write-Host "Start scanning folders and excluding specific directories..."

Get-ChildItem -Path $TargetFolder -Recurse -File | 
Where-Object { 
    $_.FullName -notmatch '\\node_modules\\' -and 
    $_.FullName -notmatch '\\\.git\\' -and 
    $_.FullName -notmatch '\\__pycache__\\' -and 
    $_.FullName -notmatch '\\venv\\' -and
    $_.FullName -notmatch '\\\.next\\'
} | 
Select-Object -ExpandProperty FullName | 
Out-File -Encoding utf8 $OutputFile

Write-Host "Done! File saved to: $OutputFile"
Pause
