const fs = require('fs');
const file = 'src/lib/call-centre-actions.ts';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(
  "import type { CallOutcomeAutomation, ScriptActionParams } from './types';",
  "import type { CallOutcomeAutomation, ScriptActionParams, CallQueueItem } from './types';"
);

fs.writeFileSync(file, content);
