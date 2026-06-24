import { describe, it, expect } from 'vitest';
import type { Node, Edge } from 'reactflow';
import {
  cloneSingleNode,
  cloneSubtree,
  getDescendantNodeIds
} from '../call-centre-cloning';

describe('Call Centre Script Step Cloning Logic', () => {

  const initialNodes: Node[] = [
    { id: 'start', type: 'start', position: { x: 300, y: 100 }, data: { label: 'Start Call', text: '' } },
    { id: 'say1', type: 'script_block', position: { x: 300, y: 250 }, data: { label: 'Greeting', text: 'Hello' } },
    { id: 'question1', type: 'question', position: { x: 300, y: 400 }, data: { label: 'Ask Need', text: 'What is your need?', options: ['Admissions', 'Support'] } },
    { id: 'admissions-block', type: 'script_block', position: { x: 100, y: 600 }, data: { label: 'Admissions details', text: '' } },
    { id: 'support-block', type: 'script_block', position: { x: 500, y: 600 }, data: { label: 'Support details', text: '' } },
    { id: 'end', type: 'end', position: { x: 300, y: 800 }, data: { label: 'End Call', text: '' } }
  ];

  const initialEdges: Edge[] = [
    { id: 'e1', source: 'start', target: 'say1' },
    { id: 'e2', source: 'say1', target: 'question1' },
    { id: 'e3', source: 'question1', target: 'admissions-block', sourceHandle: 'option-0' },
    { id: 'e4', source: 'question1', target: 'support-block', sourceHandle: 'option-1' },
    { id: 'e5', source: 'admissions-block', target: 'end' },
    { id: 'e6', source: 'support-block', target: 'end' }
  ];

  const nodeHeights = {
    start: 90,
    end: 80,
    script_block: 130,
    question: 150,
    objection: 140,
    action: 120
  };

  const verticalGap = 80;

  describe('getDescendantNodeIds', () => {
    it('should find all descendant IDs recursively', () => {
      const descendants = getDescendantNodeIds('question1', initialEdges);
      expect(descendants.has('admissions-block')).toBe(true);
      expect(descendants.has('support-block')).toBe(true);
      expect(descendants.has('end')).toBe(true);
      expect(descendants.has('say1')).toBe(false);
      expect(descendants.has('start')).toBe(false);
    });
  });

  describe('cloneSingleNode', () => {
    it('should duplicate only the target node and insert it between originator and its children', () => {
      const result = cloneSingleNode(
        initialNodes,
        initialEdges,
        'say1',
        nodeHeights,
        verticalGap
      );

      expect(result.newId).toBeDefined();
      expect(result.nodes.length).toBe(initialNodes.length + 1);

      // Verify the cloned node properties
      const clonedNode = result.nodes.find(n => n.id === result.newId);
      expect(clonedNode).toBeDefined();
      expect(clonedNode?.data.label).toBe('Greeting (Copy)');
      expect(clonedNode?.data.text).toBe('Hello');
      
      // Target node type height is 130, verticalGap is 80 -> dy = 210
      // Original say1 position y = 250 -> cloned should be y = 250 + 210 = 460
      expect(clonedNode?.position.y).toBe(460);

      // Descendants of say1 are question1, admissions-block, support-block, end.
      // They should all be shifted down by 210px
      const originalQuestion = initialNodes.find(n => n.id === 'question1')!;
      const shiftedQuestion = result.nodes.find(n => n.id === 'question1')!;
      expect(shiftedQuestion.position.y).toBe(originalQuestion.position.y + 210);

      // Start node should NOT be shifted
      const originalStart = initialNodes.find(n => n.id === 'start')!;
      const shiftedStart = result.nodes.find(n => n.id === 'start')!;
      expect(shiftedStart.position.y).toBe(originalStart.position.y);

      // Verify edge re-routing
      // say1 should connect to clonedNode, and clonedNode should connect to question1
      const edgeToClone = result.edges.find(e => e.source === 'say1' && e.target === result.newId);
      const edgeFromClone = result.edges.find(e => e.source === result.newId && e.target === 'question1');
      expect(edgeToClone).toBeDefined();
      expect(edgeFromClone).toBeDefined();

      // The original edge say1 -> question1 should be deleted
      const originalEdge = result.edges.find(e => e.source === 'say1' && e.target === 'question1');
      expect(originalEdge).toBeUndefined();
    });
  });

  describe('cloneSubtree', () => {
    it('should duplicate the node and its downstream subtree and place them shifted to the right', () => {
      const result = cloneSubtree(
        initialNodes,
        initialEdges,
        'question1',
        300
      );

      expect(result.newRootId).toBeDefined();
      
      // question1 subtree contains question1, admissions-block, support-block, end
      // Total cloned nodes = 4
      expect(result.nodes.length).toBe(initialNodes.length + 4);

      const clonedRoot = result.nodes.find(n => n.id === result.newRootId);
      expect(clonedRoot).toBeDefined();
      expect(clonedRoot?.data.label).toBe('Ask Need (Copy)');
      expect(clonedRoot?.position.x).toBe(initialNodes.find(n => n.id === 'question1')!.position.x + 300);

      // Check if cloned children are present
      const clonedAdmissions = result.nodes.find(n => n.data.label === 'Admissions details' && n.id !== 'admissions-block');
      expect(clonedAdmissions).toBeDefined();
      expect(clonedAdmissions?.position.x).toBe(initialNodes.find(n => n.id === 'admissions-block')!.position.x + 300);

      // The cloned subtree root should be connected to the parent of question1 (say1)
      const edgeToClonedRoot = result.edges.find(e => e.source === 'say1' && e.target === result.newRootId);
      expect(edgeToClonedRoot).toBeDefined();

      // Original parent-child connection say1 -> question1 should still exist
      const originalParentEdge = result.edges.find(e => e.source === 'say1' && e.target === 'question1');
      expect(originalParentEdge).toBeDefined();
    });
  });
});
