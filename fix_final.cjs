const fs = require('fs');

const file1 = 'src/app/admin/messaging/call-centre/scripts/new/ScriptBuilderClient.tsx';
let c1 = fs.readFileSync(file1, 'utf-8');
c1 = c1.replace(/orderBy, getDocs } from 'firebase\/firestore';/, "orderBy, getDocs, limit } from 'firebase/firestore';");
if (!c1.includes('limit } from \'firebase/firestore\'')) {
  c1 = c1.replace("orderBy } from 'firebase/firestore';", "orderBy, limit } from 'firebase/firestore';");
}
fs.writeFileSync(file1, c1);
