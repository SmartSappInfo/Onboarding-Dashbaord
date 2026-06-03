import type { TaskStatus } from '@/lib/types';

export const getProgressValue = (status: TaskStatus) => {
    switch(status) {
        case 'todo': return 0;
        case 'in_progress': return 45;
        case 'waiting': return 65;
        case 'review': return 85;
        case 'done': return 100;
        default: return 0;
    }
};
