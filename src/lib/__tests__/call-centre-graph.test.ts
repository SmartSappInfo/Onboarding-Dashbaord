import { describe, it, expect } from 'vitest';
import {
  isJsonGraph,
  parseGraph,
  getNextNodeChoices,
  resolveScriptVariables,
  validateScriptGraph,
  extractOutcomesFromGraph,
  getOutcomeAutomations,
  sanitizeImportedAutomations,
  ScriptVariableEntity
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
    const mockEntity: ScriptVariableEntity = {
      name: 'Lincoln Academy',
      entityType: 'institution',
      email: 'admissions@lincoln.edu',
      phone: '+233242000000',
      entityContacts: [
        { name: 'John Doe', email: 'john@lincoln.edu', phone: '+233242111111', isPrimary: true, id: 'c1', typeKey: 'primary', isSignatory: false, order: 0 }
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

    it('should resolve CURRENT_CONTACT variables if specified', () => {
      const template = 'Talking to {{CURRENT_CONTACT_NAME}} at {{CURRENT_CONTACT_PHONE}} / {{CURRENT_CONTACT_EMAIL}}';
      const mockCurrent = { name: 'Ekow Mensah', phone: '+233242222222', email: 'ekow@lincoln.edu', id: 'c2', typeKey: 'signatory', isPrimary: false, isSignatory: true, order: 1 };
      const resolved = resolveScriptVariables(template, mockEntity, null, 'Agent Akosua', mockCurrent);
      expect(resolved).toBe('Talking to Ekow Mensah at +233242222222 / ekow@lincoln.edu');
    });

    it('should fallback CURRENT_CONTACT to primary contact when currentContact is not provided', () => {
      const template = 'Talking to {{CURRENT_CONTACT_NAME}}';
      const resolved = resolveScriptVariables(template, mockEntity, null, 'Agent Akosua');
      expect(resolved).toBe('Talking to John Doe');
    });

    it('should resolve nested entity variables (personData, onlinePresence, financeData, industryData, customData)', () => {
      const complexEntity = {
        name: 'Alpha Tech',
        entityType: 'institution',
        personData: {
          lastName: 'Smith',
          company: 'Alpha LLC',
          jobTitle: 'VP Engineering',
          leadSource: 'Referral',
        },
        onlinePresence: {
          website: 'https://alpha.tech',
          digitalAddress: 'GA-123-4567',
          x: '@alphatech',
        },
        financeData: {
          currency: 'USD',
          subscriptionRate: 299,
        },
        industryData: {
          capacity: 150,
        },
        customData: {
          custom_score: '9.8',
        },
      };

      const template = 'Last name: {{LAST_NAME}}, Company: {{COMPANY}}, Job: {{JOB_TITLE}}, Lead: {{LEAD_SOURCE}}, Website: {{WEBSITE}}, Digital Address: {{DIGITAL_ADDRESS}}, Twitter: {{X_TWITTER}}, Currency: {{CURRENCY}}, Sub rate: {{SUBSCRIPTION_RATE}}, Capacity: {{CAPACITY}}, Custom: {{CUSTOM_SCORE}}';
      const resolved = resolveScriptVariables(template, complexEntity as any, null, 'Agent');

      expect(resolved).toContain('Smith');
      expect(resolved).toContain('Alpha LLC');
      expect(resolved).toContain('VP Engineering');
      expect(resolved).toContain('Referral');
      expect(resolved).toContain('https://alpha.tech');
      expect(resolved).toContain('GA-123-4567');
      expect(resolved).toContain('@alphatech');
      expect(resolved).toContain('USD');
      expect(resolved).toContain('299');
      expect(resolved).toContain('150');
      expect(resolved).toContain('9.8');
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

    it('should warn when question node has fewer than 2 options', () => {
      const graph: BranchingScriptGraph = {
        nodes: [
          { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start', text: '' } },
          { id: 'q1', type: 'question', position: { x: 0, y: 0 }, data: { label: 'Ask Budget', text: '', options: ['Yes'] } },
          { id: 'end', type: 'end', position: { x: 0, y: 0 }, data: { label: 'End', text: '' } }
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'q1' },
          { id: 'e2', source: 'q1', target: 'end' }
        ]
      };
      const result = validateScriptGraph(graph);
      expect(result.warnings.some(w => w.includes('needs at least 2 answer options'))).toBe(true);
    });

    it('should warn when a question node option label is blank', () => {
      const graph: BranchingScriptGraph = {
        nodes: [
          { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start', text: '' } },
          { id: 'q1', type: 'question', position: { x: 0, y: 0 }, data: { label: 'Choose course', text: '', options: ['Yes', ''] } },
          { id: 'end', type: 'end', position: { x: 0, y: 0 }, data: { label: 'End', text: '' } }
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'q1' },
          { id: 'e2', source: 'q1', sourceHandle: 'option-0', target: 'end' },
          { id: 'e3', source: 'q1', sourceHandle: 'option-1', target: 'end' }
        ]
      };
      const result = validateScriptGraph(graph);
      expect(result.warnings.some(w => w.includes('has an empty label'))).toBe(true);
    });

    it('should warn when a question node option has no exit connection', () => {
      const graph: BranchingScriptGraph = {
        nodes: [
          { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start', text: '' } },
          { id: 'q1', type: 'question', position: { x: 0, y: 0 }, data: { label: 'Ask Callback', text: '', options: ['Yes', 'No'] } },
          { id: 'yes-block', type: 'script_block', position: { x: 0, y: 0 }, data: { label: 'Yes block', text: 'Great!' } },
          { id: 'end', type: 'end', position: { x: 0, y: 0 }, data: { label: 'End', text: '' } }
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'q1' },
          { id: 'e2', source: 'q1', sourceHandle: 'option-0', target: 'yes-block' },
          { id: 'e3', source: 'yes-block', target: 'end' }
        ]
      };
      const result = validateScriptGraph(graph);
      // option-1 ("No") has no exit edge — should warn
      expect(result.warnings.some(w => w.includes('has no exit connection'))).toBe(true);
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

    it('should warn when there is more than one start or end node', () => {
      const graph: BranchingScriptGraph = {
        nodes: [
          { id: 'start-1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start 1', text: '' } },
          { id: 'start-2', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start 2', text: '' } },
          { id: 'end-1', type: 'end', position: { x: 0, y: 0 }, data: { label: 'End 1', text: '' } },
          { id: 'end-2', type: 'end', position: { x: 0, y: 0 }, data: { label: 'End 2', text: '' } }
        ],
        edges: [
          { id: 'e1', source: 'start-1', target: 'end-1' },
          { id: 'e2', source: 'start-2', target: 'end-2' }
        ]
      };
      const result = validateScriptGraph(graph);
      expect(result.isValid).toBe(false);
      expect(result.warnings.some(w => w.includes('exactly one Start Call node'))).toBe(true);
      expect(result.warnings.some(w => w.includes('exactly one End Call node'))).toBe(true);
    });
  });

  describe('Outcome automation helpers', () => {
    const graph: BranchingScriptGraph = {
      nodes: [
        { id: 's', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start', text: '' } },
        { id: 'o1', type: 'outcome', position: { x: 0, y: 0 }, data: { label: '', text: '', outcomeValue: 'Interested',
            outcomeConfig: { automations: [{ type: 'ADD_TAG', params: { tagId: 't1' } }] } } },
        { id: 'o2', type: 'outcome', position: { x: 0, y: 0 }, data: { label: '', text: '', outcomeValue: 'Interested' } },
        { id: 'o3', type: 'outcome', position: { x: 0, y: 0 }, data: { label: '', text: '', outcomeValue: 'Not Interested' } },
      ],
      edges: [],
    };

    it('extractOutcomesFromGraph returns distinct outcome values in order', () => {
      expect(extractOutcomesFromGraph(graph)).toEqual(['Interested', 'Not Interested']);
    });

    it('extractOutcomesFromGraph returns [] for a graph with no outcome nodes', () => {
      expect(extractOutcomesFromGraph({ nodes: [graph.nodes[0]], edges: [] })).toEqual([]);
    });

    it('getOutcomeAutomations returns the matching node automations', () => {
      expect(getOutcomeAutomations(graph, 'Interested')).toEqual([{ type: 'ADD_TAG', params: { tagId: 't1' } }]);
    });

    it('getOutcomeAutomations returns null when outcome has no automations (legacy fallback signal)', () => {
      expect(getOutcomeAutomations(graph, 'Not Interested')).toBeNull();
      expect(getOutcomeAutomations(graph, 'Unknown')).toBeNull();
    });

    it('sanitizeImportedAutomations clears org-scoped ids and webhook urls but keeps free text', () => {
      const dirty: BranchingScriptGraph = { edges: [], nodes: [{ id: 'o', type: 'outcome', position: { x: 0, y: 0 },
        data: { label: '', text: '', outcomeValue: 'X', outcomeConfig: { automations: [
          { type: 'SEND_SMS', params: { templateId: 'foreign' } },
          { type: 'WEBHOOK', params: { webhookUrl: 'http://evil.test', noteContent: 'keep me' } },
        ] } } }] };
      const clean = sanitizeImportedAutomations(dirty);
      const automations = clean.nodes[0].data.outcomeConfig!.automations!;
      expect(automations[0].params.templateId).toBe('');
      expect(automations[1].params.webhookUrl).toBe('');
      expect(automations[1].params.noteContent).toBe('keep me');
    });

    it('sanitizeImportedAutomations leaves non-outcome nodes untouched', () => {
      const result = sanitizeImportedAutomations(graph);
      expect(result.nodes[0]).toBe(graph.nodes[0]); // start node returned by reference
    });
  });
});
