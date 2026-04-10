import glob
import re

files = glob.glob('src/**/*.tsx', recursive=True) + glob.glob('src/**/*.ts', recursive=True)

patterns = [
    (r'entityId,\s*entityId', 'entityId'),
    (r'entityId:\s*.*?,\s*entityId:', 'entityId:'),
    (r'\{\s*entityId,\s*entityId:', '{ entityId:')
]

for file in files:
    try:
        with open(file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        new_content = content
        
        # specific fixes for { entityId, entityId: school?.entityId }
        new_content = new_content.replace('{ entityId, entityId: school?.entityId }', '{ entityId }')
        
        for pattern, replacement in patterns:
            new_content = re.sub(pattern, replacement, new_content)
            
        if new_content != content:
            with open(file, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print("Fixed duplicate entityId in: " + file)
            
    except Exception as e:
        print(f"Error handling {file}: {e}")
