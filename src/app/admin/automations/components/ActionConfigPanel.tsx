import * as React from 'react';
import { 
  Smartphone,
  CheckSquare,
  Mail,
  Bell,
  X as XIcon
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MessagingTemplateSelector } from '../../components/MessagingTemplateSelector';
import type { UserProfile, OnboardingStage, VariableDefinition, Pipeline } from '@/lib/types';

interface ActionConfigPanelProps {
  actionType: string;
  config: Record<string, any>;
  onUpdateConfig: (updates: Record<string, any>) => void;
  users: UserProfile[];
  stages: OnboardingStage[];
  pipelines: Pipeline[];
  variables: VariableDefinition[];
  singular: string;
}

export const ActionConfigPanel = React.memo(function ActionConfigPanel({
  actionType,
  config,
  onUpdateConfig,
  users,
  stages,
  pipelines,
  variables,
  singular,
}: ActionConfigPanelProps) {
  const { toast } = useToast();

  const updateConfig = (updates: Record<string, any>) => {
    onUpdateConfig(updates);
  };

  return (
    <div className="w-full">
      {actionType === 'SEND_MESSAGE' ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1 flex items-center gap-2">
              <Smartphone className="h-3 w-3" /> Channel
            </Label>
            <Select
              value={config.channel || 'email'}
              onValueChange={(v) => updateConfig({ channel: v })}
            >
              <SelectTrigger className="h-10 rounded-xl bg-card border shadow-sm font-bold px-4">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Master Template</Label>
            <MessagingTemplateSelector 
              category="campaigns"
              channel={(config.channel as 'email' | 'sms') || 'email'}
              recipientType="entity"
              value={config.templateId}
              onValueChange={(v) => updateConfig({ templateId: v })}
              placeholder="Choose blueprint..."
              className="h-12 rounded-xl bg-card border shadow-sm font-bold px-4 text-xs"
            />
          </div>
          {(variables?.length ?? 0) > 0 ? (
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Template variables</Label>
              <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-muted/30 border">
                {variables.slice(0, 12).map((v) => (
                  <Badge
                    key={v.id}
                    variant="outline"
                    className="text-[9px] font-mono cursor-pointer"
                    onClick={() => {
                      navigator.clipboard.writeText(`{{${v.key}}}`);
                      toast({ title: 'Copied', description: v.key });
                    }}
                  >
                    {`{{${v.key}}}`}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-4">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Target Contact Recipients</Label>
            <div className="space-y-3 p-4 rounded-2xl bg-muted/20 border border-border/50">
              {[
                { key: 'triggering', label: 'Triggering Contact', desc: 'The contact that triggered this automation' },
                { key: 'primary', label: 'Primary Contact', desc: 'The designated primary contact of the entity' },
                { key: 'signatories', label: 'Campus Signatories', desc: 'All contacts flagged as campus signatories' },
                { key: 'roles', label: 'Specific Role(s)', desc: 'Contacts with specific custom roles' },
                { key: 'all', label: 'All Contacts', desc: 'Send to all contacts associated with the entity' },
                { key: 'fixed', label: 'Manual Identity Entry', desc: 'Specify static destination addresses manually' },
              ].map((target) => {
                const isChecked = (config.recipientTargets || []).includes(target.key as any);
                return (
                  <div key={target.key} className="flex flex-col space-y-1.5 animate-in fade-in duration-200">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const current = config.recipientTargets || [];
                          const updated = e.target.checked
                            ? [...current, target.key]
                            : current.filter((k: string) => k !== target.key);
                          updateConfig({ recipientTargets: updated });
                        }}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary mt-0.5"
                      />
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-bold leading-none mb-0.5 text-foreground">{target.label}</span>
                        <span className="text-[9px] font-medium text-muted-foreground leading-none">{target.desc}</span>
                      </div>
                    </label>

                    {target.key === 'roles' && isChecked ? (
                      <div className="pl-6 pt-2 space-y-2 animate-in slide-in-from-top-1 duration-200">
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                          {(config.recipientRoles || []).map((role: string) => (
                            <Badge key={role} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1 rounded-lg bg-primary/10 text-primary border-none">
                              <span className="text-[10px] font-bold tracking-tight">{role}</span>
                              <Button 
                                type="button"
                                variant="ghost" 
                                size="icon" 
                                className="h-4 w-4 rounded-md hover:bg-primary/20"
                                onClick={() => updateConfig({ recipientRoles: config.recipientRoles.filter((r: string) => r !== role) })}
                              >
                                <XIcon className="h-3 w-3" />
                              </Button>
                            </Badge>
                          ))}
                        </div>
                        <Input
                          placeholder="Type role and press Enter (e.g. Signatory, Billing)..."
                          id="new-role-input"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = (e.target as HTMLInputElement).value.trim();
                              if (val) {
                                const current = config.recipientRoles || [];
                                if (!current.includes(val)) {
                                  updateConfig({ recipientRoles: [...current, val] });
                                }
                                (e.target as HTMLInputElement).value = '';
                              }
                            }
                          }}
                          className="h-8 rounded-lg bg-background text-xs"
                        />
                      </div>
                    ) : null}

                    {target.key === 'fixed' && isChecked ? (
                      <div className="pl-6 pt-2 animate-in slide-in-from-top-1 duration-200">
                        <Label className="text-[9px] font-bold text-primary ml-1 block mb-1">Static Target (Tag Supported)</Label>
                        <Input 
                          placeholder="e.g. {{contact_email}}" 
                          value={config.recipient || ''} 
                          onChange={(e) => updateConfig({ recipient: e.target.value })} 
                          className="h-10 rounded-xl bg-background border font-mono text-xs px-4 shadow-sm"
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
      
      {actionType.startsWith('SEND_NOTIFICATION_') ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Direct Notification To</Label>
            <div className="space-y-2.5 p-4 rounded-2xl bg-muted/20 border border-border/50">
              {[
                { key: 'assignee', label: 'Workspace Assignee', desc: 'Direct to the designated owner/manager of the entity' },
                { key: 'users', label: 'Selected Team Members', desc: 'Direct to specific workspace team members' },
                { key: 'custom', label: 'Custom Destination Address', desc: actionType === 'SEND_NOTIFICATION_SMS' ? 'Direct to a custom mobile number' : 'Direct to a custom email address' },
              ].map((target) => {
                const isChecked = (config.notificationTargets || []).includes(target.key as any);
                return (
                  <div key={target.key} className="flex flex-col space-y-1.5 animate-in fade-in duration-200">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const current = config.notificationTargets || [];
                          const updated = e.target.checked
                            ? [...current, target.key]
                            : current.filter((k: string) => k !== target.key);
                          updateConfig({ notificationTargets: updated });
                        }}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary mt-0.5"
                      />
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-bold leading-none mb-0.5 text-foreground">{target.label}</span>
                        <span className="text-[9px] font-medium text-muted-foreground leading-none">{target.desc}</span>
                      </div>
                    </label>

                    {target.key === 'users' && isChecked ? (
                      <div className="pl-6 pt-2 space-y-2 animate-in slide-in-from-top-1 duration-200">
                        <Label className="text-[9px] font-bold text-primary ml-1 block mb-1">Target Workspace Users</Label>
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                          {(config.notificationUserIds || []).map((uid: string) => {
                            const u = users?.find((user) => user.id === uid);
                            return (
                              <Badge key={uid} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1 rounded-lg bg-primary/10 text-primary border-none animate-in zoom-in-95 duration-150">
                                <span className="text-[10px] font-bold tracking-tight">{u?.name || uid}</span>
                                <Button 
                                  type="button"
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-4 w-4 rounded-md hover:bg-primary/20"
                                  onClick={() => updateConfig({ notificationUserIds: config.notificationUserIds.filter((id: string) => id !== uid) })}
                                >
                                  <XIcon className="h-3 w-3" />
                                </Button>
                              </Badge>
                            );
                          })}
                        </div>
                        <Select 
                          value="" 
                          onValueChange={(v) => {
                            const current = config.notificationUserIds || [];
                            if (!current.includes(v)) {
                              updateConfig({ notificationUserIds: [...current, v] });
                            }
                          }}
                        >
                          <SelectTrigger className="h-9 rounded-lg bg-background text-xs border border-border/50 px-3">
                            <SelectValue placeholder="Add workspace users..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-none shadow-2xl p-2 max-h-[250px] overflow-y-auto">
                            {(users || []).map((u) => (
                              <SelectItem key={u.id} value={u.id} className="rounded-lg p-2 font-semibold">
                                {u.name} ({u.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}

                    {target.key === 'custom' && isChecked ? (
                      <div className="pl-6 pt-2 animate-in slide-in-from-top-1 duration-200">
                        <Label className="text-[9px] font-bold text-primary ml-1 block mb-1">
                          {actionType === 'SEND_NOTIFICATION_SMS' ? 'Custom Mobile Number' : 'Custom Email Address'}
                        </Label>
                        <Input 
                          placeholder={actionType === 'SEND_NOTIFICATION_SMS' ? 'e.g. +1234567890' : 'e.g. alerts@company.com'} 
                          value={config.customRecipient || ''} 
                          onChange={(e) => updateConfig({ customRecipient: e.target.value })} 
                          className="h-10 rounded-xl bg-background border font-mono text-xs px-4 shadow-sm"
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {actionType === 'SEND_NOTIFICATION_EMAIL' || actionType === 'SEND_NOTIFICATION_PUSH' ? (
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                {actionType === 'SEND_NOTIFICATION_PUSH' ? 'Notification Title' : 'Subject Line'}
              </Label>
              <Input
                placeholder={actionType === 'SEND_NOTIFICATION_PUSH' ? 'e.g. New signup received' : 'e.g. System Alert: Onboarding Step Completed'}
                value={config.notificationSubject || ''}
                onChange={(e) => updateConfig({ notificationSubject: e.target.value })}
                className="h-11 rounded-xl bg-card border font-bold"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Message Body</Label>
            <textarea
              placeholder="Type notification content... supports dynamic variables like {{entityName}}"
              value={config.notificationBody || ''}
              onChange={(e) => updateConfig({ notificationBody: e.target.value })}
              className="w-full min-h-[120px] rounded-xl bg-card border p-4 font-medium text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
            />
          </div>

          {(variables?.length ?? 0) > 0 ? (
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Variables (Click to Copy)</Label>
              <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-muted/30 border">
                {variables.slice(0, 12).map((v) => (
                  <Badge
                    key={v.id}
                    variant="outline"
                    className="text-[9px] font-mono cursor-pointer"
                    onClick={() => {
                      navigator.clipboard.writeText(`{{${v.key}}}`);
                      toast({ title: 'Copied', description: v.key });
                    }}
                  >
                    {`{{${v.key}}}`}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      
      {actionType === 'CREATE_TASK' ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Task Definition</Label>
            <Input 
              placeholder={`e.g. Follow up with {{entity_name}}`} 
              value={config.title || ''} 
              onChange={(e) => updateConfig({ title: e.target.value })} 
              className="h-12 rounded-xl bg-card border shadow-sm font-bold"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Priority</Label>
              <Select value={config.priority || 'medium'} onValueChange={(v) => updateConfig({ priority: v })}>
                <SelectTrigger className="h-10 rounded-xl bg-card shadow-sm font-semibold text-[10px]"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl">
                  <SelectItem value="low" className="text-[10px] font-semibold ">Low</SelectItem>
                  <SelectItem value="medium" className="text-[10px] font-semibold ">Medium</SelectItem>
                  <SelectItem value="high" className="text-[10px] font-semibold text-orange-500">High</SelectItem>
                  <SelectItem value="urgent" className="text-[10px] font-semibold text-rose-500">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-muted-foreground ml-1">SLA Target</Label>
              <div className="flex items-center gap-2">
                <Input 
                  type="number" 
                  value={config.dueOffsetDays || 3} 
                  onChange={(e) => updateConfig({ dueOffsetDays: parseInt(e.target.value, 10) || 0 })} 
                  className="h-10 rounded-xl bg-card text-center font-semibold w-16"
                />
                <span className="text-[9px] font-bold opacity-40">Days</span>
              </div>
            </div>
          </div>
          <div className="space-y-2 text-left">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Assigned Identity</Label>
            <Select value={config.assignedTo || 'auto'} onValueChange={(v) => updateConfig({ assignedTo: v })}>
              <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold">
                <SelectValue placeholder="Auto-Resolve from Entity" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-none shadow-2xl p-2 max-h-[300px] overflow-y-auto">
                <SelectItem value="auto" className="font-semibold italic text-primary rounded-lg py-2.5">Auto-Resolve (Manager)</SelectItem>
                {users?.map(u => (
                  <SelectItem key={u.id} value={u.id} className="rounded-lg py-2.5">{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {actionType === 'UPDATE_ENTITY' ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Target Pipeline</Label>
            <Select value={config.pipelineId || ''} onValueChange={(val) => updateConfig({ pipelineId: val, stageId: '' })}>
              <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold">
                <SelectValue placeholder="Select pipeline..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-[300px] overflow-y-auto">
                {pipelines?.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Target Stage</Label>
            <Select value={config.stageId || ''} onValueChange={(val) => updateConfig({ stageId: val })} disabled={!config.pipelineId}>
              <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold">
                <SelectValue placeholder="Select stage..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-[300px] overflow-y-auto">
                {stages?.filter(s => s.pipelineId === config.pipelineId).map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Assignee</Label>
            <Select value={config.assignedTo || 'auto'} onValueChange={(v) => updateConfig({ assignedTo: v })}>
              <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold">
                <SelectValue placeholder="Auto-Resolve" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-none shadow-2xl p-2 max-h-[300px] overflow-y-auto">
                <SelectItem value="auto" className="font-semibold italic text-primary rounded-lg py-2.5">Auto-Resolve (Manager)</SelectItem>
                {users?.map(u => (
                  <SelectItem key={u.id} value={u.id} className="rounded-lg py-2.5">{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {actionType === 'ASSIGN_ENTITY' ? (
        <div className="space-y-2">
          <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Assign To</Label>
          <Select value={config.assignedTo || 'auto'} onValueChange={(v) => updateConfig({ assignedTo: v })}>
            <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl p-2 max-h-[300px] overflow-y-auto">
              <SelectItem value="auto">Auto-Resolve (Manager)</SelectItem>
              {users?.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {actionType === 'ADD_NOTE' ? (
        <div className="space-y-2">
          <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Note Content</Label>
          <Input
            placeholder="e.g. Automated follow-up for {{entity_name}}"
            value={config.content || ''}
            onChange={(e) => updateConfig({ content: e.target.value })}
            className="h-12 rounded-xl bg-card border shadow-sm font-bold"
          />
        </div>
      ) : null}

      {actionType === 'TRIGGER_OUTBOUND_WEBHOOK' ? (
        <div className="space-y-2">
          <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Webhook ID</Label>
          <Input
            placeholder="Firestore webhook document ID"
            value={config.webhookId || ''}
            onChange={(e) => updateConfig({ webhookId: e.target.value })}
            className="h-12 rounded-xl bg-card border font-mono text-sm"
          />
        </div>
      ) : null}

      {actionType === 'UPDATE_TASK' ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Status</Label>
            <Select value={config.status || ''} onValueChange={(v) => updateConfig({ status: v })}>
              <SelectTrigger className="h-10 rounded-xl bg-card font-bold"><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {actionType === 'RUN_AUTOMATION' ? (
        <div className="space-y-2">
          <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Automation ID</Label>
          <Input
            value={config.automationId || ''}
            onChange={(e) => updateConfig({ automationId: e.target.value })}
            className="h-12 rounded-xl bg-card border font-mono text-sm"
          />
        </div>
      ) : null}

      {actionType === 'CREATE_DEAL' ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Deal Title (Tag Supported)</Label>
            <Input 
              placeholder="e.g. {{entityName}} Deal" 
              value={config.name || ''} 
              onChange={(e) => updateConfig({ name: e.target.value })} 
              className="h-12 rounded-xl bg-card border shadow-sm font-bold"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Estimated Value ($)</Label>
              <Input 
                type="number"
                placeholder="0.00" 
                value={config.value || ''} 
                onChange={(e) => updateConfig({ value: parseFloat(e.target.value) || 0 })} 
                className="h-12 rounded-xl bg-card border shadow-sm font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Assignee</Label>
              <Select value={config.assignedTo || 'auto'} onValueChange={(v) => updateConfig({ assignedTo: v })}>
                <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-semibold text-xs"><SelectValue placeholder="Auto-Resolve" /></SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl p-2 max-h-[300px] overflow-y-auto">
                  <SelectItem value="auto" className="font-semibold italic text-primary rounded-lg py-2.5">Auto-Resolve (Entity Owner)</SelectItem>
                  {users?.map(u => (
                    <SelectItem key={u.id} value={u.id} className="rounded-lg py-2.5">{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Target Pipeline</Label>
            <Select value={config.pipelineId || ''} onValueChange={(val) => updateConfig({ pipelineId: val, stageId: '' })}>
              <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold">
                <SelectValue placeholder="Select Pipeline..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-[300px] overflow-y-auto">
                {pipelines?.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Target Stage (Optional)</Label>
            <Select value={config.stageId || ''} onValueChange={(val) => updateConfig({ stageId: val })} disabled={!config.pipelineId}>
              <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold">
                <SelectValue placeholder="First Pipeline Stage" />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-[300px] overflow-y-auto">
                {stages?.filter(s => s.pipelineId === config.pipelineId).map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {actionType === 'UPDATE_DEAL_STAGE' ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Filter by Pipeline</Label>
            <Select value={config.pipelineId || ''} onValueChange={(val) => updateConfig({ pipelineId: val, stageId: '' })}>
              <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold">
                <SelectValue placeholder="All Pipelines..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-[300px] overflow-y-auto">
                <SelectItem value="">All Pipelines</SelectItem>
                {pipelines?.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Target Stage</Label>
            <Select value={config.stageId || ''} onValueChange={(val) => updateConfig({ stageId: val })}>
              <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold">
                <SelectValue placeholder="Select stage to move to..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-[300px] overflow-y-auto">
                {stages?.filter(s => !config.pipelineId || s.pipelineId === config.pipelineId).map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({pipelines?.find(p => p.id === s.pipelineId)?.name || 'Default Pipeline'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {actionType === 'UPDATE_DEAL_VALUE' ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">New Value ($)</Label>
            <Input 
              placeholder="e.g. 5000 or +1000 or -500" 
              value={config.value || ''} 
              onChange={(e) => updateConfig({ value: e.target.value })} 
              className="h-12 rounded-xl bg-card border shadow-sm font-mono text-sm px-4"
            />
            <span className="text-[9px] font-semibold text-muted-foreground leading-relaxed block ml-1 opacity-70">
              Tip: Prefix with + or - to perform a relative adjustment of the deal value.
            </span>
          </div>
        </div>
      ) : null}

      {actionType === 'UPDATE_DEAL_STATUS' ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Target Status</Label>
            <Select value={config.status || 'open'} onValueChange={(v) => updateConfig({ status: v })}>
              <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="open">Open (Active)</SelectItem>
                <SelectItem value="won">Won (Closed Won)</SelectItem>
                <SelectItem value="lost">Lost (Closed Lost)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}
    </div>
  );
});
