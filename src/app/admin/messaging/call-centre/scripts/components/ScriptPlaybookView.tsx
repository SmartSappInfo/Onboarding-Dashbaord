'use client';

import * as React from 'react';
import type { BranchingScriptGraph, ScriptNode } from '@/lib/types';
import { getNextNodeChoices } from '@/lib/call-centre-graph';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, ArrowRight, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScriptPlaybookViewProps {
  graph: BranchingScriptGraph;
}

export function ScriptPlaybookView({ graph }: ScriptPlaybookViewProps) {
  const [expandedNodes, setExpandedNodes] = React.useState<Record<string, boolean>>({});

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

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
      <div className="p-6 text-center text-xs text-zinc-500 italic">
        No flow structure found. Script graph is empty.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">
        Playbook Outline & Decision Tree
      </div>
      <div className="space-y-2.5">
        {graph.nodes.map((node) => {
          const isExpanded = !!expandedNodes[node.id];
          const choices = getNextNodeChoices(graph, node.id);

          return (
            <div 
              key={node.id} 
              className={cn(
                "border rounded-xl transition-all overflow-hidden",
                isExpanded ? "border-zinc-800 bg-zinc-900/10" : "border-zinc-900 bg-transparent hover:border-zinc-850"
              )}
            >
              {/* Header block */}
              <button
                type="button"
                onClick={() => toggleNode(node.id)}
                className="w-full flex items-center justify-between p-3.5 text-left text-zinc-200 hover:text-zinc-100 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-zinc-500 shrink-0" /> : <ChevronRight className="h-4 w-4 text-zinc-500 shrink-0" />}
                  <span className="text-xs font-bold truncate">{node.data.label || `Node (${node.type})`}</span>
                  {getNodeBadge(node.type)}
                </div>
                {choices.length > 0 && (
                  <span className="text-[9px] font-mono text-zinc-500 shrink-0">
                    {choices.length} {choices.length === 1 ? 'branch' : 'branches'}
                  </span>
                )}
              </button>

              {/* Collapsible Content */}
              {isExpanded && (
                <div className="p-4 pt-0 border-t border-zinc-900/80 space-y-4">
                  {/* Script body dialogue */}
                  {node.data.text && (
                    <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-lg text-xs leading-relaxed text-zinc-300 font-serif italic whitespace-pre-line select-text">
                      &ldquo;{node.data.text}&rdquo;
                    </div>
                  )}

                  {/* Outcome configurations */}
                  {node.type === 'outcome' && node.data.outcomeValue && (
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-purple-400 uppercase tracking-wider">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Resolves call to outcome: "{node.data.outcomeValue}"</span>
                    </div>
                  )}

                  {/* Branch choice buttons preview */}
                  {choices.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Branch choices:</span>
                      <div className="flex flex-col gap-1.5">
                        {choices.map((choice) => (
                          <div 
                            key={choice.edgeId}
                            className="flex items-center justify-between p-2 bg-zinc-950/60 border border-zinc-850 rounded-lg text-[10px]"
                          >
                            <span className="font-bold text-zinc-350 flex items-center gap-1.5">
                              <ArrowRight className="h-3 w-3 text-zinc-500" />
                              If response is: <span className="text-primary font-black">"{choice.edgeLabel}"</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                // Expand target node
                                setExpandedNodes(prev => ({ ...prev, [choice.targetNode.id]: true }));
                              }}
                              className="text-[9px] font-bold text-zinc-400 hover:text-zinc-100 underline"
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
          );
        })}
      </div>
    </div>
  );
}
