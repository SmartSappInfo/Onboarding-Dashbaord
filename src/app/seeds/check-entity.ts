import { logActivity } from '../../lib/activity-logger';

async function testLogActivity() {
  console.log('Attempting to call logActivity...');
  try {
    await logActivity({
      organizationId: 'smartsapp-hq',
      workspaceId: 'prospect',
      entityId: 'entity_06dd45a9-831e-4481-8072-8621eade8524',
      entityType: 'institution',
      displayName: 'Test 1 Joseph International School',
      type: 'tag_added',
      source: 'activity',
      userId: 'wZn3YwYmrYQPCPJX2gaZIQClFUU2',
      description: 'Tag "[Campaign] Fee Collection Masterlass" applied (Test).',
      metadata: {
        tagId: 'SpkOiBwAqhmgilPeHh4O',
        tagName: '[Campaign] Fee Collection Masterlass',
        contactType: 'workspace_entity',
        appliedBy: 'wZn3YwYmrYQPCPJX2gaZIQClFUU2',
      }
    });
    console.log('logActivity call completed successfully!');
  } catch (err: any) {
    console.error('logActivity threw an error:', err);
  }
}

testLogActivity().catch(console.error);
