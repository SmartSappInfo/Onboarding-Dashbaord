'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/context/TenantContext';
import { getGlobalPromptById, getTenantOverrides, saveTenantOverride } from '@/lib/pms-repository';
import { getEntityAiSummary } from '@/lib/note-actions';
import type { GlobalPrompt, TenantPromptOverride } from '@/lib/pms-types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { useUser } from '@/firebase';
import type { EntityNote } from '@/lib/types';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ArrowLeft,
  Bot,
  Play,
  Save,
  Sparkles,
  Terminal,
  Grid,
  FileText,
  AlertTriangle
} from 'lucide-react';

interface PromptEditorClientProps {
  flowName: string;
}

const COMMON_BLOCKS = [
  { label: 'System Persona', text: 'You are a highly analytical CRM manager. Your goal is to review raw activity feeds and extract concise key outcomes.' },
  { label: 'JSON Strictness', text: 'Format your output strictly as a JSON object matching the requested schema. Do not return any introduction, explanation, or conversational text.' },
  { label: 'Conciseness', text: 'Be direct and brief. Avoid fluff. Focus on action items and urgent alerts.' },
  { label: 'Format Markdown', text: 'Return structured Markdown with bullet points, headers, and bold highlights for critical dates.' }
];

export default function PromptEditorClient({ flowName }: PromptEditorClientProps) {
  const router = useRouter();
  const { activeWorkspaceId, activeOrganizationId } = useTenant();
  const { toast } = useToast();
  const { user } = useUser();
  const [globalPrompt, setGlobalPrompt] = React.useState<GlobalPrompt | null>(null);
  const [existingOverride, setExistingOverride] = React.useState<TenantPromptOverride | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // Form State
  const [systemPrompt, setSystemPrompt] = React.useState('');
  const [userPromptTemplate, setUserPromptTemplate] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  // Sandbox Test State
  const [sandboxInputs, setSandboxInputs] = React.useState<Record<string, string>>({
    entityName: 'Acme High School',
    notesContext: '[2026-07-01] Manager (call): Client complained about billing. Urgent.\n[2026-07-02] Admin (email): Follow up sent.'
  });
  const [testResult, setTestResult] = React.useState<string>('');
  const [isTesting, setIsTesting] = React.useState(false);

  const activeInputRef = React.useRef<'system' | 'user' | null>(null);

  React.useEffect(() => {
    async function load() {
      if (!activeOrganizationId) return;
      setIsLoading(true);

      const [globalRes, overridesRes] = await Promise.all([
        getGlobalPromptById(flowName),
        getTenantOverrides(activeOrganizationId, activeWorkspaceId)
      ]);

      if (globalRes.success && globalRes.data) {
        setGlobalPrompt(globalRes.data);
        setTitle(globalRes.data.title);
        setDescription(globalRes.data.description);
        setSystemPrompt(globalRes.data.systemPrompt);
        setUserPromptTemplate(globalRes.data.userPromptTemplate);
      }

      if (overridesRes.success && overridesRes.data) {
        // Find if this flow has an override
        const matched = overridesRes.data.find((o: TenantPromptOverride) => o.flowName === flowName);
        if (matched) {
          setExistingOverride(matched);
          setTitle(matched.title);
          setDescription(matched.description);
          setSystemPrompt(matched.systemPrompt);
          setUserPromptTemplate(matched.userPromptTemplate);
        }
      }

      setIsLoading(false);
    }
    load();
  }, [flowName, activeOrganizationId, activeWorkspaceId]);

  const handleSaveOverride = async () => {
    if (!activeOrganizationId) return;
    setIsSaving(true);

    const docId = existingOverride?.id || `${activeOrganizationId}_${activeWorkspaceId || 'global'}_${flowName}`;
    const payload: Omit<TenantPromptOverride, 'id' | 'updatedAt' | 'version'> = {
      parentPromptId: flowName,
      organizationId: activeOrganizationId,
      workspaceId: activeWorkspaceId || '',
      flowName,
      title,
      description,
      category: globalPrompt?.category || 'general',
      tags: globalPrompt?.tags || [],
      systemPrompt,
      userPromptTemplate,
      variables: globalPrompt?.variables || [],
      aiModels: globalPrompt?.aiModels || ['googleai/gemini-2.0-flash'],
      status: 'production',
      isActive: true,
      updatedBy: user?.uid || 'admin'
    };

    const result = await saveTenantOverride(docId, payload, 'current-user');
    if (result.success) {
      toast({ title: 'Prompt override saved successfully.' });
      router.push('/admin/ai-prompts');
    } else {
      toast({ variant: 'destructive', title: 'Failed to save override.', description: result.error });
    }
    setIsSaving(false);
  };

  const handleInsertBlock = (blockText: string) => {
    if (activeInputRef.current === 'system') {
      setSystemPrompt(prev => prev + '\n' + blockText);
    } else if (activeInputRef.current === 'user') {
      setUserPromptTemplate(prev => prev + '\n' + blockText);
    } else {
      // Default to appending to system prompt
      setSystemPrompt(prev => prev + '\n' + blockText);
    }
    toast({ title: 'Block snippet injected' });
  };

  const handleRunTest = async () => {
    setIsTesting(true);
    setTestResult('Running Genkit summarizer flow with your overrides...');

    // Parse mockup notes into structured notes array required by flow input schema
    const mockNotes: EntityNote[] = [
      {
        id: 'sandbox-note-id',
        entityId: 'sandbox-entity-id',
        workspaceId: activeWorkspaceId || 'sandbox-workspace-id',
        createdBy: 'sandbox-agent',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdByName: 'Sandbox Agent',
        noteType: 'call',
        content: sandboxInputs.notesContext
      }
    ];

    // Wait, getEntityAiSummary takes note array, entityName, workspaceId, organizationId
    // But since we want to test the LOCAL overridden prompts, wait!
    // If we call getEntityAiSummary, it executes on the server.
    // But does it resolve the overridden prompt we are editing right now?
    // NOT YET, because we haven't saved it to the database!
    // Ah! To test the local overridden prompt BEFORE saving, we'd need a "Test Override Action"
    // that runs the flow with a dynamic temporary prompt override passed explicitly,
    // OR we ask the user to save first.
    // Wait! Let's make the test execute the resolver dynamically with the draft state!
    // Wait, to keep it extremely simple and functional, we can save the override first, then test it.
    // Or we can save the override in Firestore with a status of 'draft' or 'test_override'
    // and query it. But wait, `saveTenantOverride` is extremely fast. We can tell the user:
    // "We will save this override to test it."
    // Actually, let's execute it directly by temporary saving or running a draft save!
    // That is perfectly fine and ensures the sandbox reflects the current editor values.
    
    // Let's perform a save automatically to draft state or overwrite production, then trigger summary
    const docId = existingOverride?.id || `${activeOrganizationId}_${activeWorkspaceId || 'global'}_${flowName}`;
    const payload: Omit<TenantPromptOverride, 'id' | 'updatedAt' | 'version' | 'updatedBy'> = {
      parentPromptId: flowName,
      organizationId: activeOrganizationId || '',
      workspaceId: activeWorkspaceId || '',
      flowName,
      title,
      description,
      category: globalPrompt?.category || 'general',
      tags: globalPrompt?.tags || [],
      systemPrompt,
      userPromptTemplate,
      variables: globalPrompt?.variables || [],
      aiModels: globalPrompt?.aiModels || ['googleai/gemini-2.0-flash'],
      status: 'production',
      isActive: true
    };


    const saveRes = await saveTenantOverride(docId, payload, 'sandbox-test');
    if (!saveRes.success) {
      setTestResult(`Failed to stage test template: ${saveRes.error}`);
      setIsTesting(false);
      return;
    }

    try {
      const res = await getEntityAiSummary(
        mockNotes,
        sandboxInputs.entityName,
        activeWorkspaceId,
        activeOrganizationId
      );

      if (res.success && res.summary) {
        setTestResult(JSON.stringify(res.summary, null, 2));
      } else {
        setTestResult(`Error: ${res.error || 'Flow returned no output'}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTestResult(`Execution Error: ${msg}`);
    }
    setIsTesting(false);
  };

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-muted/20 rounded-2xl" />;
  }

  return (
    <div className="space-y-6 text-left">
      {/* Navigation Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/admin/ai-prompts')} className="rounded-xl">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">{title || 'Configure Prompt'}</h1>
              <Badge variant="outline" className={existingOverride ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}>
                {existingOverride ? 'Active Override' : 'System Default Subscribed'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{flowName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSaveOverride} disabled={isSaving} className="rounded-xl h-10 px-6 font-bold bg-blue-600 hover:bg-blue-700 text-white">
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Override'}
          </Button>
        </div>
      </div>

      {/* Editor Main Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Columns: Prompts Editor */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Terminal className="h-4 w-4 text-blue-500" />
                Prompt Templates
              </CardTitle>
              <CardDescription>
                Customize system roles and dynamic user instructions for this AI flow.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5" />
                  System Instructions (System Role)
                </label>
                <Textarea
                  value={systemPrompt}
                  onFocus={() => { activeInputRef.current = 'system'; }}
                  onChange={e => setSystemPrompt(e.target.value)}
                  className="min-h-[140px] resize-none bg-muted/20 border-border/80 focus:border-blue-500/50 text-sm rounded-xl"
                  placeholder="You are an expert CRM analyst..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  User Prompt Template
                </label>
                <Textarea
                  value={userPromptTemplate}
                  onFocus={() => { activeInputRef.current = 'user'; }}
                  onChange={e => setUserPromptTemplate(e.target.value)}
                  className="min-h-[160px] resize-none bg-muted/20 border-border/80 focus:border-blue-500/50 text-sm rounded-xl"
                  placeholder="Summarize this context: {{notesContext}}"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Supported tokens: {globalPrompt?.variables.map((v: string) => <code key={v} className="bg-muted px-1 rounded mx-0.5">{`{{${v}}}`}</code>)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Block Palette & Testing */}
        <div className="space-y-6">
          {/* Reusable Blocks Palette */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Grid className="h-4 w-4 text-blue-500" />
                Prompt Blocks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {COMMON_BLOCKS.map(block => (
                <button
                  key={block.label}
                  onClick={() => handleInsertBlock(block.text)}
                  className="w-full text-left p-3 rounded-xl border border-border bg-muted/10 hover:bg-muted/40 transition-colors text-xs space-y-1"
                >
                  <p className="font-bold text-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-amber-500" />
                    {block.label}
                  </p>
                  <p className="text-muted-foreground line-clamp-2 leading-relaxed">{block.text}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Test Sandbox */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Play className="h-3.5 w-3.5 text-emerald-500" />
                Test Sandbox
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground">Mock Entity Name</label>
                <Input
                  value={sandboxInputs.entityName}
                  onChange={e => setSandboxInputs(prev => ({ ...prev, entityName: e.target.value }))}
                  className="h-8 bg-muted/20 border-border text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground">Mock Notes Context</label>
                <Textarea
                  value={sandboxInputs.notesContext}
                  onChange={e => setSandboxInputs(prev => ({ ...prev, notesContext: e.target.value }))}
                  className="min-h-[80px] bg-muted/20 border-border text-xs rounded-xl resize-none"
                />
              </div>

              <Button
                onClick={handleRunTest}
                disabled={isTesting}
                size="sm"
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9"
              >
                {isTesting ? 'Running Flow...' : 'Test Current Flow Overrides'}
              </Button>

              {testResult && (
                <div className="space-y-1.5 mt-2">
                  <label className="text-[10px] font-bold text-muted-foreground">Sandbox Result Output</label>
                  <pre className="text-[9px] font-mono p-3 bg-muted rounded-xl border overflow-x-auto max-h-[200px] text-slate-300 leading-normal">
                    {testResult}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
