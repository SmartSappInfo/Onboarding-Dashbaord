'use client';

import * as React from 'react';
import { collection, query, where, deleteDoc, doc, addDoc, updateDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTenant } from '@/context/TenantContext';
import { MESSAGING_TRIGGERS } from '@/lib/messaging-triggers';
import type { MessageTemplate, MessagingTrigger, TemplateCategory, MessageChannel, VariableDefinition, MessageStyle, WorkspaceEntity, Meeting, Survey, PDFForm } from '@/lib/types';
import { TriggerCard } from './components/TriggerCard';
import { TemplateWorkshop } from '../templates/components/template-workshop';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { generateContactVariableDefinitions } from '@/lib/contact-variable-definitions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function MessagingTriggersPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { activeWorkspaceId } = useWorkspace();
  const { activeOrganizationId } = useTenant();

  // State for customizing a trigger
  const [isAdding, setIsAdding] = React.useState(false);
  const [editingTemplate, setEditingTemplate] = React.useState<MessageTemplate | null>(null);
  
  // State for reverting an override
  const [templateToRevert, setTemplateToRevert] = React.useState<string | null>(null);
  const [isReverting, setIsReverting] = React.useState(false);

  // ── 1. Fetch Templates ──────────────────────────────────────────────────
  const templatesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'message_templates'),
      where('isActive', '==', true)
    );
  }, [firestore, activeWorkspaceId]);

  const { data: allTemplates, isLoading: isLoadingTemplates } = useCollection<MessageTemplate>(templatesQuery);

  // Group templates by trigger key (templateType) and channel
  const activeMappings = React.useMemo(() => {
    if (!allTemplates) return {};

    const map: Record<string, Record<string, MessageTemplate>> = {};

    MESSAGING_TRIGGERS.forEach(trigger => {
      map[trigger.id] = {};

      trigger.supportedChannels.forEach(channel => {
        // Find templates matching this trigger and channel
        const matches = allTemplates.filter(t => 
          t.templateType === trigger.id && 
          t.channel === channel
        );

        // Org override takes precedence over global
        const orgOverride = matches.find(t => 
          t.scope === 'organization' && 
          t.workspaceIds?.includes(activeWorkspaceId)
        );
        const globalDefault = matches.find(t => t.scope === 'global');

        if (orgOverride) {
          map[trigger.id][channel] = orgOverride;
        } else if (globalDefault) {
          map[trigger.id][channel] = globalDefault;
        }
      });
    });

    return map;
  }, [allTemplates, activeWorkspaceId]);

  // Group triggers by category for UI presentation
  const groupedTriggers = React.useMemo(() => {
    const groups: Record<string, MessagingTrigger[]> = {};
    MESSAGING_TRIGGERS.forEach(t => {
      if (!groups[t.category]) groups[t.category] = [];
      groups[t.category].push(t);
    });
    return groups;
  }, []);

  // ── 2. Data Subscriptions for Template Workshop ─────────────────────────
  const varsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'messaging_variables'));
  }, [firestore]);
  
  const stylesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(collection(firestore, 'message_styles'), where('workspaceIds', 'array-contains', activeWorkspaceId));
  }, [firestore, activeWorkspaceId]);

  const entitiesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(collection(firestore, 'workspace_entities'), where('workspaceId', '==', activeWorkspaceId));
  }, [firestore, activeWorkspaceId]);

  const meetingsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'meetings'));
  }, [firestore]);

  const surveysQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'surveys'), where('status', '==', 'published'));
  }, [firestore]);

  const pdfsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'pdfs'), where('status', '==', 'published'));
  }, [firestore]);

  const { data: firestoreVariables } = useCollection<VariableDefinition>(varsQuery);
  const { data: styles } = useCollection<MessageStyle>(stylesQuery);
  const { data: entities } = useCollection<WorkspaceEntity>(entitiesQuery);
  const { data: meetings } = useCollection<Meeting>(meetingsQuery);
  const { data: surveys } = useCollection<Survey>(surveysQuery);
  const { data: pdfs } = useCollection<PDFForm>(pdfsQuery);

  const variables = React.useMemo(() => {
    const contactVarDefs = generateContactVariableDefinitions('institution');
    const firestoreVars = firestoreVariables || [];
    const existingKeys = new Set(contactVarDefs.map(v => v.key));
    const deduped = firestoreVars.filter(v => !existingKeys.has(v.key));
    return [...contactVarDefs, ...deduped];
  }, [firestoreVariables]);

  // ── 3. Actions ──────────────────────────────────────────────────────────

  const handleCustomize = (trigger: MessagingTrigger, channel: MessageChannel, existingOverride?: MessageTemplate) => {
    if (existingOverride) {
      setEditingTemplate(existingOverride);
    } else {
      // If we are customizing a global default (or creating from scratch), we pre-populate the essential fields.
      // The workshop's `handleSave` will automatically create a new org-scoped document if it doesn't have an ID.
      const globalTemplate = activeMappings[trigger.id]?.[channel];
      
      if (globalTemplate) {
        setEditingTemplate(globalTemplate);
      } else {
        // No global template exists, create a blank slate locked to this trigger
        setEditingTemplate({
          name: `Custom ${trigger.name}`,
          category: trigger.category,
          templateType: trigger.id,
          channel: channel,
          target: trigger.target,
          recipientType: trigger.recipientType,
          scope: 'organization',
          contentMode: channel === 'sms' ? 'plain_text' : 'rich_builder',
          body: '',
          status: 'active',
          workspaceIds: [activeWorkspaceId],
          variableContext: 'common', // Should ideally infer from category
          declaredVariables: [],
        } as unknown as MessageTemplate);
      }
    }
    setIsAdding(true);
  };

  const handleSave = async (data: any) => {
    if (!firestore || !user) return;

    const contentForExtraction = `${data.subject || ''} ${data.body} ${JSON.stringify(data.blocks || [])}`;
    const varMatches = contentForExtraction.match(/\{\{(.*?)\}\}/g);
    const variableList = varMatches ? [...new Set(varMatches.map(m => m.replace(/\{\{|\}\}/g, '').trim()))] : [];

    const workspaceIds = data.workspaceIds && data.workspaceIds.length > 0 
        ? data.workspaceIds 
        : [activeWorkspaceId];

    const templateData = {
        ...data,
        workspaceIds,
        organizationId: activeOrganizationId,
        scope: data.scope || 'organization', // ALWAYS ensure org scope when saved from here
        variables: variableList,
        status: data.status || 'active',
        isActive: true,
        updatedAt: new Date().toISOString(),
    };

    const sanitizedData = JSON.parse(JSON.stringify(templateData));

    try {
        if (editingTemplate?.id && editingTemplate.scope !== 'global') {
            await updateDoc(doc(firestore, 'message_templates', editingTemplate.id), sanitizedData);
        } else {
            // It's a global template being customized. We strip the ID and save as a new Org template.
            const { id: _, ...dataToSave } = sanitizedData;
            await addDoc(collection(firestore, 'message_templates'), { 
                ...dataToSave, 
                scope: 'organization',
                globalTemplateId: editingTemplate?.id, // Link back to the original
                createdAt: new Date().toISOString() 
            });
        }
        toast({ title: 'Override Saved Successfully' });
        setIsAdding(false);
        setEditingTemplate(null);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
    }
  };

  const handleRevert = async () => {
    if (!firestore || !templateToRevert) return;
    setIsReverting(true);
    try {
      await deleteDoc(doc(firestore, 'message_templates', templateToRevert));
      toast({ title: 'Reverted to System Default' });
      setTemplateToRevert(null);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Failed to revert', description: error.message });
    } finally {
      setIsReverting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <AnimatePresence mode="wait">
        {isAdding ? (
          <TemplateWorkshop 
            key="workshop"
            initialTemplate={editingTemplate}
            initialContext={editingTemplate ? {
              category: editingTemplate.category,
              channel: editingTemplate.channel,
              recipientType: editingTemplate.recipientType,
              templateType: editingTemplate.templateType
            } : undefined}
            variables={variables || []}
            styles={styles || []}
            entities={entities || []}
            meetings={meetings || []}
            surveys={surveys || []}
            pdfs={pdfs || []}
            onSave={handleSave}
            onCancel={() => { setIsAdding(false); setEditingTemplate(null); }}
            isSaving={false}
          />
        ) : (
          <div className="flex-1 overflow-y-auto text-left">
            <div className="space-y-8 p-8 max-w-7xl mx-auto">
              
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild className="rounded-xl h-10 w-10 border shadow-sm">
                  <Link href="/admin/messaging"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-amber-500/5 text-amber-600 border-amber-500/20 font-bold uppercase tracking-widest text-[9px] px-3 py-1">System Architecture</Badge>
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight mt-2 flex items-center gap-3">
                    <Zap className="h-7 w-7 text-amber-500" /> Messaging Triggers
                  </h1>
                  <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
                    This is the central registry of all automated events that trigger messages in the platform. 
                    You can view the Global Defaults provided by the system, or override them with your own Custom Templates.
                  </p>
                </div>
              </div>

              {isLoadingTemplates ? (
                <div className="flex flex-col items-center justify-center h-64 space-y-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm font-semibold text-muted-foreground animate-pulse">Loading Platform Blueprints...</p>
                </div>
              ) : (
                <div className="space-y-12">
                  {Object.entries(groupedTriggers).map(([category, triggers]) => (
                    <section key={category} className="space-y-6">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-background font-semibold text-[11px] uppercase px-4 py-1.5 border-border text-foreground shadow-sm">
                          {category.replace('_', ' ')} Workflows
                        </Badge>
                        <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
                      </div>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {triggers.map(trigger => (
                          <TriggerCard 
                            key={trigger.id}
                            trigger={trigger}
                            activeTemplates={activeMappings[trigger.id] || {}}
                            onCustomize={handleCustomize}
                            onRevert={setTemplateToRevert}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}

            </div>
          </div>
        )}
      </AnimatePresence>

      <AlertDialog open={!!templateToRevert} onOpenChange={(o) => !o && setTemplateToRevert(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-semibold text-xl tracking-tight flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-amber-500" /> Revert to System Default?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium">
              This will permanently delete your organization's custom override for this trigger. The system will fall back to using the global blueprint provided by the platform.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRevert} 
              disabled={isReverting}
              className="rounded-xl font-bold bg-amber-500 text-white hover:bg-amber-600 shadow-xl"
            >
              {isReverting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Revert to Default
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
