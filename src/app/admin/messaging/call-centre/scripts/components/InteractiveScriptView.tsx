'use client';

import * as React from 'react';
import type { Node, Edge } from 'reactflow';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  HelpCircle, 
  Settings, 
  X,
  Info,
  Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getActionMeta } from '@/lib/call-action-types';

interface InteractiveScriptViewProps {
  nodes: Node[];
  edges: Edge[];
}

export function InteractiveScriptView({ nodes, edges }: InteractiveScriptViewProps) {
  const [activeNodeId, setActiveNodeId] = React.useState<string | null>(null);
  const [rightTab, setRightTab] = React.useState<'objections' | 'actions'>('objections');
  const [selectedObjectionId, setSelectedObjectionId] = React.useState<string | null>(null);
  const [selectedSubObjectionIndex, setSelectedSubObjectionIndex] = React.useState<number | null>(null);
  const [selectedActionId, setSelectedActionId] = React.useState<string | null>(null);
  const [filterRelatedObjections, setFilterRelatedObjections] = React.useState(true);

  // Logical pre-order DFS ordering of main blocks (excludes objections/actions)
  const orderedMainNodes = React.useMemo(() => {
    if (!nodes || nodes.length === 0) return [];
    
    const mainNodes = nodes.filter(n => n.type !== 'objection' && n.type !== 'action');
    const result: Node[] = [];
    const visited = new Set<string>();

    const dfs = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      const node = mainNodes.find(n => n.id === nodeId);
      if (node) result.push(node);

      const outgoing = edges.filter(e => e.source === nodeId);
      outgoing.sort((a, b) => {
        const aH = a.sourceHandle || '';
        const bH = b.sourceHandle || '';
        return aH.localeCompare(bH);
      });

      for (const edge of outgoing) {
        dfs(edge.target);
      }
    };

    const starts = mainNodes.filter(n => n.type === 'start');
    starts.forEach(s => dfs(s.id));

    mainNodes.forEach(n => {
      if (!visited.has(n.id)) {
        dfs(n.id);
      }
    });

    return result;
  }, [nodes, edges]);

  // Set default active node on load
  React.useEffect(() => {
    if (!activeNodeId && orderedMainNodes.length > 0) {
      const startNode = orderedMainNodes.find(n => n.type === 'start');
      setActiveNodeId(startNode ? startNode.id : orderedMainNodes[0].id);
    }
  }, [orderedMainNodes, activeNodeId]);

  // Derive middle pane content without secondary effects
  const activeNode = React.useMemo(() => {
    return nodes.find(n => n.id === activeNodeId) || null;
  }, [nodes, activeNodeId]);

  const middleNode = React.useMemo(() => {
    if (selectedObjectionId) {
      return nodes.find(n => n.id === selectedObjectionId) || null;
    }
    return activeNode;
  }, [nodes, selectedObjectionId, activeNode]);

  // Gets absolute default placeholder text if none has been configured
  const getFallbackText = React.useCallback((node: Node) => {
    const text = node.data?.text;
    if (text && text.trim()) return text;

    switch (node.type) {
      case 'start':
        return 'Initiate outbound call conversation.';
      case 'end':
        return 'End of call outreach.';
      case 'question':
        return 'Ask your question here…';
      case 'script_block':
        return 'Script body text.';
      case 'objection':
        return 'Objection response details here…';
      case 'action': {
        const meta = getActionMeta(node.data?.actionType || '');
        let details = `Trigger Action: ${meta.label}`;
        const config = node.data?.actionConfig || {};
        if (node.data?.actionType === 'SEND_SMS' || node.data?.actionType === 'SEND_EMAIL' || node.data?.actionType === 'SEND_WHATSAPP') {
          details += ` (Template ID: ${config.templateId || 'Not configured'})`;
        } else if (node.data?.actionType === 'CREATE_TASK') {
          details += ` (Task: "${config.taskTitle || 'Follow up'}" - Priority: ${config.taskPriority || 'medium'})`;
        } else if (node.data?.actionType === 'CHANGE_STAGE') {
          details += ` (Stage ID: ${config.stageId || 'Not configured'})`;
        } else if (node.data?.actionType === 'ADD_TAG' || node.data?.actionType === 'REMOVE_TAG') {
          details += ` (Tag ID: ${config.tagId || 'Not configured'})`;
        } else if (node.data?.actionType === 'WEBHOOK') {
          details += ` (${config.webhookMethod || 'POST'} to ${config.webhookUrl || 'No URL'})`;
        } else if (node.data?.actionType === 'LOG_NOTE') {
          details += ` (Note: ${config.noteContent || 'Empty'})`;
        } else if (node.data?.actionType === 'SCHEDULE_MEETING') {
          details += ` (Meeting Type ID: ${config.meetingTypeId || 'Not configured'})`;
        } else if (node.data?.actionType === 'TRANSFER_CALL') {
          details += ` (Transfer to: ${config.transferTarget || 'No target'} via ${config.transferMode || 'phone'})`;
        }
        if (config.triggerDelaySeconds) {
          details += ` [Delayed by ${config.triggerDelaySeconds}s]`;
        }
        return details;
      }
      case 'outcome':
        return `Outcome Resolution: ${node.data?.outcomeValue || 'None'}`;
      default:
        return 'Script body text.';
    }
  }, []);

  const getSubObjections = React.useCallback((node: Node): Array<{ title: string; description: string }> => {
    const objections = (node.data as any)?.objectionConfig?.objections;
    if (Array.isArray(objections) && objections.length > 0) {
      return objections;
    }
    return [
      {
        title: node.data?.label || 'Objection',
        description: node.data?.text || '',
      }
    ];
  }, []);

  const middleTitle = React.useMemo(() => {
    if (selectedObjectionId && middleNode) {
      if (selectedSubObjectionIndex !== null) {
        const subObjs = getSubObjections(middleNode);
        const subObj = subObjs[selectedSubObjectionIndex];
        if (subObj?.title) return subObj.title;
      }
      return middleNode.data?.label || 'Objection';
    }
    return middleNode?.data?.label || 'Script Body';
  }, [selectedObjectionId, selectedSubObjectionIndex, middleNode, getSubObjections]);

  const middleText = React.useMemo(() => {
    if (selectedObjectionId && middleNode) {
      if (selectedSubObjectionIndex !== null) {
        const subObjs = getSubObjections(middleNode);
        const subObj = subObjs[selectedSubObjectionIndex];
        if (subObj?.description) return subObj.description;
      }
      return middleNode.data?.text || 'Objection response details here…';
    }
    return middleNode ? getFallbackText(middleNode) : '';
  }, [selectedObjectionId, selectedSubObjectionIndex, middleNode, getFallbackText, getSubObjections]);

  // Memoized callbacks
  const handleMainNodeClick = React.useCallback((nodeId: string) => {
    setActiveNodeId(nodeId);
    setSelectedObjectionId(null);
    setSelectedSubObjectionIndex(null);
  }, []);

  const handleObjectionClick = React.useCallback((objectionId: string, subIndex: number | null) => {
    setSelectedObjectionId(objectionId);
    setSelectedSubObjectionIndex(subIndex);
  }, []);

  // Highlights variables in blue
  const highlightVariables = React.useCallback((text: string | undefined): React.ReactNode => {
    if (!text) return <span className="italic text-muted-foreground font-serif">No body content text.</span>;

    const parts = text.split(/(\{\{[A-Za-z0-9_]+\}\}|\[[A-Za-z0-9_]+\])/g);
    return parts.map((part, idx) => {
      const isVar = (part.startsWith('{{') && part.endsWith('}}')) || (part.startsWith('[') && part.endsWith(']'));
      if (isVar) {
        const cleanName = part.replace(/[\{\}\[\]]/g, '');
        return (
          <span 
            key={idx}
            className="inline-block px-1.5 py-0.5 mx-0.5 text-[10px] font-bold rounded bg-blue-500/10 text-blue-600 dark:bg-blue-400/15 dark:text-blue-400 border border-blue-500/20 font-mono"
          >
            {cleanName}
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  }, []);

  // Compute active outgoing choices & actions for navigation
  const outgoingEdges = React.useMemo(() => {
    return activeNodeId ? edges.filter(e => e.source === activeNodeId) : [];
  }, [edges, activeNodeId]);

  const actionEdges = React.useMemo(() => {
    return outgoingEdges.filter(e => {
      const t = nodes.find(n => n.id === e.target);
      return t?.type === 'action';
    });
  }, [outgoingEdges, nodes]);

  const nextMainEdge = React.useMemo(() => {
    return outgoingEdges.find(e => {
      const t = nodes.find(n => n.id === e.target);
      return t && t.type !== 'action' && t.type !== 'objection';
    });
  }, [outgoingEdges, nodes]);

  // Filter objections based on relations to the active node
  const relatedObjections = React.useMemo(() => {
    if (!activeNodeId) return [];
    const connectedNodeIds = new Set(
      edges
        .filter(e => e.source === activeNodeId || e.target === activeNodeId)
        .map(e => e.source === activeNodeId ? e.target : e.source)
    );
    return nodes.filter(n => n.type === 'objection' && connectedNodeIds.has(n.id));
  }, [nodes, edges, activeNodeId]);

  const allObjections = React.useMemo(() => nodes.filter(n => n.type === 'objection'), [nodes]);
  const displayedObjections = filterRelatedObjections ? relatedObjections : allObjections;

  const allActions = React.useMemo(() => nodes.filter(n => n.type === 'action'), [nodes]);
  const selectedAction = React.useMemo(() => {
    return allActions.find(a => a.id === selectedActionId) || null;
  }, [allActions, selectedActionId]);

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'start':
        return <Play className="h-3.5 w-3.5 text-emerald-500" />;
      case 'end':
        return <AlertCircle className="h-3.5 w-3.5 text-rose-500" />;
      case 'question':
        return <HelpCircle className="h-3.5 w-3.5 text-amber-500" />;
      default:
        return <Layers className="h-3.5 w-3.5 text-primary" />;
    }
  };

  return (
    <div className="grid grid-cols-12 gap-4 h-[680px] overflow-hidden text-foreground">
      {/* 1. Left Panel: Main Block Outlines */}
      <div className="col-span-3 h-full flex flex-col bg-card/30 border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-3.5 bg-muted/30 border-b border-border flex items-center justify-between shrink-0">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Main Flow Steps</span>
          <Badge className="bg-primary/10 text-primary text-[8px] font-extrabold border-none px-2 py-0.5">{orderedMainNodes.length}</Badge>
        </div>
        <div className="flex-grow overflow-y-auto p-2.5 space-y-1 scrollbar-thin select-none">
          {orderedMainNodes.map((node) => {
            const isActive = node.id === activeNodeId;
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => handleMainNodeClick(node.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 p-3 rounded-xl text-left transition-all border text-xs",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary font-black shadow-md shadow-primary/10"
                    : "bg-transparent text-muted-foreground border-transparent hover:bg-muted hover:text-foreground"
                )}
              >
                {getNodeIcon(node.type ?? '')}
                <span className="truncate">{node.data.label || `Step (${node.type})`}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Middle Panel: Dialogue Script Content Sheet */}
      <div className="col-span-6 h-full flex flex-col border border-border bg-card rounded-2xl overflow-hidden shadow-sm">
        {middleNode ? (
          <>
            <div className="p-4 bg-muted/20 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-primary">
                  {middleTitle}
                </span>
                <Badge className="capitalize text-[8px] border-none font-bold bg-muted text-muted-foreground">
                  {middleNode.type || 'objection'}
                </Badge>
              </div>
              {selectedObjectionId && (
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6 text-muted-foreground rounded-lg"
                  onClick={() => {
                    setSelectedObjectionId(null);
                    setSelectedSubObjectionIndex(null);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            <div className="flex-grow overflow-y-auto p-7 flex flex-col justify-between scrollbar-thin select-text">
              <div className="space-y-4">
                {selectedObjectionId && (
                  <span className="text-[9px] font-bold uppercase tracking-widest text-orange-500 block">
                    ➔ Viewing Objection Response
                  </span>
                )}
                
                <div className="text-lg font-extrabold text-foreground/90 leading-relaxed font-sans whitespace-pre-line tracking-wide">
                  {highlightVariables(middleText)}
                </div>
              </div>

              {!selectedObjectionId && (
                <div className="mt-8 pt-5 border-t border-border/60 space-y-4 shrink-0 select-none">
                  {middleNode.type === 'question' && (
                    <div className="space-y-2">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Choose Response Branch:</span>
                      <div className="flex flex-wrap gap-2">
                        {((middleNode.data.options as string[]) || ['Yes', 'No']).map((opt, idx) => {
                          const matchingEdge = edges.find(e => e.source === middleNode.id && e.sourceHandle === `option-${idx}`);
                          const targetExists = matchingEdge && nodes.some(n => n.id === matchingEdge.target);
                          return (
                            <Button
                              key={idx}
                              onClick={() => matchingEdge && handleMainNodeClick(matchingEdge.target)}
                              disabled={!targetExists}
                              className="h-8 rounded-lg text-xs font-bold uppercase tracking-wider border-amber-500 bg-amber-500 hover:bg-amber-600 text-white"
                            >
                              {opt}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {middleNode.type !== 'question' && nextMainEdge && (
                    <Button
                      onClick={() => handleMainNodeClick(nextMainEdge.target)}
                      className="h-8 rounded-lg text-xs font-bold uppercase tracking-wider"
                    >
                      Continue Flow <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  )}

                  {actionEdges.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-border/40">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Available Actions:</span>
                      <div className="flex flex-wrap gap-2">
                        {actionEdges.map((edge) => {
                          const actionNode = nodes.find(n => n.id === edge.target);
                          if (!actionNode) return null;
                          return (
                            <Button
                              key={actionNode.id}
                              variant="secondary"
                              onClick={() => {
                                setRightTab('actions');
                                setSelectedActionId(actionNode.id);
                              }}
                              className="h-8 rounded-lg text-[10px] font-bold uppercase tracking-wider gap-1 border-indigo-500/20 bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20"
                            >
                              ➔ Trigger Action: {actionNode.data.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-grow flex items-center justify-center p-6 text-center text-xs text-muted-foreground italic">
            Select a block from the left panel to begin.
          </div>
        )}
      </div>

      {/* 3. Right Panel: Tabbed Objections & Actions Workspace */}
      <div className="col-span-3 h-full flex flex-col border border-border bg-card/30 rounded-2xl overflow-hidden shadow-sm">
        <Tabs value={rightTab} onValueChange={(val: any) => setRightTab(val)} className="h-full flex flex-col m-0 p-0">
          <TabsList className="bg-muted/40 border-b border-border h-11 p-0.5 rounded-none gap-1 shrink-0">
            <TabsTrigger 
              value="objections" 
              className="flex-grow rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-[10px] font-bold uppercase tracking-wider h-full transition-colors"
            >
              Objections
            </TabsTrigger>
            <TabsTrigger 
              value="actions" 
              className="flex-grow rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-[10px] font-bold uppercase tracking-wider h-full transition-colors"
            >
              Actions
            </TabsTrigger>
          </TabsList>

          {/* Objections Tab Content */}
          <TabsContent value="objections" className="flex-grow overflow-hidden flex flex-col m-0 p-3 outline-none">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-border shrink-0 select-none">
              <span className="text-[9px] font-bold text-muted-foreground uppercase">
                {filterRelatedObjections ? 'Related Objections' : 'All Objections'}
              </span>
              <button
                type="button"
                onClick={() => setFilterRelatedObjections(!filterRelatedObjections)}
                className="text-[9px] font-black text-primary hover:underline"
              >
                {filterRelatedObjections ? 'Show All' : 'Filter Related'}
              </button>
            </div>

            <div className="flex-grow overflow-y-auto space-y-2.5 scrollbar-thin select-none">
              {displayedObjections.length > 0 ? (
                displayedObjections.map((obj) => {
                  const subObjections = getSubObjections(obj);
                  return (
                    <div key={obj.id} className="space-y-1">
                      <div className="flex items-center gap-1.5 px-1.5 py-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                        <Layers className="h-3 w-3 text-muted-foreground" />
                        <span>{obj.data.label || 'Objections'}</span>
                      </div>
                      <div className="pl-3 border-l border-border/60 ml-2.5 space-y-1">
                        {subObjections.map((sub, idx) => {
                          const isSelected = obj.id === selectedObjectionId && idx === selectedSubObjectionIndex;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleObjectionClick(obj.id, idx)}
                              className={cn(
                                "w-full flex items-start gap-2 p-2 rounded-xl text-left border text-[11px] transition-all",
                                isSelected
                                  ? "bg-orange-500/10 text-orange-500 border-orange-500/40 font-bold"
                                  : "bg-card hover:bg-muted text-muted-foreground border-border/60 hover:text-foreground"
                              )}
                            >
                              <Info className="h-3.5 w-3.5 text-orange-400 shrink-0 mt-0.5" />
                              <span className="truncate">{sub.title || `Objection ${idx + 1}`}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10 text-[11px] text-muted-foreground italic">
                  No objections found for this step.
                </div>
              )}
            </div>
          </TabsContent>

          {/* Actions Tab Content */}
          <TabsContent value="actions" className="flex-grow overflow-hidden flex flex-col m-0 p-3 outline-none">
            {selectedAction ? (
              <div className="flex-grow flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-border shrink-0 select-none">
                  <span className="text-[9px] font-bold text-indigo-500 uppercase">
                    ➔ Action Steps: {selectedAction.data.label}
                  </span>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-5 w-5 rounded"
                    onClick={() => setSelectedActionId(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex-grow overflow-y-auto p-3.5 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-xl border border-indigo-500/10 text-xs leading-relaxed text-foreground select-text font-medium scrollbar-thin">
                  {highlightVariables(getFallbackText(selectedAction))}
                </div>
              </div>
            ) : (
              <div className="flex-grow flex flex-col h-full overflow-hidden">
                <span className="text-[9px] font-bold text-muted-foreground uppercase pb-2 mb-2 border-b border-border shrink-0 select-none">
                  Available Actions
                </span>
                <div className="flex-grow overflow-y-auto space-y-1.5 scrollbar-thin select-none">
                  {allActions.length > 0 ? (
                    allActions.map((act) => (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => setSelectedActionId(act.id)}
                        className="w-full flex items-start gap-2 p-2.5 rounded-xl text-left border border-border/60 bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-[11px] transition-all"
                      >
                        {(() => {
                          const m = getActionMeta(act.data?.actionType || '');
                          const Icon = m.icon;
                          const iconColor = m.colorClass.replace('bg-', 'text-');
                          return <Icon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", iconColor)} />;
                        })()}
                        <span className="truncate">{act.data.label || 'Action'}</span>
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-10 text-[11px] text-muted-foreground italic">
                      No actions found in this script.
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
