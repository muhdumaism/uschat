import os
import json
import re

src_path = r"g:\Uschat\frontend\src"
package_json_path = r"g:\Uschat\frontend\package.json"

with open(package_json_path, "r") as f:
    package_json = json.load(f)

declared_deps = set(package_json.get("dependencies", {}).keys())

imported_modules = set()

# Regex for imports: e.g. import ... from 'module' or import 'module'
import_re = re.compile(r"import\s+(?:.*\s+from\s+)?['\"]([^'\".\d][^'\"]*)['\"]")

for root, _, files in os.walk(src_path):
    for file in files:
        if file.endswith((".ts", ".tsx", ".js", ".jsx")):
            filepath = os.path.join(root, file)
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                for line in f:
                    match = import_re.search(line)
                    if match:
                        module = match.group(1)
                        # Extract top level name
                        parts = module.split("/")
                        if module.startswith("@") and len(parts) > 1:
                            top_level = parts[0] + "/" + parts[1]
                        else:
                            top_level = parts[0]
                        imported_modules.add(top_level)

ignores = {
    "react", "react-native", "expo", "react-native-gesture-handler",
    "react-native-reanimated", "react-native-safe-area-context",
    "react-native-screens", "react-native-svg", "expo-status-bar",
    "expo-crypto", "expo-blur", "expo-image-picker", "expo-linear-gradient",
    "lucide-react-native", "@react-navigation/native", "@react-navigation/native-stack",
    "@react-navigation/bottom-tabs", "@tanstack/react-query", "axios",
    "zustand", "@react-native-async-storage/async-storage", "expo-image-manipulator"
}

missing = []
for imp in imported_modules:
    if imp in ignores:
        continue
    if imp not in declared_deps:
        missing.append(imp)

print("=== IMPORT SCAN ===")
print(f"Unique external packages: {len(imported_modules)}")
print(f"Missing packages: {len(missing)}")
for m in missing:
    print(f"  -> {m}")
