const fs = require('fs');

const f1 = 'src/app/admin/entities/[id]/page.tsx';
let c1 = fs.readFileSync(f1, 'utf-8');
if (!c1.includes('import { useCallModal }')) {
  c1 = c1.replace(
    "import { useUser } from '@/firebase';",
    "import { useUser } from '@/firebase';\nimport { useCallModal } from '@/context/CallModalContext';"
  );
  fs.writeFileSync(f1, c1);
}

const f2 = 'src/app/admin/entities/components/EntityCard.tsx';
let c2 = fs.readFileSync(f2, 'utf-8');
c2 = c2.replace(
  "export function EntityCard({ entity, onUpdate, onDelete }: EntityCardProps) {",
  "export function EntityCard({ entity, onUpdate, onDelete }: EntityCardProps) {\n  const { openCallModal } = useCallModal();"
);
// Wait, I already added it but there was an error: 'openCallModal' not found in EntityCard. Let's see if it's there.
