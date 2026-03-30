/**
 * Migration Dashboard Component
 * 
 * Displays migration monitoring data including metrics, alerts, and recent operations
 * 
 * Requirements: 30.2, 30.4
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  TrendingUp,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import type {
  MigrationDashboardSummary,
  MigrationAlert,
  MigrationOperationLog,
} from '@/lib/migration-monitoring-types';

export function MigrationDashboard() {
  const [summary, setSummary] = useState<MigrationDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/migration/dashboard');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load dashboard');
      }

      setSummary(data.data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch('/api/migration/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId,
          acknowledgedBy: 'current-user', // TODO: Get from auth context
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to acknowledge alert');
      }

      // Reload dashboard
      await loadDashboard();
    } catch (err: any) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const exportLogs = async () => {
    try {
      const response = await fetch('/api/migration/export');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `migration-logs-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Failed to export logs:', err);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Migration Dashboard</CardTitle>
          <CardDescription>Loading monitoring data...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collections</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalCollections}</div>
            <p className="text-xs text-muted-foreground">
              {summary.completedCollections} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalRecords.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {summary.migratedRecords.toLocaleString()} migrated
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.overallSuccessRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {summary.failedRecords} failed records
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.recentAlerts.length}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Alerts and Operations */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="alerts">
              Alerts ({summary.recentAlerts.length})
            </TabsTrigger>
            <TabsTrigger value="operations">
              Recent Operations ({summary.recentOperations.length})
            </TabsTrigger>
          </TabsList>
          <Button onClick={exportLogs} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export Logs
          </Button>
        </div>

        <TabsContent value="alerts" className="space-y-4">
          {summary.recentAlerts.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">No active alerts</p>
              </CardContent>
            </Card>
          ) : (
            summary.recentAlerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} onAcknowledge={acknowledgeAlert} />
            ))
          )}
        </TabsContent>

        <TabsContent value="operations" className="space-y-4">
          {summary.recentOperations.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">No recent operations</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {summary.recentOperations.map((operation) => (
                    <OperationRow key={operation.id} operation={operation} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AlertCard({
  alert,
  onAcknowledge,
}: {
  alert: MigrationAlert;
  onAcknowledge: (alertId: string) => void;
}) {
  const severityConfig = {
    warning: { icon: AlertTriangle, variant: 'default' as const, color: 'text-yellow-600' },
    error: { icon: AlertCircle, variant: 'destructive' as const, color: 'text-red-600' },
    critical: { icon: XCircle, variant: 'destructive' as const, color: 'text-red-800' },
  };

  const config = severityConfig[alert.severity];
  const Icon = config.icon;

  return (
    <Alert variant={config.variant}>
      <Icon className={`h-4 w-4 ${config.color}`} />
      <AlertTitle className="flex items-center justify-between">
        <span>{alert.collection}</span>
        <Badge variant="outline">{alert.alertType.replace(/_/g, ' ')}</Badge>
      </AlertTitle>
      <AlertDescription>
        <p className="mb-2">{alert.message}</p>
        {alert.details.errorRate && (
          <p className="text-sm">Error Rate: {alert.details.errorRate.toFixed(2)}%</p>
        )}
        {alert.details.failureCount && (
          <p className="text-sm">Failed Records: {alert.details.failureCount}</p>
        )}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {new Date(alert.timestamp).toLocaleString()}
          </span>
          {!alert.acknowledged && (
            <Button
              onClick={() => onAcknowledge(alert.id)}
              variant="outline"
              size="sm"
            >
              Acknowledge
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

function OperationRow({ operation }: { operation: MigrationOperationLog }) {
  const statusConfig = {
    started: { icon: Clock, color: 'text-blue-600', label: 'In Progress' },
    completed: { icon: CheckCircle2, color: 'text-green-600', label: 'Completed' },
    failed: { icon: XCircle, color: 'text-red-600', label: 'Failed' },
  };

  const config = statusConfig[operation.status];
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-between border-b pb-4 last:border-0">
      <div className="flex items-center space-x-4">
        <Icon className={`h-5 w-5 ${config.color}`} />
        <div>
          <p className="font-medium">{operation.collection}</p>
          <p className="text-sm text-muted-foreground">
            {operation.operationType} • {new Date(operation.timestamp).toLocaleString()}
          </p>
        </div>
      </div>
      <div className="text-right">
        <Badge variant={operation.status === 'completed' ? 'default' : 'secondary'}>
          {config.label}
        </Badge>
        {operation.duration && (
          <p className="text-xs text-muted-foreground mt-1">
            {(operation.duration / 1000).toFixed(1)}s
          </p>
        )}
      </div>
    </div>
  );
}
