import glob
import re

files = glob.glob('src/**/*.tsx', recursive=True) + glob.glob('src/**/*.ts', recursive=True)

for file in files:
    try:
        with open(file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        new_content = content
        
        # fix the syntax error: "entityId: something: something"
        # usually "entityId: task.entityId: task.entityId" or similar
        # Let's find any entityId: \w+\.entityId: \w+\.entityId
        new_content = re.sub(r'entityId:\s*([a-zA-Z0-9_]+\.?entityId?)\s*:\s*\1', r'entityId: \1', new_content)
        new_content = re.sub(r'entityId:\s*([a-zA-Z0-9_]+\.entityId):\s*([a-zA-Z0-9_]+\.entityId)', r'entityId: \1', new_content)

        # also: { entityId, entityId }
        new_content = new_content.replace('{ entityId, entityId }', '{ entityId }')
        
        # also: { entityId: entityId }
        # that's valid formatting but just replacing common patterns that might be wrong
        new_content = new_content.replace('entityId: \n', 'entityId:')
        
        if new_content != content:
            with open(file, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print("Fixed syntax issues in: " + file)
            
    except Exception as e:
        pass
