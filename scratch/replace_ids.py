import os

replacements = {
    "schoolId": "entityId",
    "schoolName": "entityName",
    "schoolSlug": "entitySlug"
}

def replace_in_file(filepath):
    # Some legacy files like migration scripts or old audit summaries shouldn't probably be touched, but doing a global rename is standard for this architecture shift.
    # Exclude files in .git or node_modules
    if "node_modules" in filepath or ".git" in filepath:
        return
        
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        modified = False
        for old_str, new_str in replacements.items():
            if old_str in content:
                content = content.replace(old_str, new_str)
                modified = True
                
        if modified:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated {filepath}")
    except Exception as e:
        print(f"Failed to process {filepath}: {e}")

def walk_dir(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(('.ts', '.tsx')):
                replace_in_file(os.path.join(root, file))

if __name__ == "__main__":
    walk_dir('./src')
