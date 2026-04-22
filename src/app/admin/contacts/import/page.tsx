import { Metadata } from 'next';
import { ImportWizardManager } from './components/ImportWizardManager';

export const metadata: Metadata = {
  title: 'Import Contacts | SmartSapp',
  description: 'Advanced Entity Import with Data Mapping',
};

export default function ImportContactsPage() {
  return (
    <div className="flex flex-col w-full h-full min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-transparent">
      <div className="max-w-6xl w-full mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Import Contacts</h1>
          <p className="text-muted-foreground mt-2">
            Upload CSV files, map columns, and safely bulk-add entities into your workspace.
          </p>
        </div>
        
        {/* Wizard UI Client Component */}
        <ImportWizardManager />
      </div>
    </div>
  );
}
