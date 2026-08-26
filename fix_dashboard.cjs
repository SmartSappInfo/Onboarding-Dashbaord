const fs = require('fs');
const file = 'src/app/portal/[slug]/dashboard/PortalMemberDashboardClient.tsx';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(
  "{course.totalLessons} Lessons • {course.estimatedHours}h",
  "{(course as {totalLessons?: number}).totalLessons || 0} Lessons • {(course as {estimatedHours?: number}).estimatedHours || 0}h"
);

fs.writeFileSync(file, content);
