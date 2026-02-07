
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import KanbanBoard from './components/KanbanBoard';
import StageEditor from './components/StageEditor';
import { Workflow, ListChecks } from 'lucide-react';

export default function PipelinePage() {
  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="board" className="flex h-full flex-col">
        <div className="flex items-center justify-between">
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
        <TabsContent value="board" className="flex-grow mt-4 -mx-4 md:-mx-6 lg:-mx-8">
          <KanbanBoard />
        </TabsContent>
        <TabsContent value="editor" className="mt-4">
          <div className="max-w-3xl mx-auto">
            <StageEditor />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
