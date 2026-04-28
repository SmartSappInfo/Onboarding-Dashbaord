import fs from 'fs';
import path from 'path';

function fixShebang(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      fixShebang(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      if (lines.length >= 2 && lines[0] === '// @ts-nocheck' && lines[1].startsWith('#!')) {
        lines[0] = lines[1];
        lines[1] = '// @ts-nocheck';
        fs.writeFileSync(fullPath, lines.join('\n'));
      }
    }
  }
}

fixShebang('scripts');
console.log('Fixed shebangs.');
