import os
import re

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Add entityContacts: [], after updatedAt or migrationStatus
    content = re.sub(r"updatedAt: new Date\(\)\.toISOString\(\),", "updatedAt: new Date().toISOString(),\n        entityContacts: [],", content)
    content = re.sub(r"migrationStatus: 'migrated',", "migrationStatus: 'migrated',\n        entityContacts: [],", content)
    content = re.sub(r"migrationStatus: 'legacy',", "migrationStatus: 'legacy',\n        entityContacts: [],", content)

    # Deduplicate
    lines = content.split('\n')
    new_lines = []
    seen_in_block = False
    for line in lines:
        if '{' in line:
            seen_in_block = False
        if 'entityContacts: [],' in line:
            if seen_in_block:
                continue
            seen_in_block = True
        new_lines.append(line)
    content = '\n'.join(new_lines)

    with open(filepath, 'w') as f:
        f.write(content)

fix_file('src/lib/__tests__/task-41-2-adapter-integration.test.ts')
fix_file('src/lib/__tests__/profile-module.test.ts')
