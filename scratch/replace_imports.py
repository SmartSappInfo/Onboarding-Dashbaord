import os
import glob

# Search in the src directory
path = "src/**/*.tsx"
files = glob.glob(path, recursive=True)
path2 = "src/**/*.ts"
files.extend(glob.glob(path2, recursive=True))

for file in files:
    try:
        with open(file, 'r', encoding='utf-8') as f:
            content = f.read()

        if 'schools/components' in content:
            # Replace paths pointing to schools/components
            # Examples:
            # import ... from '../../schools/components/...'
            # import ... from '@/app/admin/schools/components/...'
            new_content = content.replace('schools/components', 'entities/components')
            
            with open(file, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated {file}")
            
    except Exception as e:
        print(f"Error processing {file}: {e}")

