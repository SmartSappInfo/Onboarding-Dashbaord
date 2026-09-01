const fs = require('fs');
const file = 'src/components/call-centre/CallNowModal.tsx';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(
  "\\`Calling \\${queueItem?.contactName || queueItem?.entityName}\\`",
  "`Calling ${queueItem?.contactName || queueItem?.entityName}`"
);

fs.writeFileSync(file, content);
