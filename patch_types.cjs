const fs = require('fs');
const file = 'src/lib/types.ts';
let content = fs.readFileSync(file, 'utf-8');

if (!content.includes('isManualEnrolment?: boolean;')) {
  content = content.replace(
    '  id: string;',
    '  id: string;\n  isManualEnrolment?: boolean;'
  );
  fs.writeFileSync(file, content);
}
