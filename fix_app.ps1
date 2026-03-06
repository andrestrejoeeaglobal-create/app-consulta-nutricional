$path = "client/src/App.jsx"
if (Test-Path "$path.bak.2") { Remove-Item "$path.bak.2" }
Copy-Item $path "$path.bak.2"
$lines = Get-Content $path
$part1 = $lines[0..2803]
$part2 = $lines[3526..($lines.Count - 1)]
$newContent = $part1 + $part2
$newContent | Set-Content $path -Encoding UTF8
Write-Host "Done. Lines removed: 2805-3526"
