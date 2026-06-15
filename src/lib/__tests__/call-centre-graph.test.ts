import { describe, it, expect } from 'vitest';
import { 
  isJsonGraph, 
  parseGraph, 
  getNextNodeChoices, 
  resolveScriptVariables, 
  validateScriptGraph 
} from '../call-centre-graph';
import type { BranchingScriptGraph } from '../types';

describe('Call Centre Visual Script Graph Traversal Engine', () => {

  describe('isJsonGraph', () => {
    it('should identify valid JSON graphs', () => {
      const validJson = JSON.stringify({ nodes: [], edges: [] });
      expect(isJsonGraph(validJson)).toBe(true);
    });

    it('should reject invalid JSON structures', () => {
      expect(isJsonGraph('Hello world')).toBe(false);
      expect(isJsonGraph('{"nodes": []}')).toBe(false); // missing edges array
    });
  });

  describe('parseGraph', () => {
    it('should parse valid JSON graphs correctly', () => {
      const graphData: BranchingScriptGraph = {
        nodes: [
          { id: '1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start', text: 'Hi' } }
        ],
        edges: []
      };
      const result = parseGraph(JSON.stringify(graphData));
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('1');
    });

    it('should fallback to linear graph for plain text inputs', () => {
      const plainText = 'This is a linear script document content text.';
      const result = parseGraph(plainText);
      expect(result.nodes).toHaveLength(3);
      expect(result.nodes[1].data.text).toBe(plainText);
      expect(result.edges).toHaveLength(2);
    });
  });

  describe('getNextNodeChoices', () => {
    it('should return next choices mapped from outgoing edges', () => {
      const graph: BranchingScriptGraph = {
        nodes: [
          { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start', text: '' } },
          { id: 'block-yes', type: 'script_block', position: { x: 0, y: 0 }, data: { label: 'Yes block', text: 'Awesome' } },
          { id: 'block-no', type: 'script_block', position: { x: 0, y: 0 }, data: { label: 'No block', text: 'Sorry' } }
        ],
        edges: [
          { id: 'edge-yes', source: 'start', target: 'block-yes', label: 'Yes' },
          { id: 'edge-no', source: 'start', target: 'block-no', label: 'No' }
        ]
      };

      const choices = getNextNodeChoices(graph, 'start');
      expect(choices).toHaveLength(2);
      expect(choices[0].edgeLabel).toBe('Yes');
      expect(choices[0].targetNode.id).toBe('block-yes');
      expect(choices[1].edgeLabel).toBe('No');
      expect(choices[1].targetNode.id).toBe('block-no');
    });
  });

  describe('resolveScriptVariables', () => {
    const mockEntity = {
      name: 'Lincoln Academy',
      entityType: 'institution',
      email: 'admissions@lincoln.edu',
      phone: '+233242000000',
      entityContacts: [
        { name: 'John Doe', email: 'john@lincoln.edu', phone: '+233242111111', isPrimary: true }
      ]
    };

    const mockDeal = {
      name: 'Lincoln CRM Bundle 2026',
      value: 4500,
      stageName: 'Qualified Lead',
      status: 'open',
      expectedCloseDate: '2026-09-30'
    };

    it('should resolve Entity and Deal fields successfully', () => {
      const template = 'Hi, I am calling about {{DEAL_NAME}} value {{DEAL_VALUE}} for {{ENTITY_NAME}}. Please contact {{PRIMARY_CONTACT_NAME}} at {{PRIMARY_CONTACT_PHONE}}.';
      const resolved = resolveScriptVariables(template, mockEntity, mockDeal, 'Agent Akosua');
      
      expect(resolved).toContain('Lincoln CRM Bundle 2026');
      expect(resolved).toContain('4500');
      expect(resolved).toContain('Lincoln Academy');
      expect(resolved).toContain('John Doe');
      expect(resolved).toContain('+233242111111');
    });

    it('should render fallback values when Deal is missing', () => {
      const template = 'Deal: {{DEAL_NAME}}, Agent: {{AGENT_NAME}}';
      const resolved = resolveScriptVariables(template, mockEntity, null, 'Agent Akosua');
      
      expect(resolved).toContain('[No Active Deal]');
      expect(resolved).toContain('Agent Akosua');
    });
  });

  describe('validateScriptGraph', () => {
    it('should warn when start or end nodes are missing', () => {
      const graph: BranchingScriptGraph = {
        nodes: [
          { id: '1', type: 'script_block', position: { x: 0, y: 0 }, data: { label: 'Block', text: 'Hi' } }
        ],
        edges: []
      };
      const result = validateScriptGraph(graph);
      expect(result.isValid).toBe(false);
      expect(result.warnings).toContain('Script must contain at least one Start node.');
      expect(result.warnings).toContain('Script should contain at least one End node.');
    });

    it('should detect orphaned nodes', () => {
      const graph: BranchingScriptGraph = {
        nodes: [
          { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start', text: '' } },
          { id: 'orphan', type: 'script_block', position: { x: 0, y: 0 }, data: { label: 'Orphan', text: '' } },
          { id: 'end', type: 'end', position: { x: 0, y: 0 }, data: { label: 'End', text: '' } }
        ],
        edges: [
          { id: 'edge-1', source: 'start', target: 'end' }
        ]
      };
      const result = validateScriptGraph(graph);
      expect(result.warnings).toContain('Node "Orphan" is orphaned (no incoming or outgoing connections).');
    });

    it('should detect loop cycles', () => {
      const graph: BranchingScriptGraph = {
        nodes: [
          { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start', text: '' } },
          { id: 'node-a', type: 'script_block', position: { x: 0, y: 0 }, data: { label: 'Node A', text: '' } },
          { id: 'node-b', type: 'script_block', position: { x: 0, y: 0 }, data: { label: 'Node B', text: '' } },
          { id: 'end', type: 'end', position: { x: 0, y: 0 }, data: { label: 'End', text: '' } }
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'node-a' },
          { id: 'e2', source: 'node-a', target: 'node-b' },
          { id: 'e3', source: 'node-b', target: 'node-a' }, // loop
          { id: 'e4', source: 'node-b', target: 'end' }
        ]
      };
      const result = validateScriptGraph(graph);
      expect(result.warnings).toContain('The script contains loop cycles (nodes referencing each other). Ensure this is intended.');
    });

    it('should warn when question node lacks a fieldName binding', () => {
      const graph: BranchingScriptGraph = {
        nodes: [
          { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start', text: '' } },
          { id: 'q1', type: 'question', position: { x: 0, y: 0 }, data: { label: 'Ask Budget', text: '', questionConfig: { fieldBinding: 'contact' } } },
          { id: 'end', type: 'end', position: { x: 0, y: 0 }, data: { label: 'End', text: '' } }
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'q1' },
          { id: 'e2', source: 'q1', target: 'end' }
        ]
      };
      const result = validateScriptGraph(graph);
      expect(result.warnings.some(w => w.includes('lacks a CRM data field binding'))).toBe(true);
    });

    it('should warn when select question node has no options configured', () => {
      const graph: BranchingScriptGraph = {
        nodes: [
          { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start', text: '' } },
          { id: 'q1', type: 'question', position: { x: 0, y: 0 }, data: { label: 'Choose course', text: '', questionConfig: { fieldBinding: 'contact', fieldName: 'course', fieldType: 'select', selectOptions: [] } } },
          { id: 'end', type: 'end', position: { x: 0, y: 0 }, data: { label: 'End', text: '' } }
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'q1' },
          { id: 'e2', source: 'q1', target: 'end' }
        ]
      };
      const result = validateScriptGraph(graph);
      expect(result.warnings.some(w => w.includes('has no options configured'))).toBe(true);
    });

    it('should warn when start node allowed hours are not in HH:MM format', () => {
      const graph: BranchingScriptGraph = {
        nodes: [
          { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start', text: '', startConfig: { checkTimezone: true, allowedHoursStart: '9am' } } },
          { id: 'end', type: 'end', position: { x: 0, y: 0 }, data: { label: 'End', text: '' } }
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'end' }
        ]
      };
      const result = validateScriptGraph(graph);
      expect(result.warnings.some(w => w.includes('allowed start hours must match HH:MM 24h format'))).toBe(true);
    });

    it('should warn when webhook action node has invalid URL', () => {
      const graph: BranchingScriptGraph = {
        nodes: [
          { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start', text: '' } },
          { id: 'act1', type: 'action', position: { x: 0, y: 0 }, data: { label: 'Trigger webhook', text: '', actionType: 'WEBHOOK', actionConfig: { webhookUrl: 'invalid_url' } } },
          { id: 'end', type: 'end', position: { x: 0, y: 0 }, data: { label: 'End', text: '' } }
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'act1' },
          { id: 'e2', source: 'act1', target: 'end' }
        ]
      };
      const result = validateScriptGraph(graph);
      expect(result.warnings.some(w => w.includes('requires a valid HTTP/HTTPS Webhook URL'))).toBe(true);
    });
  });
});
