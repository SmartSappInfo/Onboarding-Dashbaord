const fs = require('fs');
const file = 'src/lib/services/call-centre-service.ts';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(
  "const primary = contacts.find(c => c.isPrimary) || contacts[0];",
  "const primary = contacts.find((c: any) => c.isPrimary) || contacts[0];"
);
content = content.replace(
  "organizationId: campaign.organizationId,",
  "organizationId: campaign?.organizationId || '',"
);
content = content.replace(
  "workspaceId: campaign.workspaceId,",
  "workspaceId: campaign?.workspaceId || '',"
);
fs.writeFileSync(file, content);
