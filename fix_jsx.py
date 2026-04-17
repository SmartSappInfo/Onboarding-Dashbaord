"""
Fix JSX structure issues in multiple files.
Pattern: dialogs/modals placed outside the main wrapper div after it closes.
Fix: move the closing </div> to after the dialogs, or remove extra </div> tags.
"""

import re

def count_depth(lines, start, end):
    """Count JSX depth change over a range of lines."""
    depth = 0
    for i in range(start, end):
        line = lines[i]
        opens = len(re.findall(r'<[A-Za-z][a-zA-Z0-9.]*[\s/>]', line))
        closes = len(re.findall(r'</[A-Za-z]|/>', line))
        depth += opens - closes
    return depth

def fix_file(filepath, strategy):
    with open(filepath, 'r') as f:
        lines = f.readlines()
    
    original = lines[:]
    
    if strategy == 'remove_extra_div':
        # Remove one extra </div> before the );
        # Find the ); line and work backwards to find extra </div>
        close_idx = None
        for i in range(len(lines)-1, -1, -1):
            if lines[i].strip() == ');':
                close_idx = i
                break
        
        # Find the </div> just before );
        for i in range(close_idx-1, max(0, close_idx-5), -1):
            if lines[i].strip() == '</div>':
                print(f"  Removing extra </div> at line {i+1}: {repr(lines[i].rstrip())}")
                del lines[i]
                break
    
    elif strategy == 'move_dialog_inside':
        # The pattern: main </div> closes, then dialog content, then another </div> and );
        # Fix: remove the </div> before the dialog, keep dialog inside, add </div> before );
        
        # Find the ); line
        close_idx = None
        for i in range(len(lines)-1, -1, -1):
            if lines[i].strip() == ');':
                close_idx = i
                break
        
        # Find the </div> just before );
        last_div_idx = None
        for i in range(close_idx-1, max(0, close_idx-5), -1):
            if lines[i].strip() == '</div>':
                last_div_idx = i
                break
        
        # Find the </div> that closes the main wrapper (before the dialog)
        # Look for a comment or Dialog/AlertDialog that starts after a </div>
        dialog_start = None
        for i in range(last_div_idx-1, max(0, last_div_idx-20), -1):
            stripped = lines[i].strip()
            if stripped.startswith('{/*') or stripped.startswith('<Dialog') or stripped.startswith('<AlertDialog'):
                dialog_start = i
            elif stripped == '</div>' and dialog_start is not None:
                # This </div> is the one that incorrectly closes before the dialog
                # Remove it - the dialog is already inside the main div
                print(f"  Removing premature </div> at line {i+1}")
                del lines[i]
                break
    
    elif strategy == 'remove_two_extra_divs':
        # UsersClient has two extra </div> tags
        close_idx = None
        for i in range(len(lines)-1, -1, -1):
            if lines[i].strip() == ');':
                close_idx = i
                break
        
        removed = 0
        i = close_idx - 1
        while i >= 0 and removed < 2:
            if lines[i].strip() == '</div>':
                print(f"  Removing extra </div> at line {i+1}: {repr(lines[i].rstrip())}")
                del lines[i]
                close_idx -= 1  # adjust index after deletion
                removed += 1
            i -= 1
    
    if lines != original:
        with open(filepath, 'w') as f:
            f.writelines(lines)
        print(f"  Fixed: {filepath.split('/')[-1]}")
    else:
        print(f"  No changes made to {filepath.split('/')[-1]}")

# ActivitiesClient: extra </div> before );
print("=== ActivitiesClient ===")
fix_file('src/app/admin/activities/ActivitiesClient.tsx', 'remove_extra_div')

# ReportsClient: extra </div> before );
print("=== ReportsClient ===")
fix_file('src/app/admin/reports/ReportsClient.tsx', 'remove_extra_div')

# UsersClient: two extra </div> before );
print("=== UsersClient ===")
fix_file('src/app/admin/users/UsersClient.tsx', 'remove_two_extra_divs')

# AutomationsClient: dialog outside main div
print("=== AutomationsClient ===")
fix_file('src/app/admin/automations/AutomationsClient.tsx', 'move_dialog_inside')

# InvoicesClient: dialog outside main div
print("=== InvoicesClient ===")
fix_file('src/app/admin/finance/invoices/InvoicesClient.tsx', 'move_dialog_inside')
