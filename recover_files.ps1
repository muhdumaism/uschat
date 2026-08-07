# Recovery script: Extract last-known file contents from conversation transcript
# For each deleted file, find the last VIEW_FILE entry that contains the full file content

$transcriptPath = "C:\Users\muhdu\.gemini\antigravity-ide\brain\8404a9a6-9240-4fa6-9496-f9e1322e88b9\.system_generated\logs\transcript_full.jsonl"

# Files to recover - these are the ones that were deleted by git clean
$filesToRecover = @(
    "frontend/App.tsx",
    "frontend/src/api/client.ts",
    "frontend/src/api/config.ts",
    "frontend/src/api/wsClient.ts",
    "frontend/src/crypto/signalEngine.ts",
    "frontend/src/navigation/AppNavigator.tsx",
    "frontend/src/services/notificationService.ts",
    "frontend/src/store/authStore.ts",
    "frontend/src/store/chatStore.ts",
    "frontend/src/store/callStore.ts",
    "frontend/src/theme/colors.ts",
    "frontend/src/screens/Auth/LoginScreen.tsx",
    "frontend/src/screens/Auth/RegisterScreen.tsx",
    "frontend/src/screens/Auth/OTPScreen.tsx",
    "frontend/src/screens/Auth/SplashScreen.tsx",
    "frontend/src/screens/Home/HomeScreen.tsx",
    "frontend/src/screens/Call/CallScreen.tsx",
    "frontend/src/components/Avatar.tsx",
    "frontend/src/components/Button.tsx",
    "frontend/src/components/GlassCard.tsx",
    "frontend/src/components/GlassInput.tsx",
    "frontend/src/components/IncomingCallModal.tsx",
    "frontend/src/components/UserProfileModal.tsx",
    "frontend/src/components/ImagePreviewModal.tsx"
)

Write-Host "Reading transcript..."
$lines = Get-Content $transcriptPath

# For each file, find the LAST VIEW_FILE entry that shows the entire file
# Also look for CODE_ACTION (write_to_file) entries
$recovered = @{}

for ($i = $lines.Count - 1; $i -ge 0; $i--) {
    $line = $lines[$i]
    
    foreach ($file in $filesToRecover) {
        if ($recovered.ContainsKey($file)) { continue }
        
        $escapedFile = $file.Replace("/", "\\\\")
        $altEscaped = $file.Replace("/", "/")
        
        if ($line -match [regex]::Escape($file) -or $line -match [regex]::Escape($escapedFile)) {
            try {
                $json = $line | ConvertFrom-Json -ErrorAction SilentlyContinue
                if ($json -and $json.type -eq "VIEW_FILE" -and $json.content -match "entire.*complete file contents") {
                    Write-Host "Found full VIEW_FILE for $file at line $($i+1)"
                    $recovered[$file] = @{ LineIndex = $i; Type = "VIEW_FILE" }
                }
            } catch {}
        }
    }
    
    # Check if all recovered
    if ($recovered.Count -eq $filesToRecover.Count) { break }
}

Write-Host ""
Write-Host "=== RECOVERY RESULTS ==="
Write-Host "Found: $($recovered.Count) / $($filesToRecover.Count)"
Write-Host ""

foreach ($file in $filesToRecover) {
    if ($recovered.ContainsKey($file)) {
        Write-Host "[FOUND] $file at transcript line $($recovered[$file].LineIndex + 1)"
    } else {
        Write-Host "[MISSING] $file"
    }
}
