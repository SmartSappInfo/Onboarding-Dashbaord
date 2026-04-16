import os
import re

def fix_file(filepath):
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r') as f:
        content = f.read()

    # Add entityContacts: [], after updatedAt
    content = re.sub(r"(updatedAt: .*,)", r"\1\n        entityContacts: [],", content)
    
    # Deduplicate
    lines = content.split('\n')
    new_lines = []
    seen_in_block = False
    for line in lines:
        stripped = line.strip()
        if '{' in line:
            seen_in_block = False
        if 'entityContacts: [],' in stripped:
            if seen_in_block:
                continue
            seen_in_block = True
        new_lines.append(line)
    content = '\n'.join(new_lines)

    with open(filepath, 'w') as f:
        f.write(content)

fix_file('src/lib/__tests__/task-36-integration.test.ts')
fix_file('src/lib/__tests__/task-41-5-migration-logic.test.ts')
fix_file('src/lib/__tests__/task-41-5-migration-production.test.ts')
