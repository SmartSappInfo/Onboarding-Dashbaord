import { isSameDay, startOfDay, endOfDay } from 'date-fns';
import { Task } from '@/lib/types';

export interface LayoutItem {
  task: Task;
  top: number;
  height: number;
  left: number;
  width: number;
  startHour: number;
  endHour: number;
  colIndex: number;
}

/**
 * Computes columns and dimensions for timed tasks to prevent overlaps.
 */
export function computeTimelineLayout(
  tasks: Task[],
  currentDate: Date,
  hourHeight: number
): LayoutItem[] {
  const dayStart = startOfDay(currentDate);
  const dayEnd = endOfDay(currentDate);

  // 1. Filter, default, and clamp tasks to today
  const timedItems = tasks
    .filter(task => {
      const d = new Date(task.dueDate);
      // Exclude untimed tasks (midnight 00:00)
      if (d.getHours() === 0 && d.getMinutes() === 0) {
        return false;
      }
      return isSameDay(d, currentDate);
    })
    .map(task => {
      const due = new Date(task.dueDate);
      // Default start time to 1 hour before due date if invalid/undefined
      const start = task.startDate ? new Date(task.startDate) : new Date(due.getTime() - 60 * 60 * 1000);

      const renderStart = start < dayStart ? dayStart : start;
      const renderEnd = due > dayEnd ? dayEnd : due;

      const startHour = renderStart.getHours() + renderStart.getMinutes() / 60;
      let endHour = renderEnd.getHours() + renderEnd.getMinutes() / 60;

      // Minimum duration constraint (15 minutes)
      if (endHour <= startHour) {
        endHour = startHour + 0.25;
      }

      const top = startHour * hourHeight;
      const height = (endHour - startHour) * hourHeight;

      return {
        task,
        top,
        height,
        startHour,
        endHour,
        left: 0,
        width: 100,
        colIndex: 0,
      };
    });

  // Sort by start hour first, then by duration desc
  timedItems.sort((a, b) => {
    if (a.startHour !== b.startHour) {
      return a.startHour - b.startHour;
    }
    return (b.endHour - b.startHour) - (a.endHour - a.startHour);
  });

  // 2. Group overlapping items into visual clusters
  const clusters: LayoutItem[][] = [];
  timedItems.forEach(item => {
    let placed = false;
    for (const cluster of clusters) {
      // An item overlaps if it starts before any cluster item ends, AND ends after any cluster item starts
      const hasOverlap = cluster.some(cItem => 
        item.startHour < cItem.endHour && cItem.startHour < item.endHour
      );
      if (hasOverlap) {
        cluster.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) {
      clusters.push([item]);
    }
  });

  // 3. Divide tasks in each cluster into columns
  clusters.forEach(cluster => {
    const columns: LayoutItem[][] = [];
    cluster.forEach(item => {
      let colIndex = 0;
      while (true) {
        if (!columns[colIndex]) {
          columns[colIndex] = [];
        }
        const hasOverlapInCol = columns[colIndex].some(cItem =>
          item.startHour < cItem.endHour && cItem.startHour < item.endHour
        );
        if (!hasOverlapInCol) {
          columns[colIndex].push(item);
          break;
        }
        colIndex++;
      }
    });

    // 4. Distribute left offset and column index
    columns.forEach((col, colIndex) => {
      col.forEach(item => {
        item.colIndex = colIndex;
        item.left = colIndex * 40; // 40px stagger displacement to the right
      });
    });
  });

  return timedItems;
}

/**
 * Formats numeric minutes from midnight to localized time strings
 */
export function formatMinutesToTime(totalMinutes: number): string {
  const minutesClamped = Math.max(0, Math.min(1439, Math.round(totalMinutes)));
  const hours = Math.floor(minutesClamped / 60);
  const mins = Math.floor(minutesClamped % 60);
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayMins = mins.toString().padStart(2, '0');
  return `${displayHours}:${displayMins} ${ampm}`;
}
