
'use client';

import ModuleEditor from './components/ModuleEditor';
import ZoneEditor from './components/ZoneEditor';
import RoleEditor from './components/RoleEditor';
import WorkspaceEditor from './components/WorkspaceEditor';

export default function SettingsClient() {
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 space-y-12 bg-muted/5 text-left">
      <div className="max-w-7xl mx-auto space-y-12">
        <WorkspaceEditor />

        <div className="space-y-8">
          <RoleEditor />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ModuleEditor />
            <ZoneEditor />
          </div>
        </div>
      </div>
    </div>
  );
}
