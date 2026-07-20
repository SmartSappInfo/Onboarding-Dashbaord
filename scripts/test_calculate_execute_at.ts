import { calculateExecuteAt } from '../src/lib/automations/nodes/delay';
import type { ExecutionContext } from '../src/lib/automations/execution-types';

async function main() {
    const config = {"value":6,"scheduledTime":"09:15","waitType":"scheduled_day","scheduledDayPreset":"tuesday","unit":"Minutes"};
    const context: ExecutionContext = {
        runId: '123',
        automationId: '456',
        workspaceId: '789',
        entityId: '012',
        entityType: 'person',
        payload: {}
    };

    const now = new Date(); // Right now
    const executeAt = await calculateExecuteAt(config, context, now);
    
    console.log('Now:', now.toISOString(), now.toLocaleString());
    console.log('ExecuteAt:', executeAt.toISOString(), executeAt.toLocaleString());
    console.log('Delay Ms:', executeAt.getTime() - now.getTime());
}

main().catch(console.error);
