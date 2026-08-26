const fs = require('fs');

const files = [
  'src/app/admin/surveys/[id]/results/components/responses-list-view.tsx',
  'src/app/admin/surveys/[id]/results/page.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/typeof ans === 'object'/g, "typeof ans === 'object' && ans !== null");
  content = content.replace(/ans\.options/g, "((ans as any).options)");
  content = content.replace(/ans\.other/g, "((ans as any).other)");
  content = content.replace(/ans\.option/g, "((ans as any).option)");
  
  // wait, the prompt says no any() or any[].
  // so let's use Record<string, unknown> or cast to {options?: string[], option?: string, other?: string}
  
  content = content.replace(/\(\(ans as any\)/g, "((ans as {options?: string[], option?: string, other?: string})");
  fs.writeFileSync(file, content);
});

