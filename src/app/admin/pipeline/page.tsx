
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import KanbanBoard from './components/KanbanBoard';
import StageEditor from './components/StageEditor';
import { Workflow, ListChecks } from 'lucide-react';

export default function PipelinePage() {
  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="board" className="flex h-full flex-col">
        <div className="flex items-center justify-between px-4 sm:px-6 md:px-8 pt-4">
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
        <TabsContent value="board" className="flex-grow mt-4">
          <KanbanBoard />
        </TabsContent>
        <TabsContent value="editor" className="mt-4 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-4 sm:p-6 md:p-8">
            <StageEditor />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
