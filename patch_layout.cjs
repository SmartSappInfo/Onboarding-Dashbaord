const fs = require('fs');
const file = 'src/app/admin/layout.tsx';
let content = fs.readFileSync(file, 'utf-8');

if (!content.includes('CallModalProvider')) {
  // Insert import
  content = content.replace(
    "import { Toaster } from '@/components/ui/toaster';",
    "import { Toaster } from '@/components/ui/toaster';\nimport { CallModalProvider } from '@/context/CallModalContext';"
  );
  
  // Wrap children
  content = content.replace(
    "{children}",
    "<CallModalProvider>{children}</CallModalProvider>"
  );
  
  fs.writeFileSync(file, content);
}
