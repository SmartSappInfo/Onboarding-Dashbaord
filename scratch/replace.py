import os

replacements = {
    "/admin/schools": "/admin/entities",
    "SchoolCard": "EntityCard",
    "ai-school-generator": "ai-entity-generator",
    "school-details-modal": "entity-details-modal",
    "SchoolBillingTab": "EntityBillingTab"
}

def replace_in_file(filepath):
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

def walk_dir(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(('.ts', '.tsx')):
                replace_in_file(os.path.join(root, file))

if __name__ == "__main__":
    walk_dir('./src')
