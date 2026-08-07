# Extract missing file contents from tool_calls in transcript
$transcriptPath = "C:\Users\muhdu\.gemini\antigravity-ide\brain\8404a9a6-9240-4fa6-9496-f9e1322e88b9\.system_generated\logs\transcript_full.jsonl"
$frontendRoot = "g:\Uschat\frontend"

$lines = Get-Content $transcriptPath
Write-Host "Total lines: $($lines.Count)"

# Files still missing - search for write_to_file tool calls
$missingFiles = @(
    "SplashScreen.tsx",
    "OTPScreen.tsx", 
    "HomeScreen.tsx",
    "UserProfileModal.tsx",
    "App.tsx"
)

$foundFiles = @{}

# Scan all PLANNER_RESPONSE entries for write_to_file tool_calls targeting our files
for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    
    # Quick filter - skip lines that don't contain tool_calls
    $matchesAny = $false
    foreach ($f in $missingFiles) {
        if ($line -match [regex]::Escape($f)) {
            $matchesAny = $true
            break
        }
    }
    if (-not $matchesAny) { continue }
    
    try {
        $json = $line | ConvertFrom-Json -ErrorAction SilentlyContinue
        if (-not $json -or -not $json.tool_calls) { continue }
        
        # Check each tool_call
        $toolCalls = @($json.tool_calls)
        foreach ($tc in $toolCalls) {
            if ($tc.name -eq "write_to_file" -and $tc.args.TargetFile -and $tc.args.CodeContent) {
                $targetFile = $tc.args.TargetFile
                foreach ($f in $missingFiles) {
                    if ($targetFile -match [regex]::Escape($f)) {
                        Write-Host "[FOUND] $f at line $($i+1) -> $targetFile"
                        $foundFiles[$f] = @{
                            LineIndex = $i
                            TargetFile = $targetFile
                            CodeContent = $tc.args.CodeContent
                        }
                    }
                }
            }
        }
    } catch {}
}

Write-Host ""
Write-Host "=== Found $($foundFiles.Count) / $($missingFiles.Count) ==="

# Write the found files
foreach ($entry in $foundFiles.GetEnumerator()) {
    $fileName = $entry.Key
    $data = $entry.Value
    $targetPath = $data.TargetFile.Replace("\\", "/").Replace("g:/Uschat/frontend/", "")
    $fullPath = Join-Path $frontendRoot $targetPath
    
    $dir = Split-Path $fullPath -Parent
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    
    # Decode unicode escapes and write
    $content = $data.CodeContent
    [System.IO.File]::WriteAllText($fullPath, $content, (New-Object System.Text.UTF8Encoding $false))
    
    $lineCount = ($content -split "`n").Count
    Write-Host "[RESTORED] $fileName -> $fullPath ($lineCount lines)"
}

# Report missing
foreach ($f in $missingFiles) {
    if (-not $foundFiles.ContainsKey($f)) {
        Write-Host "[NOT FOUND] $f"
    }
}
