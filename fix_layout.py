import re

with open('src/app/admin/layout.tsx', 'r') as f:
    content = f.read()

if 'CallModalProvider' not in content:
    content = content.replace("import AdminLayoutClient from './layout-client';", "import AdminLayoutClient from './layout-client';\nimport { CallModalProvider } from '@/context/CallModalContext';")
    with open('src/app/admin/layout.tsx', 'w') as f:
        f.write(content)
