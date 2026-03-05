'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import KanbanBoard from './components/KanbanBoard';
import StageEditor from './components/StageEditor';
import { Workflow, ListChecks } from 'lucide-react';

export default function PipelinePage() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 p-4 sm:p-6 md:p-8 bg-background border-b shadow-sm">
        <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-black tracking-tight text-foreground uppercase">Onboarding Pipeline</h1>
            <p className="text-muted-foreground font-medium text-sm mt-1">Visual Kanban management for tracking school progression from initial signup to go-live.</p>
        </div>
      </div>
      <Tabs defaultValue="board" className="flex h-full flex-col">
        <div className="shrink-0 border-b p-4">
          <TabsList className="bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="board" className="rounded-lg font-bold">
              <Workflow className="mr-2 h-4 w-4" />
              Pipeline View
            </TabsTrigger>
            <TabsTrigger value="editor" className="rounded-lg font-bold">
              <ListChecks className="mr-2 h-4 w-4" />
              Workflow Configuration
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
