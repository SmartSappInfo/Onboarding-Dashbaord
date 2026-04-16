import os

def fix_file(filepath):
    with open(filepath, 'r') as f:
        lines = f.readlines()

    new_lines = []
    in_invalid_block = False
    for line in lines:
        stripped = line.strip()
        # Detect start of PDFForm or Survey block
        if 'PDFForm =' in line or 'Survey =' in line or 'target: PDFForm' in line or 'target: Survey' in line:
            in_invalid_block = True
        
        # Detect end of block (heuristic: next variable declaration or end of test)
        if 'const ' in line and in_invalid_block and 'PDFForm' not in line and 'Survey' not in line:
            in_invalid_block = False
        
        if in_invalid_block and 'entityContacts: [],' in line:
            continue # Skip this line
            
        new_lines.append(line)

    with open(filepath, 'w') as f:
        f.writelines(new_lines)

fix_file('src/lib/__tests__/task-36-integration.test.ts')
