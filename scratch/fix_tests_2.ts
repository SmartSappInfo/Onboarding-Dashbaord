import fs from 'fs';
import path from 'path';

const testDir = 'src/lib/__tests__';
const scriptsDir = 'scripts';

function processFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Add entityType: 'institution' before globalTags or workspaceTags if not exists
  content = content.replace(/(?<!entityType:\s*['"][a-zA-Z]+['"],\s*)(globalTags:)/g, "entityType: 'institution',\n    $1");
  content = content.replace(/(?<!entityType:\s*['"][a-zA-Z]+['"],\s*)(workspaceTags:)/g, "entityType: 'institution',\n    $1");
  
  // Add entityContacts: [] if missing (since we made it required in FER-01)
  content = content.replace(/(?<!entityContacts:\s*\[[^\]]*\],\s*)(globalTags:)/g, "entityContacts: [],\n    $1");
  
  fs.writeFileSync(filePath, content);
}

const testFiles = fs.readdirSync(testDir).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
for (const file of testFiles) {
  processFile(path.join(testDir, file));
}

const scriptFiles = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.ts'));
for (const file of scriptFiles) {
  processFile(path.join(scriptsDir, file));
}

console.log('Fixed missing entityType and entityContacts in tests.');
