'use client';

import * as React from 'react';
import { MESSAGING_TRIGGERS } from '@/lib/messaging-triggers';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { MessageTemplate, VariableDefinition, WorkspaceEntity, Meeting, Survey, PDFForm, MessageChannel } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, Loader2, ArrowLeft, Building2, BarChart2 } from 'lucide-react';
import Link from 'next/link';
import { AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { generateContactVariableDefinitions } from '@/lib/contact-variable-definitions';
import dynamic from 'next/dynamic';
import { getBlueprintAdoptionStats, updateGlobalTemplate, createGlobalTemplate } from '@/lib/template-actions';
import { useBackoffice } from '../../../context/BackofficeProvider';

// Dynamically import the heavy workshop to keep the initial hub lightweight
const TemplateWorkshop = dynamic(
  () => import('@/app/admin/messaging/templates/components/template-workshop').then(m => m.TemplateWorkshop),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-background z-[100]">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm font-semibold text-muted-foreground animate-pulse">Loading Global Blueprint Workshop...</p>
        </div>
      </div>
    )
  }
);

export default function BlueprintsHubClient() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { profile } = useBackoffice();
  const [editingTemplate, setEditingTemplate] = React.useState<MessageTemplate | null>(null);
  const [isCustomizing, setIsCustomizing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [adoptionStats, setAdoptionStats] = React.useState<Record<string, number>>({});

  // Fetch only global templates
  const globalQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'message_templates'), where('scope', '==', 'global'));
  }, [firestore]);

  const { data: globalTemplates, isLoading } = useCollection<MessageTemplate>(globalQuery);

  // Group triggers by Category
  const groupedTriggers = React.useMemo(() => {
    const map = new Map<string, typeof MESSAGING_TRIGGERS>();
    for (const trigger of MESSAGING_TRIGGERS) {
      if (!map.has(trigger.category)) {
        map.set(trigger.category, []);
      }
      map.get(trigger.category)!.push(trigger);
    }
    return map;
  }, []);

  // Fetch Adoption Stats
  React.useEffect(() => {
    async function loadStats() {
      const statsMap: Record<string, number> = {};
      await Promise.all(
        MESSAGING_TRIGGERS.map(async (trigger) => {
          try {
            const stats = await getBlueprintAdoptionStats(trigger.id);
            statsMap[trigger.id] = stats.activeOverrides;
          } catch (error) {
            console.error(`Failed to fetch stats for ${trigger.id}`, error);
            statsMap[trigger.id] = 0;
          }
        })
      );
      setAdoptionStats(statsMap);
    }
    loadStats();
  }, []);

  const getGlobalTemplate = (triggerId: string, channel: MessageChannel) => {
    return globalTemplates?.find((t) => t.templateType === triggerId && t.channel === channel);
  };

  const handleCustomize = (trigger: typeof MESSAGING_TRIGGERS[0], channel: MessageChannel) => {
    const globalTemplate = getGlobalTemplate(trigger.id, channel);

    if (globalTemplate) {
      setEditingTemplate(globalTemplate);
    } else {
      // Create a blank slate locked to this trigger for creation
      setEditingTemplate({
        name: `Global ${trigger.name}`,
        category: trigger.category,
        templateType: trigger.id,
        channel: channel,
        target: trigger.target,
        recipientType: trigger.recipientType,
        body: '',
        variableContext: 'common' as const,
        scope: 'global' as const,
        version: 1,
        status: 'active' as const,
        declaredVariables: []
      } as unknown as MessageTemplate);
    }
    setIsCustomizing(true);
  };

  // Necessary contexts for Workshop
  const varsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'messaging_variables'), orderBy('category', 'asc'));
  }, [firestore]);
  const { data: firestoreVariables } = useCollection<VariableDefinition>(varsQuery);

  const variables = React.useMemo(() => {
    const contactVarDefs = generateContactVariableDefinitions('institution');
    const firestoreVars = firestoreVariables || [];
    const existingKeys = new Set(contactVarDefs.map((v: VariableDefinition) => v.key));
    const deduped = firestoreVars.filter((v: VariableDefinition) => !existingKeys.has(v.key));
    return [...contactVarDefs, ...deduped];
  }, [firestoreVariables]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm font-semibold text-muted-foreground">Loading Blueprints Registry...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card border border-border p-8 rounded-[2rem] shadow-sm">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
            <Zap className="h-8 w-8 text-emerald-500 fill-emerald-500/20" />
            System Blueprints
          </h1>
          <p className="text-sm font-medium text-muted-foreground mt-2 max-w-xl leading-relaxed">
            Manage the global default messaging templates. These blueprints are active for all organizations unless they explicitly configure an override.
          </p>
        </div>
      </div>

      <div className="space-y-12">
        {Array.from(groupedTriggers.entries()).map(([category, triggers]) => (
          <div key={category} className="space-y-6">
            <div className="flex items-center gap-3 px-2">
              <div className="h-8 w-1.5 bg-emerald-500 rounded-full" />
              <h2 className="text-xl font-bold uppercase tracking-widest text-foreground">{category}</h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {triggers.map((trigger) => (
                <div key={trigger.id} className="bg-card border border-border rounded-[1.5rem] p-6 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-foreground group-hover:text-emerald-500 transition-colors">
                          {trigger.name}
                        </h3>
                        <p className="text-xs font-semibold text-muted-foreground font-mono mt-1 px-2 py-0.5 bg-muted rounded-md inline-block">
                          {trigger.id}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-muted text-foreground border-border/50 font-bold uppercase text-[10px]">
                        {trigger.recipientType}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground font-medium mb-6 line-clamp-2 leading-relaxed">
                      {trigger.description}
                    </p>

                    <div className="flex items-center gap-2 mb-6 p-3 bg-muted/30 rounded-xl border border-border/50">
                      <BarChart2 className="h-4 w-4 text-emerald-500" />
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Adoption Metrics</span>
                        <span className="text-xs font-semibold text-foreground">
                          {adoptionStats[trigger.id] !== undefined ? (
                            <span><strong className="text-amber-500">{adoptionStats[trigger.id]} orgs</strong> have overridden this blueprint</span>
                          ) : (
                            <span className="animate-pulse">Loading stats...</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {trigger.supportedChannels.map((channelStr) => {
                      const channel = channelStr as unknown as MessageChannel;
                      const globalTemp = getGlobalTemplate(trigger.id, channel);
                      const isConfigured = !!globalTemp;

                      return (
                        <div key={`${channel}`} className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-background/50">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="w-14 justify-center bg-muted uppercase text-[10px] font-bold border-border/50">
                              {`${channel}`}
                            </Badge>
                            {isConfigured ? (
                              <div className="flex items-center gap-1.5">
                                <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Blueprint Active</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="flex h-2 w-2 rounded-full bg-slate-400" />
                                <span className="text-xs font-bold text-slate-500">Not Configured</span>
                              </div>
                            )}
                          </div>
                          
                          <Button 
                            variant={isConfigured ? "outline" : "default"}
                            size="sm"
                            className="rounded-lg h-8 text-xs font-bold px-4"
                            onClick={() => handleCustomize(trigger, channel)}
                          >
                            {isConfigured ? 'Edit Blueprint' : 'Create Blueprint'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isCustomizing && (
          <div className="fixed inset-0 z-50 flex flex-col bg-background">
            <TemplateWorkshop 
              key="workshop"
              mode="superadmin_blueprint"
              initialTemplate={editingTemplate}
              initialContext={editingTemplate ? {
                category: editingTemplate.category,
                channel: editingTemplate.channel,
                recipientType: editingTemplate.recipientType,
                templateType: editingTemplate.templateType
              } : undefined}
              variables={variables || []}
              styles={[]}
              entities={[]}
              meetings={[]}
              surveys={[]}
              pdfs={[]}
              onCancel={() => {
                setIsCustomizing(false);
                setEditingTemplate(null);
              }}
              isSaving={isSaving}
              onSave={async (data) => {
                if (!profile) return;
                setIsSaving(true);
                try {
                  const payload = {
                    name: data.name,
                    category: data.category,
                    templateType: data.templateType,
                    channel: data.channel,
                    subject: data.subject,
                    body: data.body,
                    variableContext: data.variableContext,
                    declaredVariables: data.declaredVariables,
                    reminderConfig: data.reminderConfig,
                  };

                  if (editingTemplate && editingTemplate.id) {
                    await updateGlobalTemplate(editingTemplate.id, payload, profile.id);
                  } else {
                    await createGlobalTemplate({
                      ...payload,
                      createdBy: profile.id,
                    });
                  }
                  
                  setIsCustomizing(false);
                  setEditingTemplate(null);
                  toast({
                    title: 'Blueprint Published',
                    description: 'The global blueprint has been updated successfully.',
                  });
                } catch (e: any) {
                  toast({ variant: 'destructive', title: 'Failed to publish blueprint', description: e.message });
                } finally {
                  setIsSaving(false);
                }
              }}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
