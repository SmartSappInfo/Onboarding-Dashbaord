const fs = require('fs');
const file = 'src/app/admin/pipeline/components/DealCard.tsx';
let content = fs.readFileSync(file, 'utf-8');

if (!content.includes('const { openCallModal } = useCallModal();')) {
  content = content.replace(
    "export default function DealCard({ deal, stage, isOverlay, onDelete, taskStats }: DealCardProps) {",
    "export default function DealCard({ deal, stage, isOverlay, onDelete, taskStats }: DealCardProps) {\n  const { openCallModal } = useCallModal();"
  );
  
  const menuItem = `
                    <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); openCallModal({ entityId: deal.entityId, dealId: deal.id }); }}
                        className="rounded-lg p-2 gap-2.5 cursor-pointer"
                    >
                        <Phone className="h-3.5 w-3.5 text-indigo-500" />
                        <span className="font-bold text-xs">Call Now</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-1" />`;
  
  content = content.replace(
    '<DropdownMenuSeparator className="my-1" />',
    menuItem
  );
  
  fs.writeFileSync(file, content);
}
