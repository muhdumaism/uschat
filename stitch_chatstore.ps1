# Stitch chatStore.ts from 4 partial VIEW_FILE entries
$transcriptPath = "C:\Users\muhdu\.gemini\antigravity-ide\brain\8404a9a6-9240-4fa6-9496-f9e1322e88b9\.system_generated\logs\transcript_full.jsonl"
$lines = Get-Content $transcriptPath

# Indices (0-based): 997 (1-130), 1006 (140-220), 1008 (220-300), 1010 (300-341)
$viewIndices = @(997, 1006, 1008, 1010)

$allCodeLines = @{}  # Dictionary: lineNumber -> content

foreach ($idx in $viewIndices) {
    $json = $lines[$idx] | ConvertFrom-Json
    $content = $json.content
    foreach ($cl in ($content -split "`n")) {
        if ($cl -match '^(\d+): (.*)$') {
            $lineNum = [int]$Matches[1]
            $lineContent = $Matches[2].TrimEnd("`r")
            $allCodeLines[$lineNum] = $lineContent
        } elseif ($cl -match '^(\d+):\s*$') {
            $lineNum = [int]$Matches[1]
            $allCodeLines[$lineNum] = ""
        }
    }
}

# Sort by line number and output
$sortedKeys = $allCodeLines.Keys | Sort-Object
$outputLines = @()
foreach ($k in $sortedKeys) {
    $outputLines += $allCodeLines[$k]
}

$fileContent = $outputLines -join "`r`n"
[System.IO.File]::WriteAllText("g:\Uschat\frontend\src\store\chatStore.ts", $fileContent, (New-Object System.Text.UTF8Encoding $false))
Write-Host "chatStore.ts written: $($outputLines.Count) lines ($($fileContent.Length) chars)"
