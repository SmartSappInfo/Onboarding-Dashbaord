const fs = require('fs');
const file = 'src/app/admin/entities/components/EntityCard.tsx';
let content = fs.readFileSync(file, 'utf-8');

if (!content.includes('useCallModal')) {
  // Add import
  content = content.replace(
    "import Link from 'next/link';",
    "import Link from 'next/link';\nimport { useCallModal } from '@/context/CallModalContext';\nimport { Phone } from 'lucide-react';"
  );
  
  // Add hook
  content = content.replace(
    "const EntityCard = ({ entity",
    "const EntityCard = ({ entity"
  );
  
  content = content.replace(
    "export function EntityCard({ entity, onUpdate, onDelete }: EntityCardProps) {",
    "export function EntityCard({ entity, onUpdate, onDelete }: EntityCardProps) {\n  const { openCallModal } = useCallModal();"
  );
  
  // Add dropdown menu item
  const menuItem = `
                                <DropdownMenuItem onClick={() => openCallModal({ entityId: entity.entityId })} className="rounded-lg p-2 gap-2.5 text-left cursor-pointer">
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
