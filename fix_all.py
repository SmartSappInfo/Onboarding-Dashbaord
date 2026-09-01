import re

def fix_file(filepath, replacements):
    with open(filepath, 'r') as f:
        content = f.read()
    
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new)
        else:
            print(f"Warning: '{old}' not found in {filepath}")
            
    with open(filepath, 'w') as f:
        f.write(content)

# 1. page.tsx
fix_file('src/app/admin/entities/[id]/page.tsx', [
    ("import { useUser } from '@/firebase';", "import { useUser } from '@/firebase';\nimport { useCallModal } from '@/context/CallModalContext';")
])

# 2. layout.tsx
fix_file('src/app/admin/layout.tsx', [
    ("import { Toaster } from '@/components/ui/toaster';", "import { Toaster } from '@/components/ui/toaster';\nimport { CallModalProvider } from '@/context/CallModalContext';")
])

# 3. DealCard.tsx
# Need to remove duplicate openCallModal if it exists
def remove_dup_dealcard():
    with open('src/app/admin/pipeline/components/DealCard.tsx', 'r') as f:
        lines = f.readlines()
    
    out = []
    count = 0
    for line in lines:
        if 'const { openCallModal } = useCallModal();' in line:
            count += 1
            if count > 1:
                continue
        out.append(line)
        
    with open('src/app/admin/pipeline/components/DealCard.tsx', 'w') as f:
        f.writelines(out)
        
remove_dup_dealcard()

# 4. CallNowModal.tsx (CallCampaignStatus and line 129 undefined return)
fix_file('src/components/call-centre/CallNowModal.tsx', [
    ("c.status === 'active'", "c.status === 'published'"),
    ("if (!queueItem || !user || !selectedCampaign) return;", "if (!queueItem || !user || !selectedCampaign) return { ok: false, error: 'Not initialized' };")
])

# 5. call-centre-actions.ts CallQueueItem
fix_file('src/lib/call-centre-actions.ts', [
    ("import type { CallOutcomeAutomation, ScriptActionParams } from './types';", "import type { CallOutcomeAutomation, ScriptActionParams, CallQueueItem } from './types';")
])

# 6. call-centre-service.ts
fix_file('src/lib/services/call-centre-service.ts', [
    ("organizationId: campaign.organizationId,", "organizationId: campaign?.organizationId || '',"),
    ("workspaceId: campaign.workspaceId,", "workspaceId: campaign?.workspaceId || '',")
])

print("Done")
