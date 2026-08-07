# Improved recovery: Find the LAST VIEW_FILE that shows the COMPLETE file for each target
# by matching the File Path field specifically

$transcriptPath = "C:\Users\muhdu\.gemini\antigravity-ide\brain\8404a9a6-9240-4fa6-9496-f9e1322e88b9\.system_generated\logs\transcript_full.jsonl"
$frontendRoot = "g:\Uschat\frontend"

# Files that need re-recovery (got walkthrough content) + missing files
$filesToRecover = @(
    "src/store/authStore.ts",
    "src/theme/colors.ts",
    "src/screens/Auth/LoginScreen.tsx",
    "src/screens/Auth/RegisterScreen.tsx",
    "src/screens/Auth/OTPScreen.tsx",
    "src/screens/Auth/SplashScreen.tsx",
    "src/screens/Home/HomeScreen.tsx",
    "src/screens/Call/CallScreen.tsx",
    "src/components/UserProfileModal.tsx",
    "App.tsx"
)

Write-Host "Reading transcript..."
$lines = Get-Content $transcriptPath
Write-Host "Total lines: $($lines.Count)"

$recovered = @{}

# Scan backwards for the LAST complete VIEW_FILE of each file
for ($i = $lines.Count - 1; $i -ge 0; $i--) {
    $line = $lines[$i]
    
    foreach ($file in $filesToRecover) {
        if ($recovered.ContainsKey($file)) { continue }
        
        $fullFilePath = "file:///g:/Uschat/frontend/$file"
        
        # Check if this line references the specific file path AND is a complete view
        if ($line -match [regex]::Escape($fullFilePath) -and $line -match "entire.*complete file contents") {
            try {
                $json = $line | ConvertFrom-Json -ErrorAction SilentlyContinue
                if ($json -and $json.type -eq "VIEW_FILE") {
                    # Verify the File Path field matches our target
                    if ($json.content -match "File Path:.*$([regex]::Escape($fullFilePath))") {
                        Write-Host "[FOUND] $file at line $($i+1) (VIEW_FILE, complete)"
                        $recovered[$file] = @{ LineIndex = $i; Type = "VIEW_FILE"; Content = $json.content }
                    }
                }
            } catch {}
        }
    }
    
    if ($recovered.Count -eq $filesToRecover.Count) { break }
}

Write-Host ""
Write-Host "=== Found $($recovered.Count) / $($filesToRecover.Count) files ==="

# Now also search for CODE_ACTION (write_to_file) for missing files
$stillMissing = @()
foreach ($file in $filesToRecover) {
    if (-not $recovered.ContainsKey($file)) {
        $stillMissing += $file
        Write-Host "[STILL MISSING] $file - searching CODE_ACTION..."
    }
}

# For still missing files, search CODE_ACTION entries
if ($stillMissing.Count -gt 0) {
    for ($i = $lines.Count - 1; $i -ge 0; $i--) {
        $line = $lines[$i]
        
        foreach ($file in $stillMissing) {
            if ($recovered.ContainsKey($file)) { continue }
            
            $escapedPath = "g:\\\\Uschat\\\\frontend\\\\$($file.Replace('/', '\\\\'))"
            
            if ($line -match [regex]::Escape($escapedPath) -and $line -match "CODE_ACTION") {
                try {
                    $json = $line | ConvertFrom-Json -ErrorAction SilentlyContinue
                    if ($json -and $json.type -eq "CODE_ACTION") {
                        Write-Host "[FOUND CODE_ACTION] $file at line $($i+1)"
                        $recovered[$file] = @{ LineIndex = $i; Type = "CODE_ACTION"; Content = $json.content }
                    }
                } catch {}
            }
        }
    }
}

# Extract and write files from VIEW_FILE entries
$successCount = 0
foreach ($entry in $recovered.GetEnumerator()) {
    $relPath = $entry.Key
    $data = $entry.Value
    $fullPath = Join-Path $frontendRoot $relPath
    
    if ($data.Type -eq "VIEW_FILE") {
        $content = $data.Content
        $codeLines = @()
        $contentLines = $content -split "`n"
        $started = $false
        
        foreach ($cl in $contentLines) {
            if ($cl -match "^(\d+): (.*)$") {
                $started = $true
                $lineContent = $Matches[2]
                # Remove trailing \r
                $lineContent = $lineContent.TrimEnd("`r")
                $codeLines += $lineContent
            } elseif ($cl -match "^(\d+):[\s]*$") {
                $started = $true
                $codeLines += ""
            }
        }
        
        if ($codeLines.Count -gt 0) {
            $dir = Split-Path $fullPath -Parent
            if (-not (Test-Path $dir)) {
                New-Item -ItemType Directory -Path $dir -Force | Out-Null
            }
            
            $fileContent = ($codeLines -join "`r`n") + "`r`n"
            [System.IO.File]::WriteAllText($fullPath, $fileContent, (New-Object System.Text.UTF8Encoding $false))
            
            Write-Host "[RESTORED] $relPath ($($codeLines.Count) lines)"
            $successCount++
        } else {
            Write-Host "[PARSE FAIL] $relPath - could not extract lines"
        }
    } else {
        Write-Host "[SKIPPED] $relPath - CODE_ACTION (diff only, needs manual reconstruction)"
    }
}

# Final report
Write-Host ""
Write-Host "=== RECOVERY COMPLETE ==="
Write-Host "Restored from VIEW_FILE: $successCount"
foreach ($file in $filesToRecover) {
    if (-not $recovered.ContainsKey($file)) {
        Write-Host "[NOT FOUND] $file"
    }
}
