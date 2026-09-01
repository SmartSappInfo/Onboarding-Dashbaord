import re

with open('src/app/admin/entities/[id]/page.tsx', 'r') as f:
    content = f.read()

if 'useCallModal' not in content:
    content = content.replace("import { useDoc, useFirestore, useMemoFirebase, useCollection, useUser as useFirebaseUser } from '@/firebase';", "import { useDoc, useFirestore, useMemoFirebase, useCollection, useUser as useFirebaseUser } from '@/firebase';\nimport { useCallModal } from '@/context/CallModalContext';")
    with open('src/app/admin/entities/[id]/page.tsx', 'w') as f:
        f.write(content)
