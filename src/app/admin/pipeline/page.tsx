'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import KanbanBoard from './components/KanbanBoard';
import StageEditor from './components/StageEditor';
import { Workflow, ListChecks } from 'lucide-react';

export default function PipelinePage() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Tabs defaultValue="board" className="flex h-full flex-col">
        <div className="shrink-0 border-b p-4">
          <TabsList>
            <TabsTrigger value="board">
              <Workflow className="mr-2 h-4 w-4" />
              Pipeline View
            </TabsTrigger>
            <TabsTrigger value="editor">
              <ListChecks className="mr-2 h-4 w-4" />
              Edit Stages
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="flex-grow overflow-auto">
            <TabsContent value="board" className="m-0 h-full">
              <KanbanBoard />
            </TabsContent>
            <TabsContent value="editor" className="m-0">
              <div className="max-w-3xl mx-auto p-4 sm:p-6 md:p-8">
                <StageEditor />
              </div>
            </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
