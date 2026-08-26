const fs = require('fs');

const f1 = 'src/app/actions/learning-actions.ts';
let c1 = fs.readFileSync(f1, 'utf-8');
if (!c1.includes('CourseStatus')) {
  c1 = "import type { CourseStatus } from '@/lib/types/learning';\n" + c1;
  fs.writeFileSync(f1, c1);
}

const f2 = 'src/lib/services/course-service.ts';
let c2 = fs.readFileSync(f2, 'utf-8');
if (!c2.includes('CourseStatus }')) {
  c2 = "import type { CourseStatus } from '../types/learning';\n" + c2;
  fs.writeFileSync(f2, c2);
}

