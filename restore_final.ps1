# Final recovery: Extract specific files from their correct VIEW_FILE transcript entries
$transcriptPath = "C:\Users\muhdu\.gemini\antigravity-ide\brain\8404a9a6-9240-4fa6-9496-f9e1322e88b9\.system_generated\logs\transcript_full.jsonl"
$frontendRoot = "g:\Uschat\frontend"

$lines = Get-Content $transcriptPath

function Extract-FileFromViewEntry {
    param([int]$LineIndex, [string]$OutputPath)
    
    $json = $lines[$LineIndex] | ConvertFrom-Json
    $content = $json.content
    $codeLines = @()
    $contentLines = $content -split "`n"
    
    foreach ($cl in $contentLines) {
        if ($cl -match "^(\d+): (.*)$") {
            $lineContent = $Matches[2].TrimEnd("`r")
            $codeLines += $lineContent
        } elseif ($cl -match "^(\d+):\s*$") {
            $codeLines += ""
        }
    }
    
    if ($codeLines.Count -gt 3) {
        $dir = Split-Path $OutputPath -Parent
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
        $fileContent = ($codeLines -join "`r`n") + "`r`n"
        [System.IO.File]::WriteAllText($OutputPath, $fileContent, (New-Object System.Text.UTF8Encoding $false))
        Write-Host "[OK] $OutputPath ($($codeLines.Count) lines)"
        return $true
    } else {
        Write-Host "[FAIL] $OutputPath - only $($codeLines.Count) lines extracted"
        return $false
    }
}

# authStore.ts - line 1157 (0-indexed: 1156)
Extract-FileFromViewEntry -LineIndex 1156 -OutputPath "$frontendRoot\src\store\authStore.ts"

# Now find the correct entries for any other files that may need fixing
# Let's verify which files already have correct content
$filesToCheck = @{
    "src\store\chatStore.ts" = 413   # 0-indexed
    "src\api\client.ts" = 409
    "src\api\config.ts" = 1158
    "src\api\wsClient.ts" = 1004
    "src\crypto\signalEngine.ts" = 843
    "src\navigation\AppNavigator.tsx" = 981
    "src\store\callStore.ts" = 1637
    "src\components\Avatar.tsx" = 1582
    "src\components\Button.tsx" = 1586
    "src\components\GlassCard.tsx" = 1590
    "src\components\GlassInput.tsx" = 1594
    "src\components\IncomingCallModal.tsx" = 1170
    "src\components\ImagePreviewModal.tsx" = 1118
}

foreach ($entry in $filesToCheck.GetEnumerator()) {
    $filePath = Join-Path $frontendRoot $entry.Key
    $content = Get-Content $filePath -Raw -ErrorAction SilentlyContinue
    if ($content -and $content -match "^#.*Walkthrough") {
        Write-Host "[CORRUPTED] $($entry.Key) - re-extracting from line $($entry.Value + 1)"
        Extract-FileFromViewEntry -LineIndex $entry.Value -OutputPath $filePath
    } else {
        Write-Host "[OK EXISTING] $($entry.Key)"
    }
}

Write-Host ""
Write-Host "=== DONE ==="
