const fs = require('fs');
const file = 'src/app/admin/messaging/call-centre/scripts/new/ScriptBuilderClient.tsx';
let content = fs.readFileSync(file, 'utf-8');

// Fix limit import
content = content.replace("orderBy, getDocs } from 'firebase/firestore';", "orderBy, getDocs, limit } from 'firebase/firestore';");

// Fix organizationId to activeOrganizationId
content = content.replace(/where\('organizationId', '==', organizationId\)/g, "where('organizationId', '==', activeOrganizationId)");
content = content.replace(/\[firestore, organizationId\]/g, "[firestore, activeOrganizationId]");
content = content.replace(/if \(\!firestore \|\| \!organizationId\)/g, "if (!firestore || !activeOrganizationId)");

fs.writeFileSync(file, content);
