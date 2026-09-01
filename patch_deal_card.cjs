const fs = require('fs');
const file = 'src/app/admin/pipeline/components/DealCard.tsx';
let content = fs.readFileSync(file, 'utf-8');

if (!content.includes('useCallModal')) {
  content = content.replace(
    "import DuplicateDealModal from './DuplicateDealModal';",
    "import DuplicateDealModal from './DuplicateDealModal';\nimport { useCallModal } from '@/context/CallModalContext';\nimport { Phone } from 'lucide-react';"
  );
  
  content = content.replace(
    "export default function DealCard({",
    "export default function DealCard({\n  const { openCallModal } = useCallModal();"
  );
  
  // Need to place it after 'export default function DealCard({' wait, wait. Let's see the signature.
}
