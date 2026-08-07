# Recovery script: Extract and restore file contents from conversation transcript
$transcriptPath = "C:\Users\muhdu\.gemini\antigravity-ide\brain\8404a9a6-9240-4fa6-9496-f9e1322e88b9\.system_generated\logs\transcript_full.jsonl"
$frontendRoot = "g:\Uschat\frontend"

# Map: file relative path => transcript line number (0-indexed)
$fileMap = @{
    "src/api/client.ts" = 409
    "src/api/config.ts" = 1158
    "src/api/wsClient.ts" = 1004
    "src/crypto/signalEngine.ts" = 843
    "src/navigation/AppNavigator.tsx" = 981
    "src/store/authStore.ts" = 1378
    "src/store/chatStore.ts" = 413
    "src/store/callStore.ts" = 1637
    "src/theme/colors.ts" = 1378
    "src/screens/Auth/LoginScreen.tsx" = 1378
    "src/screens/Auth/RegisterScreen.tsx" = 1378
    "src/screens/Auth/OTPScreen.tsx" = 1378
    "src/screens/Auth/SplashScreen.tsx" = 1378
    "src/screens/Home/HomeScreen.tsx" = 1378
    "src/screens/Call/CallScreen.tsx" = 1378
    "src/components/Avatar.tsx" = 1582
    "src/components/Button.tsx" = 1586
    "src/components/GlassCard.tsx" = 1590
    "src/components/GlassInput.tsx" = 1594
    "src/components/IncomingCallModal.tsx" = 1170
    "src/components/UserProfileModal.tsx" = 1378
    "src/components/ImagePreviewModal.tsx" = 1118
}

Write-Host "Reading transcript..."
$lines = Get-Content $transcriptPath

$recovered = 0
$failed = 0

foreach ($entry in $fileMap.GetEnumerator()) {
    $relPath = $entry.Key
    $lineIdx = $entry.Value
    $fullPath = Join-Path $frontendRoot $relPath
    
    Write-Host ""
    Write-Host "Processing: $relPath (line $($lineIdx + 1))..."
    
    try {
        $json = $lines[$lineIdx] | ConvertFrom-Json
        $content = $json.content
        
        # Extract file path from the VIEW_FILE content to verify
        if ($content -match "File Path:.*?``file:///(.+?)``") {
            $filePath = $Matches[1].Replace("\\", "/")
            Write-Host "  Source file: $filePath"
        }
        
        # Extract the code content between line numbers
        # The format is: "1: line1\n2: line2\n..."
        # We need to strip the line numbers
        $codeLines = @()
        $inCode = $false
        $contentLines = $content -split "`n"
        
        foreach ($cl in $contentLines) {
            # Match lines that start with a number followed by colon
            if ($cl -match "^(\d+): (.*)$") {
                $inCode = $true
                $codeLines += $Matches[2]
            } elseif ($cl -match "^(\d+): ?$") {
                $inCode = $true
                $codeLines += ""
            } elseif ($cl -match "^(\d+):$") {
                $inCode = $true
                $codeLines += ""
            }
        }
        
        if ($codeLines.Count -gt 0) {
            # Create directory if needed
            $dir = Split-Path $fullPath -Parent
            if (-not (Test-Path $dir)) {
                New-Item -ItemType Directory -Path $dir -Force | Out-Null
            }
            
            # Write file - join with newlines, remove trailing \r
            $fileContent = ($codeLines -join "`n").TrimEnd("`r`n") + "`n"
            [System.IO.File]::WriteAllText($fullPath, $fileContent, [System.Text.Encoding]::UTF8)
            
            Write-Host "  RECOVERED: $($codeLines.Count) lines -> $fullPath"
            $recovered++
        } else {
            Write-Host "  FAILED: Could not extract code lines"
            $failed++
        }
    } catch {
        Write-Host "  ERROR: $_"
        $failed++
    }
}

Write-Host ""
Write-Host "=== RECOVERY COMPLETE ==="
Write-Host "Recovered: $recovered"
Write-Host "Failed: $failed"
Write-Host "Still need: App.tsx, notificationService.ts"
