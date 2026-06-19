'use client';

import * as React from 'react';
import type { BranchingScriptGraph, ScriptNode } from '@/lib/types';
import { getNextNodeChoices } from '@/lib/call-centre-graph';
import { ScriptBodyDisplay } from './ScriptBodyDisplay';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, ArrowRight, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScriptPlaybookViewProps {
  graph: BranchingScriptGraph;
  resolveText?: (raw: string) => string;
}

export function ScriptPlaybookView({ graph, resolveText }: ScriptPlaybookViewProps) {
  const [expandedNodes, setExpandedNodes] = React.useState<Record<string, boolean>>({});

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  // Traverses the graph in depth-first search (DFS) order starting from start node(s)
  const orderedNodes = React.useMemo(() => {
    if (!graph || !graph.nodes || graph.nodes.length === 0) return [];

    const result: Array<ScriptNode & { depth: number; incomingBranch?: string }> = [];
    const visited = new Set<string>();

    const dfs = (nodeId: string, depth: number, incomingBranch?: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      const node = graph.nodes.find(n => n.id === nodeId);
      if (node) {
        result.push({ ...node, depth, incomingBranch });
      }

      // Sort outgoing edges to traverse Yes / option-0 branches before No / option-1
      const outgoing = graph.edges.filter(e => e.source === nodeId);
      outgoing.sort((a, b) => {
        const aHandle = a.sourceHandle || '';
        const bHandle = b.sourceHandle || '';
        return aHandle.localeCompare(bHandle);
      });

      for (const edge of outgoing) {
        let edgeLabel = edge.label || '';
        if (!edgeLabel && node?.type === 'question' && edge.sourceHandle?.startsWith('option-')) {
          const idx = parseInt(edge.sourceHandle.replace('option-', ''), 10);
          const options = node.data?.options || ['Yes', 'No'];
          edgeLabel = options[idx] || '';
        }
        dfs(edge.target, depth + 1, edgeLabel);
      }
    };

    // 1. Traverse starting from the Start nodes
    const startNodes = graph.nodes.filter(n => n.type === 'start');
    for (const startNode of startNodes) {
      dfs(startNode.id, 0);
    }

    // 2. Traverse any remaining disconnected nodes (so they are still visible/editable)
    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, 0);
      }
    }

    return result;
  }, [graph]);

  const getNodeBadge = (type: ScriptNode['type']) => {
    switch (type) {
      case 'start':
        return <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[8px] uppercase tracking-wider font-bold">Start</Badge>;
      case 'end':
        return <Badge className="bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[8px] uppercase tracking-wider font-bold">End</Badge>;
      case 'question':
        return <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[8px] uppercase tracking-wider font-bold">Question</Badge>;
      case 'multiple_choice':
        return <Badge className="bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[8px] uppercase tracking-wider font-bold">Choices</Badge>;
      case 'objection':
        return <Badge className="bg-orange-500/10 text-orange-500 border border-orange-500/20 text-[8px] uppercase tracking-wider font-bold">Objection</Badge>;
      case 'action':
        return <Badge className="bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 text-[8px] uppercase tracking-wider font-bold">Action</Badge>;
      case 'outcome':
        return <Badge className="bg-purple-500/10 text-purple-500 border border-purple-500/20 text-[8px] uppercase tracking-wider font-bold">Outcome</Badge>;
      default:
        return <Badge className="bg-zinc-500/10 text-zinc-400 border border-zinc-800 text-[8px] uppercase tracking-wider font-bold">Script Block</Badge>;
    }
  };

  if (!graph || !graph.nodes || graph.nodes.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-muted-foreground italic">
        No flow structure found. Script graph is empty.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">
        Playbook Outline & Decision Tree
      </div>
      <div className="space-y-2.5 relative pl-1">
        {orderedNodes.map((node) => {
          const isExpanded = !!expandedNodes[node.id];
          const choices = getNextNodeChoices(graph, node.id);

          return (
            <div 
              key={node.id} 
              className="relative"
              style={{ marginLeft: `${Math.min(node.depth * 16, 96)}px` }}
            >
              {/* Curved Connector Line */}
              {node.depth > 0 && (
                <div 
                  className="absolute border-l border-b border-muted-foreground/20 dark:border-zinc-800"
                  style={{
                    left: '-12px',
                    width: '12px',
                    height: '24px',
                    top: '-6px',
                    borderBottomLeftRadius: '6px',
                  }}
                />
              )}

              <div
                className={cn(
                  "border rounded-xl transition-all overflow-hidden",
                  isExpanded 
                    ? "border-primary/20 bg-muted/20 dark:border-zinc-800 dark:bg-zinc-900/10" 
                    : "border-border bg-card hover:bg-muted/10 hover:border-muted-foreground/20 dark:border-zinc-900/50 dark:hover:border-zinc-800"
                )}
              >
                {/* Header block */}
                <button
                  type="button"
                  onClick={() => toggleNode(node.id)}
                  className="w-full flex items-center justify-between p-3.5 text-left text-foreground hover:text-foreground/90 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                    
                    {/* Path choice label badge */}
                    {node.incomingBranch && (
                      <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/25 shrink-0 select-none tracking-wide">
                        ➔ {node.incomingBranch}
                      </span>
                    )}

                    <span className="text-xs font-bold truncate">{node.data.label || `Node (${node.type})`}</span>
                    {getNodeBadge(node.type)}
                  </div>
                  {choices.length > 0 && (
                    <span className="text-[9px] font-mono text-muted-foreground shrink-0">
                      {choices.length} {choices.length === 1 ? 'branch' : 'branches'}
                    </span>
                  )}
                </button>

                {/* Collapsible Content */}
                {isExpanded && (
                  <div className="p-4 pt-0 border-t border-border dark:border-zinc-900/80 space-y-4">
                    {/* Script body dialogue */}
                    {node.data.text && (
                      <div className="p-3.5 bg-background dark:bg-zinc-950 border border-border dark:border-zinc-850 rounded-lg text-xs leading-relaxed text-foreground/90 dark:text-zinc-300 font-serif italic select-text shadow-sm mt-3">
                        <span aria-hidden="true">&ldquo;</span>
                        <ScriptBodyDisplay text={node.data.text} resolveText={resolveText} highlightVariables className="inline" />
                        <span aria-hidden="true">&rdquo;</span>
                      </div>
                    )}

                    {/* Outcome configurations */}
                    {node.type === 'outcome' && node.data.outcomeValue && (
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider pt-2">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Resolves call to outcome: "{node.data.outcomeValue}"</span>
                      </div>
                    )}

                    {/* Branch choice buttons preview */}
                    {choices.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Branch choices:</span>
                        <div className="flex flex-col gap-1.5">
                          {choices.map((choice) => (
                            <div 
                              key={choice.edgeId}
                              className="flex items-center justify-between p-2.5 bg-background dark:bg-zinc-950/60 border border-border dark:border-zinc-850 rounded-lg text-[10px]"
                            >
                              <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                If response is: <span className="text-primary font-black">"{choice.edgeLabel}"</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  // Expand target node
                                  setExpandedNodes(prev => ({ ...prev, [choice.targetNode.id]: true }));
                                }}
                                className="text-[9px] font-bold text-primary hover:underline"
                              >
                                Go to: {choice.targetNode.data.label || choice.targetNode.id}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
