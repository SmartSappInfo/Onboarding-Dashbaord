import re

# 4. call-centre-actions.ts
p4 = 'src/lib/call-centre-actions.ts'
with open(p4, 'r') as f:
    c4 = f.read()
if 'CallQueueItem' not in c4:
    c4 = c4.replace(
        "import type { CallScript, CallCampaign, CallOutcomeAutomation } from './types';", 
        "import type { CallScript, CallCampaign, CallOutcomeAutomation, CallQueueItem } from './types';"
    )
    with open(p4, 'w') as f:
        f.write(c4)
