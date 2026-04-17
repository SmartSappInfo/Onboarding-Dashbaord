import re
import subprocess
import json

# Get all files with unescaped entity errors
result = subprocess.run(
    ['node_modules/.bin/eslint', 'src/**/*.tsx', '--format', 'json', '--rule', '{"react/no-unescaped-entities": "error"}'],
    capture_output=True, text=True, cwd='.'
)

try:
    data = json.loads(result.stdout)
except:
    print("Could not parse JSON output")
    print(result.stdout[:500])
    exit(1)

files_with_errors = set()
for f in data:
    for m in f['messages']:
        if m.get('ruleId') == 'react/no-unescaped-entities':
            files_with_errors.add(f['filePath'])

print(f"Files with unescaped entities: {len(files_with_errors)}")

for filepath in files_with_errors:
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # We need to be careful - only replace in JSX text content, not in strings/attributes
    # Strategy: find JSX text nodes with unescaped quotes/apostrophes
    # Replace " with &quot; and ' with &apos; only in JSX text (between > and <)
    
    # This is complex to do perfectly, so we'll use a targeted approach:
    # Replace common patterns like "don't" -> "don&apos;t" in JSX text
    
    # Simple approach: replace in JSX text content between tags
    # Pattern: >...text with ' or "...<
    def replace_in_jsx_text(match):
        text = match.group(0)
        # Replace unescaped quotes in text content
        text = text.replace('"', '&quot;')
        return text
    
    # For apostrophes in words like "don't", "it's", "you're"
    # Replace ' in JSX text content
    def replace_apostrophe(match):
        return match.group(0).replace("'", "&apos;")
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed: {filepath.split('Onboarding-Dashbaord-main/')[-1]}")

print("Note: Manual fixes still needed for complex cases")
