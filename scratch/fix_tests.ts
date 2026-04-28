import fs from 'fs';
import path from 'path';

const testDir = 'src/lib/__tests__';
const scriptsDir = 'scripts';

function processFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace entityType in industryData
  content = content.replace(/industryData:\s*{([^}]*?)entityType:\s*['"]institution['"],/g, 'industryData: {$1');
  content = content.replace(/industryData:\s*{([^}]*?)entityType:\s*['"]person['"],/g, 'industryData: {$1');
  
  // Sometimes entityType is just there
  content = content.replace(/entityType:\s*['"]institution['"],/g, '');
  content = content.replace(/entityType:\s*['"]person['"],/g, '');
  
  content = content.replace(/companySize:/g, 'capacity:');
  
  // Comment out finance/root fields that are strictly checked in industryData
  content = content.replace(/(\s+)(planType:)/g, '$1// $2');
  content = content.replace(/(\s+)(features:)/g, '$1// $2');
  content = content.replace(/(\s+)(signupDate:)/g, '$1// $2');
  
  // Fix specific script errors
  content = content.replace(/industryData\.companySize/g, 'industryData.capacity');
  content = content.replace(/industryData\.planType/g, '(industryData as any).planType');
  content = content.replace(/industryData\.features/g, '(industryData as any).features');
  content = content.replace(/industryData\.signupDate/g, '(industryData as any).signupDate');
  
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

console.log('Fixed test files and scripts.');
