import re
import os

# 1. page.tsx
p1 = 'src/app/admin/entities/[id]/page.tsx'
with open(p1, 'r') as f:
    c1 = f.read()
if 'import { useCallModal }' not in c1:
    c1 = c1.replace("import { useDoc", "import { useCallModal } from '@/context/CallModalContext';\nimport { useDoc")
    with open(p1, 'w') as f:
        f.write(c1)

# 2. layout.tsx
p2 = 'src/app/admin/layout.tsx'
with open(p2, 'r') as f:
    c2 = f.read()
if 'import { CallModalProvider }' not in c2:
    c2 = c2.replace("import AdminLayoutClient", "import { CallModalProvider } from '@/context/CallModalContext';\nimport AdminLayoutClient")
    with open(p2, 'w') as f:
        f.write(c2)

# 3. CallNowModal.tsx
p3 = 'src/components/call-centre/CallNowModal.tsx'
with open(p3, 'r') as f:
    c3 = f.read()
c3 = c3.replace("c.status === 'published'", "c.status === 'active'")
with open(p3, 'w') as f:
    f.write(c3)

# 4. call-centre-actions.ts
p4 = 'src/lib/call-centre-actions.ts'
with open(p4, 'r') as f:
    c4 = f.read()
if 'CallQueueItem' not in c4.split("import type { CallOutcomeAutomation")[1].split("}")[0]:
    c4 = c4.replace("import type { CallOutcomeAutomation, ScriptActionParams } from './types';", "import type { CallOutcomeAutomation, ScriptActionParams, CallQueueItem } from './types';")
    # if it still didn't match, maybe the import is different
    if "ScriptActionParams } from './types'" not in c4:
        c4 = "import type { CallQueueItem } from './types';\n" + c4
    with open(p4, 'w') as f:
        f.write(c4)

