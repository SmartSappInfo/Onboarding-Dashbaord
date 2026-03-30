# Migration Monitoring System

This document describes the monitoring, logging, metrics tracking, and alerting system for the SchoolId to EntityId migration.

## Overview

The migration monitoring system provides comprehensive observability for all migration operations, including:

- **Operation Logging**: All migration operations (fetch, enrich, restore, verify, rollback) are logged
- **Metrics Tracking**: Records processed, success/failure counts, duration, and performance metrics
- **Alerting**: Automatic alerts when error rates exceed thresholds
- **Log Retention**: 90-day retention policy with automatic cleanup
- **Export**: Audit-ready log export functionality

## Requirements

Implements Requirements 30.1-30.5:
- 30.1: Log all migration operations
- 30.2: Track migration metrics
- 30.3: Send alerts when failure rate exceeds 5%
- 30.4: Display metrics in Seeds page dashboard
- 30.5: Retain logs for 90 days with export functionality

## Architecture

### Data Collections

The monitoring system uses three Firestore collections:

1. **migration_operation_logs**: Logs of all migration operations
   - Operation type, collection, timestamp, duration
   - Status (started, completed, failed)
   - Result summary (success/failure counts, errors)

2. **migration_metrics**: Performance metrics for each operation
   - Records processed, success rate, error rate
   - Duration, records per second
   - Batch processing information

3. **migration_alerts**: Alerts for issues requiring attention
   - Alert type (high_error_rate, operation_failed, orphaned_records)
   - Severity (warning, error, critical)
   - Details and acknowledgment status

### Components

#### Server-Side (`src/lib/migration-monitoring.ts`)

Core monitoring functions:
- `logMigrationOperationStart()` - Log operation start
- `logMigrationOperationComplete()` - Log operation completion with metrics
- `logMigrationOperationFailed()` - Log operation failure
- `getMigrationOperationLogs()` - Query operation logs
- `getMigrationMetrics()` - Query metrics
- `getMigrationAlerts()` - Query alerts
- `acknowledgeMigrationAlert()` - Acknowledge an alert
- `getMigrationDashboardSummary()` - Get dashboard summary
- `cleanupOldMigrationLogs()` - Clean up old logs (90-day retention)
- `exportMigrationLogs()` - Export logs for audit

#### Client-Side Wrapper (`src/lib/migration-engine-monitored.ts`)

Wraps the migration engine with monitoring:
- `MonitoredMigrationEngine` - Wraps all migration operations
- Automatically logs operation start/complete/failed
- Tracks metrics and creates alerts
- Transparent to migration engine consumers

#### API Routes

- `POST /api/migration/log-operation-start` - Log operation start
- `POST /api/migration/log-operation-complete` - Log operation completion
- `POST /api/migration/log-operation-failed` - Log operation failure
- `GET /api/migration/dashboard` - Get dashboard summary
- `GET /api/migration/logs` - Get operation logs
- `GET /api/migration/metrics` - Get metrics
- `GET /api/migration/alerts` - Get alerts
- `POST /api/migration/alerts` - Acknowledge alert
- `GET /api/migration/export` - Export logs
- `POST /api/migration/cleanup` - Clean up old logs

#### UI Component (`src/components/seeds/MigrationDashboard.tsx`)

Dashboard displaying:
- Summary cards (collections, records, success rate, alerts)
- Active alerts with acknowledgment
- Recent operations with status
- Export logs button

## Usage

### Using Monitored Migration Engine

```typescript
import { createMonitoredMigrationEngine } from '@/lib/migration-engine-monitored';
import { firestore } from '@/firebase/config';

// Create monitored engine with user context
const engine = createMonitoredMigrationEngine(firestore, {
  userId: 'user-123',
  userName: 'John Doe',
  organizationId: 'org-123',
});

// All operations are automatically monitored
const fetchResult = await engine.fetch('tasks');
const enrichedBatch = await engine.enrich(batch);
const migrationResult = await engine.restore(enrichedBatch);
```

### Viewing Dashboard

Add the dashboard component to your Seeds page:

```tsx
import { MigrationDashboard } from '@/components/seeds/MigrationDashboard';

export default function SeedsPage() {
  return (
    <div>
      <h1>Migration Dashboard</h1>
      <MigrationDashboard />
    </div>
  );
}
```

### Querying Logs

```typescript
import { getMigrationOperationLogs } from '@/lib/migration-monitoring';

// Get all logs for a collection
const result = await getMigrationOperationLogs({
  collection: 'tasks',
  limit: 50,
});

// Get failed operations
const failedOps = await getMigrationOperationLogs({
  status: 'failed',
  limit: 10,
});
```

### Exporting Logs

```typescript
import { exportMigrationLogs } from '@/lib/migration-monitoring';

// Export all logs
const result = await exportMigrationLogs();

// Export logs for specific collection and date range
const filtered = await exportMigrationLogs({
  collection: 'tasks',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
});

// Save to file
const json = JSON.stringify(result.data, null, 2);
fs.writeFileSync('migration-logs.json', json);
```

### Cleanup Old Logs

Run the cleanup script manually:

```bash
# Clean up logs older than 90 days (default)
pnpm migrate:cleanup-logs

# Clean up logs older than 30 days
pnpm migrate:cleanup-logs --retention-days=30
```

Or schedule as a cron job:

```bash
# Run daily at 2 AM
0 2 * * * cd /path/to/project && pnpm migrate:cleanup-logs
```

## Alert Thresholds

### High Error Rate Alert

Triggered when error rate exceeds 5% of total records:

- **Warning**: 5-20% error rate
- **Critical**: >20% error rate

Alert includes:
- Error rate percentage
- Failure count
- Total records
- First 10 errors

### Operation Failed Alert

Triggered when an entire operation fails:

- **Severity**: Error
- Includes error message and operation details

### Orphaned Records Alert

Triggered during verification when records reference non-existent entities:

- **Severity**: Warning
- Includes count of orphaned records

## Metrics Tracked

For each operation, the following metrics are tracked:

- **Records Processed**: Total number of records processed
- **Success Count**: Number of successfully processed records
- **Failure Count**: Number of failed records
- **Skipped Count**: Number of skipped records
- **Success Rate**: Percentage of successful records
- **Error Rate**: Percentage of failed records
- **Duration**: Total operation duration in milliseconds
- **Records Per Second**: Processing throughput

## Log Retention

- **Retention Period**: 90 days (configurable)
- **Cleanup Scope**:
  - Operation logs older than retention period
  - Metrics older than retention period
  - Acknowledged alerts older than retention period
- **Unacknowledged Alerts**: Retained indefinitely until acknowledged
- **Cleanup Schedule**: Run daily via cron job

## Security

- All monitoring operations require server-side execution
- Logs include user context (userId, userName) for audit trail
- Organization ID scoping for multi-tenant isolation
- Export functionality for compliance and audit requirements

## Testing

Run monitoring tests:

```bash
pnpm test src/lib/__tests__/migration-monitoring.test.ts
```

Tests cover:
- Operation logging (start, complete, failed)
- Metrics tracking and calculation
- Alert creation and thresholds
- Dashboard summary generation
- Log cleanup and retention
- Export functionality

## Troubleshooting

### Logs Not Appearing

1. Check Firestore permissions for `migration_operation_logs` collection
2. Verify API routes are accessible
3. Check browser console for errors

### Alerts Not Triggering

1. Verify error rate exceeds 5% threshold
2. Check `migration_alerts` collection in Firestore
3. Review `logMigrationOperationComplete` calls

### Dashboard Not Loading

1. Check `/api/migration/dashboard` endpoint
2. Verify Firestore queries have proper indexes
3. Check browser network tab for API errors

### Cleanup Not Working

1. Verify Firebase Admin SDK is initialized
2. Check Firestore permissions for delete operations
3. Review cleanup script logs for errors

## Best Practices

1. **Always use MonitoredMigrationEngine** instead of raw MigrationEngine
2. **Provide user context** when creating monitored engine
3. **Acknowledge alerts** after reviewing and addressing issues
4. **Export logs regularly** for long-term audit retention
5. **Schedule cleanup job** to prevent unbounded log growth
6. **Monitor dashboard** during active migrations
7. **Review metrics** to optimize batch sizes and performance

## Future Enhancements

Potential improvements:
- Real-time dashboard updates via WebSocket
- Email/Slack notifications for critical alerts
- Grafana/Prometheus integration for metrics
- Advanced filtering and search in dashboard
- Automated rollback on high error rates
- Performance trend analysis and recommendations
