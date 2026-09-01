import re

# 1. page.tsx
p1 = 'src/app/admin/entities/[id]/page.tsx'
with open(p1, 'r') as f:
    c1 = f.read()
c1 = c1.replace("openCallModal({ entityId: params.id })", "openCallModal({ entityId: params.id as string })")
with open(p1, 'w') as f:
    f.write(c1)

# 2. CallNowModal.tsx
p2 = 'src/components/call-centre/CallNowModal.tsx'
with open(p2, 'r') as f:
    c2 = f.read()
c2 = c2.replace("c.status === 'active'", "c.status === 'running'")
with open(p2, 'w') as f:
    f.write(c2)

# 3. call-centre-actions.ts
p3 = 'src/lib/call-centre-actions.ts'
with open(p3, 'r') as f:
    c3 = f.read()
if 'CallQueueItem' not in c3.split('\n')[4]:
    c3 = c3.replace(
        "import type { CallScript, CallCampaign, CallOutcomeAutomation } from './types';", 
        "import type { CallScript, CallCampaign, CallOutcomeAutomation, CallQueueItem } from './types';"
    )
    with open(p3, 'w') as f:
        f.write(c3)
