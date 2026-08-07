# Check for any missing dependencies in package.json by scanning imports
$srcPath = "g:\Uschat\frontend\src"
$packageJsonPath = "g:\Uschat\frontend\package.json"

$packageJson = Get-Content $packageJsonPath | ConvertFrom-Json
$declaredDeps = $packageJson.dependencies.psobject.properties.name

$files = Get-ChildItem -Path $srcPath -Recurse -Include *.ts, *.tsx, *.js, *.jsx
$importedModules = @()

foreach ($f in $files) {
    $content = Get-Content $f.FullName
    foreach ($line in $content) {
        # Match static imports: import ... from 'module' or import 'module'
        if ($line -match "import\s+.*from\s+['\"']([^'\".\d][^'\"]*)['\"]" -or $line -match "import\s+['\"']([^'\".\d][^'\"]*)['\"]") {
            $module = $Matches[1]
            # Get the top-level package name (e.g. react-native-gesture-handler from react-native-gesture-handler/Swipeable)
            $topLevel = $module.Split("/")[0]
            if ($module.StartsWith("@")) {
                $topLevel = $module.Split("/")[0] + "/" + $module.Split("/")[1]
            }
            $importedModules += $topLevel
        }
    }
}

$uniqueImports = $importedModules | Sort-Object -Unique
$missing = @()

# Built-in or standard react/react-native/expo packages to ignore
$ignores = @("react", "react-native", "expo", "react-native-gesture-handler", "react-native-reanimated", "react-native-safe-area-context", "react-native-screens", "react-native-svg", "expo-status-bar", "expo-crypto", "expo-blur", "expo-image-picker", "expo-linear-gradient", "lucide-react-native", "@react-navigation/native", "@react-navigation/native-stack", "@react-navigation/bottom-tabs", "@tanstack/react-query", "axios", "zustand", "@react-native-async-storage/async-storage")

foreach ($imp in $uniqueImports) {
    if ($ignores -contains $imp) { continue }
    if ($declaredDeps -notcontains $imp) {
        $missing += $imp
    }
}

Write-Host "=== IMPORT SCAN ==="
Write-Host "Unique external package imports found: $($uniqueImports.Count)"
Write-Host "Missing packages in package.json: $($missing.Count)"
foreach ($m in $missing) {
    Write-Host "  -> $m"
}
