import os

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Fix literal \n added by sed
    content = content.replace('\\n', '\n')
    
    # Fix the missing closure for mockSchool and other objects
    # Heuristic: split by '};' and ensure we have proper nesting
    # Actually, simpler: just fix the specific broken lines
    content = content.replace('toISOString(),      };', 'toISOString(),\n      };')
    
    # Clean up duplicated entityContacts
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

fix_file('src/lib/__tests__/task-41-2-adapter-integration.test.ts')
fix_file('src/lib/__tests__/profile-module.test.ts')
