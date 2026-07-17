import type { ExecutionContext } from '../execution-types';
import { scheduleDelayTask } from '../../gcp-tasks-client';

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
 * Calculates the exact execution date/time for a delay node based on its configuration.
 */
export async function calculateExecuteAt(
  config: DelayNodeConfig,
  context: ExecutionContext,
  now: Date = new Date()
): Promise<Date> {
  const waitType = config.waitType || 'period';

  // 1. Until a Specific Day and/or Time
  if (waitType === 'specific_date') {
    if (config.specificDate) {
      const [year, month, day] = String(config.specificDate).split('-').map(Number);
      const [hour, minute] = String(config.specificTime || '09:00').split(':').map(Number);
      return new Date(year, month - 1, day, hour, minute, 0, 0);
    } else if (config.specificTime) {
      // Omitted target date: schedule for the next occurrence of this specific time
      const [hour, minute] = String(config.specificTime).split(':').map(Number);
      const executeAt = new Date(now);
      executeAt.setHours(hour, minute, 0, 0);
      if (executeAt.getTime() <= now.getTime()) {
        executeAt.setDate(executeAt.getDate() + 1);
      }
      return executeAt;
    }
  }

  // 2. On a Specific Day of Week
  if (waitType === 'scheduled_day' && (config.scheduledDay || config.scheduledDayPreset)) {
    const dayVal = String(config.scheduledDay || config.scheduledDayPreset).toLowerCase();
    const [hour, minute] = String(config.scheduledTime || '09:00').split(':').map(Number);
    const executeAt = new Date(now);
    executeAt.setHours(hour, minute, 0, 0);

    if (dayVal === 'weekend') {
      const currentDay = now.getDay();
      const isWeekend = currentDay === 0 || currentDay === 6;
      if (isWeekend && executeAt.getTime() > now.getTime()) {
        // Use today
      } else {
        let daysToAdd = 1;
        while (daysToAdd <= 14) {
          const nextDay = new Date(now);
          nextDay.setDate(now.getDate() + daysToAdd);
          if (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
            executeAt.setDate(now.getDate() + daysToAdd);
            break;
          }
          daysToAdd++;
        }
      }
    } else if (dayVal === 'weekday') {
      const currentDay = now.getDay();
      const isWeekday = currentDay >= 1 && currentDay <= 5;
      if (isWeekday && executeAt.getTime() > now.getTime()) {
        // Use today
      } else {
        let daysToAdd = 1;
        while (daysToAdd <= 14) {
          const nextDay = new Date(now);
          nextDay.setDate(now.getDate() + daysToAdd);
          const nextD = nextDay.getDay();
          if (nextD >= 1 && nextD <= 5) {
            executeAt.setDate(now.getDate() + daysToAdd);
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
      const currentDay = now.getDay();
      let daysToAdd = (targetDay - currentDay + 7) % 7;
      if (daysToAdd === 0 && executeAt.getTime() <= now.getTime()) {
        daysToAdd = 7;
      }
      executeAt.setDate(executeAt.getDate() + daysToAdd);
    }
    return executeAt;
  }

  // 3. On a Specific Month / Day of Month (with optional Year)
  if (waitType === 'scheduled_month') {
    const [hour, minute] = String(config.scheduledTime || '09:00').split(':').map(Number);
    const executeAt = new Date(now);
    executeAt.setHours(hour, minute, 0, 0);

    let targetYear = now.getFullYear();
    if (config.scheduledYear && config.scheduledYear !== 'any') {
      targetYear = Number(config.scheduledYear);
    }

    let targetMonth = now.getMonth();
    if (config.scheduledMonth && config.scheduledMonth !== 'any') {
      targetMonth = Number(config.scheduledMonth) - 1;
    }

    let targetDay = now.getDate();
    if (config.scheduledDayOfMonth && config.scheduledDayOfMonth !== 'any') {
      if (config.scheduledDayOfMonth === 'last') {
        targetDay = new Date(targetYear, targetMonth + 1, 0).getDate();
      } else {
        targetDay = Number(config.scheduledDayOfMonth);
      }
    }

    executeAt.setFullYear(targetYear, targetMonth, targetDay);

    if (executeAt.getTime() <= now.getTime()) {
      if (!config.scheduledYear || config.scheduledYear === 'any') {
        if (!config.scheduledMonth || config.scheduledMonth === 'any') {
          executeAt.setMonth(executeAt.getMonth() + 1);
          if (config.scheduledDayOfMonth === 'last') {
            const lastDay = new Date(executeAt.getFullYear(), executeAt.getMonth() + 1, 0).getDate();
            executeAt.setDate(lastDay);
          }
        } else {
          executeAt.setFullYear(executeAt.getFullYear() + 1);
        }
      }
    }
    return executeAt;
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
  });
}
