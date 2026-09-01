const fs = require('fs');
const file = 'src/app/admin/deals/[id]/components/DealQuickActions.tsx';
let content = fs.readFileSync(file, 'utf-8');

if (!content.includes('useCallModal')) {
  content = content.replace(
    "import { Plus } from 'lucide-react';",
    "import { Plus } from 'lucide-react';\nimport { useCallModal } from '@/context/CallModalContext';\nimport { Phone } from 'lucide-react';"
  );
  
  content = content.replace(
    "export function DealQuickActions({ deal }: DealQuickActionsProps) {",
    "export function DealQuickActions({ deal }: DealQuickActionsProps) {\n  const { openCallModal } = useCallModal();"
  );
  
  const callNowBtn = `
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => openCallModal({ entityId: deal.entityId, dealId: deal.id })}
                    className="min-h-[44px] sm:min-h-[38px] px-3.5 rounded-xl font-bold text-xs gap-2 border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 cursor-pointer transition-all active:scale-95 shadow-sm"
                >
                    <Phone className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span>Call Now</span>
                </Button>
  `;
  
  content = content.replace(
    '<div className="flex flex-wrap items-center gap-2 mb-6">',
    '<div className="flex flex-wrap items-center gap-2 mb-6">\n' + callNowBtn
  );
  
  fs.writeFileSync(file, content);
}
