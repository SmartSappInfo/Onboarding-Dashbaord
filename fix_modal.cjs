const fs = require('fs');
const file = 'src/components/call-centre/CallNowModal.tsx';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(/\\\`Outcome "\\\$\{outcome\}" logged successfully\.\\\`/g, '`Outcome "${outcome}" logged successfully.`');
content = content.replace(/\\\`Calling \\\$\{queueItem\?\\.contactName \|\| queueItem\?\\.entityName\}\\\`/g, '`Calling ${queueItem?.contactName || queueItem?.entityName}`');

fs.writeFileSync(file, content);
