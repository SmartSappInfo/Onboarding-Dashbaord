import type { ExecutionContext } from '../execution-types';
import { scheduleDelayTask } from '../../gcp-tasks-client';
import { adminDb } from '../../firebase-admin';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

export interface DelayNodeConfig {
  waitType?: string;
  value?: number;
  unit?: string;
  periods?: Array<{ value: number; unit: string }>;
  specificDate?: string;
  specificTime?: string;
  scheduledDay?: string;
  scheduledTime?: string;
  scheduledYear?: string;
  scheduledMonth?: string;
  scheduledDayOfMonth?: string;
  dateField?: string;
  offsetDays?: number;
  offsetDirection?: string;
  [key: string]: unknown;
}

/**
 * Parses time strings robustly, supporting both 24-hour ('14:30') and AM/PM ('02:30 PM') formats.
 */
function parseTime(timeStr: string | undefined | null): { hour: number; minute: number } {
  if (!timeStr) return { hour: 9, minute: 0 };
  const cleanTime = String(timeStr).trim().toUpperCase();
  const isPM = cleanTime.includes('PM');
  const isAM = cleanTime.includes('AM');
  
  const timePart = cleanTime.replace(/[^\d:]/g, '');
  const parts = timePart.split(':');
  
  let hour = parseInt(parts[0] || '9', 10);
  const minute = parseInt(parts[1] || '0', 10);
  
  if (isPM && hour < 12) hour += 12;
  if (isAM && hour === 12) hour = 0;
  
  return { hour: isNaN(hour) ? 9 : hour, minute: isNaN(minute) ? 0 : minute };
}

async function resolveTimezone(context: ExecutionContext): Promise<string> {
  try {
    let orgId = context.organizationId;
    if (!orgId && context.workspaceId) {
      const wsSnap = await adminDb.collection('workspaces').doc(context.workspaceId).get();
      orgId = wsSnap.data()?.organizationId;
    }
    if (orgId) {
      const orgSnap = await adminDb.collection('organizations').doc(orgId).get();
      const tz = orgSnap.data()?.settings?.defaultTimezone;
      if (tz) return tz;
    }
  } catch (error) {
    console.error('[DelayNode] Error resolving timezone:', error);
  }
  return 'UTC';
}

/**
 * Calculates the exact execution date/time for a delay node based on its configuration.
 */
export async function calculateExecuteAt(
  config: DelayNodeConfig,
  context: ExecutionContext,
  now: Date = new Date()
): Promise<Date> {
  const waitType = config.waitType || 'period';
  const timeZone = await resolveTimezone(context);
  const nowZoned = toZonedTime(now, timeZone);

  // 1. Until a Specific Day and/or Time
  if (waitType === 'specific_date') {
    if (config.specificDate) {
      const [year, month, day] = String(config.specificDate).split('-').map(Number);
      const { hour, minute } = parseTime(config.specificTime as string || '09:00');
      const executeAtZoned = new Date(year, month - 1, day, hour, minute, 0, 0);
      return fromZonedTime(executeAtZoned, timeZone);
    } else if (config.specificTime) {
      // Omitted target date: schedule for the next occurrence of this specific time
      const { hour, minute } = parseTime(config.specificTime as string);
      const executeAtZoned = new Date(nowZoned);
      executeAtZoned.setHours(hour, minute, 0, 0);
      if (executeAtZoned.getTime() <= nowZoned.getTime()) {
        executeAtZoned.setDate(executeAtZoned.getDate() + 1);
      }
      return fromZonedTime(executeAtZoned, timeZone);
    }
  }

  // 2. On a Specific Day of Week
  if (waitType === 'scheduled_day' && (config.scheduledDay || config.scheduledDayPreset)) {
    const dayVal = String(config.scheduledDay || config.scheduledDayPreset).toLowerCase();
    const { hour, minute } = parseTime(config.scheduledTime as string || '09:00');
    const executeAtZoned = new Date(nowZoned);
    executeAtZoned.setHours(hour, minute, 0, 0);

    if (dayVal === 'weekend') {
      const currentDay = nowZoned.getDay();
      const isWeekend = currentDay === 0 || currentDay === 6;
      if (isWeekend && executeAtZoned.getTime() > nowZoned.getTime()) {
        // Use today
      } else {
        let daysToAdd = 1;
        while (daysToAdd <= 14) {
          const nextDay = new Date(nowZoned);
          nextDay.setDate(nowZoned.getDate() + daysToAdd);
          if (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
            executeAtZoned.setDate(nowZoned.getDate() + daysToAdd);
            break;
          }
          daysToAdd++;
        }
      }
    } else if (dayVal === 'weekday') {
      const currentDay = nowZoned.getDay();
      const isWeekday = currentDay >= 1 && currentDay <= 5;
      if (isWeekday && executeAtZoned.getTime() > nowZoned.getTime()) {
        // Use today
      } else {
        let daysToAdd = 1;
        while (daysToAdd <= 14) {
          const nextDay = new Date(nowZoned);
          nextDay.setDate(nowZoned.getDate() + daysToAdd);
          const nextD = nextDay.getDay();
          if (nextD >= 1 && nextD <= 5) {
            executeAtZoned.setDate(nowZoned.getDate() + daysToAdd);
            break;
          }
          daysToAdd++;
        }
      }
    } else {
      const dayOfWeekMap: Record<string, number> = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6
      };
      const targetDay = dayOfWeekMap[dayVal] ?? Number(dayVal);
      const currentDay = nowZoned.getDay();
      if (isNaN(targetDay)) {
        console.warn(`[DelayNode] Invalid scheduledDay value: ${dayVal}. Falling back to Monday.`);
        // Fallback to Monday (1)
        const daysToAdd = (1 - currentDay + 7) % 7 || 7;
        executeAtZoned.setDate(executeAtZoned.getDate() + daysToAdd);
      } else {
        let daysToAdd = (targetDay - currentDay + 7) % 7;
        if (daysToAdd === 0 && executeAtZoned.getTime() <= nowZoned.getTime()) {
          daysToAdd = 7;
        }
        executeAtZoned.setDate(executeAtZoned.getDate() + daysToAdd);
      }
    }
    return fromZonedTime(executeAtZoned, timeZone);
  }

  // 3. On a Specific Month / Day of Month (with optional Year)
  if (waitType === 'scheduled_month') {
    const { hour, minute } = parseTime(config.scheduledTime as string || '09:00');
    const executeAtZoned = new Date(nowZoned);
    executeAtZoned.setHours(hour, minute, 0, 0);

    let targetYear = nowZoned.getFullYear();
    if (config.scheduledYear && config.scheduledYear !== 'any') {
      targetYear = Number(config.scheduledYear);
    }

    let targetMonth = nowZoned.getMonth();
    if (config.scheduledMonth && config.scheduledMonth !== 'any') {
      targetMonth = Number(config.scheduledMonth) - 1;
    }

    let targetDay = nowZoned.getDate();
    if (config.scheduledDayOfMonth && config.scheduledDayOfMonth !== 'any') {
      if (config.scheduledDayOfMonth === 'last') {
        targetDay = new Date(targetYear, targetMonth + 1, 0).getDate();
      } else {
        targetDay = Number(config.scheduledDayOfMonth);
      }
    }

    executeAtZoned.setFullYear(targetYear, targetMonth, targetDay);

    if (executeAtZoned.getTime() <= nowZoned.getTime()) {
      if (!config.scheduledYear || config.scheduledYear === 'any') {
        if (!config.scheduledMonth || config.scheduledMonth === 'any') {
          executeAtZoned.setMonth(executeAtZoned.getMonth() + 1);
          if (config.scheduledDayOfMonth === 'last') {
            const lastDay = new Date(executeAtZoned.getFullYear(), executeAtZoned.getMonth() + 1, 0).getDate();
            executeAtZoned.setDate(lastDay);
          }
        } else {
          executeAtZoned.setFullYear(executeAtZoned.getFullYear() + 1);
        }
      }
    }
    return fromZonedTime(executeAtZoned, timeZone);
  }

  // 4. Until a Custom Date Field Matches
  if (waitType === 'date_field') {
    const dateFieldKey = String(config.dateField || 'onboarding_date');
    let baseDate = new Date(now);

    // Try resolving from payload
    let dateVal = context.payload?.[dateFieldKey] || (context.payload?.customFields as Record<string, unknown>)?.[dateFieldKey];

    if (!dateVal && context.entityId && context.workspaceId) {
      const { resolveContact } = await import('../../contact-adapter');
      const contact = await resolveContact(context.entityId, context.workspaceId);
      if (contact) {
        const contactObj = contact as unknown as Record<string, unknown>;
        dateVal = contactObj[dateFieldKey] || (contactObj.customData as Record<string, unknown>)?.[dateFieldKey];
      }
    }

    if (dateVal) {
      baseDate = new Date(String(dateVal));
    }

    const offsetDays = Number(config.offsetDays) || 0;
    const direction = String(config.offsetDirection || 'current_date');
    const executeAt = new Date(baseDate);

    if (direction === 'before') {
      executeAt.setDate(executeAt.getDate() - offsetDays);
    } else if (direction === 'after') {
      executeAt.setDate(executeAt.getDate() + offsetDays);
    }
    return executeAt;
  }

  interface DelayPeriod {
    value: number;
    unit: string;
  }

  // 5. Period (relative duration) Wait
  if (config.periods && Array.isArray(config.periods)) {
    const executeAt = new Date(now);
    const periods = config.periods as DelayPeriod[];
    for (const period of periods) {
      const newVal = Number(period.value) || 0;
      const newUnit = String(period.unit || 'Minutes').toLowerCase();
      if (newUnit === 'minutes') executeAt.setMinutes(executeAt.getMinutes() + newVal);
      else if (newUnit === 'hours') executeAt.setHours(executeAt.getHours() + newVal);
      else if (newUnit === 'days') executeAt.setDate(executeAt.getDate() + newVal);
      else if (newUnit === 'weeks') executeAt.setDate(executeAt.getDate() + newVal * 7);
    }
    return executeAt;
  }

  // Fallback: Legacy Single Period (relative duration) Wait
  const newVal = Number(config.value) || 5;
  const newUnit = String(config.unit || 'Minutes').toLowerCase();
  const executeAt = new Date(now);

  if (newUnit === 'minutes') executeAt.setMinutes(executeAt.getMinutes() + newVal);
  else if (newUnit === 'hours') executeAt.setHours(executeAt.getHours() + newVal);
  else if (newUnit === 'days') executeAt.setDate(executeAt.getDate() + newVal);
  else if (newUnit === 'weeks') executeAt.setDate(executeAt.getDate() + newVal * 7);

  return executeAt;
}

export async function handleDelayNode(
  node: { id: string; data?: { config?: any } },
  context: ExecutionContext
): Promise<void> {
  console.log('[REAL handleDelayNode] called for node:', node.id);
  const config = node.data?.config || {};
  const executeAt = await calculateExecuteAt(config, context);

  // Persist the context-only fields (organizationId, entityType, workspaceId,
  // entityId) INTO the payload. These live on the ExecutionContext, not in
  // payload, so without this they are lost when the run is parked here and the
  // resumed context is degraded — most importantly organizationId, which scopes
  // sender + provider-key resolution for any downstream message/notification step.
  const persistedPayload = {
    ...context.payload,
    ...(context.workspaceId ? { workspaceId: context.workspaceId } : {}),
    ...(context.organizationId ? { organizationId: context.organizationId } : {}),
    ...(context.entityId ? { entityId: context.entityId } : {}),
    ...(context.entityType ? { entityType: context.entityType } : {}),
  };

  await scheduleDelayTask({
    runId: context.runId,
    nodeId: node.id,
    automationId: context.automationId,
    executeAt: executeAt.toISOString(),
    workspaceId: context.workspaceId,
    payload: persistedPayload,
    sourceNodeId: node.id,
  });
}
