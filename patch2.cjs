const fs = require('fs');
const file = 'src/app/admin/messaging/call-centre/scripts/components/InteractiveScriptView.tsx';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(
  "} else if (actionType === 'UPDATE_CONTACT') {",
  "} else if (actionType === 'ADD_TO_MEMBERSHIP_PORTAL') {\n          details += ` (Portal ID: ${config.portalId || 'Not configured'} - Role: ${config.portalRole || 'member'})`;\n        } else if (actionType === 'UPDATE_CONTACT') {"
);

fs.writeFileSync(file, content);
