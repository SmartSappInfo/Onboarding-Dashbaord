const fs = require('fs');

function fixImport(file, name) {
  let content = fs.readFileSync(file, 'utf-8');
  if (content.includes(name) && !content.includes(\`\${name},\`) && !content.includes(\`\${name} \`)) {
     // rudimentary check, let's just do a blanket replace where learning types are imported
     content = content.replace("import type { Course, ", "import type { Course, CourseStatus, ");
     content = content.replace("import { type Course, ", "import { type Course, type CourseStatus, ");
     fs.writeFileSync(file, content);
  }
}

let file = 'src/app/actions/learning-actions.ts';
let content = fs.readFileSync(file, 'utf-8');
content = content.replace("Course, ", "Course, CourseStatus, ");
fs.writeFileSync(file, content);

file = 'src/lib/services/course-service.ts';
content = fs.readFileSync(file, 'utf-8');
content = content.replace("Course, ", "Course, CourseStatus, ");
fs.writeFileSync(file, content);

