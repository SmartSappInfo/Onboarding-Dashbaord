const fs = require('fs');
const file = 'src/app/admin/entities/components/EntityCard.tsx';
let content = fs.readFileSync(file, 'utf-8');

if (!content.includes('openCallModal')) {
  content = content.replace(
    "export default function EntityCard({ entity, isOverlay }: EntityCardProps) {",
    "export default function EntityCard({ entity, isOverlay }: EntityCardProps) {\n  const { openCallModal } = useCallModal();"
  );
  fs.writeFileSync(file, content);
}
