import { describe, it, expect } from 'vitest';
import type { Node, Edge } from 'reactflow';
import { pushHistoryState, type HistoryState } from '../call-centre-history';
import { getDescendantNodeIds } from '../call-centre-cloning';

describe('Call Centre Script History Logic', () => {
  const node1: Node = { id: '1', position: { x: 0, y: 0 }, data: { label: 'Node 1' } };
  const node2: Node = { id: '2', position: { x: 10, y: 10 }, data: { label: 'Node 2' } };
  const edge1: Edge = { id: 'e1', source: '1', target: '2' };

  it('should initialize and push the first state', () => {
    const history: HistoryState[] = [];
    const pointer = -1;
    const state: HistoryState = { nodes: [node1], edges: [], legacyText: 'text1' };
    
    const result = pushHistoryState(history, pointer, state);
    expect(result.history.length).toBe(1);
    expect(result.pointer).toBe(0);
    expect(result.history[0].nodes[0].id).toBe('1');
  });

  it('should not push a state if it is identical to the current pointer state', () => {
    const state: HistoryState = { nodes: [node1], edges: [], legacyText: 'text1' };
    const history: HistoryState[] = [state];
    const pointer = 0;
    
    const result = pushHistoryState(history, pointer, state);
    expect(result.history.length).toBe(1);
    expect(result.pointer).toBe(0);
  });

  it('should push a new state if it is different', () => {
    const state1: HistoryState = { nodes: [node1], edges: [], legacyText: 'text1' };
    const state2: HistoryState = { nodes: [node1, node2], edges: [], legacyText: 'text1' };
    const history: HistoryState[] = [state1];
    const pointer = 0;
    
    const result = pushHistoryState(history, pointer, state2);
    expect(result.history.length).toBe(2);
    expect(result.pointer).toBe(1);
    expect(result.history[1].nodes.length).toBe(2);
  });

  it('should truncate redo states when pushing a new state from a past pointer', () => {
    const state1: HistoryState = { nodes: [node1], edges: [], legacyText: '1' };
    const state2: HistoryState = { nodes: [node1], edges: [], legacyText: '2' };
    const state3: HistoryState = { nodes: [node1], edges: [], legacyText: '3' };
    const history: HistoryState[] = [state1, state2, state3];
    const pointer = 1; // Undone to state2
    
    const newState: HistoryState = { nodes: [node1], edges: [edge1], legacyText: '4' };
    const result = pushHistoryState(history, pointer, newState);
    
    expect(result.history.length).toBe(3); // state1, state2, newState (state3 is truncated)
    expect(result.pointer).toBe(2);
    expect(result.history[2].edges.length).toBe(1);
  });

  it('should enforce max history size of 50', () => {
    let history: HistoryState[] = [];
    let pointer = -1;
    
    for (let i = 0; i < 60; i++) {
      const state: HistoryState = { nodes: [node1], edges: [], legacyText: `text-${i}` };
      const res = pushHistoryState(history, pointer, state);
      history = res.history;
      pointer = res.pointer;
    }
    
    expect(history.length).toBe(50);
    expect(pointer).toBe(49);
    expect(history[0].legacyText).toBe('text-10'); // 60 - 50 = 10
    expect(history[49].legacyText).toBe('text-59');
  });
});

describe('Subtree Deletion Collection', () => {
  const edges: Edge[] = [
    { id: 'e1', source: 'start', target: 'say' },
    { id: 'e2', source: 'say', target: 'ask' },
    { id: 'e3', source: 'ask', target: 'action1', sourceHandle: 'opt1' },
    { id: 'e4', source: 'ask', target: 'action2', sourceHandle: 'opt2' },
    { id: 'e5', source: 'action1', target: 'end' },
    { id: 'e6', source: 'action2', target: 'end' },
  ];

  it('should collect descendants of the deleted node correctly', () => {
    const askDescendants = getDescendantNodeIds('ask', edges);
    expect(askDescendants.has('action1')).toBe(true);
    expect(askDescendants.has('action2')).toBe(true);
    expect(askDescendants.has('end')).toBe(true);
    expect(askDescendants.has('say')).toBe(false);
    expect(askDescendants.has('start')).toBe(false);
  });
});
