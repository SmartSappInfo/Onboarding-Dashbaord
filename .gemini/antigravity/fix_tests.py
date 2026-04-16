import os
import re

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Pattern 1: Add entityContacts after updatedAt if missing (strictly within Entity/WorkspaceEntity/ResolvedContact contexts)
    # We'll use a simple heuristic: if the file name or content suggests it's an entity-related test
    if 'Entity' in content or 'WorkspaceEntity' in content or 'ResolvedContact' in content or 'School' in content:
        def add_entity_contacts(match):
            block = match.group(0)
            if 'entityContacts:' in block:
                return block
            return block + "\n        entityContacts: [],"

        content = re.sub(r"updatedAt: '202[0-9]-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{3})?Z',", add_entity_contacts, content)
        content = re.sub(r"updatedAt: '202[0-9]-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z',", add_entity_contacts, content)

    # Pattern 2: Remove ALL duplicates of entityContacts: [], within a same object literal
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

    # Pattern 3: Remove entityContacts: [], if it was added to PDFForm (heuristic)
    if 'pdf-module' in filepath or 'PDFForm' in content:
        # Remove entityContacts if it appears where it shouldn't
        content = re.sub(r"(\s*)entityId: (.*),\n\s*createdAt: (.*),\n\s*updatedAt: (.*),\n\s*entityContacts: \[\],", 
                         r"\1entityId: \2,\n\1createdAt: \3,\n\1updatedAt: \4,", content)
        # Handle the case where it might be slightly different
        content = re.sub(r"updatedAt: '(.*)',\n\s*entityContacts: \[\],", 
                         lambda m: m.group(0) if 'Entity' in content[:m.start()] else f"updatedAt: '{m.group(1)}',", content)

    with open(filepath, 'w') as f:
        f.write(content)

test_files = [
    'src/lib/__tests__/messaging-module-unit.test.ts',
    'src/lib/__tests__/metrics-actions.test.ts',
    'src/lib/__tests__/migration-idempotency.property.test.ts',
    'src/lib/__tests__/pdf-module-unit.test.ts',
    'src/lib/__tests__/kanban-workspace-query.test.ts'
]

for f in test_files:
    if os.path.exists(f):
        fix_file(f)
