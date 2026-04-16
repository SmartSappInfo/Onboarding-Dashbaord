import os

def fix_file(filepath):
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r') as f:
        content = f.read()

    # Fix fc.record issue: entityContacts: [], -> entityContacts: fc.constant([]),
    # Only inside fc.record (heuristically)
    # But usually school.id and others are already fc.string etc.
    content = content.replace('entityContacts: [],', 'entityContacts: fc.constant([]),')
    
    # Deduplicate
    lines = content.split('\n')
    new_lines = []
    seen_in_block = False
    for line in lines:
        stripped = line.strip()
        if '{' in line:
            seen_in_block = False
        if 'entityContacts: fc.constant([]),' in stripped:
            if seen_in_block:
                continue
            seen_in_block = True
        new_lines.append(line)
    content = '\n'.join(new_lines)

    with open(filepath, 'w') as f:
        f.write(content)

fix_file('src/lib/import-export/__tests__/import-export-roundtrip.property.test.ts')
