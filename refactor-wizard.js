const fs = require('fs');

let content = fs.readFileSync('src/app/admin/messaging/campaigns/components/campaign-wizard.tsx', 'utf8');

// Replace standard { condition && ( with { condition ? ( ... ) : null }
// We can do this with a basic state machine or regex for simple cases.
// Actually, it's easier to just use standard text replacements.

// Add dynamic import
content = content.replace(
  "import QuickTemplateDialog from '../../components/quick-template-dialog';",
  "import dynamic from 'next/dynamic';\nconst QuickTemplateDialog = dynamic(() => import('../../components/quick-template-dialog'), { ssr: false });"
);

fs.writeFileSync('src/app/admin/messaging/campaigns/components/campaign-wizard.tsx', content);
