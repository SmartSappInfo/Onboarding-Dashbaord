# SmartSapp Capability Coverage Matrix (tools §7.3)

Generated 2026-09-27T06:15:34.246Z by `pnpm audit:agentic-inventory`. Do not edit by hand.

> **How to read this.** Collections, guards, permission ids and external APIs are extracted from each
> capability's own code. **Risk** and **catalog mapping** are name-based heuristics: treat them as
> suggestions to confirm, not decisions. An empty permissions cell means no permission id was found — nothing is invented.

## Summary

| Measure | Value |
| --- | --- |
| Capabilities discovered | 2214 |
| API route files / with handlers found | 85 / 85 |
| With an auth/permission guard detected | 1130 |
| With an explicit permission id | 191 |
| Domain assigned by fallback (`crm_contacts`) | 664 |
| Risk assigned with low confidence | 442 |
| Catalog tools with at least one candidate | 80 / 310 |
| Missing catalog tools | 230 |
| Unmapped existing capabilities (actions/services) | 1832 |
| Auth gaps (actions/routes with no guard detected) | 731 |
| Test gaps (actions/routes with no test reference) | 1478 |
| Duplicate-implementation groups | 28 |

## By domain

| Domain | Capabilities | reuse | wrap | extend | unmapped |
| --- | --- | --- | --- | --- | --- |
| `crm_contacts` | 753 | 0 | 17 | 15 | 721 |
| `forms_surveys` | 178 | 0 | 8 | 13 | 157 |
| `lead_intelligence` | 165 | 0 | 8 | 0 | 157 |
| `automation_workflows` | 132 | 0 | 4 | 4 | 124 |
| `knowledge_memory` | 123 | 0 | 14 | 0 | 109 |
| `experience_portal` | 121 | 0 | 0 | 0 | 121 |
| `meetings_conversations` | 120 | 0 | 13 | 5 | 102 |
| `deals_revenue` | 115 | 0 | 9 | 1 | 105 |
| `identity_access` | 90 | 0 | 0 | 1 | 89 |
| `media_creative` | 82 | 0 | 0 | 0 | 82 |
| `ai_governance` | 79 | 0 | 4 | 0 | 75 |
| `communication_messaging` | 66 | 0 | 3 | 2 | 61 |
| `finance_subscriptions` | 56 | 0 | 2 | 2 | 52 |
| `analytics_reporting` | 44 | 0 | 2 | 0 | 42 |
| `tasks_productivity` | 35 | 0 | 4 | 5 | 26 |
| `campaigns_marketing` | 23 | 0 | 0 | 0 | 23 |
| `platform_integrations` | 18 | 0 | 0 | 0 | 18 |
| `school_operations` | 14 | 0 | 0 | 0 | 14 |

## Target catalog coverage (suggested mapping)

| Catalog tool | Candidate implementations (best first) |
| --- | --- |
| `access.check_permission` | `checkDocumentPermissionAction` (src/lib/documents/enterprise-security-actions.ts) |
| `access.check_tool_policy` | **missing** |
| `access.list_effective_permissions` | **missing** |
| `access.request_elevation` | **missing** |
| `ai.access_review.generate` | **missing** |
| `ai.audit.search` | **missing** |
| `ai.execution.get_receipt` | **missing** |
| `ai.execution.get_status` | **missing** |
| `ai.model.get_capabilities` | **missing** |
| `ai.policy.get` | `getMfaPolicyAction` (src/app/actions/enterprise-identity-actions.ts)<br>`getSecurityPolicyAction` (src/app/actions/governance-actions.ts)<br>`getWorkspacePolicyAction` (src/app/actions/policy-studio-actions.ts) |
| `ai.proposal.cancel` | **missing** |
| `ai.proposal.create` | `createProposal` (src/lib/marketing-actions.ts)<br>`createAiActionProposalAction` (src/app/actions/ai-admin-actions.ts) |
| `ai.proposal.execute` | `executeJointProposalAction` (src/lib/agents/actions/domain-agent-actions.ts) |
| `ai.proposal.get` | **missing** |
| `ai.proposal.get_approvals` | **missing** |
| `ai.proposal.request_approval` | **missing** |
| `ai.proposal.simulate_impact` | **missing** |
| `ai.role_advisor.get_recommendations` | **missing** |
| `ai.usage.get_summary` | **missing** |
| `ai.workforce_risk.get_findings` | **missing** |
| `analytics.ask_data` | **missing** |
| `analytics.compare_periods` | **missing** |
| `analytics.explain_change` | **missing** |
| `analytics.export_report` | **missing** |
| `analytics.generate_executive_brief` | **missing** |
| `analytics.get_campaign_report` | **missing** |
| `analytics.get_finance_report` | **missing** |
| `analytics.get_metric_definition` | **missing** |
| `analytics.get_pipeline_report` | **missing** |
| `analytics.get_sales_performance` | **missing** |
| `analytics.get_survey_report` | **missing** |
| `analytics.query_crm` | **missing** |
| `automation.activate` | **missing** |
| `automation.cancel_run` | `cancelAutomationRunAction` (src/lib/automation-actions.ts) |
| `automation.create_draft` | **missing** |
| `automation.enroll_entity` | **missing** |
| `automation.generate_draft` | **missing** |
| `automation.get` | **missing** |
| `automation.get_dead_letters` | **missing** |
| `automation.get_run` | **missing** |
| `automation.get_run_logs` | **missing** |
| `automation.pause` | **missing** |
| `automation.reconcile_run` | **missing** |
| `automation.request_activation` | **missing** |
| `automation.resume` | **missing** |
| `automation.retry_step` | **missing** |
| `automation.search` | **missing** |
| `automation.simulate` | **missing** |
| `automation.validate_graph` | **missing** |
| `automation.validate_permissions` | **missing** |
| `campaign.create_draft` | **missing** |
| `campaign.generate_assets` | **missing** |
| `campaign.generate_journey` | **missing** |
| `campaign.generate_strategy` | **missing** |
| `campaign.get` | `getProspectingCampaignsAction` (src/app/actions/lead-intelligence-actions.ts)<br>`getCallCampaignAction` (src/lib/call-centre-actions.ts)<br>`fetchCampaignOrchestrationsAction` (src/lib/orchestration-actions.ts) |
| `campaign.get_attribution` | **missing** |
| `campaign.get_audience` | **missing** |
| `campaign.get_performance` | `getPerformanceMetricsForCampaign` (src/lib/marketing-actions.ts) |
| `campaign.get_recommendations` | **missing** |
| `campaign.launch` | `launchProspectingCampaignAction` (src/app/actions/lead-intelligence-actions.ts) |
| `campaign.pause` | **missing** |
| `campaign.propose_audience` | **missing** |
| `campaign.record_outcome` | **missing** |
| `campaign.request_launch_approval` | **missing** |
| `campaign.search` | `listCrmCampaignsAction` (src/app/actions/creative-crm-actions.ts)<br>`listCallCampaignsAction` (src/lib/call-centre-actions.ts)<br>`listWorkspaceCampaignPerformanceAction` (src/app/actions/creative-performance-actions.ts) |
| `campaign.simulate` | **missing** |
| `campaign.update_draft` | **missing** |
| `campaign.validate_audience` | **missing** |
| `catalog.get_product` | **missing** |
| `catalog.search_products` | **missing** |
| `context.build` | `buildContextAction` (src/lib/memory/actions/context-builder-actions.ts)<br>`buildOrgFooterVars` (src/lib/services/org-footer-service.ts) |
| `context.explain_inclusion` | **missing** |
| `context.get_agent_memory` | **missing** |
| `context.get_campaign_brief` | **missing** |
| `context.get_deal_brief` | **missing** |
| `context.get_entity_brief` | **missing** |
| `context.get_meeting_brief` | `getMeetingBriefAction` (src/app/actions/deal-intelligence-actions.ts) |
| `context.get_policy_context` | `getMfaPolicyAction` (src/app/actions/enterprise-identity-actions.ts)<br>`getSecurityPolicyAction` (src/app/actions/governance-actions.ts)<br>`getWorkspacePolicyAction` (src/app/actions/policy-studio-actions.ts) |
| `context.get_shared_memory` | **missing** |
| `context.validate_scope` | **missing** |
| `creative.generate_concepts` | `generateCreativeConceptsAction` (src/app/actions/creative-ai-actions.ts) |
| `creative.generate_copy_variants` | **missing** |
| `creative.generate_page_draft` | **missing** |
| `creative.generate_qr_design` | **missing** |
| `creative.generate_seo_metadata` | **missing** |
| `creative.generate_social_variants` | **missing** |
| `creative.generate_thumbnail` | **missing** |
| `creative.generate_visual_style` | **missing** |
| `creative.get_asset_metadata` | **missing** |
| `creative.get_brand_profile` | **missing** |
| `creative.modify_canvas` | **missing** |
| `creative.modify_page` | **missing** |
| `creative.modify_thumbnail` | **missing** |
| `creative.publish` | `publishCreativeToChannelAction` (src/app/actions/creative-publishing-actions.ts) |
| `creative.request_publish_approval` | **missing** |
| `creative.search_assets` | **missing** |
| `crm.activity.create` | **missing** |
| `crm.entity.add_note` | **missing** |
| `crm.entity.add_tag` | **missing** |
| `crm.entity.assign_owner` | **missing** |
| `crm.entity.create` | `createEntityAction` (src/lib/entity-actions.ts)<br>`handleCreateEntity` (src/lib/automations/actions/entity-actions.ts)<br>`createEntityFromRegistration` (src/app/actions/meeting-lead-capture-action.ts) |
| `crm.entity.find_duplicates` | **missing** |
| `crm.entity.get` | `getEntityContactsAction` (src/app/actions/entity-contact-actions.ts)<br>`getEntityDossierAction` (src/lib/memory/actions/context-builder-actions.ts)<br>`getEntityTagsAction` (src/lib/scoped-tag-actions.ts) |
| `crm.entity.get_relationships` | **missing** |
| `crm.entity.get_timeline` | **missing** |
| `crm.entity.merge` | `mergeSignupIntoEntityAction` (src/lib/signup-conflict-actions.ts) |
| `crm.entity.propose_merge` | **missing** |
| `crm.entity.remove_tag` | **missing** |
| `crm.entity.search` | `searchEntitiesForDealAction` (src/app/actions/entity-contact-actions.ts) |
| `crm.entity.summarize_history` | **missing** |
| `crm.entity.update` | `updateEntityAction` (src/lib/entity-actions.ts)<br>`handleUpdateEntity` (src/lib/automations/actions/entity-actions.ts)<br>`updateEntityIdentity` (src/lib/profile-actions.ts) |
| `crm.pipeline.get` | `getPipelineData` (src/app/actions/dashboard-actions.ts)<br>`getPipelineTargetsAction` (src/app/actions/deal-analytics-actions.ts)<br>`getWorkspacePipelinesAction` (src/lib/forms/crm-integration-actions.ts) |
| `crm.pipeline.get_metrics` | `getPipelineMetrics` (src/lib/metrics-actions.ts) |
| `crm.pipeline.list` | **missing** |
| `crm.stage.propose_transition` | **missing** |
| `crm.stage.transition` | `transitionIdeaStageAction` (src/lib/quick-notes-idea-actions.ts) |
| `crm.workspace_entity.archive` | **missing** |
| `crm.workspace_entity.create` | **missing** |
| `crm.workspace_entity.get` | `getWorkspaceEntitiesForSimulationAction` (src/lib/survey-actions.ts) |
| `crm.workspace_entity.update` | `updateWorkspaceEntityAction` (src/lib/workspace-entity-actions.ts)<br>`updateWorkspaceEntityOperations` (src/lib/profile-actions.ts) |
| `deal.add_line_item` | **missing** |
| `deal.advance_stage` | **missing** |
| `deal.create` | `createDeal` (src/app/actions/deal-actions.ts)<br>`createDeal` (src/lib/real-estate-actions.ts)<br>`bulkCreateDealsAction` (src/app/actions/bulk-deal-actions.ts) |
| `deal.create_followup_tasks` | **missing** |
| `deal.get` | `getDealQuotesAction` (src/app/actions/deal-line-item-actions.ts)<br>`getDealDossierAction` (src/lib/memory/actions/context-builder-actions.ts)<br>`getDealIntelligenceOverviewAction` (src/app/actions/deal-intelligence-actions.ts) |
| `deal.get_forecast` | **missing** |
| `deal.get_intelligence` | `getDealIntelligenceOverviewAction` (src/app/actions/deal-intelligence-actions.ts) |
| `deal.get_line_items` | **missing** |
| `deal.get_next_best_actions` | **missing** |
| `deal.get_risks` | **missing** |
| `deal.get_stage_history` | **missing** |
| `deal.propose_stage_change` | **missing** |
| `deal.remove_line_item` | **missing** |
| `deal.search` | `listDealSavedViewsAction` (src/app/actions/deal-saved-view-actions.ts)<br>`searchEntitiesForDealAction` (src/app/actions/entity-contact-actions.ts) |
| `deal.update` | `updateDealAction` (src/app/actions/deal-actions.ts)<br>`updateDeal` (src/lib/real-estate-actions.ts)<br>`updateDealStageAction` (src/app/actions/deal-actions.ts) |
| `deal.update_line_item` | `saveDealLineItemsAction` (src/app/actions/deal-line-item-actions.ts) |
| `finance.account.get_balance` | **missing** |
| `finance.collection.execute_action` | **missing** |
| `finance.collection.get_case` | `getCollectionCaseDetailsAction` (src/lib/collection-actions.ts) |
| `finance.collection.propose_action` | **missing** |
| `finance.invoice.create_draft` | **missing** |
| `finance.invoice.get` | `getPublicInvoiceAction` (src/lib/billing-actions.ts)<br>`getInvoiceAllocationsAction` (src/lib/finance-actions.ts)<br>`getInvoicesByEntityAction` (src/lib/billing-actions.ts) |
| `finance.invoice.issue` | **missing** |
| `finance.invoice.search` | **missing** |
| `finance.invoice.validate` | **missing** |
| `finance.payment.execute_refund` | **missing** |
| `finance.payment.get` | `getPaymentsForAccountAction` (src/lib/finance-actions.ts) |
| `finance.payment.propose_refund` | **missing** |
| `finance.payment.reconcile` | **missing** |
| `finance.payment.search` | **missing** |
| `finance.receivables.get_aging` | **missing** |
| `finance.revenue.get_summary` | **missing** |
| `finance.subscription.change_plan` | **missing** |
| `finance.subscription.get` | **missing** |
| `form.audit_friction` | `auditFormFrictionFlow` (src/ai/flows/ai-form-assistant-flow.ts) |
| `form.classify_submission` | `classifyFormSubmissionFlow` (src/ai/flows/form-intelligence-flow.ts) |
| `form.cluster_topics` | `clusterFormTopicsFlow` (src/ai/flows/form-intelligence-flow.ts)<br>`getOrGenerateFormTopicClustersAction` (src/lib/forms/form-intelligence-actions.ts) |
| `form.generate` | `generateFormFlow` (src/ai/flows/generate-form-flow.ts)<br>`generateFormWithAiAction` (src/lib/forms/form-ai-actions.ts)<br>`generateFormCustomReportAction` (src/lib/forms/form-reports-actions.ts) |
| `form.get` | `getRoutingFormsAction` (src/app/actions/routing-form-actions.ts)<br>`getFormAnalyticsAction` (src/lib/forms/form-analytics-actions.ts)<br>`getFormDistributionsAction` (src/lib/forms/form-distribution-actions.ts) |
| `form.get_submissions` | `getFormSubmissionsAction` (src/lib/forms-actions.ts) |
| `form.map_pdf_fields` | **missing** |
| `form.modify` | **missing** |
| `form.search` | **missing** |
| `form.validate` | **missing** |
| `identity.get_current_actor` | **missing** |
| `integration.calendar.check_availability` | **missing** |
| `integration.calendar.create_event` | `createGoogleCalendarEvent` (src/lib/services/integrations/google-calendar.ts)<br>`createMicrosoftCalendarEvent` (src/lib/services/integrations/microsoft-calendar.ts) |
| `integration.calendar.list_events` | **missing** |
| `integration.connection.revoke` | **missing** |
| `integration.email.get_status` | `fetchEmailStatusAction` (src/lib/resend-actions.ts) |
| `integration.get_status` | `getMigrationStatusAction` (src/app/actions/get-migration-status-action.ts)<br>`fetchSmsStatusAction` (src/lib/mnotify-actions.ts)<br>`fetchEmailStatusAction` (src/lib/resend-actions.ts) |
| `integration.list_connected` | `listConnectedChannelsAction` (src/app/actions/creative-publishing-actions.ts) |
| `integration.refresh_connection` | **missing** |
| `integration.request_connection` | **missing** |
| `integration.webhook.create_draft` | **missing** |
| `integration.webhook.get_delivery_logs` | `getWebhookDeliveryLogsAction` (src/app/actions/meeting-webhook-actions.ts) |
| `integration.webhook.test` | `testDispatchWebhookAction` (src/app/actions/meeting-webhook-actions.ts) |
| `integration.whatsapp.get_status` | **missing** |
| `knowledge.access.check` | **missing** |
| `knowledge.audit.search` | **missing** |
| `knowledge.capture_observation` | **missing** |
| `knowledge.check_duplicate` | `checkSignupDuplicatesAction` (src/lib/signup-conflict-actions.ts) |
| `knowledge.classify_item` | **missing** |
| `knowledge.deletion.request` | **missing** |
| `knowledge.export.request` | **missing** |
| `knowledge.extract_entities` | **missing** |
| `knowledge.get_citations` | **missing** |
| `knowledge.get_evidence` | **missing** |
| `knowledge.get_item` | `getMeetingActionItemsAction` (src/app/actions/meeting-action-items-actions.ts)<br>`getPriorityQueueItemAction` (src/app/actions/lead-intelligence-actions.ts)<br>`markInboxItemReadAction` (src/app/actions/lead-intelligence-actions.ts) |
| `knowledge.get_recent_changes` | **missing** |
| `knowledge.get_related_items` | **missing** |
| `knowledge.get_source` | **missing** |
| `knowledge.ingest_document` | **missing** |
| `knowledge.ingest_meeting_outcome` | **missing** |
| `knowledge.ingest_text` | **missing** |
| `knowledge.propose_decision` | **missing** |
| `knowledge.propose_fact` | **missing** |
| `knowledge.propose_memory` | **missing** |
| `knowledge.propose_procedure` | **missing** |
| `knowledge.quality.evaluate` | **missing** |
| `knowledge.reindex.request` | **missing** |
| `knowledge.retention.evaluate` | `evaluateRetentionPurgeAction` (src/app/actions/meeting-compliance-actions.ts) |
| `knowledge.review_queue.decide` | **missing** |
| `knowledge.review_queue.get` | **missing** |
| `knowledge.review_queue.list` | **missing** |
| `knowledge.search` | **missing** |
| `knowledge.search_decisions` | `listReviewDecisionsAction` (src/app/actions/governance-actions.ts) |
| `knowledge.search_documents` | `listDocumentDistributionsAction` (src/lib/documents/distribution-actions.ts) |
| `knowledge.search_meetings` | **missing** |
| `knowledge.search_notes` | `semanticSearchNotes` (src/lib/quick-notes-search-actions.ts) |
| `knowledge.search_playbooks` | **missing** |
| `knowledge_graph.approve_relationship` | **missing** |
| `knowledge_graph.find_path` | `findGraphPathAction` (src/lib/memory/actions/graph-actions.ts) |
| `knowledge_graph.flag_inconsistency` | **missing** |
| `knowledge_graph.get_entity` | `getEntitySubGraphAction` (src/lib/memory/actions/graph-actions.ts) |
| `knowledge_graph.get_neighbors` | **missing** |
| `knowledge_graph.get_provenance` | **missing** |
| `knowledge_graph.get_relationships` | **missing** |
| `knowledge_graph.propose_relationship` | **missing** |
| `knowledge_graph.query_subgraph` | **missing** |
| `knowledge_graph.rebuild_projection` | **missing** |
| `knowledge_graph.search_entities` | **missing** |
| `lead.enrich` | **missing** |
| `lead.get_buying_signals` | **missing** |
| `lead.get_decision_makers` | **missing** |
| `lead.get_intelligence` | **missing** |
| `lead.get_objection_handlers` | **missing** |
| `lead.get_recommended_pitch` | **missing** |
| `lead.score` | `handleUpdateLeadScore` (src/lib/automations/actions/score-automation-actions.ts) |
| `lead.search` | `createLeadListAction` (src/app/actions/lead-intelligence-actions.ts)<br>`getLeadListsAction` (src/app/actions/lead-intelligence-actions.ts)<br>`deleteLeadListAction` (src/app/actions/lead-intelligence-actions.ts) |
| `meeting.analyze_coaching` | `analyzeMeetingSpeechCoachingAction` (src/app/actions/meeting-coach-actions.ts) |
| `meeting.cancel` | `bulkCancelMeetingsAction` (src/app/actions/meeting-bulk-actions.ts)<br>`cancelMeetingPostEvent` (src/app/actions/meeting-post-event-action.ts)<br>`cancelRemindersForMeeting` (src/lib/reminder-actions.ts) |
| `meeting.capture_decisions` | **missing** |
| `meeting.check_availability` | **missing** |
| `meeting.confirm_booking` | **missing** |
| `meeting.create` | `addMeetingParticipantAction` (src/app/actions/meeting-participant-actions.ts)<br>`createMeetingPollAction` (src/app/actions/meeting-poll-actions.ts)<br>`createZoomMeeting` (src/lib/services/integrations/zoom-meeting.ts) |
| `meeting.create_followup_tasks` | **missing** |
| `meeting.extract_action_items` | **missing** |
| `meeting.generate_prep_brief` | `generateMeetingPrepBriefAction` (src/app/actions/meeting-intelligence-actions.ts) |
| `meeting.get` | `getMeetingBriefAction` (src/app/actions/deal-intelligence-actions.ts)<br>`getMeetingActionItemsAction` (src/app/actions/meeting-action-items-actions.ts)<br>`getMeetingActivitiesAction` (src/app/actions/meeting-activity-actions.ts) |
| `meeting.ingest_transcript` | **missing** |
| `meeting.link_to_crm` | **missing** |
| `meeting.propose_booking` | **missing** |
| `meeting.search` | **missing** |
| `meeting.summarize` | **missing** |
| `meeting.update` | `updateMeetingFacilitatorAction` (src/app/actions/meeting-facilitator-actions.ts)<br>`saveMeetingWebhookAction` (src/app/actions/meeting-webhook-actions.ts)<br>`extractAndSaveMeetingActionItemsAction` (src/app/actions/meeting-action-items-actions.ts) |
| `memory.approve` | **missing** |
| `memory.archive` | **missing** |
| `memory.get` | `getNoteMemoriesAction` (src/lib/memory/actions/memory-actions.ts)<br>`getMemoryHealthAction` (src/lib/memory/actions/orchestrator-actions.ts)<br>`getRelatedMemoriesAction` (src/lib/memory/actions/semantic-search-actions.ts) |
| `memory.get_history` | **missing** |
| `memory.propose_update` | **missing** |
| `memory.record_feedback` | **missing** |
| `memory.reject` | **missing** |
| `memory.resolve_conflict` | `resolveMemoryConflictAction` (src/lib/memory/actions/orchestrator-actions.ts) |
| `memory.restore` | **missing** |
| `memory.review_expiry` | **missing** |
| `memory.search` | `listWorkspaceMemoriesAction` (src/lib/memory/actions/memory-actions.ts)<br>`listMemoryConflictsAction` (src/lib/memory/actions/orchestrator-actions.ts)<br>`listStaleMemoriesAction` (src/lib/memory/actions/orchestrator-actions.ts) |
| `memory.supersede` | **missing** |
| `message.cancel_scheduled` | **missing** |
| `message.check_compliance` | **missing** |
| `message.create_draft` | **missing** |
| `message.generate_draft` | **missing** |
| `message.get_approval_status` | **missing** |
| `message.get_delivery_status` | **missing** |
| `message.get_engagement` | **missing** |
| `message.get_template` | **missing** |
| `message.get_unsubscribe_status` | **missing** |
| `message.preview` | **missing** |
| `message.refine_draft` | **missing** |
| `message.request_approval` | **missing** |
| `message.schedule` | `schedulePostEventMessages` (src/lib/reminder-actions.ts) |
| `message.search_templates` | **missing** |
| `message.send` | `sendTestMessageAction` (src/app/actions/scheduled-message-actions.ts)<br>`sendMessageNowAction` (src/app/actions/scheduled-message-actions.ts)<br>`resendFailedMessagesAction` (src/lib/automation-actions.ts) |
| `message.unsubscribe_contact` | **missing** |
| `message.validate_variables` | **missing** |
| `organization.get_current` | **missing** |
| `organization.get_details` | `getOrganizationDetail` (src/lib/backoffice/backoffice-org-actions.ts) |
| `revenue.get_attribution` | `getRevenueAttributionReportAction` (src/app/actions/lead-intelligence-actions.ts) |
| `sdr.create_whatsapp_link` | **missing** |
| `sdr.generate_outreach_draft` | **missing** |
| `sdr.get_conversion_insights` | **missing** |
| `sdr.get_daily_briefing` | **missing** |
| `sdr.get_priority_queue` | **missing** |
| `sdr.record_outreach_outcome` | **missing** |
| `sdr.request_outreach_approval` | **missing** |
| `survey.analyze_sentiment` | **missing** |
| `survey.audit_quality` | `auditSurveyQualityAction` (src/lib/surveys/survey-ai-intelligence-actions.ts)<br>`auditSurveyQualityFlow` (src/ai/flows/survey-ai-reviewer-flow.ts) |
| `survey.detect_anomalies` | `detectSurveyAnomaliesFlow` (src/ai/flows/survey-anomaly-detection-flow.ts) |
| `survey.generate_blueprint` | `generateSurveyBlueprint` (src/ai/flows/generate-survey-chunked-flow.ts) |
| `survey.generate_logic` | `generateSurveyLogic` (src/ai/flows/generate-survey-chunked-flow.ts) |
| `survey.generate_messaging` | `generateSurveyMessagingFlow` (src/ai/flows/generate-survey-messaging-flow.ts)<br>`generateSurveyMessaging` (src/ai/flows/generate-survey-messaging-flow.ts)<br>`generateSurveyMessagingTemplatesAction` (src/lib/survey-ai-messaging-actions.ts) |
| `survey.generate_questions` | `generateSurveyQuestions` (src/ai/flows/generate-survey-chunked-flow.ts) |
| `survey.generate_report` | **missing** |
| `survey.modify` | `modifySurvey` (src/ai/flows/modify-survey-flow.ts) |
| `survey.query_analytics` | **missing** |
| `task.add_comment` | **missing** |
| `task.assign` | **missing** |
| `task.cancel` | **missing** |
| `task.complete` | `completeTaskAction` (src/app/actions/engagement-actions.ts)<br>`bulkCompleteTasks` (src/lib/task-actions.ts)<br>`completeTaskNonBlocking` (src/lib/task-actions.ts) |
| `task.create` | `createTaskAction` (src/app/actions/engagement-actions.ts)<br>`createTaskAction` (src/lib/task-server-actions.ts)<br>`bulkCreateTasksAction` (src/app/actions/bulk-task-actions.ts) |
| `task.create_reminder` | **missing** |
| `task.get` | `getTaskInterlinkUrl` (src/lib/task-actions.ts)<br>`getTasksForContact` (src/lib/task-server-actions.ts) |
| `task.get_my_priorities` | **missing** |
| `task.get_overdue` | **missing** |
| `task.propose_batch_update` | **missing** |
| `task.search` | `listTasksByPortalAction` (src/app/actions/engagement-actions.ts) |
| `task.set_due_date` | **missing** |
| `task.update` | `updateTaskAction` (src/app/actions/engagement-actions.ts)<br>`updateTaskAction` (src/lib/task-server-actions.ts)<br>`handleUpdateTask` (src/lib/automations/actions/task-actions.ts) |
| `workspace.get_details` | **missing** |
| `workspace.list_accessible` | **missing** |

## Auth gaps (731)

Server actions and API routes where no known guard was detected in the function or the same-file helpers it calls. Verify each: some may be guarded by a wrapper this scanner does not know yet (add it to `GUARD_CALLS`).

| Capability | Kind | Risk | File |
| --- | --- | --- | --- |
| `deleteOfferAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/commerce-actions.ts |
| `deleteCouponAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/commerce-actions.ts |
| `deleteSpaceAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/community-actions.ts |
| `deletePostAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/community-actions.ts |
| `deleteCommentAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/community-actions.ts |
| `archiveContentItemAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/content-actions.ts |
| `deleteContentItemAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/content-actions.ts |
| `revokeCertificateAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/credential-actions.ts |
| `deleteTaskAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/engagement-actions.ts |
| `deleteLiveEventAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/event-actions.ts |
| `deleteCohortAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/event-actions.ts |
| `deleteEventTypeAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/event-type-actions.ts |
| `deleteCourseAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/learning-actions.ts |
| `deleteModuleAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/learning-actions.ts |
| `deleteLessonAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/learning-actions.ts |
| `deleteRegistrantAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/meeting-registrants-actions.ts |
| `deleteWorkspaceResourceAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/meeting-resource-actions.ts |
| `deleteMembershipAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/membership-actions.ts |
| `revokeInvitationAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/membership-actions.ts |
| `archivePlanAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/membership-actions.ts |
| `revokeAccessAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/membership-actions.ts |
| `archivePortalAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/portal-actions.ts |
| `deletePortalAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/portal-actions.ts |
| `executePurgeFocalPersonsFerAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/purge-focal-persons-fer-action.ts |
| `executePurgeLegacyFieldsFerAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/purge-legacy-fields-fer-action.ts |
| `deleteBookingPageAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/scheduler-actions.ts |
| `rotateAllSecretsAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/backoffice/backoffice-ai-actions.ts |
| `deleteAssetRecord` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/backoffice/backoffice-asset-actions.ts |
| `deletePlatformIndustryFieldGroup` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/backoffice/backoffice-field-actions.ts |
| `purgeSpamSubmissionAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/backoffice/backoffice-survey-actions.ts |
| `deleteTemplateAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/backoffice/backoffice-template-actions.ts |
| `archiveWorkspaceFromBackoffice` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/backoffice/backoffice-workspace-actions.ts |
| `deleteFlipbookAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/flipbook-actions.ts |
| `deleteLearningSignalsBySurveyAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/learning-loop-actions.ts |
| `deleteCampaignConceptAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/quick-notes-campaign-actions.ts |
| `deleteFederatedSpaceAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/quick-notes-federation-actions.ts |
| `importKnowledgeArchiveAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/quick-notes-federation-actions.ts |
| `bulkDeleteTasks` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/task-actions.ts |
| `deleteTaskNonBlocking` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/task-actions.ts |
| `bulkArchiveEntitiesAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/workspace-entity-actions.ts |
| `bulkDeleteEntitiesAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/workspace-entity-actions.ts |
| `DELETE /api/auth/session` | api | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/api/auth/session/route.ts |
| `DELETE /api/tasks/[taskId]` | task_worker | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/api/tasks/[taskId]/route.ts |
| `publishContentItemAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/app/actions/content-actions.ts |
| `publishCreativeToChannelAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/app/actions/creative-publishing-actions.ts |
| `publishEventReplayAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/app/actions/event-actions.ts |
| `resendFacilitatorLinksAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/app/actions/meeting-facilitator-actions.ts |
| `sendRegistrantJoinLinkAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/app/actions/meeting-registrants-actions.ts |
| `sendMeetingInvitationsAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/app/actions/meeting-registrants-actions.ts |
| `publishPortalAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/app/actions/portal-actions.ts |
| `handleSendMessage` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/lib/automations/actions/message-actions.ts |
| `handleSendNotification` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/lib/automations/actions/notification-actions.ts |
| `resendMagicJoinLinkAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/lib/backoffice/backoffice-meetings-actions.ts |
| `shareOrgSetupInviteAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/lib/backoffice/backoffice-org-actions.ts |
| `publishTemplate` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/lib/backoffice/backoffice-template-actions.ts |
| `dispatchFormNotifications` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/lib/forms/form-notification-actions.ts |
| `sendReceiptAcknowledgementAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/lib/notification-actions.ts |
| `publishCollectionToSpaceAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/lib/quick-notes-federation-actions.ts |
| `sendFacilitatorNewRegistrationAlert` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/lib/reminder-actions.ts |
| `inviteUserAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/lib/user-invite-actions.ts |
| `dispatchSignupWebhook` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/lib/webhook-actions.ts |
| `enrichDealData` | server_action | `L2_STATE_MUTATION` | src/app/actions/automated-deal-fer-actions.ts |
| `runAutomatedDealFERProtocol` | server_action | `L2_STATE_MUTATION` | src/app/actions/automated-deal-fer-actions.ts |
| `updateAvailabilityProfileAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/availability-actions.ts |
| `enrichDealsWithStageName` | server_action | `L2_STATE_MUTATION` | src/app/actions/backfill-deal-stagename-action.ts |
| `restoreDealStageNameBackfill` | server_action | `L2_STATE_MUTATION` | src/app/actions/backfill-deal-stagename-action.ts |
| `rollbackDealStageNameBackfill` | server_action | `L2_STATE_MUTATION` | src/app/actions/backfill-deal-stagename-action.ts |
| `runDocumentCtaBackfillAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/backfill-document-cta-action.ts |
| `acquireBookingHoldAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/booking-actions.ts |
| `createBookingFromHoldAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/booking-actions.ts |
| `cancelBookingAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/booking-actions.ts |
| `rescheduleBookingAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/booking-actions.ts |
| `bulkCreateDealsActionCore` | server_action | `L2_STATE_MUTATION` | src/app/actions/bulk-deal-actions.ts |
| `bulkRegisterParticipantsActionCore` | server_action | `L2_STATE_MUTATION` | src/app/actions/bulk-meeting-actions.ts |
| `bulkCreateTasksActionCore` | server_action | `L2_STATE_MUTATION` | src/app/actions/bulk-task-actions.ts |
| `createOfferAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/commerce-actions.ts |
| `updateOfferAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/commerce-actions.ts |
| `createCouponAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/commerce-actions.ts |
| `processCheckoutOrderAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/commerce-actions.ts |
| `registerAffiliatePartnerAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/commerce-actions.ts |
| `updateAffiliatePartnerStatusAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/commerce-actions.ts |
| `joinPortalWaitlistAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/commerce-actions.ts |
| `createSpaceAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/community-actions.ts |
| `updateSpaceAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/community-actions.ts |
| `createPostAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/community-actions.ts |
| `updatePostAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/community-actions.ts |
| `togglePinPostAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/community-actions.ts |
| `createCommentAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/community-actions.ts |
| `castPollVoteAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/community-actions.ts |
| `toggleReactionAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/community-actions.ts |
| `reportContentAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/community-actions.ts |
| `seedCommunitySpacesAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/community-actions.ts |
| `createOrUpdateConferenceSessionAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/conference-session-actions.ts |
| `createContentItemAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/content-actions.ts |
| `updateContentItemAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/content-actions.ts |
| `createPortalContentTemplateAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/content-actions.ts |
| `executeAiCanvasCommandAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-ai-actions.ts |
| `submitProjectForReviewAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-collab-actions.ts |
| `approveCreativeProjectAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-collab-actions.ts |
| `requestProjectChangesAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-collab-actions.ts |
| `addCanvasPinCommentAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-collab-actions.ts |
| `addCommentReplyAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-collab-actions.ts |
| `linkCreativeToCrmCampaignAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-crm-actions.ts |
| `createCreativeExperimentAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-experiment-actions.ts |
| `promoteWinningVariantAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-experiment-actions.ts |
| `scheduleCreativePublicationAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-publishing-actions.ts |
| `createProjectFromTemplateAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-template-actions.ts |
| `saveCanvasAsTemplateAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-template-actions.ts |
| `seedDefaultTemplatesAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-template-actions.ts |
| `createCertificateTemplateAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/credential-actions.ts |
| `issueCertificateAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/credential-actions.ts |
| `createBadgeDefinitionAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/credential-actions.ts |
| `createDeal` | server_action | `L2_STATE_MUTATION` | src/app/actions/deal-actions.ts |
| `updateDealValueAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/deal-actions.ts |
| `updateDealStatusAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/deal-actions.ts |
| `updateDealOwnerAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/deal-actions.ts |
| `acceptPublicQuoteAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/deal-line-item-actions.ts |
| `executeDealMigration` | server_action | `L2_STATE_MUTATION` | src/app/actions/deal-migration-actions.ts |
| `saveContentStudioDraftAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/draft-actions.ts |
| `saveOnboardingFlowAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/engagement-actions.ts |
| `advanceOnboardingStepAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/engagement-actions.ts |
| `reconcileOnboardingAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/engagement-actions.ts |
| `recordOrientationWatchedAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/engagement-actions.ts |
| `createTaskAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/engagement-actions.ts |
| `updateTaskAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/engagement-actions.ts |
| `completeTaskAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/engagement-actions.ts |
| `submitTaskAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/engagement-actions.ts |
| `reviewTaskSubmissionAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/engagement-actions.ts |
| `logMemberActivityAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/engagement-actions.ts |
| `saveEnterpriseSsoAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/enterprise-actions.ts |
| `saveWhiteLabelConfigAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/enterprise-actions.ts |
| `createHierarchyNodeAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/enterprise-actions.ts |
| `installMarketplaceTemplateAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/enterprise-actions.ts |
| `createLiveEventAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-actions.ts |
| `updateLiveEventAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-actions.ts |
| `registerForEventAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-actions.ts |
| `cancelEventRegistrationAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-actions.ts |
| `recordEventAttendanceAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-actions.ts |
| `recordJoinSessionAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-actions.ts |
| `recordLeaveSessionAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-actions.ts |
| `attachReplayToCourseLessonAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-actions.ts |
| `createCohortAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-actions.ts |
| `updateCohortAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-actions.ts |
| `enrollCohortMemberAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-actions.ts |
| `removeCohortMemberAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-actions.ts |
| `toggleEventTypeStatusAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-type-actions.ts |
| `executeVariablesFERMigrationAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/execute-variables-fer-migration-action.ts |
| `executeFixOrgAdminPermissionsFerAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/fix-org-admin-permissions-fer-action.ts |
| `enrichSchoolsWithSaaSIndustry` | server_action | `L2_STATE_MUTATION` | src/app/actions/industry-migration-actions.ts |
| `restoreSaaSMigration` | server_action | `L2_STATE_MUTATION` | src/app/actions/industry-migration-actions.ts |
| `rollbackSaaSMigration` | server_action | `L2_STATE_MUTATION` | src/app/actions/industry-migration-actions.ts |
| `createCourseAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/learning-actions.ts |
| `updateCourseAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/learning-actions.ts |
| `createModuleAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/learning-actions.ts |
| `updateModuleAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/learning-actions.ts |
| `createLessonAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/learning-actions.ts |
| `updateLessonAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/learning-actions.ts |
| `enrollInCourseAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/learning-actions.ts |
| `completeLessonAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/learning-actions.ts |
| `recordVideoProgressAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/learning-actions.ts |
| `submitAssessmentAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/learning-actions.ts |
| `submitAssignmentAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/learning-actions.ts |
| `removeImageBackgroundAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/media-actions.ts |
| `toggleRegistrantAttendance` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-attendance-actions.ts |
| `submitPublicMeetingFeedbackAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-feedback-actions.ts |
| `createEntityFromRegistration` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-lead-capture-action.ts |
| `migrateMeetingToUnifiedSchemaAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-migration-actions.ts |
| `addMeetingParticipantAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-participant-actions.ts |
| `updateParticipantRoleAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-participant-actions.ts |
| `updateParticipantRsvpAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-participant-actions.ts |
| `toggleParticipantAttendanceAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-participant-actions.ts |
| `removeParticipantAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-participant-actions.ts |
| `submitPollVoteAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-poll-actions.ts |
| `endMeetingAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-post-event-action.ts |
| `attachMeetingRecordingAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-recording-actions.ts |
| `updateRegistrantStatusAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-registrants-actions.ts |
| `adminRegisterParticipantAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-registrants-actions.ts |
| `manuallyUpdateGuestStatusAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-registrants-actions.ts |
| `saveWorkspaceResourceAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-resource-actions.ts |
| `saveEventTypeWorkflowsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-workflow-actions.ts |
| `createMembershipAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/membership-actions.ts |
| `updateMembershipRoleAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/membership-actions.ts |
| `suspendMembershipAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/membership-actions.ts |
| `reactivateMembershipAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/membership-actions.ts |
| `updatePortalMemberProfileAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/membership-actions.ts |
| `updateMembershipPlanAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/membership-actions.ts |
| `updateMembershipTagsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/membership-actions.ts |
| `createInvitationAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/membership-actions.ts |
| `createBulkInvitationsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/membership-actions.ts |
| `acceptInvitationAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/membership-actions.ts |
| `joinPortalDirectAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/membership-actions.ts |
| `createPlanAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/membership-actions.ts |
| `updatePlanAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/membership-actions.ts |
| `grantAccessAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/membership-actions.ts |
| `migrateLegacyTemplatesToBlocksAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/migrate-legacy-templates-to-blocks-action.ts |
| `migrateTemplatesAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/migrate-templates-action.ts |
| `reconcileParkedJobsOnNodeDeletionAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/node-deletion-reconciliation-actions.ts |
| `joinOfficeHoursQueueAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/office-hours-actions.ts |
| `pingQueueHeartbeatAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/office-hours-actions.ts |
| `leaveOfficeHoursQueueAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/office-hours-actions.ts |
| `submitOnboardingProfileAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/onboarding-actions.ts |
| `enforceSuperAdminProfileAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/onboarding-actions.ts |
| `completeOrganizationOnboardingAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/onboarding-actions.ts |
| `createPortalAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/portal-actions.ts |
| `updatePortalAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/portal-actions.ts |
| `suspendPortalAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/portal-actions.ts |
| `duplicatePortalAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/portal-actions.ts |
| `runMasterExperienceSeederAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/portal-actions.ts |
| `normalizeExistingPortalNavigationAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/portal-actions.ts |
| `refreshPortalAnalyticsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/portal-analytics-actions.ts |
| `enrichUsersWithWorkspaceRbac` | server_action | `L2_STATE_MUTATION` | src/app/actions/rbac-workspace-migration-actions.ts |
| `restoreWorkspaceRbacMigration` | server_action | `L2_STATE_MUTATION` | src/app/actions/rbac-workspace-migration-actions.ts |
| `rollbackWorkspaceRbacMigration` | server_action | `L2_STATE_MUTATION` | src/app/actions/rbac-workspace-migration-actions.ts |
| `submitRoutingFormAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/routing-form-actions.ts |
| `runMeetingsFerAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/run-meetings-fer-action.ts |
| `createBookingAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/scheduler-actions.ts |
| `saveBookingPageAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/scheduler-actions.ts |
| `ensureWorkspaceAvailabilityAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/scheduler-actions.ts |
| `executeSeedAllWorkspacesFieldsFerAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/seed-all-workspaces-fields-fer-action.ts |
| `seedDefaultStyleBlueprintsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/seed-default-style-blueprints-action.ts |
| `seedGlobalTemplatesAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/seed-global-templates-action.ts |
| `seedMaintenanceAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/seed-maintenance-action.ts |
| `seedEnrichedMeetingTemplatesAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/seed-meeting-invitation-templates-action.ts |
| `seedMeetingsV2Action` | server_action | `L2_STATE_MUTATION` | src/app/actions/seed-meetings-action.ts |
| `seedPlatformPageTemplatesAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/seed-platform-page-templates-action.ts |
| `seedAllPlatformTemplatesAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/seed-platform-presets-action.ts |
| `seedPromptsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/seed-prompts-action.ts |
| `executeStripAccountStatusFerAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/strip-account-status-fer-action.ts |
| `executeStripLifecycleStatusFerAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/strip-lifecycle-status-fer-action.ts |
| `executeTemplateIdentifiersFerAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/template-identifiers-fer-action.ts |
| `runGenerateThumbnail` | server_action | `L2_STATE_MUTATION` | src/app/actions/thumbnail-actions.ts |
| `runModifyThumbnail` | server_action | `L2_STATE_MUTATION` | src/app/actions/thumbnail-actions.ts |
| `runGenerateHooks` | server_action | `L2_STATE_MUTATION` | src/app/actions/thumbnail-actions.ts |
| `executeUnexpireImportPayloadsFerAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/unexpire-import-payloads-fer-action.ts |
| `updatePreferencesAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/unsubscribe-actions.ts |
| `acceptInvitationAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/workforce-actions.ts |
| `enrichWorkspacesWithIndustry` | server_action | `L2_STATE_MUTATION` | src/app/actions/workspace-industry-migration-actions.ts |
| `restoreWorkspaceIndustryMigration` | server_action | `L2_STATE_MUTATION` | src/app/actions/workspace-industry-migration-actions.ts |
| `rollbackWorkspaceIndustryMigration` | server_action | `L2_STATE_MUTATION` | src/app/actions/workspace-industry-migration-actions.ts |
| `executeWorkspaceScopeFetchEnrichRestoreAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/workspace-scope-migration-actions.ts |
| `ActionNode` | server_action | `L2_STATE_MUTATION` | src/app/admin/automations/[id]/edit/components/nodes/ActionNode.tsx |
| `NodeActionToolbar` | server_action | `L2_STATE_MUTATION` | src/app/admin/automations/[id]/edit/components/nodes/NodeActionToolbar.tsx |
| `TagActionNode` | server_action | `L2_STATE_MUTATION` | src/app/admin/automations/[id]/edit/components/nodes/TagActionNode.tsx |
| `ActionConfigPanel` | server_action | `L2_STATE_MUTATION` | src/app/admin/automations/components/ActionConfigPanel.tsx |
| `DealQuickActions` | server_action | `L2_STATE_MUTATION` | src/app/admin/deals/[id]/components/DealQuickActions.tsx |
| `BulkActionDock` | server_action | `L2_STATE_MUTATION` | src/app/admin/entities/components/BulkActionDock.tsx |
| `FloatingActionToolbar` | server_action | `L2_STATE_MUTATION` | src/app/admin/lead-intelligence/components/FloatingActionToolbar.tsx |
| `MediaAnalyticsBulkActionsBar` | server_action | `L2_STATE_MUTATION` | src/app/admin/media/analytics/components/MediaAnalyticsBulkActionsBar.tsx |
| `MeetingActionItemsDrawer` | server_action | `L2_STATE_MUTATION` | src/app/admin/meetings/[id]/components/MeetingActionItemsDrawer.tsx |
| `ActionExecutionDrawer` | server_action | `L2_STATE_MUTATION` | src/app/admin/my-day/components/ActionExecutionDrawer.tsx |
| `ActionTargetModal` | server_action | `L2_STATE_MUTATION` | src/app/admin/pages/[id]/builder/components/ActionTargetModal.tsx |
| `PipelineActionsView` | server_action | `L2_STATE_MUTATION` | src/app/admin/pipeline/components/PipelineActionsView.tsx |
| `SurveyAnalyticsBulkActionsBar` | server_action | `L2_STATE_MUTATION` | src/app/admin/surveys/[id]/results/components/SurveyAnalyticsBulkActionsBar.tsx |
| `BulkActionsBar` | server_action | `L2_STATE_MUTATION` | src/app/admin/surveys/components/BulkActionsBar.tsx |
| `BulkActionsFloatingToolbar` | server_action | `L2_STATE_MUTATION` | src/app/admin/users/components/BulkActionsFloatingToolbar.tsx |
| `QuickActions` | server_action | `L2_STATE_MUTATION` | src/components/dashboard/QuickActions.tsx |
| `ContextualActionBar` | server_action | `L2_STATE_MUTATION` | src/components/shared/thumbnail-designer/ContextualActionBar.tsx |
| `recordPageViewAction` | server_action | `L2_STATE_MUTATION` | src/lib/analytics-actions.ts |
| `recordInteractionAction` | server_action | `L2_STATE_MUTATION` | src/lib/analytics-actions.ts |
| `saveAutomationAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `importAutomationAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `enrollContactsInAutomationAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `handleCreateDeal` | server_action | `L2_STATE_MUTATION` | src/lib/automations/actions/deal-automation-actions.ts |
| `handleUpdateDealStage` | server_action | `L2_STATE_MUTATION` | src/lib/automations/actions/deal-automation-actions.ts |
| `handleUpdateDealValue` | server_action | `L2_STATE_MUTATION` | src/lib/automations/actions/deal-automation-actions.ts |
| `handleUpdateDealStatus` | server_action | `L2_STATE_MUTATION` | src/lib/automations/actions/deal-automation-actions.ts |
| `handleAssignDealOwner` | server_action | `L2_STATE_MUTATION` | src/lib/automations/actions/deal-automation-actions.ts |
| `handleUpdateDealProbability` | server_action | `L2_STATE_MUTATION` | src/lib/automations/actions/deal-automation-actions.ts |
| `handleCreateDealTask` | server_action | `L2_STATE_MUTATION` | src/lib/automations/actions/deal-automation-actions.ts |
| `handleAddDealNote` | server_action | `L2_STATE_MUTATION` | src/lib/automations/actions/deal-automation-actions.ts |
| `handleUpdateEntity` | server_action | `L2_STATE_MUTATION` | src/lib/automations/actions/entity-actions.ts |
| `handleAssignEntity` | server_action | `L2_STATE_MUTATION` | src/lib/automations/actions/entity-actions.ts |
| `handleAddNote` | server_action | `L2_STATE_MUTATION` | src/lib/automations/actions/entity-actions.ts |
| `handleCreateEntity` | server_action | `L2_STATE_MUTATION` | src/lib/automations/actions/entity-actions.ts |
| `handleCreateContactForEntity` | server_action | `L2_STATE_MUTATION` | src/lib/automations/actions/entity-actions.ts |
| `handleUpdateContact` | server_action | `L2_STATE_MUTATION` | src/lib/automations/actions/entity-actions.ts |
| `handleDirectMessage` | server_action | `L2_STATE_MUTATION` | src/lib/automations/actions/message-actions.ts |
| `parseManualRecipients` | server_action | `L2_STATE_MUTATION` | src/lib/automations/actions/notification-actions.ts |
| `handleDirectNotification` | server_action | `L2_STATE_MUTATION` | src/lib/automations/actions/notification-actions.ts |
| `handleUpdateLeadScore` | server_action | `L2_STATE_MUTATION` | src/lib/automations/actions/score-automation-actions.ts |
| `handleCreateTask` | server_action | `L2_STATE_MUTATION` | src/lib/automations/actions/task-actions.ts |
| `handleUpdateTask` | server_action | `L2_STATE_MUTATION` | src/lib/automations/actions/task-actions.ts |
| `handleTriggerOutboundWebhook` | server_action | `L2_STATE_MUTATION` | src/lib/automations/actions/webhook-actions.ts |
| `saveGlobalAiKeys` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-ai-actions.ts |
| `saveGlobalAiConfig` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-ai-actions.ts |
| `decideApprovalRequest` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-approval-actions.ts |
| `cancelApprovalRequest` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-approval-actions.ts |
| `saveAssetRecord` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-asset-actions.ts |
| `toggleFeatureKillSwitch` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-feature-actions.ts |
| `updateFeatureRolloutRules` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-feature-actions.ts |
| `saveContactTypeDefaults` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-field-actions.ts |
| `saveFieldPack` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-field-actions.ts |
| `saveNativeField` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-field-actions.ts |
| `savePlatformIndustryFieldGroup` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-field-actions.ts |
| `triggerDunningEscalationAction` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-finance-actions.ts |
| `updateTenantIssueStatusAction` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-health-actions.ts |
| `addTenantIssueNoteAction` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-health-actions.ts |
| `createImpersonationSessionAction` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-health-actions.ts |
| `manualReSyncBookingAction` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-integration-actions.ts |
| `createJob` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-job-actions.ts |
| `cancelJob` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-job-actions.ts |
| `triggerJobExecution` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-job-actions.ts |
| `runTenantDiagnostics` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-job-actions.ts |
| `clearAutomationData` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-job-actions.ts |
| `replayWebhookDeadLetterAction` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-messaging-observatory-actions.ts |
| `suspendOrganization` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-org-actions.ts |
| `restoreOrganization` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-org-actions.ts |
| `updateOrganizationFromBackoffice` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-org-actions.ts |
| `createOrganizationFromBackofficeAction` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-org-actions.ts |
| `toggleOrganizationActivityLogging` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-org-actions.ts |
| `clearOrganizationActivityLogs` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-org-actions.ts |
| `saveProviderSetting` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-provider-actions.ts |
| `unflagSubmissionAction` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-survey-actions.ts |
| `seedRoleArchitectureTemplatesAction` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-template-actions.ts |
| `deprecateTemplate` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-template-actions.ts |
| `createTemplateAction` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-template-actions.ts |
| `updateTemplateAction` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-template-actions.ts |
| `propagateTemplateAction` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-template-actions.ts |
| `restoreWorkspaceFromBackoffice` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-workspace-actions.ts |
| `createDiscovery` | server_action | `L2_STATE_MUTATION` | src/lib/consultancy-actions.ts |
| `updateDiscovery` | server_action | `L2_STATE_MUTATION` | src/lib/consultancy-actions.ts |
| `createEngagement` | server_action | `L2_STATE_MUTATION` | src/lib/consultancy-actions.ts |
| `updateEngagement` | server_action | `L2_STATE_MUTATION` | src/lib/consultancy-actions.ts |
| `createMilestone` | server_action | `L2_STATE_MUTATION` | src/lib/consultancy-actions.ts |
| `updateMilestoneStatus` | server_action | `L2_STATE_MUTATION` | src/lib/consultancy-actions.ts |
| `createOutcome` | server_action | `L2_STATE_MUTATION` | src/lib/consultancy-actions.ts |
| `updateOutcome` | server_action | `L2_STATE_MUTATION` | src/lib/consultancy-actions.ts |
| `createRetainer` | server_action | `L2_STATE_MUTATION` | src/lib/consultancy-actions.ts |
| `updateRetainer` | server_action | `L2_STATE_MUTATION` | src/lib/consultancy-actions.ts |
| `submitDocumentLeadAction` | server_action | `L2_STATE_MUTATION` | src/lib/document-actions.ts |
| `recordDocumentEventAction` | server_action | `L2_STATE_MUTATION` | src/lib/document-actions.ts |
| `recordObservabilityMetricAction` | server_action | `L2_STATE_MUTATION` | src/lib/documents/document-observability-actions.ts |
| `executeLayerActionServerAction` | server_action | `L2_STATE_MUTATION` | src/lib/documents/interactive-layer-actions.ts |
| `queueDocumentProcessingAction` | server_action | `L2_STATE_MUTATION` | src/lib/documents/processing-actions.ts |
| `createFlipbookAction` | server_action | `L2_STATE_MUTATION` | src/lib/flipbook-actions.ts |
| `updateFlipbookAction` | server_action | `L2_STATE_MUTATION` | src/lib/flipbook-actions.ts |
| `submitFlipbookLeadAction` | server_action | `L2_STATE_MUTATION` | src/lib/flipbook-actions.ts |
| `logFlipbookAnalyticsAction` | server_action | `L2_STATE_MUTATION` | src/lib/flipbook-actions.ts |
| `submitStandaloneFormAction` | server_action | `L2_STATE_MUTATION` | src/lib/form-actions.ts |
| `recordFormTelemetryEventAction` | server_action | `L2_STATE_MUTATION` | src/lib/forms/form-analytics-actions.ts |
| `saveFormDraftAction` | server_action | `L2_STATE_MUTATION` | src/lib/forms/form-draft-actions.ts |
| `updateSubmissionStatusAction` | server_action | `L2_STATE_MUTATION` | src/lib/forms/form-response-actions.ts |
| `bulkUpdateSubmissionsAction` | server_action | `L2_STATE_MUTATION` | src/lib/forms/form-response-actions.ts |
| `addSubmissionNoteAction` | server_action | `L2_STATE_MUTATION` | src/lib/forms/form-response-actions.ts |
| `initializeFormSessionAction` | server_action | `L2_STATE_MUTATION` | src/lib/forms/form-session-actions.ts |
| `recordFormEventAction` | server_action | `L2_STATE_MUTATION` | src/lib/forms/form-session-actions.ts |
| `processFormSubmissionAction` | server_action | `L2_STATE_MUTATION` | src/lib/forms-actions.ts |
| `processMeetingInvitations` | server_action | `L2_STATE_MUTATION` | src/lib/invitation-actions.ts |
| `createMatter` | server_action | `L2_STATE_MUTATION` | src/lib/law-actions.ts |
| `updateMatterStatus` | server_action | `L2_STATE_MUTATION` | src/lib/law-actions.ts |
| `createIntakeForm` | server_action | `L2_STATE_MUTATION` | src/lib/law-actions.ts |
| `createConflictCheck` | server_action | `L2_STATE_MUTATION` | src/lib/law-actions.ts |
| `updateConflictCheckStatus` | server_action | `L2_STATE_MUTATION` | src/lib/law-actions.ts |
| `createConsultation` | server_action | `L2_STATE_MUTATION` | src/lib/law-actions.ts |
| `updateConsultation` | server_action | `L2_STATE_MUTATION` | src/lib/law-actions.ts |
| `createRelatedParty` | server_action | `L2_STATE_MUTATION` | src/lib/law-actions.ts |
| `createLegalDocument` | server_action | `L2_STATE_MUTATION` | src/lib/law-actions.ts |
| `createTimeEntry` | server_action | `L2_STATE_MUTATION` | src/lib/law-actions.ts |
| `createCourtDate` | server_action | `L2_STATE_MUTATION` | src/lib/law-actions.ts |
| `updateCourtDate` | server_action | `L2_STATE_MUTATION` | src/lib/law-actions.ts |
| `processLeadCaptureAction` | server_action | `L2_STATE_MUTATION` | src/lib/lead-actions.ts |
| `createLearningSignalAction` | server_action | `L2_STATE_MUTATION` | src/lib/learning-loop-actions.ts |
| `finalizeLearningSignalAction` | server_action | `L2_STATE_MUTATION` | src/lib/learning-loop-actions.ts |
| `updateSignalRatingAction` | server_action | `L2_STATE_MUTATION` | src/lib/learning-loop-actions.ts |
| `createCampaign` | server_action | `L2_STATE_MUTATION` | src/lib/marketing-actions.ts |
| `updateCampaign` | server_action | `L2_STATE_MUTATION` | src/lib/marketing-actions.ts |
| `createProposal` | server_action | `L2_STATE_MUTATION` | src/lib/marketing-actions.ts |
| `updateProposal` | server_action | `L2_STATE_MUTATION` | src/lib/marketing-actions.ts |
| `createDeliverable` | server_action | `L2_STATE_MUTATION` | src/lib/marketing-actions.ts |
| `updateDeliverableStatus` | server_action | `L2_STATE_MUTATION` | src/lib/marketing-actions.ts |
| `recordPerformanceMetric` | server_action | `L2_STATE_MUTATION` | src/lib/marketing-actions.ts |
| `createClientReport` | server_action | `L2_STATE_MUTATION` | src/lib/marketing-actions.ts |
| `updateClientReport` | server_action | `L2_STATE_MUTATION` | src/lib/marketing-actions.ts |
| `createStrategyDoc` | server_action | `L2_STATE_MUTATION` | src/lib/marketing-actions.ts |
| `updateStrategyDoc` | server_action | `L2_STATE_MUTATION` | src/lib/marketing-actions.ts |
| `logNoteActivity` | server_action | `L2_STATE_MUTATION` | src/lib/note-actions.ts |
| `saveAgreementProgressAction` | server_action | `L2_STATE_MUTATION` | src/lib/pdf-actions.ts |
| `finalizeAgreementAction` | server_action | `L2_STATE_MUTATION` | src/lib/pdf-actions.ts |
| `setOutboundPausedAction` | server_action | `L2_STATE_MUTATION` | src/lib/platform/platform-controls-actions.ts |
| `updateProfile` | server_action | `L2_STATE_MUTATION` | src/lib/profile-actions.ts |
| `recordScanEvent` | server_action | `L2_STATE_MUTATION` | src/lib/qr-scan-actions.ts |
| `logQuickNoteActivity` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-actions.ts |
| `enrichNoteLink` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-actions.ts |
| `logQuickNoteCreated` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-actions.ts |
| `createQuickNoteAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-actions.ts |
| `createTaskFromActionItem` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-ai-actions.ts |
| `deployConceptToCampaignStudioAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-campaign-actions.ts |
| `updateCampaignConceptStatusAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-campaign-actions.ts |
| `createFederatedSpaceAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-federation-actions.ts |
| `updateFederatedSpaceAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-federation-actions.ts |
| `subscribeToFederatedSpaceAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-federation-actions.ts |
| `unsubscribeFromFederatedSpaceAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-federation-actions.ts |
| `cloneFederatedItemToWorkspaceAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-federation-actions.ts |
| `commitOfflineBatchAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-offline-actions.ts |
| `createProperty` | server_action | `L2_STATE_MUTATION` | src/lib/real-estate-actions.ts |
| `updateProperty` | server_action | `L2_STATE_MUTATION` | src/lib/real-estate-actions.ts |
| `createPropertyPreference` | server_action | `L2_STATE_MUTATION` | src/lib/real-estate-actions.ts |
| `updatePropertyPreference` | server_action | `L2_STATE_MUTATION` | src/lib/real-estate-actions.ts |
| `createViewing` | server_action | `L2_STATE_MUTATION` | src/lib/real-estate-actions.ts |
| `updateViewingStatus` | server_action | `L2_STATE_MUTATION` | src/lib/real-estate-actions.ts |
| `createOffer` | server_action | `L2_STATE_MUTATION` | src/lib/real-estate-actions.ts |
| `updateOfferStatus` | server_action | `L2_STATE_MUTATION` | src/lib/real-estate-actions.ts |
| `createNegotiation` | server_action | `L2_STATE_MUTATION` | src/lib/real-estate-actions.ts |
| `updateNegotiation` | server_action | `L2_STATE_MUTATION` | src/lib/real-estate-actions.ts |
| `createDeal` | server_action | `L2_STATE_MUTATION` | src/lib/real-estate-actions.ts |
| `updateDeal` | server_action | `L2_STATE_MUTATION` | src/lib/real-estate-actions.ts |
| `createPropertyDocument` | server_action | `L2_STATE_MUTATION` | src/lib/real-estate-actions.ts |
| `updatePropertyDocument` | server_action | `L2_STATE_MUTATION` | src/lib/real-estate-actions.ts |
| `scheduleRemindersForMeeting` | server_action | `L2_STATE_MUTATION` | src/lib/reminder-actions.ts |
| `cancelRemindersForMeeting` | server_action | `L2_STATE_MUTATION` | src/lib/reminder-actions.ts |
| `processScheduledMessages` | server_action | `L2_STATE_MUTATION` | src/lib/reminder-actions.ts |
| `scheduleRemindersForNewRegistrant` | server_action | `L2_STATE_MUTATION` | src/lib/reminder-actions.ts |
| `autoEndCompletedMeetings` | server_action | `L2_STATE_MUTATION` | src/lib/reminder-actions.ts |
| `createTrial` | server_action | `L2_STATE_MUTATION` | src/lib/saas-actions.ts |
| `updateTrialStatus` | server_action | `L2_STATE_MUTATION` | src/lib/saas-actions.ts |
| `createOnboarding` | server_action | `L2_STATE_MUTATION` | src/lib/saas-actions.ts |
| `updateOnboardingMilestone` | server_action | `L2_STATE_MUTATION` | src/lib/saas-actions.ts |
| `createSubscription` | server_action | `L2_STATE_MUTATION` | src/lib/saas-actions.ts |
| `updateSubscription` | server_action | `L2_STATE_MUTATION` | src/lib/saas-actions.ts |
| `createSupportTicket` | server_action | `L2_STATE_MUTATION` | src/lib/saas-actions.ts |
| `updateSupportTicket` | server_action | `L2_STATE_MUTATION` | src/lib/saas-actions.ts |
| `createHealthScore` | server_action | `L2_STATE_MUTATION` | src/lib/saas-actions.ts |
| `recordProductUsage` | server_action | `L2_STATE_MUTATION` | src/lib/saas-actions.ts |
| `recordFeatureAdoption` | server_action | `L2_STATE_MUTATION` | src/lib/saas-actions.ts |
| `createApplication` | server_action | `L2_STATE_MUTATION` | src/lib/school-enrollment-actions.ts |
| `updateApplicationStatus` | server_action | `L2_STATE_MUTATION` | src/lib/school-enrollment-actions.ts |
| `createEnrollment` | server_action | `L2_STATE_MUTATION` | src/lib/school-enrollment-actions.ts |
| `updateEnrollmentStatus` | server_action | `L2_STATE_MUTATION` | src/lib/school-enrollment-actions.ts |
| `createSchoolVisit` | server_action | `L2_STATE_MUTATION` | src/lib/school-enrollment-actions.ts |
| `updateVisitStatus` | server_action | `L2_STATE_MUTATION` | src/lib/school-enrollment-actions.ts |
| `applyTagAction` | server_action | `L2_STATE_MUTATION` | src/lib/scoped-tag-actions.ts |
| `AiActionProposalService` | server_action | `L2_STATE_MUTATION` | src/lib/services/ai-admin/ai-action-proposal-service.ts |
| `triggerSurveyWebhook` | server_action | `L2_STATE_MUTATION` | src/lib/survey-actions.ts |
| `executeSurveyResultButtonActions` | server_action | `L2_STATE_MUTATION` | src/lib/survey-actions.ts |
| `logSurveyStartedAction` | server_action | `L2_STATE_MUTATION` | src/lib/survey-actions.ts |
| `seedSystemQuestionBankAction` | server_action | `L2_STATE_MUTATION` | src/lib/surveys/question-bank-actions.ts |
| `executeSurveyCrmSyncAction` | server_action | `L2_STATE_MUTATION` | src/lib/surveys/survey-crm-sync-actions.ts |
| `promoteWinningVariantAction` | server_action | `L2_STATE_MUTATION` | src/lib/surveys/survey-experiment-actions.ts |
| `executePredictiveNextBestAction` | server_action | `L2_STATE_MUTATION` | src/lib/surveys/survey-predictive-actions.ts |
| `createSurveyProjectAction` | server_action | `L2_STATE_MUTATION` | src/lib/surveys/survey-project-actions.ts |
| `executeTagAction` | server_action | `L2_STATE_MUTATION` | src/lib/tag-action-executor.ts |
| `createTagAction` | server_action | `L2_STATE_MUTATION` | src/lib/tag-actions.ts |
| `applyTagsAction` | server_action | `L2_STATE_MUTATION` | src/lib/tag-actions.ts |
| `removeTagsAction` | server_action | `L2_STATE_MUTATION` | src/lib/tag-actions.ts |
| `createTaskNonBlocking` | server_action | `L2_STATE_MUTATION` | src/lib/task-actions.ts |
| `updateTaskNonBlocking` | server_action | `L2_STATE_MUTATION` | src/lib/task-actions.ts |
| `completeTaskNonBlocking` | server_action | `L2_STATE_MUTATION` | src/lib/task-actions.ts |
| `bulkUpdateTasks` | server_action | `L2_STATE_MUTATION` | src/lib/task-actions.ts |
| `bulkCompleteTasks` | server_action | `L2_STATE_MUTATION` | src/lib/task-actions.ts |
| `createTaskFromAutomation` | server_action | `L2_STATE_MUTATION` | src/lib/task-server-actions.ts |
| `adminResetUserPasswordAction` | server_action | `L2_STATE_MUTATION` | src/lib/user-invite-actions.ts |
| `publicResetPasswordViaPhoneAction` | server_action | `L2_STATE_MUTATION` | src/lib/user-invite-actions.ts |
| `adminUpdateUserAccessAction` | server_action | `L2_STATE_MUTATION` | src/lib/user-invite-actions.ts |
| `declineJoinRequestAction` | server_action | `L2_STATE_MUTATION` | src/lib/user-invite-actions.ts |
| `removeUserFromOrgAction` | server_action | `L2_STATE_MUTATION` | src/lib/user-invite-actions.ts |
| `updateWorkspaceVocabularyAction` | server_action | `L2_STATE_MUTATION` | src/lib/vocabulary-map-actions.ts |
| `linkEntityToWorkspaceAction` | server_action | `L2_STATE_MUTATION` | src/lib/workspace-entity-actions.ts |
| `updateWorkspaceEntityAction` | server_action | `L2_STATE_MUTATION` | src/lib/workspace-entity-actions.ts |
| `ensureEntitySharedToWorkspace` | server_action | `L2_STATE_MUTATION` | src/lib/workspace-entity-actions.ts |
| `POST /api/automations/enroll` | api | `L2_STATE_MUTATION` | src/app/api/automations/enroll/route.ts |
| `POST /api/automations/webhook/[id]` | webhook | `L2_STATE_MUTATION` | src/app/api/automations/webhook/[id]/route.ts |
| `POST /api/call-centre/webhook` | webhook | `L2_STATE_MUTATION` | src/app/api/call-centre/webhook/route.ts |
| `POST /api/documents/events` | api | `L2_STATE_MUTATION` | src/app/api/documents/events/route.ts |
| `POST /api/documents/process` | api | `L2_STATE_MUTATION` | src/app/api/documents/process/route.ts |
| `OPTIONS /api/external/forms/submit` | api | `L2_STATE_MUTATION` | src/app/api/external/forms/submit/route.ts |
| `POST /api/external/forms/submit` | api | `L2_STATE_MUTATION` | src/app/api/external/forms/submit/route.ts |
| `POST /api/external/v1/entities` | api | `L2_STATE_MUTATION` | src/app/api/external/v1/entities/route.ts |
| `POST /api/jobs/resend` | api | `L2_STATE_MUTATION` | src/app/api/jobs/resend/route.ts |
| `OPTIONS /api/lead-intelligence/extension/scan` | api | `L2_STATE_MUTATION` | src/app/api/lead-intelligence/extension/scan/route.ts |
| `OPTIONS /api/lead-intelligence/extension/sync` | api | `L2_STATE_MUTATION` | src/app/api/lead-intelligence/extension/sync/route.ts |
| `POST /api/lead-intelligence/extension/sync` | api | `L2_STATE_MUTATION` | src/app/api/lead-intelligence/extension/sync/route.ts |
| `OPTIONS /api/mcp` | mcp | `L2_STATE_MUTATION` | src/app/api/mcp/route.ts |
| `POST /api/media-tracker` | api | `L2_STATE_MUTATION` | src/app/api/media-tracker/route.ts |
| `POST /api/meetings/register` | api | `L2_STATE_MUTATION` | src/app/api/meetings/register/route.ts |
| `POST /api/messaging/unsubscribe/one-click` | api | `L2_STATE_MUTATION` | src/app/api/messaging/unsubscribe/one-click/route.ts |
| `POST /api/messaging/unsubscribe` | api | `L2_STATE_MUTATION` | src/app/api/messaging/unsubscribe/route.ts |
| `POST /api/organizations/scrape` | api | `L2_STATE_MUTATION` | src/app/api/organizations/scrape/route.ts |
| `POST /api/organizations/upload-logo` | api | `L2_STATE_MUTATION` | src/app/api/organizations/upload-logo/route.ts |
| `POST /api/pdfs/submit` | api | `L2_STATE_MUTATION` | src/app/api/pdfs/submit/route.ts |
| `OPTIONS /api/proxy-image` | api | `L2_STATE_MUTATION` | src/app/api/proxy-image/route.ts |
| `POST /api/qr/batch-export` | api | `L2_STATE_MUTATION` | src/app/api/qr/batch-export/route.ts |
| `POST /api/qr/unlock` | api | `L2_STATE_MUTATION` | src/app/api/qr/unlock/route.ts |
| `PATCH /api/tasks/[taskId]` | task_worker | `L2_STATE_MUTATION` | src/app/api/tasks/[taskId]/route.ts |
| `POST /api/tasks` | api | `L2_STATE_MUTATION` | src/app/api/tasks/route.ts |
| `POST /api/v1/quick-notes/ingest` | api | `L2_STATE_MUTATION` | src/app/api/v1/quick-notes/ingest/route.ts |
| `POST /api/verify-email/bulk` | api | `L2_STATE_MUTATION` | src/app/api/verify-email/bulk/route.ts |
| `POST /api/verify-email` | api | `L2_STATE_MUTATION` | src/app/api/verify-email/route.ts |
| `POST /api/verify-email/trigger` | api | `L2_STATE_MUTATION` | src/app/api/verify-email/trigger/route.ts |
| `POST /api/verify-phone/bulk` | api | `L2_STATE_MUTATION` | src/app/api/verify-phone/bulk/route.ts |
| `POST /api/verify-phone` | api | `L2_STATE_MUTATION` | src/app/api/verify-phone/route.ts |
| `POST /api/verify-phone/trigger` | api | `L2_STATE_MUTATION` | src/app/api/verify-phone/trigger/route.ts |
| `generatePortalScaffoldAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/ai-experience-actions.ts |
| `generateCurriculumAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/ai-experience-actions.ts |
| `generateQuizAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/ai-experience-actions.ts |
| `askAiTutorAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/ai-experience-actions.ts |
| `resolveModerationReportAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/community-actions.ts |
| `generateCreativeConceptsAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/creative-ai-actions.ts |
| `generateCopyVariationsAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/creative-ai-actions.ts |
| `generateBatchPersonalizedCreativesAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/creative-crm-actions.ts |
| `resolveWorkspaceEntityRecord` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/deal-actions.ts |
| `discardContentStudioDraftAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/draft-actions.ts |
| `generateEntityDossierSummaryAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/entity-dossier-actions.ts |
| `generateHeadlineVariationsAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/headline-iq-actions.ts |
| `generateKeywordsAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/survey-seo-actions.ts |
| `generateApiKey` | server_action | `L1_INTERNAL_DRAFT` | src/lib/api-key-actions.ts |
| `resolveTagVariables` | server_action | `L1_INTERNAL_DRAFT` | src/lib/messaging-actions.ts |
| `previewCampaignAudience` | server_action | `L1_INTERNAL_DRAFT` | src/lib/messaging-actions.ts |
| `resolveRecipientContacts` | server_action | `L1_INTERNAL_DRAFT` | src/lib/messaging-actions.ts |
| `generatePdfBuffer` | server_action | `L1_INTERNAL_DRAFT` | src/lib/pdf-actions.ts |
| `generateCampaignConceptAction` | server_action | `L1_INTERNAL_DRAFT` | src/lib/quick-notes-campaign-actions.ts |
| `synthesizeCampaignLearningsAction` | server_action | `L1_INTERNAL_DRAFT` | src/lib/quick-notes-campaign-actions.ts |
| `generateWorkspaceBattlecardsAction` | server_action | `L1_INTERNAL_DRAFT` | src/lib/quick-notes-campaign-actions.ts |
| `generateIngestionWebhookKeyAction` | server_action | `L1_INTERNAL_DRAFT` | src/lib/quick-notes-federation-actions.ts |
| `refineSurveyQuestionAction` | server_action | `L1_INTERNAL_DRAFT` | src/lib/surveys/survey-ai-refinement-actions.ts |
| `suggestSurveyVariantCopyAction` | server_action | `L1_INTERNAL_DRAFT` | src/lib/surveys/survey-experiment-actions.ts |
| `getCoursePedagogyDiagnosticAction` | server_action | `L0_READ` | src/app/actions/ai-experience-actions.ts |
| `getPermissionCatalogAction` | server_action | `L0_READ` | src/app/actions/authorization-actions.ts |
| `fetchCandidateDealsForFER` | server_action | `L0_READ` | src/app/actions/automated-deal-fer-actions.ts |
| `getDefaultAvailabilityProfileAction` | server_action | `L0_READ` | src/app/actions/availability-actions.ts |
| `fetchDealsForStageNameBackfill` | server_action | `L0_READ` | src/app/actions/backfill-deal-stagename-action.ts |
| `getPublicBookingPageDataAction` | server_action | `L0_READ` | src/app/actions/booking-actions.ts |
| `getAvailableSlotsAction` | server_action | `L0_READ` | src/app/actions/booking-actions.ts |
| `listOffersByPortalAction` | server_action | `L0_READ` | src/app/actions/commerce-actions.ts |
| `listCouponsByPortalAction` | server_action | `L0_READ` | src/app/actions/commerce-actions.ts |
| `validateCouponAction` | server_action | `L0_READ` | src/app/actions/commerce-actions.ts |
| `listOrdersByPortalAction` | server_action | `L0_READ` | src/app/actions/commerce-actions.ts |
| `listAffiliatesByPortalAction` | server_action | `L0_READ` | src/app/actions/commerce-actions.ts |
| `listSpacesByPortalAction` | server_action | `L0_READ` | src/app/actions/community-actions.ts |
| `listModerationReportsAction` | server_action | `L0_READ` | src/app/actions/community-actions.ts |
| `listLessonPostsAction` | server_action | `L0_READ` | src/app/actions/community-actions.ts |
| `getCommunityLeaderboardAction` | server_action | `L0_READ` | src/app/actions/community-actions.ts |
| `getMemberPublicProfileAction` | server_action | `L0_READ` | src/app/actions/community-actions.ts |
| `getContentItemBySlugAction` | server_action | `L0_READ` | src/app/actions/content-actions.ts |
| `searchPortalContentAction` | server_action | `L0_READ` | src/app/actions/content-actions.ts |
| `listContentItemsByPortalAction` | server_action | `L0_READ` | src/app/actions/content-actions.ts |
| `listPortalContentTemplatesAction` | server_action | `L0_READ` | src/app/actions/content-actions.ts |
| `listProjectConceptsAction` | server_action | `L0_READ` | src/app/actions/creative-ai-actions.ts |
| `listProjectsPendingApprovalAction` | server_action | `L0_READ` | src/app/actions/creative-collab-actions.ts |
| `listCrmCampaignsAction` | server_action | `L0_READ` | src/app/actions/creative-crm-actions.ts |
| `getCrmContactPreviewDataAction` | server_action | `L0_READ` | src/app/actions/creative-crm-actions.ts |
| `listProjectExperimentsAction` | server_action | `L0_READ` | src/app/actions/creative-experiment-actions.ts |
| `getProjectPerformanceMetricsAction` | server_action | `L0_READ` | src/app/actions/creative-performance-actions.ts |
| `listWorkspaceCampaignPerformanceAction` | server_action | `L0_READ` | src/app/actions/creative-performance-actions.ts |
| `exportHighResolutionAssetAction` | server_action | `L0_READ` | src/app/actions/creative-performance-actions.ts |
| `listPublicationHistoryAction` | server_action | `L0_READ` | src/app/actions/creative-publishing-actions.ts |
| `listConnectedChannelsAction` | server_action | `L0_READ` | src/app/actions/creative-publishing-actions.ts |
| `listCreativeTemplatesAction` | server_action | `L0_READ` | src/app/actions/creative-template-actions.ts |
| `listCertificateTemplatesAction` | server_action | `L0_READ` | src/app/actions/credential-actions.ts |
| `verifyCertificateAction` | server_action | `L0_READ` | src/app/actions/credential-actions.ts |
| `listIssuedCertificatesAction` | server_action | `L0_READ` | src/app/actions/credential-actions.ts |
| `exportOpenBadgeAction` | server_action | `L0_READ` | src/app/actions/credential-actions.ts |
| `listXApiStatementsAction` | server_action | `L0_READ` | src/app/actions/credential-actions.ts |
| `listBadgeDefinitionsAction` | server_action | `L0_READ` | src/app/actions/credential-actions.ts |
| `getPublicQuoteByTokenAction` | server_action | `L0_READ` | src/app/actions/deal-line-item-actions.ts |
| `getContentStudioDraftAction` | server_action | `L0_READ` | src/app/actions/draft-actions.ts |
| `listContentStudioDraftsByPortalAction` | server_action | `L0_READ` | src/app/actions/draft-actions.ts |
| `getOnboardingFlowAction` | server_action | `L0_READ` | src/app/actions/engagement-actions.ts |
| `listTasksByPortalAction` | server_action | `L0_READ` | src/app/actions/engagement-actions.ts |
| `listPendingSubmissionsAction` | server_action | `L0_READ` | src/app/actions/engagement-actions.ts |
| `evaluatePortalInactivityAction` | server_action | `L0_READ` | src/app/actions/engagement-actions.ts |
| `getEnterpriseSsoAction` | server_action | `L0_READ` | src/app/actions/enterprise-actions.ts |
| `getWhiteLabelConfigAction` | server_action | `L0_READ` | src/app/actions/enterprise-actions.ts |
| `listHierarchyNodesAction` | server_action | `L0_READ` | src/app/actions/enterprise-actions.ts |
| `listMarketplaceListingsAction` | server_action | `L0_READ` | src/app/actions/enterprise-actions.ts |
| `listEnterpriseAuditLogsAction` | server_action | `L0_READ` | src/app/actions/enterprise-actions.ts |
| `listLiveEventsByPortalAction` | server_action | `L0_READ` | src/app/actions/event-actions.ts |
| `listCohortsByPortalAction` | server_action | `L0_READ` | src/app/actions/event-actions.ts |
| `listCohortMembersAction` | server_action | `L0_READ` | src/app/actions/event-actions.ts |
| `getEventTypesAction` | server_action | `L0_READ` | src/app/actions/event-type-actions.ts |
| `getMigrationStatusAction` | server_action | `L0_READ` | src/app/actions/get-migration-status-action.ts |
| `fetchSchoolsForSaaSMigration` | server_action | `L0_READ` | src/app/actions/industry-migration-actions.ts |
| `listCoursesByPortalAction` | server_action | `L0_READ` | src/app/actions/learning-actions.ts |
| `listLessonsByCourseAction` | server_action | `L0_READ` | src/app/actions/learning-actions.ts |
| `getSanitizedAssessmentAction` | server_action | `L0_READ` | src/app/actions/learning-actions.ts |
| `getLinkMetadataAction` | server_action | `L0_READ` | src/app/actions/link-metadata-actions.ts |
| `getMeetingPollBySlugAction` | server_action | `L0_READ` | src/app/actions/meeting-poll-actions.ts |
| `getMeetingRecordingsAction` | server_action | `L0_READ` | src/app/actions/meeting-recording-actions.ts |
| `getWorkspaceResourcesAction` | server_action | `L0_READ` | src/app/actions/meeting-resource-actions.ts |
| `getWorkspaceTelemetryMetricsAction` | server_action | `L0_READ` | src/app/actions/meeting-telemetry-actions.ts |
| `getEventTypeWorkflowsAction` | server_action | `L0_READ` | src/app/actions/meeting-workflow-actions.ts |
| `verifyInvitationTokenAction` | server_action | `L0_READ` | src/app/actions/membership-actions.ts |
| `checkEntitlementAction` | server_action | `L0_READ` | src/app/actions/membership-actions.ts |
| `listMembershipsByPortalAction` | server_action | `L0_READ` | src/app/actions/membership-actions.ts |
| `listInvitationsByPortalAction` | server_action | `L0_READ` | src/app/actions/membership-actions.ts |
| `listPlansByPortalAction` | server_action | `L0_READ` | src/app/actions/membership-actions.ts |
| `evaluateContentAccessAction` | server_action | `L0_READ` | src/app/actions/membership-actions.ts |
| `getParkedJobsCountAction` | server_action | `L0_READ` | src/app/actions/node-deletion-reconciliation-actions.ts |
| `validateJoinCodeAction` | server_action | `L0_READ` | src/app/actions/onboarding-actions.ts |
| `getOnboardingSetupStateAction` | server_action | `L0_READ` | src/app/actions/onboarding-actions.ts |
| `verifyPortalSlugAvailabilityAction` | server_action | `L0_READ` | src/app/actions/portal-actions.ts |
| `validatePortalPasswordAction` | server_action | `L0_READ` | src/app/actions/portal-actions.ts |
| `getPublicPortalBySlugAction` | server_action | `L0_READ` | src/app/actions/portal-actions.ts |
| `getPortalByIdAction` | server_action | `L0_READ` | src/app/actions/portal-actions.ts |
| `getPortalAnalyticsAction` | server_action | `L0_READ` | src/app/actions/portal-analytics-actions.ts |
| `fetchUsersForWorkspaceRbacMigration` | server_action | `L0_READ` | src/app/actions/rbac-workspace-migration-actions.ts |
| `getRoutingFormBySlugAction` | server_action | `L0_READ` | src/app/actions/routing-form-actions.ts |
| `getBookingPageBySlugAction` | server_action | `L0_READ` | src/app/actions/scheduler-actions.ts |
| `getAvailableSlotsAction` | server_action | `L0_READ` | src/app/actions/scheduler-actions.ts |
| `validateInvitationTokenAction` | server_action | `L0_READ` | src/app/actions/workforce-actions.ts |
| `fetchWorkspacesForIndustryMigration` | server_action | `L0_READ` | src/app/actions/workspace-industry-migration-actions.ts |
| `getActivitiesForContactCore` | server_action | `L0_READ` | src/lib/activity-actions.ts |
| `handleFindContact` | server_action | `L0_READ` | src/lib/automations/actions/entity-actions.ts |
| `getGlobalAiKeys` | server_action | `L0_READ` | src/lib/backoffice/backoffice-ai-actions.ts |
| `getGlobalAiConfig` | server_action | `L0_READ` | src/lib/backoffice/backoffice-ai-actions.ts |
| `listApprovalRequests` | server_action | `L0_READ` | src/lib/backoffice/backoffice-approval-actions.ts |
| `listAllAssets` | server_action | `L0_READ` | src/lib/backoffice/backoffice-asset-actions.ts |
| `fetchAuditLogs` | server_action | `L0_READ` | src/lib/backoffice/backoffice-audit-actions.ts |
| `getPlatformOpsStats` | server_action | `L0_READ` | src/lib/backoffice/backoffice-dashboard-actions.ts |
| `listAllFeatures` | server_action | `L0_READ` | src/lib/backoffice/backoffice-feature-actions.ts |
| `getFeatureDetail` | server_action | `L0_READ` | src/lib/backoffice/backoffice-feature-actions.ts |
| `listFieldPacks` | server_action | `L0_READ` | src/lib/backoffice/backoffice-field-actions.ts |
| `getContactTypeDefaultsInternal` | server_action | `L0_READ` | src/lib/backoffice/backoffice-field-actions.ts |
| `getContactTypeDefaults` | server_action | `L0_READ` | src/lib/backoffice/backoffice-field-actions.ts |
| `listNativeFields` | server_action | `L0_READ` | src/lib/backoffice/backoffice-field-actions.ts |
| `listPlatformIndustryFieldGroupsInternal` | server_action | `L0_READ` | src/lib/backoffice/backoffice-field-actions.ts |
| `listPlatformIndustryFieldGroups` | server_action | `L0_READ` | src/lib/backoffice/backoffice-field-actions.ts |
| `getFinancialOverviewAction` | server_action | `L0_READ` | src/lib/backoffice/backoffice-finance-actions.ts |
| `getTenantHealthOverviewAction` | server_action | `L0_READ` | src/lib/backoffice/backoffice-health-actions.ts |
| `listTenantIssuesAction` | server_action | `L0_READ` | src/lib/backoffice/backoffice-health-actions.ts |
| `getSystemEngineManifestAction` | server_action | `L0_READ` | src/lib/backoffice/backoffice-health-actions.ts |
| `getIntegrationHealthOverviewAction` | server_action | `L0_READ` | src/lib/backoffice/backoffice-integration-actions.ts |
| `verifyIntegrationConnectionAction` | server_action | `L0_READ` | src/lib/backoffice/backoffice-integration-actions.ts |
| `listAllJobs` | server_action | `L0_READ` | src/lib/backoffice/backoffice-job-actions.ts |
| `getMeetingsTelemetryAction` | server_action | `L0_READ` | src/lib/backoffice/backoffice-meetings-actions.ts |
| `getMessagingDeliveryMetricsAction` | server_action | `L0_READ` | src/lib/backoffice/backoffice-messaging-observatory-actions.ts |
| `listWebhookDeadLettersAction` | server_action | `L0_READ` | src/lib/backoffice/backoffice-messaging-observatory-actions.ts |
| `listSuppressionRecordsAction` | server_action | `L0_READ` | src/lib/backoffice/backoffice-messaging-observatory-actions.ts |
| `listAllOrganizations` | server_action | `L0_READ` | src/lib/backoffice/backoffice-org-actions.ts |
| `getOrganizationDetail` | server_action | `L0_READ` | src/lib/backoffice/backoffice-org-actions.ts |
| `getOrganizationDiagnostics` | server_action | `L0_READ` | src/lib/backoffice/backoffice-org-actions.ts |
| `listProviderSettings` | server_action | `L0_READ` | src/lib/backoffice/backoffice-provider-actions.ts |
| `getSurveyGovernanceOverviewAction` | server_action | `L0_READ` | src/lib/backoffice/backoffice-survey-actions.ts |
| `listAllTemplates` | server_action | `L0_READ` | src/lib/backoffice/backoffice-template-actions.ts |
| `getTemplateDetail` | server_action | `L0_READ` | src/lib/backoffice/backoffice-template-actions.ts |
| `getPublishedTemplatesAction` | server_action | `L0_READ` | src/lib/backoffice/backoffice-template-actions.ts |
| `listAllWorkspaces` | server_action | `L0_READ` | src/lib/backoffice/backoffice-workspace-actions.ts |
| `getWorkspaceDiagnostics` | server_action | `L0_READ` | src/lib/backoffice/backoffice-workspace-actions.ts |
| `getPublicInvoiceAction` | server_action | `L0_READ` | src/lib/billing-actions.ts |
| `getActionMeta` | server_action | `L0_READ` | src/lib/call-action-types.ts |
| `getDiscoveriesForEntity` | server_action | `L0_READ` | src/lib/consultancy-actions.ts |
| `getEngagementsForEntity` | server_action | `L0_READ` | src/lib/consultancy-actions.ts |
| `getMilestonesForEngagement` | server_action | `L0_READ` | src/lib/consultancy-actions.ts |
| `getOutcomesForEngagement` | server_action | `L0_READ` | src/lib/consultancy-actions.ts |
| `getRetainersForEntity` | server_action | `L0_READ` | src/lib/consultancy-actions.ts |
| `getEffectiveContactTypes` | server_action | `L0_READ` | src/lib/contact-type-actions.ts |
| `verifyDocumentPasscodeAction` | server_action | `L0_READ` | src/lib/document-actions.ts |
| `getWorkspaceHealthReportAction` | server_action | `L0_READ` | src/lib/documents/document-observability-actions.ts |
| `getFieldsForWorkspace` | server_action | `L0_READ` | src/lib/fields-actions.ts |
| `getInvoiceAllocationsAction` | server_action | `L0_READ` | src/lib/finance-actions.ts |
| `loadFormDraftAction` | server_action | `L0_READ` | src/lib/forms/form-draft-actions.ts |
| `getSubmissionNotesAction` | server_action | `L0_READ` | src/lib/forms/form-response-actions.ts |
| `getFormByIdAction` | server_action | `L0_READ` | src/lib/forms-actions.ts |
| `getFormSubmissionsAction` | server_action | `L0_READ` | src/lib/forms-actions.ts |
| `exportSubmissionsAsCsvAction` | server_action | `L0_READ` | src/lib/forms-actions.ts |
| `getMattersForEntity` | server_action | `L0_READ` | src/lib/law-actions.ts |
| `getIntakeFormsForEntity` | server_action | `L0_READ` | src/lib/law-actions.ts |
| `getConflictChecksForEntity` | server_action | `L0_READ` | src/lib/law-actions.ts |
| `getConsultationsForEntity` | server_action | `L0_READ` | src/lib/law-actions.ts |
| `getRelatedPartiesForMatter` | server_action | `L0_READ` | src/lib/law-actions.ts |
| `getLegalDocumentsForEntity` | server_action | `L0_READ` | src/lib/law-actions.ts |
| `getLegalDocumentsForMatter` | server_action | `L0_READ` | src/lib/law-actions.ts |
| `getTimeEntriesForMatter` | server_action | `L0_READ` | src/lib/law-actions.ts |
| `getTimeEntriesForEntity` | server_action | `L0_READ` | src/lib/law-actions.ts |
| `getCourtDatesForMatter` | server_action | `L0_READ` | src/lib/law-actions.ts |
| `getUpcomingCourtDatesForEntity` | server_action | `L0_READ` | src/lib/law-actions.ts |
| `getCampaignsForEntity` | server_action | `L0_READ` | src/lib/marketing-actions.ts |
| `getPerformanceMetricsForCampaign` | server_action | `L0_READ` | src/lib/marketing-actions.ts |
| `getClientReportsForEntity` | server_action | `L0_READ` | src/lib/marketing-actions.ts |
| `getStrategyDocsForEntity` | server_action | `L0_READ` | src/lib/marketing-actions.ts |
| `checkSlugAvailabilityAction` | server_action | `L0_READ` | src/lib/media-analytics-actions.ts |
| `extractActionItemsFromTranscript` | server_action | `L0_READ` | src/lib/meetings/action-items-service.ts |
| `getEntityAiSummary` | server_action | `L0_READ` | src/lib/note-actions.ts |
| `getPlatformControlsAction` | server_action | `L0_READ` | src/lib/platform/platform-controls-actions.ts |
| `getQRCode` | server_action | `L0_READ` | src/lib/qr-actions.ts |
| `getQRCodeByShortPath` | server_action | `L0_READ` | src/lib/qr-actions.ts |
| `getWorkspaceCampaignConceptsAction` | server_action | `L0_READ` | src/lib/quick-notes-campaign-actions.ts |
| `getWorkspaceBattlecardsAction` | server_action | `L0_READ` | src/lib/quick-notes-campaign-actions.ts |
| `getWorkspaceFederatedSpacesAction` | server_action | `L0_READ` | src/lib/quick-notes-federation-actions.ts |
| `exportWorkspaceKnowledgeAction` | server_action | `L0_READ` | src/lib/quick-notes-federation-actions.ts |
| `getFederatedKnowledgeFeedAction` | server_action | `L0_READ` | src/lib/quick-notes-federation-actions.ts |
| `getWorkspaceIdeasAction` | server_action | `L0_READ` | src/lib/quick-notes-idea-actions.ts |
| `getWorkspaceInsightsAction` | server_action | `L0_READ` | src/lib/quick-notes-insight-actions.ts |
| `getLatestServerSnapshotsAction` | server_action | `L0_READ` | src/lib/quick-notes-offline-actions.ts |
| `getPropertiesForEntity` | server_action | `L0_READ` | src/lib/real-estate-actions.ts |
| `getPropertyPreferencesForEntity` | server_action | `L0_READ` | src/lib/real-estate-actions.ts |
| `getViewingsForProperty` | server_action | `L0_READ` | src/lib/real-estate-actions.ts |
| `getViewingsForClient` | server_action | `L0_READ` | src/lib/real-estate-actions.ts |
| `getOffersForProperty` | server_action | `L0_READ` | src/lib/real-estate-actions.ts |
| `getOffersForBuyer` | server_action | `L0_READ` | src/lib/real-estate-actions.ts |
| `getNegotiationsForProperty` | server_action | `L0_READ` | src/lib/real-estate-actions.ts |
| `getDealsForProperty` | server_action | `L0_READ` | src/lib/real-estate-actions.ts |
| `getDealsForBuyer` | server_action | `L0_READ` | src/lib/real-estate-actions.ts |
| `getPropertyDocuments` | server_action | `L0_READ` | src/lib/real-estate-actions.ts |
| `getPublicStatementAction` | server_action | `L0_READ` | src/lib/receivables-actions.ts |
| `getRevenueReportAction` | server_action | `L0_READ` | src/lib/reporting-actions.ts |
| `getAgingReportAction` | server_action | `L0_READ` | src/lib/reporting-actions.ts |
| `getTaxAuditReportAction` | server_action | `L0_READ` | src/lib/reporting-actions.ts |
| `getReportAggregates` | server_action | `L0_READ` | src/lib/reports/report-actions.ts |
| `getTrialsForEntity` | server_action | `L0_READ` | src/lib/saas-actions.ts |
| `getLatestHealthScore` | server_action | `L0_READ` | src/lib/saas-actions.ts |
| `getApplicationsForEntity` | server_action | `L0_READ` | src/lib/school-enrollment-actions.ts |
| `getEnrollmentsForEntity` | server_action | `L0_READ` | src/lib/school-enrollment-actions.ts |
| `getSchoolVisitsForEntity` | server_action | `L0_READ` | src/lib/school-enrollment-actions.ts |
| `getWorkspaceEntitiesForSimulationAction` | server_action | `L0_READ` | src/lib/survey-actions.ts |
| `getQuestionBankItemsAction` | server_action | `L0_READ` | src/lib/surveys/question-bank-actions.ts |
| `getSystemAiArchitectGovernanceAction` | server_action | `L0_READ` | src/lib/surveys/survey-ai-architect-governance-actions.ts |
| `exportSurveyDataAction` | server_action | `L0_READ` | src/lib/surveys/survey-analytics-actions.ts |
| `getSurveyResponsesListAction` | server_action | `L0_READ` | src/lib/surveys/survey-analytics-actions.ts |
| `getSurveyCrmFieldDefinitionsAction` | server_action | `L0_READ` | src/lib/surveys/survey-crm-sync-actions.ts |
| `getWorkspaceActiveSurveysAction` | server_action | `L0_READ` | src/lib/surveys/survey-crm-trigger-actions.ts |
| `getSurveyExperimentResultsAction` | server_action | `L0_READ` | src/lib/surveys/survey-experiment-actions.ts |
| `getSurveyProjectsAction` | server_action | `L0_READ` | src/lib/surveys/survey-project-actions.ts |
| `getTaskInterlinkUrl` | server_action | `L0_READ` | src/lib/task-actions.ts |
| `getTasksForContact` | server_action | `L0_READ` | src/lib/task-server-actions.ts |
| `getThemesAction` | server_action | `L0_READ` | src/lib/theme-actions.ts |
| `GET /api/auth/social/callback` | api | `L0_READ` | src/app/api/auth/social/callback/route.ts |
| `GET /api/automations/webhook/[id]` | webhook | `L0_READ` | src/app/api/automations/webhook/[id]/route.ts |
| `GET /api/integrations/google/callback` | api | `L0_READ` | src/app/api/integrations/google/callback/route.ts |
| `GET /api/integrations/microsoft/callback` | api | `L0_READ` | src/app/api/integrations/microsoft/callback/route.ts |
| `GET /api/integrations/zoom/callback` | api | `L0_READ` | src/app/api/integrations/zoom/callback/route.ts |
| `GET /api/l/[linkId]` | api | `L0_READ` | src/app/api/l/[linkId]/route.ts |
| `GET /api/lead-intelligence/extension/download` | api | `L0_READ` | src/app/api/lead-intelligence/extension/download/route.ts |
| `GET /api/lead-intelligence/extension/scan` | api | `L0_READ` | src/app/api/lead-intelligence/extension/scan/route.ts |
| `GET /api/mcp/sse` | mcp | `L0_READ` | src/app/api/mcp/sse/route.ts |
| `GET /api/pdfs/[pdfId]/generate/[submissionId]` | api | `L0_READ` | src/app/api/pdfs/[pdfId]/generate/[submissionId]/route.ts |
| `GET /api/proxy-image` | api | `L0_READ` | src/app/api/proxy-image/route.ts |
| `GET /api/sentry-example-api` | api | `L0_READ` | src/app/api/sentry-example-api/route.ts |
| `GET /api/tasks` | api | `L0_READ` | src/app/api/tasks/route.ts |
| `GET /api/v1/quick-notes/export` | api | `L0_READ` | src/app/api/v1/quick-notes/export/route.ts |
| `GET /api/webhooks/inbound/[id]` | webhook | `L0_READ` | src/app/api/webhooks/inbound/[id]/route.ts |
| `GET /api/webhooks/whatsapp` | webhook | `L0_READ` | src/app/api/webhooks/whatsapp/route.ts |

## Duplicate-implementation candidates (28)

| Signature | Implementations |
| --- | --- |
| `get:auth+microsoft+url` | `getMicrosoftAuthUrlAction` (src/app/actions/calendar-connection-actions.ts)<br>`getMicrosoftAuthUrlAction` (src/app/actions/scheduler-actions.ts)<br>`getMicrosoftAuthUrl` (src/lib/services/integrations/microsoft-calendar.ts)<br>`getMicrosoftAuthUrl` (src/lib/services/integrations/microsoft-teams.ts) |
| `get:auth+google+url` | `getGoogleAuthUrlAction` (src/app/actions/calendar-connection-actions.ts)<br>`getGoogleAuthUrlAction` (src/app/actions/scheduler-actions.ts)<br>`getGoogleAuthUrl` (src/lib/services/integrations/google-calendar.ts) |
| `get:auth+url+zoom` | `getZoomAuthUrlAction` (src/app/actions/calendar-connection-actions.ts)<br>`getZoomAuthUrlAction` (src/app/actions/scheduler-actions.ts)<br>`getZoomAuthUrl` (src/lib/services/integrations/zoom-meeting.ts) |
| `promote:variant+winning` | `promoteWinningVariantAction` (src/app/actions/creative-experiment-actions.ts)<br>`promoteWinningVariantAction` (src/lib/forms/form-optimization-actions.ts)<br>`promoteWinningVariantAction` (src/lib/surveys/survey-experiment-actions.ts) |
| `send:invitation` | `dispatchInvitationsAction` (src/app/actions/workforce-actions.ts)<br>`resendInvitationAction` (src/app/actions/workforce-actions.ts)<br>`InvitationDispatchService` (src/lib/services/workforce/invitation-dispatch-service.ts) |
| `delete:tag` | `removeTagAction` (src/lib/scoped-tag-actions.ts)<br>`deleteTagAction` (src/lib/tag-actions.ts)<br>`removeTagsAction` (src/lib/tag-actions.ts) |
| `delete:saved+view` | `deleteSavedViewAction` (src/app/actions/analytics-actions.ts)<br>`deleteSavedViewAction` (src/app/actions/lead-intelligence-actions.ts) |
| `get:available+slot` | `getAvailableSlotsAction` (src/app/actions/booking-actions.ts)<br>`getAvailableSlotsAction` (src/app/actions/scheduler-actions.ts) |
| `create:offer` | `createOfferAction` (src/app/actions/commerce-actions.ts)<br>`createOffer` (src/lib/real-estate-actions.ts) |
| `update:post` | `updatePostAction` (src/app/actions/community-actions.ts)<br>`updatePostScheduleAction` (src/app/actions/social-composer-actions.ts) |
| `create:deal` | `createDeal` (src/app/actions/deal-actions.ts)<br>`createDeal` (src/lib/real-estate-actions.ts) |
| `update:deal` | `updateDealAction` (src/app/actions/deal-actions.ts)<br>`updateDeal` (src/lib/real-estate-actions.ts) |
| `create:task` | `createTaskAction` (src/app/actions/engagement-actions.ts)<br>`createTaskAction` (src/lib/task-server-actions.ts) |
| `update:task` | `updateTaskAction` (src/app/actions/engagement-actions.ts)<br>`updateTaskAction` (src/lib/task-server-actions.ts) |
| `delete:task` | `deleteTaskAction` (src/app/actions/engagement-actions.ts)<br>`deleteTaskAction` (src/lib/task-server-actions.ts) |
| `revoke:invitation` | `revokeInvitationAction` (src/app/actions/membership-actions.ts)<br>`revokeInvitationAction` (src/app/actions/workforce-actions.ts) |
| `create:product` | `createProductAction` (src/app/actions/product-actions.ts)<br>`createProductAction` (src/lib/product-actions.ts) |
| `update:product` | `updateProductAction` (src/app/actions/product-actions.ts)<br>`updateProductAction` (src/lib/product-actions.ts) |
| `send:message+test` | `sendTestMessageAction` (src/app/actions/scheduled-message-actions.ts)<br>`sendTestMessage` (src/lib/template-actions.ts) |
| `update:note` | `updateNote` (src/lib/activity-actions.ts)<br>`updateNotesDraftAction` (src/lib/call-centre-actions.ts) |
| `submit:approval+request` | `submitApprovalRequestAction` (src/lib/approval-actions.ts)<br>`submitApprovalRequestAction` (src/lib/governance-actions.ts) |
| `delete:contract` | `deleteContractAction` (src/lib/contract-actions.ts)<br>`purgeContractAction` (src/lib/pdf-actions.ts) |
| `update:form` | `saveFormDraftAction` (src/lib/forms/form-draft-actions.ts)<br>`updateFormAction` (src/lib/forms-actions.ts) |
| `apply:tag` | `applyTagAction` (src/lib/scoped-tag-actions.ts)<br>`applyTagsAction` (src/lib/tag-actions.ts) |
| `update:bulk+task` | `bulkUpdateTasks` (src/lib/task-actions.ts)<br>`bulkUpdateTasksAction` (src/lib/task-server-actions.ts) |
| `delete:bulk+task` | `bulkDeleteTasks` (src/lib/task-actions.ts)<br>`bulkDeleteTasksAction` (src/lib/task-server-actions.ts) |
| `resolve:credential+microsoft` | `resolveMicrosoftCredentials` (src/lib/services/integrations/microsoft-calendar.ts)<br>`resolveMicrosoftCredentials` (src/lib/services/integrations/microsoft-teams.ts) |
| `refresh:microsoft+token` | `refreshMicrosoftToken` (src/lib/services/integrations/microsoft-calendar.ts)<br>`refreshMicrosoftToken` (src/lib/services/integrations/microsoft-teams.ts) |

## Missing catalog tools (230)

`access.check_tool_policy`, `access.list_effective_permissions`, `access.request_elevation`, `ai.access_review.generate`, `ai.audit.search`, `ai.execution.get_receipt`, `ai.execution.get_status`, `ai.model.get_capabilities`, `ai.proposal.cancel`, `ai.proposal.get`, `ai.proposal.get_approvals`, `ai.proposal.request_approval`, `ai.proposal.simulate_impact`, `ai.role_advisor.get_recommendations`, `ai.usage.get_summary`, `ai.workforce_risk.get_findings`, `analytics.ask_data`, `analytics.compare_periods`, `analytics.explain_change`, `analytics.export_report`, `analytics.generate_executive_brief`, `analytics.get_campaign_report`, `analytics.get_finance_report`, `analytics.get_metric_definition`, `analytics.get_pipeline_report`, `analytics.get_sales_performance`, `analytics.get_survey_report`, `analytics.query_crm`, `automation.activate`, `automation.create_draft`, `automation.enroll_entity`, `automation.generate_draft`, `automation.get`, `automation.get_dead_letters`, `automation.get_run`, `automation.get_run_logs`, `automation.pause`, `automation.reconcile_run`, `automation.request_activation`, `automation.resume`, `automation.retry_step`, `automation.search`, `automation.simulate`, `automation.validate_graph`, `automation.validate_permissions`, `campaign.create_draft`, `campaign.generate_assets`, `campaign.generate_journey`, `campaign.generate_strategy`, `campaign.get_attribution`, `campaign.get_audience`, `campaign.get_recommendations`, `campaign.pause`, `campaign.propose_audience`, `campaign.record_outcome`, `campaign.request_launch_approval`, `campaign.simulate`, `campaign.update_draft`, `campaign.validate_audience`, `catalog.get_product`, `catalog.search_products`, `context.explain_inclusion`, `context.get_agent_memory`, `context.get_campaign_brief`, `context.get_deal_brief`, `context.get_entity_brief`, `context.get_shared_memory`, `context.validate_scope`, `creative.generate_copy_variants`, `creative.generate_page_draft`, `creative.generate_qr_design`, `creative.generate_seo_metadata`, `creative.generate_social_variants`, `creative.generate_thumbnail`, `creative.generate_visual_style`, `creative.get_asset_metadata`, `creative.get_brand_profile`, `creative.modify_canvas`, `creative.modify_page`, `creative.modify_thumbnail`, `creative.request_publish_approval`, `creative.search_assets`, `crm.activity.create`, `crm.entity.add_note`, `crm.entity.add_tag`, `crm.entity.assign_owner`, `crm.entity.find_duplicates`, `crm.entity.get_relationships`, `crm.entity.get_timeline`, `crm.entity.propose_merge`, `crm.entity.remove_tag`, `crm.entity.summarize_history`, `crm.pipeline.list`, `crm.stage.propose_transition`, `crm.workspace_entity.archive`, `crm.workspace_entity.create`, `deal.add_line_item`, `deal.advance_stage`, `deal.create_followup_tasks`, `deal.get_forecast`, `deal.get_line_items`, `deal.get_next_best_actions`, `deal.get_risks`, `deal.get_stage_history`, `deal.propose_stage_change`, `deal.remove_line_item`, `finance.account.get_balance`, `finance.collection.execute_action`, `finance.collection.propose_action`, `finance.invoice.create_draft`, `finance.invoice.issue`, `finance.invoice.search`, `finance.invoice.validate`, `finance.payment.execute_refund`, `finance.payment.propose_refund`, `finance.payment.reconcile`, `finance.payment.search`, `finance.receivables.get_aging`, `finance.revenue.get_summary`, `finance.subscription.change_plan`, `finance.subscription.get`, `form.map_pdf_fields`, `form.modify`, `form.search`, `form.validate`, `identity.get_current_actor`, `integration.calendar.check_availability`, `integration.calendar.list_events`, `integration.connection.revoke`, `integration.refresh_connection`, `integration.request_connection`, `integration.webhook.create_draft`, `integration.whatsapp.get_status`, `knowledge.access.check`, `knowledge.audit.search`, `knowledge.capture_observation`, `knowledge.classify_item`, `knowledge.deletion.request`, `knowledge.export.request`, `knowledge.extract_entities`, `knowledge.get_citations`, `knowledge.get_evidence`, `knowledge.get_recent_changes`, `knowledge.get_related_items`, `knowledge.get_source`, `knowledge.ingest_document`, `knowledge.ingest_meeting_outcome`, `knowledge.ingest_text`, `knowledge.propose_decision`, `knowledge.propose_fact`, `knowledge.propose_memory`, `knowledge.propose_procedure`, `knowledge.quality.evaluate`, `knowledge.reindex.request`, `knowledge.review_queue.decide`, `knowledge.review_queue.get`, `knowledge.review_queue.list`, `knowledge.search`, `knowledge.search_meetings`, `knowledge.search_playbooks`, `knowledge_graph.approve_relationship`, `knowledge_graph.flag_inconsistency`, `knowledge_graph.get_neighbors`, `knowledge_graph.get_provenance`, `knowledge_graph.get_relationships`, `knowledge_graph.propose_relationship`, `knowledge_graph.query_subgraph`, `knowledge_graph.rebuild_projection`, `knowledge_graph.search_entities`, `lead.enrich`, `lead.get_buying_signals`, `lead.get_decision_makers`, `lead.get_intelligence`, `lead.get_objection_handlers`, `lead.get_recommended_pitch`, `meeting.capture_decisions`, `meeting.check_availability`, `meeting.confirm_booking`, `meeting.create_followup_tasks`, `meeting.extract_action_items`, `meeting.ingest_transcript`, `meeting.link_to_crm`, `meeting.propose_booking`, `meeting.search`, `meeting.summarize`, `memory.approve`, `memory.archive`, `memory.get_history`, `memory.propose_update`, `memory.record_feedback`, `memory.reject`, `memory.restore`, `memory.review_expiry`, `memory.supersede`, `message.cancel_scheduled`, `message.check_compliance`, `message.create_draft`, `message.generate_draft`, `message.get_approval_status`, `message.get_delivery_status`, `message.get_engagement`, `message.get_template`, `message.get_unsubscribe_status`, `message.preview`, `message.refine_draft`, `message.request_approval`, `message.search_templates`, `message.unsubscribe_contact`, `message.validate_variables`, `organization.get_current`, `sdr.create_whatsapp_link`, `sdr.generate_outreach_draft`, `sdr.get_conversion_insights`, `sdr.get_daily_briefing`, `sdr.get_priority_queue`, `sdr.record_outreach_outcome`, `sdr.request_outreach_approval`, `survey.analyze_sentiment`, `survey.generate_report`, `survey.query_analytics`, `task.add_comment`, `task.assign`, `task.cancel`, `task.create_reminder`, `task.get_my_priorities`, `task.get_overdue`, `task.propose_batch_update`, `task.set_due_date`, `workspace.get_details`, `workspace.list_accessible`

## Unmapped existing capabilities (1832)

Existing actions/services with no suggested catalog tool. Each needs a tool, an internal-only decision, or an explicit exclusion.

| Capability | Domain | File |
| --- | --- | --- |
| `listAiActionProposalsAction` | `ai_governance` | src/app/actions/ai-admin-actions.ts |
| `approveAiProposalAction` | `ai_governance` | src/app/actions/ai-admin-actions.ts |
| `rejectAiProposalAction` | `ai_governance` | src/app/actions/ai-admin-actions.ts |
| `listAiExecutionAuditsAction` | `ai_governance` | src/app/actions/ai-admin-actions.ts |
| `generatePortalScaffoldAction` | `experience_portal` | src/app/actions/ai-experience-actions.ts |
| `generateCurriculumAction` | `experience_portal` | src/app/actions/ai-experience-actions.ts |
| `generateQuizAction` | `experience_portal` | src/app/actions/ai-experience-actions.ts |
| `askAiTutorAction` | `experience_portal` | src/app/actions/ai-experience-actions.ts |
| `getCoursePedagogyDiagnosticAction` | `experience_portal` | src/app/actions/ai-experience-actions.ts |
| `getAiWorkforceDashboardDataAction` | `lead_intelligence` | src/app/actions/ai-sales-workforce-actions.ts |
| `updateAgentAutonomyLevelAction` | `lead_intelligence` | src/app/actions/ai-sales-workforce-actions.ts |
| `executeAiRecommendationAction` | `lead_intelligence` | src/app/actions/ai-sales-workforce-actions.ts |
| `resolveAiApprovalAction` | `lead_intelligence` | src/app/actions/ai-sales-workforce-actions.ts |
| `runCrmHygieneScanAction` | `lead_intelligence` | src/app/actions/ai-sales-workforce-actions.ts |
| `executeCrmHygieneRepairAction` | `lead_intelligence` | src/app/actions/ai-sales-workforce-actions.ts |
| `toggleAiMasterKillSwitchAction` | `lead_intelligence` | src/app/actions/ai-sales-workforce-actions.ts |
| `reseedAiWorkforceDefaultsAction` | `lead_intelligence` | src/app/actions/ai-sales-workforce-actions.ts |
| `updateAiGovernancePolicyAction` | `lead_intelligence` | src/app/actions/ai-sales-workforce-actions.ts |
| `parseAndSuggestSlotsAction` | `crm_contacts` | src/app/actions/ai-scheduling-actions.ts |
| `confirmAIScheduledBookingAction` | `crm_contacts` | src/app/actions/ai-scheduling-actions.ts |
| `getPersonRiskScoreAction` | `lead_intelligence` | src/app/actions/ai-workforce-actions.ts |
| `getOrganizationRiskOverviewAction` | `lead_intelligence` | src/app/actions/ai-workforce-actions.ts |
| `listAiRecommendationsAction` | `lead_intelligence` | src/app/actions/ai-workforce-actions.ts |
| `generateAiRecommendationsAction` | `lead_intelligence` | src/app/actions/ai-workforce-actions.ts |
| `applyAiRecommendationAction` | `lead_intelligence` | src/app/actions/ai-workforce-actions.ts |
| `dismissAiRecommendationAction` | `lead_intelligence` | src/app/actions/ai-workforce-actions.ts |
| `ingestPlatformEventAction` | `analytics_reporting` | src/app/actions/analytics-actions.ts |
| `listPlatformEventsAction` | `analytics_reporting` | src/app/actions/analytics-actions.ts |
| `getWorkforceAdoptionMetricsAction` | `analytics_reporting` | src/app/actions/analytics-actions.ts |
| `getTeamLeaderboardAction` | `analytics_reporting` | src/app/actions/analytics-actions.ts |
| `getLeastPrivilegeReportAction` | `analytics_reporting` | src/app/actions/analytics-actions.ts |
| `listSavedDirectoryViewsAction` | `analytics_reporting` | src/app/actions/analytics-actions.ts |
| `createOrUpdateSavedViewAction` | `analytics_reporting` | src/app/actions/analytics-actions.ts |
| `deleteSavedViewAction` | `analytics_reporting` | src/app/actions/analytics-actions.ts |
| `getPermissionCatalogAction` | `identity_access` | src/app/actions/authorization-actions.ts |
| `createOrUpdateRoleAction` | `identity_access` | src/app/actions/authorization-actions.ts |
| `deleteRoleAction` | `identity_access` | src/app/actions/authorization-actions.ts |
| `explainUserAccessAction` | `identity_access` | src/app/actions/authorization-actions.ts |
| `simulateRolePermissionsAction` | `identity_access` | src/app/actions/authorization-actions.ts |
| `evaluateAccessAction` | `identity_access` | src/app/actions/authorization-actions.ts |
| `listRolesAction` | `identity_access` | src/app/actions/authorization-actions.ts |
| `fetchCandidateDealsForFER` | `deals_revenue` | src/app/actions/automated-deal-fer-actions.ts |
| `enrichDealData` | `deals_revenue` | src/app/actions/automated-deal-fer-actions.ts |
| `runAutomatedDealFERProtocol` | `deals_revenue` | src/app/actions/automated-deal-fer-actions.ts |
| `getDefaultAvailabilityProfileAction` | `crm_contacts` | src/app/actions/availability-actions.ts |
| `createAvailabilityProfileAction` | `crm_contacts` | src/app/actions/availability-actions.ts |
| `updateAvailabilityProfileAction` | `crm_contacts` | src/app/actions/availability-actions.ts |
| `deleteAvailabilityProfileAction` | `crm_contacts` | src/app/actions/availability-actions.ts |
| `fetchDealsForStageNameBackfill` | `deals_revenue` | src/app/actions/backfill-deal-stagename-action.ts |
| `enrichDealsWithStageName` | `deals_revenue` | src/app/actions/backfill-deal-stagename-action.ts |
| `restoreDealStageNameBackfill` | `deals_revenue` | src/app/actions/backfill-deal-stagename-action.ts |
| `rollbackDealStageNameBackfill` | `deals_revenue` | src/app/actions/backfill-deal-stagename-action.ts |
| `runDocumentCtaBackfillAction` | `crm_contacts` | src/app/actions/backfill-document-cta-action.ts |
| `backfillSenderOrgAction` | `crm_contacts` | src/app/actions/backfill-sender-org-action.ts |
| `getPublicBookingPageDataAction` | `crm_contacts` | src/app/actions/booking-actions.ts |
| `getAvailableSlotsAction` | `crm_contacts` | src/app/actions/booking-actions.ts |
| `acquireBookingHoldAction` | `crm_contacts` | src/app/actions/booking-actions.ts |
| `createBookingFromHoldAction` | `crm_contacts` | src/app/actions/booking-actions.ts |
| `cancelBookingAction` | `crm_contacts` | src/app/actions/booking-actions.ts |
| `rescheduleBookingAction` | `crm_contacts` | src/app/actions/booking-actions.ts |
| `getWorkspaceBrandKitAction` | `crm_contacts` | src/app/actions/brand-kit-actions.ts |
| `saveWorkspaceBrandKitAction` | `crm_contacts` | src/app/actions/brand-kit-actions.ts |
| `bulkCreateDealsActionCore` | `deals_revenue` | src/app/actions/bulk-deal-actions.ts |
| `bulkRegisterParticipantsActionCore` | `meetings_conversations` | src/app/actions/bulk-meeting-actions.ts |
| `bulkRegisterParticipantsAction` | `meetings_conversations` | src/app/actions/bulk-meeting-actions.ts |
| `bulkPushWhatsAppSkeletonsAction` | `communication_messaging` | src/app/actions/bulk-push-whatsapp-skeletons-action.ts |
| `bulkCreateTasksActionCore` | `tasks_productivity` | src/app/actions/bulk-task-actions.ts |
| `getCalendarConnectionsAction` | `meetings_conversations` | src/app/actions/calendar-connection-actions.ts |
| `disconnectCalendarConnectionAction` | `meetings_conversations` | src/app/actions/calendar-connection-actions.ts |
| `toggleCalendarConflictCheckAction` | `meetings_conversations` | src/app/actions/calendar-connection-actions.ts |
| `setPrimarySyncCalendarAction` | `meetings_conversations` | src/app/actions/calendar-connection-actions.ts |
| `syncBookingToExternalCalendarAction` | `meetings_conversations` | src/app/actions/calendar-connection-actions.ts |
| `getGoogleAuthUrlAction` | `meetings_conversations` | src/app/actions/calendar-connection-actions.ts |
| `getMicrosoftAuthUrlAction` | `meetings_conversations` | src/app/actions/calendar-connection-actions.ts |
| `getZoomAuthUrlAction` | `meetings_conversations` | src/app/actions/calendar-connection-actions.ts |
| `saveWorkspaceOAuthCredentialsAction` | `meetings_conversations` | src/app/actions/calendar-connection-actions.ts |
| `clearWorkspaceOAuthCredentialsAction` | `meetings_conversations` | src/app/actions/calendar-connection-actions.ts |
| `saveOrganizationOAuthCredentialsAction` | `meetings_conversations` | src/app/actions/calendar-connection-actions.ts |
| `getWorkspaceOAuthCredentialsStatusAction` | `meetings_conversations` | src/app/actions/calendar-connection-actions.ts |
| `getOrganizationOAuthCredentialsStatusAction` | `meetings_conversations` | src/app/actions/calendar-connection-actions.ts |
| `fetchEntitiesWithCustomData` | `crm_contacts` | src/app/actions/cleanup-entity-customdata-action.ts |
| `cleanupEntityCustomData` | `crm_contacts` | src/app/actions/cleanup-entity-customdata-action.ts |
| `validateCustomDataCleanup` | `crm_contacts` | src/app/actions/cleanup-entity-customdata-action.ts |
| `clearAllImportLogsAction` | `crm_contacts` | src/app/actions/clear-import-logs-action.ts |
| `createOfferAction` | `finance_subscriptions` | src/app/actions/commerce-actions.ts |
| `updateOfferAction` | `finance_subscriptions` | src/app/actions/commerce-actions.ts |
| `deleteOfferAction` | `finance_subscriptions` | src/app/actions/commerce-actions.ts |
| `listOffersByPortalAction` | `finance_subscriptions` | src/app/actions/commerce-actions.ts |
| `createCouponAction` | `finance_subscriptions` | src/app/actions/commerce-actions.ts |
| `deleteCouponAction` | `finance_subscriptions` | src/app/actions/commerce-actions.ts |
| `listCouponsByPortalAction` | `finance_subscriptions` | src/app/actions/commerce-actions.ts |
| `validateCouponAction` | `finance_subscriptions` | src/app/actions/commerce-actions.ts |
| `processCheckoutOrderAction` | `finance_subscriptions` | src/app/actions/commerce-actions.ts |
| `listOrdersByPortalAction` | `finance_subscriptions` | src/app/actions/commerce-actions.ts |
| `registerAffiliatePartnerAction` | `finance_subscriptions` | src/app/actions/commerce-actions.ts |
| `listAffiliatesByPortalAction` | `finance_subscriptions` | src/app/actions/commerce-actions.ts |
| `updateAffiliatePartnerStatusAction` | `finance_subscriptions` | src/app/actions/commerce-actions.ts |
| `joinPortalWaitlistAction` | `finance_subscriptions` | src/app/actions/commerce-actions.ts |
| `createSpaceAction` | `experience_portal` | src/app/actions/community-actions.ts |
| `updateSpaceAction` | `experience_portal` | src/app/actions/community-actions.ts |
| `deleteSpaceAction` | `experience_portal` | src/app/actions/community-actions.ts |
| `listSpacesByPortalAction` | `experience_portal` | src/app/actions/community-actions.ts |
| `createPostAction` | `experience_portal` | src/app/actions/community-actions.ts |
| `updatePostAction` | `experience_portal` | src/app/actions/community-actions.ts |
| `deletePostAction` | `experience_portal` | src/app/actions/community-actions.ts |
| `togglePinPostAction` | `experience_portal` | src/app/actions/community-actions.ts |
| `createCommentAction` | `experience_portal` | src/app/actions/community-actions.ts |
| `deleteCommentAction` | `experience_portal` | src/app/actions/community-actions.ts |
| `castPollVoteAction` | `experience_portal` | src/app/actions/community-actions.ts |
| `toggleReactionAction` | `experience_portal` | src/app/actions/community-actions.ts |
| `reportContentAction` | `experience_portal` | src/app/actions/community-actions.ts |
| `listModerationReportsAction` | `experience_portal` | src/app/actions/community-actions.ts |
| `resolveModerationReportAction` | `experience_portal` | src/app/actions/community-actions.ts |
| `listLessonPostsAction` | `experience_portal` | src/app/actions/community-actions.ts |
| `getCommunityLeaderboardAction` | `experience_portal` | src/app/actions/community-actions.ts |
| `seedCommunitySpacesAction` | `experience_portal` | src/app/actions/community-actions.ts |
| `getMemberPublicProfileAction` | `experience_portal` | src/app/actions/community-actions.ts |
| `getConferenceSessionAction` | `crm_contacts` | src/app/actions/conference-session-actions.ts |
| `createOrUpdateConferenceSessionAction` | `crm_contacts` | src/app/actions/conference-session-actions.ts |
| `createContentItemAction` | `crm_contacts` | src/app/actions/content-actions.ts |
| `updateContentItemAction` | `crm_contacts` | src/app/actions/content-actions.ts |
| `publishContentItemAction` | `crm_contacts` | src/app/actions/content-actions.ts |
| `archiveContentItemAction` | `crm_contacts` | src/app/actions/content-actions.ts |
| `deleteContentItemAction` | `crm_contacts` | src/app/actions/content-actions.ts |
| `getContentItemBySlugAction` | `crm_contacts` | src/app/actions/content-actions.ts |
| `searchPortalContentAction` | `crm_contacts` | src/app/actions/content-actions.ts |
| `listContentItemsByPortalAction` | `crm_contacts` | src/app/actions/content-actions.ts |
| `createPortalContentTemplateAction` | `crm_contacts` | src/app/actions/content-actions.ts |
| `listPortalContentTemplatesAction` | `crm_contacts` | src/app/actions/content-actions.ts |
| `getCoachingWorkspaceAction` | `crm_contacts` | src/app/actions/conversation-coaching-actions.ts |
| `getCallIntelligenceDetailAction` | `crm_contacts` | src/app/actions/conversation-coaching-actions.ts |
| `submitManualScorecardReviewAction` | `crm_contacts` | src/app/actions/conversation-coaching-actions.ts |
| `startRoleplaySessionAction` | `crm_contacts` | src/app/actions/conversation-coaching-actions.ts |
| `submitRoleplayTurnAction` | `crm_contacts` | src/app/actions/conversation-coaching-actions.ts |
| `assignCoachingDrillAction` | `crm_contacts` | src/app/actions/conversation-coaching-actions.ts |
| `getTeamCoachingOverviewAction` | `crm_contacts` | src/app/actions/conversation-coaching-actions.ts |
| `saveScorecardTemplateAction` | `crm_contacts` | src/app/actions/conversation-coaching-actions.ts |
| `savePracticeScenarioAction` | `crm_contacts` | src/app/actions/conversation-coaching-actions.ts |
| `runCoachingMigrationAction` | `crm_contacts` | src/app/actions/conversation-coaching-actions.ts |
| `listProjectConceptsAction` | `crm_contacts` | src/app/actions/creative-ai-actions.ts |
| `executeAiCanvasCommandAction` | `crm_contacts` | src/app/actions/creative-ai-actions.ts |
| `generateCopyVariationsAction` | `crm_contacts` | src/app/actions/creative-ai-actions.ts |
| `submitProjectForReviewAction` | `crm_contacts` | src/app/actions/creative-collab-actions.ts |
| `approveCreativeProjectAction` | `crm_contacts` | src/app/actions/creative-collab-actions.ts |
| `requestProjectChangesAction` | `crm_contacts` | src/app/actions/creative-collab-actions.ts |
| `listProjectsPendingApprovalAction` | `crm_contacts` | src/app/actions/creative-collab-actions.ts |
| `addCanvasPinCommentAction` | `crm_contacts` | src/app/actions/creative-collab-actions.ts |
| `addCommentReplyAction` | `crm_contacts` | src/app/actions/creative-collab-actions.ts |
| `listProjectCommentsAction` | `crm_contacts` | src/app/actions/creative-comment-actions.ts |
| `addProjectCommentAction` | `crm_contacts` | src/app/actions/creative-comment-actions.ts |
| `resolveProjectCommentAction` | `crm_contacts` | src/app/actions/creative-comment-actions.ts |
| `deleteProjectCommentAction` | `crm_contacts` | src/app/actions/creative-comment-actions.ts |
| `linkCreativeToCrmCampaignAction` | `crm_contacts` | src/app/actions/creative-crm-actions.ts |
| `getCrmContactPreviewDataAction` | `crm_contacts` | src/app/actions/creative-crm-actions.ts |
| `generateBatchPersonalizedCreativesAction` | `crm_contacts` | src/app/actions/creative-crm-actions.ts |
| `createCreativeExperimentAction` | `crm_contacts` | src/app/actions/creative-experiment-actions.ts |
| `listProjectExperimentsAction` | `crm_contacts` | src/app/actions/creative-experiment-actions.ts |
| `promoteWinningVariantAction` | `crm_contacts` | src/app/actions/creative-experiment-actions.ts |
| `getProjectPerformanceMetricsAction` | `forms_surveys` | src/app/actions/creative-performance-actions.ts |
| `exportHighResolutionAssetAction` | `forms_surveys` | src/app/actions/creative-performance-actions.ts |
| `createCreativeProjectAction` | `crm_contacts` | src/app/actions/creative-project-actions.ts |
| `updateCreativeProjectAction` | `crm_contacts` | src/app/actions/creative-project-actions.ts |
| `getCreativeProjectWithDocumentAction` | `crm_contacts` | src/app/actions/creative-project-actions.ts |
| `saveCreativeDocumentAction` | `crm_contacts` | src/app/actions/creative-project-actions.ts |
| `createVersionSnapshotAction` | `crm_contacts` | src/app/actions/creative-project-actions.ts |
| `listCreativeVersionsAction` | `crm_contacts` | src/app/actions/creative-project-actions.ts |
| `deleteCreativeProjectAction` | `crm_contacts` | src/app/actions/creative-project-actions.ts |
| `scheduleCreativePublicationAction` | `crm_contacts` | src/app/actions/creative-publishing-actions.ts |
| `listPublicationHistoryAction` | `crm_contacts` | src/app/actions/creative-publishing-actions.ts |
| `listCreativeTemplatesAction` | `crm_contacts` | src/app/actions/creative-template-actions.ts |
| `createProjectFromTemplateAction` | `crm_contacts` | src/app/actions/creative-template-actions.ts |
| `saveCanvasAsTemplateAction` | `crm_contacts` | src/app/actions/creative-template-actions.ts |
| `seedDefaultTemplatesAction` | `crm_contacts` | src/app/actions/creative-template-actions.ts |
| `createCertificateTemplateAction` | `experience_portal` | src/app/actions/credential-actions.ts |
| `listCertificateTemplatesAction` | `experience_portal` | src/app/actions/credential-actions.ts |
| `issueCertificateAction` | `experience_portal` | src/app/actions/credential-actions.ts |
| `verifyCertificateAction` | `experience_portal` | src/app/actions/credential-actions.ts |
| `revokeCertificateAction` | `experience_portal` | src/app/actions/credential-actions.ts |
| `listIssuedCertificatesAction` | `experience_portal` | src/app/actions/credential-actions.ts |
| `exportOpenBadgeAction` | `experience_portal` | src/app/actions/credential-actions.ts |
| `listXApiStatementsAction` | `experience_portal` | src/app/actions/credential-actions.ts |
| `createBadgeDefinitionAction` | `experience_portal` | src/app/actions/credential-actions.ts |
| `listBadgeDefinitionsAction` | `experience_portal` | src/app/actions/credential-actions.ts |
| `getPersonCrmWorkloadAction` | `lead_intelligence` | src/app/actions/crm-workforce-actions.ts |
| `getOrganizationCrmWorkloadOverviewAction` | `lead_intelligence` | src/app/actions/crm-workforce-actions.ts |
| `transferOwnershipAction` | `lead_intelligence` | src/app/actions/crm-workforce-actions.ts |
| `listOwnershipTransferJobsAction` | `lead_intelligence` | src/app/actions/crm-workforce-actions.ts |
| `checkOffboardingReadinessAction` | `lead_intelligence` | src/app/actions/crm-workforce-actions.ts |
| `getSaasMetrics` | `analytics_reporting` | src/app/actions/dashboard-actions.ts |
| `getUpcomingMeetingsData` | `analytics_reporting` | src/app/actions/dashboard-actions.ts |
| `getLatestSurveysData` | `analytics_reporting` | src/app/actions/dashboard-actions.ts |
| `getRecentActivitiesData` | `analytics_reporting` | src/app/actions/dashboard-actions.ts |
| `resolveWorkspaceEntityRecord` | `deals_revenue` | src/app/actions/deal-actions.ts |
| `updateDealValueAction` | `deals_revenue` | src/app/actions/deal-actions.ts |
| `updateDealProbabilityAction` | `deals_revenue` | src/app/actions/deal-actions.ts |
| `updateDealStatusAction` | `deals_revenue` | src/app/actions/deal-actions.ts |
| `updateDealOwnerAction` | `deals_revenue` | src/app/actions/deal-actions.ts |
| `updateDealDetailsAction` | `deals_revenue` | src/app/actions/deal-actions.ts |
| `addDealContactAction` | `deals_revenue` | src/app/actions/deal-actions.ts |
| `removeDealContactAction` | `deals_revenue` | src/app/actions/deal-actions.ts |
| `clearStageDealsAction` | `deals_revenue` | src/app/actions/deal-actions.ts |
| `deleteDealAction` | `deals_revenue` | src/app/actions/deal-actions.ts |
| `cleanLegacyDealNamesAction` | `deals_revenue` | src/app/actions/deal-actions.ts |
| `updateStageOrdersAction` | `deals_revenue` | src/app/actions/deal-actions.ts |
| `bulkUpdateDealsStageAction` | `deals_revenue` | src/app/actions/deal-actions.ts |
| `bulkAssignDealsAction` | `deals_revenue` | src/app/actions/deal-actions.ts |
| `bulkDeleteDealsAction` | `deals_revenue` | src/app/actions/deal-actions.ts |
| `duplicateDealAction` | `deals_revenue` | src/app/actions/deal-actions.ts |
| `archiveDealAction` | `deals_revenue` | src/app/actions/deal-actions.ts |
| `unarchiveDealAction` | `deals_revenue` | src/app/actions/deal-actions.ts |
| `bulkArchiveDealsAction` | `deals_revenue` | src/app/actions/deal-actions.ts |
| `mergeDealsAction` | `deals_revenue` | src/app/actions/deal-actions.ts |
| `convertLeadToDealAction` | `deals_revenue` | src/app/actions/deal-actions.ts |
| `logDealInteractionAction` | `deals_revenue` | src/app/actions/deal-actions.ts |
| `evaluateAndAdvanceDealOnMeetingAction` | `deals_revenue` | src/app/actions/deal-advancer-actions.ts |
| `generateDealAiInsightsAction` | `deals_revenue` | src/app/actions/deal-ai-actions.ts |
| `savePipelineTargetAction` | `deals_revenue` | src/app/actions/deal-analytics-actions.ts |
| `deletePipelineTargetAction` | `deals_revenue` | src/app/actions/deal-analytics-actions.ts |
| `createDealBulkJobAction` | `deals_revenue` | src/app/actions/deal-bulk-job-actions.ts |
| `processDealBulkJob` | `deals_revenue` | src/app/actions/deal-bulk-job-actions.ts |
| `getDealBulkJobStatusAction` | `deals_revenue` | src/app/actions/deal-bulk-job-actions.ts |
| `getDealHealthDetailAction` | `deals_revenue` | src/app/actions/deal-intelligence-actions.ts |
| `actionBuyerSignalAction` | `deals_revenue` | src/app/actions/deal-intelligence-actions.ts |
| `saveStakeholderMapAction` | `deals_revenue` | src/app/actions/deal-intelligence-actions.ts |
| `submitPostMeetingIntelligenceAction` | `deals_revenue` | src/app/actions/deal-intelligence-actions.ts |
| `saveDealIntelligenceGovernanceAction` | `deals_revenue` | src/app/actions/deal-intelligence-actions.ts |
| `executeDealIntelligenceMigrationAction` | `deals_revenue` | src/app/actions/deal-intelligence-actions.ts |
| `createDealQuoteAction` | `deals_revenue` | src/app/actions/deal-line-item-actions.ts |
| `getPublicQuoteByTokenAction` | `deals_revenue` | src/app/actions/deal-line-item-actions.ts |
| `updateQuoteStatusAction` | `deals_revenue` | src/app/actions/deal-line-item-actions.ts |
| `acceptPublicQuoteAction` | `deals_revenue` | src/app/actions/deal-line-item-actions.ts |
| `convertQuoteToInvoiceAction` | `deals_revenue` | src/app/actions/deal-line-item-actions.ts |
| `deleteDealQuoteAction` | `deals_revenue` | src/app/actions/deal-line-item-actions.ts |
| `executeDealMigration` | `deals_revenue` | src/app/actions/deal-migration-actions.ts |
| `createDealSavedViewAction` | `deals_revenue` | src/app/actions/deal-saved-view-actions.ts |
| `updateDealSavedViewAction` | `deals_revenue` | src/app/actions/deal-saved-view-actions.ts |
| `deleteDealSavedViewAction` | `deals_revenue` | src/app/actions/deal-saved-view-actions.ts |
| `saveContentStudioDraftAction` | `crm_contacts` | src/app/actions/draft-actions.ts |
| `getContentStudioDraftAction` | `crm_contacts` | src/app/actions/draft-actions.ts |
| `discardContentStudioDraftAction` | `crm_contacts` | src/app/actions/draft-actions.ts |
| `listContentStudioDraftsByPortalAction` | `crm_contacts` | src/app/actions/draft-actions.ts |
| `saveOnboardingFlowAction` | `crm_contacts` | src/app/actions/engagement-actions.ts |
| `getOnboardingFlowAction` | `crm_contacts` | src/app/actions/engagement-actions.ts |
| `advanceOnboardingStepAction` | `crm_contacts` | src/app/actions/engagement-actions.ts |
| `reconcileOnboardingAction` | `crm_contacts` | src/app/actions/engagement-actions.ts |
| `recordOrientationWatchedAction` | `crm_contacts` | src/app/actions/engagement-actions.ts |
| `deleteTaskAction` | `crm_contacts` | src/app/actions/engagement-actions.ts |
| `submitTaskAction` | `crm_contacts` | src/app/actions/engagement-actions.ts |
| `reviewTaskSubmissionAction` | `crm_contacts` | src/app/actions/engagement-actions.ts |
| `listPendingSubmissionsAction` | `crm_contacts` | src/app/actions/engagement-actions.ts |
| `logMemberActivityAction` | `crm_contacts` | src/app/actions/engagement-actions.ts |
| `evaluatePortalInactivityAction` | `crm_contacts` | src/app/actions/engagement-actions.ts |
| `enrichWorkspaceEntitiesContactsAction` | `identity_access` | src/app/actions/enrich-workspace-entities-contacts-action.ts |
| `saveEnterpriseSsoAction` | `crm_contacts` | src/app/actions/enterprise-actions.ts |
| `getEnterpriseSsoAction` | `crm_contacts` | src/app/actions/enterprise-actions.ts |
| `saveWhiteLabelConfigAction` | `crm_contacts` | src/app/actions/enterprise-actions.ts |
| `getWhiteLabelConfigAction` | `crm_contacts` | src/app/actions/enterprise-actions.ts |
| `createHierarchyNodeAction` | `crm_contacts` | src/app/actions/enterprise-actions.ts |
| `listHierarchyNodesAction` | `crm_contacts` | src/app/actions/enterprise-actions.ts |
| `listMarketplaceListingsAction` | `crm_contacts` | src/app/actions/enterprise-actions.ts |
| `installMarketplaceTemplateAction` | `crm_contacts` | src/app/actions/enterprise-actions.ts |
| `listEnterpriseAuditLogsAction` | `crm_contacts` | src/app/actions/enterprise-actions.ts |
| `getEnterpriseIdpConfigAction` | `crm_contacts` | src/app/actions/enterprise-identity-actions.ts |
| `saveEnterpriseIdpConfigAction` | `crm_contacts` | src/app/actions/enterprise-identity-actions.ts |
| `saveMfaPolicyAction` | `crm_contacts` | src/app/actions/enterprise-identity-actions.ts |
| `getDirectorySyncConfigAction` | `crm_contacts` | src/app/actions/enterprise-identity-actions.ts |
| `saveDirectorySyncConfigAction` | `crm_contacts` | src/app/actions/enterprise-identity-actions.ts |
| `listDirectorySyncLogsAction` | `crm_contacts` | src/app/actions/enterprise-identity-actions.ts |
| `getEnterpriseSessionConfigAction` | `crm_contacts` | src/app/actions/enterprise-identity-actions.ts |
| `saveEnterpriseSessionConfigAction` | `crm_contacts` | src/app/actions/enterprise-identity-actions.ts |
| `getEntityDealDefaultsAction` | `crm_contacts` | src/app/actions/entity-contact-actions.ts |
| `generateEntityDossierSummaryAction` | `crm_contacts` | src/app/actions/entity-dossier-actions.ts |
| `fetchEntitiesForSchemaRestructure` | `crm_contacts` | src/app/actions/entity-schema-restructure-actions.ts |
| `enrichEntitiesWithNewSchema` | `crm_contacts` | src/app/actions/entity-schema-restructure-actions.ts |
| `restoreEntitySchemaRestructure` | `crm_contacts` | src/app/actions/entity-schema-restructure-actions.ts |
| `rollbackEntitySchemaRestructure` | `crm_contacts` | src/app/actions/entity-schema-restructure-actions.ts |
| `createLiveEventAction` | `crm_contacts` | src/app/actions/event-actions.ts |
| `updateLiveEventAction` | `crm_contacts` | src/app/actions/event-actions.ts |
| `deleteLiveEventAction` | `crm_contacts` | src/app/actions/event-actions.ts |
| `listLiveEventsByPortalAction` | `crm_contacts` | src/app/actions/event-actions.ts |
| `listCohortsByPortalAction` | `crm_contacts` | src/app/actions/event-actions.ts |
| `registerForEventAction` | `crm_contacts` | src/app/actions/event-actions.ts |
| `cancelEventRegistrationAction` | `crm_contacts` | src/app/actions/event-actions.ts |
| `recordEventAttendanceAction` | `crm_contacts` | src/app/actions/event-actions.ts |
| `recordJoinSessionAction` | `crm_contacts` | src/app/actions/event-actions.ts |
| `recordLeaveSessionAction` | `crm_contacts` | src/app/actions/event-actions.ts |
| `publishEventReplayAction` | `crm_contacts` | src/app/actions/event-actions.ts |
| `attachReplayToCourseLessonAction` | `crm_contacts` | src/app/actions/event-actions.ts |
| `createCohortAction` | `crm_contacts` | src/app/actions/event-actions.ts |
| `updateCohortAction` | `crm_contacts` | src/app/actions/event-actions.ts |
| `deleteCohortAction` | `crm_contacts` | src/app/actions/event-actions.ts |
| `enrollCohortMemberAction` | `crm_contacts` | src/app/actions/event-actions.ts |
| `removeCohortMemberAction` | `crm_contacts` | src/app/actions/event-actions.ts |
| `listCohortMembersAction` | `crm_contacts` | src/app/actions/event-actions.ts |
| `getUniqueEventTypeSlug` | `crm_contacts` | src/app/actions/event-type-actions.ts |
| `createEventTypeAction` | `crm_contacts` | src/app/actions/event-type-actions.ts |
| `updateEventTypeAction` | `crm_contacts` | src/app/actions/event-type-actions.ts |
| `deleteEventTypeAction` | `crm_contacts` | src/app/actions/event-type-actions.ts |
| `duplicateEventTypeAction` | `crm_contacts` | src/app/actions/event-type-actions.ts |
| `toggleEventTypeStatusAction` | `crm_contacts` | src/app/actions/event-type-actions.ts |
| `getEventTypesAction` | `crm_contacts` | src/app/actions/event-type-actions.ts |
| `executeVariablesFERMigrationAction` | `crm_contacts` | src/app/actions/execute-variables-fer-migration-action.ts |
| `executeFixOrgAdminPermissionsFerAction` | `identity_access` | src/app/actions/fix-org-admin-permissions-fer-action.ts |
| `getFilteredTemplatesAction` | `crm_contacts` | src/app/actions/get-filtered-templates-action.ts |
| `createAccessReviewCampaignAction` | `ai_governance` | src/app/actions/governance-actions.ts |
| `submitReviewDecisionAction` | `ai_governance` | src/app/actions/governance-actions.ts |
| `listAccessReviewCampaignsAction` | `ai_governance` | src/app/actions/governance-actions.ts |
| `grantTemporaryAccessAction` | `ai_governance` | src/app/actions/governance-actions.ts |
| `revokeTemporaryAccessAction` | `ai_governance` | src/app/actions/governance-actions.ts |
| `reapExpiredGrantsAction` | `ai_governance` | src/app/actions/governance-actions.ts |
| `listTemporaryAccessGrantsAction` | `ai_governance` | src/app/actions/governance-actions.ts |
| `createOrUpdateSoDRuleAction` | `ai_governance` | src/app/actions/governance-actions.ts |
| `deleteSoDRuleAction` | `ai_governance` | src/app/actions/governance-actions.ts |
| `listSoDRulesAction` | `ai_governance` | src/app/actions/governance-actions.ts |
| `scanSoDConflictsAction` | `ai_governance` | src/app/actions/governance-actions.ts |
| `revokeSessionAction` | `ai_governance` | src/app/actions/governance-actions.ts |
| `revokeAllSessionsAction` | `ai_governance` | src/app/actions/governance-actions.ts |
| `listSessionsAction` | `ai_governance` | src/app/actions/governance-actions.ts |
| `updateSecurityPolicyAction` | `ai_governance` | src/app/actions/governance-actions.ts |
| `listSecurityAuditEventsAction` | `ai_governance` | src/app/actions/governance-actions.ts |
| `generateHeadlineVariationsAction` | `crm_contacts` | src/app/actions/headline-iq-actions.ts |
| `getPeopleDirectoryAction` | `crm_contacts` | src/app/actions/identity-actions.ts |
| `getPersonDetailAction` | `crm_contacts` | src/app/actions/identity-actions.ts |
| `updatePersonProfileAction` | `crm_contacts` | src/app/actions/identity-actions.ts |
| `updateMembershipStatusAction` | `crm_contacts` | src/app/actions/identity-actions.ts |
| `manageWorkspaceMembershipsAction` | `crm_contacts` | src/app/actions/identity-actions.ts |
| `invitePersonAction` | `crm_contacts` | src/app/actions/identity-actions.ts |
| `reconcileOrganizationIdentitiesAction` | `crm_contacts` | src/app/actions/identity-actions.ts |
| `fetchSchoolsForSaaSMigration` | `crm_contacts` | src/app/actions/industry-migration-actions.ts |
| `enrichSchoolsWithSaaSIndustry` | `crm_contacts` | src/app/actions/industry-migration-actions.ts |
| `restoreSaaSMigration` | `crm_contacts` | src/app/actions/industry-migration-actions.ts |
| `rollbackSaaSMigration` | `crm_contacts` | src/app/actions/industry-migration-actions.ts |
| `getKnowledgeGraphGovernanceAction` | `ai_governance` | src/app/actions/knowledge-graph-governance-actions.ts |
| `updateKnowledgeGraphGovernanceAction` | `ai_governance` | src/app/actions/knowledge-graph-governance-actions.ts |
| `getKnowledgeGraphMetricsAction` | `ai_governance` | src/app/actions/knowledge-graph-governance-actions.ts |
| `triggerBackfillCrmRelationsAction` | `ai_governance` | src/app/actions/knowledge-graph-governance-actions.ts |
| `resetKnowledgeGraphGovernanceAction` | `ai_governance` | src/app/actions/knowledge-graph-governance-actions.ts |
| `getLeadSettingsAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `saveLeadSettingsAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `parseNaturalLanguageQueryAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `searchProspectsAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `enrichProspectAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `batchEnrichProspectsAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `importProspectsFromCSVAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `syncProspectToCRMAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `batchSyncProspectsAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `getRecentProspectsAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `saveSearchAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `getSavedSearchesAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `addProspectsToListAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `previewEnrichmentCostAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `saveViewAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `getSavedViewsAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `deleteSavedViewAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `getIdentityCollisionsAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `scanWorkspaceForCollisionsAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `executeIdentityMergeAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `dismissCollisionAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `probeDomainSubdomainsAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `enrichTechnographicsDeepAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `getEnrichmentDimensionsAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `verifyProspectEmailAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `bulkVerifyProspectEmailsAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `generateAIResearchDossierAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `getAIResearchDossierAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `getWorkspaceSignalsAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `getProspectSignalsAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `getAccountMonitoringConfigAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `saveAccountMonitoringConfigAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `markSignalReadAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `dismissSignalAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `triggerProspectDeltaScanAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `getWorkspaceScoringModelAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `saveWorkspaceScoringModelAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `simulateScoringModelAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `recalculateWorkspaceScoresAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `getProspectScoreHistoryAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `checkProspectCRMMatchAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `enrichExistingCRMRecordAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `getUnifiedActivityTimelineAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `getWorkspaceSegmentsAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `saveDynamicSegmentAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `deleteDynamicSegmentAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `evaluateSegmentCountAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `saveProspectingCampaignAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `executeDataRemediationAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `getDailyRepBriefingAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `executeProspectActivationAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `generateAIOutreachDraftAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `getIntelligenceInboxAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `getPredictiveConversionAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `getEnterpriseGovernanceConfigAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `saveEnterpriseGovernanceConfigAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `getProviderHealthStatusAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `getCreditLedgerSummaryAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `executeEnterpriseDataImportAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `regenerateExtensionTokenAction` | `lead_intelligence` | src/app/actions/lead-intelligence-actions.ts |
| `createCourseAction` | `experience_portal` | src/app/actions/learning-actions.ts |
| `updateCourseAction` | `experience_portal` | src/app/actions/learning-actions.ts |
| `deleteCourseAction` | `experience_portal` | src/app/actions/learning-actions.ts |
| `listCoursesByPortalAction` | `experience_portal` | src/app/actions/learning-actions.ts |
| `createModuleAction` | `experience_portal` | src/app/actions/learning-actions.ts |
| `updateModuleAction` | `experience_portal` | src/app/actions/learning-actions.ts |
| `deleteModuleAction` | `experience_portal` | src/app/actions/learning-actions.ts |
| `createLessonAction` | `experience_portal` | src/app/actions/learning-actions.ts |
| `updateLessonAction` | `experience_portal` | src/app/actions/learning-actions.ts |
| `deleteLessonAction` | `experience_portal` | src/app/actions/learning-actions.ts |
| `listLessonsByCourseAction` | `experience_portal` | src/app/actions/learning-actions.ts |
| `enrollInCourseAction` | `experience_portal` | src/app/actions/learning-actions.ts |
| `completeLessonAction` | `experience_portal` | src/app/actions/learning-actions.ts |
| `recordVideoProgressAction` | `experience_portal` | src/app/actions/learning-actions.ts |
| `submitAssessmentAction` | `experience_portal` | src/app/actions/learning-actions.ts |
| `submitAssignmentAction` | `experience_portal` | src/app/actions/learning-actions.ts |
| `getSanitizedAssessmentAction` | `experience_portal` | src/app/actions/learning-actions.ts |
| `getLinkMetadataAction` | `crm_contacts` | src/app/actions/link-metadata-actions.ts |
| `getManagerCommandOverviewAction` | `crm_contacts` | src/app/actions/manager-command-actions.ts |
| `executeManagerInterventionAction` | `crm_contacts` | src/app/actions/manager-command-actions.ts |
| `rebalanceTeamWorkloadAction` | `crm_contacts` | src/app/actions/manager-command-actions.ts |
| `generateRepCoachingBriefAction` | `crm_contacts` | src/app/actions/manager-command-actions.ts |
| `runSalesTeamMigrationAction` | `crm_contacts` | src/app/actions/manager-command-actions.ts |
| `getBackofficeSalesTeamsAction` | `crm_contacts` | src/app/actions/manager-command-actions.ts |
| `saveSalesTeamConfigAction` | `crm_contacts` | src/app/actions/manager-command-actions.ts |
| `updateAgentCapacityAction` | `crm_contacts` | src/app/actions/manager-command-actions.ts |
| `removeImageBackgroundAction` | `media_creative` | src/app/actions/media-actions.ts |
| `approveAndSyncActionItemAction` | `meetings_conversations` | src/app/actions/meeting-action-items-actions.ts |
| `getMeetingsOperationalOverviewAction` | `meetings_conversations` | src/app/actions/meeting-analytics-actions.ts |
| `logMeetingAttendance` | `school_operations` | src/app/actions/meeting-attendance-actions.ts |
| `validateRegistrantToken` | `school_operations` | src/app/actions/meeting-attendance-actions.ts |
| `toggleRegistrantAttendance` | `school_operations` | src/app/actions/meeting-attendance-actions.ts |
| `bulkRescheduleMeetingsAction` | `meetings_conversations` | src/app/actions/meeting-bulk-actions.ts |
| `overrideSeriesInstanceAction` | `meetings_conversations` | src/app/actions/meeting-bulk-actions.ts |
| `getWorkspaceCalendarEventsAction` | `meetings_conversations` | src/app/actions/meeting-calendar-actions.ts |
| `quickScheduleMeetingAction` | `meetings_conversations` | src/app/actions/meeting-calendar-actions.ts |
| `getMeetingSpeechCoachingAction` | `meetings_conversations` | src/app/actions/meeting-coach-actions.ts |
| `getWorkspaceCompliancePolicyAction` | `meetings_conversations` | src/app/actions/meeting-compliance-actions.ts |
| `saveWorkspaceCompliancePolicyAction` | `meetings_conversations` | src/app/actions/meeting-compliance-actions.ts |
| `exportMeetingAuditLogsAction` | `meetings_conversations` | src/app/actions/meeting-compliance-actions.ts |
| `getMeetingCRMContextAction` | `meetings_conversations` | src/app/actions/meeting-crm-actions.ts |
| `associateMeetingDealAction` | `meetings_conversations` | src/app/actions/meeting-crm-actions.ts |
| `resendFacilitatorLinksAction` | `meetings_conversations` | src/app/actions/meeting-facilitator-actions.ts |
| `logFacilitatorAttendance` | `meetings_conversations` | src/app/actions/meeting-facilitator-actions.ts |
| `submitPublicMeetingFeedbackAction` | `meetings_conversations` | src/app/actions/meeting-feedback-actions.ts |
| `getMeetingFeedbackSummaryAction` | `meetings_conversations` | src/app/actions/meeting-feedback-actions.ts |
| `generateMeetingIntelligenceAction` | `meetings_conversations` | src/app/actions/meeting-intelligence-actions.ts |
| `getMeetingIntelligenceAction` | `meetings_conversations` | src/app/actions/meeting-intelligence-actions.ts |
| `convertActionItemToCrmTaskAction` | `meetings_conversations` | src/app/actions/meeting-intelligence-actions.ts |
| `migrateMeetingToUnifiedSchemaAction` | `meetings_conversations` | src/app/actions/meeting-migration-actions.ts |
| `scheduleMeetingRemindersAction` | `meetings_conversations` | src/app/actions/meeting-notification-actions.ts |
| `getMeetingReminderJobsAction` | `meetings_conversations` | src/app/actions/meeting-notification-actions.ts |
| `updateParticipantRoleAction` | `meetings_conversations` | src/app/actions/meeting-participant-actions.ts |
| `updateParticipantRsvpAction` | `meetings_conversations` | src/app/actions/meeting-participant-actions.ts |
| `toggleParticipantAttendanceAction` | `meetings_conversations` | src/app/actions/meeting-participant-actions.ts |
| `removeParticipantAction` | `meetings_conversations` | src/app/actions/meeting-participant-actions.ts |
| `bulkImportParticipantsAction` | `meetings_conversations` | src/app/actions/meeting-participant-actions.ts |
| `createBookingPaymentIntentAction` | `meetings_conversations` | src/app/actions/meeting-payment-actions.ts |
| `processBookingRefundAction` | `meetings_conversations` | src/app/actions/meeting-payment-actions.ts |
| `getMeetingPollsAction` | `meetings_conversations` | src/app/actions/meeting-poll-actions.ts |
| `getMeetingPollBySlugAction` | `meetings_conversations` | src/app/actions/meeting-poll-actions.ts |
| `submitPollVoteAction` | `meetings_conversations` | src/app/actions/meeting-poll-actions.ts |
| `finalizeMeetingPollAction` | `meetings_conversations` | src/app/actions/meeting-poll-actions.ts |
| `endMeetingAction` | `meetings_conversations` | src/app/actions/meeting-post-event-action.ts |
| `scheduleMeetingPostEvent` | `meetings_conversations` | src/app/actions/meeting-post-event-action.ts |
| `attachMeetingRecordingAction` | `meetings_conversations` | src/app/actions/meeting-recording-actions.ts |
| `getMeetingRecordingsAction` | `meetings_conversations` | src/app/actions/meeting-recording-actions.ts |
| `deleteMeetingRecordingAction` | `meetings_conversations` | src/app/actions/meeting-recording-actions.ts |
| `generateRecordingPlaybackUrlAction` | `meetings_conversations` | src/app/actions/meeting-recording-actions.ts |
| `deleteRegistrantAction` | `meetings_conversations` | src/app/actions/meeting-registrants-actions.ts |
| `updateRegistrantStatusAction` | `meetings_conversations` | src/app/actions/meeting-registrants-actions.ts |
| `sendRegistrantJoinLinkAction` | `meetings_conversations` | src/app/actions/meeting-registrants-actions.ts |
| `adminRegisterParticipantAction` | `meetings_conversations` | src/app/actions/meeting-registrants-actions.ts |
| `sendMeetingInvitationsAction` | `meetings_conversations` | src/app/actions/meeting-registrants-actions.ts |
| `submitRsvpResponseAction` | `meetings_conversations` | src/app/actions/meeting-registrants-actions.ts |
| `manuallyUpdateGuestStatusAction` | `meetings_conversations` | src/app/actions/meeting-registrants-actions.ts |
| `getWorkspaceResourcesAction` | `meetings_conversations` | src/app/actions/meeting-resource-actions.ts |
| `saveWorkspaceResourceAction` | `meetings_conversations` | src/app/actions/meeting-resource-actions.ts |
| `deleteWorkspaceResourceAction` | `meetings_conversations` | src/app/actions/meeting-resource-actions.ts |
| `reservePhysicalResourceAction` | `meetings_conversations` | src/app/actions/meeting-resource-actions.ts |
| `recordMeetingTelemetryAction` | `meetings_conversations` | src/app/actions/meeting-telemetry-actions.ts |
| `getWorkspaceTelemetryMetricsAction` | `meetings_conversations` | src/app/actions/meeting-telemetry-actions.ts |
| `getMeetingTemplatesAction` | `meetings_conversations` | src/app/actions/meeting-template-actions.ts |
| `deployMeetingTemplateAction` | `meetings_conversations` | src/app/actions/meeting-template-actions.ts |
| `getMeetingWebhooksAction` | `meetings_conversations` | src/app/actions/meeting-webhook-actions.ts |
| `deleteMeetingWebhookAction` | `meetings_conversations` | src/app/actions/meeting-webhook-actions.ts |
| `getEventTypeWorkflowsAction` | `meetings_conversations` | src/app/actions/meeting-workflow-actions.ts |
| `saveEventTypeWorkflowsAction` | `meetings_conversations` | src/app/actions/meeting-workflow-actions.ts |
| `triggerMeetingLifecycleWorkflowsAction` | `meetings_conversations` | src/app/actions/meeting-workflow-actions.ts |
| `createMembershipAction` | `experience_portal` | src/app/actions/membership-actions.ts |
| `updateMembershipRoleAction` | `experience_portal` | src/app/actions/membership-actions.ts |
| `suspendMembershipAction` | `experience_portal` | src/app/actions/membership-actions.ts |
| `reactivateMembershipAction` | `experience_portal` | src/app/actions/membership-actions.ts |
| `deleteMembershipAction` | `experience_portal` | src/app/actions/membership-actions.ts |
| `updatePortalMemberProfileAction` | `experience_portal` | src/app/actions/membership-actions.ts |
| `updateMembershipPlanAction` | `experience_portal` | src/app/actions/membership-actions.ts |
| `updateMembershipTagsAction` | `experience_portal` | src/app/actions/membership-actions.ts |
| `createInvitationAction` | `experience_portal` | src/app/actions/membership-actions.ts |
| `createBulkInvitationsAction` | `experience_portal` | src/app/actions/membership-actions.ts |
| `verifyInvitationTokenAction` | `experience_portal` | src/app/actions/membership-actions.ts |
| `acceptInvitationAction` | `experience_portal` | src/app/actions/membership-actions.ts |
| `joinPortalDirectAction` | `experience_portal` | src/app/actions/membership-actions.ts |
| `revokeInvitationAction` | `experience_portal` | src/app/actions/membership-actions.ts |
| `createPlanAction` | `experience_portal` | src/app/actions/membership-actions.ts |
| `updatePlanAction` | `experience_portal` | src/app/actions/membership-actions.ts |
| `archivePlanAction` | `experience_portal` | src/app/actions/membership-actions.ts |
| `checkEntitlementAction` | `experience_portal` | src/app/actions/membership-actions.ts |
| `grantAccessAction` | `experience_portal` | src/app/actions/membership-actions.ts |
| `revokeAccessAction` | `experience_portal` | src/app/actions/membership-actions.ts |
| `listMembershipsByPortalAction` | `experience_portal` | src/app/actions/membership-actions.ts |
| `listInvitationsByPortalAction` | `experience_portal` | src/app/actions/membership-actions.ts |
| `listPlansByPortalAction` | `experience_portal` | src/app/actions/membership-actions.ts |
| `evaluateContentAccessAction` | `experience_portal` | src/app/actions/membership-actions.ts |
| `migrateLegacyTemplatesToBlocksAction` | `crm_contacts` | src/app/actions/migrate-legacy-templates-to-blocks-action.ts |
| `fetchOutdatedCampaignPages` | `crm_contacts` | src/app/actions/migrate-legacy-testimonials-action.ts |
| `migrateLegacyTestimonialBlocksAction` | `crm_contacts` | src/app/actions/migrate-legacy-testimonials-action.ts |
| `migrateTemplatesAction` | `crm_contacts` | src/app/actions/migrate-templates-action.ts |
| `getParkedJobsCountAction` | `finance_subscriptions` | src/app/actions/node-deletion-reconciliation-actions.ts |
| `reconcileParkedJobsOnNodeDeletionAction` | `finance_subscriptions` | src/app/actions/node-deletion-reconciliation-actions.ts |
| `getOfficeHoursRoomAction` | `crm_contacts` | src/app/actions/office-hours-actions.ts |
| `updateHostOfficeHoursStatusAction` | `crm_contacts` | src/app/actions/office-hours-actions.ts |
| `joinOfficeHoursQueueAction` | `crm_contacts` | src/app/actions/office-hours-actions.ts |
| `pingQueueHeartbeatAction` | `crm_contacts` | src/app/actions/office-hours-actions.ts |
| `admitNextVisitorAction` | `crm_contacts` | src/app/actions/office-hours-actions.ts |
| `leaveOfficeHoursQueueAction` | `crm_contacts` | src/app/actions/office-hours-actions.ts |
| `createOrUpdateJourneyAction` | `crm_contacts` | src/app/actions/onboarding-actions.ts |
| `deleteJourneyAction` | `crm_contacts` | src/app/actions/onboarding-actions.ts |
| `listJourneysAction` | `crm_contacts` | src/app/actions/onboarding-actions.ts |
| `seedDefaultJourneysAction` | `crm_contacts` | src/app/actions/onboarding-actions.ts |
| `startOnboardingJourneyAction` | `crm_contacts` | src/app/actions/onboarding-actions.ts |
| `submitOnboardingStepAction` | `crm_contacts` | src/app/actions/onboarding-actions.ts |
| `getMemberOnboardingInstanceAction` | `crm_contacts` | src/app/actions/onboarding-actions.ts |
| `listOnboardingInstancesAction` | `crm_contacts` | src/app/actions/onboarding-actions.ts |
| `bulkAssignJourneyAction` | `crm_contacts` | src/app/actions/onboarding-actions.ts |
| `adminOverrideStepAction` | `crm_contacts` | src/app/actions/onboarding-actions.ts |
| `validateJoinCodeAction` | `crm_contacts` | src/app/actions/onboarding-actions.ts |
| `submitOnboardingProfileAction` | `crm_contacts` | src/app/actions/onboarding-actions.ts |
| `enforceSuperAdminProfileAction` | `crm_contacts` | src/app/actions/onboarding-actions.ts |
| `getOnboardingSetupStateAction` | `crm_contacts` | src/app/actions/onboarding-actions.ts |
| `completeOrganizationOnboardingAction` | `crm_contacts` | src/app/actions/onboarding-actions.ts |
| `scanOrphanedRunsAction` | `finance_subscriptions` | src/app/actions/orphaned-runs-reconciliation-actions.ts |
| `reconcileOrphanedRunsAction` | `finance_subscriptions` | src/app/actions/orphaned-runs-reconciliation-actions.ts |
| `recoverFailedRunsAction` | `finance_subscriptions` | src/app/actions/orphaned-runs-reconciliation-actions.ts |
| `simulatePolicyImpactAction` | `ai_governance` | src/app/actions/policy-studio-actions.ts |
| `saveAndPublishPolicyAction` | `ai_governance` | src/app/actions/policy-studio-actions.ts |
| `getPolicyVersionHistoryAction` | `ai_governance` | src/app/actions/policy-studio-actions.ts |
| `rollbackPolicyVersionAction` | `ai_governance` | src/app/actions/policy-studio-actions.ts |
| `resetPolicyToDefaultsAction` | `ai_governance` | src/app/actions/policy-studio-actions.ts |
| `getBackofficePoliciesListAction` | `ai_governance` | src/app/actions/policy-studio-actions.ts |
| `createPortalAction` | `experience_portal` | src/app/actions/portal-actions.ts |
| `updatePortalAction` | `experience_portal` | src/app/actions/portal-actions.ts |
| `publishPortalAction` | `experience_portal` | src/app/actions/portal-actions.ts |
| `suspendPortalAction` | `experience_portal` | src/app/actions/portal-actions.ts |
| `archivePortalAction` | `experience_portal` | src/app/actions/portal-actions.ts |
| `duplicatePortalAction` | `experience_portal` | src/app/actions/portal-actions.ts |
| `deletePortalAction` | `experience_portal` | src/app/actions/portal-actions.ts |
| `verifyPortalSlugAvailabilityAction` | `experience_portal` | src/app/actions/portal-actions.ts |
| `validatePortalPasswordAction` | `experience_portal` | src/app/actions/portal-actions.ts |
| `getPublicPortalBySlugAction` | `experience_portal` | src/app/actions/portal-actions.ts |
| `getPortalByIdAction` | `experience_portal` | src/app/actions/portal-actions.ts |
| `runMasterExperienceSeederAction` | `experience_portal` | src/app/actions/portal-actions.ts |
| `normalizeExistingPortalNavigationAction` | `experience_portal` | src/app/actions/portal-actions.ts |
| `getPortalAnalyticsAction` | `experience_portal` | src/app/actions/portal-analytics-actions.ts |
| `refreshPortalAnalyticsAction` | `experience_portal` | src/app/actions/portal-analytics-actions.ts |
| `createProductAction` | `crm_contacts` | src/app/actions/product-actions.ts |
| `updateProductAction` | `crm_contacts` | src/app/actions/product-actions.ts |
| `deleteProductAction` | `crm_contacts` | src/app/actions/product-actions.ts |
| `listProductsAction` | `crm_contacts` | src/app/actions/product-actions.ts |
| `createProductCategoryAction` | `crm_contacts` | src/app/actions/product-actions.ts |
| `listProductCategoriesAction` | `crm_contacts` | src/app/actions/product-actions.ts |
| `createPriceBookAction` | `crm_contacts` | src/app/actions/product-actions.ts |
| `listPriceBooksAction` | `crm_contacts` | src/app/actions/product-actions.ts |
| `savePriceBookItemsAction` | `crm_contacts` | src/app/actions/product-actions.ts |
| `deleteProductCategoryAction` | `crm_contacts` | src/app/actions/product-actions.ts |
| `updateProductCategoryAction` | `crm_contacts` | src/app/actions/product-actions.ts |
| `deletePriceBookAction` | `crm_contacts` | src/app/actions/product-actions.ts |
| `updatePriceBookAction` | `crm_contacts` | src/app/actions/product-actions.ts |
| `executePurgeFocalPersonsFerAction` | `crm_contacts` | src/app/actions/purge-focal-persons-fer-action.ts |
| `executePurgeLegacyFieldsFerAction` | `crm_contacts` | src/app/actions/purge-legacy-fields-fer-action.ts |
| `generateQRFromPromptAction` | `media_creative` | src/app/actions/qr-ai-actions.ts |
| `generateContextualCopyAction` | `media_creative` | src/app/actions/qr-ai-actions.ts |
| `transformCanvasThemeAction` | `media_creative` | src/app/actions/qr-ai-actions.ts |
| `fetchUsersForWorkspaceRbacMigration` | `identity_access` | src/app/actions/rbac-workspace-migration-actions.ts |
| `enrichUsersWithWorkspaceRbac` | `identity_access` | src/app/actions/rbac-workspace-migration-actions.ts |
| `restoreWorkspaceRbacMigration` | `identity_access` | src/app/actions/rbac-workspace-migration-actions.ts |
| `rollbackWorkspaceRbacMigration` | `identity_access` | src/app/actions/rbac-workspace-migration-actions.ts |
| `decryptRecipientAction` | `crm_contacts` | src/app/actions/recipient-tracking-actions.ts |
| `createRecurringSeriesAction` | `crm_contacts` | src/app/actions/recurring-series-actions.ts |
| `getRecurringSeriesAction` | `crm_contacts` | src/app/actions/recurring-series-actions.ts |
| `cancelRecurringSeriesAction` | `crm_contacts` | src/app/actions/recurring-series-actions.ts |
| `registerSkeletonWhatsAppAction` | `communication_messaging` | src/app/actions/register-skeleton-whatsapp-action.ts |
| `getRevenueForecastOverviewAction` | `deals_revenue` | src/app/actions/revenue-forecasting-actions.ts |
| `reassignForecastCategoryAction` | `deals_revenue` | src/app/actions/revenue-forecasting-actions.ts |
| `recalculateDealAttributionAction` | `deals_revenue` | src/app/actions/revenue-forecasting-actions.ts |
| `saveRevenueGovernanceAction` | `deals_revenue` | src/app/actions/revenue-forecasting-actions.ts |
| `executeRevenueMigrationAction` | `deals_revenue` | src/app/actions/revenue-forecasting-actions.ts |
| `getExecutiveBoardroomDataAction` | `deals_revenue` | src/app/actions/revenue-os-actions.ts |
| `simulateRevenueScenarioAction` | `deals_revenue` | src/app/actions/revenue-os-actions.ts |
| `saveRevenueScenarioAction` | `deals_revenue` | src/app/actions/revenue-os-actions.ts |
| `deleteRevenueScenarioAction` | `deals_revenue` | src/app/actions/revenue-os-actions.ts |
| `applyStrategicRecommendationAction` | `deals_revenue` | src/app/actions/revenue-os-actions.ts |
| `updateRevenueOsGovernanceAction` | `deals_revenue` | src/app/actions/revenue-os-actions.ts |
| `reseedRevenueOsDefaultsAction` | `deals_revenue` | src/app/actions/revenue-os-actions.ts |
| `getRoutingFormBySlugAction` | `forms_surveys` | src/app/actions/routing-form-actions.ts |
| `createOrUpdateRoutingFormAction` | `forms_surveys` | src/app/actions/routing-form-actions.ts |
| `deleteRoutingFormAction` | `forms_surveys` | src/app/actions/routing-form-actions.ts |
| `submitRoutingFormAction` | `forms_surveys` | src/app/actions/routing-form-actions.ts |
| `runMeetingsFerAction` | `meetings_conversations` | src/app/actions/run-meetings-fer-action.ts |
| `getSalesOrchestrationDataAction` | `deals_revenue` | src/app/actions/sales-orchestration-actions.ts |
| `saveSalesPlayAction` | `deals_revenue` | src/app/actions/sales-orchestration-actions.ts |
| `toggleSalesPlayStatusAction` | `deals_revenue` | src/app/actions/sales-orchestration-actions.ts |
| `executePlayStepAction` | `deals_revenue` | src/app/actions/sales-orchestration-actions.ts |
| `resolveApprovalRequestAction` | `deals_revenue` | src/app/actions/sales-orchestration-actions.ts |
| `resolveEscalationIncidentAction` | `deals_revenue` | src/app/actions/sales-orchestration-actions.ts |
| `triggerSalesPlayManuallyAction` | `deals_revenue` | src/app/actions/sales-orchestration-actions.ts |
| `saveRoutingRuleAction` | `deals_revenue` | src/app/actions/sales-orchestration-actions.ts |
| `saveEscalationRuleAction` | `deals_revenue` | src/app/actions/sales-orchestration-actions.ts |
| `saveOrchestrationGovernanceAction` | `deals_revenue` | src/app/actions/sales-orchestration-actions.ts |
| `executeOrchestrationMigrationAction` | `deals_revenue` | src/app/actions/sales-orchestration-actions.ts |
| `getPerformanceOverviewAction` | `deals_revenue` | src/app/actions/sales-performance-actions.ts |
| `getRepAuditLedgerAction` | `deals_revenue` | src/app/actions/sales-performance-actions.ts |
| `getRepPerformanceDetailAction` | `deals_revenue` | src/app/actions/sales-performance-actions.ts |
| `listWorkspaceTargetsAction` | `deals_revenue` | src/app/actions/sales-performance-actions.ts |
| `createOrUpdateTargetAction` | `deals_revenue` | src/app/actions/sales-performance-actions.ts |
| `deleteTargetAction` | `deals_revenue` | src/app/actions/sales-performance-actions.ts |
| `renderScheduledMessageAction` | `crm_contacts` | src/app/actions/scheduled-message-actions.ts |
| `rescheduleMessageAction` | `crm_contacts` | src/app/actions/scheduled-message-actions.ts |
| `cancelMessageAction` | `crm_contacts` | src/app/actions/scheduled-message-actions.ts |
| `updateScheduledMessageContentAction` | `crm_contacts` | src/app/actions/scheduled-message-actions.ts |
| `getGoogleAuthUrlAction` | `automation_workflows` | src/app/actions/scheduler-actions.ts |
| `getMicrosoftAuthUrlAction` | `automation_workflows` | src/app/actions/scheduler-actions.ts |
| `getZoomAuthUrlAction` | `automation_workflows` | src/app/actions/scheduler-actions.ts |
| `disconnectConnectionAction` | `automation_workflows` | src/app/actions/scheduler-actions.ts |
| `getBookingPageBySlugAction` | `automation_workflows` | src/app/actions/scheduler-actions.ts |
| `getAvailableSlotsAction` | `automation_workflows` | src/app/actions/scheduler-actions.ts |
| `createBookingAction` | `automation_workflows` | src/app/actions/scheduler-actions.ts |
| `saveBookingPageAction` | `automation_workflows` | src/app/actions/scheduler-actions.ts |
| `deleteBookingPageAction` | `automation_workflows` | src/app/actions/scheduler-actions.ts |
| `ensureWorkspaceAvailabilityAction` | `automation_workflows` | src/app/actions/scheduler-actions.ts |
| `seedInfrastructureAction` | `crm_contacts` | src/app/actions/seed-actions.ts |
| `executeSeedAllWorkspacesFieldsFerAction` | `identity_access` | src/app/actions/seed-all-workspaces-fields-fer-action.ts |
| `seedDefaultStyleBlueprintsAction` | `crm_contacts` | src/app/actions/seed-default-style-blueprints-action.ts |
| `seedGlobalTemplatesAction` | `crm_contacts` | src/app/actions/seed-global-templates-action.ts |
| `seedMaintenanceAction` | `crm_contacts` | src/app/actions/seed-maintenance-action.ts |
| `seedEnrichedMeetingTemplatesAction` | `meetings_conversations` | src/app/actions/seed-meeting-invitation-templates-action.ts |
| `seedMeetingsV2Action` | `meetings_conversations` | src/app/actions/seed-meetings-action.ts |
| `seedPlatformPageTemplatesAction` | `forms_surveys` | src/app/actions/seed-platform-page-templates-action.ts |
| `seedAllPlatformTemplatesAction` | `forms_surveys` | src/app/actions/seed-platform-presets-action.ts |
| `seedPromptsAction` | `crm_contacts` | src/app/actions/seed-prompts-action.ts |
| `getMyDayOverviewAction` | `identity_access` | src/app/actions/seller-workspace-actions.ts |
| `executeQuickActionAction` | `identity_access` | src/app/actions/seller-workspace-actions.ts |
| `snoozeQueueItemAction` | `identity_access` | src/app/actions/seller-workspace-actions.ts |
| `dismissQueueItemAction` | `identity_access` | src/app/actions/seller-workspace-actions.ts |
| `setDefaultSenderProfileAction` | `crm_contacts` | src/app/actions/set-default-sender-action.ts |
| `clearWorkspaceDefaultSenderAction` | `crm_contacts` | src/app/actions/set-default-sender-action.ts |
| `generateSocialVariationAction` | `crm_contacts` | src/app/actions/social-composer-actions.ts |
| `createSocialPostAction` | `crm_contacts` | src/app/actions/social-composer-actions.ts |
| `updatePostScheduleAction` | `crm_contacts` | src/app/actions/social-composer-actions.ts |
| `recommendBestTimeAction` | `crm_contacts` | src/app/actions/social-composer-actions.ts |
| `simulateInboundMessageAction` | `crm_contacts` | src/app/actions/social-composer-actions.ts |
| `generateInboxReplyAction` | `crm_contacts` | src/app/actions/social-composer-actions.ts |
| `sendInboxManualReplyAction` | `crm_contacts` | src/app/actions/social-composer-actions.ts |
| `linkInboxToCRMAction` | `crm_contacts` | src/app/actions/social-composer-actions.ts |
| `simulateSocialConversionsAction` | `crm_contacts` | src/app/actions/social-composer-actions.ts |
| `simulateListeningMentionAction` | `crm_contacts` | src/app/actions/social-composer-actions.ts |
| `executeStripAccountStatusFerAction` | `crm_contacts` | src/app/actions/strip-account-status-fer-action.ts |
| `executeStripLifecycleStatusFerAction` | `crm_contacts` | src/app/actions/strip-lifecycle-status-fer-action.ts |
| `getAssigneeDetails` | `forms_surveys` | src/app/actions/survey-assignee-actions.ts |
| `sendSurveyLinkToAssignee` | `forms_surveys` | src/app/actions/survey-assignee-actions.ts |
| `generateKeywordsAction` | `forms_surveys` | src/app/actions/survey-seo-actions.ts |
| `executeTemplateIdentifiersFerAction` | `crm_contacts` | src/app/actions/template-identifiers-fer-action.ts |
| `runTenantSenderHygieneAction` | `crm_contacts` | src/app/actions/tenant-hygiene-action.ts |
| `runGenerateThumbnail` | `media_creative` | src/app/actions/thumbnail-actions.ts |
| `runModifyThumbnail` | `media_creative` | src/app/actions/thumbnail-actions.ts |
| `runGenerateHooks` | `media_creative` | src/app/actions/thumbnail-actions.ts |
| `executeUnexpireImportPayloadsFerAction` | `crm_contacts` | src/app/actions/unexpire-import-payloads-fer-action.ts |
| `updatePreferencesAction` | `crm_contacts` | src/app/actions/unsubscribe-actions.ts |
| `getWebinarStageStateAction` | `crm_contacts` | src/app/actions/webinar-stage-actions.ts |
| `togglePresenterStageStatusAction` | `crm_contacts` | src/app/actions/webinar-stage-actions.ts |
| `postWebinarQuestionAction` | `crm_contacts` | src/app/actions/webinar-stage-actions.ts |
| `upvoteWebinarQuestionAction` | `crm_contacts` | src/app/actions/webinar-stage-actions.ts |
| `promoteWaitlistRegistrantsAction` | `crm_contacts` | src/app/actions/webinar-stage-actions.ts |
| `createOrUpdateDepartmentAction` | `lead_intelligence` | src/app/actions/workforce-actions.ts |
| `deleteDepartmentAction` | `lead_intelligence` | src/app/actions/workforce-actions.ts |
| `listDepartmentsAction` | `lead_intelligence` | src/app/actions/workforce-actions.ts |
| `purgeSampleDepartmentsAction` | `lead_intelligence` | src/app/actions/workforce-actions.ts |
| `backfillDepartmentSeedsAction` | `lead_intelligence` | src/app/actions/workforce-actions.ts |
| `createOrUpdateTeamAction` | `lead_intelligence` | src/app/actions/workforce-actions.ts |
| `deleteTeamAction` | `lead_intelligence` | src/app/actions/workforce-actions.ts |
| `listTeamsAction` | `lead_intelligence` | src/app/actions/workforce-actions.ts |
| `dispatchInvitationsAction` | `lead_intelligence` | src/app/actions/workforce-actions.ts |
| `resendInvitationAction` | `lead_intelligence` | src/app/actions/workforce-actions.ts |
| `revokeInvitationAction` | `lead_intelligence` | src/app/actions/workforce-actions.ts |
| `listInvitationsAction` | `lead_intelligence` | src/app/actions/workforce-actions.ts |
| `validateInvitationTokenAction` | `lead_intelligence` | src/app/actions/workforce-actions.ts |
| `acceptInvitationAction` | `lead_intelligence` | src/app/actions/workforce-actions.ts |
| `submitAccessRequestAction` | `lead_intelligence` | src/app/actions/workforce-actions.ts |
| `resolveAccessRequestAction` | `lead_intelligence` | src/app/actions/workforce-actions.ts |
| `listAccessRequestsAction` | `lead_intelligence` | src/app/actions/workforce-actions.ts |
| `executeBulkWorkforceAction` | `lead_intelligence` | src/app/actions/workforce-actions.ts |
| `getWorkforceIntelligenceSnapshotAction` | `lead_intelligence` | src/app/actions/workforce-intelligence-actions.ts |
| `refreshWorkforceIntelligenceSnapshotAction` | `lead_intelligence` | src/app/actions/workforce-intelligence-actions.ts |
| `fetchWorkspacesForIndustryMigration` | `identity_access` | src/app/actions/workspace-industry-migration-actions.ts |
| `enrichWorkspacesWithIndustry` | `identity_access` | src/app/actions/workspace-industry-migration-actions.ts |
| `restoreWorkspaceIndustryMigration` | `identity_access` | src/app/actions/workspace-industry-migration-actions.ts |
| `rollbackWorkspaceIndustryMigration` | `identity_access` | src/app/actions/workspace-industry-migration-actions.ts |
| `executeWorkspaceScopeFetchEnrichRestoreAction` | `identity_access` | src/app/actions/workspace-scope-migration-actions.ts |
| `ActionNode` | `automation_workflows` | src/app/admin/automations/[id]/edit/components/nodes/ActionNode.tsx |
| `NodeActionToolbar` | `automation_workflows` | src/app/admin/automations/[id]/edit/components/nodes/NodeActionToolbar.tsx |
| `TagActionNode` | `automation_workflows` | src/app/admin/automations/[id]/edit/components/nodes/TagActionNode.tsx |
| `ActionConfigPanel` | `automation_workflows` | src/app/admin/automations/components/ActionConfigPanel.tsx |
| `DealQuickActions` | `deals_revenue` | src/app/admin/deals/[id]/components/DealQuickActions.tsx |
| `BulkActionDock` | `crm_contacts` | src/app/admin/entities/components/BulkActionDock.tsx |
| `FloatingActionToolbar` | `lead_intelligence` | src/app/admin/lead-intelligence/components/FloatingActionToolbar.tsx |
| `MediaAnalyticsBulkActionsBar` | `media_creative` | src/app/admin/media/analytics/components/MediaAnalyticsBulkActionsBar.tsx |
| `MeetingActionItemsDrawer` | `lead_intelligence` | src/app/admin/meetings/[id]/components/MeetingActionItemsDrawer.tsx |
| `ActionExecutionDrawer` | `crm_contacts` | src/app/admin/my-day/components/ActionExecutionDrawer.tsx |
| `ActionTargetModal` | `crm_contacts` | src/app/admin/pages/[id]/builder/components/ActionTargetModal.tsx |
| `PipelineActionsView` | `deals_revenue` | src/app/admin/pipeline/components/PipelineActionsView.tsx |
| `SurveyAnalyticsBulkActionsBar` | `forms_surveys` | src/app/admin/surveys/[id]/results/components/SurveyAnalyticsBulkActionsBar.tsx |
| `BulkActionsBar` | `forms_surveys` | src/app/admin/surveys/components/BulkActionsBar.tsx |
| `BulkActionsFloatingToolbar` | `identity_access` | src/app/admin/users/components/BulkActionsFloatingToolbar.tsx |
| `QuickActions` | `analytics_reporting` | src/components/dashboard/QuickActions.tsx |
| `ContextualActionBar` | `media_creative` | src/components/shared/thumbnail-designer/ContextualActionBar.tsx |
| `getActivitiesForContactCore` | `crm_contacts` | src/lib/activity-actions.ts |
| `updateNote` | `crm_contacts` | src/lib/activity-actions.ts |
| `deleteNote` | `crm_contacts` | src/lib/activity-actions.ts |
| `getActivitiesForContact` | `crm_contacts` | src/lib/activity-actions.ts |
| `listSpecialistsAction` | `crm_contacts` | src/lib/agents/actions/domain-agent-actions.ts |
| `getSpecialistDetailsAction` | `crm_contacts` | src/lib/agents/actions/domain-agent-actions.ts |
| `updateSpecialistConfigAction` | `crm_contacts` | src/lib/agents/actions/domain-agent-actions.ts |
| `startSwarmMissionAction` | `crm_contacts` | src/lib/agents/actions/domain-agent-actions.ts |
| `getSwarmRunAction` | `crm_contacts` | src/lib/agents/actions/domain-agent-actions.ts |
| `listSwarmRunsAction` | `crm_contacts` | src/lib/agents/actions/domain-agent-actions.ts |
| `resumeSwarmMissionAction` | `crm_contacts` | src/lib/agents/actions/domain-agent-actions.ts |
| `createAgreementAction` | `crm_contacts` | src/lib/agreement-actions.ts |
| `updateAgreementAction` | `crm_contacts` | src/lib/agreement-actions.ts |
| `executeRecurringBillingAction` | `crm_contacts` | src/lib/agreement-actions.ts |
| `getAgreementsByEntityAction` | `crm_contacts` | src/lib/agreement-actions.ts |
| `getWorkspaceAiSettingsAction` | `identity_access` | src/lib/ai/actions/workspace-ai-actions.ts |
| `updateWorkspaceAiSettingsAction` | `identity_access` | src/lib/ai/actions/workspace-ai-actions.ts |
| `createChangeSetAction` | `crm_contacts` | src/lib/ai-change-set-actions.ts |
| `updateChangeSetStatusAction` | `crm_contacts` | src/lib/ai-change-set-actions.ts |
| `fetchPageChangeSetsAction` | `crm_contacts` | src/lib/ai-change-set-actions.ts |
| `createSurveyFromAiAction` | `forms_surveys` | src/lib/ai-survey-actions.ts |
| `recordPageViewAction` | `analytics_reporting` | src/lib/analytics-actions.ts |
| `recordInteractionAction` | `analytics_reporting` | src/lib/analytics-actions.ts |
| `recordConversion` | `analytics_reporting` | src/lib/analytics-actions.ts |
| `generateApiKey` | `crm_contacts` | src/lib/api-key-actions.ts |
| `listApiKeys` | `crm_contacts` | src/lib/api-key-actions.ts |
| `revokeApiKey` | `crm_contacts` | src/lib/api-key-actions.ts |
| `getPendingApprovalsAction` | `ai_governance` | src/lib/approval-actions.ts |
| `submitApprovalRequestAction` | `ai_governance` | src/lib/approval-actions.ts |
| `decideApprovalRequestAction` | `ai_governance` | src/lib/approval-actions.ts |
| `getApprovalPolicyAction` | `ai_governance` | src/lib/approval-actions.ts |
| `saveApprovalPolicyAction` | `ai_governance` | src/lib/approval-actions.ts |
| `getDocumentAuditHistoryAction` | `ai_governance` | src/lib/audit-actions.ts |
| `getRecentFinancialAuditLogsAction` | `ai_governance` | src/lib/audit-actions.ts |
| `saveAutomationAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `deleteAutomationAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `archiveAutomationAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `restoreAutomationAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `deleteAllArchivedAutomationsAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `toggleAutomationStatusAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `seedDefaultAutomationsAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `testAutomationFlowAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `testAutomationStepAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `pulseAutomationEngineAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `manuallyReleaseWaitJobAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `manuallyEndAutomationRunAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `restartRunAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `retryFailedStepAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `forceEndRunAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `forceAdvanceRunAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `pauseRunAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `resumeRunAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `getMessageNodeStatsAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `getMessageNodeLogsAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `exportAutomationAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `importAutomationAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `cleanContactEmailAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `deleteContactAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `verifySingleContactAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `bulkCleanContactsAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `enrollContactsInAutomationAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `healStrandedMessageContactsAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `manuallyReleaseAllWaitJobsAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `reconcilePendingSmsLogsAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `bulkRetryRunsAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `bulkForceAdvanceRunsAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `jumpRunToStepAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `rescheduleWaitJobAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `updateRunPayloadAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `cleanAndVerifyRunContactAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `createContactFollowupTaskAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `executeMessageStatusAutomationsAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `resendFailedMessageAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `bulkResendFailedMessagesAction` | `automation_workflows` | src/lib/automation-actions.ts |
| `handleCreateDeal` | `deals_revenue` | src/lib/automations/actions/deal-automation-actions.ts |
| `handleUpdateDealStage` | `deals_revenue` | src/lib/automations/actions/deal-automation-actions.ts |
| `handleUpdateDealValue` | `deals_revenue` | src/lib/automations/actions/deal-automation-actions.ts |
| `handleUpdateDealStatus` | `deals_revenue` | src/lib/automations/actions/deal-automation-actions.ts |
| `handleAssignDealOwner` | `deals_revenue` | src/lib/automations/actions/deal-automation-actions.ts |
| `handleUpdateDealProbability` | `deals_revenue` | src/lib/automations/actions/deal-automation-actions.ts |
| `handleCreateDealTask` | `deals_revenue` | src/lib/automations/actions/deal-automation-actions.ts |
| `handleAddDealNote` | `deals_revenue` | src/lib/automations/actions/deal-automation-actions.ts |
| `handleAssignEntity` | `automation_workflows` | src/lib/automations/actions/entity-actions.ts |
| `handleAddNote` | `automation_workflows` | src/lib/automations/actions/entity-actions.ts |
| `handleCreateContactForEntity` | `automation_workflows` | src/lib/automations/actions/entity-actions.ts |
| `handleUpdateContact` | `automation_workflows` | src/lib/automations/actions/entity-actions.ts |
| `handleFindContact` | `automation_workflows` | src/lib/automations/actions/entity-actions.ts |
| `handleSendMessage` | `automation_workflows` | src/lib/automations/actions/message-actions.ts |
| `handleDirectMessage` | `automation_workflows` | src/lib/automations/actions/message-actions.ts |
| `parseManualRecipients` | `automation_workflows` | src/lib/automations/actions/notification-actions.ts |
| `handleSendNotification` | `automation_workflows` | src/lib/automations/actions/notification-actions.ts |
| `handleDirectNotification` | `automation_workflows` | src/lib/automations/actions/notification-actions.ts |
| `handleCreateTask` | `automation_workflows` | src/lib/automations/actions/task-actions.ts |
| `handleTriggerOutboundWebhook` | `automation_workflows` | src/lib/automations/actions/webhook-actions.ts |
| `getGlobalAiKeys` | `crm_contacts` | src/lib/backoffice/backoffice-ai-actions.ts |
| `saveGlobalAiKeys` | `crm_contacts` | src/lib/backoffice/backoffice-ai-actions.ts |
| `getGlobalAiConfig` | `crm_contacts` | src/lib/backoffice/backoffice-ai-actions.ts |
| `saveGlobalAiConfig` | `crm_contacts` | src/lib/backoffice/backoffice-ai-actions.ts |
| `rotateAllSecretsAction` | `crm_contacts` | src/lib/backoffice/backoffice-ai-actions.ts |
| `listApprovalRequests` | `ai_governance` | src/lib/backoffice/backoffice-approval-actions.ts |
| `decideApprovalRequest` | `ai_governance` | src/lib/backoffice/backoffice-approval-actions.ts |
| `cancelApprovalRequest` | `ai_governance` | src/lib/backoffice/backoffice-approval-actions.ts |
| `listAllAssets` | `media_creative` | src/lib/backoffice/backoffice-asset-actions.ts |
| `saveAssetRecord` | `media_creative` | src/lib/backoffice/backoffice-asset-actions.ts |
| `deleteAssetRecord` | `media_creative` | src/lib/backoffice/backoffice-asset-actions.ts |
| `fetchAuditLogs` | `ai_governance` | src/lib/backoffice/backoffice-audit-actions.ts |
| `getPlatformOpsStats` | `analytics_reporting` | src/lib/backoffice/backoffice-dashboard-actions.ts |
| `listAllFeatures` | `crm_contacts` | src/lib/backoffice/backoffice-feature-actions.ts |
| `getFeatureDetail` | `crm_contacts` | src/lib/backoffice/backoffice-feature-actions.ts |
| `toggleFeatureKillSwitch` | `crm_contacts` | src/lib/backoffice/backoffice-feature-actions.ts |
| `updateFeatureRolloutRules` | `crm_contacts` | src/lib/backoffice/backoffice-feature-actions.ts |
| `listFieldPacks` | `crm_contacts` | src/lib/backoffice/backoffice-field-actions.ts |
| `getContactTypeDefaultsInternal` | `crm_contacts` | src/lib/backoffice/backoffice-field-actions.ts |
| `getContactTypeDefaults` | `crm_contacts` | src/lib/backoffice/backoffice-field-actions.ts |
| `saveContactTypeDefaults` | `crm_contacts` | src/lib/backoffice/backoffice-field-actions.ts |
| `saveFieldPack` | `crm_contacts` | src/lib/backoffice/backoffice-field-actions.ts |
| `listNativeFields` | `crm_contacts` | src/lib/backoffice/backoffice-field-actions.ts |
| `saveNativeField` | `crm_contacts` | src/lib/backoffice/backoffice-field-actions.ts |
| `listPlatformIndustryFieldGroupsInternal` | `crm_contacts` | src/lib/backoffice/backoffice-field-actions.ts |
| `listPlatformIndustryFieldGroups` | `crm_contacts` | src/lib/backoffice/backoffice-field-actions.ts |
| `savePlatformIndustryFieldGroup` | `crm_contacts` | src/lib/backoffice/backoffice-field-actions.ts |
| `deletePlatformIndustryFieldGroup` | `crm_contacts` | src/lib/backoffice/backoffice-field-actions.ts |
| `getFinancialOverviewAction` | `finance_subscriptions` | src/lib/backoffice/backoffice-finance-actions.ts |
| `triggerDunningEscalationAction` | `finance_subscriptions` | src/lib/backoffice/backoffice-finance-actions.ts |
| `runFormsFerAuditAction` | `forms_surveys` | src/lib/backoffice/backoffice-forms-actions.ts |
| `seedIndustryFormTemplatesAction` | `forms_surveys` | src/lib/backoffice/backoffice-forms-actions.ts |
| `getTenantHealthOverviewAction` | `crm_contacts` | src/lib/backoffice/backoffice-health-actions.ts |
| `listTenantIssuesAction` | `crm_contacts` | src/lib/backoffice/backoffice-health-actions.ts |
| `updateTenantIssueStatusAction` | `crm_contacts` | src/lib/backoffice/backoffice-health-actions.ts |
| `addTenantIssueNoteAction` | `crm_contacts` | src/lib/backoffice/backoffice-health-actions.ts |
| `createImpersonationSessionAction` | `crm_contacts` | src/lib/backoffice/backoffice-health-actions.ts |
| `getSystemEngineManifestAction` | `crm_contacts` | src/lib/backoffice/backoffice-health-actions.ts |
| `getIntegrationHealthOverviewAction` | `platform_integrations` | src/lib/backoffice/backoffice-integration-actions.ts |
| `verifyIntegrationConnectionAction` | `platform_integrations` | src/lib/backoffice/backoffice-integration-actions.ts |
| `manualReSyncBookingAction` | `platform_integrations` | src/lib/backoffice/backoffice-integration-actions.ts |
| `listAllJobs` | `crm_contacts` | src/lib/backoffice/backoffice-job-actions.ts |
| `createJob` | `crm_contacts` | src/lib/backoffice/backoffice-job-actions.ts |
| `cancelJob` | `crm_contacts` | src/lib/backoffice/backoffice-job-actions.ts |
| `triggerJobExecution` | `crm_contacts` | src/lib/backoffice/backoffice-job-actions.ts |
| `runTenantDiagnostics` | `crm_contacts` | src/lib/backoffice/backoffice-job-actions.ts |
| `clearAutomationData` | `crm_contacts` | src/lib/backoffice/backoffice-job-actions.ts |
| `getMeetingsTelemetryAction` | `meetings_conversations` | src/lib/backoffice/backoffice-meetings-actions.ts |
| `resendMagicJoinLinkAction` | `meetings_conversations` | src/lib/backoffice/backoffice-meetings-actions.ts |
| `getMessagingDeliveryMetricsAction` | `communication_messaging` | src/lib/backoffice/backoffice-messaging-observatory-actions.ts |
| `listWebhookDeadLettersAction` | `communication_messaging` | src/lib/backoffice/backoffice-messaging-observatory-actions.ts |
| `replayWebhookDeadLetterAction` | `communication_messaging` | src/lib/backoffice/backoffice-messaging-observatory-actions.ts |
| `listSuppressionRecordsAction` | `communication_messaging` | src/lib/backoffice/backoffice-messaging-observatory-actions.ts |
| `listAllOrganizations` | `crm_contacts` | src/lib/backoffice/backoffice-org-actions.ts |
| `suspendOrganization` | `crm_contacts` | src/lib/backoffice/backoffice-org-actions.ts |
| `restoreOrganization` | `crm_contacts` | src/lib/backoffice/backoffice-org-actions.ts |
| `updateOrganizationFromBackoffice` | `crm_contacts` | src/lib/backoffice/backoffice-org-actions.ts |
| `getOrganizationDiagnostics` | `crm_contacts` | src/lib/backoffice/backoffice-org-actions.ts |
| `createOrganizationFromBackofficeAction` | `crm_contacts` | src/lib/backoffice/backoffice-org-actions.ts |
| `shareOrgSetupInviteAction` | `crm_contacts` | src/lib/backoffice/backoffice-org-actions.ts |
| `toggleOrganizationActivityLogging` | `crm_contacts` | src/lib/backoffice/backoffice-org-actions.ts |
| `clearOrganizationActivityLogs` | `crm_contacts` | src/lib/backoffice/backoffice-org-actions.ts |
| `listProviderSettings` | `crm_contacts` | src/lib/backoffice/backoffice-provider-actions.ts |
| `saveProviderSetting` | `crm_contacts` | src/lib/backoffice/backoffice-provider-actions.ts |
| `getSurveyGovernanceOverviewAction` | `forms_surveys` | src/lib/backoffice/backoffice-survey-actions.ts |
| `purgeSpamSubmissionAction` | `forms_surveys` | src/lib/backoffice/backoffice-survey-actions.ts |
| `unflagSubmissionAction` | `forms_surveys` | src/lib/backoffice/backoffice-survey-actions.ts |
| `seedRoleArchitectureTemplatesAction` | `crm_contacts` | src/lib/backoffice/backoffice-template-actions.ts |
| `listAllTemplates` | `crm_contacts` | src/lib/backoffice/backoffice-template-actions.ts |
| `getTemplateDetail` | `crm_contacts` | src/lib/backoffice/backoffice-template-actions.ts |
| `publishTemplate` | `crm_contacts` | src/lib/backoffice/backoffice-template-actions.ts |
| `deprecateTemplate` | `crm_contacts` | src/lib/backoffice/backoffice-template-actions.ts |
| `createTemplateAction` | `crm_contacts` | src/lib/backoffice/backoffice-template-actions.ts |
| `updateTemplateAction` | `crm_contacts` | src/lib/backoffice/backoffice-template-actions.ts |
| `deleteTemplateAction` | `crm_contacts` | src/lib/backoffice/backoffice-template-actions.ts |
| `getPublishedTemplatesAction` | `crm_contacts` | src/lib/backoffice/backoffice-template-actions.ts |
| `propagateTemplateAction` | `crm_contacts` | src/lib/backoffice/backoffice-template-actions.ts |
| `listAllWorkspaces` | `identity_access` | src/lib/backoffice/backoffice-workspace-actions.ts |
| `getWorkspaceDiagnostics` | `identity_access` | src/lib/backoffice/backoffice-workspace-actions.ts |
| `archiveWorkspaceFromBackoffice` | `identity_access` | src/lib/backoffice/backoffice-workspace-actions.ts |
| `restoreWorkspaceFromBackoffice` | `identity_access` | src/lib/backoffice/backoffice-workspace-actions.ts |
| `saveBanditPolicyAction` | `crm_contacts` | src/lib/bandit-actions.ts |
| `recordBanditRewardAction` | `crm_contacts` | src/lib/bandit-actions.ts |
| `fetchBanditPolicyAction` | `crm_contacts` | src/lib/bandit-actions.ts |
| `generateInvoiceAction` | `finance_subscriptions` | src/lib/billing-actions.ts |
| `updateInvoiceAction` | `finance_subscriptions` | src/lib/billing-actions.ts |
| `voidInvoiceAction` | `finance_subscriptions` | src/lib/billing-actions.ts |
| `disputeInvoiceAction` | `finance_subscriptions` | src/lib/billing-actions.ts |
| `deleteInvoiceAction` | `finance_subscriptions` | src/lib/billing-actions.ts |
| `ingestBatchAction` | `media_creative` | src/lib/bulk-upload-actions.ts |
| `processImportChunkBackground` | `media_creative` | src/lib/bulk-upload-actions.ts |
| `ingestSchoolRowAction` | `media_creative` | src/lib/bulk-upload-actions.ts |
| `getImportsLogsListAction` | `media_creative` | src/lib/bulk-upload-actions.ts |
| `purgeExpiredFailedImportsAction` | `media_creative` | src/lib/bulk-upload-actions.ts |
| `getFailedRowsAction` | `media_creative` | src/lib/bulk-upload-actions.ts |
| `updateFailedRowAction` | `media_creative` | src/lib/bulk-upload-actions.ts |
| `resolveFailedRowAction` | `media_creative` | src/lib/bulk-upload-actions.ts |
| `getDuplicateRowsAction` | `media_creative` | src/lib/bulk-upload-actions.ts |
| `resolveDuplicatesAction` | `media_creative` | src/lib/bulk-upload-actions.ts |
| `cancelBulkUploadAction` | `media_creative` | src/lib/bulk-upload-actions.ts |
| `resumeBulkUploadAction` | `media_creative` | src/lib/bulk-upload-actions.ts |
| `getActionMeta` | `crm_contacts` | src/lib/call-action-types.ts |
| `createCallScriptAction` | `automation_workflows` | src/lib/call-centre-actions.ts |
| `updateCallScriptAction` | `automation_workflows` | src/lib/call-centre-actions.ts |
| `deleteCallScriptAction` | `automation_workflows` | src/lib/call-centre-actions.ts |
| `getCallScriptAction` | `automation_workflows` | src/lib/call-centre-actions.ts |
| `importCallScriptAction` | `automation_workflows` | src/lib/call-centre-actions.ts |
| `executeScriptActionAction` | `automation_workflows` | src/lib/call-centre-actions.ts |
| `listCallScriptsAction` | `automation_workflows` | src/lib/call-centre-actions.ts |
| `createCallCampaignAction` | `automation_workflows` | src/lib/call-centre-actions.ts |
| `updateCallCampaignAction` | `automation_workflows` | src/lib/call-centre-actions.ts |
| `deleteCallCampaignAction` | `automation_workflows` | src/lib/call-centre-actions.ts |
| `generateCampaignQueueAction` | `automation_workflows` | src/lib/call-centre-actions.ts |
| `lockQueueItemAction` | `automation_workflows` | src/lib/call-centre-actions.ts |
| `releaseQueueItemAction` | `automation_workflows` | src/lib/call-centre-actions.ts |
| `submitCallOutcomeAction` | `automation_workflows` | src/lib/call-centre-actions.ts |
| `updateNotesDraftAction` | `automation_workflows` | src/lib/call-centre-actions.ts |
| `skipQueueItemAction` | `automation_workflows` | src/lib/call-centre-actions.ts |
| `deferQueueItemAction` | `automation_workflows` | src/lib/call-centre-actions.ts |
| `scheduleCallbackAction` | `automation_workflows` | src/lib/call-centre-actions.ts |
| `generateCallScriptAction` | `automation_workflows` | src/lib/call-centre-actions.ts |
| `refineCallScriptAction` | `automation_workflows` | src/lib/call-centre-actions.ts |
| `cloneCallCampaignAction` | `automation_workflows` | src/lib/call-centre-actions.ts |
| `addContactsToCallCampaignAction` | `automation_workflows` | src/lib/call-centre-actions.ts |
| `removeContactsFromCampaignAction` | `automation_workflows` | src/lib/call-centre-actions.ts |
| `archiveCallCampaignAction` | `automation_workflows` | src/lib/call-centre-actions.ts |
| `endCallCampaignAction` | `automation_workflows` | src/lib/call-centre-actions.ts |
| `executeOutcomeAutomationsAction` | `automation_workflows` | src/lib/call-centre-actions.ts |
| `enqueueAndLockSingleCallAction` | `automation_workflows` | src/lib/call-centre-actions.ts |
| `releaseSingleCallAction` | `automation_workflows` | src/lib/call-centre-actions.ts |
| `createOrUpdateCollectionCaseAction` | `crm_contacts` | src/lib/collection-actions.ts |
| `updateCaseStageAction` | `crm_contacts` | src/lib/collection-actions.ts |
| `assignCaseAction` | `crm_contacts` | src/lib/collection-actions.ts |
| `recordPromiseToPayAction` | `crm_contacts` | src/lib/collection-actions.ts |
| `evaluatePromisesAction` | `crm_contacts` | src/lib/collection-actions.ts |
| `createPaymentPlanAction` | `crm_contacts` | src/lib/collection-actions.ts |
| `logCollectionActivityAction` | `crm_contacts` | src/lib/collection-actions.ts |
| `createDiscovery` | `crm_contacts` | src/lib/consultancy-actions.ts |
| `updateDiscovery` | `crm_contacts` | src/lib/consultancy-actions.ts |
| `getDiscoveriesForEntity` | `crm_contacts` | src/lib/consultancy-actions.ts |
| `createEngagement` | `crm_contacts` | src/lib/consultancy-actions.ts |
| `updateEngagement` | `crm_contacts` | src/lib/consultancy-actions.ts |
| `getEngagementsForEntity` | `crm_contacts` | src/lib/consultancy-actions.ts |
| `createMilestone` | `crm_contacts` | src/lib/consultancy-actions.ts |
| `updateMilestoneStatus` | `crm_contacts` | src/lib/consultancy-actions.ts |
| `getMilestonesForEngagement` | `crm_contacts` | src/lib/consultancy-actions.ts |
| `createOutcome` | `crm_contacts` | src/lib/consultancy-actions.ts |
| `updateOutcome` | `crm_contacts` | src/lib/consultancy-actions.ts |
| `getOutcomesForEngagement` | `crm_contacts` | src/lib/consultancy-actions.ts |
| `createRetainer` | `crm_contacts` | src/lib/consultancy-actions.ts |
| `updateRetainer` | `crm_contacts` | src/lib/consultancy-actions.ts |
| `getRetainersForEntity` | `crm_contacts` | src/lib/consultancy-actions.ts |
| `getEffectiveContactTypes` | `crm_contacts` | src/lib/contact-type-actions.ts |
| `saveContactTypeOverrides` | `crm_contacts` | src/lib/contact-type-actions.ts |
| `upsertContractAction` | `crm_contacts` | src/lib/contract-actions.ts |
| `sendContractAction` | `crm_contacts` | src/lib/contract-actions.ts |
| `deleteContractAction` | `crm_contacts` | src/lib/contract-actions.ts |
| `createCreditNoteAction` | `finance_subscriptions` | src/lib/credit-note-actions.ts |
| `getCreditNotesByAccountAction` | `finance_subscriptions` | src/lib/credit-note-actions.ts |
| `recordCustomPageEvent` | `analytics_reporting` | src/lib/custom-page-analytics-actions.ts |
| `getCustomPageAnalytics` | `analytics_reporting` | src/lib/custom-page-analytics-actions.ts |
| `listTrackedPages` | `analytics_reporting` | src/lib/custom-page-analytics-actions.ts |
| `assignCustomPageWorkspaceAction` | `analytics_reporting` | src/lib/custom-page-analytics-actions.ts |
| `createDocumentAction` | `crm_contacts` | src/lib/document-actions.ts |
| `updateDocumentAction` | `crm_contacts` | src/lib/document-actions.ts |
| `deleteDocumentAction` | `crm_contacts` | src/lib/document-actions.ts |
| `verifyDocumentPasscodeAction` | `crm_contacts` | src/lib/document-actions.ts |
| `submitDocumentLeadAction` | `crm_contacts` | src/lib/document-actions.ts |
| `recordDocumentEventAction` | `crm_contacts` | src/lib/document-actions.ts |
| `getWorkspaceAdvancedAnalyticsAction` | `analytics_reporting` | src/lib/documents/advanced-analytics-actions.ts |
| `generateDocumentSummaryAction` | `crm_contacts` | src/lib/documents/ai-document-actions.ts |
| `recommendDocumentHotspotsAction` | `crm_contacts` | src/lib/documents/ai-document-actions.ts |
| `askDocumentQuestionAction` | `crm_contacts` | src/lib/documents/ai-document-actions.ts |
| `applyAiRecommendedHotspotAction` | `crm_contacts` | src/lib/documents/ai-document-actions.ts |
| `saveAiSummaryToDocumentMetadataAction` | `crm_contacts` | src/lib/documents/ai-document-actions.ts |
| `getDocumentAnalyticsAction` | `analytics_reporting` | src/lib/documents/analytics-actions.ts |
| `getContactDocumentInsightsAction` | `crm_contacts` | src/lib/documents/crm-actions.ts |
| `linkContactDocumentSessionAction` | `crm_contacts` | src/lib/documents/crm-actions.ts |
| `awardContactScoreAction` | `crm_contacts` | src/lib/documents/crm-actions.ts |
| `createDocumentDistributionAction` | `crm_contacts` | src/lib/documents/distribution-actions.ts |
| `revokeDocumentDistributionAction` | `crm_contacts` | src/lib/documents/distribution-actions.ts |
| `resolveDistributionTokenAction` | `crm_contacts` | src/lib/documents/distribution-actions.ts |
| `getWorkspaceHealthReportAction` | `crm_contacts` | src/lib/documents/document-observability-actions.ts |
| `recordObservabilityMetricAction` | `crm_contacts` | src/lib/documents/document-observability-actions.ts |
| `reorderDocumentPagesAction` | `crm_contacts` | src/lib/documents/document-page-actions.ts |
| `duplicateDocumentPageAction` | `crm_contacts` | src/lib/documents/document-page-actions.ts |
| `deleteDocumentPageAction` | `crm_contacts` | src/lib/documents/document-page-actions.ts |
| `createDocumentVersionAction` | `crm_contacts` | src/lib/documents/document-version-actions.ts |
| `promoteDocumentVersionAction` | `crm_contacts` | src/lib/documents/document-version-actions.ts |
| `archiveDocumentVersionAction` | `crm_contacts` | src/lib/documents/document-version-actions.ts |
| `getDocumentVersionsAction` | `crm_contacts` | src/lib/documents/document-version-actions.ts |
| `auditWorkspaceSecurityPostureAction` | `crm_contacts` | src/lib/documents/enterprise-security-actions.ts |
| `executeLayerActionServerAction` | `crm_contacts` | src/lib/documents/interactive-layer-actions.ts |
| `queueDocumentProcessingAction` | `crm_contacts` | src/lib/documents/processing-actions.ts |
| `getProcessingJobStatusAction` | `crm_contacts` | src/lib/documents/processing-actions.ts |
| `retryFailedProcessingJobAction` | `crm_contacts` | src/lib/documents/processing-actions.ts |
| `convertToOnboardingAction` | `crm_contacts` | src/lib/entity-actions.ts |
| `lockWorkspaceScope` | `crm_contacts` | src/lib/entity-actions.ts |
| `saveAudienceAction` | `experience_portal` | src/lib/experience-actions.ts |
| `fetchAudiencesAction` | `experience_portal` | src/lib/experience-actions.ts |
| `saveExperienceRuleAction` | `experience_portal` | src/lib/experience-actions.ts |
| `fetchPageExperienceRulesAction` | `experience_portal` | src/lib/experience-actions.ts |
| `saveExperimentAction` | `crm_contacts` | src/lib/experiment-actions.ts |
| `fetchPageExperimentsAction` | `crm_contacts` | src/lib/experiment-actions.ts |
| `promoteWinnerVariantAction` | `crm_contacts` | src/lib/experiment-actions.ts |
| `updateOrganizationFeaturesAction` | `crm_contacts` | src/lib/feature-actions.ts |
| `updateWorkspaceFeaturesAction` | `crm_contacts` | src/lib/feature-actions.ts |
| `createFieldGroupAction` | `crm_contacts` | src/lib/fields-actions.ts |
| `updateFieldGroupAction` | `crm_contacts` | src/lib/fields-actions.ts |
| `deleteFieldGroupAction` | `crm_contacts` | src/lib/fields-actions.ts |
| `reorderFieldGroupsAction` | `crm_contacts` | src/lib/fields-actions.ts |
| `moveFieldToGroupAction` | `crm_contacts` | src/lib/fields-actions.ts |
| `createFieldAction` | `crm_contacts` | src/lib/fields-actions.ts |
| `updateFieldAction` | `crm_contacts` | src/lib/fields-actions.ts |
| `deleteFieldAction` | `crm_contacts` | src/lib/fields-actions.ts |
| `seedNativeFieldsAction` | `crm_contacts` | src/lib/fields-actions.ts |
| `getFieldGroupsForWorkspace` | `crm_contacts` | src/lib/fields-actions.ts |
| `getFieldsForWorkspace` | `crm_contacts` | src/lib/fields-actions.ts |
| `getWorkspaceVariablesAction` | `crm_contacts` | src/lib/fields-actions.ts |
| `listIndustryPredefinedGroupsAction` | `crm_contacts` | src/lib/fields-actions.ts |
| `installPredefinedIndustryGroupsAction` | `crm_contacts` | src/lib/fields-actions.ts |
| `getOrCreateFinancialAccountAction` | `finance_subscriptions` | src/lib/finance-actions.ts |
| `recordPaymentAction` | `finance_subscriptions` | src/lib/finance-actions.ts |
| `getAccountLedgerAction` | `finance_subscriptions` | src/lib/finance-actions.ts |
| `getUnpaidInvoicesForEntityAction` | `finance_subscriptions` | src/lib/finance-actions.ts |
| `runReminderCycleAction` | `automation_workflows` | src/lib/finance-automation-actions.ts |
| `sendInvoiceReminderAction` | `automation_workflows` | src/lib/finance-automation-actions.ts |
| `getReminderLogsAction` | `automation_workflows` | src/lib/finance-automation-actions.ts |
| `createFlipbookAction` | `crm_contacts` | src/lib/flipbook-actions.ts |
| `updateFlipbookAction` | `crm_contacts` | src/lib/flipbook-actions.ts |
| `deleteFlipbookAction` | `crm_contacts` | src/lib/flipbook-actions.ts |
| `submitFlipbookLeadAction` | `crm_contacts` | src/lib/flipbook-actions.ts |
| `logFlipbookAnalyticsAction` | `crm_contacts` | src/lib/flipbook-actions.ts |
| `submitStandaloneFormAction` | `forms_surveys` | src/lib/form-actions.ts |
| `getWorkspaceTeamMembersAction` | `forms_surveys` | src/lib/forms/crm-integration-actions.ts |
| `saveFormCrmSettingsAction` | `forms_surveys` | src/lib/forms/crm-integration-actions.ts |
| `suggestFormQuestionsAction` | `forms_surveys` | src/lib/forms/form-ai-actions.ts |
| `optimizeFormWithAiAction` | `forms_surveys` | src/lib/forms/form-ai-actions.ts |
| `generateFormLogicWithAiAction` | `forms_surveys` | src/lib/forms/form-ai-actions.ts |
| `rewriteQuestionCopyAction` | `forms_surveys` | src/lib/forms/form-ai-actions.ts |
| `recordFormTelemetryEventAction` | `forms_surveys` | src/lib/forms/form-analytics-actions.ts |
| `exportAnalyticsDataAsCsvAction` | `forms_surveys` | src/lib/forms/form-analytics-actions.ts |
| `updateFormSlugAction` | `forms_surveys` | src/lib/forms/form-distribution-actions.ts |
| `createDistributionLinkAction` | `forms_surveys` | src/lib/forms/form-distribution-actions.ts |
| `deleteDistributionLinkAction` | `forms_surveys` | src/lib/forms/form-distribution-actions.ts |
| `saveFormDraftAction` | `forms_surveys` | src/lib/forms/form-draft-actions.ts |
| `loadFormDraftAction` | `forms_surveys` | src/lib/forms/form-draft-actions.ts |
| `classifySubmissionAction` | `forms_surveys` | src/lib/forms/form-intelligence-actions.ts |
| `batchClassifySubmissionsAction` | `forms_surveys` | src/lib/forms/form-intelligence-actions.ts |
| `executeRecommendedAction` | `forms_surveys` | src/lib/forms/form-intelligence-actions.ts |
| `saveFormNotificationSettingsAction` | `forms_surveys` | src/lib/forms/form-notification-actions.ts |
| `getWorkspaceNotificationTemplatesAction` | `forms_surveys` | src/lib/forms/form-notification-actions.ts |
| `sendTestFormNotificationAction` | `forms_surveys` | src/lib/forms/form-notification-actions.ts |
| `dispatchFormNotifications` | `forms_surveys` | src/lib/forms/form-notification-actions.ts |
| `computeFormHealthScoreAction` | `forms_surveys` | src/lib/forms/form-optimization-actions.ts |
| `scanFormAnomaliesAction` | `forms_surveys` | src/lib/forms/form-optimization-actions.ts |
| `getFormExperimentsAction` | `forms_surveys` | src/lib/forms/form-optimization-actions.ts |
| `createFormExperimentAction` | `forms_surveys` | src/lib/forms/form-optimization-actions.ts |
| `updateExperimentStatusAction` | `forms_surveys` | src/lib/forms/form-optimization-actions.ts |
| `promoteWinningVariantAction` | `forms_surveys` | src/lib/forms/form-optimization-actions.ts |
| `getWorkspaceFormsExecutiveReportAction` | `forms_surveys` | src/lib/forms/form-reports-actions.ts |
| `saveScheduledReportConfigAction` | `forms_surveys` | src/lib/forms/form-reports-actions.ts |
| `getScheduledReportConfigAction` | `forms_surveys` | src/lib/forms/form-reports-actions.ts |
| `sendTestReportEmailAction` | `forms_surveys` | src/lib/forms/form-reports-actions.ts |
| `updateSubmissionStatusAction` | `forms_surveys` | src/lib/forms/form-response-actions.ts |
| `bulkUpdateSubmissionsAction` | `forms_surveys` | src/lib/forms/form-response-actions.ts |
| `addSubmissionNoteAction` | `forms_surveys` | src/lib/forms/form-response-actions.ts |
| `getSubmissionNotesAction` | `forms_surveys` | src/lib/forms/form-response-actions.ts |
| `saveFormSavedViewAction` | `forms_surveys` | src/lib/forms/form-response-actions.ts |
| `getFormSavedViewsAction` | `forms_surveys` | src/lib/forms/form-response-actions.ts |
| `deleteFormSavedViewAction` | `forms_surveys` | src/lib/forms/form-response-actions.ts |
| `initializeFormSessionAction` | `forms_surveys` | src/lib/forms/form-session-actions.ts |
| `recordFormEventAction` | `forms_surveys` | src/lib/forms/form-session-actions.ts |
| `createFormAction` | `forms_surveys` | src/lib/forms-actions.ts |
| `updateFormAction` | `forms_surveys` | src/lib/forms-actions.ts |
| `deleteFormAction` | `forms_surveys` | src/lib/forms-actions.ts |
| `cloneFormAction` | `forms_surveys` | src/lib/forms-actions.ts |
| `toggleFormStatusAction` | `forms_surveys` | src/lib/forms-actions.ts |
| `processFormSubmissionAction` | `forms_surveys` | src/lib/forms-actions.ts |
| `getFormByIdAction` | `forms_surveys` | src/lib/forms-actions.ts |
| `getPublicFormDefinitionAction` | `forms_surveys` | src/lib/forms-actions.ts |
| `exportSubmissionsAsCsvAction` | `forms_surveys` | src/lib/forms-actions.ts |
| `getFormWithVersionAction` | `forms_surveys` | src/lib/forms-version-actions.ts |
| `saveFormDraftVersionAction` | `forms_surveys` | src/lib/forms-version-actions.ts |
| `publishFormVersionAction` | `forms_surveys` | src/lib/forms-version-actions.ts |
| `recordAuditLogAction` | `ai_governance` | src/lib/governance-actions.ts |
| `submitApprovalRequestAction` | `ai_governance` | src/lib/governance-actions.ts |
| `reviewApprovalRequestAction` | `ai_governance` | src/lib/governance-actions.ts |
| `fetchPageAuditLogsAction` | `ai_governance` | src/lib/governance-actions.ts |
| `exportEntitiesToCSVAction` | `crm_contacts` | src/lib/import-export/entity-export-actions.ts |
| `validateImportBatch` | `crm_contacts` | src/lib/import-export/entity-import-actions.ts |
| `executeImportBatch` | `crm_contacts` | src/lib/import-export/entity-import-actions.ts |
| `saveInsightAction` | `crm_contacts` | src/lib/insight-actions.ts |
| `fetchPageInsightsAction` | `crm_contacts` | src/lib/insight-actions.ts |
| `dismissInsightAction` | `crm_contacts` | src/lib/insight-actions.ts |
| `getExecutiveIntelligenceAction` | `crm_contacts` | src/lib/intelligence/actions/intelligence-actions.ts |
| `listRecommendationsAction` | `crm_contacts` | src/lib/intelligence/actions/intelligence-actions.ts |
| `adjudicateRecommendationAction` | `crm_contacts` | src/lib/intelligence/actions/intelligence-actions.ts |
| `runObservationScanAction` | `crm_contacts` | src/lib/intelligence/actions/intelligence-actions.ts |
| `getSelfHealingHealthAction` | `crm_contacts` | src/lib/intelligence/actions/intelligence-actions.ts |
| `executeSelfHealingAction` | `crm_contacts` | src/lib/intelligence/actions/intelligence-actions.ts |
| `generateComplianceExportAction` | `crm_contacts` | src/lib/intelligence/actions/intelligence-actions.ts |
| `executeCryptographicDeletionAction` | `crm_contacts` | src/lib/intelligence/actions/intelligence-actions.ts |
| `getFederatedBenchmarksAction` | `crm_contacts` | src/lib/intelligence/actions/intelligence-actions.ts |
| `processMeetingInvitations` | `crm_contacts` | src/lib/invitation-actions.ts |
| `createMatter` | `crm_contacts` | src/lib/law-actions.ts |
| `updateMatterStatus` | `crm_contacts` | src/lib/law-actions.ts |
| `getMattersForEntity` | `crm_contacts` | src/lib/law-actions.ts |
| `createIntakeForm` | `crm_contacts` | src/lib/law-actions.ts |
| `getIntakeFormsForEntity` | `crm_contacts` | src/lib/law-actions.ts |
| `createConflictCheck` | `crm_contacts` | src/lib/law-actions.ts |
| `updateConflictCheckStatus` | `crm_contacts` | src/lib/law-actions.ts |
| `getConflictChecksForEntity` | `crm_contacts` | src/lib/law-actions.ts |
| `createConsultation` | `crm_contacts` | src/lib/law-actions.ts |
| `updateConsultation` | `crm_contacts` | src/lib/law-actions.ts |
| `getConsultationsForEntity` | `crm_contacts` | src/lib/law-actions.ts |
| `createRelatedParty` | `crm_contacts` | src/lib/law-actions.ts |
| `getRelatedPartiesForMatter` | `crm_contacts` | src/lib/law-actions.ts |
| `createLegalDocument` | `crm_contacts` | src/lib/law-actions.ts |
| `getLegalDocumentsForEntity` | `crm_contacts` | src/lib/law-actions.ts |
| `getLegalDocumentsForMatter` | `crm_contacts` | src/lib/law-actions.ts |
| `createTimeEntry` | `crm_contacts` | src/lib/law-actions.ts |
| `getTimeEntriesForMatter` | `crm_contacts` | src/lib/law-actions.ts |
| `getTimeEntriesForEntity` | `crm_contacts` | src/lib/law-actions.ts |
| `createCourtDate` | `crm_contacts` | src/lib/law-actions.ts |
| `updateCourtDate` | `crm_contacts` | src/lib/law-actions.ts |
| `getCourtDatesForMatter` | `crm_contacts` | src/lib/law-actions.ts |
| `getUpcomingCourtDatesForEntity` | `crm_contacts` | src/lib/law-actions.ts |
| `getLeadsForPageAction` | `crm_contacts` | src/lib/lead-actions.ts |
| `processLeadCaptureAction` | `crm_contacts` | src/lib/lead-actions.ts |
| `createLearningSignalAction` | `experience_portal` | src/lib/learning-loop-actions.ts |
| `finalizeLearningSignalAction` | `experience_portal` | src/lib/learning-loop-actions.ts |
| `updateSignalRatingAction` | `experience_portal` | src/lib/learning-loop-actions.ts |
| `deleteLearningSignalsBySurveyAction` | `experience_portal` | src/lib/learning-loop-actions.ts |
| `getGoldStandardExamples` | `experience_portal` | src/lib/learning-loop-actions.ts |
| `createCampaign` | `crm_contacts` | src/lib/marketing-actions.ts |
| `updateCampaign` | `crm_contacts` | src/lib/marketing-actions.ts |
| `getCampaignsForEntity` | `crm_contacts` | src/lib/marketing-actions.ts |
| `updateProposal` | `crm_contacts` | src/lib/marketing-actions.ts |
| `createDeliverable` | `crm_contacts` | src/lib/marketing-actions.ts |
| `updateDeliverableStatus` | `crm_contacts` | src/lib/marketing-actions.ts |
| `recordPerformanceMetric` | `crm_contacts` | src/lib/marketing-actions.ts |
| `createClientReport` | `crm_contacts` | src/lib/marketing-actions.ts |
| `updateClientReport` | `crm_contacts` | src/lib/marketing-actions.ts |
| `getClientReportsForEntity` | `crm_contacts` | src/lib/marketing-actions.ts |
| `createStrategyDoc` | `crm_contacts` | src/lib/marketing-actions.ts |
| `updateStrategyDoc` | `crm_contacts` | src/lib/marketing-actions.ts |
| `getStrategyDocsForEntity` | `crm_contacts` | src/lib/marketing-actions.ts |
| `listMcpToolsAction` | `ai_governance` | src/lib/mcp/actions/mcp-governance-actions.ts |
| `executeMcpToolAction` | `ai_governance` | src/lib/mcp/actions/mcp-governance-actions.ts |
| `listPendingApprovalsAction` | `ai_governance` | src/lib/mcp/actions/mcp-governance-actions.ts |
| `adjudicateApprovalAction` | `ai_governance` | src/lib/mcp/actions/mcp-governance-actions.ts |
| `listMcpApiKeysAction` | `ai_governance` | src/lib/mcp/actions/mcp-governance-actions.ts |
| `createMcpApiKeyAction` | `ai_governance` | src/lib/mcp/actions/mcp-governance-actions.ts |
| `revokeMcpApiKeyAction` | `ai_governance` | src/lib/mcp/actions/mcp-governance-actions.ts |
| `listMcpAuditLogsAction` | `ai_governance` | src/lib/mcp/actions/mcp-governance-actions.ts |
| `upsertMcpApprovalPolicyAction` | `ai_governance` | src/lib/mcp/actions/mcp-governance-actions.ts |
| `updateMediaName` | `media_creative` | src/lib/media-actions.ts |
| `deleteMediaAsset` | `media_creative` | src/lib/media-actions.ts |
| `saveImageToMediaLibrary` | `media_creative` | src/lib/media-actions.ts |
| `recordMediaPageEventAction` | `media_creative` | src/lib/media-analytics-actions.ts |
| `listMediaSharesWithStatsAction` | `media_creative` | src/lib/media-analytics-actions.ts |
| `getMediaShareDrilldownAction` | `media_creative` | src/lib/media-analytics-actions.ts |
| `checkSlugAvailabilityAction` | `media_creative` | src/lib/media-analytics-actions.ts |
| `recordExperimentEventServerAction` | `media_creative` | src/lib/media-analytics-actions.ts |
| `bulkApplyTagsToMediaContactsAction` | `media_creative` | src/lib/media-analytics-entity-actions.ts |
| `bulkMoveMediaContactsStageAction` | `media_creative` | src/lib/media-analytics-entity-actions.ts |
| `transferMediaAutomationsAction` | `automation_workflows` | src/lib/media-automation-actions.ts |
| `extractActionItemsFromTranscript` | `meetings_conversations` | src/lib/meetings/action-items-service.ts |
| `getCompanyBrainHealthAction` | `knowledge_memory` | src/lib/memory/actions/backoffice-companybrain-actions.ts |
| `triggerCompanyBrainReindexAction` | `knowledge_memory` | src/lib/memory/actions/backoffice-companybrain-actions.ts |
| `clearEmbeddingCacheAction` | `knowledge_memory` | src/lib/memory/actions/backoffice-companybrain-actions.ts |
| `synthesizeContextDossierWithAIAction` | `knowledge_memory` | src/lib/memory/actions/context-builder-actions.ts |
| `getWorkspaceGraphAction` | `knowledge_memory` | src/lib/memory/actions/graph-actions.ts |
| `explainGraphConnectionAction` | `knowledge_memory` | src/lib/memory/actions/graph-actions.ts |
| `createGraphEdgeAction` | `knowledge_memory` | src/lib/memory/actions/graph-actions.ts |
| `deleteGraphEdgeAction` | `knowledge_memory` | src/lib/memory/actions/graph-actions.ts |
| `getGraphTopologyMetricsAction` | `knowledge_memory` | src/lib/memory/actions/graph-actions.ts |
| `syncWorkspaceGraphMeshAction` | `knowledge_memory` | src/lib/memory/actions/graph-actions.ts |
| `extractMemoriesFromNoteAction` | `knowledge_memory` | src/lib/memory/actions/memory-actions.ts |
| `confirmMemoryAction` | `knowledge_memory` | src/lib/memory/actions/memory-actions.ts |
| `invalidateMemoryAction` | `knowledge_memory` | src/lib/memory/actions/memory-actions.ts |
| `updateMemoryAction` | `knowledge_memory` | src/lib/memory/actions/memory-actions.ts |
| `getMemoryHealthStatsAction` | `knowledge_memory` | src/lib/memory/actions/memory-actions.ts |
| `scanMemoryConflictsBatchAction` | `knowledge_memory` | src/lib/memory/actions/orchestrator-actions.ts |
| `reconfirmMemoryFreshnessAction` | `knowledge_memory` | src/lib/memory/actions/orchestrator-actions.ts |
| `findConsolidationCandidatesAction` | `knowledge_memory` | src/lib/memory/actions/orchestrator-actions.ts |
| `applyConsolidationAction` | `knowledge_memory` | src/lib/memory/actions/orchestrator-actions.ts |
| `unifiedRecallAction` | `knowledge_memory` | src/lib/memory/actions/orchestrator-actions.ts |
| `semanticSearchMemoriesAction` | `knowledge_memory` | src/lib/memory/actions/semantic-search-actions.ts |
| `reindexMemoryAction` | `knowledge_memory` | src/lib/memory/actions/semantic-search-actions.ts |
| `reindexWorkspaceMemoriesAction` | `knowledge_memory` | src/lib/memory/actions/semantic-search-actions.ts |
| `syncVariableRegistry` | `communication_messaging` | src/lib/messaging-actions.ts |
| `syncAllLogStatuses` | `communication_messaging` | src/lib/messaging-actions.ts |
| `upsertConstantVariable` | `communication_messaging` | src/lib/messaging-actions.ts |
| `updateVariableVisibility` | `communication_messaging` | src/lib/messaging-actions.ts |
| `deleteVariable` | `communication_messaging` | src/lib/messaging-actions.ts |
| `fetchContextualData` | `communication_messaging` | src/lib/messaging-actions.ts |
| `clearVariablesForSource` | `communication_messaging` | src/lib/messaging-actions.ts |
| `resolveTagVariables` | `communication_messaging` | src/lib/messaging-actions.ts |
| `previewCampaignAudience` | `communication_messaging` | src/lib/messaging-actions.ts |
| `resolveRecipientContacts` | `communication_messaging` | src/lib/messaging-actions.ts |
| `updateEntityLastContactedAt` | `communication_messaging` | src/lib/messaging-actions.ts |
| `getSimulationVariablesAction` | `communication_messaging` | src/lib/messaging-actions.ts |
| `getUniqueEntityMetrics` | `analytics_reporting` | src/lib/metrics-actions.ts |
| `getWorkspaceMembershipMetrics` | `analytics_reporting` | src/lib/metrics-actions.ts |
| `getSharedContactMetrics` | `analytics_reporting` | src/lib/metrics-actions.ts |
| `getMigrationParityStatusAction` | `crm_contacts` | src/lib/migration-actions.ts |
| `executeFinanceMigrationAction` | `crm_contacts` | src/lib/migration-actions.ts |
| `recalibrateSummaryAction` | `crm_contacts` | src/lib/migration-actions.ts |
| `fetchSmsBalanceAction` | `communication_messaging` | src/lib/mnotify-actions.ts |
| `checkSenderIdStatusAction` | `communication_messaging` | src/lib/mnotify-actions.ts |
| `registerSenderIdAction` | `communication_messaging` | src/lib/mnotify-actions.ts |
| `fetchScheduledMessagesAction` | `communication_messaging` | src/lib/mnotify-actions.ts |
| `updateScheduledMessageAction` | `communication_messaging` | src/lib/mnotify-actions.ts |
| `deleteScheduledMessageAction` | `communication_messaging` | src/lib/mnotify-actions.ts |
| `fetchSmsReportsAction` | `communication_messaging` | src/lib/mnotify-actions.ts |
| `logNoteActivity` | `knowledge_memory` | src/lib/note-actions.ts |
| `getEntityAiSummary` | `knowledge_memory` | src/lib/note-actions.ts |
| `sendReceiptAcknowledgementAction` | `crm_contacts` | src/lib/notification-actions.ts |
| `fetchPlatformObservabilityAction` | `crm_contacts` | src/lib/observability-actions.ts |
| `purgeEdgeCacheAction` | `crm_contacts` | src/lib/observability-actions.ts |
| `saveCampaignOrchestrationAction` | `crm_contacts` | src/lib/orchestration-actions.ts |
| `triggerCrossChannelSyncAction` | `crm_contacts` | src/lib/orchestration-actions.ts |
| `saveOrganizationAction` | `identity_access` | src/lib/organization-actions.ts |
| `deleteOrganizationAction` | `identity_access` | src/lib/organization-actions.ts |
| `archiveOrganizationAction` | `identity_access` | src/lib/organization-actions.ts |
| `setOrganizationDefaultWorkspaceAction` | `identity_access` | src/lib/organization-actions.ts |
| `duplicatePageAction` | `crm_contacts` | src/lib/page-actions.ts |
| `updatePageStatusAction` | `crm_contacts` | src/lib/page-actions.ts |
| `deletePageAction` | `crm_contacts` | src/lib/page-actions.ts |
| `registerCustomCodedPage` | `crm_contacts` | src/lib/page-registry-actions.ts |
| `seedKnownCustomPages` | `crm_contacts` | src/lib/page-registry-actions.ts |
| `generatePdfBuffer` | `crm_contacts` | src/lib/pdf-actions.ts |
| `saveAgreementProgressAction` | `crm_contacts` | src/lib/pdf-actions.ts |
| `finalizeAgreementAction` | `crm_contacts` | src/lib/pdf-actions.ts |
| `createPdfForm` | `crm_contacts` | src/lib/pdf-actions.ts |
| `clonePdfForm` | `crm_contacts` | src/lib/pdf-actions.ts |
| `savePdfForm` | `crm_contacts` | src/lib/pdf-actions.ts |
| `updatePdfFormStatus` | `crm_contacts` | src/lib/pdf-actions.ts |
| `deletePdfForm` | `crm_contacts` | src/lib/pdf-actions.ts |
| `deleteSubmissions` | `crm_contacts` | src/lib/pdf-actions.ts |
| `purgeContractAction` | `crm_contacts` | src/lib/pdf-actions.ts |
| `updatePdfResultsSharing` | `crm_contacts` | src/lib/pdf-actions.ts |
| `updatePdfFormMapping` | `crm_contacts` | src/lib/pdf-actions.ts |
| `savePerspectiveAction` | `crm_contacts` | src/lib/perspective-actions.ts |
| `deletePerspectiveAction` | `crm_contacts` | src/lib/perspective-actions.ts |
| `archivePerspectiveAction` | `crm_contacts` | src/lib/perspective-actions.ts |
| `createPipelineWithStagesAction` | `deals_revenue` | src/lib/pipeline-actions.ts |
| `savePipelineAction` | `deals_revenue` | src/lib/pipeline-actions.ts |
| `setPipelineAsDefaultAction` | `deals_revenue` | src/lib/pipeline-actions.ts |
| `deletePipelineAction` | `deals_revenue` | src/lib/pipeline-actions.ts |
| `archivePipelineAction` | `deals_revenue` | src/lib/pipeline-actions.ts |
| `clonePipelineAction` | `deals_revenue` | src/lib/pipeline-actions.ts |
| `createDefaultPipelineForIndustry` | `deals_revenue` | src/lib/pipeline-actions.ts |
| `getPlatformControlsAction` | `forms_surveys` | src/lib/platform/platform-controls-actions.ts |
| `setOutboundPausedAction` | `forms_surveys` | src/lib/platform/platform-controls-actions.ts |
| `createProductAction` | `crm_contacts` | src/lib/product-actions.ts |
| `updateProductAction` | `crm_contacts` | src/lib/product-actions.ts |
| `createPricingPlanAction` | `crm_contacts` | src/lib/product-actions.ts |
| `updateProfile` | `crm_contacts` | src/lib/profile-actions.ts |
| `createQRCode` | `media_creative` | src/lib/qr-actions.ts |
| `batchCreateQRCodes` | `media_creative` | src/lib/qr-actions.ts |
| `generateQRsForAudienceAction` | `media_creative` | src/lib/qr-actions.ts |
| `bulkTagQRCodesAction` | `media_creative` | src/lib/qr-actions.ts |
| `getQRCode` | `media_creative` | src/lib/qr-actions.ts |
| `getQRCodeByUrl` | `media_creative` | src/lib/qr-actions.ts |
| `listQRCodes` | `media_creative` | src/lib/qr-actions.ts |
| `updateQRCode` | `media_creative` | src/lib/qr-actions.ts |
| `updateQRDesign` | `media_creative` | src/lib/qr-actions.ts |
| `updateQRDestination` | `media_creative` | src/lib/qr-actions.ts |
| `updateQRLifecycle` | `media_creative` | src/lib/qr-actions.ts |
| `updateQRSecurity` | `media_creative` | src/lib/qr-actions.ts |
| `scheduleQRCode` | `media_creative` | src/lib/qr-actions.ts |
| `expireQRCode` | `media_creative` | src/lib/qr-actions.ts |
| `pauseQRCode` | `media_creative` | src/lib/qr-actions.ts |
| `resumeQRCode` | `media_creative` | src/lib/qr-actions.ts |
| `archiveQRCode` | `media_creative` | src/lib/qr-actions.ts |
| `updateQRShortPath` | `media_creative` | src/lib/qr-actions.ts |
| `bulkQRAction` | `media_creative` | src/lib/qr-actions.ts |
| `duplicateQRCode` | `media_creative` | src/lib/qr-actions.ts |
| `deleteQRCode` | `media_creative` | src/lib/qr-actions.ts |
| `saveQRTemplate` | `media_creative` | src/lib/qr-actions.ts |
| `updateQRTemplate` | `media_creative` | src/lib/qr-actions.ts |
| `listQRTemplates` | `media_creative` | src/lib/qr-actions.ts |
| `deleteQRTemplate` | `media_creative` | src/lib/qr-actions.ts |
| `getQRCodeByShortPath` | `media_creative` | src/lib/qr-actions.ts |
| `getQRStudioStats` | `media_creative` | src/lib/qr-actions.ts |
| `createQRCampaign` | `campaigns_marketing` | src/lib/qr-campaign-actions.ts |
| `updateQRCampaign` | `campaigns_marketing` | src/lib/qr-campaign-actions.ts |
| `deleteQRCampaign` | `campaigns_marketing` | src/lib/qr-campaign-actions.ts |
| `addQRCodesToCampaign` | `campaigns_marketing` | src/lib/qr-campaign-actions.ts |
| `removeQRCodeFromCampaign` | `campaigns_marketing` | src/lib/qr-campaign-actions.ts |
| `getQRCampaigns` | `campaigns_marketing` | src/lib/qr-campaign-actions.ts |
| `getCampaignAnalytics` | `campaigns_marketing` | src/lib/qr-campaign-actions.ts |
| `addCustomDomain` | `media_creative` | src/lib/qr-domain-security-actions.ts |
| `verifyCustomDomain` | `media_creative` | src/lib/qr-domain-security-actions.ts |
| `setDefaultCustomDomain` | `media_creative` | src/lib/qr-domain-security-actions.ts |
| `deleteCustomDomain` | `media_creative` | src/lib/qr-domain-security-actions.ts |
| `getCustomDomains` | `media_creative` | src/lib/qr-domain-security-actions.ts |
| `recordScanEvent` | `media_creative` | src/lib/qr-scan-actions.ts |
| `getQRAnalytics` | `media_creative` | src/lib/qr-scan-actions.ts |
| `logQuickNoteActivity` | `knowledge_memory` | src/lib/quick-notes-actions.ts |
| `enrichNoteLink` | `knowledge_memory` | src/lib/quick-notes-actions.ts |
| `logQuickNoteCreated` | `knowledge_memory` | src/lib/quick-notes-actions.ts |
| `createQuickNoteAction` | `knowledge_memory` | src/lib/quick-notes-actions.ts |
| `generateQuickNoteInsight` | `knowledge_memory` | src/lib/quick-notes-ai-actions.ts |
| `generateQuickNotesDigest` | `knowledge_memory` | src/lib/quick-notes-ai-actions.ts |
| `createTaskFromActionItem` | `knowledge_memory` | src/lib/quick-notes-ai-actions.ts |
| `classifyDraftKnowledgeAction` | `knowledge_memory` | src/lib/quick-notes-ai-actions.ts |
| `aiAssistEditorAction` | `knowledge_memory` | src/lib/quick-notes-ai-actions.ts |
| `resolveNoteEntitiesAction` | `knowledge_memory` | src/lib/quick-notes-ai-actions.ts |
| `summarizeEntityTimelineAction` | `knowledge_memory` | src/lib/quick-notes-ai-actions.ts |
| `getWorkspaceCampaignConceptsAction` | `campaigns_marketing` | src/lib/quick-notes-campaign-actions.ts |
| `generateCampaignConceptAction` | `campaigns_marketing` | src/lib/quick-notes-campaign-actions.ts |
| `deployConceptToCampaignStudioAction` | `campaigns_marketing` | src/lib/quick-notes-campaign-actions.ts |
| `updateCampaignConceptStatusAction` | `campaigns_marketing` | src/lib/quick-notes-campaign-actions.ts |
| `deleteCampaignConceptAction` | `campaigns_marketing` | src/lib/quick-notes-campaign-actions.ts |
| `synthesizeCampaignLearningsAction` | `campaigns_marketing` | src/lib/quick-notes-campaign-actions.ts |
| `getWorkspaceBattlecardsAction` | `campaigns_marketing` | src/lib/quick-notes-campaign-actions.ts |
| `generateWorkspaceBattlecardsAction` | `campaigns_marketing` | src/lib/quick-notes-campaign-actions.ts |
| `createFederatedSpaceAction` | `knowledge_memory` | src/lib/quick-notes-federation-actions.ts |
| `updateFederatedSpaceAction` | `knowledge_memory` | src/lib/quick-notes-federation-actions.ts |
| `deleteFederatedSpaceAction` | `knowledge_memory` | src/lib/quick-notes-federation-actions.ts |
| `subscribeToFederatedSpaceAction` | `knowledge_memory` | src/lib/quick-notes-federation-actions.ts |
| `unsubscribeFromFederatedSpaceAction` | `knowledge_memory` | src/lib/quick-notes-federation-actions.ts |
| `publishCollectionToSpaceAction` | `knowledge_memory` | src/lib/quick-notes-federation-actions.ts |
| `getWorkspaceFederatedSpacesAction` | `knowledge_memory` | src/lib/quick-notes-federation-actions.ts |
| `exportWorkspaceKnowledgeAction` | `knowledge_memory` | src/lib/quick-notes-federation-actions.ts |
| `importKnowledgeArchiveAction` | `knowledge_memory` | src/lib/quick-notes-federation-actions.ts |
| `getFederatedKnowledgeFeedAction` | `knowledge_memory` | src/lib/quick-notes-federation-actions.ts |
| `generateIngestionWebhookKeyAction` | `knowledge_memory` | src/lib/quick-notes-federation-actions.ts |
| `cloneFederatedItemToWorkspaceAction` | `knowledge_memory` | src/lib/quick-notes-federation-actions.ts |
| `fetchAggregatedNotes` | `knowledge_memory` | src/lib/quick-notes-feed-actions.ts |
| `getWorkspaceKnowledgeGraphAction` | `knowledge_memory` | src/lib/quick-notes-graph-actions.ts |
| `createKnowledgeRelationAction` | `knowledge_memory` | src/lib/quick-notes-graph-actions.ts |
| `deleteKnowledgeRelationAction` | `knowledge_memory` | src/lib/quick-notes-graph-actions.ts |
| `suggestKnowledgeLinksAction` | `knowledge_memory` | src/lib/quick-notes-graph-actions.ts |
| `getBacklinksAction` | `knowledge_memory` | src/lib/quick-notes-graph-actions.ts |
| `backfillCrmRelationsAction` | `knowledge_memory` | src/lib/quick-notes-graph-actions.ts |
| `getWorkspaceIdeasAction` | `knowledge_memory` | src/lib/quick-notes-idea-actions.ts |
| `createIdeaAction` | `knowledge_memory` | src/lib/quick-notes-idea-actions.ts |
| `updateIdeaAction` | `knowledge_memory` | src/lib/quick-notes-idea-actions.ts |
| `deleteIdeaAction` | `knowledge_memory` | src/lib/quick-notes-idea-actions.ts |
| `developRawIdeaAiAction` | `knowledge_memory` | src/lib/quick-notes-idea-actions.ts |
| `challengeIdeaAssumptionsAiAction` | `knowledge_memory` | src/lib/quick-notes-idea-actions.ts |
| `decomposeIdeaCanvasAiAction` | `knowledge_memory` | src/lib/quick-notes-idea-actions.ts |
| `saveIdeaCanvasLayoutAction` | `knowledge_memory` | src/lib/quick-notes-idea-actions.ts |
| `convertIdeaToTaskAction` | `knowledge_memory` | src/lib/quick-notes-idea-actions.ts |
| `getWorkspaceInboxAction` | `knowledge_memory` | src/lib/quick-notes-insight-actions.ts |
| `reviewInboxItemAction` | `knowledge_memory` | src/lib/quick-notes-insight-actions.ts |
| `bulkReviewInboxAction` | `knowledge_memory` | src/lib/quick-notes-insight-actions.ts |
| `scanDuplicatesAction` | `knowledge_memory` | src/lib/quick-notes-insight-actions.ts |
| `detectWorkspaceContradictionsAction` | `knowledge_memory` | src/lib/quick-notes-insight-actions.ts |
| `generateWorkspaceInsightsAction` | `knowledge_memory` | src/lib/quick-notes-insight-actions.ts |
| `mergeDuplicateNotesAction` | `knowledge_memory` | src/lib/quick-notes-insight-actions.ts |
| `convertInsightToIdeaAction` | `knowledge_memory` | src/lib/quick-notes-insight-actions.ts |
| `convertInsightToTaskAction` | `knowledge_memory` | src/lib/quick-notes-insight-actions.ts |
| `getWorkspaceInsightsAction` | `knowledge_memory` | src/lib/quick-notes-insight-actions.ts |
| `deleteInsightAction` | `knowledge_memory` | src/lib/quick-notes-insight-actions.ts |
| `auditNoteGovernanceAction` | `knowledge_memory` | src/lib/quick-notes-insight-actions.ts |
| `commitOfflineBatchAction` | `knowledge_memory` | src/lib/quick-notes-offline-actions.ts |
| `getLatestServerSnapshotsAction` | `knowledge_memory` | src/lib/quick-notes-offline-actions.ts |
| `hybridSearchKnowledgeAction` | `knowledge_memory` | src/lib/quick-notes-search-actions.ts |
| `askSmartSappKnowledgeAction` | `knowledge_memory` | src/lib/quick-notes-search-actions.ts |
| `reindexWorkspaceKnowledgeAction` | `knowledge_memory` | src/lib/quick-notes-search-actions.ts |
| `createProperty` | `crm_contacts` | src/lib/real-estate-actions.ts |
| `updateProperty` | `crm_contacts` | src/lib/real-estate-actions.ts |
| `getPropertiesForEntity` | `crm_contacts` | src/lib/real-estate-actions.ts |
| `createPropertyPreference` | `crm_contacts` | src/lib/real-estate-actions.ts |
| `updatePropertyPreference` | `crm_contacts` | src/lib/real-estate-actions.ts |
| `getPropertyPreferencesForEntity` | `crm_contacts` | src/lib/real-estate-actions.ts |
| `createViewing` | `crm_contacts` | src/lib/real-estate-actions.ts |
| `updateViewingStatus` | `crm_contacts` | src/lib/real-estate-actions.ts |
| `getViewingsForProperty` | `crm_contacts` | src/lib/real-estate-actions.ts |
| `getViewingsForClient` | `crm_contacts` | src/lib/real-estate-actions.ts |
| `createOffer` | `crm_contacts` | src/lib/real-estate-actions.ts |
| `updateOfferStatus` | `crm_contacts` | src/lib/real-estate-actions.ts |
| `getOffersForProperty` | `crm_contacts` | src/lib/real-estate-actions.ts |
| `getOffersForBuyer` | `crm_contacts` | src/lib/real-estate-actions.ts |
| `createNegotiation` | `crm_contacts` | src/lib/real-estate-actions.ts |
| `updateNegotiation` | `crm_contacts` | src/lib/real-estate-actions.ts |
| `getNegotiationsForProperty` | `crm_contacts` | src/lib/real-estate-actions.ts |
| `getDealsForProperty` | `crm_contacts` | src/lib/real-estate-actions.ts |
| `getDealsForBuyer` | `crm_contacts` | src/lib/real-estate-actions.ts |
| `createPropertyDocument` | `crm_contacts` | src/lib/real-estate-actions.ts |
| `updatePropertyDocument` | `crm_contacts` | src/lib/real-estate-actions.ts |
| `getPropertyDocuments` | `crm_contacts` | src/lib/real-estate-actions.ts |
| `getWorkspaceAgingSummaryAction` | `crm_contacts` | src/lib/receivables-actions.ts |
| `getAccountAgingProfileAction` | `crm_contacts` | src/lib/receivables-actions.ts |
| `getCustomerStatementAction` | `crm_contacts` | src/lib/receivables-actions.ts |
| `getPublicStatementAction` | `crm_contacts` | src/lib/receivables-actions.ts |
| `getReconciliationReportAction` | `finance_subscriptions` | src/lib/reconciliation-actions.ts |
| `resolveReconciliationDiscrepancyAction` | `finance_subscriptions` | src/lib/reconciliation-actions.ts |
| `scheduleRemindersForMeeting` | `tasks_productivity` | src/lib/reminder-actions.ts |
| `rescheduleRemindersForMeeting` | `tasks_productivity` | src/lib/reminder-actions.ts |
| `scheduleMeetingInvitations` | `tasks_productivity` | src/lib/reminder-actions.ts |
| `scheduleFormReminders` | `tasks_productivity` | src/lib/reminder-actions.ts |
| `processScheduledMessages` | `tasks_productivity` | src/lib/reminder-actions.ts |
| `scheduleMessagingConfigReminders` | `tasks_productivity` | src/lib/reminder-actions.ts |
| `scheduleRegistrationAck` | `tasks_productivity` | src/lib/reminder-actions.ts |
| `scheduleFacilitatorAlerts` | `tasks_productivity` | src/lib/reminder-actions.ts |
| `sendFacilitatorNewRegistrationAlert` | `tasks_productivity` | src/lib/reminder-actions.ts |
| `scheduleRemindersForNewRegistrant` | `tasks_productivity` | src/lib/reminder-actions.ts |
| `autoEndCompletedMeetings` | `tasks_productivity` | src/lib/reminder-actions.ts |
| `processScheduledCampaigns` | `tasks_productivity` | src/lib/reminder-actions.ts |
| `getExecutiveFinanceMetricsAction` | `analytics_reporting` | src/lib/reporting-actions.ts |
| `getCashflowTrendAction` | `analytics_reporting` | src/lib/reporting-actions.ts |
| `getCollectorLeaderboardAction` | `analytics_reporting` | src/lib/reporting-actions.ts |
| `getRevenueReportAction` | `analytics_reporting` | src/lib/reporting-actions.ts |
| `getAgingReportAction` | `analytics_reporting` | src/lib/reporting-actions.ts |
| `getTaxAuditReportAction` | `analytics_reporting` | src/lib/reporting-actions.ts |
| `getReportAggregates` | `analytics_reporting` | src/lib/reports/report-actions.ts |
| `fetchVerifiedDomainsAction` | `communication_messaging` | src/lib/resend-actions.ts |
| `cancelScheduledEmailAction` | `communication_messaging` | src/lib/resend-actions.ts |
| `createTrial` | `crm_contacts` | src/lib/saas-actions.ts |
| `getTrialsForEntity` | `crm_contacts` | src/lib/saas-actions.ts |
| `updateTrialStatus` | `crm_contacts` | src/lib/saas-actions.ts |
| `createOnboarding` | `crm_contacts` | src/lib/saas-actions.ts |
| `updateOnboardingMilestone` | `crm_contacts` | src/lib/saas-actions.ts |
| `createSubscription` | `crm_contacts` | src/lib/saas-actions.ts |
| `updateSubscription` | `crm_contacts` | src/lib/saas-actions.ts |
| `createSupportTicket` | `crm_contacts` | src/lib/saas-actions.ts |
| `updateSupportTicket` | `crm_contacts` | src/lib/saas-actions.ts |
| `createHealthScore` | `crm_contacts` | src/lib/saas-actions.ts |
| `getLatestHealthScore` | `crm_contacts` | src/lib/saas-actions.ts |
| `recordProductUsage` | `crm_contacts` | src/lib/saas-actions.ts |
| `recordFeatureAdoption` | `crm_contacts` | src/lib/saas-actions.ts |
| `createApplication` | `school_operations` | src/lib/school-enrollment-actions.ts |
| `updateApplicationStatus` | `school_operations` | src/lib/school-enrollment-actions.ts |
| `getApplicationsForEntity` | `school_operations` | src/lib/school-enrollment-actions.ts |
| `createEnrollment` | `school_operations` | src/lib/school-enrollment-actions.ts |
| `updateEnrollmentStatus` | `school_operations` | src/lib/school-enrollment-actions.ts |
| `getEnrollmentsForEntity` | `school_operations` | src/lib/school-enrollment-actions.ts |
| `createSchoolVisit` | `school_operations` | src/lib/school-enrollment-actions.ts |
| `updateVisitStatus` | `school_operations` | src/lib/school-enrollment-actions.ts |
| `getSchoolVisitsForEntity` | `school_operations` | src/lib/school-enrollment-actions.ts |
| `applyTagAction` | `crm_contacts` | src/lib/scoped-tag-actions.ts |
| `removeTagAction` | `crm_contacts` | src/lib/scoped-tag-actions.ts |
| `saveSectionAction` | `crm_contacts` | src/lib/section-actions.ts |
| `getSectionTemplatesAction` | `crm_contacts` | src/lib/section-actions.ts |
| `AiActionProposalService` | `ai_governance` | src/lib/services/ai-admin/ai-action-proposal-service.ts |
| `loadSettings` | `crm_contacts` | src/lib/settings-actions.ts |
| `updateSettings` | `crm_contacts` | src/lib/settings-actions.ts |
| `createSettings` | `crm_contacts` | src/lib/settings-actions.ts |
| `handleSignupAction` | `crm_contacts` | src/lib/signup-actions.ts |
| `startSupervisorMissionAction` | `crm_contacts` | src/lib/supervisor/actions/supervisor-actions.ts |
| `resumeSupervisorMissionAction` | `crm_contacts` | src/lib/supervisor/actions/supervisor-actions.ts |
| `cancelSupervisorMissionAction` | `crm_contacts` | src/lib/supervisor/actions/supervisor-actions.ts |
| `getSupervisorRunAction` | `crm_contacts` | src/lib/supervisor/actions/supervisor-actions.ts |
| `listSupervisorRunsAction` | `crm_contacts` | src/lib/supervisor/actions/supervisor-actions.ts |
| `executeProposedActionAction` | `crm_contacts` | src/lib/supervisor/actions/supervisor-actions.ts |
| `listAgentDescriptorsAction` | `crm_contacts` | src/lib/supervisor/actions/supervisor-actions.ts |
| `syncSurveyUploadedFilesToMedia` | `forms_surveys` | src/lib/survey-actions.ts |
| `sanitizeEntityPayloadForUpdate` | `forms_surveys` | src/lib/survey-actions.ts |
| `getSurveysForContact` | `forms_surveys` | src/lib/survey-actions.ts |
| `getSurveyResponsesForContact` | `forms_surveys` | src/lib/survey-actions.ts |
| `cloneSurvey` | `forms_surveys` | src/lib/survey-actions.ts |
| `deleteSurveyAction` | `forms_surveys` | src/lib/survey-actions.ts |
| `updateSurveyStatusAction` | `forms_surveys` | src/lib/survey-actions.ts |
| `deleteSurveyResponses` | `forms_surveys` | src/lib/survey-actions.ts |
| `resolveOrMatchWorkspaceEntity` | `forms_surveys` | src/lib/survey-actions.ts |
| `submitPublicSurveyResponse` | `forms_surveys` | src/lib/survey-actions.ts |
| `triggerSurveyWebhook` | `forms_surveys` | src/lib/survey-actions.ts |
| `autoSaveSurveyAction` | `forms_surveys` | src/lib/survey-actions.ts |
| `submitPublicSurveyLead` | `forms_surveys` | src/lib/survey-actions.ts |
| `finalizeSurveySubmission` | `forms_surveys` | src/lib/survey-actions.ts |
| `executeSurveyPipelineAndAutomations` | `forms_surveys` | src/lib/survey-actions.ts |
| `executeSurveyResultButtonActions` | `forms_surveys` | src/lib/survey-actions.ts |
| `logSurveyStartedAction` | `forms_surveys` | src/lib/survey-actions.ts |
| `addOrMoveEntityInPipeline` | `forms_surveys` | src/lib/survey-actions.ts |
| `quickSaveSurveyTemplateAction` | `communication_messaging` | src/lib/survey-ai-messaging-actions.ts |
| `bulkApplyTagsToSurveyEntitiesAction` | `forms_surveys` | src/lib/survey-entity-actions.ts |
| `bulkMoveSurveyEntitiesStageAction` | `forms_surveys` | src/lib/survey-entity-actions.ts |
| `getQuestionBankItemsAction` | `forms_surveys` | src/lib/surveys/question-bank-actions.ts |
| `saveQuestionToBankAction` | `forms_surveys` | src/lib/surveys/question-bank-actions.ts |
| `seedSystemQuestionBankAction` | `forms_surveys` | src/lib/surveys/question-bank-actions.ts |
| `getSystemAiArchitectGovernanceAction` | `ai_governance` | src/lib/surveys/survey-ai-architect-governance-actions.ts |
| `saveSystemAiArchitectGovernanceAction` | `ai_governance` | src/lib/surveys/survey-ai-architect-governance-actions.ts |
| `generateSurveyThematicInsightsAction` | `forms_surveys` | src/lib/surveys/survey-ai-intelligence-actions.ts |
| `querySurveyResearchAssistantAction` | `forms_surveys` | src/lib/surveys/survey-ai-intelligence-actions.ts |
| `applySurveyAiOptimizationAction` | `forms_surveys` | src/lib/surveys/survey-ai-intelligence-actions.ts |
| `refineSurveyQuestionAction` | `forms_surveys` | src/lib/surveys/survey-ai-refinement-actions.ts |
| `getSurveyAnalyticsOverviewAction` | `forms_surveys` | src/lib/surveys/survey-analytics-actions.ts |
| `getSurveyCrossTabsAction` | `forms_surveys` | src/lib/surveys/survey-analytics-actions.ts |
| `exportSurveyDataAction` | `forms_surveys` | src/lib/surveys/survey-analytics-actions.ts |
| `getSurveyResponsesListAction` | `forms_surveys` | src/lib/surveys/survey-analytics-actions.ts |
| `createSurveyDistributionCampaignAction` | `campaigns_marketing` | src/lib/surveys/survey-campaign-actions.ts |
| `dispatchSurveyDistributionCampaignAction` | `campaigns_marketing` | src/lib/surveys/survey-campaign-actions.ts |
| `estimateAudienceSizeAction` | `campaigns_marketing` | src/lib/surveys/survey-campaign-actions.ts |
| `getSystemDispatchGovernanceAction` | `campaigns_marketing` | src/lib/surveys/survey-campaign-actions.ts |
| `saveSystemDispatchGovernanceAction` | `campaigns_marketing` | src/lib/surveys/survey-campaign-actions.ts |
| `executeSurveyCrmSyncAction` | `forms_surveys` | src/lib/surveys/survey-crm-sync-actions.ts |
| `getSurveyCrmFieldDefinitionsAction` | `forms_surveys` | src/lib/surveys/survey-crm-sync-actions.ts |
| `saveSurveyCrmConfigAction` | `forms_surveys` | src/lib/surveys/survey-crm-sync-actions.ts |
| `getSystemCrmFieldMappingTemplatesAction` | `forms_surveys` | src/lib/surveys/survey-crm-sync-actions.ts |
| `saveSystemCrmFieldMappingTemplatesAction` | `forms_surveys` | src/lib/surveys/survey-crm-sync-actions.ts |
| `getWorkspaceActiveSurveysAction` | `forms_surveys` | src/lib/surveys/survey-crm-trigger-actions.ts |
| `getEntitySurveyHistoryAction` | `forms_surveys` | src/lib/surveys/survey-crm-trigger-actions.ts |
| `sendSurveyToContactAction` | `forms_surveys` | src/lib/surveys/survey-crm-trigger-actions.ts |
| `executeCrmInboundSurveyTriggerAction` | `forms_surveys` | src/lib/surveys/survey-crm-trigger-actions.ts |
| `createSurveyDeploymentAction` | `forms_surveys` | src/lib/surveys/survey-deployment-actions.ts |
| `getSurveyDeploymentsAction` | `forms_surveys` | src/lib/surveys/survey-deployment-actions.ts |
| `updateDeploymentStatusAction` | `forms_surveys` | src/lib/surveys/survey-deployment-actions.ts |
| `saveSurveyExperimentConfigAction` | `forms_surveys` | src/lib/surveys/survey-experiment-actions.ts |
| `getSurveyExperimentResultsAction` | `forms_surveys` | src/lib/surveys/survey-experiment-actions.ts |
| `promoteWinningVariantAction` | `forms_surveys` | src/lib/surveys/survey-experiment-actions.ts |
| `suggestSurveyVariantCopyAction` | `forms_surveys` | src/lib/surveys/survey-experiment-actions.ts |
| `getProjectLongitudinalAnalyticsAction` | `forms_surveys` | src/lib/surveys/survey-longitudinal-actions.ts |
| `createSurveyWaveAction` | `forms_surveys` | src/lib/surveys/survey-longitudinal-actions.ts |
| `concludeSurveyWaveAction` | `forms_surveys` | src/lib/surveys/survey-longitudinal-actions.ts |
| `calculateEntityPredictiveHealthAction` | `forms_surveys` | src/lib/surveys/survey-predictive-actions.ts |
| `getWorkspacePredictiveOverviewAction` | `forms_surveys` | src/lib/surveys/survey-predictive-actions.ts |
| `executePredictiveNextBestAction` | `forms_surveys` | src/lib/surveys/survey-predictive-actions.ts |
| `getSystemPredictiveWeightsAction` | `forms_surveys` | src/lib/surveys/survey-predictive-actions.ts |
| `saveSystemPredictiveWeightsAction` | `forms_surveys` | src/lib/surveys/survey-predictive-actions.ts |
| `createSurveyProjectAction` | `forms_surveys` | src/lib/surveys/survey-project-actions.ts |
| `getSurveyProjectsAction` | `forms_surveys` | src/lib/surveys/survey-project-actions.ts |
| `getSurveyProjectByIdAction` | `forms_surveys` | src/lib/surveys/survey-project-actions.ts |
| `updateSurveyProjectAction` | `forms_surveys` | src/lib/surveys/survey-project-actions.ts |
| `assignSurveysToProjectAction` | `forms_surveys` | src/lib/surveys/survey-project-actions.ts |
| `getProjectAnalyticsSummaryAction` | `forms_surveys` | src/lib/surveys/survey-project-actions.ts |
| `executeSurveyDataRetentionAction` | `forms_surveys` | src/lib/surveys/survey-retention-actions.ts |
| `getSystemResearchGovernanceAction` | `forms_surveys` | src/lib/surveys/survey-retention-actions.ts |
| `saveSystemResearchGovernanceAction` | `forms_surveys` | src/lib/surveys/survey-retention-actions.ts |
| `createDraftVersionAction` | `forms_surveys` | src/lib/surveys/survey-version-actions.ts |
| `publishSurveyVersionAction` | `forms_surveys` | src/lib/surveys/survey-version-actions.ts |
| `getSurveyVersionHistoryAction` | `forms_surveys` | src/lib/surveys/survey-version-actions.ts |
| `executeTagAction` | `crm_contacts` | src/lib/tag-action-executor.ts |
| `createTagAction` | `crm_contacts` | src/lib/tag-actions.ts |
| `updateTagAction` | `crm_contacts` | src/lib/tag-actions.ts |
| `deleteTagAction` | `crm_contacts` | src/lib/tag-actions.ts |
| `mergeTagsAction` | `crm_contacts` | src/lib/tag-actions.ts |
| `getTagsAction` | `crm_contacts` | src/lib/tag-actions.ts |
| `getTagAction` | `crm_contacts` | src/lib/tag-actions.ts |
| `applyTagsAction` | `crm_contacts` | src/lib/tag-actions.ts |
| `removeTagsAction` | `crm_contacts` | src/lib/tag-actions.ts |
| `bulkApplyTagsAction` | `crm_contacts` | src/lib/tag-actions.ts |
| `bulkRemoveTagsAction` | `crm_contacts` | src/lib/tag-actions.ts |
| `getContactsByTagsAction` | `crm_contacts` | src/lib/tag-actions.ts |
| `getTagUsageStatsAction` | `crm_contacts` | src/lib/tag-actions.ts |
| `bulkDeleteUnusedTagsAction` | `crm_contacts` | src/lib/tag-actions.ts |
| `getTagAuditLogsAction` | `crm_contacts` | src/lib/tag-actions.ts |
| `createTaskNonBlocking` | `tasks_productivity` | src/lib/task-actions.ts |
| `updateTaskNonBlocking` | `tasks_productivity` | src/lib/task-actions.ts |
| `bulkUpdateTasks` | `tasks_productivity` | src/lib/task-actions.ts |
| `bulkDeleteTasks` | `tasks_productivity` | src/lib/task-actions.ts |
| `deleteTaskNonBlocking` | `tasks_productivity` | src/lib/task-actions.ts |
| `createTaskFromAutomation` | `tasks_productivity` | src/lib/task-server-actions.ts |
| `deleteTaskAction` | `tasks_productivity` | src/lib/task-server-actions.ts |
| `bulkUpdateTasksAction` | `tasks_productivity` | src/lib/task-server-actions.ts |
| `bulkDeleteTasksAction` | `tasks_productivity` | src/lib/task-server-actions.ts |
| `createGlobalTemplate` | `crm_contacts` | src/lib/template-actions.ts |
| `updateGlobalTemplate` | `crm_contacts` | src/lib/template-actions.ts |
| `deleteGlobalTemplate` | `crm_contacts` | src/lib/template-actions.ts |
| `listGlobalTemplates` | `crm_contacts` | src/lib/template-actions.ts |
| `getBlueprintAdoptionStats` | `crm_contacts` | src/lib/template-actions.ts |
| `createOrgOverride` | `crm_contacts` | src/lib/template-actions.ts |
| `updateOrgTemplate` | `crm_contacts` | src/lib/template-actions.ts |
| `revertToGlobal` | `crm_contacts` | src/lib/template-actions.ts |
| `listTemplates` | `crm_contacts` | src/lib/template-actions.ts |
| `activateTemplate` | `crm_contacts` | src/lib/template-actions.ts |
| `archiveTemplate` | `crm_contacts` | src/lib/template-actions.ts |
| `unarchiveTemplate` | `crm_contacts` | src/lib/template-actions.ts |
| `getTemplateById` | `crm_contacts` | src/lib/template-actions.ts |
| `sendTestMessage` | `crm_contacts` | src/lib/template-actions.ts |
| `saveThemeAction` | `crm_contacts` | src/lib/theme-actions.ts |
| `getThemesAction` | `crm_contacts` | src/lib/theme-actions.ts |
| `inviteUserAction` | `identity_access` | src/lib/user-invite-actions.ts |
| `adminResetUserPasswordAction` | `identity_access` | src/lib/user-invite-actions.ts |
| `publicResetPasswordViaPhoneAction` | `identity_access` | src/lib/user-invite-actions.ts |
| `adminUpdateUserAccessAction` | `identity_access` | src/lib/user-invite-actions.ts |
| `declineJoinRequestAction` | `identity_access` | src/lib/user-invite-actions.ts |
| `removeUserFromOrgAction` | `identity_access` | src/lib/user-invite-actions.ts |
| `completeForcePasswordResetAction` | `identity_access` | src/lib/user-invite-actions.ts |
| `updateUserAiPreferencesAction` | `identity_access` | src/lib/user-preferences-actions.ts |
| `updateWorkspaceVocabularyAction` | `crm_contacts` | src/lib/vocabulary-map-actions.ts |
| `getWorkspaceVocabulary` | `crm_contacts` | src/lib/vocabulary-map-actions.ts |
| `dispatchSignupWebhook` | `platform_integrations` | src/lib/webhook-actions.ts |
| `saveWhatsAppConnection` | `communication_messaging` | src/lib/whatsapp-actions.ts |
| `connectWhatsAppViaOAuth` | `communication_messaging` | src/lib/whatsapp-actions.ts |
| `getWhatsAppConnection` | `communication_messaging` | src/lib/whatsapp-actions.ts |
| `testWhatsAppConnection` | `communication_messaging` | src/lib/whatsapp-actions.ts |
| `rotateWhatsAppToken` | `communication_messaging` | src/lib/whatsapp-actions.ts |
| `disconnectWhatsApp` | `communication_messaging` | src/lib/whatsapp-actions.ts |
| `listAllWhatsAppConnections` | `communication_messaging` | src/lib/whatsapp-backoffice-actions.ts |
| `forceDisconnectWhatsApp` | `communication_messaging` | src/lib/whatsapp-backoffice-actions.ts |
| `syncWhatsAppTemplates` | `communication_messaging` | src/lib/whatsapp-template-actions.ts |
| `listWhatsAppTemplates` | `communication_messaging` | src/lib/whatsapp-template-actions.ts |
| `sendWhatsAppTestMessage` | `communication_messaging` | src/lib/whatsapp-template-actions.ts |
| `createWhatsAppTemplate` | `communication_messaging` | src/lib/whatsapp-template-actions.ts |
| `adoptWhatsAppTemplate` | `communication_messaging` | src/lib/whatsapp-template-actions.ts |
| `listWorkflowsAction` | `automation_workflows` | src/lib/workflows/actions/workflow-actions.ts |
| `getWorkflowAction` | `automation_workflows` | src/lib/workflows/actions/workflow-actions.ts |
| `saveWorkflowAction` | `automation_workflows` | src/lib/workflows/actions/workflow-actions.ts |
| `toggleWorkflowAction` | `automation_workflows` | src/lib/workflows/actions/workflow-actions.ts |
| `startWorkflowRunAction` | `automation_workflows` | src/lib/workflows/actions/workflow-actions.ts |
| `getWorkflowRunAction` | `automation_workflows` | src/lib/workflows/actions/workflow-actions.ts |
| `listWorkflowRunsAction` | `automation_workflows` | src/lib/workflows/actions/workflow-actions.ts |
| `resumeWorkflowRunAction` | `automation_workflows` | src/lib/workflows/actions/workflow-actions.ts |
| `simulateWorkflowAction` | `automation_workflows` | src/lib/workflows/actions/workflow-actions.ts |
| `installBlueprintAction` | `automation_workflows` | src/lib/workflows/actions/workflow-actions.ts |
| `getTerminologyAction` | `identity_access` | src/lib/workspace-actions.ts |
| `saveWorkspaceAction` | `identity_access` | src/lib/workspace-actions.ts |
| `deleteWorkspaceAction` | `identity_access` | src/lib/workspace-actions.ts |
| `archiveWorkspaceAction` | `identity_access` | src/lib/workspace-actions.ts |
| `updateWorkspaceScopeAction` | `identity_access` | src/lib/workspace-actions.ts |
| `migrateLegacyWorkspaceScopesAction` | `identity_access` | src/lib/workspace-actions.ts |
| `linkEntityToWorkspaceAction` | `identity_access` | src/lib/workspace-entity-actions.ts |
| `unlinkEntityFromWorkspaceAction` | `identity_access` | src/lib/workspace-entity-actions.ts |
| `archiveEntityAction` | `identity_access` | src/lib/workspace-entity-actions.ts |
| `deleteEntityPermanentlyAction` | `identity_access` | src/lib/workspace-entity-actions.ts |
| `bulkArchiveEntitiesAction` | `identity_access` | src/lib/workspace-entity-actions.ts |
| `bulkDeleteEntitiesAction` | `identity_access` | src/lib/workspace-entity-actions.ts |
| `getFilteredEntityIdsAction` | `identity_access` | src/lib/workspace-entity-actions.ts |
| `ensureEntitySharedToWorkspace` | `identity_access` | src/lib/workspace-entity-actions.ts |
| `IngestionDeduplicator` | `crm_contacts` | src/lib/services/IngestionDeduplicator.ts |
| `AgingService` | `finance_subscriptions` | src/lib/services/aging-service.ts |
| `calculateInvoiceAging` | `finance_subscriptions` | src/lib/services/aging-utils.ts |
| `AgreementSequenceService` | `crm_contacts` | src/lib/services/agreement-sequence-service.ts |
| `AiIdentityContextResolver` | `crm_contacts` | src/lib/services/ai/ai-identity-context-resolver.ts |
| `AiRoleAdvisorService` | `identity_access` | src/lib/services/ai/ai-role-advisor-service.ts |
| `AiWorkforceRiskEngine` | `ai_governance` | src/lib/services/ai/ai-workforce-risk-engine.ts |
| `AiApprovalRoutingService` | `ai_governance` | src/lib/services/ai-admin/ai-approval-routing-service.ts |
| `AiExecutionEngine` | `ai_governance` | src/lib/services/ai-admin/ai-execution-engine.ts |
| `AiImpactSimulationService` | `ai_governance` | src/lib/services/ai-admin/ai-impact-simulation-service.ts |
| `AiExperienceService` | `experience_portal` | src/lib/services/ai-experience-service.ts |
| `PermissionUsageService` | `identity_access` | src/lib/services/analytics/permission-usage-service.ts |
| `PlatformEventService` | `forms_surveys` | src/lib/services/analytics/platform-event-service.ts |
| `SavedDirectoryViewService` | `analytics_reporting` | src/lib/services/analytics/saved-directory-view-service.ts |
| `WorkforceMetricsService` | `lead_intelligence` | src/lib/services/analytics/workforce-metrics-service.ts |
| `AccessSnapshotService` | `identity_access` | src/lib/services/authorization/access-snapshot-service.ts |
| `AuthorizationService` | `identity_access` | src/lib/services/authorization/authorization-service.ts |
| `PermissionRegistryService` | `identity_access` | src/lib/services/authorization/permission-registry-service.ts |
| `PolicyEngineService` | `ai_governance` | src/lib/services/authorization/policy-engine-service.ts |
| `RoleManagementService` | `identity_access` | src/lib/services/authorization/role-management-service.ts |
| `CallCentreService` | `automation_workflows` | src/lib/services/call-centre-service.ts |
| `generateCertificateCodeBody` | `experience_portal` | src/lib/services/certificate-code.ts |
| `generateCertificateCode` | `experience_portal` | src/lib/services/certificate-code.ts |
| `normaliseCertificateCode` | `experience_portal` | src/lib/services/certificate-code.ts |
| `CohortService` | `crm_contacts` | src/lib/services/cohort-service.ts |
| `CollectionActivityService` | `crm_contacts` | src/lib/services/collection-activity-service.ts |
| `CollectionCaseSequenceService` | `crm_contacts` | src/lib/services/collection-case-sequence-service.ts |
| `CollectionCaseService` | `crm_contacts` | src/lib/services/collection-case-service.ts |
| `CommerceService` | `finance_subscriptions` | src/lib/services/commerce-service.ts |
| `CommunityService` | `experience_portal` | src/lib/services/community-service.ts |
| `ContentService` | `crm_contacts` | src/lib/services/content-service.ts |
| `CourseService` | `experience_portal` | src/lib/services/course-service.ts |
| `CredentialService` | `experience_portal` | src/lib/services/credential-service.ts |
| `CreditNoteSequenceService` | `finance_subscriptions` | src/lib/services/credit-note-sequence-service.ts |
| `CreditNoteService` | `finance_subscriptions` | src/lib/services/credit-note-service.ts |
| `getDashboardConfig` | `analytics_reporting` | src/lib/services/dashboard.service.ts |
| `saveDashboardLayout` | `analytics_reporting` | src/lib/services/dashboard.service.ts |
| `checkMessageDeliveryLogs` | `analytics_reporting` | src/lib/services/delivery-telemetry.ts |
| `EngagementService` | `crm_contacts` | src/lib/services/engagement-service.ts |
| `EnrollmentService` | `crm_contacts` | src/lib/services/enrollment-service.ts |
| `DirectorySyncService` | `platform_integrations` | src/lib/services/enterprise-identity/directory-sync-service.ts |
| `EnterpriseIdpService` | `crm_contacts` | src/lib/services/enterprise-identity/enterprise-idp-service.ts |
| `EnterpriseSessionService` | `crm_contacts` | src/lib/services/enterprise-identity/enterprise-session-service.ts |
| `MfaPolicyService` | `ai_governance` | src/lib/services/enterprise-identity/mfa-policy-service.ts |
| `EnterpriseService` | `crm_contacts` | src/lib/services/enterprise-service.ts |
| `EntitlementService` | `identity_access` | src/lib/services/entitlement-service.ts |
| `generateEntityDossierPdf` | `crm_contacts` | src/lib/services/entity-dossier-pdf-service.ts |
| `detectEntityDrift` | `platform_integrations` | src/lib/services/entity-sync-gateway.ts |
| `EntitySyncGateway` | `platform_integrations` | src/lib/services/entity-sync-gateway.ts |
| `EventService` | `crm_contacts` | src/lib/services/event-service.ts |
| `FieldsVariablesService` | `crm_contacts` | src/lib/services/fields-variables-service-impl.ts |
| `getVariablesAction` | `crm_contacts` | src/lib/services/fields-variables-service.ts |
| `resolveTemplateVariablesAction` | `crm_contacts` | src/lib/services/fields-variables-service.ts |
| `getVariableValuesMapAction` | `crm_contacts` | src/lib/services/fields-variables-service.ts |
| `resolveEntityContextFromParamsAction` | `crm_contacts` | src/lib/services/fields-variables-service.ts |
| `FinanceAutomationService` | `automation_workflows` | src/lib/services/finance-automation-service.ts |
| `FinanceMigrationService` | `finance_subscriptions` | src/lib/services/finance-migration-service.ts |
| `determineReminderStage` | `finance_subscriptions` | src/lib/services/finance-reminder-utils.ts |
| `formatReminderMessage` | `finance_subscriptions` | src/lib/services/finance-reminder-utils.ts |
| `FinanceReportingService` | `finance_subscriptions` | src/lib/services/finance-reporting-service.ts |
| `FinancialAccountService` | `crm_contacts` | src/lib/services/financial-account-service.ts |
| `FinancialApprovalService` | `ai_governance` | src/lib/services/financial-approval-service.ts |
| `FinancialAuditService` | `ai_governance` | src/lib/services/financial-audit-service.ts |
| `FinancialEventService` | `crm_contacts` | src/lib/services/financial-event-service.ts |
| `AccessReviewService` | `ai_governance` | src/lib/services/governance/access-review-service.ts |
| `SecurityAuditService` | `ai_governance` | src/lib/services/governance/security-audit-service.ts |
| `SeparationOfDutyService` | `ai_governance` | src/lib/services/governance/separation-of-duty-service.ts |
| `SessionManagementService` | `ai_governance` | src/lib/services/governance/session-management-service.ts |
| `TemporaryAccessService` | `ai_governance` | src/lib/services/governance/temporary-access-service.ts |
| `analyzeHeadline` | `crm_contacts` | src/lib/services/headline-iq.ts |
| `IdentityAccountService` | `crm_contacts` | src/lib/services/identity/identity-account-service.ts |
| `IdentityMigrationService` | `crm_contacts` | src/lib/services/identity/identity-migration-service.ts |
| `IdentityProjectionService` | `crm_contacts` | src/lib/services/identity/identity-projection-service.ts |
| `OrganizationMembershipService` | `experience_portal` | src/lib/services/identity/organization-membership-service.ts |
| `PersonService` | `crm_contacts` | src/lib/services/identity/person-service.ts |
| `WorkspaceMembershipService` | `experience_portal` | src/lib/services/identity/workspace-membership-service.ts |
| `resolveGoogleCredentials` | `meetings_conversations` | src/lib/services/integrations/google-calendar.ts |
| `getGoogleAuthUrl` | `meetings_conversations` | src/lib/services/integrations/google-calendar.ts |
| `exchangeGoogleCode` | `meetings_conversations` | src/lib/services/integrations/google-calendar.ts |
| `refreshGoogleToken` | `meetings_conversations` | src/lib/services/integrations/google-calendar.ts |
| `getValidGoogleConnection` | `meetings_conversations` | src/lib/services/integrations/google-calendar.ts |
| `queryGoogleFreeBusy` | `meetings_conversations` | src/lib/services/integrations/google-calendar.ts |
| `deleteGoogleCalendarEvent` | `meetings_conversations` | src/lib/services/integrations/google-calendar.ts |
| `resolveMicrosoftCredentials` | `meetings_conversations` | src/lib/services/integrations/microsoft-calendar.ts |
| `getMicrosoftAuthUrl` | `meetings_conversations` | src/lib/services/integrations/microsoft-calendar.ts |
| `exchangeMicrosoftCode` | `meetings_conversations` | src/lib/services/integrations/microsoft-calendar.ts |
| `refreshMicrosoftToken` | `meetings_conversations` | src/lib/services/integrations/microsoft-calendar.ts |
| `getValidMicrosoftConnection` | `meetings_conversations` | src/lib/services/integrations/microsoft-calendar.ts |
| `queryMicrosoftFreeBusy` | `meetings_conversations` | src/lib/services/integrations/microsoft-calendar.ts |
| `deleteMicrosoftCalendarEvent` | `meetings_conversations` | src/lib/services/integrations/microsoft-calendar.ts |
| `resolveMicrosoftCredentials` | `platform_integrations` | src/lib/services/integrations/microsoft-teams.ts |
| `getMicrosoftAuthUrl` | `platform_integrations` | src/lib/services/integrations/microsoft-teams.ts |
| `exchangeMicrosoftCode` | `platform_integrations` | src/lib/services/integrations/microsoft-teams.ts |
| `refreshMicrosoftToken` | `platform_integrations` | src/lib/services/integrations/microsoft-teams.ts |
| `getValidConnection` | `platform_integrations` | src/lib/services/integrations/microsoft-teams.ts |
| `createMicrosoftTeamsMeeting` | `platform_integrations` | src/lib/services/integrations/microsoft-teams.ts |
| `deleteMicrosoftTeamsMeeting` | `platform_integrations` | src/lib/services/integrations/microsoft-teams.ts |
| `resolveZoomCredentials` | `meetings_conversations` | src/lib/services/integrations/zoom-meeting.ts |
| `getZoomAuthUrl` | `meetings_conversations` | src/lib/services/integrations/zoom-meeting.ts |
| `exchangeZoomCode` | `meetings_conversations` | src/lib/services/integrations/zoom-meeting.ts |
| `refreshZoomToken` | `meetings_conversations` | src/lib/services/integrations/zoom-meeting.ts |
| `getValidZoomConnection` | `meetings_conversations` | src/lib/services/integrations/zoom-meeting.ts |
| `deleteZoomMeeting` | `meetings_conversations` | src/lib/services/integrations/zoom-meeting.ts |
| `InvoiceLifecycleService` | `finance_subscriptions` | src/lib/services/invoice-lifecycle-service.ts |
| `InvoiceSequenceService` | `finance_subscriptions` | src/lib/services/invoice-sequence-service.ts |
| `InvoiceSnapshotService` | `finance_subscriptions` | src/lib/services/invoice-snapshot-service.ts |
| `sanitizeCustomHtml` | `crm_contacts` | src/lib/services/landing-footer-service.ts |
| `resolveCustomFooterHtml` | `crm_contacts` | src/lib/services/landing-footer-service.ts |
| `LearningProgressService` | `experience_portal` | src/lib/services/learning-progress-service.ts |
| `LedgerService` | `finance_subscriptions` | src/lib/services/ledger-service.ts |
| `MaterializedSummaryService` | `analytics_reporting` | src/lib/services/materialized-summary-service.ts |
| `MembershipPlanService` | `experience_portal` | src/lib/services/membership-plan-service.ts |
| `MessageTrackingService` | `communication_messaging` | src/lib/services/message-tracking-service.ts |
| `ModularReportingService` | `analytics_reporting` | src/lib/services/modular-reporting-service.ts |
| `AdaptiveConditionEvaluator` | `crm_contacts` | src/lib/services/onboarding/adaptive-condition-evaluator.ts |
| `OnboardingInstanceService` | `crm_contacts` | src/lib/services/onboarding/onboarding-instance-service.ts |
| `OnboardingJourneyService` | `crm_contacts` | src/lib/services/onboarding/onboarding-journey-service.ts |
| `DEFAULT_ORG_FOOTER_HTML` | `crm_contacts` | src/lib/services/org-footer-service.ts |
| `resolveOrgFooter` | `crm_contacts` | src/lib/services/org-footer-service.ts |
| `htmlContainsFooter` | `crm_contacts` | src/lib/services/org-footer-service.ts |
| `PaymentPlanService` | `finance_subscriptions` | src/lib/services/payment-plan-service.ts |
| `PaymentService` | `finance_subscriptions` | src/lib/services/payment-service.ts |
| `PortalAccessService` | `experience_portal` | src/lib/services/portal-access-service.ts |
| `PortalAnalyticsService` | `experience_portal` | src/lib/services/portal-analytics-service.ts |
| `PortalEventService` | `experience_portal` | src/lib/services/portal-event-service.ts |
| `PortalInvitationService` | `experience_portal` | src/lib/services/portal-invitation-service.ts |
| `PortalMembershipService` | `experience_portal` | src/lib/services/portal-membership-service.ts |
| `PortalService` | `experience_portal` | src/lib/services/portal-service.ts |
| `ProductCatalogueService` | `crm_contacts` | src/lib/services/product-catalogue-service.ts |
| `PromiseToPayService` | `crm_contacts` | src/lib/services/promise-to-pay-service.ts |
| `ReconciliationService` | `finance_subscriptions` | src/lib/services/reconciliation-service.ts |
| `RecurringBillingService` | `finance_subscriptions` | src/lib/services/recurring-billing-service.ts |
| `ReleaseScheduleService` | `crm_contacts` | src/lib/services/release-schedule-service.ts |
| `ReportExportService` | `analytics_reporting` | src/lib/services/report-export-service.ts |
| `ResendJobService` | `communication_messaging` | src/lib/services/resend-job-service.ts |
| `calculateFreeSlots` | `automation_workflows` | src/lib/services/scheduler/availability.ts |
| `SenderProfileService` | `communication_messaging` | src/lib/services/sender-profile-service.ts |
| `getNextSerial` | `crm_contacts` | src/lib/services/serial-allocator.ts |
| `StatementService` | `finance_subscriptions` | src/lib/services/statement-service.ts |
| `ensureOrgDefaultStyleAdmin` | `crm_contacts` | src/lib/services/style-resolver-server.ts |
| `getDefaultStyle` | `crm_contacts` | src/lib/services/style-resolver.ts |
| `DEFAULT_ORG_STYLE_WRAPPER` | `crm_contacts` | src/lib/services/style-resolver.ts |
| `generateUnsubscribeToken` | `crm_contacts` | src/lib/services/unsubscribe-service.ts |
| `verifyUnsubscribeToken` | `crm_contacts` | src/lib/services/unsubscribe-service.ts |
| `generateSecureUnsubscribeLink` | `crm_contacts` | src/lib/services/unsubscribe-service.ts |
| `processUnsubscribe` | `crm_contacts` | src/lib/services/unsubscribe-service.ts |
| `AccessRequestService` | `lead_intelligence` | src/lib/services/workforce/access-request-service.ts |
| `BulkWorkforceService` | `lead_intelligence` | src/lib/services/workforce/bulk-workforce-service.ts |
| `CrmWorkloadService` | `lead_intelligence` | src/lib/services/workforce/crm-workload-service.ts |
| `DepartmentSeedService` | `lead_intelligence` | src/lib/services/workforce/department-seed-service.ts |
| `DepartmentService` | `lead_intelligence` | src/lib/services/workforce/department-service.ts |
| `InvitationDispatchService` | `lead_intelligence` | src/lib/services/workforce/invitation-dispatch-service.ts |
| `InvitationLifecycleService` | `lead_intelligence` | src/lib/services/workforce/invitation-lifecycle-service.ts |
| `OffboardingGuardService` | `lead_intelligence` | src/lib/services/workforce/offboarding-guard-service.ts |
| `OwnershipTransferService` | `lead_intelligence` | src/lib/services/workforce/ownership-transfer-service.ts |
| `TeamService` | `lead_intelligence` | src/lib/services/workforce/team-service.ts |
| `RoleIntelligenceService` | `lead_intelligence` | src/lib/services/workforce-intelligence/role-intelligence-service.ts |
| `TeamUtilizationService` | `lead_intelligence` | src/lib/services/workforce-intelligence/team-utilization-service.ts |
| `UserHealthService` | `lead_intelligence` | src/lib/services/workforce-intelligence/user-health-service.ts |
| `WorkforceIntelligenceService` | `lead_intelligence` | src/lib/services/workforce-intelligence/workforce-intelligence-service.ts |
| `resolveWorkspaceIdFromEntity` | `identity_access` | src/lib/services/workspace-resolver.ts |
| `resolveWorkspaceIdFromMeeting` | `identity_access` | src/lib/services/workspace-resolver.ts |
| `resolveWorkspaceIdFromContract` | `identity_access` | src/lib/services/workspace-resolver.ts |
| `resolveWorkspaceIdFromSurvey` | `identity_access` | src/lib/services/workspace-resolver.ts |
| `resolveWorkspaceIdFromPDFForm` | `identity_access` | src/lib/services/workspace-resolver.ts |
| `resolveWorkspaceIdForUser` | `identity_access` | src/lib/services/workspace-resolver.ts |
| `resolveContextWorkspaceId` | `identity_access` | src/lib/services/workspace-resolver.ts |
| `flagMissingWorkspaceToAdmin` | `identity_access` | src/lib/services/workspace-resolver.ts |
| `LeadIntelligenceEngine` | `lead_intelligence` | src/lib/lead-intelligence/LeadIntelligenceEngine.ts |
| `RevenueAttributionEngine` | `lead_intelligence` | src/lib/lead-intelligence/attribution/RevenueAttributionEngine.ts |
| `ProspectingCampaignEngine` | `lead_intelligence` | src/lib/lead-intelligence/campaigns/ProspectingCampaignEngine.ts |
| `CRMIntelligenceService` | `lead_intelligence` | src/lib/lead-intelligence/crm/CRMIntelligenceService.ts |
| `generateExtensionToken` | `lead_intelligence` | src/lib/lead-intelligence/extension-token.ts |
| `hashExtensionToken` | `lead_intelligence` | src/lib/lead-intelligence/extension-token.ts |
| `extensionTokenMatches` | `lead_intelligence` | src/lib/lead-intelligence/extension-token.ts |
| `EnterpriseGovernanceEngine` | `ai_governance` | src/lib/lead-intelligence/governance/EnterpriseGovernanceEngine.ts |
| `IdentityMergeService` | `lead_intelligence` | src/lib/lead-intelligence/identity/IdentityMergeService.ts |
| `canonicalizeDomain` | `lead_intelligence` | src/lib/lead-intelligence/identity-resolver.ts |
| `isSafeExternalDomain` | `lead_intelligence` | src/lib/lead-intelligence/identity-resolver.ts |
| `normalizeBusinessName` | `lead_intelligence` | src/lib/lead-intelligence/identity-resolver.ts |
| `calculateStringSimilarity` | `lead_intelligence` | src/lib/lead-intelligence/identity-resolver.ts |
| `normalizePhoneNumber` | `lead_intelligence` | src/lib/lead-intelligence/identity-resolver.ts |
| `evaluateIdentityMatch` | `lead_intelligence` | src/lib/lead-intelligence/identity-resolver.ts |
| `PredictiveIntelligenceEngine` | `lead_intelligence` | src/lib/lead-intelligence/predictive/PredictiveIntelligenceEngine.ts |
| `CSVImportProvider` | `lead_intelligence` | src/lib/lead-intelligence/providers/CSVImportProvider.ts |
| `GooglePlacesProvider` | `lead_intelligence` | src/lib/lead-intelligence/providers/GooglePlacesProvider.ts |
| `SimulatedAIProvider` | `lead_intelligence` | src/lib/lead-intelligence/providers/SimulatedAIProvider.ts |
| `DeepResearchDossierEngine` | `lead_intelligence` | src/lib/lead-intelligence/research/DeepResearchDossierEngine.ts |
| `ExplainableScoringEngine` | `lead_intelligence` | src/lib/lead-intelligence/scoring/ExplainableScoringEngine.ts |
| `DOMScraperService` | `lead_intelligence` | src/lib/lead-intelligence/scraper/DOMScraperService.ts |
| `SubdomainProberService` | `lead_intelligence` | src/lib/lead-intelligence/scraper/SubdomainProberService.ts |
| `TechnographicsCategorizer` | `lead_intelligence` | src/lib/lead-intelligence/scraper/TechnographicsCategorizer.ts |
| `AutonomousSDREngine` | `lead_intelligence` | src/lib/lead-intelligence/sdr/AutonomousSDREngine.ts |
| `SegmentPredicateEvaluator` | `lead_intelligence` | src/lib/lead-intelligence/segmentation/SegmentPredicateEvaluator.ts |
| `ContinuousSignalMonitorService` | `lead_intelligence` | src/lib/lead-intelligence/signals/ContinuousSignalMonitorService.ts |
| `DNSMXResolverService` | `lead_intelligence` | src/lib/lead-intelligence/verification/DNSMXResolverService.ts |
| `DeliverabilityScoreEngine` | `lead_intelligence` | src/lib/lead-intelligence/verification/DeliverabilityScoreEngine.ts |
| `DisposableEmailDetector` | `lead_intelligence` | src/lib/lead-intelligence/verification/DisposableEmailDetector.ts |
| `EmailSyntaxSanitizer` | `lead_intelligence` | src/lib/lead-intelligence/verification/EmailSyntaxSanitizer.ts |
| `SMTPHandshakeProberService` | `lead_intelligence` | src/lib/lead-intelligence/verification/SMTPHandshakeProberService.ts |
| `WaterfallEnrichmentEngine` | `lead_intelligence` | src/lib/lead-intelligence/waterfall/WaterfallEnrichmentEngine.ts |

## Test gaps (1478)

| Capability | Kind | Risk | File |
| --- | --- | --- | --- |
| `createAiActionProposalAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/ai-admin-actions.ts |
| `listAiActionProposalsAction` | server_action | `L0_READ` | src/app/actions/ai-admin-actions.ts |
| `approveAiProposalAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/ai-admin-actions.ts |
| `rejectAiProposalAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/ai-admin-actions.ts |
| `listAiExecutionAuditsAction` | server_action | `L0_READ` | src/app/actions/ai-admin-actions.ts |
| `generatePortalScaffoldAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/ai-experience-actions.ts |
| `generateCurriculumAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/ai-experience-actions.ts |
| `generateQuizAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/ai-experience-actions.ts |
| `askAiTutorAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/ai-experience-actions.ts |
| `getCoursePedagogyDiagnosticAction` | server_action | `L0_READ` | src/app/actions/ai-experience-actions.ts |
| `getAiWorkforceDashboardDataAction` | server_action | `L0_READ` | src/app/actions/ai-sales-workforce-actions.ts |
| `updateAgentAutonomyLevelAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/ai-sales-workforce-actions.ts |
| `executeAiRecommendationAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/ai-sales-workforce-actions.ts |
| `resolveAiApprovalAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/ai-sales-workforce-actions.ts |
| `runCrmHygieneScanAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/ai-sales-workforce-actions.ts |
| `executeCrmHygieneRepairAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/ai-sales-workforce-actions.ts |
| `toggleAiMasterKillSwitchAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/ai-sales-workforce-actions.ts |
| `reseedAiWorkforceDefaultsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/ai-sales-workforce-actions.ts |
| `updateAiGovernancePolicyAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/ai-sales-workforce-actions.ts |
| `parseAndSuggestSlotsAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/ai-scheduling-actions.ts |
| `confirmAIScheduledBookingAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/ai-scheduling-actions.ts |
| `getPersonRiskScoreAction` | server_action | `L0_READ` | src/app/actions/ai-workforce-actions.ts |
| `getOrganizationRiskOverviewAction` | server_action | `L0_READ` | src/app/actions/ai-workforce-actions.ts |
| `listAiRecommendationsAction` | server_action | `L0_READ` | src/app/actions/ai-workforce-actions.ts |
| `generateAiRecommendationsAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/ai-workforce-actions.ts |
| `applyAiRecommendationAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/ai-workforce-actions.ts |
| `dismissAiRecommendationAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/ai-workforce-actions.ts |
| `ingestPlatformEventAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/analytics-actions.ts |
| `listPlatformEventsAction` | server_action | `L0_READ` | src/app/actions/analytics-actions.ts |
| `getWorkforceAdoptionMetricsAction` | server_action | `L0_READ` | src/app/actions/analytics-actions.ts |
| `getTeamLeaderboardAction` | server_action | `L0_READ` | src/app/actions/analytics-actions.ts |
| `getLeastPrivilegeReportAction` | server_action | `L0_READ` | src/app/actions/analytics-actions.ts |
| `listSavedDirectoryViewsAction` | server_action | `L0_READ` | src/app/actions/analytics-actions.ts |
| `createOrUpdateSavedViewAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/analytics-actions.ts |
| `deleteSavedViewAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/analytics-actions.ts |
| `getPermissionCatalogAction` | server_action | `L0_READ` | src/app/actions/authorization-actions.ts |
| `createOrUpdateRoleAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/authorization-actions.ts |
| `deleteRoleAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/authorization-actions.ts |
| `explainUserAccessAction` | server_action | `L0_READ` | src/app/actions/authorization-actions.ts |
| `simulateRolePermissionsAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/authorization-actions.ts |
| `evaluateAccessAction` | server_action | `L0_READ` | src/app/actions/authorization-actions.ts |
| `listRolesAction` | server_action | `L0_READ` | src/app/actions/authorization-actions.ts |
| `fetchCandidateDealsForFER` | server_action | `L0_READ` | src/app/actions/automated-deal-fer-actions.ts |
| `runAutomatedDealFERProtocol` | server_action | `L2_STATE_MUTATION` | src/app/actions/automated-deal-fer-actions.ts |
| `getDefaultAvailabilityProfileAction` | server_action | `L0_READ` | src/app/actions/availability-actions.ts |
| `createAvailabilityProfileAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/availability-actions.ts |
| `updateAvailabilityProfileAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/availability-actions.ts |
| `deleteAvailabilityProfileAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/availability-actions.ts |
| `fetchDealsForStageNameBackfill` | server_action | `L0_READ` | src/app/actions/backfill-deal-stagename-action.ts |
| `enrichDealsWithStageName` | server_action | `L2_STATE_MUTATION` | src/app/actions/backfill-deal-stagename-action.ts |
| `restoreDealStageNameBackfill` | server_action | `L2_STATE_MUTATION` | src/app/actions/backfill-deal-stagename-action.ts |
| `rollbackDealStageNameBackfill` | server_action | `L2_STATE_MUTATION` | src/app/actions/backfill-deal-stagename-action.ts |
| `runDocumentCtaBackfillAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/backfill-document-cta-action.ts |
| `backfillSenderOrgAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/backfill-sender-org-action.ts |
| `getPublicBookingPageDataAction` | server_action | `L0_READ` | src/app/actions/booking-actions.ts |
| `getAvailableSlotsAction` | server_action | `L0_READ` | src/app/actions/booking-actions.ts |
| `acquireBookingHoldAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/booking-actions.ts |
| `createBookingFromHoldAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/booking-actions.ts |
| `cancelBookingAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/booking-actions.ts |
| `rescheduleBookingAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/booking-actions.ts |
| `getWorkspaceBrandKitAction` | server_action | `L0_READ` | src/app/actions/brand-kit-actions.ts |
| `saveWorkspaceBrandKitAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/brand-kit-actions.ts |
| `bulkRegisterParticipantsActionCore` | server_action | `L2_STATE_MUTATION` | src/app/actions/bulk-meeting-actions.ts |
| `bulkRegisterParticipantsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/bulk-meeting-actions.ts |
| `getCalendarConnectionsAction` | server_action | `L0_READ` | src/app/actions/calendar-connection-actions.ts |
| `disconnectCalendarConnectionAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/calendar-connection-actions.ts |
| `toggleCalendarConflictCheckAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/calendar-connection-actions.ts |
| `setPrimarySyncCalendarAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/calendar-connection-actions.ts |
| `syncBookingToExternalCalendarAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/calendar-connection-actions.ts |
| `getGoogleAuthUrlAction` | server_action | `L0_READ` | src/app/actions/calendar-connection-actions.ts |
| `getMicrosoftAuthUrlAction` | server_action | `L0_READ` | src/app/actions/calendar-connection-actions.ts |
| `getZoomAuthUrlAction` | server_action | `L0_READ` | src/app/actions/calendar-connection-actions.ts |
| `saveWorkspaceOAuthCredentialsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/calendar-connection-actions.ts |
| `clearWorkspaceOAuthCredentialsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/calendar-connection-actions.ts |
| `saveOrganizationOAuthCredentialsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/calendar-connection-actions.ts |
| `getWorkspaceOAuthCredentialsStatusAction` | server_action | `L0_READ` | src/app/actions/calendar-connection-actions.ts |
| `getOrganizationOAuthCredentialsStatusAction` | server_action | `L0_READ` | src/app/actions/calendar-connection-actions.ts |
| `fetchEntitiesWithCustomData` | server_action | `L0_READ` | src/app/actions/cleanup-entity-customdata-action.ts |
| `cleanupEntityCustomData` | server_action | `L2_STATE_MUTATION` | src/app/actions/cleanup-entity-customdata-action.ts |
| `validateCustomDataCleanup` | server_action | `L0_READ` | src/app/actions/cleanup-entity-customdata-action.ts |
| `clearAllImportLogsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/clear-import-logs-action.ts |
| `createOfferAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/commerce-actions.ts |
| `updateOfferAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/commerce-actions.ts |
| `deleteOfferAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/commerce-actions.ts |
| `listOffersByPortalAction` | server_action | `L0_READ` | src/app/actions/commerce-actions.ts |
| `createCouponAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/commerce-actions.ts |
| `deleteCouponAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/commerce-actions.ts |
| `listCouponsByPortalAction` | server_action | `L0_READ` | src/app/actions/commerce-actions.ts |
| `validateCouponAction` | server_action | `L0_READ` | src/app/actions/commerce-actions.ts |
| `processCheckoutOrderAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/commerce-actions.ts |
| `listOrdersByPortalAction` | server_action | `L0_READ` | src/app/actions/commerce-actions.ts |
| `registerAffiliatePartnerAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/commerce-actions.ts |
| `listAffiliatesByPortalAction` | server_action | `L0_READ` | src/app/actions/commerce-actions.ts |
| `updateAffiliatePartnerStatusAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/commerce-actions.ts |
| `joinPortalWaitlistAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/commerce-actions.ts |
| `createSpaceAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/community-actions.ts |
| `updateSpaceAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/community-actions.ts |
| `deleteSpaceAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/community-actions.ts |
| `listSpacesByPortalAction` | server_action | `L0_READ` | src/app/actions/community-actions.ts |
| `createPostAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/community-actions.ts |
| `updatePostAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/community-actions.ts |
| `deletePostAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/community-actions.ts |
| `togglePinPostAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/community-actions.ts |
| `createCommentAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/community-actions.ts |
| `deleteCommentAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/community-actions.ts |
| `castPollVoteAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/community-actions.ts |
| `toggleReactionAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/community-actions.ts |
| `reportContentAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/community-actions.ts |
| `listModerationReportsAction` | server_action | `L0_READ` | src/app/actions/community-actions.ts |
| `resolveModerationReportAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/community-actions.ts |
| `listLessonPostsAction` | server_action | `L0_READ` | src/app/actions/community-actions.ts |
| `getCommunityLeaderboardAction` | server_action | `L0_READ` | src/app/actions/community-actions.ts |
| `seedCommunitySpacesAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/community-actions.ts |
| `getMemberPublicProfileAction` | server_action | `L0_READ` | src/app/actions/community-actions.ts |
| `getConferenceSessionAction` | server_action | `L0_READ` | src/app/actions/conference-session-actions.ts |
| `createOrUpdateConferenceSessionAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/conference-session-actions.ts |
| `createContentItemAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/content-actions.ts |
| `updateContentItemAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/content-actions.ts |
| `publishContentItemAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/app/actions/content-actions.ts |
| `archiveContentItemAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/content-actions.ts |
| `deleteContentItemAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/content-actions.ts |
| `getContentItemBySlugAction` | server_action | `L0_READ` | src/app/actions/content-actions.ts |
| `searchPortalContentAction` | server_action | `L0_READ` | src/app/actions/content-actions.ts |
| `listContentItemsByPortalAction` | server_action | `L0_READ` | src/app/actions/content-actions.ts |
| `createPortalContentTemplateAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/content-actions.ts |
| `listPortalContentTemplatesAction` | server_action | `L0_READ` | src/app/actions/content-actions.ts |
| `getCoachingWorkspaceAction` | server_action | `L0_READ` | src/app/actions/conversation-coaching-actions.ts |
| `getCallIntelligenceDetailAction` | server_action | `L0_READ` | src/app/actions/conversation-coaching-actions.ts |
| `submitManualScorecardReviewAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/conversation-coaching-actions.ts |
| `startRoleplaySessionAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/conversation-coaching-actions.ts |
| `submitRoleplayTurnAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/conversation-coaching-actions.ts |
| `assignCoachingDrillAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/conversation-coaching-actions.ts |
| `getTeamCoachingOverviewAction` | server_action | `L0_READ` | src/app/actions/conversation-coaching-actions.ts |
| `saveScorecardTemplateAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/conversation-coaching-actions.ts |
| `savePracticeScenarioAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/conversation-coaching-actions.ts |
| `runCoachingMigrationAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/conversation-coaching-actions.ts |
| `generateCreativeConceptsAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/creative-ai-actions.ts |
| `listProjectConceptsAction` | server_action | `L0_READ` | src/app/actions/creative-ai-actions.ts |
| `executeAiCanvasCommandAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-ai-actions.ts |
| `generateCopyVariationsAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/creative-ai-actions.ts |
| `submitProjectForReviewAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-collab-actions.ts |
| `approveCreativeProjectAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-collab-actions.ts |
| `requestProjectChangesAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-collab-actions.ts |
| `listProjectsPendingApprovalAction` | server_action | `L0_READ` | src/app/actions/creative-collab-actions.ts |
| `addCanvasPinCommentAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-collab-actions.ts |
| `addCommentReplyAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-collab-actions.ts |
| `listProjectCommentsAction` | server_action | `L0_READ` | src/app/actions/creative-comment-actions.ts |
| `addProjectCommentAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-comment-actions.ts |
| `resolveProjectCommentAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/creative-comment-actions.ts |
| `deleteProjectCommentAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/creative-comment-actions.ts |
| `linkCreativeToCrmCampaignAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-crm-actions.ts |
| `listCrmCampaignsAction` | server_action | `L0_READ` | src/app/actions/creative-crm-actions.ts |
| `getCrmContactPreviewDataAction` | server_action | `L0_READ` | src/app/actions/creative-crm-actions.ts |
| `generateBatchPersonalizedCreativesAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/creative-crm-actions.ts |
| `createCreativeExperimentAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-experiment-actions.ts |
| `listProjectExperimentsAction` | server_action | `L0_READ` | src/app/actions/creative-experiment-actions.ts |
| `getProjectPerformanceMetricsAction` | server_action | `L0_READ` | src/app/actions/creative-performance-actions.ts |
| `listWorkspaceCampaignPerformanceAction` | server_action | `L0_READ` | src/app/actions/creative-performance-actions.ts |
| `exportHighResolutionAssetAction` | server_action | `L0_READ` | src/app/actions/creative-performance-actions.ts |
| `createCreativeProjectAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-project-actions.ts |
| `updateCreativeProjectAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-project-actions.ts |
| `getCreativeProjectWithDocumentAction` | server_action | `L0_READ` | src/app/actions/creative-project-actions.ts |
| `saveCreativeDocumentAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-project-actions.ts |
| `createVersionSnapshotAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-project-actions.ts |
| `listCreativeVersionsAction` | server_action | `L0_READ` | src/app/actions/creative-project-actions.ts |
| `deleteCreativeProjectAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/creative-project-actions.ts |
| `publishCreativeToChannelAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/app/actions/creative-publishing-actions.ts |
| `scheduleCreativePublicationAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-publishing-actions.ts |
| `listPublicationHistoryAction` | server_action | `L0_READ` | src/app/actions/creative-publishing-actions.ts |
| `listConnectedChannelsAction` | server_action | `L0_READ` | src/app/actions/creative-publishing-actions.ts |
| `listCreativeTemplatesAction` | server_action | `L0_READ` | src/app/actions/creative-template-actions.ts |
| `createProjectFromTemplateAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-template-actions.ts |
| `saveCanvasAsTemplateAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-template-actions.ts |
| `seedDefaultTemplatesAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/creative-template-actions.ts |
| `createCertificateTemplateAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/credential-actions.ts |
| `listCertificateTemplatesAction` | server_action | `L0_READ` | src/app/actions/credential-actions.ts |
| `issueCertificateAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/credential-actions.ts |
| `verifyCertificateAction` | server_action | `L0_READ` | src/app/actions/credential-actions.ts |
| `revokeCertificateAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/credential-actions.ts |
| `listIssuedCertificatesAction` | server_action | `L0_READ` | src/app/actions/credential-actions.ts |
| `exportOpenBadgeAction` | server_action | `L0_READ` | src/app/actions/credential-actions.ts |
| `listXApiStatementsAction` | server_action | `L0_READ` | src/app/actions/credential-actions.ts |
| `createBadgeDefinitionAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/credential-actions.ts |
| `listBadgeDefinitionsAction` | server_action | `L0_READ` | src/app/actions/credential-actions.ts |
| `getPersonCrmWorkloadAction` | server_action | `L0_READ` | src/app/actions/crm-workforce-actions.ts |
| `getOrganizationCrmWorkloadOverviewAction` | server_action | `L0_READ` | src/app/actions/crm-workforce-actions.ts |
| `transferOwnershipAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/crm-workforce-actions.ts |
| `listOwnershipTransferJobsAction` | server_action | `L0_READ` | src/app/actions/crm-workforce-actions.ts |
| `checkOffboardingReadinessAction` | server_action | `L0_READ` | src/app/actions/crm-workforce-actions.ts |
| `getSaasMetrics` | server_action | `L0_READ` | src/app/actions/dashboard-actions.ts |
| `getPipelineData` | server_action | `L0_READ` | src/app/actions/dashboard-actions.ts |
| `getUpcomingMeetingsData` | server_action | `L0_READ` | src/app/actions/dashboard-actions.ts |
| `getLatestSurveysData` | server_action | `L0_READ` | src/app/actions/dashboard-actions.ts |
| `getRecentActivitiesData` | server_action | `L0_READ` | src/app/actions/dashboard-actions.ts |
| `resolveWorkspaceEntityRecord` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/deal-actions.ts |
| `updateDealProbabilityAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/deal-actions.ts |
| `updateDealOwnerAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/deal-actions.ts |
| `updateDealDetailsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/deal-actions.ts |
| `addDealContactAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/deal-actions.ts |
| `removeDealContactAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/deal-actions.ts |
| `deleteDealAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/deal-actions.ts |
| `cleanLegacyDealNamesAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/deal-actions.ts |
| `updateStageOrdersAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/deal-actions.ts |
| `updateDealAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/deal-actions.ts |
| `bulkAssignDealsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/deal-actions.ts |
| `bulkDeleteDealsAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/deal-actions.ts |
| `bulkArchiveDealsAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/deal-actions.ts |
| `evaluateAndAdvanceDealOnMeetingAction` | server_action | `L0_READ` | src/app/actions/deal-advancer-actions.ts |
| `generateDealAiInsightsAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/deal-ai-actions.ts |
| `processDealBulkJob` | server_action | `L2_STATE_MUTATION` | src/app/actions/deal-bulk-job-actions.ts |
| `getDealIntelligenceOverviewAction` | server_action | `L0_READ` | src/app/actions/deal-intelligence-actions.ts |
| `getDealHealthDetailAction` | server_action | `L0_READ` | src/app/actions/deal-intelligence-actions.ts |
| `actionBuyerSignalAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/deal-intelligence-actions.ts |
| `saveStakeholderMapAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/deal-intelligence-actions.ts |
| `getMeetingBriefAction` | server_action | `L0_READ` | src/app/actions/deal-intelligence-actions.ts |
| `submitPostMeetingIntelligenceAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/deal-intelligence-actions.ts |
| `saveDealIntelligenceGovernanceAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/deal-intelligence-actions.ts |
| `executeDealIntelligenceMigrationAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/deal-intelligence-actions.ts |
| `createDealQuoteAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/deal-line-item-actions.ts |
| `getDealQuotesAction` | server_action | `L0_READ` | src/app/actions/deal-line-item-actions.ts |
| `getPublicQuoteByTokenAction` | server_action | `L0_READ` | src/app/actions/deal-line-item-actions.ts |
| `updateQuoteStatusAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/deal-line-item-actions.ts |
| `convertQuoteToInvoiceAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/deal-line-item-actions.ts |
| `deleteDealQuoteAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/deal-line-item-actions.ts |
| `executeDealMigration` | server_action | `L2_STATE_MUTATION` | src/app/actions/deal-migration-actions.ts |
| `saveContentStudioDraftAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/draft-actions.ts |
| `getContentStudioDraftAction` | server_action | `L0_READ` | src/app/actions/draft-actions.ts |
| `discardContentStudioDraftAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/draft-actions.ts |
| `listContentStudioDraftsByPortalAction` | server_action | `L0_READ` | src/app/actions/draft-actions.ts |
| `saveOnboardingFlowAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/engagement-actions.ts |
| `getOnboardingFlowAction` | server_action | `L0_READ` | src/app/actions/engagement-actions.ts |
| `advanceOnboardingStepAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/engagement-actions.ts |
| `reconcileOnboardingAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/engagement-actions.ts |
| `recordOrientationWatchedAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/engagement-actions.ts |
| `deleteTaskAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/engagement-actions.ts |
| `listTasksByPortalAction` | server_action | `L0_READ` | src/app/actions/engagement-actions.ts |
| `completeTaskAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/engagement-actions.ts |
| `submitTaskAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/engagement-actions.ts |
| `reviewTaskSubmissionAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/engagement-actions.ts |
| `listPendingSubmissionsAction` | server_action | `L0_READ` | src/app/actions/engagement-actions.ts |
| `logMemberActivityAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/engagement-actions.ts |
| `evaluatePortalInactivityAction` | server_action | `L0_READ` | src/app/actions/engagement-actions.ts |
| `enrichWorkspaceEntitiesContactsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/enrich-workspace-entities-contacts-action.ts |
| `saveEnterpriseSsoAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/enterprise-actions.ts |
| `getEnterpriseSsoAction` | server_action | `L0_READ` | src/app/actions/enterprise-actions.ts |
| `saveWhiteLabelConfigAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/enterprise-actions.ts |
| `getWhiteLabelConfigAction` | server_action | `L0_READ` | src/app/actions/enterprise-actions.ts |
| `createHierarchyNodeAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/enterprise-actions.ts |
| `listHierarchyNodesAction` | server_action | `L0_READ` | src/app/actions/enterprise-actions.ts |
| `listMarketplaceListingsAction` | server_action | `L0_READ` | src/app/actions/enterprise-actions.ts |
| `installMarketplaceTemplateAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/enterprise-actions.ts |
| `listEnterpriseAuditLogsAction` | server_action | `L0_READ` | src/app/actions/enterprise-actions.ts |
| `getEnterpriseIdpConfigAction` | server_action | `L0_READ` | src/app/actions/enterprise-identity-actions.ts |
| `saveEnterpriseIdpConfigAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/enterprise-identity-actions.ts |
| `getMfaPolicyAction` | server_action | `L0_READ` | src/app/actions/enterprise-identity-actions.ts |
| `saveMfaPolicyAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/enterprise-identity-actions.ts |
| `getDirectorySyncConfigAction` | server_action | `L0_READ` | src/app/actions/enterprise-identity-actions.ts |
| `saveDirectorySyncConfigAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/enterprise-identity-actions.ts |
| `listDirectorySyncLogsAction` | server_action | `L0_READ` | src/app/actions/enterprise-identity-actions.ts |
| `getEnterpriseSessionConfigAction` | server_action | `L0_READ` | src/app/actions/enterprise-identity-actions.ts |
| `saveEnterpriseSessionConfigAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/enterprise-identity-actions.ts |
| `getEntityContactsAction` | server_action | `L0_READ` | src/app/actions/entity-contact-actions.ts |
| `getEntityDealDefaultsAction` | server_action | `L0_READ` | src/app/actions/entity-contact-actions.ts |
| `searchEntitiesForDealAction` | server_action | `L0_READ` | src/app/actions/entity-contact-actions.ts |
| `fetchEntitiesForSchemaRestructure` | server_action | `L0_READ` | src/app/actions/entity-schema-restructure-actions.ts |
| `enrichEntitiesWithNewSchema` | server_action | `L2_STATE_MUTATION` | src/app/actions/entity-schema-restructure-actions.ts |
| `restoreEntitySchemaRestructure` | server_action | `L2_STATE_MUTATION` | src/app/actions/entity-schema-restructure-actions.ts |
| `rollbackEntitySchemaRestructure` | server_action | `L2_STATE_MUTATION` | src/app/actions/entity-schema-restructure-actions.ts |
| `createLiveEventAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-actions.ts |
| `updateLiveEventAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-actions.ts |
| `deleteLiveEventAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/event-actions.ts |
| `listLiveEventsByPortalAction` | server_action | `L0_READ` | src/app/actions/event-actions.ts |
| `listCohortsByPortalAction` | server_action | `L0_READ` | src/app/actions/event-actions.ts |
| `registerForEventAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-actions.ts |
| `cancelEventRegistrationAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-actions.ts |
| `recordEventAttendanceAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-actions.ts |
| `recordJoinSessionAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-actions.ts |
| `recordLeaveSessionAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-actions.ts |
| `publishEventReplayAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/app/actions/event-actions.ts |
| `attachReplayToCourseLessonAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-actions.ts |
| `createCohortAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-actions.ts |
| `updateCohortAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-actions.ts |
| `deleteCohortAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/event-actions.ts |
| `enrollCohortMemberAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-actions.ts |
| `removeCohortMemberAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-actions.ts |
| `listCohortMembersAction` | server_action | `L0_READ` | src/app/actions/event-actions.ts |
| `getUniqueEventTypeSlug` | server_action | `L0_READ` | src/app/actions/event-type-actions.ts |
| `createEventTypeAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-type-actions.ts |
| `updateEventTypeAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-type-actions.ts |
| `deleteEventTypeAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/event-type-actions.ts |
| `duplicateEventTypeAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-type-actions.ts |
| `toggleEventTypeStatusAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/event-type-actions.ts |
| `getEventTypesAction` | server_action | `L0_READ` | src/app/actions/event-type-actions.ts |
| `executeVariablesFERMigrationAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/execute-variables-fer-migration-action.ts |
| `executeFixOrgAdminPermissionsFerAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/fix-org-admin-permissions-fer-action.ts |
| `getFilteredTemplatesAction` | server_action | `L0_READ` | src/app/actions/get-filtered-templates-action.ts |
| `getMigrationStatusAction` | server_action | `L0_READ` | src/app/actions/get-migration-status-action.ts |
| `createAccessReviewCampaignAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/governance-actions.ts |
| `submitReviewDecisionAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/governance-actions.ts |
| `listAccessReviewCampaignsAction` | server_action | `L0_READ` | src/app/actions/governance-actions.ts |
| `listReviewDecisionsAction` | server_action | `L0_READ` | src/app/actions/governance-actions.ts |
| `grantTemporaryAccessAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/governance-actions.ts |
| `revokeTemporaryAccessAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/governance-actions.ts |
| `reapExpiredGrantsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/governance-actions.ts |
| `listTemporaryAccessGrantsAction` | server_action | `L0_READ` | src/app/actions/governance-actions.ts |
| `createOrUpdateSoDRuleAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/governance-actions.ts |
| `deleteSoDRuleAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/governance-actions.ts |
| `listSoDRulesAction` | server_action | `L0_READ` | src/app/actions/governance-actions.ts |
| `scanSoDConflictsAction` | server_action | `L0_READ` | src/app/actions/governance-actions.ts |
| `revokeSessionAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/governance-actions.ts |
| `revokeAllSessionsAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/governance-actions.ts |
| `listSessionsAction` | server_action | `L0_READ` | src/app/actions/governance-actions.ts |
| `getSecurityPolicyAction` | server_action | `L0_READ` | src/app/actions/governance-actions.ts |
| `updateSecurityPolicyAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/governance-actions.ts |
| `listSecurityAuditEventsAction` | server_action | `L0_READ` | src/app/actions/governance-actions.ts |
| `generateHeadlineVariationsAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/headline-iq-actions.ts |
| `getPeopleDirectoryAction` | server_action | `L0_READ` | src/app/actions/identity-actions.ts |
| `getPersonDetailAction` | server_action | `L0_READ` | src/app/actions/identity-actions.ts |
| `updatePersonProfileAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/identity-actions.ts |
| `updateMembershipStatusAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/identity-actions.ts |
| `manageWorkspaceMembershipsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/identity-actions.ts |
| `invitePersonAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/app/actions/identity-actions.ts |
| `reconcileOrganizationIdentitiesAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/identity-actions.ts |
| `fetchSchoolsForSaaSMigration` | server_action | `L0_READ` | src/app/actions/industry-migration-actions.ts |
| `enrichSchoolsWithSaaSIndustry` | server_action | `L2_STATE_MUTATION` | src/app/actions/industry-migration-actions.ts |
| `restoreSaaSMigration` | server_action | `L2_STATE_MUTATION` | src/app/actions/industry-migration-actions.ts |
| `rollbackSaaSMigration` | server_action | `L2_STATE_MUTATION` | src/app/actions/industry-migration-actions.ts |
| `getKnowledgeGraphGovernanceAction` | server_action | `L0_READ` | src/app/actions/knowledge-graph-governance-actions.ts |
| `updateKnowledgeGraphGovernanceAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/knowledge-graph-governance-actions.ts |
| `getKnowledgeGraphMetricsAction` | server_action | `L0_READ` | src/app/actions/knowledge-graph-governance-actions.ts |
| `triggerBackfillCrmRelationsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/knowledge-graph-governance-actions.ts |
| `resetKnowledgeGraphGovernanceAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/knowledge-graph-governance-actions.ts |
| `getLeadSettingsAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `saveLeadSettingsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `parseNaturalLanguageQueryAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `searchProspectsAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `enrichProspectAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `batchEnrichProspectsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `importProspectsFromCSVAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `syncProspectToCRMAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `batchSyncProspectsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `getRecentProspectsAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `saveSearchAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `getSavedSearchesAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `createLeadListAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `getLeadListsAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `addProspectsToListAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `deleteLeadListAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/lead-intelligence-actions.ts |
| `previewEnrichmentCostAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/lead-intelligence-actions.ts |
| `saveViewAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `getSavedViewsAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `deleteSavedViewAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/lead-intelligence-actions.ts |
| `getIdentityCollisionsAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `scanWorkspaceForCollisionsAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `executeIdentityMergeAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `dismissCollisionAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `probeDomainSubdomainsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `enrichTechnographicsDeepAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `getEnrichmentDimensionsAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `verifyProspectEmailAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `bulkVerifyProspectEmailsAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `generateAIResearchDossierAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/lead-intelligence-actions.ts |
| `getAIResearchDossierAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `getWorkspaceSignalsAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `getProspectSignalsAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `getAccountMonitoringConfigAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `saveAccountMonitoringConfigAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `markSignalReadAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `dismissSignalAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `triggerProspectDeltaScanAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `getWorkspaceScoringModelAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `saveWorkspaceScoringModelAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `simulateScoringModelAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/lead-intelligence-actions.ts |
| `recalculateWorkspaceScoresAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `getProspectScoreHistoryAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `checkProspectCRMMatchAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `enrichExistingCRMRecordAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `getUnifiedActivityTimelineAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `getWorkspaceSegmentsAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `saveDynamicSegmentAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `deleteDynamicSegmentAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/lead-intelligence-actions.ts |
| `evaluateSegmentCountAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `getProspectingCampaignsAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `saveProspectingCampaignAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `launchProspectingCampaignAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/app/actions/lead-intelligence-actions.ts |
| `getRevenueAttributionReportAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `executeDataRemediationAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `getDailyRepBriefingAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `getPriorityQueueItemAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `executeProspectActivationAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `generateAIOutreachDraftAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/lead-intelligence-actions.ts |
| `getIntelligenceInboxAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `markInboxItemReadAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `getPredictiveConversionAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `getEnterpriseGovernanceConfigAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `saveEnterpriseGovernanceConfigAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `getProviderHealthStatusAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `getCreditLedgerSummaryAction` | server_action | `L0_READ` | src/app/actions/lead-intelligence-actions.ts |
| `executeEnterpriseDataImportAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `regenerateExtensionTokenAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/lead-intelligence-actions.ts |
| `createCourseAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/learning-actions.ts |
| `updateCourseAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/learning-actions.ts |
| `deleteCourseAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/learning-actions.ts |
| `listCoursesByPortalAction` | server_action | `L0_READ` | src/app/actions/learning-actions.ts |
| `createModuleAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/learning-actions.ts |
| `updateModuleAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/learning-actions.ts |
| `deleteModuleAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/learning-actions.ts |
| `createLessonAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/learning-actions.ts |
| `updateLessonAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/learning-actions.ts |
| `deleteLessonAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/learning-actions.ts |
| `listLessonsByCourseAction` | server_action | `L0_READ` | src/app/actions/learning-actions.ts |
| `enrollInCourseAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/learning-actions.ts |
| `completeLessonAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/learning-actions.ts |
| `recordVideoProgressAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/learning-actions.ts |
| `submitAssessmentAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/learning-actions.ts |
| `submitAssignmentAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/learning-actions.ts |
| `getSanitizedAssessmentAction` | server_action | `L0_READ` | src/app/actions/learning-actions.ts |
| `getLinkMetadataAction` | server_action | `L0_READ` | src/app/actions/link-metadata-actions.ts |
| `getManagerCommandOverviewAction` | server_action | `L0_READ` | src/app/actions/manager-command-actions.ts |
| `executeManagerInterventionAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/manager-command-actions.ts |
| `rebalanceTeamWorkloadAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/manager-command-actions.ts |
| `generateRepCoachingBriefAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/manager-command-actions.ts |
| `runSalesTeamMigrationAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/manager-command-actions.ts |
| `getBackofficeSalesTeamsAction` | server_action | `L0_READ` | src/app/actions/manager-command-actions.ts |
| `saveSalesTeamConfigAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/manager-command-actions.ts |
| `updateAgentCapacityAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/manager-command-actions.ts |
| `extractAndSaveMeetingActionItemsAction` | server_action | `L0_READ` | src/app/actions/meeting-action-items-actions.ts |
| `getMeetingActionItemsAction` | server_action | `L0_READ` | src/app/actions/meeting-action-items-actions.ts |
| `approveAndSyncActionItemAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-action-items-actions.ts |
| `getMeetingActivitiesAction` | server_action | `L0_READ` | src/app/actions/meeting-activity-actions.ts |
| `getMeetingsOperationalOverviewAction` | server_action | `L0_READ` | src/app/actions/meeting-analytics-actions.ts |
| `validateRegistrantToken` | server_action | `L0_READ` | src/app/actions/meeting-attendance-actions.ts |
| `toggleRegistrantAttendance` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-attendance-actions.ts |
| `bulkRescheduleMeetingsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-bulk-actions.ts |
| `bulkCancelMeetingsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-bulk-actions.ts |
| `overrideSeriesInstanceAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-bulk-actions.ts |
| `getWorkspaceCalendarEventsAction` | server_action | `L0_READ` | src/app/actions/meeting-calendar-actions.ts |
| `quickScheduleMeetingAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-calendar-actions.ts |
| `analyzeMeetingSpeechCoachingAction` | server_action | `L0_READ` | src/app/actions/meeting-coach-actions.ts |
| `getMeetingSpeechCoachingAction` | server_action | `L0_READ` | src/app/actions/meeting-coach-actions.ts |
| `getWorkspaceCompliancePolicyAction` | server_action | `L0_READ` | src/app/actions/meeting-compliance-actions.ts |
| `saveWorkspaceCompliancePolicyAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-compliance-actions.ts |
| `exportMeetingAuditLogsAction` | server_action | `L0_READ` | src/app/actions/meeting-compliance-actions.ts |
| `evaluateRetentionPurgeAction` | server_action | `L0_READ` | src/app/actions/meeting-compliance-actions.ts |
| `getMeetingCRMContextAction` | server_action | `L0_READ` | src/app/actions/meeting-crm-actions.ts |
| `associateMeetingDealAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-crm-actions.ts |
| `resendFacilitatorLinksAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/app/actions/meeting-facilitator-actions.ts |
| `updateMeetingFacilitatorAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-facilitator-actions.ts |
| `logFacilitatorAttendance` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-facilitator-actions.ts |
| `submitPublicMeetingFeedbackAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-feedback-actions.ts |
| `getMeetingFeedbackSummaryAction` | server_action | `L0_READ` | src/app/actions/meeting-feedback-actions.ts |
| `generateMeetingIntelligenceAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/meeting-intelligence-actions.ts |
| `getMeetingIntelligenceAction` | server_action | `L0_READ` | src/app/actions/meeting-intelligence-actions.ts |
| `convertActionItemToCrmTaskAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-intelligence-actions.ts |
| `generateMeetingPrepBriefAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/meeting-intelligence-actions.ts |
| `createEntityFromRegistration` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-lead-capture-action.ts |
| `migrateMeetingToUnifiedSchemaAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-migration-actions.ts |
| `scheduleMeetingRemindersAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-notification-actions.ts |
| `getMeetingReminderJobsAction` | server_action | `L0_READ` | src/app/actions/meeting-notification-actions.ts |
| `addMeetingParticipantAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-participant-actions.ts |
| `updateParticipantRoleAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-participant-actions.ts |
| `updateParticipantRsvpAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-participant-actions.ts |
| `toggleParticipantAttendanceAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-participant-actions.ts |
| `removeParticipantAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-participant-actions.ts |
| `bulkImportParticipantsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-participant-actions.ts |
| `createBookingPaymentIntentAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-payment-actions.ts |
| `processBookingRefundAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/app/actions/meeting-payment-actions.ts |
| `createMeetingPollAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-poll-actions.ts |
| `getMeetingPollsAction` | server_action | `L0_READ` | src/app/actions/meeting-poll-actions.ts |
| `getMeetingPollBySlugAction` | server_action | `L0_READ` | src/app/actions/meeting-poll-actions.ts |
| `submitPollVoteAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-poll-actions.ts |
| `finalizeMeetingPollAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-poll-actions.ts |
| `scheduleMeetingPostEvent` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-post-event-action.ts |
| `cancelMeetingPostEvent` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-post-event-action.ts |
| `attachMeetingRecordingAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-recording-actions.ts |
| `getMeetingRecordingsAction` | server_action | `L0_READ` | src/app/actions/meeting-recording-actions.ts |
| `deleteMeetingRecordingAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/meeting-recording-actions.ts |
| `generateRecordingPlaybackUrlAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/meeting-recording-actions.ts |
| `deleteRegistrantAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/meeting-registrants-actions.ts |
| `updateRegistrantStatusAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-registrants-actions.ts |
| `adminRegisterParticipantAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-registrants-actions.ts |
| `sendMeetingInvitationsAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/app/actions/meeting-registrants-actions.ts |
| `submitRsvpResponseAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-registrants-actions.ts |
| `manuallyUpdateGuestStatusAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-registrants-actions.ts |
| `getWorkspaceResourcesAction` | server_action | `L0_READ` | src/app/actions/meeting-resource-actions.ts |
| `saveWorkspaceResourceAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-resource-actions.ts |
| `deleteWorkspaceResourceAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/meeting-resource-actions.ts |
| `reservePhysicalResourceAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-resource-actions.ts |
| `recordMeetingTelemetryAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-telemetry-actions.ts |
| `getWorkspaceTelemetryMetricsAction` | server_action | `L0_READ` | src/app/actions/meeting-telemetry-actions.ts |
| `getMeetingTemplatesAction` | server_action | `L0_READ` | src/app/actions/meeting-template-actions.ts |
| `deployMeetingTemplateAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-template-actions.ts |
| `getMeetingWebhooksAction` | server_action | `L0_READ` | src/app/actions/meeting-webhook-actions.ts |
| `saveMeetingWebhookAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-webhook-actions.ts |
| `deleteMeetingWebhookAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/meeting-webhook-actions.ts |
| `testDispatchWebhookAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/app/actions/meeting-webhook-actions.ts |
| `getWebhookDeliveryLogsAction` | server_action | `L0_READ` | src/app/actions/meeting-webhook-actions.ts |
| `getEventTypeWorkflowsAction` | server_action | `L0_READ` | src/app/actions/meeting-workflow-actions.ts |
| `saveEventTypeWorkflowsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-workflow-actions.ts |
| `triggerMeetingLifecycleWorkflowsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/meeting-workflow-actions.ts |
| `createMembershipAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/membership-actions.ts |
| `updateMembershipRoleAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/membership-actions.ts |
| `suspendMembershipAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/membership-actions.ts |
| `reactivateMembershipAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/membership-actions.ts |
| `deleteMembershipAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/membership-actions.ts |
| `updatePortalMemberProfileAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/membership-actions.ts |
| `updateMembershipPlanAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/membership-actions.ts |
| `updateMembershipTagsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/membership-actions.ts |
| `createInvitationAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/membership-actions.ts |
| `createBulkInvitationsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/membership-actions.ts |
| `verifyInvitationTokenAction` | server_action | `L0_READ` | src/app/actions/membership-actions.ts |
| `acceptInvitationAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/membership-actions.ts |
| `joinPortalDirectAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/membership-actions.ts |
| `revokeInvitationAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/membership-actions.ts |
| `createPlanAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/membership-actions.ts |
| `updatePlanAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/membership-actions.ts |
| `archivePlanAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/membership-actions.ts |
| `checkEntitlementAction` | server_action | `L0_READ` | src/app/actions/membership-actions.ts |
| `grantAccessAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/membership-actions.ts |
| `revokeAccessAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/membership-actions.ts |
| `listMembershipsByPortalAction` | server_action | `L0_READ` | src/app/actions/membership-actions.ts |
| `listInvitationsByPortalAction` | server_action | `L0_READ` | src/app/actions/membership-actions.ts |
| `listPlansByPortalAction` | server_action | `L0_READ` | src/app/actions/membership-actions.ts |
| `evaluateContentAccessAction` | server_action | `L0_READ` | src/app/actions/membership-actions.ts |
| `migrateLegacyTemplatesToBlocksAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/migrate-legacy-templates-to-blocks-action.ts |
| `fetchOutdatedCampaignPages` | server_action | `L0_READ` | src/app/actions/migrate-legacy-testimonials-action.ts |
| `migrateLegacyTestimonialBlocksAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/migrate-legacy-testimonials-action.ts |
| `getParkedJobsCountAction` | server_action | `L0_READ` | src/app/actions/node-deletion-reconciliation-actions.ts |
| `reconcileParkedJobsOnNodeDeletionAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/node-deletion-reconciliation-actions.ts |
| `getOfficeHoursRoomAction` | server_action | `L0_READ` | src/app/actions/office-hours-actions.ts |
| `updateHostOfficeHoursStatusAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/office-hours-actions.ts |
| `joinOfficeHoursQueueAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/office-hours-actions.ts |
| `pingQueueHeartbeatAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/office-hours-actions.ts |
| `admitNextVisitorAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/office-hours-actions.ts |
| `leaveOfficeHoursQueueAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/office-hours-actions.ts |
| `createOrUpdateJourneyAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/onboarding-actions.ts |
| `deleteJourneyAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/onboarding-actions.ts |
| `listJourneysAction` | server_action | `L0_READ` | src/app/actions/onboarding-actions.ts |
| `seedDefaultJourneysAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/onboarding-actions.ts |
| `startOnboardingJourneyAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/onboarding-actions.ts |
| `submitOnboardingStepAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/onboarding-actions.ts |
| `getMemberOnboardingInstanceAction` | server_action | `L0_READ` | src/app/actions/onboarding-actions.ts |
| `listOnboardingInstancesAction` | server_action | `L0_READ` | src/app/actions/onboarding-actions.ts |
| `bulkAssignJourneyAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/onboarding-actions.ts |
| `adminOverrideStepAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/onboarding-actions.ts |
| `getOnboardingSetupStateAction` | server_action | `L0_READ` | src/app/actions/onboarding-actions.ts |
| `scanOrphanedRunsAction` | server_action | `L0_READ` | src/app/actions/orphaned-runs-reconciliation-actions.ts |
| `reconcileOrphanedRunsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/orphaned-runs-reconciliation-actions.ts |
| `recoverFailedRunsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/orphaned-runs-reconciliation-actions.ts |
| `getWorkspacePolicyAction` | server_action | `L0_READ` | src/app/actions/policy-studio-actions.ts |
| `simulatePolicyImpactAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/policy-studio-actions.ts |
| `saveAndPublishPolicyAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/app/actions/policy-studio-actions.ts |
| `getPolicyVersionHistoryAction` | server_action | `L0_READ` | src/app/actions/policy-studio-actions.ts |
| `rollbackPolicyVersionAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/policy-studio-actions.ts |
| `resetPolicyToDefaultsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/policy-studio-actions.ts |
| `getBackofficePoliciesListAction` | server_action | `L0_READ` | src/app/actions/policy-studio-actions.ts |
| `createPortalAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/portal-actions.ts |
| `updatePortalAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/portal-actions.ts |
| `publishPortalAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/app/actions/portal-actions.ts |
| `suspendPortalAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/portal-actions.ts |
| `archivePortalAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/portal-actions.ts |
| `duplicatePortalAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/portal-actions.ts |
| `deletePortalAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/portal-actions.ts |
| `verifyPortalSlugAvailabilityAction` | server_action | `L0_READ` | src/app/actions/portal-actions.ts |
| `validatePortalPasswordAction` | server_action | `L0_READ` | src/app/actions/portal-actions.ts |
| `getPublicPortalBySlugAction` | server_action | `L0_READ` | src/app/actions/portal-actions.ts |
| `getPortalByIdAction` | server_action | `L0_READ` | src/app/actions/portal-actions.ts |
| `runMasterExperienceSeederAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/portal-actions.ts |
| `normalizeExistingPortalNavigationAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/portal-actions.ts |
| `getPortalAnalyticsAction` | server_action | `L0_READ` | src/app/actions/portal-analytics-actions.ts |
| `refreshPortalAnalyticsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/portal-analytics-actions.ts |
| `updateProductAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/product-actions.ts |
| `listPriceBooksAction` | server_action | `L0_READ` | src/app/actions/product-actions.ts |
| `savePriceBookItemsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/product-actions.ts |
| `deleteProductCategoryAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/product-actions.ts |
| `updateProductCategoryAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/product-actions.ts |
| `deletePriceBookAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/product-actions.ts |
| `updatePriceBookAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/product-actions.ts |
| `executePurgeFocalPersonsFerAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/purge-focal-persons-fer-action.ts |
| `executePurgeLegacyFieldsFerAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/purge-legacy-fields-fer-action.ts |
| `generateQRFromPromptAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/qr-ai-actions.ts |
| `generateContextualCopyAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/qr-ai-actions.ts |
| `transformCanvasThemeAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/qr-ai-actions.ts |
| `fetchUsersForWorkspaceRbacMigration` | server_action | `L0_READ` | src/app/actions/rbac-workspace-migration-actions.ts |
| `enrichUsersWithWorkspaceRbac` | server_action | `L2_STATE_MUTATION` | src/app/actions/rbac-workspace-migration-actions.ts |
| `restoreWorkspaceRbacMigration` | server_action | `L2_STATE_MUTATION` | src/app/actions/rbac-workspace-migration-actions.ts |
| `rollbackWorkspaceRbacMigration` | server_action | `L2_STATE_MUTATION` | src/app/actions/rbac-workspace-migration-actions.ts |
| `decryptRecipientAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/recipient-tracking-actions.ts |
| `createRecurringSeriesAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/recurring-series-actions.ts |
| `getRecurringSeriesAction` | server_action | `L0_READ` | src/app/actions/recurring-series-actions.ts |
| `cancelRecurringSeriesAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/recurring-series-actions.ts |
| `registerSkeletonWhatsAppAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/register-skeleton-whatsapp-action.ts |
| `getRevenueForecastOverviewAction` | server_action | `L0_READ` | src/app/actions/revenue-forecasting-actions.ts |
| `reassignForecastCategoryAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/revenue-forecasting-actions.ts |
| `recalculateDealAttributionAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/revenue-forecasting-actions.ts |
| `saveRevenueGovernanceAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/revenue-forecasting-actions.ts |
| `executeRevenueMigrationAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/revenue-forecasting-actions.ts |
| `getExecutiveBoardroomDataAction` | server_action | `L0_READ` | src/app/actions/revenue-os-actions.ts |
| `simulateRevenueScenarioAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/revenue-os-actions.ts |
| `saveRevenueScenarioAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/revenue-os-actions.ts |
| `deleteRevenueScenarioAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/revenue-os-actions.ts |
| `applyStrategicRecommendationAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/revenue-os-actions.ts |
| `updateRevenueOsGovernanceAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/revenue-os-actions.ts |
| `reseedRevenueOsDefaultsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/revenue-os-actions.ts |
| `getRoutingFormsAction` | server_action | `L0_READ` | src/app/actions/routing-form-actions.ts |
| `getRoutingFormBySlugAction` | server_action | `L0_READ` | src/app/actions/routing-form-actions.ts |
| `createOrUpdateRoutingFormAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/routing-form-actions.ts |
| `deleteRoutingFormAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/routing-form-actions.ts |
| `submitRoutingFormAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/routing-form-actions.ts |
| `runMeetingsFerAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/run-meetings-fer-action.ts |
| `getSalesOrchestrationDataAction` | server_action | `L0_READ` | src/app/actions/sales-orchestration-actions.ts |
| `saveSalesPlayAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/sales-orchestration-actions.ts |
| `toggleSalesPlayStatusAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/sales-orchestration-actions.ts |
| `executePlayStepAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/sales-orchestration-actions.ts |
| `resolveApprovalRequestAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/sales-orchestration-actions.ts |
| `resolveEscalationIncidentAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/sales-orchestration-actions.ts |
| `triggerSalesPlayManuallyAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/sales-orchestration-actions.ts |
| `saveRoutingRuleAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/sales-orchestration-actions.ts |
| `saveEscalationRuleAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/sales-orchestration-actions.ts |
| `saveOrchestrationGovernanceAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/sales-orchestration-actions.ts |
| `executeOrchestrationMigrationAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/sales-orchestration-actions.ts |
| `getPerformanceOverviewAction` | server_action | `L0_READ` | src/app/actions/sales-performance-actions.ts |
| `getRepAuditLedgerAction` | server_action | `L0_READ` | src/app/actions/sales-performance-actions.ts |
| `getRepPerformanceDetailAction` | server_action | `L0_READ` | src/app/actions/sales-performance-actions.ts |
| `listWorkspaceTargetsAction` | server_action | `L0_READ` | src/app/actions/sales-performance-actions.ts |
| `createOrUpdateTargetAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/sales-performance-actions.ts |
| `deleteTargetAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/sales-performance-actions.ts |
| `renderScheduledMessageAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/scheduled-message-actions.ts |
| `sendTestMessageAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/app/actions/scheduled-message-actions.ts |
| `rescheduleMessageAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/scheduled-message-actions.ts |
| `cancelMessageAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/scheduled-message-actions.ts |
| `sendMessageNowAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/app/actions/scheduled-message-actions.ts |
| `updateScheduledMessageContentAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/scheduled-message-actions.ts |
| `getGoogleAuthUrlAction` | server_action | `L0_READ` | src/app/actions/scheduler-actions.ts |
| `getMicrosoftAuthUrlAction` | server_action | `L0_READ` | src/app/actions/scheduler-actions.ts |
| `getZoomAuthUrlAction` | server_action | `L0_READ` | src/app/actions/scheduler-actions.ts |
| `disconnectConnectionAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/scheduler-actions.ts |
| `getBookingPageBySlugAction` | server_action | `L0_READ` | src/app/actions/scheduler-actions.ts |
| `getAvailableSlotsAction` | server_action | `L0_READ` | src/app/actions/scheduler-actions.ts |
| `createBookingAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/scheduler-actions.ts |
| `saveBookingPageAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/scheduler-actions.ts |
| `deleteBookingPageAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/scheduler-actions.ts |
| `ensureWorkspaceAvailabilityAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/scheduler-actions.ts |
| `seedInfrastructureAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/seed-actions.ts |
| `executeSeedAllWorkspacesFieldsFerAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/seed-all-workspaces-fields-fer-action.ts |
| `seedDefaultStyleBlueprintsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/seed-default-style-blueprints-action.ts |
| `seedGlobalTemplatesAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/seed-global-templates-action.ts |
| `seedMaintenanceAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/seed-maintenance-action.ts |
| `seedEnrichedMeetingTemplatesAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/seed-meeting-invitation-templates-action.ts |
| `seedMeetingsV2Action` | server_action | `L2_STATE_MUTATION` | src/app/actions/seed-meetings-action.ts |
| `seedPlatformPageTemplatesAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/seed-platform-page-templates-action.ts |
| `seedPromptsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/seed-prompts-action.ts |
| `getMyDayOverviewAction` | server_action | `L0_READ` | src/app/actions/seller-workspace-actions.ts |
| `executeQuickActionAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/seller-workspace-actions.ts |
| `snoozeQueueItemAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/seller-workspace-actions.ts |
| `dismissQueueItemAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/seller-workspace-actions.ts |
| `setDefaultSenderProfileAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/set-default-sender-action.ts |
| `clearWorkspaceDefaultSenderAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/set-default-sender-action.ts |
| `generateSocialVariationAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/social-composer-actions.ts |
| `createSocialPostAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/social-composer-actions.ts |
| `updatePostScheduleAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/social-composer-actions.ts |
| `recommendBestTimeAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/social-composer-actions.ts |
| `simulateInboundMessageAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/social-composer-actions.ts |
| `generateInboxReplyAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/social-composer-actions.ts |
| `sendInboxManualReplyAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/app/actions/social-composer-actions.ts |
| `linkInboxToCRMAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/social-composer-actions.ts |
| `simulateSocialConversionsAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/social-composer-actions.ts |
| `simulateListeningMentionAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/social-composer-actions.ts |
| `executeStripAccountStatusFerAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/strip-account-status-fer-action.ts |
| `getAssigneeDetails` | server_action | `L0_READ` | src/app/actions/survey-assignee-actions.ts |
| `sendSurveyLinkToAssignee` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/app/actions/survey-assignee-actions.ts |
| `generateKeywordsAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/survey-seo-actions.ts |
| `executeTemplateIdentifiersFerAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/template-identifiers-fer-action.ts |
| `runTenantSenderHygieneAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/tenant-hygiene-action.ts |
| `runGenerateThumbnail` | server_action | `L2_STATE_MUTATION` | src/app/actions/thumbnail-actions.ts |
| `runModifyThumbnail` | server_action | `L2_STATE_MUTATION` | src/app/actions/thumbnail-actions.ts |
| `runGenerateHooks` | server_action | `L2_STATE_MUTATION` | src/app/actions/thumbnail-actions.ts |
| `executeUnexpireImportPayloadsFerAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/unexpire-import-payloads-fer-action.ts |
| `updatePreferencesAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/unsubscribe-actions.ts |
| `getWebinarStageStateAction` | server_action | `L0_READ` | src/app/actions/webinar-stage-actions.ts |
| `togglePresenterStageStatusAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/webinar-stage-actions.ts |
| `postWebinarQuestionAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/webinar-stage-actions.ts |
| `upvoteWebinarQuestionAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/webinar-stage-actions.ts |
| `promoteWaitlistRegistrantsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/webinar-stage-actions.ts |
| `createOrUpdateDepartmentAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/workforce-actions.ts |
| `deleteDepartmentAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/workforce-actions.ts |
| `listDepartmentsAction` | server_action | `L0_READ` | src/app/actions/workforce-actions.ts |
| `purgeSampleDepartmentsAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/workforce-actions.ts |
| `backfillDepartmentSeedsAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/workforce-actions.ts |
| `createOrUpdateTeamAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/workforce-actions.ts |
| `deleteTeamAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/workforce-actions.ts |
| `listTeamsAction` | server_action | `L0_READ` | src/app/actions/workforce-actions.ts |
| `dispatchInvitationsAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/app/actions/workforce-actions.ts |
| `resendInvitationAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/app/actions/workforce-actions.ts |
| `revokeInvitationAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/actions/workforce-actions.ts |
| `listInvitationsAction` | server_action | `L0_READ` | src/app/actions/workforce-actions.ts |
| `validateInvitationTokenAction` | server_action | `L0_READ` | src/app/actions/workforce-actions.ts |
| `acceptInvitationAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/workforce-actions.ts |
| `submitAccessRequestAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/workforce-actions.ts |
| `resolveAccessRequestAction` | server_action | `L1_INTERNAL_DRAFT` | src/app/actions/workforce-actions.ts |
| `listAccessRequestsAction` | server_action | `L0_READ` | src/app/actions/workforce-actions.ts |
| `executeBulkWorkforceAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/workforce-actions.ts |
| `getWorkforceIntelligenceSnapshotAction` | server_action | `L0_READ` | src/app/actions/workforce-intelligence-actions.ts |
| `refreshWorkforceIntelligenceSnapshotAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/workforce-intelligence-actions.ts |
| `fetchWorkspacesForIndustryMigration` | server_action | `L0_READ` | src/app/actions/workspace-industry-migration-actions.ts |
| `enrichWorkspacesWithIndustry` | server_action | `L2_STATE_MUTATION` | src/app/actions/workspace-industry-migration-actions.ts |
| `restoreWorkspaceIndustryMigration` | server_action | `L2_STATE_MUTATION` | src/app/actions/workspace-industry-migration-actions.ts |
| `rollbackWorkspaceIndustryMigration` | server_action | `L2_STATE_MUTATION` | src/app/actions/workspace-industry-migration-actions.ts |
| `executeWorkspaceScopeFetchEnrichRestoreAction` | server_action | `L2_STATE_MUTATION` | src/app/actions/workspace-scope-migration-actions.ts |
| `ActionNode` | server_action | `L2_STATE_MUTATION` | src/app/admin/automations/[id]/edit/components/nodes/ActionNode.tsx |
| `NodeActionToolbar` | server_action | `L2_STATE_MUTATION` | src/app/admin/automations/[id]/edit/components/nodes/NodeActionToolbar.tsx |
| `TagActionNode` | server_action | `L2_STATE_MUTATION` | src/app/admin/automations/[id]/edit/components/nodes/TagActionNode.tsx |
| `ActionConfigPanel` | server_action | `L2_STATE_MUTATION` | src/app/admin/automations/components/ActionConfigPanel.tsx |
| `DealQuickActions` | server_action | `L2_STATE_MUTATION` | src/app/admin/deals/[id]/components/DealQuickActions.tsx |
| `BulkActionDock` | server_action | `L2_STATE_MUTATION` | src/app/admin/entities/components/BulkActionDock.tsx |
| `FloatingActionToolbar` | server_action | `L2_STATE_MUTATION` | src/app/admin/lead-intelligence/components/FloatingActionToolbar.tsx |
| `MediaAnalyticsBulkActionsBar` | server_action | `L2_STATE_MUTATION` | src/app/admin/media/analytics/components/MediaAnalyticsBulkActionsBar.tsx |
| `MeetingActionItemsDrawer` | server_action | `L2_STATE_MUTATION` | src/app/admin/meetings/[id]/components/MeetingActionItemsDrawer.tsx |
| `ActionExecutionDrawer` | server_action | `L2_STATE_MUTATION` | src/app/admin/my-day/components/ActionExecutionDrawer.tsx |
| `ActionTargetModal` | server_action | `L2_STATE_MUTATION` | src/app/admin/pages/[id]/builder/components/ActionTargetModal.tsx |
| `PipelineActionsView` | server_action | `L2_STATE_MUTATION` | src/app/admin/pipeline/components/PipelineActionsView.tsx |
| `SurveyAnalyticsBulkActionsBar` | server_action | `L2_STATE_MUTATION` | src/app/admin/surveys/[id]/results/components/SurveyAnalyticsBulkActionsBar.tsx |
| `BulkActionsBar` | server_action | `L2_STATE_MUTATION` | src/app/admin/surveys/components/BulkActionsBar.tsx |
| `BulkActionsFloatingToolbar` | server_action | `L2_STATE_MUTATION` | src/app/admin/users/components/BulkActionsFloatingToolbar.tsx |
| `QuickActions` | server_action | `L2_STATE_MUTATION` | src/components/dashboard/QuickActions.tsx |
| `ContextualActionBar` | server_action | `L2_STATE_MUTATION` | src/components/shared/thumbnail-designer/ContextualActionBar.tsx |
| `getActivitiesForContactCore` | server_action | `L0_READ` | src/lib/activity-actions.ts |
| `updateNote` | server_action | `L2_STATE_MUTATION` | src/lib/activity-actions.ts |
| `deleteNote` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/activity-actions.ts |
| `getActivitiesForContact` | server_action | `L0_READ` | src/lib/activity-actions.ts |
| `listSpecialistsAction` | server_action | `L0_READ` | src/lib/agents/actions/domain-agent-actions.ts |
| `getSpecialistDetailsAction` | server_action | `L0_READ` | src/lib/agents/actions/domain-agent-actions.ts |
| `updateSpecialistConfigAction` | server_action | `L2_STATE_MUTATION` | src/lib/agents/actions/domain-agent-actions.ts |
| `startSwarmMissionAction` | server_action | `L2_STATE_MUTATION` | src/lib/agents/actions/domain-agent-actions.ts |
| `getSwarmRunAction` | server_action | `L0_READ` | src/lib/agents/actions/domain-agent-actions.ts |
| `listSwarmRunsAction` | server_action | `L0_READ` | src/lib/agents/actions/domain-agent-actions.ts |
| `resumeSwarmMissionAction` | server_action | `L2_STATE_MUTATION` | src/lib/agents/actions/domain-agent-actions.ts |
| `executeJointProposalAction` | server_action | `L2_STATE_MUTATION` | src/lib/agents/actions/domain-agent-actions.ts |
| `createAgreementAction` | server_action | `L2_STATE_MUTATION` | src/lib/agreement-actions.ts |
| `updateAgreementAction` | server_action | `L2_STATE_MUTATION` | src/lib/agreement-actions.ts |
| `executeRecurringBillingAction` | server_action | `L2_STATE_MUTATION` | src/lib/agreement-actions.ts |
| `getAgreementsByEntityAction` | server_action | `L0_READ` | src/lib/agreement-actions.ts |
| `getWorkspaceAiSettingsAction` | server_action | `L0_READ` | src/lib/ai/actions/workspace-ai-actions.ts |
| `updateWorkspaceAiSettingsAction` | server_action | `L2_STATE_MUTATION` | src/lib/ai/actions/workspace-ai-actions.ts |
| `createChangeSetAction` | server_action | `L2_STATE_MUTATION` | src/lib/ai-change-set-actions.ts |
| `updateChangeSetStatusAction` | server_action | `L2_STATE_MUTATION` | src/lib/ai-change-set-actions.ts |
| `fetchPageChangeSetsAction` | server_action | `L0_READ` | src/lib/ai-change-set-actions.ts |
| `recordPageViewAction` | server_action | `L2_STATE_MUTATION` | src/lib/analytics-actions.ts |
| `recordInteractionAction` | server_action | `L2_STATE_MUTATION` | src/lib/analytics-actions.ts |
| `recordConversion` | server_action | `L2_STATE_MUTATION` | src/lib/analytics-actions.ts |
| `generateApiKey` | server_action | `L1_INTERNAL_DRAFT` | src/lib/api-key-actions.ts |
| `listApiKeys` | server_action | `L0_READ` | src/lib/api-key-actions.ts |
| `revokeApiKey` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/api-key-actions.ts |
| `getPendingApprovalsAction` | server_action | `L0_READ` | src/lib/approval-actions.ts |
| `submitApprovalRequestAction` | server_action | `L2_STATE_MUTATION` | src/lib/approval-actions.ts |
| `decideApprovalRequestAction` | server_action | `L2_STATE_MUTATION` | src/lib/approval-actions.ts |
| `getApprovalPolicyAction` | server_action | `L0_READ` | src/lib/approval-actions.ts |
| `saveApprovalPolicyAction` | server_action | `L2_STATE_MUTATION` | src/lib/approval-actions.ts |
| `getDocumentAuditHistoryAction` | server_action | `L0_READ` | src/lib/audit-actions.ts |
| `getRecentFinancialAuditLogsAction` | server_action | `L0_READ` | src/lib/audit-actions.ts |
| `deleteAutomationAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/automation-actions.ts |
| `archiveAutomationAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/automation-actions.ts |
| `restoreAutomationAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `deleteAllArchivedAutomationsAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/automation-actions.ts |
| `toggleAutomationStatusAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `seedDefaultAutomationsAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `testAutomationFlowAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `testAutomationStepAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `pulseAutomationEngineAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `manuallyReleaseWaitJobAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `manuallyEndAutomationRunAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `restartRunAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `retryFailedStepAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `forceEndRunAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `forceAdvanceRunAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `pauseRunAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `resumeRunAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `getMessageNodeStatsAction` | server_action | `L0_READ` | src/lib/automation-actions.ts |
| `resendFailedMessagesAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/lib/automation-actions.ts |
| `getMessageNodeLogsAction` | server_action | `L0_READ` | src/lib/automation-actions.ts |
| `exportAutomationAction` | server_action | `L0_READ` | src/lib/automation-actions.ts |
| `verifySingleContactAction` | server_action | `L0_READ` | src/lib/automation-actions.ts |
| `enrollContactsInAutomationAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `healStrandedMessageContactsAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `manuallyReleaseAllWaitJobsAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `cancelAutomationRunAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `reconcilePendingSmsLogsAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `bulkRetryRunsAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `bulkForceAdvanceRunsAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `jumpRunToStepAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `rescheduleWaitJobAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `updateRunPayloadAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `cleanAndVerifyRunContactAction` | server_action | `L0_READ` | src/lib/automation-actions.ts |
| `createContactFollowupTaskAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `executeMessageStatusAutomationsAction` | server_action | `L2_STATE_MUTATION` | src/lib/automation-actions.ts |
| `handleAssignDealOwner` | server_action | `L2_STATE_MUTATION` | src/lib/automations/actions/deal-automation-actions.ts |
| `handleUpdateDealProbability` | server_action | `L2_STATE_MUTATION` | src/lib/automations/actions/deal-automation-actions.ts |
| `handleCreateDealTask` | server_action | `L2_STATE_MUTATION` | src/lib/automations/actions/deal-automation-actions.ts |
| `handleAddDealNote` | server_action | `L2_STATE_MUTATION` | src/lib/automations/actions/deal-automation-actions.ts |
| `handleFindContact` | server_action | `L0_READ` | src/lib/automations/actions/entity-actions.ts |
| `getGlobalAiKeys` | server_action | `L0_READ` | src/lib/backoffice/backoffice-ai-actions.ts |
| `getGlobalAiConfig` | server_action | `L0_READ` | src/lib/backoffice/backoffice-ai-actions.ts |
| `saveGlobalAiConfig` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-ai-actions.ts |
| `rotateAllSecretsAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/backoffice/backoffice-ai-actions.ts |
| `listApprovalRequests` | server_action | `L0_READ` | src/lib/backoffice/backoffice-approval-actions.ts |
| `cancelApprovalRequest` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-approval-actions.ts |
| `listAllAssets` | server_action | `L0_READ` | src/lib/backoffice/backoffice-asset-actions.ts |
| `saveAssetRecord` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-asset-actions.ts |
| `deleteAssetRecord` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/backoffice/backoffice-asset-actions.ts |
| `fetchAuditLogs` | server_action | `L0_READ` | src/lib/backoffice/backoffice-audit-actions.ts |
| `getFeatureDetail` | server_action | `L0_READ` | src/lib/backoffice/backoffice-feature-actions.ts |
| `updateFeatureRolloutRules` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-feature-actions.ts |
| `listFieldPacks` | server_action | `L0_READ` | src/lib/backoffice/backoffice-field-actions.ts |
| `getContactTypeDefaultsInternal` | server_action | `L0_READ` | src/lib/backoffice/backoffice-field-actions.ts |
| `getContactTypeDefaults` | server_action | `L0_READ` | src/lib/backoffice/backoffice-field-actions.ts |
| `saveContactTypeDefaults` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-field-actions.ts |
| `saveFieldPack` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-field-actions.ts |
| `listNativeFields` | server_action | `L0_READ` | src/lib/backoffice/backoffice-field-actions.ts |
| `saveNativeField` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-field-actions.ts |
| `listPlatformIndustryFieldGroupsInternal` | server_action | `L0_READ` | src/lib/backoffice/backoffice-field-actions.ts |
| `listPlatformIndustryFieldGroups` | server_action | `L0_READ` | src/lib/backoffice/backoffice-field-actions.ts |
| `savePlatformIndustryFieldGroup` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-field-actions.ts |
| `deletePlatformIndustryFieldGroup` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/backoffice/backoffice-field-actions.ts |
| `getFinancialOverviewAction` | server_action | `L0_READ` | src/lib/backoffice/backoffice-finance-actions.ts |
| `triggerDunningEscalationAction` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-finance-actions.ts |
| `runFormsFerAuditAction` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-forms-actions.ts |
| `seedIndustryFormTemplatesAction` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-forms-actions.ts |
| `getTenantHealthOverviewAction` | server_action | `L0_READ` | src/lib/backoffice/backoffice-health-actions.ts |
| `listTenantIssuesAction` | server_action | `L0_READ` | src/lib/backoffice/backoffice-health-actions.ts |
| `updateTenantIssueStatusAction` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-health-actions.ts |
| `addTenantIssueNoteAction` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-health-actions.ts |
| `createImpersonationSessionAction` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-health-actions.ts |
| `getIntegrationHealthOverviewAction` | server_action | `L0_READ` | src/lib/backoffice/backoffice-integration-actions.ts |
| `verifyIntegrationConnectionAction` | server_action | `L0_READ` | src/lib/backoffice/backoffice-integration-actions.ts |
| `manualReSyncBookingAction` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-integration-actions.ts |
| `listAllJobs` | server_action | `L0_READ` | src/lib/backoffice/backoffice-job-actions.ts |
| `createJob` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-job-actions.ts |
| `cancelJob` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-job-actions.ts |
| `triggerJobExecution` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-job-actions.ts |
| `runTenantDiagnostics` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-job-actions.ts |
| `clearAutomationData` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-job-actions.ts |
| `getMeetingsTelemetryAction` | server_action | `L0_READ` | src/lib/backoffice/backoffice-meetings-actions.ts |
| `resendMagicJoinLinkAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/lib/backoffice/backoffice-meetings-actions.ts |
| `getMessagingDeliveryMetricsAction` | server_action | `L0_READ` | src/lib/backoffice/backoffice-messaging-observatory-actions.ts |
| `listWebhookDeadLettersAction` | server_action | `L0_READ` | src/lib/backoffice/backoffice-messaging-observatory-actions.ts |
| `replayWebhookDeadLetterAction` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-messaging-observatory-actions.ts |
| `listSuppressionRecordsAction` | server_action | `L0_READ` | src/lib/backoffice/backoffice-messaging-observatory-actions.ts |
| `listAllOrganizations` | server_action | `L0_READ` | src/lib/backoffice/backoffice-org-actions.ts |
| `getOrganizationDetail` | server_action | `L0_READ` | src/lib/backoffice/backoffice-org-actions.ts |
| `restoreOrganization` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-org-actions.ts |
| `updateOrganizationFromBackoffice` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-org-actions.ts |
| `getOrganizationDiagnostics` | server_action | `L0_READ` | src/lib/backoffice/backoffice-org-actions.ts |
| `createOrganizationFromBackofficeAction` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-org-actions.ts |
| `shareOrgSetupInviteAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/lib/backoffice/backoffice-org-actions.ts |
| `toggleOrganizationActivityLogging` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-org-actions.ts |
| `clearOrganizationActivityLogs` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-org-actions.ts |
| `listProviderSettings` | server_action | `L0_READ` | src/lib/backoffice/backoffice-provider-actions.ts |
| `saveProviderSetting` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-provider-actions.ts |
| `getSurveyGovernanceOverviewAction` | server_action | `L0_READ` | src/lib/backoffice/backoffice-survey-actions.ts |
| `purgeSpamSubmissionAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/backoffice/backoffice-survey-actions.ts |
| `unflagSubmissionAction` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-survey-actions.ts |
| `seedRoleArchitectureTemplatesAction` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-template-actions.ts |
| `listAllTemplates` | server_action | `L0_READ` | src/lib/backoffice/backoffice-template-actions.ts |
| `getTemplateDetail` | server_action | `L0_READ` | src/lib/backoffice/backoffice-template-actions.ts |
| `publishTemplate` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/lib/backoffice/backoffice-template-actions.ts |
| `deprecateTemplate` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-template-actions.ts |
| `createTemplateAction` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-template-actions.ts |
| `updateTemplateAction` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-template-actions.ts |
| `deleteTemplateAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/backoffice/backoffice-template-actions.ts |
| `getPublishedTemplatesAction` | server_action | `L0_READ` | src/lib/backoffice/backoffice-template-actions.ts |
| `propagateTemplateAction` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-template-actions.ts |
| `listAllWorkspaces` | server_action | `L0_READ` | src/lib/backoffice/backoffice-workspace-actions.ts |
| `getWorkspaceDiagnostics` | server_action | `L0_READ` | src/lib/backoffice/backoffice-workspace-actions.ts |
| `archiveWorkspaceFromBackoffice` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/backoffice/backoffice-workspace-actions.ts |
| `restoreWorkspaceFromBackoffice` | server_action | `L2_STATE_MUTATION` | src/lib/backoffice/backoffice-workspace-actions.ts |
| `saveBanditPolicyAction` | server_action | `L2_STATE_MUTATION` | src/lib/bandit-actions.ts |
| `recordBanditRewardAction` | server_action | `L2_STATE_MUTATION` | src/lib/bandit-actions.ts |
| `fetchBanditPolicyAction` | server_action | `L0_READ` | src/lib/bandit-actions.ts |
| `getPublicInvoiceAction` | server_action | `L0_READ` | src/lib/billing-actions.ts |
| `getInvoicesByEntityAction` | server_action | `L0_READ` | src/lib/billing-actions.ts |
| `generateInvoiceAction` | server_action | `L1_INTERNAL_DRAFT` | src/lib/billing-actions.ts |
| `updateInvoiceAction` | server_action | `L2_STATE_MUTATION` | src/lib/billing-actions.ts |
| `voidInvoiceAction` | server_action | `L2_STATE_MUTATION` | src/lib/billing-actions.ts |
| `disputeInvoiceAction` | server_action | `L2_STATE_MUTATION` | src/lib/billing-actions.ts |
| `deleteInvoiceAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/billing-actions.ts |
| `ingestBatchAction` | server_action | `L2_STATE_MUTATION` | src/lib/bulk-upload-actions.ts |
| `processImportChunkBackground` | server_action | `L2_STATE_MUTATION` | src/lib/bulk-upload-actions.ts |
| `ingestSchoolRowAction` | server_action | `L2_STATE_MUTATION` | src/lib/bulk-upload-actions.ts |
| `getImportsLogsListAction` | server_action | `L0_READ` | src/lib/bulk-upload-actions.ts |
| `purgeExpiredFailedImportsAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/bulk-upload-actions.ts |
| `getFailedRowsAction` | server_action | `L0_READ` | src/lib/bulk-upload-actions.ts |
| `updateFailedRowAction` | server_action | `L2_STATE_MUTATION` | src/lib/bulk-upload-actions.ts |
| `resolveFailedRowAction` | server_action | `L1_INTERNAL_DRAFT` | src/lib/bulk-upload-actions.ts |
| `getDuplicateRowsAction` | server_action | `L0_READ` | src/lib/bulk-upload-actions.ts |
| `resolveDuplicatesAction` | server_action | `L1_INTERNAL_DRAFT` | src/lib/bulk-upload-actions.ts |
| `cancelBulkUploadAction` | server_action | `L2_STATE_MUTATION` | src/lib/bulk-upload-actions.ts |
| `resumeBulkUploadAction` | server_action | `L2_STATE_MUTATION` | src/lib/bulk-upload-actions.ts |
| `getActionMeta` | server_action | `L0_READ` | src/lib/call-action-types.ts |
| `deleteCallScriptAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/call-centre-actions.ts |
| `getCallScriptAction` | server_action | `L0_READ` | src/lib/call-centre-actions.ts |
| `listCallScriptsAction` | server_action | `L0_READ` | src/lib/call-centre-actions.ts |
| `updateCallCampaignAction` | server_action | `L2_STATE_MUTATION` | src/lib/call-centre-actions.ts |
| `getCallCampaignAction` | server_action | `L0_READ` | src/lib/call-centre-actions.ts |
| `listCallCampaignsAction` | server_action | `L0_READ` | src/lib/call-centre-actions.ts |
| `generateCampaignQueueAction` | server_action | `L1_INTERNAL_DRAFT` | src/lib/call-centre-actions.ts |
| `releaseQueueItemAction` | server_action | `L2_STATE_MUTATION` | src/lib/call-centre-actions.ts |
| `updateNotesDraftAction` | server_action | `L2_STATE_MUTATION` | src/lib/call-centre-actions.ts |
| `skipQueueItemAction` | server_action | `L2_STATE_MUTATION` | src/lib/call-centre-actions.ts |
| `deferQueueItemAction` | server_action | `L2_STATE_MUTATION` | src/lib/call-centre-actions.ts |
| `scheduleCallbackAction` | server_action | `L2_STATE_MUTATION` | src/lib/call-centre-actions.ts |
| `generateCallScriptAction` | server_action | `L1_INTERNAL_DRAFT` | src/lib/call-centre-actions.ts |
| `refineCallScriptAction` | server_action | `L1_INTERNAL_DRAFT` | src/lib/call-centre-actions.ts |
| `enqueueAndLockSingleCallAction` | server_action | `L2_STATE_MUTATION` | src/lib/call-centre-actions.ts |
| `releaseSingleCallAction` | server_action | `L2_STATE_MUTATION` | src/lib/call-centre-actions.ts |
| `createOrUpdateCollectionCaseAction` | server_action | `L2_STATE_MUTATION` | src/lib/collection-actions.ts |
| `updateCaseStageAction` | server_action | `L2_STATE_MUTATION` | src/lib/collection-actions.ts |
| `assignCaseAction` | server_action | `L2_STATE_MUTATION` | src/lib/collection-actions.ts |
| `recordPromiseToPayAction` | server_action | `L2_STATE_MUTATION` | src/lib/collection-actions.ts |
| `evaluatePromisesAction` | server_action | `L0_READ` | src/lib/collection-actions.ts |
| `createPaymentPlanAction` | server_action | `L2_STATE_MUTATION` | src/lib/collection-actions.ts |
| `logCollectionActivityAction` | server_action | `L2_STATE_MUTATION` | src/lib/collection-actions.ts |
| `getCollectionCaseDetailsAction` | server_action | `L0_READ` | src/lib/collection-actions.ts |
| `updateOutcome` | server_action | `L2_STATE_MUTATION` | src/lib/consultancy-actions.ts |
| `updateRetainer` | server_action | `L2_STATE_MUTATION` | src/lib/consultancy-actions.ts |
| `saveContactTypeOverrides` | server_action | `L2_STATE_MUTATION` | src/lib/contact-type-actions.ts |
| `upsertContractAction` | server_action | `L2_STATE_MUTATION` | src/lib/contract-actions.ts |
| `sendContractAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/lib/contract-actions.ts |
| `deleteContractAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/contract-actions.ts |
| `createCreditNoteAction` | server_action | `L2_STATE_MUTATION` | src/lib/credit-note-actions.ts |
| `getCreditNotesByAccountAction` | server_action | `L0_READ` | src/lib/credit-note-actions.ts |
| `recordCustomPageEvent` | server_action | `L2_STATE_MUTATION` | src/lib/custom-page-analytics-actions.ts |
| `getCustomPageAnalytics` | server_action | `L0_READ` | src/lib/custom-page-analytics-actions.ts |
| `listTrackedPages` | server_action | `L0_READ` | src/lib/custom-page-analytics-actions.ts |
| `assignCustomPageWorkspaceAction` | server_action | `L2_STATE_MUTATION` | src/lib/custom-page-analytics-actions.ts |
| `createDocumentAction` | server_action | `L2_STATE_MUTATION` | src/lib/document-actions.ts |
| `deleteDocumentAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/document-actions.ts |
| `verifyDocumentPasscodeAction` | server_action | `L0_READ` | src/lib/document-actions.ts |
| `submitDocumentLeadAction` | server_action | `L2_STATE_MUTATION` | src/lib/document-actions.ts |
| `recordObservabilityMetricAction` | server_action | `L2_STATE_MUTATION` | src/lib/documents/document-observability-actions.ts |
| `checkDocumentPermissionAction` | server_action | `L0_READ` | src/lib/documents/enterprise-security-actions.ts |
| `auditWorkspaceSecurityPostureAction` | server_action | `L0_READ` | src/lib/documents/enterprise-security-actions.ts |
| `retryFailedProcessingJobAction` | server_action | `L2_STATE_MUTATION` | src/lib/documents/processing-actions.ts |
| `convertToOnboardingAction` | server_action | `L2_STATE_MUTATION` | src/lib/entity-actions.ts |
| `saveAudienceAction` | server_action | `L2_STATE_MUTATION` | src/lib/experience-actions.ts |
| `fetchAudiencesAction` | server_action | `L0_READ` | src/lib/experience-actions.ts |
| `saveExperienceRuleAction` | server_action | `L2_STATE_MUTATION` | src/lib/experience-actions.ts |
| `fetchPageExperienceRulesAction` | server_action | `L0_READ` | src/lib/experience-actions.ts |
| `saveExperimentAction` | server_action | `L2_STATE_MUTATION` | src/lib/experiment-actions.ts |
| `fetchPageExperimentsAction` | server_action | `L0_READ` | src/lib/experiment-actions.ts |
| `promoteWinnerVariantAction` | server_action | `L2_STATE_MUTATION` | src/lib/experiment-actions.ts |
| `updateOrganizationFeaturesAction` | server_action | `L2_STATE_MUTATION` | src/lib/feature-actions.ts |
| `updateWorkspaceFeaturesAction` | server_action | `L2_STATE_MUTATION` | src/lib/feature-actions.ts |
| `createFieldGroupAction` | server_action | `L2_STATE_MUTATION` | src/lib/fields-actions.ts |
| `updateFieldGroupAction` | server_action | `L2_STATE_MUTATION` | src/lib/fields-actions.ts |
| `deleteFieldGroupAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/fields-actions.ts |
| `reorderFieldGroupsAction` | server_action | `L2_STATE_MUTATION` | src/lib/fields-actions.ts |
| `moveFieldToGroupAction` | server_action | `L2_STATE_MUTATION` | src/lib/fields-actions.ts |
| `createFieldAction` | server_action | `L2_STATE_MUTATION` | src/lib/fields-actions.ts |
| `updateFieldAction` | server_action | `L2_STATE_MUTATION` | src/lib/fields-actions.ts |
| `seedNativeFieldsAction` | server_action | `L2_STATE_MUTATION` | src/lib/fields-actions.ts |
| `getFieldGroupsForWorkspace` | server_action | `L0_READ` | src/lib/fields-actions.ts |
| `getFieldsForWorkspace` | server_action | `L0_READ` | src/lib/fields-actions.ts |
| `getWorkspaceVariablesAction` | server_action | `L0_READ` | src/lib/fields-actions.ts |
| `getOrCreateFinancialAccountAction` | server_action | `L0_READ` | src/lib/finance-actions.ts |
| `recordPaymentAction` | server_action | `L2_STATE_MUTATION` | src/lib/finance-actions.ts |
| `getAccountLedgerAction` | server_action | `L0_READ` | src/lib/finance-actions.ts |
| `getPaymentsForAccountAction` | server_action | `L0_READ` | src/lib/finance-actions.ts |
| `getInvoiceAllocationsAction` | server_action | `L0_READ` | src/lib/finance-actions.ts |
| `getUnpaidInvoicesForEntityAction` | server_action | `L0_READ` | src/lib/finance-actions.ts |
| `runReminderCycleAction` | server_action | `L2_STATE_MUTATION` | src/lib/finance-automation-actions.ts |
| `sendInvoiceReminderAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/lib/finance-automation-actions.ts |
| `getReminderLogsAction` | server_action | `L0_READ` | src/lib/finance-automation-actions.ts |
| `submitStandaloneFormAction` | server_action | `L2_STATE_MUTATION` | src/lib/form-actions.ts |
| `saveFormDraftAction` | server_action | `L2_STATE_MUTATION` | src/lib/forms/form-draft-actions.ts |
| `loadFormDraftAction` | server_action | `L0_READ` | src/lib/forms/form-draft-actions.ts |
| `sendTestFormNotificationAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/lib/forms/form-notification-actions.ts |
| `getFormExperimentsAction` | server_action | `L0_READ` | src/lib/forms/form-optimization-actions.ts |
| `initializeFormSessionAction` | server_action | `L2_STATE_MUTATION` | src/lib/forms/form-session-actions.ts |
| `recordFormEventAction` | server_action | `L2_STATE_MUTATION` | src/lib/forms/form-session-actions.ts |
| `createFormAction` | server_action | `L2_STATE_MUTATION` | src/lib/forms-actions.ts |
| `updateFormAction` | server_action | `L2_STATE_MUTATION` | src/lib/forms-actions.ts |
| `cloneFormAction` | server_action | `L2_STATE_MUTATION` | src/lib/forms-actions.ts |
| `toggleFormStatusAction` | server_action | `L2_STATE_MUTATION` | src/lib/forms-actions.ts |
| `getPublicFormDefinitionAction` | server_action | `L0_READ` | src/lib/forms-actions.ts |
| `getFormWithVersionAction` | server_action | `L0_READ` | src/lib/forms-version-actions.ts |
| `saveFormDraftVersionAction` | server_action | `L2_STATE_MUTATION` | src/lib/forms-version-actions.ts |
| `publishFormVersionAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/lib/forms-version-actions.ts |
| `recordAuditLogAction` | server_action | `L2_STATE_MUTATION` | src/lib/governance-actions.ts |
| `submitApprovalRequestAction` | server_action | `L2_STATE_MUTATION` | src/lib/governance-actions.ts |
| `reviewApprovalRequestAction` | server_action | `L2_STATE_MUTATION` | src/lib/governance-actions.ts |
| `fetchPageAuditLogsAction` | server_action | `L0_READ` | src/lib/governance-actions.ts |
| `exportEntitiesToCSVAction` | server_action | `L0_READ` | src/lib/import-export/entity-export-actions.ts |
| `validateImportBatch` | server_action | `L0_READ` | src/lib/import-export/entity-import-actions.ts |
| `executeImportBatch` | server_action | `L2_STATE_MUTATION` | src/lib/import-export/entity-import-actions.ts |
| `saveInsightAction` | server_action | `L2_STATE_MUTATION` | src/lib/insight-actions.ts |
| `fetchPageInsightsAction` | server_action | `L0_READ` | src/lib/insight-actions.ts |
| `dismissInsightAction` | server_action | `L2_STATE_MUTATION` | src/lib/insight-actions.ts |
| `getExecutiveIntelligenceAction` | server_action | `L0_READ` | src/lib/intelligence/actions/intelligence-actions.ts |
| `listRecommendationsAction` | server_action | `L0_READ` | src/lib/intelligence/actions/intelligence-actions.ts |
| `adjudicateRecommendationAction` | server_action | `L2_STATE_MUTATION` | src/lib/intelligence/actions/intelligence-actions.ts |
| `runObservationScanAction` | server_action | `L2_STATE_MUTATION` | src/lib/intelligence/actions/intelligence-actions.ts |
| `getSelfHealingHealthAction` | server_action | `L0_READ` | src/lib/intelligence/actions/intelligence-actions.ts |
| `executeSelfHealingAction` | server_action | `L2_STATE_MUTATION` | src/lib/intelligence/actions/intelligence-actions.ts |
| `generateComplianceExportAction` | server_action | `L1_INTERNAL_DRAFT` | src/lib/intelligence/actions/intelligence-actions.ts |
| `executeCryptographicDeletionAction` | server_action | `L2_STATE_MUTATION` | src/lib/intelligence/actions/intelligence-actions.ts |
| `getFederatedBenchmarksAction` | server_action | `L0_READ` | src/lib/intelligence/actions/intelligence-actions.ts |
| `processMeetingInvitations` | server_action | `L2_STATE_MUTATION` | src/lib/invitation-actions.ts |
| `createMatter` | server_action | `L2_STATE_MUTATION` | src/lib/law-actions.ts |
| `updateMatterStatus` | server_action | `L2_STATE_MUTATION` | src/lib/law-actions.ts |
| `getMattersForEntity` | server_action | `L0_READ` | src/lib/law-actions.ts |
| `createIntakeForm` | server_action | `L2_STATE_MUTATION` | src/lib/law-actions.ts |
| `getIntakeFormsForEntity` | server_action | `L0_READ` | src/lib/law-actions.ts |
| `createConflictCheck` | server_action | `L2_STATE_MUTATION` | src/lib/law-actions.ts |
| `updateConflictCheckStatus` | server_action | `L2_STATE_MUTATION` | src/lib/law-actions.ts |
| `getConflictChecksForEntity` | server_action | `L0_READ` | src/lib/law-actions.ts |
| `createConsultation` | server_action | `L2_STATE_MUTATION` | src/lib/law-actions.ts |
| `updateConsultation` | server_action | `L2_STATE_MUTATION` | src/lib/law-actions.ts |
| `getConsultationsForEntity` | server_action | `L0_READ` | src/lib/law-actions.ts |
| `createRelatedParty` | server_action | `L2_STATE_MUTATION` | src/lib/law-actions.ts |
| `getRelatedPartiesForMatter` | server_action | `L0_READ` | src/lib/law-actions.ts |
| `createLegalDocument` | server_action | `L2_STATE_MUTATION` | src/lib/law-actions.ts |
| `getLegalDocumentsForEntity` | server_action | `L0_READ` | src/lib/law-actions.ts |
| `getLegalDocumentsForMatter` | server_action | `L0_READ` | src/lib/law-actions.ts |
| `createTimeEntry` | server_action | `L2_STATE_MUTATION` | src/lib/law-actions.ts |
| `getTimeEntriesForMatter` | server_action | `L0_READ` | src/lib/law-actions.ts |
| `getTimeEntriesForEntity` | server_action | `L0_READ` | src/lib/law-actions.ts |
| `createCourtDate` | server_action | `L2_STATE_MUTATION` | src/lib/law-actions.ts |
| `updateCourtDate` | server_action | `L2_STATE_MUTATION` | src/lib/law-actions.ts |
| `getCourtDatesForMatter` | server_action | `L0_READ` | src/lib/law-actions.ts |
| `getUpcomingCourtDatesForEntity` | server_action | `L0_READ` | src/lib/law-actions.ts |
| `getLeadsForPageAction` | server_action | `L0_READ` | src/lib/lead-actions.ts |
| `processLeadCaptureAction` | server_action | `L2_STATE_MUTATION` | src/lib/lead-actions.ts |
| `createLearningSignalAction` | server_action | `L2_STATE_MUTATION` | src/lib/learning-loop-actions.ts |
| `finalizeLearningSignalAction` | server_action | `L2_STATE_MUTATION` | src/lib/learning-loop-actions.ts |
| `updateSignalRatingAction` | server_action | `L2_STATE_MUTATION` | src/lib/learning-loop-actions.ts |
| `deleteLearningSignalsBySurveyAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/learning-loop-actions.ts |
| `getGoldStandardExamples` | server_action | `L0_READ` | src/lib/learning-loop-actions.ts |
| `updateClientReport` | server_action | `L2_STATE_MUTATION` | src/lib/marketing-actions.ts |
| `updateStrategyDoc` | server_action | `L2_STATE_MUTATION` | src/lib/marketing-actions.ts |
| `listMcpToolsAction` | server_action | `L0_READ` | src/lib/mcp/actions/mcp-governance-actions.ts |
| `executeMcpToolAction` | server_action | `L2_STATE_MUTATION` | src/lib/mcp/actions/mcp-governance-actions.ts |
| `listPendingApprovalsAction` | server_action | `L0_READ` | src/lib/mcp/actions/mcp-governance-actions.ts |
| `adjudicateApprovalAction` | server_action | `L2_STATE_MUTATION` | src/lib/mcp/actions/mcp-governance-actions.ts |
| `listMcpApiKeysAction` | server_action | `L0_READ` | src/lib/mcp/actions/mcp-governance-actions.ts |
| `createMcpApiKeyAction` | server_action | `L2_STATE_MUTATION` | src/lib/mcp/actions/mcp-governance-actions.ts |
| `revokeMcpApiKeyAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/mcp/actions/mcp-governance-actions.ts |
| `listMcpAuditLogsAction` | server_action | `L0_READ` | src/lib/mcp/actions/mcp-governance-actions.ts |
| `upsertMcpApprovalPolicyAction` | server_action | `L2_STATE_MUTATION` | src/lib/mcp/actions/mcp-governance-actions.ts |
| `updateMediaName` | server_action | `L2_STATE_MUTATION` | src/lib/media-actions.ts |
| `deleteMediaAsset` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/media-actions.ts |
| `saveImageToMediaLibrary` | server_action | `L2_STATE_MUTATION` | src/lib/media-actions.ts |
| `listMediaSharesWithStatsAction` | server_action | `L0_READ` | src/lib/media-analytics-actions.ts |
| `getMediaShareDrilldownAction` | server_action | `L0_READ` | src/lib/media-analytics-actions.ts |
| `checkSlugAvailabilityAction` | server_action | `L0_READ` | src/lib/media-analytics-actions.ts |
| `recordExperimentEventServerAction` | server_action | `L2_STATE_MUTATION` | src/lib/media-analytics-actions.ts |
| `bulkApplyTagsToMediaContactsAction` | server_action | `L2_STATE_MUTATION` | src/lib/media-analytics-entity-actions.ts |
| `bulkMoveMediaContactsStageAction` | server_action | `L2_STATE_MUTATION` | src/lib/media-analytics-entity-actions.ts |
| `transferMediaAutomationsAction` | server_action | `L2_STATE_MUTATION` | src/lib/media-automation-actions.ts |
| `getCompanyBrainHealthAction` | server_action | `L0_READ` | src/lib/memory/actions/backoffice-companybrain-actions.ts |
| `triggerCompanyBrainReindexAction` | server_action | `L2_STATE_MUTATION` | src/lib/memory/actions/backoffice-companybrain-actions.ts |
| `clearEmbeddingCacheAction` | server_action | `L2_STATE_MUTATION` | src/lib/memory/actions/backoffice-companybrain-actions.ts |
| `buildContextAction` | server_action | `L2_STATE_MUTATION` | src/lib/memory/actions/context-builder-actions.ts |
| `getEntityDossierAction` | server_action | `L0_READ` | src/lib/memory/actions/context-builder-actions.ts |
| `getDealDossierAction` | server_action | `L0_READ` | src/lib/memory/actions/context-builder-actions.ts |
| `synthesizeContextDossierWithAIAction` | server_action | `L1_INTERNAL_DRAFT` | src/lib/memory/actions/context-builder-actions.ts |
| `getWorkspaceGraphAction` | server_action | `L0_READ` | src/lib/memory/actions/graph-actions.ts |
| `getEntitySubGraphAction` | server_action | `L0_READ` | src/lib/memory/actions/graph-actions.ts |
| `findGraphPathAction` | server_action | `L0_READ` | src/lib/memory/actions/graph-actions.ts |
| `explainGraphConnectionAction` | server_action | `L0_READ` | src/lib/memory/actions/graph-actions.ts |
| `createGraphEdgeAction` | server_action | `L2_STATE_MUTATION` | src/lib/memory/actions/graph-actions.ts |
| `deleteGraphEdgeAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/memory/actions/graph-actions.ts |
| `getGraphTopologyMetricsAction` | server_action | `L0_READ` | src/lib/memory/actions/graph-actions.ts |
| `syncWorkspaceGraphMeshAction` | server_action | `L2_STATE_MUTATION` | src/lib/memory/actions/graph-actions.ts |
| `extractMemoriesFromNoteAction` | server_action | `L0_READ` | src/lib/memory/actions/memory-actions.ts |
| `confirmMemoryAction` | server_action | `L2_STATE_MUTATION` | src/lib/memory/actions/memory-actions.ts |
| `invalidateMemoryAction` | server_action | `L2_STATE_MUTATION` | src/lib/memory/actions/memory-actions.ts |
| `updateMemoryAction` | server_action | `L2_STATE_MUTATION` | src/lib/memory/actions/memory-actions.ts |
| `listWorkspaceMemoriesAction` | server_action | `L0_READ` | src/lib/memory/actions/memory-actions.ts |
| `getNoteMemoriesAction` | server_action | `L0_READ` | src/lib/memory/actions/memory-actions.ts |
| `getMemoryHealthStatsAction` | server_action | `L0_READ` | src/lib/memory/actions/memory-actions.ts |
| `getMemoryHealthAction` | server_action | `L0_READ` | src/lib/memory/actions/orchestrator-actions.ts |
| `listMemoryConflictsAction` | server_action | `L0_READ` | src/lib/memory/actions/orchestrator-actions.ts |
| `resolveMemoryConflictAction` | server_action | `L1_INTERNAL_DRAFT` | src/lib/memory/actions/orchestrator-actions.ts |
| `scanMemoryConflictsBatchAction` | server_action | `L0_READ` | src/lib/memory/actions/orchestrator-actions.ts |
| `listStaleMemoriesAction` | server_action | `L0_READ` | src/lib/memory/actions/orchestrator-actions.ts |
| `reconfirmMemoryFreshnessAction` | server_action | `L2_STATE_MUTATION` | src/lib/memory/actions/orchestrator-actions.ts |
| `findConsolidationCandidatesAction` | server_action | `L0_READ` | src/lib/memory/actions/orchestrator-actions.ts |
| `applyConsolidationAction` | server_action | `L2_STATE_MUTATION` | src/lib/memory/actions/orchestrator-actions.ts |
| `unifiedRecallAction` | server_action | `L2_STATE_MUTATION` | src/lib/memory/actions/orchestrator-actions.ts |
| `semanticSearchMemoriesAction` | server_action | `L0_READ` | src/lib/memory/actions/semantic-search-actions.ts |
| `getRelatedMemoriesAction` | server_action | `L0_READ` | src/lib/memory/actions/semantic-search-actions.ts |
| `reindexMemoryAction` | server_action | `L2_STATE_MUTATION` | src/lib/memory/actions/semantic-search-actions.ts |
| `reindexWorkspaceMemoriesAction` | server_action | `L2_STATE_MUTATION` | src/lib/memory/actions/semantic-search-actions.ts |
| `syncVariableRegistry` | server_action | `L2_STATE_MUTATION` | src/lib/messaging-actions.ts |
| `syncAllLogStatuses` | server_action | `L2_STATE_MUTATION` | src/lib/messaging-actions.ts |
| `upsertConstantVariable` | server_action | `L2_STATE_MUTATION` | src/lib/messaging-actions.ts |
| `updateVariableVisibility` | server_action | `L2_STATE_MUTATION` | src/lib/messaging-actions.ts |
| `deleteVariable` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/messaging-actions.ts |
| `fetchContextualData` | server_action | `L0_READ` | src/lib/messaging-actions.ts |
| `clearVariablesForSource` | server_action | `L2_STATE_MUTATION` | src/lib/messaging-actions.ts |
| `updateEntityLastContactedAt` | server_action | `L2_STATE_MUTATION` | src/lib/messaging-actions.ts |
| `getMigrationParityStatusAction` | server_action | `L0_READ` | src/lib/migration-actions.ts |
| `executeFinanceMigrationAction` | server_action | `L2_STATE_MUTATION` | src/lib/migration-actions.ts |
| `recalibrateSummaryAction` | server_action | `L2_STATE_MUTATION` | src/lib/migration-actions.ts |
| `fetchSmsBalanceAction` | server_action | `L0_READ` | src/lib/mnotify-actions.ts |
| `checkSenderIdStatusAction` | server_action | `L0_READ` | src/lib/mnotify-actions.ts |
| `registerSenderIdAction` | server_action | `L2_STATE_MUTATION` | src/lib/mnotify-actions.ts |
| `fetchScheduledMessagesAction` | server_action | `L0_READ` | src/lib/mnotify-actions.ts |
| `updateScheduledMessageAction` | server_action | `L2_STATE_MUTATION` | src/lib/mnotify-actions.ts |
| `deleteScheduledMessageAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/mnotify-actions.ts |
| `fetchSmsReportsAction` | server_action | `L0_READ` | src/lib/mnotify-actions.ts |
| `logNoteActivity` | server_action | `L2_STATE_MUTATION` | src/lib/note-actions.ts |
| `getEntityAiSummary` | server_action | `L0_READ` | src/lib/note-actions.ts |
| `sendReceiptAcknowledgementAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/lib/notification-actions.ts |
| `fetchPlatformObservabilityAction` | server_action | `L0_READ` | src/lib/observability-actions.ts |
| `purgeEdgeCacheAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/observability-actions.ts |
| `saveCampaignOrchestrationAction` | server_action | `L2_STATE_MUTATION` | src/lib/orchestration-actions.ts |
| `triggerCrossChannelSyncAction` | server_action | `L2_STATE_MUTATION` | src/lib/orchestration-actions.ts |
| `fetchCampaignOrchestrationsAction` | server_action | `L0_READ` | src/lib/orchestration-actions.ts |
| `saveOrganizationAction` | server_action | `L2_STATE_MUTATION` | src/lib/organization-actions.ts |
| `deleteOrganizationAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/organization-actions.ts |
| `archiveOrganizationAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/organization-actions.ts |
| `setOrganizationDefaultWorkspaceAction` | server_action | `L2_STATE_MUTATION` | src/lib/organization-actions.ts |
| `duplicatePageAction` | server_action | `L2_STATE_MUTATION` | src/lib/page-actions.ts |
| `updatePageStatusAction` | server_action | `L2_STATE_MUTATION` | src/lib/page-actions.ts |
| `deletePageAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/page-actions.ts |
| `registerCustomCodedPage` | server_action | `L2_STATE_MUTATION` | src/lib/page-registry-actions.ts |
| `seedKnownCustomPages` | server_action | `L2_STATE_MUTATION` | src/lib/page-registry-actions.ts |
| `generatePdfBuffer` | server_action | `L1_INTERNAL_DRAFT` | src/lib/pdf-actions.ts |
| `saveAgreementProgressAction` | server_action | `L2_STATE_MUTATION` | src/lib/pdf-actions.ts |
| `finalizeAgreementAction` | server_action | `L2_STATE_MUTATION` | src/lib/pdf-actions.ts |
| `createPdfForm` | server_action | `L2_STATE_MUTATION` | src/lib/pdf-actions.ts |
| `clonePdfForm` | server_action | `L2_STATE_MUTATION` | src/lib/pdf-actions.ts |
| `savePdfForm` | server_action | `L2_STATE_MUTATION` | src/lib/pdf-actions.ts |
| `updatePdfFormStatus` | server_action | `L2_STATE_MUTATION` | src/lib/pdf-actions.ts |
| `deletePdfForm` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/pdf-actions.ts |
| `deleteSubmissions` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/pdf-actions.ts |
| `purgeContractAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/pdf-actions.ts |
| `updatePdfResultsSharing` | server_action | `L2_STATE_MUTATION` | src/lib/pdf-actions.ts |
| `updatePdfFormMapping` | server_action | `L2_STATE_MUTATION` | src/lib/pdf-actions.ts |
| `savePerspectiveAction` | server_action | `L2_STATE_MUTATION` | src/lib/perspective-actions.ts |
| `deletePerspectiveAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/perspective-actions.ts |
| `archivePerspectiveAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/perspective-actions.ts |
| `savePipelineAction` | server_action | `L2_STATE_MUTATION` | src/lib/pipeline-actions.ts |
| `setPipelineAsDefaultAction` | server_action | `L2_STATE_MUTATION` | src/lib/pipeline-actions.ts |
| `clonePipelineAction` | server_action | `L2_STATE_MUTATION` | src/lib/pipeline-actions.ts |
| `updateProductAction` | server_action | `L2_STATE_MUTATION` | src/lib/product-actions.ts |
| `createPricingPlanAction` | server_action | `L2_STATE_MUTATION` | src/lib/product-actions.ts |
| `updateProfile` | server_action | `L2_STATE_MUTATION` | src/lib/profile-actions.ts |
| `updateEntityIdentity` | server_action | `L2_STATE_MUTATION` | src/lib/profile-actions.ts |
| `updateWorkspaceEntityOperations` | server_action | `L2_STATE_MUTATION` | src/lib/profile-actions.ts |
| `createQRCode` | server_action | `L2_STATE_MUTATION` | src/lib/qr-actions.ts |
| `batchCreateQRCodes` | server_action | `L2_STATE_MUTATION` | src/lib/qr-actions.ts |
| `generateQRsForAudienceAction` | server_action | `L1_INTERNAL_DRAFT` | src/lib/qr-actions.ts |
| `bulkTagQRCodesAction` | server_action | `L2_STATE_MUTATION` | src/lib/qr-actions.ts |
| `getQRCode` | server_action | `L0_READ` | src/lib/qr-actions.ts |
| `getQRCodeByUrl` | server_action | `L0_READ` | src/lib/qr-actions.ts |
| `listQRCodes` | server_action | `L0_READ` | src/lib/qr-actions.ts |
| `updateQRCode` | server_action | `L2_STATE_MUTATION` | src/lib/qr-actions.ts |
| `updateQRDesign` | server_action | `L2_STATE_MUTATION` | src/lib/qr-actions.ts |
| `updateQRDestination` | server_action | `L2_STATE_MUTATION` | src/lib/qr-actions.ts |
| `updateQRLifecycle` | server_action | `L2_STATE_MUTATION` | src/lib/qr-actions.ts |
| `updateQRSecurity` | server_action | `L2_STATE_MUTATION` | src/lib/qr-actions.ts |
| `scheduleQRCode` | server_action | `L2_STATE_MUTATION` | src/lib/qr-actions.ts |
| `expireQRCode` | server_action | `L2_STATE_MUTATION` | src/lib/qr-actions.ts |
| `pauseQRCode` | server_action | `L2_STATE_MUTATION` | src/lib/qr-actions.ts |
| `resumeQRCode` | server_action | `L2_STATE_MUTATION` | src/lib/qr-actions.ts |
| `archiveQRCode` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/qr-actions.ts |
| `updateQRShortPath` | server_action | `L2_STATE_MUTATION` | src/lib/qr-actions.ts |
| `bulkQRAction` | server_action | `L2_STATE_MUTATION` | src/lib/qr-actions.ts |
| `duplicateQRCode` | server_action | `L2_STATE_MUTATION` | src/lib/qr-actions.ts |
| `deleteQRCode` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/qr-actions.ts |
| `saveQRTemplate` | server_action | `L2_STATE_MUTATION` | src/lib/qr-actions.ts |
| `updateQRTemplate` | server_action | `L2_STATE_MUTATION` | src/lib/qr-actions.ts |
| `listQRTemplates` | server_action | `L0_READ` | src/lib/qr-actions.ts |
| `deleteQRTemplate` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/qr-actions.ts |
| `getQRCodeByShortPath` | server_action | `L0_READ` | src/lib/qr-actions.ts |
| `getQRStudioStats` | server_action | `L0_READ` | src/lib/qr-actions.ts |
| `createQRCampaign` | server_action | `L2_STATE_MUTATION` | src/lib/qr-campaign-actions.ts |
| `updateQRCampaign` | server_action | `L2_STATE_MUTATION` | src/lib/qr-campaign-actions.ts |
| `deleteQRCampaign` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/qr-campaign-actions.ts |
| `addQRCodesToCampaign` | server_action | `L2_STATE_MUTATION` | src/lib/qr-campaign-actions.ts |
| `removeQRCodeFromCampaign` | server_action | `L2_STATE_MUTATION` | src/lib/qr-campaign-actions.ts |
| `getQRCampaigns` | server_action | `L0_READ` | src/lib/qr-campaign-actions.ts |
| `getCampaignAnalytics` | server_action | `L0_READ` | src/lib/qr-campaign-actions.ts |
| `addCustomDomain` | server_action | `L2_STATE_MUTATION` | src/lib/qr-domain-security-actions.ts |
| `verifyCustomDomain` | server_action | `L0_READ` | src/lib/qr-domain-security-actions.ts |
| `setDefaultCustomDomain` | server_action | `L2_STATE_MUTATION` | src/lib/qr-domain-security-actions.ts |
| `deleteCustomDomain` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/qr-domain-security-actions.ts |
| `getCustomDomains` | server_action | `L0_READ` | src/lib/qr-domain-security-actions.ts |
| `recordScanEvent` | server_action | `L2_STATE_MUTATION` | src/lib/qr-scan-actions.ts |
| `getQRAnalytics` | server_action | `L0_READ` | src/lib/qr-scan-actions.ts |
| `logQuickNoteActivity` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-actions.ts |
| `enrichNoteLink` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-actions.ts |
| `logQuickNoteCreated` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-actions.ts |
| `createQuickNoteAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-actions.ts |
| `classifyDraftKnowledgeAction` | server_action | `L0_READ` | src/lib/quick-notes-ai-actions.ts |
| `aiAssistEditorAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-ai-actions.ts |
| `resolveNoteEntitiesAction` | server_action | `L1_INTERNAL_DRAFT` | src/lib/quick-notes-ai-actions.ts |
| `summarizeEntityTimelineAction` | server_action | `L0_READ` | src/lib/quick-notes-ai-actions.ts |
| `getWorkspaceCampaignConceptsAction` | server_action | `L0_READ` | src/lib/quick-notes-campaign-actions.ts |
| `generateCampaignConceptAction` | server_action | `L1_INTERNAL_DRAFT` | src/lib/quick-notes-campaign-actions.ts |
| `deployConceptToCampaignStudioAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-campaign-actions.ts |
| `updateCampaignConceptStatusAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-campaign-actions.ts |
| `deleteCampaignConceptAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/quick-notes-campaign-actions.ts |
| `synthesizeCampaignLearningsAction` | server_action | `L1_INTERNAL_DRAFT` | src/lib/quick-notes-campaign-actions.ts |
| `getWorkspaceBattlecardsAction` | server_action | `L0_READ` | src/lib/quick-notes-campaign-actions.ts |
| `generateWorkspaceBattlecardsAction` | server_action | `L1_INTERNAL_DRAFT` | src/lib/quick-notes-campaign-actions.ts |
| `createFederatedSpaceAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-federation-actions.ts |
| `updateFederatedSpaceAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-federation-actions.ts |
| `deleteFederatedSpaceAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/quick-notes-federation-actions.ts |
| `subscribeToFederatedSpaceAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-federation-actions.ts |
| `unsubscribeFromFederatedSpaceAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-federation-actions.ts |
| `publishCollectionToSpaceAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/lib/quick-notes-federation-actions.ts |
| `getWorkspaceFederatedSpacesAction` | server_action | `L0_READ` | src/lib/quick-notes-federation-actions.ts |
| `exportWorkspaceKnowledgeAction` | server_action | `L0_READ` | src/lib/quick-notes-federation-actions.ts |
| `importKnowledgeArchiveAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/quick-notes-federation-actions.ts |
| `getFederatedKnowledgeFeedAction` | server_action | `L0_READ` | src/lib/quick-notes-federation-actions.ts |
| `generateIngestionWebhookKeyAction` | server_action | `L1_INTERNAL_DRAFT` | src/lib/quick-notes-federation-actions.ts |
| `cloneFederatedItemToWorkspaceAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-federation-actions.ts |
| `fetchAggregatedNotes` | server_action | `L0_READ` | src/lib/quick-notes-feed-actions.ts |
| `getWorkspaceKnowledgeGraphAction` | server_action | `L0_READ` | src/lib/quick-notes-graph-actions.ts |
| `createKnowledgeRelationAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-graph-actions.ts |
| `deleteKnowledgeRelationAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/quick-notes-graph-actions.ts |
| `suggestKnowledgeLinksAction` | server_action | `L1_INTERNAL_DRAFT` | src/lib/quick-notes-graph-actions.ts |
| `getBacklinksAction` | server_action | `L0_READ` | src/lib/quick-notes-graph-actions.ts |
| `backfillCrmRelationsAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-graph-actions.ts |
| `getWorkspaceIdeasAction` | server_action | `L0_READ` | src/lib/quick-notes-idea-actions.ts |
| `createIdeaAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-idea-actions.ts |
| `updateIdeaAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-idea-actions.ts |
| `deleteIdeaAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/quick-notes-idea-actions.ts |
| `transitionIdeaStageAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-idea-actions.ts |
| `developRawIdeaAiAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-idea-actions.ts |
| `challengeIdeaAssumptionsAiAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-idea-actions.ts |
| `decomposeIdeaCanvasAiAction` | server_action | `L1_INTERNAL_DRAFT` | src/lib/quick-notes-idea-actions.ts |
| `saveIdeaCanvasLayoutAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-idea-actions.ts |
| `convertIdeaToTaskAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-idea-actions.ts |
| `getWorkspaceInboxAction` | server_action | `L0_READ` | src/lib/quick-notes-insight-actions.ts |
| `reviewInboxItemAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-insight-actions.ts |
| `bulkReviewInboxAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-insight-actions.ts |
| `scanDuplicatesAction` | server_action | `L0_READ` | src/lib/quick-notes-insight-actions.ts |
| `detectWorkspaceContradictionsAction` | server_action | `L0_READ` | src/lib/quick-notes-insight-actions.ts |
| `generateWorkspaceInsightsAction` | server_action | `L1_INTERNAL_DRAFT` | src/lib/quick-notes-insight-actions.ts |
| `mergeDuplicateNotesAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-insight-actions.ts |
| `convertInsightToIdeaAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-insight-actions.ts |
| `convertInsightToTaskAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-insight-actions.ts |
| `getWorkspaceInsightsAction` | server_action | `L0_READ` | src/lib/quick-notes-insight-actions.ts |
| `deleteInsightAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/quick-notes-insight-actions.ts |
| `auditNoteGovernanceAction` | server_action | `L0_READ` | src/lib/quick-notes-insight-actions.ts |
| `commitOfflineBatchAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-offline-actions.ts |
| `getLatestServerSnapshotsAction` | server_action | `L0_READ` | src/lib/quick-notes-offline-actions.ts |
| `reindexWorkspaceKnowledgeAction` | server_action | `L2_STATE_MUTATION` | src/lib/quick-notes-search-actions.ts |
| `updatePropertyPreference` | server_action | `L2_STATE_MUTATION` | src/lib/real-estate-actions.ts |
| `getPropertyPreferencesForEntity` | server_action | `L0_READ` | src/lib/real-estate-actions.ts |
| `updateViewingStatus` | server_action | `L2_STATE_MUTATION` | src/lib/real-estate-actions.ts |
| `updateOfferStatus` | server_action | `L2_STATE_MUTATION` | src/lib/real-estate-actions.ts |
| `updateNegotiation` | server_action | `L2_STATE_MUTATION` | src/lib/real-estate-actions.ts |
| `updateDeal` | server_action | `L2_STATE_MUTATION` | src/lib/real-estate-actions.ts |
| `updatePropertyDocument` | server_action | `L2_STATE_MUTATION` | src/lib/real-estate-actions.ts |
| `getWorkspaceAgingSummaryAction` | server_action | `L0_READ` | src/lib/receivables-actions.ts |
| `getAccountAgingProfileAction` | server_action | `L0_READ` | src/lib/receivables-actions.ts |
| `getCustomerStatementAction` | server_action | `L0_READ` | src/lib/receivables-actions.ts |
| `getPublicStatementAction` | server_action | `L0_READ` | src/lib/receivables-actions.ts |
| `getReconciliationReportAction` | server_action | `L0_READ` | src/lib/reconciliation-actions.ts |
| `resolveReconciliationDiscrepancyAction` | server_action | `L1_INTERNAL_DRAFT` | src/lib/reconciliation-actions.ts |
| `scheduleFormReminders` | server_action | `L2_STATE_MUTATION` | src/lib/reminder-actions.ts |
| `scheduleMessagingConfigReminders` | server_action | `L2_STATE_MUTATION` | src/lib/reminder-actions.ts |
| `scheduleRegistrationAck` | server_action | `L2_STATE_MUTATION` | src/lib/reminder-actions.ts |
| `scheduleFacilitatorAlerts` | server_action | `L2_STATE_MUTATION` | src/lib/reminder-actions.ts |
| `sendFacilitatorNewRegistrationAlert` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/lib/reminder-actions.ts |
| `schedulePostEventMessages` | server_action | `L2_STATE_MUTATION` | src/lib/reminder-actions.ts |
| `processScheduledCampaigns` | server_action | `L2_STATE_MUTATION` | src/lib/reminder-actions.ts |
| `getExecutiveFinanceMetricsAction` | server_action | `L0_READ` | src/lib/reporting-actions.ts |
| `getCashflowTrendAction` | server_action | `L0_READ` | src/lib/reporting-actions.ts |
| `getCollectorLeaderboardAction` | server_action | `L0_READ` | src/lib/reporting-actions.ts |
| `getRevenueReportAction` | server_action | `L0_READ` | src/lib/reporting-actions.ts |
| `getAgingReportAction` | server_action | `L0_READ` | src/lib/reporting-actions.ts |
| `getTaxAuditReportAction` | server_action | `L0_READ` | src/lib/reporting-actions.ts |
| `getReportAggregates` | server_action | `L0_READ` | src/lib/reports/report-actions.ts |
| `fetchVerifiedDomainsAction` | server_action | `L0_READ` | src/lib/resend-actions.ts |
| `cancelScheduledEmailAction` | server_action | `L2_STATE_MUTATION` | src/lib/resend-actions.ts |
| `updateSubscription` | server_action | `L2_STATE_MUTATION` | src/lib/saas-actions.ts |
| `saveSectionAction` | server_action | `L2_STATE_MUTATION` | src/lib/section-actions.ts |
| `getSectionTemplatesAction` | server_action | `L0_READ` | src/lib/section-actions.ts |
| `AiActionProposalService` | server_action | `L2_STATE_MUTATION` | src/lib/services/ai-admin/ai-action-proposal-service.ts |
| `handleSignupAction` | server_action | `L2_STATE_MUTATION` | src/lib/signup-actions.ts |
| `startSupervisorMissionAction` | server_action | `L2_STATE_MUTATION` | src/lib/supervisor/actions/supervisor-actions.ts |
| `resumeSupervisorMissionAction` | server_action | `L2_STATE_MUTATION` | src/lib/supervisor/actions/supervisor-actions.ts |
| `cancelSupervisorMissionAction` | server_action | `L2_STATE_MUTATION` | src/lib/supervisor/actions/supervisor-actions.ts |
| `getSupervisorRunAction` | server_action | `L0_READ` | src/lib/supervisor/actions/supervisor-actions.ts |
| `listSupervisorRunsAction` | server_action | `L0_READ` | src/lib/supervisor/actions/supervisor-actions.ts |
| `executeProposedActionAction` | server_action | `L2_STATE_MUTATION` | src/lib/supervisor/actions/supervisor-actions.ts |
| `listAgentDescriptorsAction` | server_action | `L0_READ` | src/lib/supervisor/actions/supervisor-actions.ts |
| `cloneSurvey` | server_action | `L2_STATE_MUTATION` | src/lib/survey-actions.ts |
| `deleteSurveyAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/survey-actions.ts |
| `updateSurveyStatusAction` | server_action | `L2_STATE_MUTATION` | src/lib/survey-actions.ts |
| `deleteSurveyResponses` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/survey-actions.ts |
| `submitPublicSurveyResponse` | server_action | `L2_STATE_MUTATION` | src/lib/survey-actions.ts |
| `triggerSurveyWebhook` | server_action | `L2_STATE_MUTATION` | src/lib/survey-actions.ts |
| `autoSaveSurveyAction` | server_action | `L2_STATE_MUTATION` | src/lib/survey-actions.ts |
| `submitPublicSurveyLead` | server_action | `L2_STATE_MUTATION` | src/lib/survey-actions.ts |
| `finalizeSurveySubmission` | server_action | `L2_STATE_MUTATION` | src/lib/survey-actions.ts |
| `executeSurveyPipelineAndAutomations` | server_action | `L2_STATE_MUTATION` | src/lib/survey-actions.ts |
| `executeSurveyResultButtonActions` | server_action | `L2_STATE_MUTATION` | src/lib/survey-actions.ts |
| `getWorkspaceEntitiesForSimulationAction` | server_action | `L0_READ` | src/lib/survey-actions.ts |
| `logSurveyStartedAction` | server_action | `L2_STATE_MUTATION` | src/lib/survey-actions.ts |
| `addOrMoveEntityInPipeline` | server_action | `L2_STATE_MUTATION` | src/lib/survey-actions.ts |
| `getSurveyCrossTabsAction` | server_action | `L0_READ` | src/lib/surveys/survey-analytics-actions.ts |
| `getSurveyResponsesListAction` | server_action | `L0_READ` | src/lib/surveys/survey-analytics-actions.ts |
| `dispatchSurveyDistributionCampaignAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/lib/surveys/survey-campaign-actions.ts |
| `getSystemDispatchGovernanceAction` | server_action | `L0_READ` | src/lib/surveys/survey-campaign-actions.ts |
| `saveSystemDispatchGovernanceAction` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/lib/surveys/survey-campaign-actions.ts |
| `getSystemCrmFieldMappingTemplatesAction` | server_action | `L0_READ` | src/lib/surveys/survey-crm-sync-actions.ts |
| `saveSystemCrmFieldMappingTemplatesAction` | server_action | `L2_STATE_MUTATION` | src/lib/surveys/survey-crm-sync-actions.ts |
| `getWorkspacePredictiveOverviewAction` | server_action | `L0_READ` | src/lib/surveys/survey-predictive-actions.ts |
| `getSurveyProjectByIdAction` | server_action | `L0_READ` | src/lib/surveys/survey-project-actions.ts |
| `assignSurveysToProjectAction` | server_action | `L2_STATE_MUTATION` | src/lib/surveys/survey-project-actions.ts |
| `getProjectAnalyticsSummaryAction` | server_action | `L0_READ` | src/lib/surveys/survey-project-actions.ts |
| `executeTagAction` | server_action | `L2_STATE_MUTATION` | src/lib/tag-action-executor.ts |
| `getTagAction` | server_action | `L0_READ` | src/lib/tag-actions.ts |
| `bulkDeleteUnusedTagsAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/tag-actions.ts |
| `getTagAuditLogsAction` | server_action | `L0_READ` | src/lib/tag-actions.ts |
| `getTaskInterlinkUrl` | server_action | `L0_READ` | src/lib/task-actions.ts |
| `createTaskNonBlocking` | server_action | `L2_STATE_MUTATION` | src/lib/task-actions.ts |
| `updateTaskNonBlocking` | server_action | `L2_STATE_MUTATION` | src/lib/task-actions.ts |
| `completeTaskNonBlocking` | server_action | `L2_STATE_MUTATION` | src/lib/task-actions.ts |
| `bulkUpdateTasks` | server_action | `L2_STATE_MUTATION` | src/lib/task-actions.ts |
| `bulkDeleteTasks` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/task-actions.ts |
| `bulkCompleteTasks` | server_action | `L2_STATE_MUTATION` | src/lib/task-actions.ts |
| `deleteTaskNonBlocking` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/task-actions.ts |
| `createTaskFromAutomation` | server_action | `L2_STATE_MUTATION` | src/lib/task-server-actions.ts |
| `deleteTaskAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/task-server-actions.ts |
| `getTasksForContact` | server_action | `L0_READ` | src/lib/task-server-actions.ts |
| `bulkUpdateTasksAction` | server_action | `L2_STATE_MUTATION` | src/lib/task-server-actions.ts |
| `bulkDeleteTasksAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/task-server-actions.ts |
| `listGlobalTemplates` | server_action | `L0_READ` | src/lib/template-actions.ts |
| `getBlueprintAdoptionStats` | server_action | `L0_READ` | src/lib/template-actions.ts |
| `getTemplateById` | server_action | `L0_READ` | src/lib/template-actions.ts |
| `sendTestMessage` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/lib/template-actions.ts |
| `saveThemeAction` | server_action | `L2_STATE_MUTATION` | src/lib/theme-actions.ts |
| `getThemesAction` | server_action | `L0_READ` | src/lib/theme-actions.ts |
| `adminResetUserPasswordAction` | server_action | `L2_STATE_MUTATION` | src/lib/user-invite-actions.ts |
| `publicResetPasswordViaPhoneAction` | server_action | `L2_STATE_MUTATION` | src/lib/user-invite-actions.ts |
| `adminUpdateUserAccessAction` | server_action | `L2_STATE_MUTATION` | src/lib/user-invite-actions.ts |
| `declineJoinRequestAction` | server_action | `L2_STATE_MUTATION` | src/lib/user-invite-actions.ts |
| `removeUserFromOrgAction` | server_action | `L2_STATE_MUTATION` | src/lib/user-invite-actions.ts |
| `updateUserAiPreferencesAction` | server_action | `L2_STATE_MUTATION` | src/lib/user-preferences-actions.ts |
| `updateWorkspaceVocabularyAction` | server_action | `L2_STATE_MUTATION` | src/lib/vocabulary-map-actions.ts |
| `getWorkspaceVocabulary` | server_action | `L0_READ` | src/lib/vocabulary-map-actions.ts |
| `saveWhatsAppConnection` | server_action | `L2_STATE_MUTATION` | src/lib/whatsapp-actions.ts |
| `connectWhatsAppViaOAuth` | server_action | `L2_STATE_MUTATION` | src/lib/whatsapp-actions.ts |
| `testWhatsAppConnection` | server_action | `L2_STATE_MUTATION` | src/lib/whatsapp-actions.ts |
| `rotateWhatsAppToken` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/whatsapp-actions.ts |
| `disconnectWhatsApp` | server_action | `L2_STATE_MUTATION` | src/lib/whatsapp-actions.ts |
| `listAllWhatsAppConnections` | server_action | `L0_READ` | src/lib/whatsapp-backoffice-actions.ts |
| `forceDisconnectWhatsApp` | server_action | `L2_STATE_MUTATION` | src/lib/whatsapp-backoffice-actions.ts |
| `sendWhatsAppTestMessage` | server_action | `L3_EXTERNAL_COMMUNICATION_FINANCE` | src/lib/whatsapp-template-actions.ts |
| `createWhatsAppTemplate` | server_action | `L2_STATE_MUTATION` | src/lib/whatsapp-template-actions.ts |
| `adoptWhatsAppTemplate` | server_action | `L2_STATE_MUTATION` | src/lib/whatsapp-template-actions.ts |
| `listWorkflowsAction` | server_action | `L0_READ` | src/lib/workflows/actions/workflow-actions.ts |
| `getWorkflowAction` | server_action | `L0_READ` | src/lib/workflows/actions/workflow-actions.ts |
| `saveWorkflowAction` | server_action | `L2_STATE_MUTATION` | src/lib/workflows/actions/workflow-actions.ts |
| `toggleWorkflowAction` | server_action | `L2_STATE_MUTATION` | src/lib/workflows/actions/workflow-actions.ts |
| `startWorkflowRunAction` | server_action | `L2_STATE_MUTATION` | src/lib/workflows/actions/workflow-actions.ts |
| `getWorkflowRunAction` | server_action | `L0_READ` | src/lib/workflows/actions/workflow-actions.ts |
| `listWorkflowRunsAction` | server_action | `L0_READ` | src/lib/workflows/actions/workflow-actions.ts |
| `resumeWorkflowRunAction` | server_action | `L2_STATE_MUTATION` | src/lib/workflows/actions/workflow-actions.ts |
| `simulateWorkflowAction` | server_action | `L1_INTERNAL_DRAFT` | src/lib/workflows/actions/workflow-actions.ts |
| `installBlueprintAction` | server_action | `L2_STATE_MUTATION` | src/lib/workflows/actions/workflow-actions.ts |
| `getTerminologyAction` | server_action | `L0_READ` | src/lib/workspace-actions.ts |
| `deleteWorkspaceAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/workspace-actions.ts |
| `archiveWorkspaceAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/workspace-actions.ts |
| `migrateLegacyWorkspaceScopesAction` | server_action | `L2_STATE_MUTATION` | src/lib/workspace-actions.ts |
| `archiveEntityAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/workspace-entity-actions.ts |
| `deleteEntityPermanentlyAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/workspace-entity-actions.ts |
| `bulkArchiveEntitiesAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/workspace-entity-actions.ts |
| `bulkDeleteEntitiesAction` | server_action | `L4_PRIVILEGED_DESTRUCTIVE` | src/lib/workspace-entity-actions.ts |
| `getFilteredEntityIdsAction` | server_action | `L0_READ` | src/lib/workspace-entity-actions.ts |
| `GET /api/activities` | api | `L0_READ` | src/app/api/activities/route.ts |
| `POST /api/activities` | api | `L2_STATE_MUTATION` | src/app/api/activities/route.ts |
| `GET /api/admin/backfill-document-cta` | api | `L0_READ` | src/app/api/admin/backfill-document-cta/route.ts |
| `POST /api/admin/backfill-document-cta` | api | `L2_STATE_MUTATION` | src/app/api/admin/backfill-document-cta/route.ts |
| `POST /api/admin/seed-experience` | api | `L2_STATE_MUTATION` | src/app/api/admin/seed-experience/route.ts |
| `POST /api/auth/session` | api | `L2_STATE_MUTATION` | src/app/api/auth/session/route.ts |
| `DELETE /api/auth/session` | api | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/api/auth/session/route.ts |
| `GET /api/auth/social/callback` | api | `L0_READ` | src/app/api/auth/social/callback/route.ts |
| `POST /api/automations/bulk-trigger` | task_worker | `L2_STATE_MUTATION` | src/app/api/automations/bulk-trigger/route.ts |
| `POST /api/automations/enroll` | api | `L2_STATE_MUTATION` | src/app/api/automations/enroll/route.ts |
| `POST /api/automations/messages/bulk-resend` | task_worker | `L2_STATE_MUTATION` | src/app/api/automations/messages/bulk-resend/route.ts |
| `POST /api/automations/resume` | task_worker | `L2_STATE_MUTATION` | src/app/api/automations/resume/route.ts |
| `POST /api/automations/runs/bulk-force-advance` | task_worker | `L2_STATE_MUTATION` | src/app/api/automations/runs/bulk-force-advance/route.ts |
| `POST /api/automations/runs/bulk-retry` | task_worker | `L2_STATE_MUTATION` | src/app/api/automations/runs/bulk-retry/route.ts |
| `POST /api/automations/webhook/[id]` | webhook | `L2_STATE_MUTATION` | src/app/api/automations/webhook/[id]/route.ts |
| `GET /api/automations/webhook/[id]` | webhook | `L0_READ` | src/app/api/automations/webhook/[id]/route.ts |
| `POST /api/call-centre/webhook` | webhook | `L2_STATE_MUTATION` | src/app/api/call-centre/webhook/route.ts |
| `GET /api/contacts/[entityId]` | api | `L0_READ` | src/app/api/contacts/[entityId]/route.ts |
| `PATCH /api/contacts/[entityId]` | api | `L2_STATE_MUTATION` | src/app/api/contacts/[entityId]/route.ts |
| `POST /api/contacts` | api | `L2_STATE_MUTATION` | src/app/api/contacts/route.ts |
| `GET /api/cron/automation-heartbeat` | cron | `L2_STATE_MUTATION` | src/app/api/cron/automation-heartbeat/route.ts |
| `GET /api/cron/messaging-status-sync` | cron | `L2_STATE_MUTATION` | src/app/api/cron/messaging-status-sync/route.ts |
| `POST /api/cron/process-scheduled-messages` | cron | `L2_STATE_MUTATION` | src/app/api/cron/process-scheduled-messages/route.ts |
| `GET /api/cron/process-scheduled-messages` | cron | `L2_STATE_MUTATION` | src/app/api/cron/process-scheduled-messages/route.ts |
| `GET /api/cron/social-publisher` | cron | `L2_STATE_MUTATION` | src/app/api/cron/social-publisher/route.ts |
| `GET /api/diagnostic` | api | `L0_READ` | src/app/api/diagnostic/route.ts |
| `POST /api/documents/events` | api | `L2_STATE_MUTATION` | src/app/api/documents/events/route.ts |
| `POST /api/documents/process` | api | `L2_STATE_MUTATION` | src/app/api/documents/process/route.ts |
| `OPTIONS /api/external/forms/submit` | api | `L2_STATE_MUTATION` | src/app/api/external/forms/submit/route.ts |
| `POST /api/external/forms/submit` | api | `L2_STATE_MUTATION` | src/app/api/external/forms/submit/route.ts |
| `POST /api/external/v1/entities` | api | `L2_STATE_MUTATION` | src/app/api/external/v1/entities/route.ts |
| `GET /api/integrations/google/callback` | api | `L0_READ` | src/app/api/integrations/google/callback/route.ts |
| `GET /api/integrations/microsoft/callback` | api | `L0_READ` | src/app/api/integrations/microsoft/callback/route.ts |
| `GET /api/integrations/zoom/callback` | api | `L0_READ` | src/app/api/integrations/zoom/callback/route.ts |
| `POST /api/jobs/resend` | api | `L2_STATE_MUTATION` | src/app/api/jobs/resend/route.ts |
| `GET /api/l/[linkId]` | api | `L0_READ` | src/app/api/l/[linkId]/route.ts |
| `GET /api/lead-intelligence/extension/download` | api | `L0_READ` | src/app/api/lead-intelligence/extension/download/route.ts |
| `OPTIONS /api/lead-intelligence/extension/scan` | api | `L2_STATE_MUTATION` | src/app/api/lead-intelligence/extension/scan/route.ts |
| `GET /api/lead-intelligence/extension/scan` | api | `L0_READ` | src/app/api/lead-intelligence/extension/scan/route.ts |
| `OPTIONS /api/lead-intelligence/extension/sync` | api | `L2_STATE_MUTATION` | src/app/api/lead-intelligence/extension/sync/route.ts |
| `POST /api/lead-intelligence/extension/sync` | api | `L2_STATE_MUTATION` | src/app/api/lead-intelligence/extension/sync/route.ts |
| `POST /api/mcp` | mcp | `L2_STATE_MUTATION` | src/app/api/mcp/route.ts |
| `OPTIONS /api/mcp` | mcp | `L2_STATE_MUTATION` | src/app/api/mcp/route.ts |
| `GET /api/mcp/sse` | mcp | `L0_READ` | src/app/api/mcp/sse/route.ts |
| `POST /api/media-tracker` | api | `L2_STATE_MUTATION` | src/app/api/media-tracker/route.ts |
| `POST /api/meetings/register` | api | `L2_STATE_MUTATION` | src/app/api/meetings/register/route.ts |
| `POST /api/messaging/unsubscribe/one-click` | api | `L2_STATE_MUTATION` | src/app/api/messaging/unsubscribe/one-click/route.ts |
| `POST /api/messaging/unsubscribe` | api | `L2_STATE_MUTATION` | src/app/api/messaging/unsubscribe/route.ts |
| `POST /api/messaging/webhooks/resend` | webhook | `L2_STATE_MUTATION` | src/app/api/messaging/webhooks/resend/route.ts |
| `GET /api/migration/alerts` | api | `L0_READ` | src/app/api/migration/alerts/route.ts |
| `POST /api/migration/alerts` | api | `L2_STATE_MUTATION` | src/app/api/migration/alerts/route.ts |
| `POST /api/migration/cleanup` | api | `L2_STATE_MUTATION` | src/app/api/migration/cleanup/route.ts |
| `GET /api/migration/dashboard` | api | `L0_READ` | src/app/api/migration/dashboard/route.ts |
| `GET /api/migration/export` | api | `L0_READ` | src/app/api/migration/export/route.ts |
| `POST /api/migration/log-operation-complete` | api | `L2_STATE_MUTATION` | src/app/api/migration/log-operation-complete/route.ts |
| `POST /api/migration/log-operation-failed` | api | `L2_STATE_MUTATION` | src/app/api/migration/log-operation-failed/route.ts |
| `POST /api/migration/log-operation-start` | api | `L2_STATE_MUTATION` | src/app/api/migration/log-operation-start/route.ts |
| `GET /api/migration/logs` | api | `L0_READ` | src/app/api/migration/logs/route.ts |
| `GET /api/migration/metrics` | api | `L0_READ` | src/app/api/migration/metrics/route.ts |
| `GET /api/migration/schoolid-to-entityid-mapping` | api | `L0_READ` | src/app/api/migration/schoolid-to-entityid-mapping/route.ts |
| `POST /api/migration/survey-seo` | api | `L2_STATE_MUTATION` | src/app/api/migration/survey-seo/route.ts |
| `POST /api/organizations/scrape` | api | `L2_STATE_MUTATION` | src/app/api/organizations/scrape/route.ts |
| `POST /api/organizations/upload-logo` | api | `L2_STATE_MUTATION` | src/app/api/organizations/upload-logo/route.ts |
| `GET /api/pdfs/[pdfId]/generate/[submissionId]` | api | `L0_READ` | src/app/api/pdfs/[pdfId]/generate/[submissionId]/route.ts |
| `POST /api/pdfs/submit` | api | `L2_STATE_MUTATION` | src/app/api/pdfs/submit/route.ts |
| `GET /api/proxy-image` | api | `L0_READ` | src/app/api/proxy-image/route.ts |
| `OPTIONS /api/proxy-image` | api | `L2_STATE_MUTATION` | src/app/api/proxy-image/route.ts |
| `POST /api/qr/batch-export` | api | `L2_STATE_MUTATION` | src/app/api/qr/batch-export/route.ts |
| `POST /api/qr/unlock` | api | `L2_STATE_MUTATION` | src/app/api/qr/unlock/route.ts |
| `GET /api/scheduler/sync` | api | `L0_READ` | src/app/api/scheduler/sync/route.ts |
| `GET /api/sentry-example-api` | api | `L0_READ` | src/app/api/sentry-example-api/route.ts |
| `PATCH /api/tasks/[taskId]` | task_worker | `L2_STATE_MUTATION` | src/app/api/tasks/[taskId]/route.ts |
| `DELETE /api/tasks/[taskId]` | task_worker | `L4_PRIVILEGED_DESTRUCTIVE` | src/app/api/tasks/[taskId]/route.ts |
| `POST /api/tasks/agent-step` | task_worker | `L2_STATE_MUTATION` | src/app/api/tasks/agent-step/route.ts |
| `GET /api/tasks` | api | `L0_READ` | src/app/api/tasks/route.ts |
| `POST /api/tasks` | api | `L2_STATE_MUTATION` | src/app/api/tasks/route.ts |
| `GET /api/v1/media/assets/[assetId]` | api | `L0_READ` | src/app/api/v1/media/assets/[assetId]/route.ts |
| `GET /api/v1/media/assets` | api | `L0_READ` | src/app/api/v1/media/assets/route.ts |
| `POST /api/v1/media/assets` | api | `L2_STATE_MUTATION` | src/app/api/v1/media/assets/route.ts |
| `POST /api/v1/media/events` | api | `L2_STATE_MUTATION` | src/app/api/v1/media/events/route.ts |
| `GET /api/v1/media/experiences` | api | `L0_READ` | src/app/api/v1/media/experiences/route.ts |
| `POST /api/v1/media/recommendations` | api | `L2_STATE_MUTATION` | src/app/api/v1/media/recommendations/route.ts |
| `POST /api/v1/media/search` | api | `L2_STATE_MUTATION` | src/app/api/v1/media/search/route.ts |
| `GET /api/v1/quick-notes/export` | api | `L0_READ` | src/app/api/v1/quick-notes/export/route.ts |
| `POST /api/v1/quick-notes/ingest` | api | `L2_STATE_MUTATION` | src/app/api/v1/quick-notes/ingest/route.ts |
| `POST /api/verify-email/bulk` | api | `L2_STATE_MUTATION` | src/app/api/verify-email/bulk/route.ts |
| `GET /api/verify-email/cron` | cron | `L2_STATE_MUTATION` | src/app/api/verify-email/cron/route.ts |
| `POST /api/verify-email` | api | `L2_STATE_MUTATION` | src/app/api/verify-email/route.ts |
| `POST /api/verify-phone/bulk` | api | `L2_STATE_MUTATION` | src/app/api/verify-phone/bulk/route.ts |
| `GET /api/verify-phone/cron` | cron | `L2_STATE_MUTATION` | src/app/api/verify-phone/cron/route.ts |
| `POST /api/verify-phone` | api | `L2_STATE_MUTATION` | src/app/api/verify-phone/route.ts |
| `POST /api/webhooks/email` | webhook | `L2_STATE_MUTATION` | src/app/api/webhooks/email/route.ts |
| `POST /api/webhooks/inbound/[id]` | webhook | `L2_STATE_MUTATION` | src/app/api/webhooks/inbound/[id]/route.ts |
| `GET /api/webhooks/inbound/[id]` | webhook | `L0_READ` | src/app/api/webhooks/inbound/[id]/route.ts |
| `POST /api/webhooks/messaging/resend` | webhook | `L2_STATE_MUTATION` | src/app/api/webhooks/messaging/resend/route.ts |
| `POST /api/webhooks/resend` | webhook | `L2_STATE_MUTATION` | src/app/api/webhooks/resend/route.ts |
| `GET /api/webhooks/whatsapp` | webhook | `L0_READ` | src/app/api/webhooks/whatsapp/route.ts |
| `POST /api/webhooks/whatsapp` | webhook | `L2_STATE_MUTATION` | src/app/api/webhooks/whatsapp/route.ts |
| `POST /api/whatsapp/upload-media` | api | `L2_STATE_MUTATION` | src/app/api/whatsapp/upload-media/route.ts |
| `GET /api/workspaces/[workspaceId]/contacts` | api | `L0_READ` | src/app/api/workspaces/[workspaceId]/contacts/route.ts |

## Full inventory (2214)

| Capability | Domain | Op | Risk | Status | Guards | Permissions | Collections | File |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `AccessReviewService` | `ai_governance` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `workspace_memberships` | src/lib/services/governance/access-review-service.ts |
| `adjudicateApprovalAction` | `ai_governance` | execute | `L2_STATE_MUTATION`* | unmapped | `checkWorkspaceAccess` | — | — | src/lib/mcp/actions/mcp-governance-actions.ts |
| `AiActionProposalService` | `ai_governance` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/ai-admin/ai-action-proposal-service.ts |
| `AiApprovalRoutingService` | `ai_governance` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/ai-admin/ai-approval-routing-service.ts |
| `AiExecutionEngine` | `ai_governance` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/ai-admin/ai-execution-engine.ts |
| `AiImpactSimulationService` | `ai_governance` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/ai-admin/ai-impact-simulation-service.ts |
| `AiWorkforceRiskEngine` | `ai_governance` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/ai/ai-workforce-risk-engine.ts |
| `approveAiProposalAction` | `ai_governance` | execute | `L2_STATE_MUTATION` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/ai-admin-actions.ts |
| `cancelApprovalRequest` | `ai_governance` | execute | `L2_STATE_MUTATION` | unmapped | — | — | `platform_approval_requests` | src/lib/backoffice/backoffice-approval-actions.ts |
| `createAccessReviewCampaignAction` | `ai_governance` | create | `L2_STATE_MUTATION` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/governance-actions.ts |
| `createAiActionProposalAction` | `ai_governance` | create | `L2_STATE_MUTATION` | wrap | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/ai-admin-actions.ts |
| `createMcpApiKeyAction` | `ai_governance` | create | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess` | — | — | src/lib/mcp/actions/mcp-governance-actions.ts |
| `createOrUpdateSoDRuleAction` | `ai_governance` | create | `L2_STATE_MUTATION` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/governance-actions.ts |
| `decideApprovalRequest` | `ai_governance` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `platform_approval_requests` | src/lib/backoffice/backoffice-approval-actions.ts |
| `decideApprovalRequestAction` | `ai_governance` | execute | `L2_STATE_MUTATION`* | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:finance`, `canUser:invoices` | — | src/lib/approval-actions.ts |
| `deleteSoDRuleAction` | `ai_governance` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/governance-actions.ts |
| `EnterpriseGovernanceEngine` | `ai_governance` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/lead-intelligence/governance/EnterpriseGovernanceEngine.ts |
| `executeMcpToolAction` | `ai_governance` | execute | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess` | — | — | src/lib/mcp/actions/mcp-governance-actions.ts |
| `fetchAuditLogs` | `ai_governance` | read | `L0_READ` | unmapped | — | — | `platform_audit_logs` | src/lib/backoffice/backoffice-audit-actions.ts |
| `fetchPageAuditLogsAction` | `ai_governance` | read | `L0_READ` | unmapped | `requireAuth` | — | `page_audit_logs` | src/lib/governance-actions.ts |
| `FinancialApprovalService` | `ai_governance` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `financial_approval_policies`, `financial_approval_requests` | src/lib/services/financial-approval-service.ts |
| `FinancialAuditService` | `ai_governance` | analyze | `L0_READ` | unmapped | — | — | `financial_audit_logs` | src/lib/services/financial-audit-service.ts |
| `getApprovalPolicyAction` | `ai_governance` | read | `L0_READ` | unmapped | `canUser`, `requireWorkspace` | `canUser:finance`, `canUser:invoices`, `canUser:view` | — | src/lib/approval-actions.ts |
| `getBackofficePoliciesListAction` | `ai_governance` | read | `L0_READ` | unmapped | `requireAuth` | — | `performancePolicies` | src/app/actions/policy-studio-actions.ts |
| `getDocumentAuditHistoryAction` | `ai_governance` | read | `L0_READ` | unmapped | `canUser` | `canUser:finance`, `canUser:invoices`, `canUser:view` | — | src/lib/audit-actions.ts |
| `getKnowledgeGraphGovernanceAction` | `ai_governance` | read | `L0_READ` | unmapped | `canUser`, `requireWorkspace` | `canUser:operations`, `canUser:view` | — | src/app/actions/knowledge-graph-governance-actions.ts |
| `getKnowledgeGraphMetricsAction` | `ai_governance` | read | `L0_READ` | unmapped | `requireWorkspace` | — | — | src/app/actions/knowledge-graph-governance-actions.ts |
| `getPendingApprovalsAction` | `ai_governance` | read | `L0_READ` | unmapped | `canUser`, `requireWorkspace` | `canUser:finance`, `canUser:invoices`, `canUser:view` | `financial_approval_requests` | src/lib/approval-actions.ts |
| `getPolicyVersionHistoryAction` | `ai_governance` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `performancePolicyVersions` | src/app/actions/policy-studio-actions.ts |
| `getRecentFinancialAuditLogsAction` | `ai_governance` | read | `L0_READ` | unmapped | `canUser` | `canUser:finance`, `canUser:invoices`, `canUser:view` | — | src/lib/audit-actions.ts |
| `getSecurityPolicyAction` | `ai_governance` | read | `L0_READ` | wrap | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/governance-actions.ts |
| `getSystemAiArchitectGovernanceAction` | `ai_governance` | read | `L0_READ` | unmapped | — | — | `system_settings` | src/lib/surveys/survey-ai-architect-governance-actions.ts |
| `getWorkspacePolicyAction` | `ai_governance` | read | `L0_READ` | wrap | `requireWorkspace` | — | `performancePolicies` | src/app/actions/policy-studio-actions.ts |
| `governanceAuditFlow` | `ai_governance` | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/governance-audit-flow.ts |
| `governanceAuditInputSchema` | `ai_governance` | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/governance-audit-flow.ts |
| `governanceAuditOutputSchema` | `ai_governance` | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/governance-audit-flow.ts |
| `grantTemporaryAccessAction` | `ai_governance` | execute | `L2_STATE_MUTATION`* | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/governance-actions.ts |
| `listAccessReviewCampaignsAction` | `ai_governance` | read | `L0_READ` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/governance-actions.ts |
| `listAiActionProposalsAction` | `ai_governance` | read | `L0_READ` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/ai-admin-actions.ts |
| `listAiExecutionAuditsAction` | `ai_governance` | read | `L0_READ` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/ai-admin-actions.ts |
| `listApprovalRequests` | `ai_governance` | read | `L0_READ` | unmapped | — | — | `platform_approval_requests` | src/lib/backoffice/backoffice-approval-actions.ts |
| `listMcpApiKeysAction` | `ai_governance` | read | `L0_READ` | unmapped | `checkWorkspaceAccess` | — | — | src/lib/mcp/actions/mcp-governance-actions.ts |
| `listMcpAuditLogsAction` | `ai_governance` | read | `L0_READ` | unmapped | `checkWorkspaceAccess` | — | — | src/lib/mcp/actions/mcp-governance-actions.ts |
| `listMcpToolsAction` | `ai_governance` | read | `L0_READ` | unmapped | `checkWorkspaceAccess` | — | — | src/lib/mcp/actions/mcp-governance-actions.ts |
| `listPendingApprovalsAction` | `ai_governance` | read | `L0_READ` | unmapped | `checkWorkspaceAccess` | — | — | src/lib/mcp/actions/mcp-governance-actions.ts |
| `listReviewDecisionsAction` | `ai_governance` | read | `L0_READ` | wrap | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/governance-actions.ts |
| `listSecurityAuditEventsAction` | `ai_governance` | read | `L0_READ` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/governance-actions.ts |
| `listSessionsAction` | `ai_governance` | read | `L0_READ` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/governance-actions.ts |
| `listSoDRulesAction` | `ai_governance` | read | `L0_READ` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/governance-actions.ts |
| `listTemporaryAccessGrantsAction` | `ai_governance` | read | `L0_READ` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/governance-actions.ts |
| `MfaPolicyService` | `ai_governance` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/enterprise-identity/mfa-policy-service.ts |
| `PolicyEngineService` | `ai_governance` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/authorization/policy-engine-service.ts |
| `reapExpiredGrantsAction` | `ai_governance` | execute | `L2_STATE_MUTATION`* | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/governance-actions.ts |
| `recordAuditLogAction` | `ai_governance` | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `page_audit_logs` | src/lib/governance-actions.ts |
| `rejectAiProposalAction` | `ai_governance` | execute | `L2_STATE_MUTATION` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/ai-admin-actions.ts |
| `resetKnowledgeGraphGovernanceAction` | `ai_governance` | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | — | src/app/actions/knowledge-graph-governance-actions.ts |
| `resetPolicyToDefaultsAction` | `ai_governance` | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | — | src/app/actions/policy-studio-actions.ts |
| `reviewApprovalRequestAction` | `ai_governance` | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | `approval_requests`, `page_audit_logs` | src/lib/governance-actions.ts |
| `revokeAllSessionsAction` | `ai_governance` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/governance-actions.ts |
| `revokeMcpApiKeyAction` | `ai_governance` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `checkWorkspaceAccess` | — | — | src/lib/mcp/actions/mcp-governance-actions.ts |
| `revokeSessionAction` | `ai_governance` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/governance-actions.ts |
| `revokeTemporaryAccessAction` | `ai_governance` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/governance-actions.ts |
| `rollbackPolicyVersionAction` | `ai_governance` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `performancePolicies`, `performancePolicyVersions` | src/app/actions/policy-studio-actions.ts |
| `saveAndPublishPolicyAction` | `ai_governance` | update | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | `requireWorkspace` | — | `performancePolicies`, `performancePolicyVersions` | src/app/actions/policy-studio-actions.ts |
| `saveApprovalPolicyAction` | `ai_governance` | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:finance`, `canUser:settings` | — | src/lib/approval-actions.ts |
| `saveSystemAiArchitectGovernanceAction` | `ai_governance` | update | `L2_STATE_MUTATION` | unmapped | `requireSystemAdmin` | — | `system_settings` | src/lib/surveys/survey-ai-architect-governance-actions.ts |
| `scanSoDConflictsAction` | `ai_governance` | analyze | `L0_READ` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/governance-actions.ts |
| `SecurityAuditService` | `ai_governance` | analyze | `L0_READ` | unmapped | — | — | — | src/lib/services/governance/security-audit-service.ts |
| `SeparationOfDutyService` | `ai_governance` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `users` | src/lib/services/governance/separation-of-duty-service.ts |
| `SessionManagementService` | `ai_governance` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/governance/session-management-service.ts |
| `simulatePolicyImpactAction` | `ai_governance` | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireWorkspace` | — | `effortEvents`, `performancePolicies`, `salesPerformanceDaily` | src/app/actions/policy-studio-actions.ts |
| `submitApprovalRequestAction` | `ai_governance` | create | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:finance`, `canUser:invoices` | — | src/lib/approval-actions.ts |
| `submitApprovalRequestAction` | `ai_governance` | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `approval_requests` | src/lib/governance-actions.ts |
| `submitReviewDecisionAction` | `ai_governance` | create | `L2_STATE_MUTATION` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/governance-actions.ts |
| `TemporaryAccessService` | `ai_governance` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `workspace_memberships` | src/lib/services/governance/temporary-access-service.ts |
| `triggerBackfillCrmRelationsAction` | `ai_governance` | execute | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | — | src/app/actions/knowledge-graph-governance-actions.ts |
| `updateKnowledgeGraphGovernanceAction` | `ai_governance` | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:operations` | — | src/app/actions/knowledge-graph-governance-actions.ts |
| `updateSecurityPolicyAction` | `ai_governance` | update | `L2_STATE_MUTATION` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/governance-actions.ts |
| `upsertMcpApprovalPolicyAction` | `ai_governance` | update | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess` | — | — | src/lib/mcp/actions/mcp-governance-actions.ts |
| `assignCustomPageWorkspaceAction` | `analytics_reporting` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `campaign_pages`, `custom_page_analytics` | src/lib/custom-page-analytics-actions.ts |
| `checkMessageDeliveryLogs` | `analytics_reporting` | read | `L0_READ` | unmapped | — | — | `message_logs` | src/lib/services/delivery-telemetry.ts |
| `createOrUpdateSavedViewAction` | `analytics_reporting` | create | `L2_STATE_MUTATION` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/analytics-actions.ts |
| `deleteSavedViewAction` | `analytics_reporting` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/analytics-actions.ts |
| `getAgingReportAction` | `analytics_reporting` | read | `L0_READ` | unmapped | — | — | — | src/lib/reporting-actions.ts |
| `getCashflowTrendAction` | `analytics_reporting` | read | `L0_READ` | unmapped | `canUser` | `canUser:finance`, `canUser:invoices`, `canUser:view` | — | src/lib/reporting-actions.ts |
| `getCollectorLeaderboardAction` | `analytics_reporting` | read | `L0_READ` | unmapped | `canUser` | `canUser:finance`, `canUser:invoices`, `canUser:view` | — | src/lib/reporting-actions.ts |
| `getCustomPageAnalytics` | `analytics_reporting` | read | `L0_READ` | unmapped | `requireAuth` | — | `contacts`, `entities`, `events` | src/lib/custom-page-analytics-actions.ts |
| `getDashboardConfig` | `analytics_reporting` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `dashboards` | src/lib/services/dashboard.service.ts |
| `getDocumentAnalyticsAction` | `analytics_reporting` | read | `L0_READ` | unmapped | `requireAuth` | — | `document_events`, `documents`, `flipbook_leads`, `viewer_sessions` | src/lib/documents/analytics-actions.ts |
| `getExecutiveFinanceMetricsAction` | `analytics_reporting` | read | `L0_READ` | unmapped | `canUser` | `canUser:finance`, `canUser:invoices`, `canUser:view` | — | src/lib/reporting-actions.ts |
| `getLatestSurveysData` | `analytics_reporting` | read | `L0_READ` | unmapped | `requireWorkspace` | — | — | src/app/actions/dashboard-actions.ts |
| `getLeastPrivilegeReportAction` | `analytics_reporting` | read | `L0_READ` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/analytics-actions.ts |
| `getPipelineData` | `analytics_reporting` | read | `L0_READ` | wrap | `requireWorkspace` | — | — | src/app/actions/dashboard-actions.ts |
| `getPipelineMetrics` | `analytics_reporting` | read | `L0_READ` | wrap | `requireAuth` | — | `workspace_entities`, `workspaces` | src/lib/metrics-actions.ts |
| `getPlatformOpsStats` | `analytics_reporting` | read | `L0_READ` | unmapped | — | — | `platform_audit_logs`, `platform_jobs` | src/lib/backoffice/backoffice-dashboard-actions.ts |
| `getRecentActivitiesData` | `analytics_reporting` | read | `L0_READ` | unmapped | `requireWorkspace` | — | — | src/app/actions/dashboard-actions.ts |
| `getReportAggregates` | `analytics_reporting` | read | `L0_READ` | unmapped | — | — | — | src/lib/reports/report-actions.ts |
| `getRevenueReportAction` | `analytics_reporting` | read | `L0_READ` | unmapped | — | — | — | src/lib/reporting-actions.ts |
| `getSaasMetrics` | `analytics_reporting` | read | `L0_READ` | unmapped | `requireWorkspace` | — | — | src/app/actions/dashboard-actions.ts |
| `getSharedContactMetrics` | `analytics_reporting` | read | `L0_READ` | unmapped | `requireAuth` | — | `workspace_entities`, `workspaces` | src/lib/metrics-actions.ts |
| `getTaxAuditReportAction` | `analytics_reporting` | read | `L0_READ` | unmapped | — | — | — | src/lib/reporting-actions.ts |
| `getTeamLeaderboardAction` | `analytics_reporting` | read | `L0_READ` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/analytics-actions.ts |
| `getUniqueEntityMetrics` | `analytics_reporting` | read | `L0_READ` | unmapped | `requireAuth` | — | `entities` | src/lib/metrics-actions.ts |
| `getUpcomingMeetingsData` | `analytics_reporting` | read | `L0_READ` | unmapped | `requireWorkspace` | — | — | src/app/actions/dashboard-actions.ts |
| `getWorkforceAdoptionMetricsAction` | `analytics_reporting` | read | `L0_READ` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/analytics-actions.ts |
| `getWorkspaceAdvancedAnalyticsAction` | `analytics_reporting` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `document_events`, `documents`, `flipbook_leads`, `viewer_sessions` | src/lib/documents/advanced-analytics-actions.ts |
| `getWorkspaceMembershipMetrics` | `analytics_reporting` | read | `L0_READ` | unmapped | `requireAuth` | — | `workspace_entities`, `workspaces` | src/lib/metrics-actions.ts |
| `ingestPlatformEventAction` | `analytics_reporting` | execute | `L2_STATE_MUTATION`* | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/analytics-actions.ts |
| `listPlatformEventsAction` | `analytics_reporting` | read | `L0_READ` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/analytics-actions.ts |
| `listSavedDirectoryViewsAction` | `analytics_reporting` | read | `L0_READ` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/analytics-actions.ts |
| `listTrackedPages` | `analytics_reporting` | read | `L0_READ` | unmapped | `requireAuth` | — | `campaign_pages` | src/lib/custom-page-analytics-actions.ts |
| `MaterializedSummaryService` | `analytics_reporting` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `financial_accounts`, `invoices`, `payments`, `workspace_financial_summaries`, `workspaces` | src/lib/services/materialized-summary-service.ts |
| `ModularReportingService` | `analytics_reporting` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `financial_accounts`, `invoices` | src/lib/services/modular-reporting-service.ts |
| `QuickActions` | `analytics_reporting` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/components/dashboard/QuickActions.tsx |
| `recordConversion` | `analytics_reporting` | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `campaign_pages` | src/lib/analytics-actions.ts |
| `recordCustomPageEvent` | `analytics_reporting` | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `events`, `sessions` | src/lib/custom-page-analytics-actions.ts |
| `recordInteractionAction` | `analytics_reporting` | create | `L2_STATE_MUTATION` | unmapped | — | — | `campaign_pages` | src/lib/analytics-actions.ts |
| `recordPageViewAction` | `analytics_reporting` | create | `L2_STATE_MUTATION` | unmapped | — | — | `campaign_pages` | src/lib/analytics-actions.ts |
| `ReportExportService` | `analytics_reporting` | read | `L0_READ` | unmapped | — | — | — | src/lib/services/report-export-service.ts |
| `saveDashboardLayout` | `analytics_reporting` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `dashboards` | src/lib/services/dashboard.service.ts |
| `SavedDirectoryViewService` | `analytics_reporting` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/analytics/saved-directory-view-service.ts |
| `GET /api/migration/dashboard` | `analytics_reporting` | read | `L0_READ` | unmapped | `authenticateApiRequest` | — | — | src/app/api/migration/dashboard/route.ts |
| `GET /api/migration/metrics` | `analytics_reporting` | read | `L0_READ` | unmapped | `authenticateApiRequest` | — | — | src/app/api/migration/metrics/route.ts |
| `POST /api/automations/bulk-trigger` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | `isAuthorizedCloudTaskRequest` | — | `automations`, `entities`, `workspace_entities` | src/app/api/automations/bulk-trigger/route.ts |
| `POST /api/automations/enroll` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/api/automations/enroll/route.ts |
| `POST /api/automations/resume` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | `isAuthorizedCloudTaskRequest` | — | `automation_jobs`, `automation_runs` | src/app/api/automations/resume/route.ts |
| `POST /api/automations/runs/bulk-force-advance` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | `isAuthorizedCloudTaskRequest` | — | `automation_runs` | src/app/api/automations/runs/bulk-force-advance/route.ts |
| `POST /api/automations/runs/bulk-retry` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | `isAuthorizedCloudTaskRequest` | — | `automation_runs` | src/app/api/automations/runs/bulk-retry/route.ts |
| `GET /api/automations/webhook/[id]` | `automation_workflows` | read | `L0_READ` | unmapped | — | — | `automations` | src/app/api/automations/webhook/[id]/route.ts |
| `POST /api/automations/webhook/[id]` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `automations` | src/app/api/automations/webhook/[id]/route.ts |
| `POST /api/call-centre/webhook` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/api/call-centre/webhook/route.ts |
| `GET /api/cron/automation-heartbeat` | `automation_workflows` | execute | `L2_STATE_MUTATION` | unmapped | `authenticateCronRequest` | — | — | src/app/api/cron/automation-heartbeat/route.ts |
| `GET /api/scheduler/sync` | `automation_workflows` | read | `L0_READ` | unmapped | `authenticateCronRequest` | — | `calendar_connections` | src/app/api/scheduler/sync/route.ts |
| `POST /api/tasks/agent-step` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | `isAuthorizedCloudTaskRequest` | — | — | src/app/api/tasks/agent-step/route.ts |
| `POST /api/verify-phone/trigger` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/api/verify-phone/trigger/route.ts |
| `ActionConfigPanel` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/admin/automations/components/ActionConfigPanel.tsx |
| `ActionNode` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/admin/automations/[id]/edit/components/nodes/ActionNode.tsx |
| `addContactsToCallCampaignAction` | `automation_workflows` | create | `L2_STATE_MUTATION` | unmapped | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:edit` | — | src/lib/call-centre-actions.ts |
| `archiveAutomationAction` | `automation_workflows` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireAuth` | — | — | src/lib/automation-actions.ts |
| `archiveCallCampaignAction` | `automation_workflows` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:edit` | — | src/lib/call-centre-actions.ts |
| `bulkCleanContactsAction` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | `entities`, `workspace_entities` | src/lib/automation-actions.ts |
| `bulkForceAdvanceRunsAction` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | `assertAutomationManagePermission`, `requireWorkspace` | `assertAutomationManagePermission:edit` | — | src/lib/automation-actions.ts |
| `bulkResendFailedMessagesAction` | `automation_workflows` | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | `assertAutomationManagePermission`, `requireWorkspace` | `assertAutomationManagePermission:edit` | — | src/lib/automation-actions.ts |
| `bulkRetryRunsAction` | `automation_workflows` | execute | `L2_STATE_MUTATION` | unmapped | `assertAutomationManagePermission`, `requireWorkspace` | `assertAutomationManagePermission:edit` | — | src/lib/automation-actions.ts |
| `calculateFreeSlots` | `automation_workflows` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | `calendar_connections`, `meetings`, `tasks`, `user_availabilities` | src/lib/services/scheduler/availability.ts |
| `CallCentreService` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `call_campaigns`, `call_queue_items`, `call_scripts`, `deals`, `entities`, `entity_notes`, `meetings`, `message_templates`, `onboardingStages`, `organizations`, `portal_invitations`, `portal_memberships`, `portals`, `users`, `workspace_entities`, `workspaces` | src/lib/services/call-centre-service.ts |
| `cancelAutomationRunAction` | `automation_workflows` | execute | `L2_STATE_MUTATION` | wrap | `assertAutomationManagePermission`, `requireAuth` | `assertAutomationManagePermission:edit` | `automation_runs`, `automations` | src/lib/automation-actions.ts |
| `cleanAndVerifyRunContactAction` | `automation_workflows` | read | `L0_READ` | unmapped | `assertAutomationManagePermission`, `requireAuth` | `assertAutomationManagePermission:edit` | `automation_runs` | src/lib/automation-actions.ts |
| `cleanContactEmailAction` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | `entities`, `workspace_entities` | src/lib/automation-actions.ts |
| `cloneCallCampaignAction` | `automation_workflows` | create | `L2_STATE_MUTATION` | unmapped | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:create` | — | src/lib/call-centre-actions.ts |
| `createBookingAction` | `automation_workflows` | create | `L2_STATE_MUTATION` | unmapped | — | — | `booking_pages`, `bookings`, `calendar_connections`, `meetings` | src/app/actions/scheduler-actions.ts |
| `createCallCampaignAction` | `automation_workflows` | create | `L2_STATE_MUTATION` | unmapped | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:create` | — | src/lib/call-centre-actions.ts |
| `createCallScriptAction` | `automation_workflows` | create | `L2_STATE_MUTATION` | unmapped | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:create` | — | src/lib/call-centre-actions.ts |
| `createContactFollowupTaskAction` | `automation_workflows` | create | `L2_STATE_MUTATION` | unmapped | `assertAutomationManagePermission`, `requireWorkspace` | `assertAutomationManagePermission:edit` | — | src/lib/automation-actions.ts |
| `deferQueueItemAction` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:edit` | — | src/lib/call-centre-actions.ts |
| `deleteAllArchivedAutomationsAction` | `automation_workflows` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireWorkspace` | — | — | src/lib/automation-actions.ts |
| `deleteAutomationAction` | `automation_workflows` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireAuth` | — | — | src/lib/automation-actions.ts |
| `deleteBookingPageAction` | `automation_workflows` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | `booking_pages` | src/app/actions/scheduler-actions.ts |
| `deleteCallCampaignAction` | `automation_workflows` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:delete` | — | src/lib/call-centre-actions.ts |
| `deleteCallScriptAction` | `automation_workflows` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:delete` | — | src/lib/call-centre-actions.ts |
| `deleteContactAction` | `automation_workflows` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireAuth` | — | `entities`, `workspace_entities` | src/lib/automation-actions.ts |
| `disconnectConnectionAction` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | `calendar_connections` | src/app/actions/scheduler-actions.ts |
| `endCallCampaignAction` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:edit` | — | src/lib/call-centre-actions.ts |
| `enqueueAndLockSingleCallAction` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:edit` | — | src/lib/call-centre-actions.ts |
| `enrollContactsInAutomationAction` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/automation-actions.ts |
| `ensureWorkspaceAvailabilityAction` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `user_availabilities` | src/app/actions/scheduler-actions.ts |
| `executeMessageStatusAutomationsAction` | `automation_workflows` | execute | `L2_STATE_MUTATION` | unmapped | `assertAutomationManagePermission`, `requireWorkspace` | `assertAutomationManagePermission:edit` | — | src/lib/automation-actions.ts |
| `executeOutcomeAutomationsAction` | `automation_workflows` | execute | `L2_STATE_MUTATION` | unmapped | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:edit` | — | src/lib/call-centre-actions.ts |
| `executeScriptActionAction` | `automation_workflows` | execute | `L2_STATE_MUTATION` | unmapped | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:edit` | — | src/lib/call-centre-actions.ts |
| `exportAutomationAction` | `automation_workflows` | read | `L0_READ` | unmapped | `requireAuth` | — | — | src/lib/automation-actions.ts |
| `FinanceAutomationService` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `finance_reminder_logs`, `invoices` | src/lib/services/finance-automation-service.ts |
| `forceAdvanceRunAction` | `automation_workflows` | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | — | src/lib/automation-actions.ts |
| `forceEndRunAction` | `automation_workflows` | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | — | src/lib/automation-actions.ts |
| `generateAutomation` | `automation_workflows` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/generate-automation-flow.ts |
| `generateCallScriptAction` | `automation_workflows` | draft | `L1_INTERNAL_DRAFT` | unmapped | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:create` | — | src/lib/call-centre-actions.ts |
| `generateCampaignQueueAction` | `automation_workflows` | draft | `L1_INTERNAL_DRAFT` | unmapped | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:edit` | — | src/lib/call-centre-actions.ts |
| `getAvailableSlotsAction` | `automation_workflows` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/scheduler-actions.ts |
| `getBookingPageBySlugAction` | `automation_workflows` | read | `L0_READ` | unmapped | — | — | `booking_pages` | src/app/actions/scheduler-actions.ts |
| `getCallCampaignAction` | `automation_workflows` | read | `L0_READ` | wrap | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:view` | — | src/lib/call-centre-actions.ts |
| `getCallScriptAction` | `automation_workflows` | read | `L0_READ` | unmapped | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:view` | — | src/lib/call-centre-actions.ts |
| `getGoogleAuthUrlAction` | `automation_workflows` | read | `L0_READ` | unmapped | `requireWorkspace` | — | — | src/app/actions/scheduler-actions.ts |
| `getMessageNodeLogsAction` | `automation_workflows` | read | `L0_READ` | unmapped | `requireAuth` | — | `message_logs` | src/lib/automation-actions.ts |
| `getMessageNodeStatsAction` | `automation_workflows` | read | `L0_READ` | unmapped | `requireAuth` | — | — | src/lib/automation-actions.ts |
| `getMicrosoftAuthUrlAction` | `automation_workflows` | read | `L0_READ` | unmapped | `requireWorkspace` | — | — | src/app/actions/scheduler-actions.ts |
| `getReminderLogsAction` | `automation_workflows` | read | `L0_READ` | unmapped | `canUser`, `requireWorkspace` | `canUser:finance`, `canUser:invoices`, `canUser:view` | `finance_reminder_logs` | src/lib/finance-automation-actions.ts |
| `getWorkflowAction` | `automation_workflows` | read | `L0_READ` | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | `brain_workflows`, `users` | src/lib/workflows/actions/workflow-actions.ts |
| `getWorkflowRunAction` | `automation_workflows` | read | `L0_READ` | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | `users` | src/lib/workflows/actions/workflow-actions.ts |
| `getZoomAuthUrlAction` | `automation_workflows` | read | `L0_READ` | unmapped | `requireWorkspace` | — | — | src/app/actions/scheduler-actions.ts |
| `handleAddNote` | `automation_workflows` | create | `L2_STATE_MUTATION` | unmapped | — | — | `entity_notes` | src/lib/automations/actions/entity-actions.ts |
| `handleAssignEntity` | `automation_workflows` | update | `L2_STATE_MUTATION` | unmapped | — | — | `workspace_entities` | src/lib/automations/actions/entity-actions.ts |
| `handleCreateContactForEntity` | `automation_workflows` | create | `L2_STATE_MUTATION` | unmapped | — | — | `automation_runs`, `entities`, `organizations`, `workspace_entities` | src/lib/automations/actions/entity-actions.ts |
| `handleCreateEntity` | `automation_workflows` | create | `L2_STATE_MUTATION` | extend | — | — | `app_fields`, `automation_runs`, `automations` | src/lib/automations/actions/entity-actions.ts |
| `handleCreateTask` | `automation_workflows` | create | `L2_STATE_MUTATION` | unmapped | — | — | `workspaces` | src/lib/automations/actions/task-actions.ts |
| `handleDirectMessage` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/automations/actions/message-actions.ts |
| `handleDirectNotification` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `users`, `workspaces` | src/lib/automations/actions/notification-actions.ts |
| `handleFindContact` | `automation_workflows` | search | `L0_READ` | unmapped | — | — | `automation_runs`, `entities`, `organizations`, `workspace_contacts`, `workspace_entities` | src/lib/automations/actions/entity-actions.ts |
| `handleSendMessage` | `automation_workflows` | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | — | — | `entities`, `organizations`, `workspaces` | src/lib/automations/actions/message-actions.ts |
| `handleSendNotification` | `automation_workflows` | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | — | — | `in_app_notifications`, `message_templates`, `users`, `workspaces` | src/lib/automations/actions/notification-actions.ts |
| `handleTriggerOutboundWebhook` | `automation_workflows` | execute | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/automations/actions/webhook-actions.ts |
| `handleUpdateContact` | `automation_workflows` | update | `L2_STATE_MUTATION` | unmapped | — | — | `automation_runs`, `entities`, `organizations`, `workspace_contacts`, `workspace_entities` | src/lib/automations/actions/entity-actions.ts |
| `handleUpdateEntity` | `automation_workflows` | update | `L2_STATE_MUTATION` | extend | — | — | `entities`, `workspace_entities` | src/lib/automations/actions/entity-actions.ts |
| `handleUpdateLeadScore` | `automation_workflows` | update | `L2_STATE_MUTATION` | extend | — | — | `workspaces` | src/lib/automations/actions/score-automation-actions.ts |
| `handleUpdateTask` | `automation_workflows` | update | `L2_STATE_MUTATION` | extend | — | — | `tasks` | src/lib/automations/actions/task-actions.ts |
| `healStrandedMessageContactsAction` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | — | src/lib/automation-actions.ts |
| `importAutomationAction` | `automation_workflows` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/automation-actions.ts |
| `importCallScriptAction` | `automation_workflows` | create | `L2_STATE_MUTATION` | unmapped | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:create` | — | src/lib/call-centre-actions.ts |
| `installBlueprintAction` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | `brain_workflows`, `users` | src/lib/workflows/actions/workflow-actions.ts |
| `jumpRunToStepAction` | `automation_workflows` | execute | `L2_STATE_MUTATION` | unmapped | `assertAutomationManagePermission`, `requireAuth` | `assertAutomationManagePermission:edit` | `automation_runs` | src/lib/automation-actions.ts |
| `listCallCampaignsAction` | `automation_workflows` | read | `L0_READ` | wrap | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:view` | — | src/lib/call-centre-actions.ts |
| `listCallScriptsAction` | `automation_workflows` | read | `L0_READ` | unmapped | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:view` | — | src/lib/call-centre-actions.ts |
| `listWorkflowRunsAction` | `automation_workflows` | read | `L0_READ` | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | `users`, `workflow_runs` | src/lib/workflows/actions/workflow-actions.ts |
| `listWorkflowsAction` | `automation_workflows` | read | `L0_READ` | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | `brain_workflows`, `users` | src/lib/workflows/actions/workflow-actions.ts |
| `lockQueueItemAction` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:edit` | — | src/lib/call-centre-actions.ts |
| `manuallyEndAutomationRunAction` | `automation_workflows` | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | — | src/lib/automation-actions.ts |
| `manuallyReleaseAllWaitJobsAction` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | — | src/lib/automation-actions.ts |
| `manuallyReleaseWaitJobAction` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | — | src/lib/automation-actions.ts |
| `NodeActionToolbar` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/admin/automations/[id]/edit/components/nodes/NodeActionToolbar.tsx |
| `parseManualRecipients` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/automations/actions/notification-actions.ts |
| `pauseRunAction` | `automation_workflows` | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | — | src/lib/automation-actions.ts |
| `pulseAutomationEngineAction` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | — | src/lib/automation-actions.ts |
| `reconcilePendingSmsLogsAction` | `automation_workflows` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | — | src/lib/automation-actions.ts |
| `refineCallScriptAction` | `automation_workflows` | draft | `L1_INTERNAL_DRAFT` | unmapped | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:edit` | — | src/lib/call-centre-actions.ts |
| `releaseQueueItemAction` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:edit` | — | src/lib/call-centre-actions.ts |
| `releaseSingleCallAction` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:edit` | — | src/lib/call-centre-actions.ts |
| `removeContactsFromCampaignAction` | `automation_workflows` | delete | `L2_STATE_MUTATION` | unmapped | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:edit` | — | src/lib/call-centre-actions.ts |
| `rescheduleWaitJobAction` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | `assertAutomationManagePermission`, `requireAuth` | `assertAutomationManagePermission:edit` | `automation_jobs` | src/lib/automation-actions.ts |
| `resendFailedMessageAction` | `automation_workflows` | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | `assertAutomationManagePermission`, `requireAuth` | `assertAutomationManagePermission:edit` | `message_logs` | src/lib/automation-actions.ts |
| `resendFailedMessagesAction` | `automation_workflows` | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | wrap | `requireWorkspace` | — | — | src/lib/automation-actions.ts |
| `restartRunAction` | `automation_workflows` | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | — | src/lib/automation-actions.ts |
| `restoreAutomationAction` | `automation_workflows` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | — | src/lib/automation-actions.ts |
| `resumeRunAction` | `automation_workflows` | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | — | src/lib/automation-actions.ts |
| `resumeWorkflowRunAction` | `automation_workflows` | execute | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | `users` | src/lib/workflows/actions/workflow-actions.ts |
| `retryFailedStepAction` | `automation_workflows` | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | — | src/lib/automation-actions.ts |
| `runReminderCycleAction` | `automation_workflows` | execute | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:finance`, `canUser:invoices` | — | src/lib/finance-automation-actions.ts |
| `saveAutomationAction` | `automation_workflows` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/automation-actions.ts |
| `saveBookingPageAction` | `automation_workflows` | update | `L2_STATE_MUTATION` | unmapped | — | — | `booking_pages` | src/app/actions/scheduler-actions.ts |
| `saveWorkflowAction` | `automation_workflows` | update | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | `brain_workflows`, `users` | src/lib/workflows/actions/workflow-actions.ts |
| `scheduleCallbackAction` | `automation_workflows` | execute | `L2_STATE_MUTATION` | unmapped | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:edit` | — | src/lib/call-centre-actions.ts |
| `seedDefaultAutomationsAction` | `automation_workflows` | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | — | src/lib/automation-actions.ts |
| `sendInvoiceReminderAction` | `automation_workflows` | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:finance`, `canUser:invoices` | — | src/lib/finance-automation-actions.ts |
| `simulateWorkflowAction` | `automation_workflows` | draft | `L1_INTERNAL_DRAFT` | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | `users` | src/lib/workflows/actions/workflow-actions.ts |
| `skipQueueItemAction` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:edit` | — | src/lib/call-centre-actions.ts |
| `startWorkflowRunAction` | `automation_workflows` | execute | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | `brain_workflows`, `users` | src/lib/workflows/actions/workflow-actions.ts |
| `submitCallOutcomeAction` | `automation_workflows` | create | `L2_STATE_MUTATION` | unmapped | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:edit` | — | src/lib/call-centre-actions.ts |
| `TagActionNode` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/admin/automations/[id]/edit/components/nodes/TagActionNode.tsx |
| `testAutomationFlowAction` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | — | src/lib/automation-actions.ts |
| `testAutomationStepAction` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | — | src/lib/automation-actions.ts |
| `toggleAutomationStatusAction` | `automation_workflows` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | — | src/lib/automation-actions.ts |
| `toggleWorkflowAction` | `automation_workflows` | update | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | `brain_workflows`, `users` | src/lib/workflows/actions/workflow-actions.ts |
| `transferMediaAutomationsAction` | `automation_workflows` | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | `media`, `media_shares` | src/lib/media-automation-actions.ts |
| `updateCallCampaignAction` | `automation_workflows` | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:edit` | — | src/lib/call-centre-actions.ts |
| `updateCallScriptAction` | `automation_workflows` | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:edit` | — | src/lib/call-centre-actions.ts |
| `updateNotesDraftAction` | `automation_workflows` | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `verifyPermission` | `canUser:messaging`, `canUser:studios`, `verifyPermission:edit` | — | src/lib/call-centre-actions.ts |
| `updateRunPayloadAction` | `automation_workflows` | update | `L2_STATE_MUTATION` | unmapped | `assertAutomationManagePermission`, `requireAuth` | `assertAutomationManagePermission:edit` | `automation_runs` | src/lib/automation-actions.ts |
| `verifySingleContactAction` | `automation_workflows` | read | `L0_READ` | unmapped | `requireAuth` | — | `entities`, `workspace_entities` | src/lib/automation-actions.ts |
| `addQRCodesToCampaign` | `campaigns_marketing` | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `organizations`, `qr_campaigns`, `qr_codes`, `workspaces` | src/lib/qr-campaign-actions.ts |
| `createQRCampaign` | `campaigns_marketing` | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `organizations`, `qr_campaigns`, `qr_codes`, `workspaces` | src/lib/qr-campaign-actions.ts |
| `createSurveyDistributionCampaignAction` | `campaigns_marketing` | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `survey_distribution_campaigns` | src/lib/surveys/survey-campaign-actions.ts |
| `deleteCampaignConceptAction` | `campaigns_marketing` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/lib/quick-notes-campaign-actions.ts |
| `deleteQRCampaign` | `campaigns_marketing` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireWorkspace` | — | `organizations`, `qr_campaigns`, `qr_codes`, `workspaces` | src/lib/qr-campaign-actions.ts |
| `deployConceptToCampaignStudioAction` | `campaigns_marketing` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/quick-notes-campaign-actions.ts |
| `dispatchSurveyDistributionCampaignAction` | `campaigns_marketing` | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | `requireWorkspace` | — | `contacts`, `survey_distribution_campaigns`, `surveys` | src/lib/surveys/survey-campaign-actions.ts |
| `estimateAudienceSizeAction` | `campaigns_marketing` | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireWorkspace` | — | `contacts` | src/lib/surveys/survey-campaign-actions.ts |
| `generateCampaignConceptAction` | `campaigns_marketing` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/lib/quick-notes-campaign-actions.ts |
| `generateCampaignConceptFlow` | `campaigns_marketing` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/generate-campaign-concept-flow.ts |
| `generateCampaignConceptInputSchema` | `campaigns_marketing` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/generate-campaign-concept-flow.ts |
| `generateCampaignConceptOutputSchema` | `campaigns_marketing` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/generate-campaign-concept-flow.ts |
| `generateWorkspaceBattlecardsAction` | `campaigns_marketing` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/lib/quick-notes-campaign-actions.ts |
| `getCampaignAnalytics` | `campaigns_marketing` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `organizations`, `qr_campaigns`, `qr_codes`, `workspaces` | src/lib/qr-campaign-actions.ts |
| `getQRCampaigns` | `campaigns_marketing` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `organizations`, `qr_campaigns`, `workspaces` | src/lib/qr-campaign-actions.ts |
| `getSystemDispatchGovernanceAction` | `campaigns_marketing` | read | `L0_READ` | unmapped | `requireAuth` | — | `system_settings` | src/lib/surveys/survey-campaign-actions.ts |
| `getWorkspaceBattlecardsAction` | `campaigns_marketing` | read | `L0_READ` | unmapped | — | — | — | src/lib/quick-notes-campaign-actions.ts |
| `getWorkspaceCampaignConceptsAction` | `campaigns_marketing` | read | `L0_READ` | unmapped | — | — | — | src/lib/quick-notes-campaign-actions.ts |
| `removeQRCodeFromCampaign` | `campaigns_marketing` | delete | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `organizations`, `qr_campaigns`, `qr_codes`, `workspaces` | src/lib/qr-campaign-actions.ts |
| `saveSystemDispatchGovernanceAction` | `campaigns_marketing` | update | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | `requireAuth` | — | `system_settings` | src/lib/surveys/survey-campaign-actions.ts |
| `synthesizeCampaignLearningsAction` | `campaigns_marketing` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/lib/quick-notes-campaign-actions.ts |
| `updateCampaignConceptStatusAction` | `campaigns_marketing` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/quick-notes-campaign-actions.ts |
| `updateQRCampaign` | `campaigns_marketing` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `organizations`, `qr_campaigns`, `workspaces` | src/lib/qr-campaign-actions.ts |
| `POST /api/automations/messages/bulk-resend` | `communication_messaging` | execute | `L2_STATE_MUTATION`* | unmapped | `isAuthorizedCloudTaskRequest` | — | `message_logs` | src/app/api/automations/messages/bulk-resend/route.ts |
| `GET /api/cron/messaging-status-sync` | `communication_messaging` | execute | `L2_STATE_MUTATION` | unmapped | `cronSecret` | — | — | src/app/api/cron/messaging-status-sync/route.ts |
| `POST /api/jobs/resend` | `communication_messaging` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `resend_jobs` | src/app/api/jobs/resend/route.ts |
| `POST /api/messaging/unsubscribe` | `communication_messaging` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/api/messaging/unsubscribe/route.ts |
| `POST /api/messaging/unsubscribe/one-click` | `communication_messaging` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/api/messaging/unsubscribe/one-click/route.ts |
| `POST /api/messaging/webhooks/resend` | `communication_messaging` | execute | `L2_STATE_MUTATION`* | unmapped | `webhookSignature` | — | — | src/app/api/messaging/webhooks/resend/route.ts |
| `POST /api/verify-email` | `communication_messaging` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/api/verify-email/route.ts |
| `POST /api/verify-email/bulk` | `communication_messaging` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/api/verify-email/bulk/route.ts |
| `GET /api/verify-email/cron` | `communication_messaging` | execute | `L2_STATE_MUTATION` | unmapped | `authenticateCronRequest` | — | — | src/app/api/verify-email/cron/route.ts |
| `POST /api/verify-email/trigger` | `communication_messaging` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/api/verify-email/trigger/route.ts |
| `POST /api/webhooks/email` | `communication_messaging` | execute | `L2_STATE_MUTATION`* | unmapped | `webhookSignature` | — | — | src/app/api/webhooks/email/route.ts |
| `POST /api/webhooks/messaging/resend` | `communication_messaging` | execute | `L2_STATE_MUTATION`* | unmapped | `webhookSignature` | — | `message_jobs`, `message_logs`, `tasks` | src/app/api/webhooks/messaging/resend/route.ts |
| `POST /api/webhooks/resend` | `communication_messaging` | execute | `L2_STATE_MUTATION`* | unmapped | `webhookSignature` | — | `resend_jobs` | src/app/api/webhooks/resend/route.ts |
| `GET /api/webhooks/whatsapp` | `communication_messaging` | read | `L0_READ` | unmapped | — | — | — | src/app/api/webhooks/whatsapp/route.ts |
| `POST /api/webhooks/whatsapp` | `communication_messaging` | execute | `L2_STATE_MUTATION`* | unmapped | `verifySignature`, `webhookSignature` | — | `message_logs`, `webhook_events`, `whatsapp_sessions` | src/app/api/webhooks/whatsapp/route.ts |
| `POST /api/whatsapp/upload-media` | `communication_messaging` | execute | `L2_STATE_MUTATION`* | unmapped | `requireOrgAdmin` | — | — | src/app/api/whatsapp/upload-media/route.ts |
| `adoptWhatsAppTemplate` | `communication_messaging` | execute | `L2_STATE_MUTATION`* | unmapped | `requireOrgAdmin` | — | — | src/lib/whatsapp-template-actions.ts |
| `bulkPushWhatsAppSkeletonsAction` | `communication_messaging` | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth`, `requireOrgAdmin` | — | `message_templates` | src/app/actions/bulk-push-whatsapp-skeletons-action.ts |
| `cancelScheduledEmailAction` | `communication_messaging` | execute | `L2_STATE_MUTATION` | unmapped | `requireOrganization` | — | `organizations` | src/lib/resend-actions.ts |
| `checkSenderIdStatusAction` | `communication_messaging` | read | `L0_READ` | unmapped | `requireOrganization` | — | `organizations` | src/lib/mnotify-actions.ts |
| `clearVariablesForSource` | `communication_messaging` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `messaging_variables` | src/lib/messaging-actions.ts |
| `connectWhatsAppViaOAuth` | `communication_messaging` | execute | `L2_STATE_MUTATION`* | unmapped | `requireOrgAdmin` | — | — | src/lib/whatsapp-actions.ts |
| `createWhatsAppTemplate` | `communication_messaging` | create | `L2_STATE_MUTATION` | unmapped | `requireOrgAdmin` | — | — | src/lib/whatsapp-template-actions.ts |
| `deleteScheduledMessageAction` | `communication_messaging` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireOrganization` | — | `organizations` | src/lib/mnotify-actions.ts |
| `deleteVariable` | `communication_messaging` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireAuth` | — | `app_fields` | src/lib/messaging-actions.ts |
| `disconnectWhatsApp` | `communication_messaging` | execute | `L2_STATE_MUTATION`* | unmapped | `requireOrgAdmin` | — | — | src/lib/whatsapp-actions.ts |
| `fetchContextualData` | `communication_messaging` | read | `L0_READ` | unmapped | `requireAuth` | — | `meetings`, `pdfs`, `responses`, `submissions`, `surveys` | src/lib/messaging-actions.ts |
| `fetchEmailStatusAction` | `communication_messaging` | read | `L0_READ` | wrap | `requireOrganization` | — | `organizations` | src/lib/resend-actions.ts |
| `fetchScheduledMessagesAction` | `communication_messaging` | read | `L0_READ` | unmapped | `requireOrganization` | — | `organizations` | src/lib/mnotify-actions.ts |
| `fetchSmsBalanceAction` | `communication_messaging` | read | `L0_READ` | unmapped | `requireOrganization` | — | `organizations` | src/lib/mnotify-actions.ts |
| `fetchSmsReportsAction` | `communication_messaging` | read | `L0_READ` | unmapped | `requireOrganization` | — | `organizations` | src/lib/mnotify-actions.ts |
| `fetchSmsStatusAction` | `communication_messaging` | read | `L0_READ` | wrap | `requireOrganization` | — | `organizations` | src/lib/mnotify-actions.ts |
| `fetchVerifiedDomainsAction` | `communication_messaging` | read | `L0_READ` | unmapped | `requireOrganization` | — | `organizations` | src/lib/resend-actions.ts |
| `forceDisconnectWhatsApp` | `communication_messaging` | execute | `L2_STATE_MUTATION`* | unmapped | `requireSystemAdmin` | — | — | src/lib/whatsapp-backoffice-actions.ts |
| `generateEmailTemplate` | `communication_messaging` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/generate-email-template-flow.ts |
| `generateSurveyMessaging` | `communication_messaging` | draft | `L1_INTERNAL_DRAFT` | extend | — | — | — | src/ai/flows/generate-survey-messaging-flow.ts |
| `generateSurveyMessagingFlow` | `communication_messaging` | draft | `L1_INTERNAL_DRAFT` | extend | — | — | — | src/ai/flows/generate-survey-messaging-flow.ts |
| `generateSurveyMessagingTemplatesAction` | `communication_messaging` | draft | `L1_INTERNAL_DRAFT` | wrap | `canUser`, `requireAuth` | `canUser:edit`, `canUser:operations`, `canUser:templates` | `message_templates` | src/lib/survey-ai-messaging-actions.ts |
| `getMessagingDeliveryMetricsAction` | `communication_messaging` | read | `L0_READ` | unmapped | — | — | `organizations` | src/lib/backoffice/backoffice-messaging-observatory-actions.ts |
| `getSimulationVariablesAction` | `communication_messaging` | read | `L0_READ` | unmapped | `requireAuth` | — | `app_fields`, `contracts`, `meetings`, `organizations`, `pdfs`, `responses`, `submissions`, `surveys`, `tags`, `workspace_entities`, `workspaces` | src/lib/messaging-actions.ts |
| `getWhatsAppConnection` | `communication_messaging` | read | `L0_READ` | unmapped | `requireOrgAdmin` | — | — | src/lib/whatsapp-actions.ts |
| `listAllWhatsAppConnections` | `communication_messaging` | read | `L0_READ` | unmapped | `requireSystemAdmin` | — | — | src/lib/whatsapp-backoffice-actions.ts |
| `listSuppressionRecordsAction` | `communication_messaging` | read | `L0_READ` | unmapped | — | — | `suppression_list` | src/lib/backoffice/backoffice-messaging-observatory-actions.ts |
| `listWebhookDeadLettersAction` | `communication_messaging` | read | `L0_READ` | unmapped | — | — | `webhook_dead_letters` | src/lib/backoffice/backoffice-messaging-observatory-actions.ts |
| `listWhatsAppTemplates` | `communication_messaging` | read | `L0_READ` | unmapped | `requireOrgAdmin` | — | — | src/lib/whatsapp-template-actions.ts |
| `MessageTrackingService` | `communication_messaging` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `message_node_stats`, `message_tracking` | src/lib/services/message-tracking-service.ts |
| `previewCampaignAudience` | `communication_messaging` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | `automation_runs`, `deals`, `entities`, `message_audiences`, `tags`, `verification_cache`, `workspace_entities` | src/lib/messaging-actions.ts |
| `quickSaveSurveyTemplateAction` | `communication_messaging` | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireAuth` | `canUser:edit`, `canUser:operations`, `canUser:templates` | `message_templates` | src/lib/survey-ai-messaging-actions.ts |
| `registerSenderIdAction` | `communication_messaging` | create | `L2_STATE_MUTATION` | unmapped | `requireOrganization` | — | `organizations` | src/lib/mnotify-actions.ts |
| `registerSkeletonWhatsAppAction` | `communication_messaging` | create | `L2_STATE_MUTATION` | unmapped | `requireAuth`, `requireOrgAdmin` | — | `message_templates` | src/app/actions/register-skeleton-whatsapp-action.ts |
| `replayWebhookDeadLetterAction` | `communication_messaging` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `webhook_dead_letters` | src/lib/backoffice/backoffice-messaging-observatory-actions.ts |
| `ResendJobService` | `communication_messaging` | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | — | — | `resend_jobs` | src/lib/services/resend-job-service.ts |
| `resolveRecipientContacts` | `communication_messaging` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/lib/messaging-actions.ts |
| `resolveTagVariables` | `communication_messaging` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | `tags`, `workspace_entities` | src/lib/messaging-actions.ts |
| `rotateWhatsAppToken` | `communication_messaging` | execute | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireOrgAdmin` | — | — | src/lib/whatsapp-actions.ts |
| `saveWhatsAppConnection` | `communication_messaging` | update | `L2_STATE_MUTATION` | unmapped | `requireOrgAdmin` | — | — | src/lib/whatsapp-actions.ts |
| `SenderProfileService` | `communication_messaging` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/sender-profile-service.ts |
| `sendWhatsAppTestMessage` | `communication_messaging` | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | `requireOrgAdmin` | — | — | src/lib/whatsapp-template-actions.ts |
| `syncAllLogStatuses` | `communication_messaging` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `message_logs` | src/lib/messaging-actions.ts |
| `syncVariableRegistry` | `communication_messaging` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `app_fields`, `field_groups`, `pdfs`, `surveys` | src/lib/messaging-actions.ts |
| `syncWhatsAppTemplates` | `communication_messaging` | update | `L2_STATE_MUTATION` | unmapped | `requireOrgAdmin` | — | — | src/lib/whatsapp-template-actions.ts |
| `testWhatsAppConnection` | `communication_messaging` | execute | `L2_STATE_MUTATION`* | unmapped | `requireOrgAdmin` | — | — | src/lib/whatsapp-actions.ts |
| `updateEntityLastContactedAt` | `communication_messaging` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `workspace_entities` | src/lib/messaging-actions.ts |
| `updateScheduledMessageAction` | `communication_messaging` | update | `L2_STATE_MUTATION` | unmapped | `requireOrganization` | — | `organizations` | src/lib/mnotify-actions.ts |
| `updateVariableVisibility` | `communication_messaging` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `app_fields` | src/lib/messaging-actions.ts |
| `upsertConstantVariable` | `communication_messaging` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `app_fields` | src/lib/messaging-actions.ts |
| `GET /api/activities` | `crm_contacts`* | read | `L0_READ` | unmapped | `authenticateApiRequest` | — | — | src/app/api/activities/route.ts |
| `POST /api/activities` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `authenticateApiRequest` | — | — | src/app/api/activities/route.ts |
| `GET /api/admin/backfill-document-cta` | `crm_contacts`* | read | `L0_READ` | unmapped | `authenticateApiRequest` | — | — | src/app/api/admin/backfill-document-cta/route.ts |
| `POST /api/admin/backfill-document-cta` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `authenticateApiRequest` | — | — | src/app/api/admin/backfill-document-cta/route.ts |
| `POST /api/contacts` | `crm_contacts` | execute | `L2_STATE_MUTATION`* | unmapped | `authenticateApiRequest` | — | — | src/app/api/contacts/route.ts |
| `GET /api/contacts/[entityId]` | `crm_contacts` | read | `L0_READ` | unmapped | `authenticateApiRequest` | — | `entities`, `workspace_entities` | src/app/api/contacts/[entityId]/route.ts |
| `PATCH /api/contacts/[entityId]` | `crm_contacts` | update | `L2_STATE_MUTATION` | unmapped | `authenticateApiRequest` | — | `entities`, `workspace_entities` | src/app/api/contacts/[entityId]/route.ts |
| `GET /api/cron/process-scheduled-messages` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | `cronSecret` | — | — | src/app/api/cron/process-scheduled-messages/route.ts |
| `POST /api/cron/process-scheduled-messages` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `cronSecret` | — | — | src/app/api/cron/process-scheduled-messages/route.ts |
| `GET /api/cron/social-publisher` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | `authenticateCronRequest` | — | `auditLogs`, `socialAccounts`, `socialPosts` | src/app/api/cron/social-publisher/route.ts |
| `GET /api/diagnostic` | `crm_contacts`* | read | `L0_READ` | unmapped | `authenticateApiRequest` | — | `automation_jobs`, `automation_runs` | src/app/api/diagnostic/route.ts |
| `POST /api/documents/events` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/api/documents/events/route.ts |
| `POST /api/documents/process` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/api/documents/process/route.ts |
| `POST /api/external/v1/entities` | `crm_contacts` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `api_keys` | src/app/api/external/v1/entities/route.ts |
| `GET /api/l/[linkId]` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/app/api/l/[linkId]/route.ts |
| `OPTIONS /api/mcp` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/api/mcp/route.ts |
| `POST /api/mcp` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `authenticateApiRequest` | — | — | src/app/api/mcp/route.ts |
| `GET /api/mcp/sse` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/app/api/mcp/sse/route.ts |
| `GET /api/migration/alerts` | `crm_contacts`* | read | `L0_READ` | unmapped | `authenticateApiRequest` | — | — | src/app/api/migration/alerts/route.ts |
| `POST /api/migration/alerts` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `authenticateApiRequest` | — | — | src/app/api/migration/alerts/route.ts |
| `POST /api/migration/cleanup` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `authenticateApiRequest` | — | — | src/app/api/migration/cleanup/route.ts |
| `GET /api/migration/export` | `crm_contacts`* | read | `L0_READ` | unmapped | `authenticateApiRequest` | — | — | src/app/api/migration/export/route.ts |
| `POST /api/migration/log-operation-complete` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `authenticateApiRequest` | — | — | src/app/api/migration/log-operation-complete/route.ts |
| `POST /api/migration/log-operation-failed` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `authenticateApiRequest` | — | — | src/app/api/migration/log-operation-failed/route.ts |
| `POST /api/migration/log-operation-start` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `authenticateApiRequest` | — | — | src/app/api/migration/log-operation-start/route.ts |
| `GET /api/migration/logs` | `crm_contacts`* | read | `L0_READ` | unmapped | `authenticateApiRequest` | — | — | src/app/api/migration/logs/route.ts |
| `GET /api/pdfs/[pdfId]/generate/[submissionId]` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `pdfs`, `submissions` | src/app/api/pdfs/[pdfId]/generate/[submissionId]/route.ts |
| `POST /api/pdfs/submit` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `contracts`, `pdfs`, `submissions` | src/app/api/pdfs/submit/route.ts |
| `GET /api/sentry-example-api` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/app/api/sentry-example-api/route.ts |
| `POST /api/verify-phone` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/api/verify-phone/route.ts |
| `POST /api/verify-phone/bulk` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/api/verify-phone/bulk/route.ts |
| `GET /api/verify-phone/cron` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | `authenticateCronRequest` | — | `organizations` | src/app/api/verify-phone/cron/route.ts |
| `acquireBookingHoldAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `booking_holds`, `bookings`, `event_types` | src/app/actions/booking-actions.ts |
| `ActionExecutionDrawer` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/admin/my-day/components/ActionExecutionDrawer.tsx |
| `ActionTargetModal` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/admin/pages/[id]/builder/components/ActionTargetModal.tsx |
| `activateTemplate` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | `message_templates`, `template_audit_logs` | src/lib/template-actions.ts |
| `AdaptiveConditionEvaluator` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/onboarding/adaptive-condition-evaluator.ts |
| `addCanvasPinCommentAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `creative_comments` | src/app/actions/creative-collab-actions.ts |
| `addCommentReplyAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `creative_comments` | src/app/actions/creative-collab-actions.ts |
| `addProjectCommentAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `creative_comments` | src/app/actions/creative-comment-actions.ts |
| `addTenantIssueNoteAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `tenant_issues` | src/lib/backoffice/backoffice-health-actions.ts |
| `adjudicateRecommendationAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | `users` | src/lib/intelligence/actions/intelligence-actions.ts |
| `adminOverrideStepAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/onboarding-actions.ts |
| `admitNextVisitorAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | `office_hours_queue`, `office_hours_rooms` | src/app/actions/office-hours-actions.ts |
| `advanceOnboardingStepAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/actions/engagement-actions.ts |
| `AgreementSequenceService` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `system_counters` | src/lib/services/agreement-sequence-service.ts |
| `AiIdentityContextResolver` | `crm_contacts` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/ai/ai-identity-context-resolver.ts |
| `analyzeHeadline` | `crm_contacts`* | analyze | `L0_READ` | unmapped | — | — | — | src/lib/services/headline-iq.ts |
| `applyAiRecommendedHotspotAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `document_layers`, `document_pages`, `documents` | src/lib/documents/ai-document-actions.ts |
| `applyTagAction` | `crm_contacts` | update | `L2_STATE_MUTATION` | unmapped | — | — | `entities`, `tags`, `workspace_entities` | src/lib/scoped-tag-actions.ts |
| `applyTagsAction` | `crm_contacts` | update | `L2_STATE_MUTATION` | unmapped | — | — | `tag_audit_logs`, `tags`, `workspace_entities` | src/lib/tag-actions.ts |
| `approveCreativeProjectAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | — | — | `creative_projects`, `creative_reviews` | src/app/actions/creative-collab-actions.ts |
| `archiveContentItemAction` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/app/actions/content-actions.ts |
| `archiveDocumentVersionAction` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireWorkspace` | — | `document_versions` | src/lib/documents/document-version-actions.ts |
| `archivePerspectiveAction` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireAuth` | — | `perspectives` | src/lib/perspective-actions.ts |
| `archiveTemplate` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireAuth` | — | `message_templates`, `template_audit_logs` | src/lib/template-actions.ts |
| `askDocumentQuestionAction` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireWorkspace` | — | `document_pages`, `documents` | src/lib/documents/ai-document-actions.ts |
| `assignCaseAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:finance`, `canUser:invoices` | — | src/lib/collection-actions.ts |
| `assignCoachingDrillAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `coachingProfiles` | src/app/actions/conversation-coaching-actions.ts |
| `attachReplayToCourseLessonAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/actions/event-actions.ts |
| `auditWorkspaceSecurityPostureAction` | `crm_contacts`* | analyze | `L0_READ` | unmapped | `requireWorkspace` | — | `documents` | src/lib/documents/enterprise-security-actions.ts |
| `awardContactScoreAction` | `crm_contacts` | analyze | `L0_READ` | unmapped | `requireWorkspace` | — | — | src/lib/documents/crm-actions.ts |
| `backfillSenderOrgAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `requireSystemAdmin` | — | — | src/app/actions/backfill-sender-org-action.ts |
| `buildOrgFooterVars` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | extend | — | — | — | src/lib/services/org-footer-service.ts |
| `BulkActionDock` | `crm_contacts` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/admin/entities/components/BulkActionDock.tsx |
| `bulkApplyTagsAction` | `crm_contacts` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `tag_audit_logs`, `tags`, `workspace_entities` | src/lib/tag-actions.ts |
| `bulkAssignJourneyAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/onboarding-actions.ts |
| `bulkDeleteUnusedTagsAction` | `crm_contacts` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireWorkspace` | — | `tag_audit_logs`, `tags` | src/lib/tag-actions.ts |
| `bulkRemoveTagsAction` | `crm_contacts` | delete | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `tag_audit_logs`, `tags`, `workspace_entities` | src/lib/tag-actions.ts |
| `cancelBookingAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | — | — | `bookings`, `meetings` | src/app/actions/booking-actions.ts |
| `cancelEventRegistrationAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/event-actions.ts |
| `cancelJob` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | — | — | `platform_jobs` | src/lib/backoffice/backoffice-job-actions.ts |
| `cancelMessageAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | — | src/app/actions/scheduled-message-actions.ts |
| `cancelRecurringSeriesAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `recurring_series` | src/app/actions/recurring-series-actions.ts |
| `cancelSupervisorMissionAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | `users` | src/lib/supervisor/actions/supervisor-actions.ts |
| `CanvasElementSchema` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/schemas.ts |
| `challengeIdeaAssumptionsFlow` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/challenge-idea-assumptions-flow.ts |
| `challengeIdeaAssumptionsInputSchema` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/challenge-idea-assumptions-flow.ts |
| `challengeIdeaAssumptionsOutputSchema` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/challenge-idea-assumptions-flow.ts |
| `checkDocumentPermissionAction` | `crm_contacts`* | read | `L0_READ` | wrap | `requireWorkspace`, `verifyDocumentPermission` | — | — | src/lib/documents/enterprise-security-actions.ts |
| `checkSignupDuplicatesAction` | `crm_contacts`* | read | `L0_READ` | wrap | `requireAuth` | — | `workspace_entities` | src/lib/signup-conflict-actions.ts |
| `cleanupEntityCustomData` | `crm_contacts` | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | `entities` | src/app/actions/cleanup-entity-customdata-action.ts |
| `clearAllImportLogsAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `import_logs` | src/app/actions/clear-import-logs-action.ts |
| `clearAutomationData` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/backoffice/backoffice-job-actions.ts |
| `clearOrganizationActivityLogs` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | `organizations` | src/lib/backoffice/backoffice-org-actions.ts |
| `clearWorkspaceDefaultSenderAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireOrgAdmin`, `requireWorkspace` | — | `workspaces` | src/app/actions/set-default-sender-action.ts |
| `clonePdfForm` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `pdfs` | src/lib/pdf-actions.ts |
| `CohortService` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `cohort_members`, `course_cohorts` | src/lib/services/cohort-service.ts |
| `CollectionActivityService` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `collection_activities` | src/lib/services/collection-activity-service.ts |
| `CollectionCaseSequenceService` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `system_counters` | src/lib/services/collection-case-sequence-service.ts |
| `CollectionCaseService` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `collection_cases`, `financial_accounts`, `invoices` | src/lib/services/collection-case-service.ts |
| `completeOrganizationOnboardingAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `organizations`, `users`, `workspaces` | src/app/actions/onboarding-actions.ts |
| `completeTaskAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | extend | — | — | — | src/app/actions/engagement-actions.ts |
| `confirmAIScheduledBookingAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | `meetings` | src/app/actions/ai-scheduling-actions.ts |
| `consolidateMemoriesDeterministic` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/consolidate-memories-flow.ts |
| `consolidateMemoriesFlow` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/consolidate-memories-flow.ts |
| `consolidateMemoriesInputSchema` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/consolidate-memories-flow.ts |
| `consolidateMemoriesOutputSchema` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/consolidate-memories-flow.ts |
| `ContentService` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `versions` | src/lib/services/content-service.ts |
| `contextDossierInputSchema` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/generate-context-dossier-flow.ts |
| `contextDossierOutputSchema` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/generate-context-dossier-flow.ts |
| `convertToOnboardingAction` | `crm_contacts` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `onboardingStages`, `workspace_entities` | src/lib/entity-actions.ts |
| `createAgreementAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireAuth` | `canUser:create`, `canUser:finance`, `canUser:invoices` | `billing_agreements` | src/lib/agreement-actions.ts |
| `createAvailabilityProfileAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `availability_profiles` | src/app/actions/availability-actions.ts |
| `createBookingFromHoldAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `booking_holds`, `bookings`, `event_types`, `meetings` | src/app/actions/booking-actions.ts |
| `createCampaign` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `campaigns` | src/lib/marketing-actions.ts |
| `createChangeSetAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `ai_change_sets`, `campaign_pages` | src/lib/ai-change-set-actions.ts |
| `createClientReport` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `clientReports` | src/lib/marketing-actions.ts |
| `createCohortAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/event-actions.ts |
| `createConflictCheck` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `conflictChecks` | src/lib/law-actions.ts |
| `createConsultation` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `consultations` | src/lib/law-actions.ts |
| `createContentItemAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/content-actions.ts |
| `createCourtDate` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `courtDates` | src/lib/law-actions.ts |
| `createCreativeExperimentAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `creative_documents`, `creative_experiments` | src/app/actions/creative-experiment-actions.ts |
| `createCreativeProjectAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `creative_documents`, `creative_projects` | src/app/actions/creative-project-actions.ts |
| `createDeal` | `crm_contacts`* | create | `L2_STATE_MUTATION` | extend | — | — | `deals` | src/lib/real-estate-actions.ts |
| `createDeliverable` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `deliverables` | src/lib/marketing-actions.ts |
| `createDiscovery` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `discoveries` | src/lib/consultancy-actions.ts |
| `createDocumentAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `access_policies`, `document_pages`, `document_sources`, `document_versions`, `documents`, `flipbook_pages`, `flipbooks`, `viewer_experiences` | src/lib/document-actions.ts |
| `createDocumentDistributionAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `document_distributions` | src/lib/documents/distribution-actions.ts |
| `createDocumentVersionAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `document_pages`, `document_versions`, `documents` | src/lib/documents/document-version-actions.ts |
| `createEngagement` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `engagements` | src/lib/consultancy-actions.ts |
| `createEntityAction` | `crm_contacts` | create | `L2_STATE_MUTATION` | wrap | `canUser`, `requireWorkspace` | `canUser:campuses`, `canUser:create`, `canUser:operations` | `entities`, `organizations`, `workspace_entities`, `workspaces` | src/lib/entity-actions.ts |
| `createEventTypeAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `event_types` | src/app/actions/event-type-actions.ts |
| `createFieldAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `canUser` | `canUser:create`, `canUser:fields`, `canUser:management` | `app_fields` | src/lib/fields-actions.ts |
| `createFieldGroupAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `canUser` | `canUser:create`, `canUser:fields`, `canUser:management` | `field_groups` | src/lib/fields-actions.ts |
| `createFlipbookAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/flipbook-actions.ts |
| `createGlobalTemplate` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `message_templates` | src/lib/template-actions.ts |
| `createHealthScore` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `healthScores` | src/lib/saas-actions.ts |
| `createHierarchyNodeAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/enterprise-actions.ts |
| `createImpersonationSessionAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/backoffice/backoffice-health-actions.ts |
| `createIntakeForm` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `intakeForms` | src/lib/law-actions.ts |
| `createJob` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `platform_jobs` | src/lib/backoffice/backoffice-job-actions.ts |
| `createLegalDocument` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `legalDocuments` | src/lib/law-actions.ts |
| `createLiveEventAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/event-actions.ts |
| `createMatter` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `matters` | src/lib/law-actions.ts |
| `createMilestone` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `milestones` | src/lib/consultancy-actions.ts |
| `createNegotiation` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `negotiations` | src/lib/real-estate-actions.ts |
| `createOffer` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `offers` | src/lib/real-estate-actions.ts |
| `createOnboarding` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `onboarding` | src/lib/saas-actions.ts |
| `createOrganizationFromBackofficeAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `organizations` | src/lib/backoffice/backoffice-org-actions.ts |
| `createOrgOverride` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `message_templates` | src/lib/template-actions.ts |
| `createOrUpdateCollectionCaseAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:finance`, `canUser:invoices` | — | src/lib/collection-actions.ts |
| `createOrUpdateConferenceSessionAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `conference_sessions`, `meetings` | src/app/actions/conference-session-actions.ts |
| `createOrUpdateJourneyAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/onboarding-actions.ts |
| `createOutcome` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `outcomes` | src/lib/consultancy-actions.ts |
| `createPaymentPlanAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:finance`, `canUser:invoices` | — | src/lib/collection-actions.ts |
| `createPdfForm` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `media`, `pdfs` | src/lib/pdf-actions.ts |
| `createPortalContentTemplateAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/content-actions.ts |
| `createPriceBookAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:create`, `canUser:operations`, `canUser:pipeline` | `price_books` | src/app/actions/product-actions.ts |
| `createPricingPlanAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:create`, `canUser:finance`, `canUser:invoices` | `finance_pricing_plans` | src/lib/product-actions.ts |
| `createProductAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:create`, `canUser:operations`, `canUser:pipeline` | `products` | src/app/actions/product-actions.ts |
| `createProductAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireAuth` | `canUser:create`, `canUser:finance`, `canUser:invoices` | `finance_products` | src/lib/product-actions.ts |
| `createProductCategoryAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:create`, `canUser:operations`, `canUser:pipeline` | `product_categories` | src/app/actions/product-actions.ts |
| `createProjectFromTemplateAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `creative_documents`, `creative_projects`, `creative_templates` | src/app/actions/creative-template-actions.ts |
| `createProperty` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `properties` | src/lib/real-estate-actions.ts |
| `createPropertyDocument` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `propertyDocuments` | src/lib/real-estate-actions.ts |
| `createPropertyPreference` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `propertyPreferences` | src/lib/real-estate-actions.ts |
| `createProposal` | `crm_contacts`* | create | `L2_STATE_MUTATION` | extend | — | — | `proposals` | src/lib/marketing-actions.ts |
| `createRecurringSeriesAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `recurring_series` | src/app/actions/recurring-series-actions.ts |
| `createRelatedParty` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `relatedParties` | src/lib/law-actions.ts |
| `createRetainer` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `retainers` | src/lib/consultancy-actions.ts |
| `createSettings` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `settings` | src/lib/settings-actions.ts |
| `createSocialPostAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `socialPosts` | src/app/actions/social-composer-actions.ts |
| `createStrategyDoc` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `strategyDocs` | src/lib/marketing-actions.ts |
| `createSubscription` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `subscriptions` | src/lib/saas-actions.ts |
| `createSupportTicket` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `supportTickets` | src/lib/saas-actions.ts |
| `createTagAction` | `crm_contacts` | create | `L2_STATE_MUTATION` | unmapped | — | — | `tag_audit_logs`, `tags` | src/lib/tag-actions.ts |
| `createTaskAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | extend | — | — | — | src/app/actions/engagement-actions.ts |
| `createTemplateAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `platform_templates` | src/lib/backoffice/backoffice-template-actions.ts |
| `createTimeEntry` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `timeTracking` | src/lib/law-actions.ts |
| `createTrial` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `trials` | src/lib/saas-actions.ts |
| `createVersionSnapshotAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `creative_documents`, `creative_versions` | src/app/actions/creative-project-actions.ts |
| `createViewing` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `viewings` | src/lib/real-estate-actions.ts |
| `decomposeGoalDeterministic` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/decompose-supervisor-goal-flow.ts |
| `decomposeGoalInputSchema` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/decompose-supervisor-goal-flow.ts |
| `decomposeGoalOutputSchema` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/decompose-supervisor-goal-flow.ts |
| `decomposeIdeaCanvasFlow` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/decompose-idea-canvas-flow.ts |
| `decomposeIdeaCanvasInputSchema` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/decompose-idea-canvas-flow.ts |
| `decomposeIdeaCanvasOutputSchema` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/decompose-idea-canvas-flow.ts |
| `decomposeSupervisorGoalFlow` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/decompose-supervisor-goal-flow.ts |
| `decryptRecipientAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | `contacts`, `workspace_entities` | src/app/actions/recipient-tracking-actions.ts |
| `DEFAULT_ORG_FOOTER_HTML` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/org-footer-service.ts |
| `DEFAULT_ORG_STYLE_WRAPPER` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/style-resolver.ts |
| `deleteAvailabilityProfileAction` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireAuth` | — | `availability_profiles` | src/app/actions/availability-actions.ts |
| `deleteCohortAction` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/app/actions/event-actions.ts |
| `deleteContentItemAction` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/app/actions/content-actions.ts |
| `deleteContractAction` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `canUser`, `requireAuth` | `canUser:agreements`, `canUser:delete`, `canUser:finance` | `contracts`, `pdfs`, `submissions` | src/lib/contract-actions.ts |
| `deleteCreativeProjectAction` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireWorkspace` | — | `creative_documents`, `creative_projects`, `thumbnail_designs` | src/app/actions/creative-project-actions.ts |
| `deleteDocumentAction` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireWorkspace` | — | `document_pages`, `documents`, `flipbook_pages`, `flipbooks` | src/lib/document-actions.ts |
| `deleteDocumentPageAction` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireWorkspace` | — | `document_pages`, `documents`, `flipbook_pages`, `flipbooks` | src/lib/documents/document-page-actions.ts |
| `deleteEventTypeAction` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | `event_types` | src/app/actions/event-type-actions.ts |
| `deleteFieldAction` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `canUser`, `requireAuth` | `canUser:delete`, `canUser:fields`, `canUser:management` | `app_fields`, `forms` | src/lib/fields-actions.ts |
| `deleteFieldGroupAction` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `canUser`, `requireAuth` | `canUser:delete`, `canUser:fields`, `canUser:management` | `app_fields`, `field_groups` | src/lib/fields-actions.ts |
| `deleteFlipbookAction` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/lib/flipbook-actions.ts |
| `deleteGlobalTemplate` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireAuth` | — | `message_templates`, `scheduled_messages` | src/lib/template-actions.ts |
| `deleteJourneyAction` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/onboarding-actions.ts |
| `deleteLiveEventAction` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/app/actions/event-actions.ts |
| `deleteNote` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireAuth` | — | `activities` | src/lib/activity-actions.ts |
| `deletePageAction` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireAuth` | — | `campaign_page_versions`, `campaign_pages` | src/lib/page-actions.ts |
| `deletePdfForm` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireAuth` | — | `pdfs` | src/lib/pdf-actions.ts |
| `deletePerspectiveAction` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireAuth` | — | `activities`, `perspectives`, `pipelines`, `schools`, `tasks` | src/lib/perspective-actions.ts |
| `deletePlatformIndustryFieldGroup` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | `platform_industry_field_groups` | src/lib/backoffice/backoffice-field-actions.ts |
| `deletePriceBookAction` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `canUser`, `requireWorkspace` | `canUser:delete`, `canUser:operations`, `canUser:pipeline` | `price_books` | src/app/actions/product-actions.ts |
| `deleteProductAction` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `canUser`, `requireWorkspace` | `canUser:delete`, `canUser:operations`, `canUser:pipeline` | `products` | src/app/actions/product-actions.ts |
| `deleteProductCategoryAction` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `canUser`, `requireWorkspace` | `canUser:delete`, `canUser:operations`, `canUser:pipeline` | `product_categories` | src/app/actions/product-actions.ts |
| `deleteProjectCommentAction` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireAuth` | — | `creative_comments` | src/app/actions/creative-comment-actions.ts |
| `deleteSubmissions` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireAuth` | — | `pdfs`, `submissions` | src/lib/pdf-actions.ts |
| `deleteTagAction` | `crm_contacts` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireAuth` | — | `entities`, `tag_audit_logs`, `tags`, `workspace_entities` | src/lib/tag-actions.ts |
| `deleteTaskAction` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/app/actions/engagement-actions.ts |
| `deleteTemplateAction` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | `platform_templates` | src/lib/backoffice/backoffice-template-actions.ts |
| `deprecateTemplate` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `platform_templates` | src/lib/backoffice/backoffice-template-actions.ts |
| `DesignSchemeSchema` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/schemas.ts |
| `detectContradictionsFlow` | `crm_contacts`* | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/detect-contradictions-flow.ts |
| `detectContradictionsInputSchema` | `crm_contacts`* | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/detect-contradictions-flow.ts |
| `detectContradictionsOutputSchema` | `crm_contacts`* | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/detect-contradictions-flow.ts |
| `detectDuplicatesFlow` | `crm_contacts`* | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/detect-duplicates-flow.ts |
| `detectDuplicatesInputSchema` | `crm_contacts`* | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/detect-duplicates-flow.ts |
| `detectDuplicatesOutputSchema` | `crm_contacts`* | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/detect-duplicates-flow.ts |
| `detectPdfFields` | `crm_contacts`* | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/detect-pdf-fields-flow.ts |
| `developIdeaFlow` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/develop-idea-flow.ts |
| `developIdeaInputSchema` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/develop-idea-flow.ts |
| `developIdeaOutputSchema` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/develop-idea-flow.ts |
| `discardContentStudioDraftAction` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/app/actions/draft-actions.ts |
| `dismissInsightAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `page_insights` | src/lib/insight-actions.ts |
| `duplicateDocumentPageAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `document_pages`, `documents`, `flipbook_pages`, `flipbooks` | src/lib/documents/document-page-actions.ts |
| `duplicateEventTypeAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `event_types` | src/app/actions/event-type-actions.ts |
| `duplicatePageAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `campaign_page_versions`, `campaign_pages` | src/lib/page-actions.ts |
| `enforceSuperAdminProfileAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `system_config`, `users` | src/app/actions/onboarding-actions.ts |
| `EngagementService` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `community_posts`, `learning_progress`, `member_engagement_profiles`, `member_onboarding_progress`, `member_tasks`, `onboarding_flows`, `portal_member_activities`, `portal_memberships`, `task_submissions` | src/lib/services/engagement-service.ts |
| `enrichEntitiesWithNewSchema` | `crm_contacts` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `entities` | src/app/actions/entity-schema-restructure-actions.ts |
| `enrichSchoolsWithSaaSIndustry` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | `entities`, `subscriptionPackages` | src/app/actions/industry-migration-actions.ts |
| `enrollCohortMemberAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/actions/event-actions.ts |
| `EnrollmentService` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `course_enrollments`, `courses`, `portal_memberships` | src/lib/services/enrollment-service.ts |
| `ensureOrgDefaultStyleAdmin` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `message_styles` | src/lib/services/style-resolver-server.ts |
| `EnterpriseIdpService` | `crm_contacts` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/enterprise-identity/enterprise-idp-service.ts |
| `EnterpriseService` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `enterprise_audit_logs`, `enterprise_sso_configs`, `enterprise_whitelabel_configs`, `marketplace_listings`, `org_hierarchy_nodes` | src/lib/services/enterprise-service.ts |
| `EnterpriseSessionService` | `crm_contacts` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/enterprise-identity/enterprise-session-service.ts |
| `entityResolutionMatchSchema` | `crm_contacts` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/resolve-entities-flow.ts |
| `entityResolutionOutputSchema` | `crm_contacts` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/resolve-entities-flow.ts |
| `entitySummarySchema` | `crm_contacts` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/entity-summarizer.ts |
| `evaluatePortalInactivityAction` | `crm_contacts`* | analyze | `L0_READ` | unmapped | — | — | — | src/app/actions/engagement-actions.ts |
| `evaluatePromisesAction` | `crm_contacts`* | analyze | `L0_READ` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:finance`, `canUser:invoices` | — | src/lib/collection-actions.ts |
| `EventService` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `course_cohorts`, `course_lessons`, `event_registrations`, `live_events`, `portal_memberships` | src/lib/services/event-service.ts |
| `executeAiCanvasCommandAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/creative-ai-actions.ts |
| `executeCryptographicDeletionAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | `users` | src/lib/intelligence/actions/intelligence-actions.ts |
| `executeFinanceMigrationAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | `canUser` | `canUser:edit`, `canUser:finance`, `canUser:settings` | — | src/lib/migration-actions.ts |
| `executeImportBatch` | `crm_contacts` | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `districts`, `organizations`, `workspaces` | src/lib/import-export/entity-import-actions.ts |
| `executeJointProposalAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | wrap | `requireWorkspace` | — | — | src/lib/agents/actions/domain-agent-actions.ts |
| `executeLayerActionServerAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | — | — | `contacts` | src/lib/documents/interactive-layer-actions.ts |
| `executeManagerInterventionAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `deals`, `effortEvents`, `managerInterventions`, `tasks` | src/app/actions/manager-command-actions.ts |
| `executeProposedActionAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | `users` | src/lib/supervisor/actions/supervisor-actions.ts |
| `executePurgeFocalPersonsFerAction` | `crm_contacts` | execute | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | `entities`, `system_migrations` | src/app/actions/purge-focal-persons-fer-action.ts |
| `executePurgeLegacyFieldsFerAction` | `crm_contacts`* | execute | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | `app_fields`, `field_groups`, `system_migrations`, `workspaces` | src/app/actions/purge-legacy-fields-fer-action.ts |
| `executeRecurringBillingAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:create`, `canUser:finance`, `canUser:invoices` | — | src/lib/agreement-actions.ts |
| `executeSelfHealingAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | `users` | src/lib/intelligence/actions/intelligence-actions.ts |
| `executeStripAccountStatusFerAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | — | — | `entities`, `system_migrations` | src/app/actions/strip-account-status-fer-action.ts |
| `executeStripLifecycleStatusFerAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | — | — | `entities`, `system_migrations`, `workspace_entities` | src/app/actions/strip-lifecycle-status-fer-action.ts |
| `executeTagAction` | `crm_contacts` | execute | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/tag-action-executor.ts |
| `executeTemplateIdentifiersFerAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | — | — | `message_templates`, `system_migrations` | src/app/actions/template-identifiers-fer-action.ts |
| `executeUnexpireImportPayloadsFerAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | — | — | `import_logs`, `system_migrations` | src/app/actions/unexpire-import-payloads-fer-action.ts |
| `executeVariablesFERMigrationAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/execute-variables-fer-migration-action.ts |
| `exportEntitiesToCSVAction` | `crm_contacts` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `entities`, `workspace_entities` | src/lib/import-export/entity-export-actions.ts |
| `extractMemories` | `crm_contacts`* | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/extract-memories-flow.ts |
| `extractMemoriesFlow` | `crm_contacts`* | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/extract-memories-flow.ts |
| `extractMemoriesInputSchema` | `crm_contacts`* | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/extract-memories-flow.ts |
| `extractMemoriesOutputSchema` | `crm_contacts`* | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/extract-memories-flow.ts |
| `fetchBanditPolicyAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireAuth` | — | `bandit_policies` | src/lib/bandit-actions.ts |
| `fetchCampaignOrchestrationsAction` | `crm_contacts`* | read | `L0_READ` | wrap | `requireAuth` | — | `campaign_orchestrations` | src/lib/orchestration-actions.ts |
| `fetchEntitiesForSchemaRestructure` | `crm_contacts` | read | `L0_READ` | unmapped | `requireAuth` | — | `entities` | src/app/actions/entity-schema-restructure-actions.ts |
| `fetchEntitiesWithCustomData` | `crm_contacts` | read | `L0_READ` | unmapped | `requireAuth` | — | `entities` | src/app/actions/cleanup-entity-customdata-action.ts |
| `fetchOutdatedCampaignPages` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireAuth` | — | `page_versions` | src/app/actions/migrate-legacy-testimonials-action.ts |
| `fetchPageChangeSetsAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireAuth` | — | `ai_change_sets` | src/lib/ai-change-set-actions.ts |
| `fetchPageExperimentsAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireAuth` | — | `experiments` | src/lib/experiment-actions.ts |
| `fetchPageInsightsAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireAuth` | — | `page_insights` | src/lib/insight-actions.ts |
| `fetchPlatformObservabilityAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireAuth` | — | `custom_pages` | src/lib/observability-actions.ts |
| `fetchSchoolsForSaaSMigration` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `entities` | src/app/actions/industry-migration-actions.ts |
| `FieldsVariablesService` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `app_fields`, `contacts`, `contracts`, `entities`, `field_groups`, `meetings`, `organizations`, `pdfs`, `registrants`, `responses`, `submissions`, `surveys`, `template_variables`, `users`, `workspace_entities`, `workspaces` | src/lib/services/fields-variables-service-impl.ts |
| `finalizeAgreementAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `contracts`, `pdfs`, `submissions` | src/lib/pdf-actions.ts |
| `FinancialAccountService` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `financial_accounts`, `system_counters` | src/lib/services/financial-account-service.ts |
| `FinancialEventService` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/financial-event-service.ts |
| `generateApiKey` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | `api_keys` | src/lib/api-key-actions.ts |
| `generateBatchPersonalizedCreativesAction` | `crm_contacts` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | `contacts`, `creative_batch_jobs`, `creative_documents`, `creative_projects` | src/app/actions/creative-crm-actions.ts |
| `generateComplianceExportAction` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | `users` | src/lib/intelligence/actions/intelligence-actions.ts |
| `generateContextDossierDeterministic` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/generate-context-dossier-flow.ts |
| `generateContextDossierFlow` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/generate-context-dossier-flow.ts |
| `generateCopyVariationsAction` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/app/actions/creative-ai-actions.ts |
| `generateCreativeConceptsAction` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | extend | — | — | `creative_concepts` | src/app/actions/creative-ai-actions.ts |
| `generateDocumentSummaryAction` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireWorkspace` | — | `document_pages`, `documents` | src/lib/documents/ai-document-actions.ts |
| `generateEntityDossierPdf` | `crm_contacts` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/lib/services/entity-dossier-pdf-service.ts |
| `generateEntityDossierSummaryAction` | `crm_contacts` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/app/actions/entity-dossier-actions.ts |
| `generateHeadlineVariationsAction` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/app/actions/headline-iq-actions.ts |
| `generateHookAlternatives` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/generate-hooks-flow.ts |
| `GenerateHooksInputSchema` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/schemas.ts |
| `GenerateHooksOutputSchema` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/schemas.ts |
| `generateInboxReplyAction` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireWorkspace` | — | `brandVoiceProfiles`, `socialInbox` | src/app/actions/social-composer-actions.ts |
| `generateKeywords` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/generate-keywords-flow.ts |
| `generatePdfBuffer` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/lib/pdf-actions.ts |
| `generateRepCoachingBriefAction` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireWorkspace` | — | `coachingProfiles`, `deals`, `performancePolicies`, `salesPerformanceDaily`, `users` | src/app/actions/manager-command-actions.ts |
| `generateScript` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/generate-script-flow.ts |
| `generateSecureUnsubscribeLink` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/lib/services/unsubscribe-service.ts |
| `generateSocialVariationAction` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireAuth` | — | `brandVoiceProfiles` | src/app/actions/social-composer-actions.ts |
| `GenerateThumbnailInputSchema` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/schemas.ts |
| `GenerateThumbnailOutputSchema` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/schemas.ts |
| `generateUnsubscribeToken` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/lib/services/unsubscribe-service.ts |
| `generateVisualStyle` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/generate-visual-style-flow.ts |
| `getAccountAgingProfileAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `canUser` | `canUser:finance`, `canUser:invoices`, `canUser:view` | — | src/lib/receivables-actions.ts |
| `getActionMeta` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/lib/call-action-types.ts |
| `getActivitiesForContact` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireWorkspace` | — | `activities` | src/lib/activity-actions.ts |
| `getActivitiesForContactCore` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `activities` | src/lib/activity-actions.ts |
| `getAgreementsByEntityAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireWorkspace` | — | `billing_agreements` | src/lib/agreement-actions.ts |
| `getAvailableSlotsAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `availability_profiles`, `booking_holds`, `bookings`, `calendar_connections`, `event_types` | src/app/actions/booking-actions.ts |
| `getBackofficeSalesTeamsAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireWorkspace` | — | `salesAgents`, `salesTeams` | src/app/actions/manager-command-actions.ts |
| `getBlueprintAdoptionStats` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireAuth` | — | `message_templates` | src/lib/template-actions.ts |
| `getCallIntelligenceDetailAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireWorkspace` | — | `callConversations`, `callScorecards` | src/app/actions/conversation-coaching-actions.ts |
| `getCampaignsForEntity` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `campaigns` | src/lib/marketing-actions.ts |
| `getClientReportsForEntity` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `clientReports` | src/lib/marketing-actions.ts |
| `getCoachingWorkspaceAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireWorkspace` | — | `callConversations`, `coachingProfiles`, `practiceLabScenarios`, `scorecardTemplates` | src/app/actions/conversation-coaching-actions.ts |
| `getCollectionCaseDetailsAction` | `crm_contacts`* | read | `L0_READ` | wrap | `canUser`, `requireWorkspace` | `canUser:finance`, `canUser:invoices`, `canUser:view` | `collection_activities`, `collection_cases`, `payment_plans`, `promises_to_pay` | src/lib/collection-actions.ts |
| `getConferenceSessionAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireAuth` | — | `conference_sessions` | src/app/actions/conference-session-actions.ts |
| `getConflictChecksForEntity` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `conflictChecks` | src/lib/law-actions.ts |
| `getConsultationsForEntity` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `consultations` | src/lib/law-actions.ts |
| `getContactDocumentInsightsAction` | `crm_contacts` | read | `L0_READ` | unmapped | `requireWorkspace` | — | — | src/lib/documents/crm-actions.ts |
| `getContactsByTagsAction` | `crm_contacts` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `tags`, `workspace_entities` | src/lib/tag-actions.ts |
| `getContactTypeDefaults` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `platform_contact_type_defaults` | src/lib/backoffice/backoffice-field-actions.ts |
| `getContactTypeDefaultsInternal` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `platform_contact_type_defaults` | src/lib/backoffice/backoffice-field-actions.ts |
| `getContentItemBySlugAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/app/actions/content-actions.ts |
| `getContentStudioDraftAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/app/actions/draft-actions.ts |
| `getCourtDatesForMatter` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `courtDates` | src/lib/law-actions.ts |
| `getCreativeProjectWithDocumentAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireAuth` | — | `creative_documents`, `creative_projects`, `thumbnail_designs` | src/app/actions/creative-project-actions.ts |
| `getCrmContactPreviewDataAction` | `crm_contacts` | read | `L0_READ` | unmapped | — | — | `contacts` | src/app/actions/creative-crm-actions.ts |
| `getCustomerStatementAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `canUser` | `canUser:finance`, `canUser:invoices`, `canUser:view` | — | src/lib/receivables-actions.ts |
| `getDealsForBuyer` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `deals` | src/lib/real-estate-actions.ts |
| `getDealsForProperty` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `deals` | src/lib/real-estate-actions.ts |
| `getDefaultAvailabilityProfileAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `availability_profiles` | src/app/actions/availability-actions.ts |
| `getDefaultStyle` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/lib/services/style-resolver.ts |
| `getDirectorySyncConfigAction` | `crm_contacts` | read | `L0_READ` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/enterprise-identity-actions.ts |
| `getDiscoveriesForEntity` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `discoveries` | src/lib/consultancy-actions.ts |
| `getDocumentVersionsAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireWorkspace` | — | `document_versions` | src/lib/documents/document-version-actions.ts |
| `getEffectiveContactTypes` | `crm_contacts` | read | `L0_READ` | unmapped | — | — | `contact_type_templates` | src/lib/contact-type-actions.ts |
| `getEngagementsForEntity` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `engagements` | src/lib/consultancy-actions.ts |
| `getEnterpriseIdpConfigAction` | `crm_contacts` | read | `L0_READ` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/enterprise-identity-actions.ts |
| `getEnterpriseSessionConfigAction` | `crm_contacts` | read | `L0_READ` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/enterprise-identity-actions.ts |
| `getEnterpriseSsoAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/app/actions/enterprise-actions.ts |
| `getEntityContactsAction` | `crm_contacts` | read | `L0_READ` | wrap | `requireAuth` | — | `entities` | src/app/actions/entity-contact-actions.ts |
| `getEntityDealDefaultsAction` | `crm_contacts` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `entities`, `workspace_entities` | src/app/actions/entity-contact-actions.ts |
| `getEntityTagsAction` | `crm_contacts` | read | `L0_READ` | wrap | `requireAuth` | — | `entities`, `workspace_entities` | src/lib/scoped-tag-actions.ts |
| `getEventTypesAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `event_types` | src/app/actions/event-type-actions.ts |
| `getExecutiveIntelligenceAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | `users` | src/lib/intelligence/actions/intelligence-actions.ts |
| `getFeatureDetail` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `platform_features` | src/lib/backoffice/backoffice-feature-actions.ts |
| `getFederatedBenchmarksAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | `users` | src/lib/intelligence/actions/intelligence-actions.ts |
| `getFieldGroupsForWorkspace` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireWorkspace` | — | `field_groups` | src/lib/fields-actions.ts |
| `getFieldsForWorkspace` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `app_fields` | src/lib/fields-actions.ts |
| `getFilteredTemplatesAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireAuth` | — | `message_templates` | src/app/actions/get-filtered-templates-action.ts |
| `getGlobalAiConfig` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `system_settings` | src/lib/backoffice/backoffice-ai-actions.ts |
| `getGlobalAiKeys` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `system_settings` | src/lib/backoffice/backoffice-ai-actions.ts |
| `getIntakeFormsForEntity` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `intakeForms` | src/lib/law-actions.ts |
| `getLatestHealthScore` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `healthScores` | src/lib/saas-actions.ts |
| `getLeadsForPageAction` | `crm_contacts` | read | `L0_READ` | unmapped | `requireAuth` | — | `form_submissions` | src/lib/lead-actions.ts |
| `getLegalDocumentsForEntity` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `legalDocuments` | src/lib/law-actions.ts |
| `getLegalDocumentsForMatter` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `legalDocuments` | src/lib/law-actions.ts |
| `getLinkMetadata` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/ai/flows/get-link-metadata-flow.ts |
| `getLinkMetadataAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/app/actions/link-metadata-actions.ts |
| `getManagerCommandOverviewAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireWorkspace` | — | `deals`, `managerInterventions`, `performancePolicies`, `salesAgents`, `salesPerformanceDaily`, `salesTargets`, `salesTeams`, `tasks`, `users` | src/app/actions/manager-command-actions.ts |
| `getMattersForEntity` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `matters` | src/lib/law-actions.ts |
| `getMemberOnboardingInstanceAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/onboarding-actions.ts |
| `getMfaPolicyAction` | `crm_contacts` | read | `L0_READ` | wrap | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/enterprise-identity-actions.ts |
| `getMigrationParityStatusAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `canUser` | `canUser:finance`, `canUser:settings`, `canUser:view` | — | src/lib/migration-actions.ts |
| `getMigrationStatusAction` | `crm_contacts`* | read | `L0_READ` | extend | — | — | `system_migrations` | src/app/actions/get-migration-status-action.ts |
| `getMilestonesForEngagement` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `milestones` | src/lib/consultancy-actions.ts |
| `getNegotiationsForProperty` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `negotiations` | src/lib/real-estate-actions.ts |
| `getNextSerial` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `system_counters` | src/lib/services/serial-allocator.ts |
| `getOffersForBuyer` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `offers` | src/lib/real-estate-actions.ts |
| `getOffersForProperty` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `offers` | src/lib/real-estate-actions.ts |
| `getOfficeHoursRoomAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireWorkspace` | — | `office_hours_queue`, `office_hours_rooms` | src/app/actions/office-hours-actions.ts |
| `getOnboardingFlowAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/app/actions/engagement-actions.ts |
| `getOnboardingSetupStateAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `organizations`, `users` | src/app/actions/onboarding-actions.ts |
| `getOrganizationDetail` | `crm_contacts`* | read | `L0_READ` | extend | — | — | `entities`, `organizations`, `users`, `workspaces` | src/lib/backoffice/backoffice-org-actions.ts |
| `getOrganizationDiagnostics` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `entities`, `organizations`, `roles`, `users`, `workspaces` | src/lib/backoffice/backoffice-org-actions.ts |
| `getOutcomesForEngagement` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `outcomes` | src/lib/consultancy-actions.ts |
| `getPeopleDirectoryAction` | `crm_contacts` | read | `L0_READ` | unmapped | `hasPlatformAdminClaim`, `verifyCallerContext`, `verifyIdToken` | — | `organization_memberships`, `roles`, `users`, `workspace_memberships`, `workspaces` | src/app/actions/identity-actions.ts |
| `getPerformanceMetricsForCampaign` | `crm_contacts`* | read | `L0_READ` | extend | — | — | `performanceMetrics` | src/lib/marketing-actions.ts |
| `getPersonDetailAction` | `crm_contacts` | read | `L0_READ` | unmapped | `hasPlatformAdminClaim`, `verifyCallerContext`, `verifyIdToken` | — | `roles`, `users`, `workspaces` | src/app/actions/identity-actions.ts |
| `getProcessingJobStatusAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireWorkspace` | — | `document_processing_jobs` | src/lib/documents/processing-actions.ts |
| `getPropertiesForEntity` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `properties` | src/lib/real-estate-actions.ts |
| `getPropertyDocuments` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `propertyDocuments` | src/lib/real-estate-actions.ts |
| `getPropertyPreferencesForEntity` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `propertyPreferences` | src/lib/real-estate-actions.ts |
| `getPublicBookingPageDataAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `availability_profiles`, `event_types`, `users`, `workspaces` | src/app/actions/booking-actions.ts |
| `getPublicStatementAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/lib/receivables-actions.ts |
| `getPublishedTemplatesAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `platform_templates` | src/lib/backoffice/backoffice-template-actions.ts |
| `getRecurringSeriesAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireWorkspace` | — | `recurring_series` | src/app/actions/recurring-series-actions.ts |
| `getRelatedPartiesForMatter` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `relatedParties` | src/lib/law-actions.ts |
| `getRetainersForEntity` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `retainers` | src/lib/consultancy-actions.ts |
| `getSectionTemplatesAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireAuth` | — | `campaign_page_sections` | src/lib/section-actions.ts |
| `getSelfHealingHealthAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | `users` | src/lib/intelligence/actions/intelligence-actions.ts |
| `getSpecialistDetailsAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireWorkspace` | — | `agent_specialists` | src/lib/agents/actions/domain-agent-actions.ts |
| `getStrategyDocsForEntity` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `strategyDocs` | src/lib/marketing-actions.ts |
| `getSupervisorRunAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | `users` | src/lib/supervisor/actions/supervisor-actions.ts |
| `getSwarmRunAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireAuth` | — | — | src/lib/agents/actions/domain-agent-actions.ts |
| `getSystemEngineManifestAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/lib/backoffice/backoffice-health-actions.ts |
| `getTagAction` | `crm_contacts` | read | `L0_READ` | unmapped | `requireAuth` | — | `tags` | src/lib/tag-actions.ts |
| `getTagAuditLogsAction` | `crm_contacts` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `tag_audit_logs` | src/lib/tag-actions.ts |
| `getTagsAction` | `crm_contacts` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `tags` | src/lib/tag-actions.ts |
| `getTagUsageStatsAction` | `crm_contacts` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `automations`, `message_logs`, `tag_audit_logs`, `tags` | src/lib/tag-actions.ts |
| `getTeamCoachingOverviewAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireWorkspace` | — | `callConversations`, `coachingProfiles`, `practiceLabScenarios` | src/app/actions/conversation-coaching-actions.ts |
| `getTemplateById` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireAuth` | — | `message_templates` | src/lib/template-actions.ts |
| `getTemplateDetail` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `platform_templates` | src/lib/backoffice/backoffice-template-actions.ts |
| `getTenantHealthOverviewAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/lib/backoffice/backoffice-health-actions.ts |
| `getThemesAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `campaign_page_themes` | src/lib/theme-actions.ts |
| `getTimeEntriesForEntity` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `timeTracking` | src/lib/law-actions.ts |
| `getTimeEntriesForMatter` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `timeTracking` | src/lib/law-actions.ts |
| `getTrialsForEntity` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `trials` | src/lib/saas-actions.ts |
| `getUniqueEventTypeSlug` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireWorkspace` | — | `event_types` | src/app/actions/event-type-actions.ts |
| `getUpcomingCourtDatesForEntity` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `courtDates` | src/lib/law-actions.ts |
| `getVariablesAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/lib/services/fields-variables-service.ts |
| `getVariableValuesMapAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/lib/services/fields-variables-service.ts |
| `getViewingsForClient` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `viewings` | src/lib/real-estate-actions.ts |
| `getViewingsForProperty` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `viewings` | src/lib/real-estate-actions.ts |
| `getWebinarStageStateAction` | `crm_contacts` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `meeting_participants`, `meetings`, `webinar_questions` | src/app/actions/webinar-stage-actions.ts |
| `getWhiteLabelConfigAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/app/actions/enterprise-actions.ts |
| `getWorkspaceAgingSummaryAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `canUser` | `canUser:finance`, `canUser:invoices`, `canUser:view` | — | src/lib/receivables-actions.ts |
| `getWorkspaceBrandKitAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireWorkspace` | — | `creative_brand_kits` | src/app/actions/brand-kit-actions.ts |
| `getWorkspaceHealthReportAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/lib/documents/document-observability-actions.ts |
| `getWorkspaceVariablesAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireWorkspace` | — | `app_fields`, `workspaces` | src/lib/fields-actions.ts |
| `getWorkspaceVocabulary` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireWorkspace` | — | `vocabulary_map`, `workspaces` | src/lib/vocabulary-map-actions.ts |
| `handleSignupAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | — | src/lib/signup-actions.ts |
| `HookAlternativeSchema` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/schemas.ts |
| `htmlContainsFooter` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/org-footer-service.ts |
| `identifyPrimaryField` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/identify-primary-field-flow.ts |
| `IdentityAccountService` | `crm_contacts` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/identity/identity-account-service.ts |
| `IdentityMigrationService` | `crm_contacts` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `users` | src/lib/services/identity/identity-migration-service.ts |
| `IdentityProjectionService` | `crm_contacts` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `roles`, `users` | src/lib/services/identity/identity-projection-service.ts |
| `IngestionDeduplicator` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/IngestionDeduplicator.ts |
| `installMarketplaceTemplateAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/actions/enterprise-actions.ts |
| `installPredefinedIndustryGroupsAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `canUser`, `requireWorkspace` | `canUser:create`, `canUser:fields`, `canUser:management` | `app_fields`, `field_groups`, `platform_industry_field_groups`, `workspaces` | src/lib/fields-actions.ts |
| `invitePersonAction` | `crm_contacts` | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | `hasPlatformAdminClaim`, `verifyCallerContext`, `verifyIdToken` | — | `organizations`, `users` | src/app/actions/identity-actions.ts |
| `joinOfficeHoursQueueAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `office_hours_queue`, `office_hours_rooms` | src/app/actions/office-hours-actions.ts |
| `leaveOfficeHoursQueueAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `office_hours_queue` | src/app/actions/office-hours-actions.ts |
| `linkContactDocumentSessionAction` | `crm_contacts` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `documents`, `viewer_sessions` | src/lib/documents/crm-actions.ts |
| `linkCreativeToCrmCampaignAction` | `crm_contacts` | update | `L2_STATE_MUTATION` | unmapped | — | — | `creative_projects` | src/app/actions/creative-crm-actions.ts |
| `linkInboxToCRMAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `socialInbox` | src/app/actions/social-composer-actions.ts |
| `listAgentDescriptorsAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireAuth` | — | — | src/lib/supervisor/actions/supervisor-actions.ts |
| `listAllFeatures` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `platform_features` | src/lib/backoffice/backoffice-feature-actions.ts |
| `listAllJobs` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `platform_jobs` | src/lib/backoffice/backoffice-job-actions.ts |
| `listAllOrganizations` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `organizations`, `users`, `workspaces` | src/lib/backoffice/backoffice-org-actions.ts |
| `listAllTemplates` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `platform_templates` | src/lib/backoffice/backoffice-template-actions.ts |
| `listApiKeys` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireSystemAdmin` | — | `api_keys` | src/lib/api-key-actions.ts |
| `listCohortMembersAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/app/actions/event-actions.ts |
| `listCohortsByPortalAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/app/actions/event-actions.ts |
| `listConnectedChannelsAction` | `crm_contacts`* | read | `L0_READ` | extend | — | — | `creative_channels` | src/app/actions/creative-publishing-actions.ts |
| `listContentItemsByPortalAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/app/actions/content-actions.ts |
| `listContentStudioDraftsByPortalAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/app/actions/draft-actions.ts |
| `listCreativeTemplatesAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `creative_templates` | src/app/actions/creative-template-actions.ts |
| `listCreativeVersionsAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireAuth` | — | `creative_versions` | src/app/actions/creative-project-actions.ts |
| `listCrmCampaignsAction` | `crm_contacts` | read | `L0_READ` | extend | — | — | `campaigns` | src/app/actions/creative-crm-actions.ts |
| `listDirectorySyncLogsAction` | `crm_contacts` | read | `L0_READ` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/enterprise-identity-actions.ts |
| `listDocumentDistributionsAction` | `crm_contacts`* | read | `L0_READ` | wrap | `requireWorkspace` | — | `document_distributions` | src/lib/documents/distribution-actions.ts |
| `listEnterpriseAuditLogsAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/app/actions/enterprise-actions.ts |
| `listFieldPacks` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `platform_field_defaults` | src/lib/backoffice/backoffice-field-actions.ts |
| `listGlobalTemplates` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireAuth` | — | `message_templates` | src/lib/template-actions.ts |
| `listHierarchyNodesAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/app/actions/enterprise-actions.ts |
| `listIndustryPredefinedGroupsAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireAuth` | — | — | src/lib/fields-actions.ts |
| `listJourneysAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/onboarding-actions.ts |
| `listLiveEventsByPortalAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/app/actions/event-actions.ts |
| `listMarketplaceListingsAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/app/actions/enterprise-actions.ts |
| `listNativeFields` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `platform_native_fields` | src/lib/backoffice/backoffice-field-actions.ts |
| `listOnboardingInstancesAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/onboarding-actions.ts |
| `listPendingSubmissionsAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/app/actions/engagement-actions.ts |
| `listPlatformIndustryFieldGroups` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `platform_industry_field_groups` | src/lib/backoffice/backoffice-field-actions.ts |
| `listPlatformIndustryFieldGroupsInternal` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `platform_industry_field_groups` | src/lib/backoffice/backoffice-field-actions.ts |
| `listPortalContentTemplatesAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/app/actions/content-actions.ts |
| `listPriceBooksAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireWorkspace` | — | `price_books` | src/app/actions/product-actions.ts |
| `listProductCategoriesAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireWorkspace` | — | `product_categories` | src/app/actions/product-actions.ts |
| `listProductsAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireWorkspace` | — | `products` | src/app/actions/product-actions.ts |
| `listProjectCommentsAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireAuth` | — | `creative_comments` | src/app/actions/creative-comment-actions.ts |
| `listProjectConceptsAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `creative_concepts` | src/app/actions/creative-ai-actions.ts |
| `listProjectExperimentsAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `creative_experiments` | src/app/actions/creative-experiment-actions.ts |
| `listProjectsPendingApprovalAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `creative_projects` | src/app/actions/creative-collab-actions.ts |
| `listProviderSettings` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `platform_provider_settings` | src/lib/backoffice/backoffice-provider-actions.ts |
| `listPublicationHistoryAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `creative_publications` | src/app/actions/creative-publishing-actions.ts |
| `listRecommendationsAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | `users` | src/lib/intelligence/actions/intelligence-actions.ts |
| `listSpecialistsAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireWorkspace` | — | — | src/lib/agents/actions/domain-agent-actions.ts |
| `listSupervisorRunsAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | `users` | src/lib/supervisor/actions/supervisor-actions.ts |
| `listSwarmRunsAction` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireWorkspace` | — | — | src/lib/agents/actions/domain-agent-actions.ts |
| `listTasksByPortalAction` | `crm_contacts`* | read | `L0_READ` | extend | — | — | — | src/app/actions/engagement-actions.ts |
| `listTemplates` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireAuth` | — | `message_templates` | src/lib/template-actions.ts |
| `listTenantIssuesAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `tenant_issues` | src/lib/backoffice/backoffice-health-actions.ts |
| `loadSettings` | `crm_contacts`* | read | `L0_READ` | unmapped | `requireWorkspace` | — | `settings` | src/lib/settings-actions.ts |
| `lockWorkspaceScope` | `crm_contacts` | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | `workspaces` | src/lib/entity-actions.ts |
| `logCollectionActivityAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:finance`, `canUser:invoices` | — | src/lib/collection-actions.ts |
| `logFlipbookAnalyticsAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/flipbook-actions.ts |
| `logMemberActivityAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/engagement-actions.ts |
| `manageWorkspaceMembershipsAction` | `crm_contacts` | execute | `L2_STATE_MUTATION`* | unmapped | `hasPlatformAdminClaim`, `verifyCallerContext`, `verifyIdToken` | — | `users` | src/app/actions/identity-actions.ts |
| `memoryItemSchema` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/consolidate-memories-flow.ts |
| `mergeSignupIntoEntityAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | wrap | `requireAuth` | — | `workspace_entities` | src/lib/signup-conflict-actions.ts |
| `mergeTagsAction` | `crm_contacts` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `prospects`, `schools`, `tag_audit_logs`, `tags` | src/lib/tag-actions.ts |
| `migrateLegacyTemplatesToBlocksAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/actions/migrate-legacy-templates-to-blocks-action.ts |
| `migrateLegacyTestimonialBlocksAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | `page_versions` | src/app/actions/migrate-legacy-testimonials-action.ts |
| `migrateTemplatesAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `message_templates` | src/app/actions/migrate-templates-action.ts |
| `modifyPageStructure` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/modify-page-flow.ts |
| `ModifyThumbnailInputSchema` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/schemas.ts |
| `ModifyThumbnailOutputSchema` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/schemas.ts |
| `moveFieldToGroupAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:fields`, `canUser:management` | `app_fields` | src/lib/fields-actions.ts |
| `normalizeBulkRow` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/bulk-normalization-flow.ts |
| `OnboardingInstanceService` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `organization_memberships`, `users` | src/lib/services/onboarding/onboarding-instance-service.ts |
| `OnboardingJourneyService` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `onboarding_instances` | src/lib/services/onboarding/onboarding-journey-service.ts |
| `parseAndSuggestSlotsAction` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireAuth` | — | — | src/app/actions/ai-scheduling-actions.ts |
| `PersonService` | `crm_contacts` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `users` | src/lib/services/identity/person-service.ts |
| `pingQueueHeartbeatAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `office_hours_queue`, `office_hours_rooms` | src/app/actions/office-hours-actions.ts |
| `planStepSchema` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/decompose-supervisor-goal-flow.ts |
| `postWebinarQuestionAction` | `crm_contacts` | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | `webinar_questions` | src/app/actions/webinar-stage-actions.ts |
| `processLeadCaptureAction` | `crm_contacts` | execute | `L2_STATE_MUTATION` | unmapped | — | — | `campaign_pages`, `entities`, `form_submissions`, `responses`, `surveys`, `tags`, `workspace_entities` | src/lib/lead-actions.ts |
| `processMeetingInvitations` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | — | — | `meetings`, `organizations` | src/lib/invitation-actions.ts |
| `processUnsubscribe` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | — | — | `entities`, `workspace_entities` | src/lib/services/unsubscribe-service.ts |
| `ProductCatalogueService` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `finance_pricing_plans`, `finance_products`, `subscription_packages` | src/lib/services/product-catalogue-service.ts |
| `PromiseToPayService` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `collection_cases`, `promises_to_pay` | src/lib/services/promise-to-pay-service.ts |
| `promoteDocumentVersionAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `document_pages`, `document_versions`, `documents`, `flipbook_pages` | src/lib/documents/document-version-actions.ts |
| `promoteWaitlistRegistrantsAction` | `crm_contacts` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `meeting_participants` | src/app/actions/webinar-stage-actions.ts |
| `promoteWinnerVariantAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `experiments` | src/lib/experiment-actions.ts |
| `promoteWinningVariantAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | `creative_experiments` | src/app/actions/creative-experiment-actions.ts |
| `propagateTemplateAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/backoffice/backoffice-template-actions.ts |
| `publishContentItemAction` | `crm_contacts`* | publish | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | — | — | — | src/app/actions/content-actions.ts |
| `publishCreativeToChannelAction` | `crm_contacts`* | publish | `L3_EXTERNAL_COMMUNICATION_FINANCE` | extend | — | — | `creative_projects`, `creative_publications` | src/app/actions/creative-publishing-actions.ts |
| `publishEventReplayAction` | `crm_contacts`* | publish | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | — | — | — | src/app/actions/event-actions.ts |
| `publishTemplate` | `crm_contacts`* | publish | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | — | — | `platform_templates` | src/lib/backoffice/backoffice-template-actions.ts |
| `purgeContractAction` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireAuth` | — | `contracts`, `pdfs`, `submissions` | src/lib/pdf-actions.ts |
| `purgeEdgeCacheAction` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireAuth` | — | — | src/lib/observability-actions.ts |
| `queueDocumentProcessingAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `document_processing_jobs`, `document_versions` | src/lib/documents/processing-actions.ts |
| `rebalanceTeamWorkloadAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | `managerInterventions` | src/app/actions/manager-command-actions.ts |
| `recalibrateSummaryAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `canUser` | `canUser:edit`, `canUser:finance`, `canUser:settings` | — | src/lib/migration-actions.ts |
| `recommendBestTimeAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | `socialPosts` | src/app/actions/social-composer-actions.ts |
| `recommendDocumentHotspotsAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | `document_pages`, `documents` | src/lib/documents/ai-document-actions.ts |
| `reconcileOnboardingAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/engagement-actions.ts |
| `reconcileOrganizationIdentitiesAction` | `crm_contacts` | update | `L2_STATE_MUTATION` | unmapped | `hasPlatformAdminClaim`, `verifyCallerContext`, `verifyIdToken` | — | `users` | src/app/actions/identity-actions.ts |
| `recordBanditRewardAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `bandit_policies` | src/lib/bandit-actions.ts |
| `recordDocumentEventAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/document-actions.ts |
| `recordEventAttendanceAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/event-actions.ts |
| `recordFeatureAdoption` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `featureAdoption` | src/lib/saas-actions.ts |
| `recordJoinSessionAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/event-actions.ts |
| `recordLeaveSessionAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/event-actions.ts |
| `recordObservabilityMetricAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/documents/document-observability-actions.ts |
| `recordOrientationWatchedAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/engagement-actions.ts |
| `recordPerformanceMetric` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `performanceMetrics` | src/lib/marketing-actions.ts |
| `recordProductUsage` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `productUsage` | src/lib/saas-actions.ts |
| `recordPromiseToPayAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireAuth` | `canUser:edit`, `canUser:finance`, `canUser:invoices` | — | src/lib/collection-actions.ts |
| `refineMessage` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/refine-message-flow.ts |
| `registerCustomCodedPage` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `campaign_pages`, `custom_page_analytics` | src/lib/page-registry-actions.ts |
| `registerForEventAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/event-actions.ts |
| `ReleaseScheduleService` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/services/release-schedule-service.ts |
| `removeCohortMemberAction` | `crm_contacts`* | delete | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/event-actions.ts |
| `removeTagAction` | `crm_contacts` | delete | `L2_STATE_MUTATION` | unmapped | `requireAuth`, `requireWorkspace` | — | `entities`, `tags`, `workspace_entities` | src/lib/scoped-tag-actions.ts |
| `removeTagsAction` | `crm_contacts` | delete | `L2_STATE_MUTATION` | unmapped | — | — | `tag_audit_logs`, `tags`, `workspace_entities` | src/lib/tag-actions.ts |
| `renderScheduledMessageAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | `message_styles`, `message_templates`, `organizations`, `scheduled_messages` | src/app/actions/scheduled-message-actions.ts |
| `reorderDocumentPagesAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `document_pages`, `documents`, `flipbook_pages`, `flipbooks` | src/lib/documents/document-page-actions.ts |
| `reorderFieldGroupsAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:fields`, `canUser:management` | `field_groups` | src/lib/fields-actions.ts |
| `requestProjectChangesAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `creative_projects`, `creative_reviews` | src/app/actions/creative-collab-actions.ts |
| `rescheduleBookingAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `booking_holds`, `bookings`, `meetings` | src/app/actions/booking-actions.ts |
| `rescheduleMessageAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | — | src/app/actions/scheduled-message-actions.ts |
| `resolveCustomFooterHtml` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/lib/services/landing-footer-service.ts |
| `resolveDistributionTokenAction` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireAuth` | — | `document_distributions` | src/lib/documents/distribution-actions.ts |
| `resolveEntitiesFlow` | `crm_contacts` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/resolve-entities-flow.ts |
| `resolveEntityContextFromParamsAction` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/lib/services/fields-variables-service.ts |
| `resolveOrgFooter` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/lib/services/org-footer-service.ts |
| `resolveProjectCommentAction` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireAuth` | — | `creative_comments` | src/app/actions/creative-comment-actions.ts |
| `resolveTemplateVariablesAction` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/lib/services/fields-variables-service.ts |
| `restoreEntitySchemaRestructure` | `crm_contacts` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `entities` | src/app/actions/entity-schema-restructure-actions.ts |
| `restoreOrganization` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | `organizations` | src/lib/backoffice/backoffice-org-actions.ts |
| `restoreSaaSMigration` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | `entities` | src/app/actions/industry-migration-actions.ts |
| `resumeSupervisorMissionAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | `users` | src/lib/supervisor/actions/supervisor-actions.ts |
| `resumeSwarmMissionAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | — | src/lib/agents/actions/domain-agent-actions.ts |
| `retryFailedProcessingJobAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `document_processing_jobs` | src/lib/documents/processing-actions.ts |
| `revertToGlobal` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | `message_templates` | src/lib/template-actions.ts |
| `reviewTaskSubmissionAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/actions/engagement-actions.ts |
| `revokeApiKey` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireAuth` | — | `api_keys` | src/lib/api-key-actions.ts |
| `revokeDocumentDistributionAction` | `crm_contacts`* | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireWorkspace` | — | `document_distributions` | src/lib/documents/distribution-actions.ts |
| `rollbackEntitySchemaRestructure` | `crm_contacts` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `entities` | src/app/actions/entity-schema-restructure-actions.ts |
| `rollbackSaaSMigration` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | `entities` | src/app/actions/industry-migration-actions.ts |
| `rotateAllSecretsAction` | `crm_contacts`* | execute | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | `system_settings` | src/lib/backoffice/backoffice-ai-actions.ts |
| `runCoachingMigrationAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | — | src/app/actions/conversation-coaching-actions.ts |
| `runDocumentCtaBackfillAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | — | — | `media_shares` | src/app/actions/backfill-document-cta-action.ts |
| `runObservationScanAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | `users` | src/lib/intelligence/actions/intelligence-actions.ts |
| `runSalesTeamMigrationAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | — | src/app/actions/manager-command-actions.ts |
| `runTenantDiagnostics` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/backoffice/backoffice-job-actions.ts |
| `runTenantSenderHygieneAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth`, `requireOrgAdmin` | — | — | src/app/actions/tenant-hygiene-action.ts |
| `sanitizeCustomHtml` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/landing-footer-service.ts |
| `saveAgreementProgressAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | `contracts`, `pdfs`, `submissions` | src/lib/pdf-actions.ts |
| `saveAiSummaryToDocumentMetadataAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `documents` | src/lib/documents/ai-document-actions.ts |
| `saveBanditPolicyAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `bandit_policies` | src/lib/bandit-actions.ts |
| `saveCampaignOrchestrationAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `campaign_orchestrations` | src/lib/orchestration-actions.ts |
| `saveCanvasAsTemplateAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | `creative_documents`, `creative_templates` | src/app/actions/creative-template-actions.ts |
| `saveContactTypeDefaults` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | `platform_contact_type_defaults` | src/lib/backoffice/backoffice-field-actions.ts |
| `saveContactTypeOverrides` | `crm_contacts` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `contact_type_templates` | src/lib/contact-type-actions.ts |
| `saveContentStudioDraftAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/draft-actions.ts |
| `saveCreativeDocumentAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireAuth`, `requireWorkspace` | — | `creative_documents`, `creative_projects`, `creative_versions`, `thumbnail_designs` | src/app/actions/creative-project-actions.ts |
| `saveDirectorySyncConfigAction` | `crm_contacts` | update | `L2_STATE_MUTATION` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/enterprise-identity-actions.ts |
| `saveEnterpriseIdpConfigAction` | `crm_contacts` | update | `L2_STATE_MUTATION` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/enterprise-identity-actions.ts |
| `saveEnterpriseSessionConfigAction` | `crm_contacts` | update | `L2_STATE_MUTATION` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/enterprise-identity-actions.ts |
| `saveEnterpriseSsoAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/enterprise-actions.ts |
| `saveExperimentAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `campaign_pages`, `experiments` | src/lib/experiment-actions.ts |
| `saveFieldPack` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | `platform_field_defaults` | src/lib/backoffice/backoffice-field-actions.ts |
| `saveGlobalAiConfig` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | `system_settings` | src/lib/backoffice/backoffice-ai-actions.ts |
| `saveGlobalAiKeys` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | `system_settings` | src/lib/backoffice/backoffice-ai-actions.ts |
| `saveInsightAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `page_insights` | src/lib/insight-actions.ts |
| `saveMfaPolicyAction` | `crm_contacts` | update | `L2_STATE_MUTATION` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/enterprise-identity-actions.ts |
| `saveNativeField` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | `platform_native_fields` | src/lib/backoffice/backoffice-field-actions.ts |
| `saveOnboardingFlowAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/engagement-actions.ts |
| `savePdfForm` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `pdfs` | src/lib/pdf-actions.ts |
| `savePerspectiveAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `perspectives` | src/lib/perspective-actions.ts |
| `savePlatformIndustryFieldGroup` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | `platform_industry_field_groups` | src/lib/backoffice/backoffice-field-actions.ts |
| `savePracticeScenarioAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `practiceLabScenarios` | src/app/actions/conversation-coaching-actions.ts |
| `savePriceBookItemsAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `price_book_items`, `price_books` | src/app/actions/product-actions.ts |
| `saveProviderSetting` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | `platform_provider_settings` | src/lib/backoffice/backoffice-provider-actions.ts |
| `saveSalesTeamConfigAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `salesTeams` | src/app/actions/manager-command-actions.ts |
| `saveScorecardTemplateAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `scorecardTemplates` | src/app/actions/conversation-coaching-actions.ts |
| `saveSectionAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `campaign_page_sections` | src/lib/section-actions.ts |
| `saveThemeAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `campaign_page_themes` | src/lib/theme-actions.ts |
| `saveWhiteLabelConfigAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/enterprise-actions.ts |
| `saveWorkspaceBrandKitAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `creative_brand_kits` | src/app/actions/brand-kit-actions.ts |
| `scheduleCreativePublicationAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | — | — | `creative_publications` | src/app/actions/creative-publishing-actions.ts |
| `searchEntitiesForDealAction` | `crm_contacts` | search | `L0_READ` | wrap | `requireAuth` | — | `entities`, `workspace_entities` | src/app/actions/entity-contact-actions.ts |
| `searchPortalContentAction` | `crm_contacts`* | search | `L0_READ` | unmapped | — | — | — | src/app/actions/content-actions.ts |
| `seedDefaultJourneysAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/onboarding-actions.ts |
| `seedDefaultStyleBlueprintsAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `message_templates` | src/app/actions/seed-default-style-blueprints-action.ts |
| `seedDefaultTemplatesAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `creative_templates` | src/app/actions/creative-template-actions.ts |
| `seedGlobalTemplatesAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `message_templates` | src/app/actions/seed-global-templates-action.ts |
| `seedInfrastructureAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `ensureOrgDefaultStyleAdmin` | — | `organizations`, `system_config`, `workspaces` | src/app/actions/seed-actions.ts |
| `seedKnownCustomPages` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `requireAuth`, `requireWorkspace` | — | `campaign_pages`, `custom_page_analytics` | src/lib/page-registry-actions.ts |
| `seedMaintenanceAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/seed-maintenance-action.ts |
| `seedNativeFieldsAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `app_fields`, `field_groups`, `users`, `workspaces` | src/lib/fields-actions.ts |
| `seedPromptsAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/seed-prompts-action.ts |
| `seedRoleArchitectureTemplatesAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `platform_templates` | src/lib/backoffice/backoffice-template-actions.ts |
| `sendContractAction` | `crm_contacts`* | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | `canUser`, `requireAuth` | `canUser:agreements`, `canUser:edit`, `canUser:finance` | `contracts` | src/lib/contract-actions.ts |
| `sendInboxManualReplyAction` | `crm_contacts`* | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | `requireAuth` | — | `socialInbox` | src/app/actions/social-composer-actions.ts |
| `sendMessageNowAction` | `crm_contacts`* | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | wrap | `requireAuth` | — | — | src/app/actions/scheduled-message-actions.ts |
| `sendReceiptAcknowledgementAction` | `crm_contacts`* | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | — | — | — | src/lib/notification-actions.ts |
| `sendTestMessage` | `crm_contacts`* | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | `requireAuth` | — | `sender_profiles` | src/lib/template-actions.ts |
| `sendTestMessageAction` | `crm_contacts`* | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | wrap | `requireAuth` | — | — | src/app/actions/scheduled-message-actions.ts |
| `setDefaultSenderProfileAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireAuth`, `requireOrgAdmin` | — | `organizations`, `sender_profiles`, `workspaces` | src/app/actions/set-default-sender-action.ts |
| `shareOrgSetupInviteAction` | `crm_contacts`* | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | — | — | `organizations` | src/lib/backoffice/backoffice-org-actions.ts |
| `simulateInboundMessageAction` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireWorkspace` | — | `brandVoiceProfiles`, `socialInbox` | src/app/actions/social-composer-actions.ts |
| `simulateListeningMentionAction` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireWorkspace` | — | `notifications`, `socialListeningAlerts`, `socialListeningRules` | src/app/actions/social-composer-actions.ts |
| `simulateSocialConversionsAction` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireWorkspace` | — | `invoices`, `socialPosts`, `workspace_entities` | src/app/actions/social-composer-actions.ts |
| `startOnboardingJourneyAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/onboarding-actions.ts |
| `startRoleplaySessionAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | `practiceLabScenarios`, `practiceLabSessions` | src/app/actions/conversation-coaching-actions.ts |
| `startSupervisorMissionAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | `users` | src/lib/supervisor/actions/supervisor-actions.ts |
| `startSwarmMissionAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | — | src/lib/agents/actions/domain-agent-actions.ts |
| `submitDocumentLeadAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `documents`, `flipbook_leads`, `flipbooks` | src/lib/document-actions.ts |
| `submitFlipbookLeadAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/flipbook-actions.ts |
| `submitManualScorecardReviewAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `callConversations`, `callScorecards`, `scorecardTemplates` | src/app/actions/conversation-coaching-actions.ts |
| `submitOnboardingProfileAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `organizations`, `users`, `workspaces` | src/app/actions/onboarding-actions.ts |
| `submitOnboardingStepAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/onboarding-actions.ts |
| `submitProjectForReviewAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | `creative_projects`, `creative_reviews` | src/app/actions/creative-collab-actions.ts |
| `submitRoleplayTurnAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `coachingProfiles`, `practiceLabScenarios`, `practiceLabSessions` | src/app/actions/conversation-coaching-actions.ts |
| `submitTaskAction` | `crm_contacts`* | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/engagement-actions.ts |
| `suggestBulkMapping` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/bulk-mapping-flow.ts |
| `summarizeEntityNotesFlow` | `crm_contacts` | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/entity-summarizer.ts |
| `summarizeEntityTimelineFlow` | `crm_contacts` | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/summarize-entity-timeline-flow.ts |
| `suspendOrganization` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `organizations` | src/lib/backoffice/backoffice-org-actions.ts |
| `synthesizeResultDeterministic` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/synthesize-supervisor-result-flow.ts |
| `synthesizeResultInputSchema` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/synthesize-supervisor-result-flow.ts |
| `synthesizeResultOutputSchema` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/synthesize-supervisor-result-flow.ts |
| `synthesizeSupervisorResultFlow` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/synthesize-supervisor-result-flow.ts |
| `synthesizeSwarmConsensusFlow` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/synthesize-swarm-consensus-flow.ts |
| `synthesizeSwarmDeterministic` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/synthesize-swarm-consensus-flow.ts |
| `synthesizeSwarmInputSchema` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/synthesize-swarm-consensus-flow.ts |
| `synthesizeSwarmOutputSchema` | `crm_contacts`* | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/synthesize-swarm-consensus-flow.ts |
| `timelineAiBriefOutputSchema` | `crm_contacts` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/summarize-entity-timeline-flow.ts |
| `toggleEventTypeStatusAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | `event_types` | src/app/actions/event-type-actions.ts |
| `toggleFeatureKillSwitch` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | `platform_features` | src/lib/backoffice/backoffice-feature-actions.ts |
| `toggleOrganizationActivityLogging` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | `organizations` | src/lib/backoffice/backoffice-org-actions.ts |
| `togglePresenterStageStatusAction` | `crm_contacts` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `meeting_participants` | src/app/actions/webinar-stage-actions.ts |
| `TopicAnalysisSchema` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/schemas.ts |
| `triggerCrossChannelSyncAction` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `campaign_orchestrations` | src/lib/orchestration-actions.ts |
| `triggerJobExecution` | `crm_contacts`* | execute | `L2_STATE_MUTATION` | unmapped | — | — | `platform_jobs` | src/lib/backoffice/backoffice-job-actions.ts |
| `unarchiveTemplate` | `crm_contacts`* | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | `message_templates`, `template_audit_logs` | src/lib/template-actions.ts |
| `updateAgentCapacityAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `salesAgents` | src/app/actions/manager-command-actions.ts |
| `updateAgreementAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:finance`, `canUser:invoices` | `billing_agreements` | src/lib/agreement-actions.ts |
| `updateAvailabilityProfileAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | `availability_profiles` | src/app/actions/availability-actions.ts |
| `updateCampaign` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/marketing-actions.ts |
| `updateCaseStageAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:finance`, `canUser:invoices` | — | src/lib/collection-actions.ts |
| `updateChangeSetStatusAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `ai_change_sets` | src/lib/ai-change-set-actions.ts |
| `updateClientReport` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/marketing-actions.ts |
| `updateCohortAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/event-actions.ts |
| `updateConflictCheckStatus` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/law-actions.ts |
| `updateConsultation` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/law-actions.ts |
| `updateContentItemAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/content-actions.ts |
| `updateCourtDate` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/law-actions.ts |
| `updateCreativeProjectAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `creative_projects` | src/app/actions/creative-project-actions.ts |
| `updateDeal` | `crm_contacts`* | update | `L2_STATE_MUTATION` | extend | — | — | — | src/lib/real-estate-actions.ts |
| `updateDeliverableStatus` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/marketing-actions.ts |
| `updateDiscovery` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/consultancy-actions.ts |
| `updateDocumentAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `access_policies`, `documents`, `flipbooks` | src/lib/document-actions.ts |
| `updateEngagement` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/consultancy-actions.ts |
| `updateEntityAction` | `crm_contacts` | update | `L2_STATE_MUTATION` | wrap | `canUser` | `canUser:campuses`, `canUser:edit`, `canUser:operations` | `automations`, `entities`, `organizations`, `tags`, `workspace_entities` | src/lib/entity-actions.ts |
| `updateEntityIdentity` | `crm_contacts`* | update | `L2_STATE_MUTATION` | wrap | `requireAuth` | — | — | src/lib/profile-actions.ts |
| `updateEventTypeAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `event_types` | src/app/actions/event-type-actions.ts |
| `updateFeatureRolloutRules` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | `platform_features` | src/lib/backoffice/backoffice-feature-actions.ts |
| `updateFieldAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireAuth` | `canUser:edit`, `canUser:fields`, `canUser:management` | `app_fields` | src/lib/fields-actions.ts |
| `updateFieldGroupAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireAuth` | `canUser:edit`, `canUser:fields`, `canUser:management` | `field_groups` | src/lib/fields-actions.ts |
| `updateFlipbookAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/flipbook-actions.ts |
| `updateGlobalTemplate` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `message_templates` | src/lib/template-actions.ts |
| `updateHostOfficeHoursStatusAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `office_hours_rooms` | src/app/actions/office-hours-actions.ts |
| `updateLiveEventAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/event-actions.ts |
| `updateMatterStatus` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/law-actions.ts |
| `updateMembershipStatusAction` | `crm_contacts` | update | `L2_STATE_MUTATION` | unmapped | `hasPlatformAdminClaim`, `verifyCallerContext`, `verifyIdToken` | — | `users` | src/app/actions/identity-actions.ts |
| `updateMilestoneStatus` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/consultancy-actions.ts |
| `updateNegotiation` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/real-estate-actions.ts |
| `updateNote` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `activities` | src/lib/activity-actions.ts |
| `updateOfferStatus` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/real-estate-actions.ts |
| `updateOnboardingMilestone` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/saas-actions.ts |
| `updateOrganizationFeaturesAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `organizations` | src/lib/feature-actions.ts |
| `updateOrganizationFromBackoffice` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | `organizations` | src/lib/backoffice/backoffice-org-actions.ts |
| `updateOrgTemplate` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `message_templates` | src/lib/template-actions.ts |
| `updateOutcome` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/consultancy-actions.ts |
| `updatePageStatusAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `campaign_page_versions`, `campaign_pages` | src/lib/page-actions.ts |
| `updatePdfFormMapping` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `pdfs` | src/lib/pdf-actions.ts |
| `updatePdfFormStatus` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `pdfs` | src/lib/pdf-actions.ts |
| `updatePdfResultsSharing` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `pdfs` | src/lib/pdf-actions.ts |
| `updatePersonProfileAction` | `crm_contacts` | update | `L2_STATE_MUTATION` | unmapped | `hasPlatformAdminClaim`, `verifyCallerContext`, `verifyIdToken` | — | `users` | src/app/actions/identity-actions.ts |
| `updatePostScheduleAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `socialPosts` | src/app/actions/social-composer-actions.ts |
| `updatePreferencesAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/unsubscribe-actions.ts |
| `updatePriceBookAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `price_books` | src/app/actions/product-actions.ts |
| `updateProductAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `products` | src/app/actions/product-actions.ts |
| `updateProductAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:finance`, `canUser:invoices` | `finance_products` | src/lib/product-actions.ts |
| `updateProductCategoryAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `product_categories` | src/app/actions/product-actions.ts |
| `updateProfile` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | `workspace_entities` | src/lib/profile-actions.ts |
| `updateProperty` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/real-estate-actions.ts |
| `updatePropertyDocument` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/real-estate-actions.ts |
| `updatePropertyPreference` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/real-estate-actions.ts |
| `updateProposal` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/marketing-actions.ts |
| `updateRetainer` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/consultancy-actions.ts |
| `updateScheduledMessageContentAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | — | src/app/actions/scheduled-message-actions.ts |
| `updateSettings` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `settings` | src/lib/settings-actions.ts |
| `updateSpecialistConfigAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `agent_specialists` | src/lib/agents/actions/domain-agent-actions.ts |
| `updateStrategyDoc` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/marketing-actions.ts |
| `updateSubscription` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/saas-actions.ts |
| `updateSupportTicket` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/saas-actions.ts |
| `updateTagAction` | `crm_contacts` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `tag_audit_logs`, `tags` | src/lib/tag-actions.ts |
| `updateTaskAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | extend | — | — | — | src/app/actions/engagement-actions.ts |
| `updateTemplateAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | `platform_templates` | src/lib/backoffice/backoffice-template-actions.ts |
| `updateTenantIssueStatusAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | `tenant_issues` | src/lib/backoffice/backoffice-health-actions.ts |
| `updateTrialStatus` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/saas-actions.ts |
| `updateViewingStatus` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/real-estate-actions.ts |
| `updateWorkspaceEntityOperations` | `crm_contacts`* | update | `L2_STATE_MUTATION` | wrap | `requireWorkspace` | — | `workspace_entities` | src/lib/profile-actions.ts |
| `updateWorkspaceFeaturesAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `organizations`, `workspaces` | src/lib/feature-actions.ts |
| `updateWorkspaceVocabularyAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | — | — | `vocabulary_map`, `workspaces` | src/lib/vocabulary-map-actions.ts |
| `upsertContractAction` | `crm_contacts`* | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:agreements`, `canUser:create`, `canUser:finance` | `contracts` | src/lib/contract-actions.ts |
| `upvoteWebinarQuestionAction` | `crm_contacts` | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | `webinar_questions` | src/app/actions/webinar-stage-actions.ts |
| `validateCustomDataCleanup` | `crm_contacts` | read | `L0_READ` | unmapped | `requireAuth` | — | `entities` | src/app/actions/cleanup-entity-customdata-action.ts |
| `validateImportBatch` | `crm_contacts` | read | `L0_READ` | unmapped | `requireAuth` | — | `entities`, `organizations`, `workspaces` | src/lib/import-export/entity-import-actions.ts |
| `validateJoinCodeAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `organizations` | src/app/actions/onboarding-actions.ts |
| `verifyDocumentPasscodeAction` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | `access_policies`, `flipbooks` | src/lib/document-actions.ts |
| `verifyUnsubscribeToken` | `crm_contacts`* | read | `L0_READ` | unmapped | — | — | — | src/lib/services/unsubscribe-service.ts |
| `acceptPublicQuoteAction` | `deals_revenue` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `deal_quotes`, `deals` | src/app/actions/deal-line-item-actions.ts |
| `actionBuyerSignalAction` | `deals_revenue` | execute | `L2_STATE_MUTATION`* | unmapped | `checkWorkspaceAccess`, `requireWorkspace`, `verifyCallerAccess` | — | `buyerSignals` | src/app/actions/deal-intelligence-actions.ts |
| `addDealContactAction` | `deals_revenue` | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `deals`, `entities`, `workspace_entities` | src/app/actions/deal-actions.ts |
| `applyStrategicRecommendationAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireWorkspace` | — | `aiStrategicRecommendations` | src/app/actions/revenue-os-actions.ts |
| `archiveDealAction` | `deals_revenue` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `canUser`, `requireAuth` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `deals` | src/app/actions/deal-actions.ts |
| `archivePipelineAction` | `deals_revenue` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `canUser`, `requireAuth` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `pipelines` | src/lib/pipeline-actions.ts |
| `bulkArchiveDealsAction` | `deals_revenue` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `deals` | src/app/actions/deal-actions.ts |
| `bulkAssignDealsAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `deals` | src/app/actions/deal-actions.ts |
| `bulkCreateDealsAction` | `deals_revenue` | create | `L2_STATE_MUTATION` | wrap | `requireAuth` | — | `deals`, `onboardingStages`, `pipelines`, `users`, `workspace_entities` | src/app/actions/bulk-deal-actions.ts |
| `bulkCreateDealsActionCore` | `deals_revenue` | create | `L2_STATE_MUTATION` | unmapped | — | — | `deals`, `onboardingStages`, `pipelines`, `users`, `workspace_entities` | src/app/actions/bulk-deal-actions.ts |
| `bulkDeleteDealsAction` | `deals_revenue` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `deals` | src/app/actions/deal-actions.ts |
| `bulkUpdateDealsStageAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `deals`, `onboardingStages` | src/app/actions/deal-actions.ts |
| `cleanLegacyDealNamesAction` | `deals_revenue` | execute | `L2_STATE_MUTATION`* | unmapped | `canUser`, `requireAuth` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `deals`, `entities`, `workspace_entities` | src/app/actions/deal-actions.ts |
| `clearStageDealsAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `deals`, `onboardingStages`, `workspaces` | src/app/actions/deal-actions.ts |
| `clonePipelineAction` | `deals_revenue` | create | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireAuth` | `canUser:create`, `canUser:operations`, `canUser:pipeline` | `onboardingStages`, `pipelines` | src/lib/pipeline-actions.ts |
| `convertLeadToDealAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireAuth` | `canUser:create`, `canUser:operations`, `canUser:pipeline` | `deals`, `entities`, `notes`, `onboardingStages`, `pipelines`, `workspace_entities` | src/app/actions/deal-actions.ts |
| `convertQuoteToInvoiceAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `deal_quotes`, `invoices` | src/app/actions/deal-line-item-actions.ts |
| `createDeal` | `deals_revenue` | create | `L2_STATE_MUTATION` | extend | — | — | `deals`, `entities`, `onboardingStages`, `pipelines`, `users`, `workspace_entities` | src/app/actions/deal-actions.ts |
| `createDealBulkJobAction` | `deals_revenue` | create | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `deal_bulk_jobs`, `deals` | src/app/actions/deal-bulk-job-actions.ts |
| `createDealQuoteAction` | `deals_revenue` | create | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireAuth` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `deal_quotes`, `deals` | src/app/actions/deal-line-item-actions.ts |
| `createDealSavedViewAction` | `deals_revenue` | create | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireAuth` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `deal_saved_views` | src/app/actions/deal-saved-view-actions.ts |
| `createDefaultPipelineForIndustry` | `deals_revenue` | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `pipelines`, `stages` | src/lib/pipeline-actions.ts |
| `createOrUpdateTargetAction` | `deals_revenue` | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `salesTargets` | src/app/actions/sales-performance-actions.ts |
| `createPipelineWithStagesAction` | `deals_revenue` | create | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireAuth`, `requireWorkspace` | `canUser:create`, `canUser:operations`, `canUser:pipeline` | `onboardingStages`, `pipelines` | src/lib/pipeline-actions.ts |
| `dealIntelligenceFlow` | `deals_revenue` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/deal-intelligence-flow.ts |
| `dealIntelligenceInputSchema` | `deals_revenue` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/deal-intelligence-flow.ts |
| `dealIntelligenceOutputSchema` | `deals_revenue` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/deal-intelligence-flow.ts |
| `DealQuickActions` | `deals_revenue` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/admin/deals/[id]/components/DealQuickActions.tsx |
| `deleteDealAction` | `deals_revenue` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `deals` | src/app/actions/deal-actions.ts |
| `deleteDealQuoteAction` | `deals_revenue` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `canUser`, `requireWorkspace` | `canUser:delete`, `canUser:operations`, `canUser:pipeline` | `deal_quotes` | src/app/actions/deal-line-item-actions.ts |
| `deleteDealSavedViewAction` | `deals_revenue` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `canUser`, `requireAuth` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `deal_saved_views` | src/app/actions/deal-saved-view-actions.ts |
| `deletePipelineAction` | `deals_revenue` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `canUser`, `requireAuth` | `canUser:delete`, `canUser:operations`, `canUser:pipeline` | `deals`, `onboardingStages`, `pipelines` | src/lib/pipeline-actions.ts |
| `deletePipelineTargetAction` | `deals_revenue` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `pipeline_targets` | src/app/actions/deal-analytics-actions.ts |
| `deleteRevenueScenarioAction` | `deals_revenue` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `checkWorkspaceAccess`, `requireWorkspace` | — | `revenueScenarios` | src/app/actions/revenue-os-actions.ts |
| `deleteTargetAction` | `deals_revenue` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireWorkspace` | — | `salesTargets` | src/app/actions/sales-performance-actions.ts |
| `duplicateDealAction` | `deals_revenue` | create | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireAuth` | `canUser:create`, `canUser:operations`, `canUser:pipeline` | `deals`, `onboardingStages`, `pipelines` | src/app/actions/deal-actions.ts |
| `enrichDealData` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/automated-deal-fer-actions.ts |
| `enrichDealsWithStageName` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | — | — | `deals`, `onboardingStages` | src/app/actions/backfill-deal-stagename-action.ts |
| `evaluateAndAdvanceDealOnMeetingAction` | `deals_revenue` | analyze | `L0_READ` | unmapped | `requireAuth` | — | `deal_activities`, `deals` | src/app/actions/deal-advancer-actions.ts |
| `executeDealIntelligenceMigrationAction` | `deals_revenue` | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | — | src/app/actions/deal-intelligence-actions.ts |
| `executeDealMigration` | `deals_revenue` | execute | `L2_STATE_MUTATION` | unmapped | — | — | `deals`, `workspace_entities` | src/app/actions/deal-migration-actions.ts |
| `executeOrchestrationMigrationAction` | `deals_revenue` | execute | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireWorkspace`, `verifyCallerAccess` | — | — | src/app/actions/sales-orchestration-actions.ts |
| `executePlayStepAction` | `deals_revenue` | execute | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireWorkspace`, `verifyCallerAccess` | — | `salesOrchestrationExecutions`, `salesOrchestrationPlays` | src/app/actions/sales-orchestration-actions.ts |
| `executeRevenueMigrationAction` | `deals_revenue` | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | — | src/app/actions/revenue-forecasting-actions.ts |
| `fetchCandidateDealsForFER` | `deals_revenue` | read | `L0_READ` | unmapped | — | — | `deals` | src/app/actions/automated-deal-fer-actions.ts |
| `fetchDealsForStageNameBackfill` | `deals_revenue` | read | `L0_READ` | unmapped | — | — | `deals` | src/app/actions/backfill-deal-stagename-action.ts |
| `generateDealAiInsightsAction` | `deals_revenue` | draft | `L1_INTERNAL_DRAFT` | unmapped | `canUser`, `requireWorkspace` | `canUser:operations`, `canUser:pipeline`, `canUser:view` | `deals`, `notes`, `products`, `subscription_packages` | src/app/actions/deal-ai-actions.ts |
| `generateDealBattlecardFlow` | `deals_revenue` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/generate-deal-battlecard-flow.ts |
| `generateDealBattlecardInputSchema` | `deals_revenue` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/generate-deal-battlecard-flow.ts |
| `generateDealBattlecardOutputSchema` | `deals_revenue` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/generate-deal-battlecard-flow.ts |
| `getDealBulkJobStatusAction` | `deals_revenue` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `deal_bulk_jobs` | src/app/actions/deal-bulk-job-actions.ts |
| `getDealHealthDetailAction` | `deals_revenue` | read | `L0_READ` | unmapped | `checkWorkspaceAccess`, `requireWorkspace`, `verifyCallerAccess` | — | `dealHealthScorecards`, `deals`, `stakeholderMaps` | src/app/actions/deal-intelligence-actions.ts |
| `getDealIntelligenceOverviewAction` | `deals_revenue` | read | `L0_READ` | wrap | `checkWorkspaceAccess`, `requireWorkspace`, `verifyCallerAccess` | — | `buyerSignals`, `dealHealthScorecards`, `dealIntelligenceGovernance`, `meetingBriefs` | src/app/actions/deal-intelligence-actions.ts |
| `getDealQuotesAction` | `deals_revenue` | read | `L0_READ` | wrap | `requireAuth` | — | `deal_quotes` | src/app/actions/deal-line-item-actions.ts |
| `getExecutiveBoardroomDataAction` | `deals_revenue` | read | `L0_READ` | unmapped | `checkWorkspaceAccess`, `requireWorkspace` | — | `aiStrategicRecommendations`, `deals`, `revenueOsGovernance`, `revenueScenarios`, `users` | src/app/actions/revenue-os-actions.ts |
| `getMeetingBriefAction` | `deals_revenue` | read | `L0_READ` | wrap | `checkWorkspaceAccess`, `requireWorkspace`, `verifyCallerAccess` | — | `meetingBriefs` | src/app/actions/deal-intelligence-actions.ts |
| `getPerformanceOverviewAction` | `deals_revenue` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `performancePolicies`, `salesPerformanceDaily`, `salesTargets`, `userEffortSummary`, `users` | src/app/actions/sales-performance-actions.ts |
| `getPipelineTargetsAction` | `deals_revenue` | read | `L0_READ` | wrap | `requireWorkspace` | — | `pipeline_targets` | src/app/actions/deal-analytics-actions.ts |
| `getPublicQuoteByTokenAction` | `deals_revenue` | read | `L0_READ` | unmapped | — | — | `deal_quotes` | src/app/actions/deal-line-item-actions.ts |
| `getRepAuditLedgerAction` | `deals_revenue` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `effortEvents`, `effortScoringLedger` | src/app/actions/sales-performance-actions.ts |
| `getRepPerformanceDetailAction` | `deals_revenue` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `performancePolicies`, `userEffortSummary` | src/app/actions/sales-performance-actions.ts |
| `getRevenueForecastOverviewAction` | `deals_revenue` | read | `L0_READ` | unmapped | `checkWorkspaceAccess`, `requireWorkspace`, `verifyCallerAccess` | — | `forecastDeals`, `forecastGovernance`, `quarterlyTargets`, `revenueAttribution` | src/app/actions/revenue-forecasting-actions.ts |
| `getSalesOrchestrationDataAction` | `deals_revenue` | read | `L0_READ` | unmapped | `checkWorkspaceAccess`, `requireWorkspace`, `verifyCallerAccess` | — | `salesOrchestrationApprovals`, `salesOrchestrationEscalations`, `salesOrchestrationExecutions`, `salesOrchestrationGovernance`, `salesOrchestrationIncidents`, `salesOrchestrationPlays`, `salesOrchestrationRoutingRules` | src/app/actions/sales-orchestration-actions.ts |
| `handleAddDealNote` | `deals_revenue` | create | `L2_STATE_MUTATION` | unmapped | — | — | `deal_notes`, `deals` | src/lib/automations/actions/deal-automation-actions.ts |
| `handleAssignDealOwner` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | — | — | `deals` | src/lib/automations/actions/deal-automation-actions.ts |
| `handleCreateDeal` | `deals_revenue` | create | `L2_STATE_MUTATION` | unmapped | — | — | `pipelines`, `workspace_entities` | src/lib/automations/actions/deal-automation-actions.ts |
| `handleCreateDealTask` | `deals_revenue` | create | `L2_STATE_MUTATION` | unmapped | — | — | `deals`, `tasks` | src/lib/automations/actions/deal-automation-actions.ts |
| `handleUpdateDealProbability` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | — | — | `deals` | src/lib/automations/actions/deal-automation-actions.ts |
| `handleUpdateDealStage` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | — | — | `deals` | src/lib/automations/actions/deal-automation-actions.ts |
| `handleUpdateDealStatus` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | — | — | `deals` | src/lib/automations/actions/deal-automation-actions.ts |
| `handleUpdateDealValue` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | — | — | `deals` | src/lib/automations/actions/deal-automation-actions.ts |
| `listDealSavedViewsAction` | `deals_revenue` | read | `L0_READ` | wrap | `requireAuth`, `requireWorkspace` | — | `deal_saved_views` | src/app/actions/deal-saved-view-actions.ts |
| `listWorkspaceTargetsAction` | `deals_revenue` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `salesTargets` | src/app/actions/sales-performance-actions.ts |
| `logDealInteractionAction` | `deals_revenue` | create | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `deals` | src/app/actions/deal-actions.ts |
| `mergeDealsAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `deals`, `tasks` | src/app/actions/deal-actions.ts |
| `PipelineActionsView` | `deals_revenue` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/admin/pipeline/components/PipelineActionsView.tsx |
| `processDealBulkJob` | `deals_revenue` | execute | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `deal_bulk_jobs`, `deals` | src/app/actions/deal-bulk-job-actions.ts |
| `reassignForecastCategoryAction` | `deals_revenue` | execute | `L2_STATE_MUTATION`* | unmapped | `checkWorkspaceAccess`, `requireWorkspace`, `verifyCallerAccess` | — | `forecastDeals` | src/app/actions/revenue-forecasting-actions.ts |
| `recalculateDealAttributionAction` | `deals_revenue` | execute | `L2_STATE_MUTATION`* | unmapped | `checkWorkspaceAccess`, `requireWorkspace`, `verifyCallerAccess` | — | `attributionTouchpoints`, `forecastDeals`, `forecastGovernance`, `revenueAttribution` | src/app/actions/revenue-forecasting-actions.ts |
| `removeDealContactAction` | `deals_revenue` | delete | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `deals` | src/app/actions/deal-actions.ts |
| `reseedRevenueOsDefaultsAction` | `deals_revenue` | execute | `L2_STATE_MUTATION`* | unmapped | `checkWorkspaceAccess`, `requireWorkspace` | — | — | src/app/actions/revenue-os-actions.ts |
| `resolveApprovalRequestAction` | `deals_revenue` | draft | `L1_INTERNAL_DRAFT` | unmapped | `checkWorkspaceAccess`, `requireWorkspace`, `verifyCallerAccess` | — | `salesOrchestrationApprovals` | src/app/actions/sales-orchestration-actions.ts |
| `resolveEscalationIncidentAction` | `deals_revenue` | draft | `L1_INTERNAL_DRAFT` | unmapped | `checkWorkspaceAccess`, `requireWorkspace`, `verifyCallerAccess` | — | `salesOrchestrationIncidents` | src/app/actions/sales-orchestration-actions.ts |
| `resolveWorkspaceEntityRecord` | `deals_revenue` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | `entities`, `workspace_entities` | src/app/actions/deal-actions.ts |
| `restoreDealStageNameBackfill` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | — | — | `deals` | src/app/actions/backfill-deal-stagename-action.ts |
| `rollbackDealStageNameBackfill` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | — | — | `deals` | src/app/actions/backfill-deal-stagename-action.ts |
| `runAutomatedDealFERProtocol` | `deals_revenue` | execute | `L2_STATE_MUTATION` | unmapped | — | — | `deals`, `workspace_entities` | src/app/actions/automated-deal-fer-actions.ts |
| `saveDealIntelligenceGovernanceAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireWorkspace`, `verifyCallerAccess` | — | `dealIntelligenceGovernance` | src/app/actions/deal-intelligence-actions.ts |
| `saveDealLineItemsAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | wrap | `canUser`, `requireAuth` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `deals` | src/app/actions/deal-line-item-actions.ts |
| `saveEscalationRuleAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireWorkspace`, `verifyCallerAccess` | — | `salesOrchestrationEscalations` | src/app/actions/sales-orchestration-actions.ts |
| `saveOrchestrationGovernanceAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireWorkspace`, `verifyCallerAccess` | — | `salesOrchestrationGovernance` | src/app/actions/sales-orchestration-actions.ts |
| `savePipelineAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireAuth` | `canUser:operations`, `canUser:pipeline` | `pipelines` | src/lib/pipeline-actions.ts |
| `savePipelineTargetAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireAuth` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `pipeline_targets` | src/app/actions/deal-analytics-actions.ts |
| `saveRevenueGovernanceAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireWorkspace`, `verifyCallerAccess` | — | `forecastGovernance` | src/app/actions/revenue-forecasting-actions.ts |
| `saveRevenueScenarioAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireWorkspace` | — | `effortEvents`, `revenueScenarios` | src/app/actions/revenue-os-actions.ts |
| `saveRoutingRuleAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireWorkspace`, `verifyCallerAccess` | — | `salesOrchestrationRoutingRules` | src/app/actions/sales-orchestration-actions.ts |
| `saveSalesPlayAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireWorkspace`, `verifyCallerAccess` | — | `salesOrchestrationPlays` | src/app/actions/sales-orchestration-actions.ts |
| `saveStakeholderMapAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireWorkspace`, `verifyCallerAccess` | — | `stakeholderMaps` | src/app/actions/deal-intelligence-actions.ts |
| `setPipelineAsDefaultAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `pipelines` | src/lib/pipeline-actions.ts |
| `simulateRevenueScenarioAction` | `deals_revenue` | draft | `L1_INTERNAL_DRAFT` | unmapped | `checkWorkspaceAccess`, `requireWorkspace` | — | — | src/app/actions/revenue-os-actions.ts |
| `submitPostMeetingIntelligenceAction` | `deals_revenue` | create | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireWorkspace`, `verifyCallerAccess` | — | `deals`, `meetingBriefs`, `postMeetingIntelligences`, `tasks` | src/app/actions/deal-intelligence-actions.ts |
| `toggleSalesPlayStatusAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireWorkspace`, `verifyCallerAccess` | — | `salesOrchestrationPlays` | src/app/actions/sales-orchestration-actions.ts |
| `triggerSalesPlayManuallyAction` | `deals_revenue` | execute | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireWorkspace`, `verifyCallerAccess` | — | `salesOrchestrationExecutions`, `salesOrchestrationPlays` | src/app/actions/sales-orchestration-actions.ts |
| `unarchiveDealAction` | `deals_revenue` | execute | `L2_STATE_MUTATION`* | unmapped | `canUser`, `requireAuth` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `deals` | src/app/actions/deal-actions.ts |
| `updateDealAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | wrap | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `deals` | src/app/actions/deal-actions.ts |
| `updateDealDetailsAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `deals` | src/app/actions/deal-actions.ts |
| `updateDealOwnerAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | — | — | `deals` | src/app/actions/deal-actions.ts |
| `updateDealProbabilityAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `deals` | src/app/actions/deal-actions.ts |
| `updateDealSavedViewAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireAuth` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `deal_saved_views` | src/app/actions/deal-saved-view-actions.ts |
| `updateDealStageAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | wrap | `canUser` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `deals`, `onboardingStages` | src/app/actions/deal-actions.ts |
| `updateDealStatusAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | — | — | `deals` | src/app/actions/deal-actions.ts |
| `updateDealValueAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | — | — | `deals` | src/app/actions/deal-actions.ts |
| `updateQuoteStatusAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | `canUser` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `deal_quotes` | src/app/actions/deal-line-item-actions.ts |
| `updateRevenueOsGovernanceAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireWorkspace` | — | `revenueOsGovernance` | src/app/actions/revenue-os-actions.ts |
| `updateStageOrdersAction` | `deals_revenue` | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireAuth` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `onboardingStages` | src/app/actions/deal-actions.ts |
| `POST /api/admin/seed-experience` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | `authenticateApiRequest` | — | — | src/app/api/admin/seed-experience/route.ts |
| `GET /api/v1/media/experiences` | `experience_portal` | read | `L0_READ` | unmapped | `authenticateApiRequest` | — | `media_experiences` | src/app/api/v1/media/experiences/route.ts |
| `acceptInvitationAction` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/actions/membership-actions.ts |
| `AiExperienceService` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `ai_pedagogy_diagnostics`, `ai_tutor_sessions` | src/lib/services/ai-experience-service.ts |
| `archivePlanAction` | `experience_portal` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/app/actions/membership-actions.ts |
| `archivePortalAction` | `experience_portal` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/app/actions/portal-actions.ts |
| `askAiTutorAction` | `experience_portal` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/app/actions/ai-experience-actions.ts |
| `castPollVoteAction` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/actions/community-actions.ts |
| `checkEntitlementAction` | `experience_portal` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/membership-actions.ts |
| `CommunityService` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `community_comments`, `community_polls`, `community_posts`, `community_reactions`, `community_spaces`, `moderation_reports`, `poll_votes`, `portal_memberships` | src/lib/services/community-service.ts |
| `completeLessonAction` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/actions/learning-actions.ts |
| `CourseService` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `course_assessments`, `course_certificates`, `course_enrollments`, `course_lessons`, `course_modules`, `courses`, `learning_progress` | src/lib/services/course-service.ts |
| `createBadgeDefinitionAction` | `experience_portal` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/credential-actions.ts |
| `createBulkInvitationsAction` | `experience_portal` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/membership-actions.ts |
| `createCertificateTemplateAction` | `experience_portal` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/credential-actions.ts |
| `createCommentAction` | `experience_portal` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/community-actions.ts |
| `createCourseAction` | `experience_portal` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/learning-actions.ts |
| `createInvitationAction` | `experience_portal` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/membership-actions.ts |
| `createLearningSignalAction` | `experience_portal` | create | `L2_STATE_MUTATION` | unmapped | — | — | `learning_signals` | src/lib/learning-loop-actions.ts |
| `createLessonAction` | `experience_portal` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/learning-actions.ts |
| `createMembershipAction` | `experience_portal` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/membership-actions.ts |
| `createModuleAction` | `experience_portal` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/learning-actions.ts |
| `createPlanAction` | `experience_portal` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/membership-actions.ts |
| `createPortalAction` | `experience_portal` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/portal-actions.ts |
| `createPostAction` | `experience_portal` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/community-actions.ts |
| `createSpaceAction` | `experience_portal` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/community-actions.ts |
| `CredentialService` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `awarded_badges`, `badge_definitions`, `certificate_codes`, `certificate_templates`, `issued_certificates`, `xapi_statements` | src/lib/services/credential-service.ts |
| `deleteCommentAction` | `experience_portal` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/app/actions/community-actions.ts |
| `deleteCourseAction` | `experience_portal` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/app/actions/learning-actions.ts |
| `deleteLearningSignalsBySurveyAction` | `experience_portal` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | `learning_signals` | src/lib/learning-loop-actions.ts |
| `deleteLessonAction` | `experience_portal` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/app/actions/learning-actions.ts |
| `deleteMembershipAction` | `experience_portal` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/app/actions/membership-actions.ts |
| `deleteModuleAction` | `experience_portal` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/app/actions/learning-actions.ts |
| `deletePortalAction` | `experience_portal` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/app/actions/portal-actions.ts |
| `deletePostAction` | `experience_portal` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/app/actions/community-actions.ts |
| `deleteSpaceAction` | `experience_portal` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/app/actions/community-actions.ts |
| `duplicatePortalAction` | `experience_portal` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/portal-actions.ts |
| `enrollInCourseAction` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/actions/learning-actions.ts |
| `evaluateContentAccessAction` | `experience_portal` | analyze | `L0_READ` | unmapped | — | — | — | src/app/actions/membership-actions.ts |
| `exportOpenBadgeAction` | `experience_portal` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/credential-actions.ts |
| `fetchAudiencesAction` | `experience_portal` | read | `L0_READ` | unmapped | `requireAuth` | — | `audiences` | src/lib/experience-actions.ts |
| `fetchPageExperienceRulesAction` | `experience_portal` | read | `L0_READ` | unmapped | `requireAuth` | — | `experience_rules` | src/lib/experience-actions.ts |
| `finalizeLearningSignalAction` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `learning_signals` | src/lib/learning-loop-actions.ts |
| `generateCertificateCode` | `experience_portal` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/lib/services/certificate-code.ts |
| `generateCertificateCodeBody` | `experience_portal` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/lib/services/certificate-code.ts |
| `generateCurriculumAction` | `experience_portal` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/app/actions/ai-experience-actions.ts |
| `generatePortalScaffoldAction` | `experience_portal` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/app/actions/ai-experience-actions.ts |
| `generateQuizAction` | `experience_portal` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/app/actions/ai-experience-actions.ts |
| `getCommunityLeaderboardAction` | `experience_portal` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/community-actions.ts |
| `getCoursePedagogyDiagnosticAction` | `experience_portal` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/ai-experience-actions.ts |
| `getGoldStandardExamples` | `experience_portal` | read | `L0_READ` | unmapped | `requireAuth` | — | `learning_signals` | src/lib/learning-loop-actions.ts |
| `getMemberPublicProfileAction` | `experience_portal` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/community-actions.ts |
| `getPortalAnalyticsAction` | `experience_portal` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/portal-analytics-actions.ts |
| `getPortalByIdAction` | `experience_portal` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/portal-actions.ts |
| `getPublicPortalBySlugAction` | `experience_portal` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/portal-actions.ts |
| `getSanitizedAssessmentAction` | `experience_portal` | read | `L0_READ` | unmapped | — | — | `course_assessments` | src/app/actions/learning-actions.ts |
| `grantAccessAction` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/actions/membership-actions.ts |
| `issueCertificateAction` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/actions/credential-actions.ts |
| `joinPortalDirectAction` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `users` | src/app/actions/membership-actions.ts |
| `LearningProgressService` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `assignment_submissions`, `course_assessments`, `course_certificates`, `course_enrollments`, `course_lessons`, `course_modules`, `courses`, `learning_progress`, `portal_memberships` | src/lib/services/learning-progress-service.ts |
| `listBadgeDefinitionsAction` | `experience_portal` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/credential-actions.ts |
| `listCertificateTemplatesAction` | `experience_portal` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/credential-actions.ts |
| `listCoursesByPortalAction` | `experience_portal` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/learning-actions.ts |
| `listInvitationsByPortalAction` | `experience_portal` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/membership-actions.ts |
| `listIssuedCertificatesAction` | `experience_portal` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/credential-actions.ts |
| `listLessonPostsAction` | `experience_portal` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/community-actions.ts |
| `listLessonsByCourseAction` | `experience_portal` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/learning-actions.ts |
| `listMembershipsByPortalAction` | `experience_portal` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/membership-actions.ts |
| `listModerationReportsAction` | `experience_portal` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/community-actions.ts |
| `listPlansByPortalAction` | `experience_portal` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/membership-actions.ts |
| `listSpacesByPortalAction` | `experience_portal` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/community-actions.ts |
| `listXApiStatementsAction` | `experience_portal` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/credential-actions.ts |
| `MembershipPlanService` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/membership-plan-service.ts |
| `normaliseCertificateCode` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/certificate-code.ts |
| `normalizeExistingPortalNavigationAction` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/actions/portal-actions.ts |
| `OrganizationMembershipService` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/identity/organization-membership-service.ts |
| `PortalAccessService` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/portal-access-service.ts |
| `PortalAnalyticsService` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `community_comments`, `community_posts`, `course_enrollments`, `portal_analytics_snapshots`, `portal_memberships`, `portal_orders` | src/lib/services/portal-analytics-service.ts |
| `PortalEventService` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/portal-event-service.ts |
| `PortalInvitationService` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/portal-invitation-service.ts |
| `PortalMembershipService` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `portals`, `users` | src/lib/services/portal-membership-service.ts |
| `PortalService` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `portals` | src/lib/services/portal-service.ts |
| `publishPortalAction` | `experience_portal` | publish | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | — | — | — | src/app/actions/portal-actions.ts |
| `reactivateMembershipAction` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/actions/membership-actions.ts |
| `recordVideoProgressAction` | `experience_portal` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/learning-actions.ts |
| `refreshPortalAnalyticsAction` | `experience_portal` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/portal-analytics-actions.ts |
| `reportContentAction` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/actions/community-actions.ts |
| `resolveModerationReportAction` | `experience_portal` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/app/actions/community-actions.ts |
| `revokeAccessAction` | `experience_portal` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/app/actions/membership-actions.ts |
| `revokeCertificateAction` | `experience_portal` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/app/actions/credential-actions.ts |
| `revokeInvitationAction` | `experience_portal` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/app/actions/membership-actions.ts |
| `runMasterExperienceSeederAction` | `experience_portal` | execute | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/portal-actions.ts |
| `saveAudienceAction` | `experience_portal` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `audiences` | src/lib/experience-actions.ts |
| `saveExperienceRuleAction` | `experience_portal` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `campaign_pages`, `experience_rules` | src/lib/experience-actions.ts |
| `seedCommunitySpacesAction` | `experience_portal` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/community-actions.ts |
| `submitAssessmentAction` | `experience_portal` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/learning-actions.ts |
| `submitAssignmentAction` | `experience_portal` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/learning-actions.ts |
| `suspendMembershipAction` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/actions/membership-actions.ts |
| `suspendPortalAction` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/actions/portal-actions.ts |
| `synthesizeCampaignLearningsFlow` | `experience_portal` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/synthesize-campaign-learnings-flow.ts |
| `synthesizeCampaignLearningsInputSchema` | `experience_portal` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/synthesize-campaign-learnings-flow.ts |
| `synthesizeCampaignLearningsOutputSchema` | `experience_portal` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/synthesize-campaign-learnings-flow.ts |
| `togglePinPostAction` | `experience_portal` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/community-actions.ts |
| `toggleReactionAction` | `experience_portal` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/community-actions.ts |
| `updateCourseAction` | `experience_portal` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/learning-actions.ts |
| `updateLessonAction` | `experience_portal` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/learning-actions.ts |
| `updateMembershipPlanAction` | `experience_portal` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/membership-actions.ts |
| `updateMembershipRoleAction` | `experience_portal` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/membership-actions.ts |
| `updateMembershipTagsAction` | `experience_portal` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/membership-actions.ts |
| `updateModuleAction` | `experience_portal` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/learning-actions.ts |
| `updatePlanAction` | `experience_portal` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/membership-actions.ts |
| `updatePortalAction` | `experience_portal` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/portal-actions.ts |
| `updatePortalMemberProfileAction` | `experience_portal` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/membership-actions.ts |
| `updatePostAction` | `experience_portal` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/community-actions.ts |
| `updateSignalRatingAction` | `experience_portal` | update | `L2_STATE_MUTATION` | unmapped | — | — | `learning_signals` | src/lib/learning-loop-actions.ts |
| `updateSpaceAction` | `experience_portal` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/community-actions.ts |
| `validatePortalPasswordAction` | `experience_portal` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/portal-actions.ts |
| `verifyCertificateAction` | `experience_portal` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/credential-actions.ts |
| `verifyInvitationTokenAction` | `experience_portal` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/membership-actions.ts |
| `verifyPortalSlugAvailabilityAction` | `experience_portal` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/portal-actions.ts |
| `WorkspaceMembershipService` | `experience_portal` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/identity/workspace-membership-service.ts |
| `AgingService` | `finance_subscriptions` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `financial_accounts`, `invoices` | src/lib/services/aging-service.ts |
| `calculateInvoiceAging` | `finance_subscriptions` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/lib/services/aging-utils.ts |
| `CommerceService` | `finance_subscriptions` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `affiliate_partners`, `affiliate_referrals`, `portal_coupons`, `portal_memberships`, `portal_offers`, `portal_orders`, `portal_waitlists` | src/lib/services/commerce-service.ts |
| `createCouponAction` | `finance_subscriptions` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/commerce-actions.ts |
| `createCreditNoteAction` | `finance_subscriptions` | create | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireAuth` | `canUser:create`, `canUser:finance`, `canUser:invoices` | — | src/lib/credit-note-actions.ts |
| `createOfferAction` | `finance_subscriptions` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/commerce-actions.ts |
| `CreditNoteSequenceService` | `finance_subscriptions` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `system_counters` | src/lib/services/credit-note-sequence-service.ts |
| `CreditNoteService` | `finance_subscriptions` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `credit_notes`, `financial_accounts`, `financial_transactions`, `invoices`, `system_counters` | src/lib/services/credit-note-service.ts |
| `deleteCouponAction` | `finance_subscriptions` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/app/actions/commerce-actions.ts |
| `deleteInvoiceAction` | `finance_subscriptions` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `canUser`, `requireAuth` | `canUser:delete`, `canUser:finance`, `canUser:invoices` | `invoices` | src/lib/billing-actions.ts |
| `deleteOfferAction` | `finance_subscriptions` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/app/actions/commerce-actions.ts |
| `determineReminderStage` | `finance_subscriptions` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/finance-reminder-utils.ts |
| `disputeInvoiceAction` | `finance_subscriptions` | execute | `L2_STATE_MUTATION`* | unmapped | `canUser`, `requireAuth` | `canUser:edit`, `canUser:finance`, `canUser:invoices` | `invoices` | src/lib/billing-actions.ts |
| `FinanceMigrationService` | `finance_subscriptions` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `financial_accounts`, `financial_transactions`, `invoices`, `workspace_entities` | src/lib/services/finance-migration-service.ts |
| `FinanceReportingService` | `finance_subscriptions` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `collection_cases`, `financial_accounts`, `invoices`, `payments`, `promises_to_pay` | src/lib/services/finance-reporting-service.ts |
| `formatReminderMessage` | `finance_subscriptions` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/finance-reminder-utils.ts |
| `generateInvoiceAction` | `finance_subscriptions` | draft | `L1_INTERNAL_DRAFT` | unmapped | `canUser`, `requireWorkspace` | `canUser:create`, `canUser:finance`, `canUser:invoices` | `billing_periods`, `billing_profiles`, `invoices`, `subscription_packages` | src/lib/billing-actions.ts |
| `getAccountLedgerAction` | `finance_subscriptions` | read | `L0_READ` | unmapped | `requireWorkspace` | — | — | src/lib/finance-actions.ts |
| `getCreditNotesByAccountAction` | `finance_subscriptions` | read | `L0_READ` | unmapped | `canUser`, `requireWorkspace` | `canUser:finance`, `canUser:invoices`, `canUser:view` | `credit_notes` | src/lib/credit-note-actions.ts |
| `getFinancialOverviewAction` | `finance_subscriptions` | read | `L0_READ` | unmapped | — | — | — | src/lib/backoffice/backoffice-finance-actions.ts |
| `getInvoiceAllocationsAction` | `finance_subscriptions` | read | `L0_READ` | extend | — | — | — | src/lib/finance-actions.ts |
| `getInvoicesByEntityAction` | `finance_subscriptions` | read | `L0_READ` | wrap | `requireWorkspace` | — | `invoices` | src/lib/billing-actions.ts |
| `getOrCreateFinancialAccountAction` | `finance_subscriptions` | read | `L0_READ` | unmapped | `requireWorkspace` | — | — | src/lib/finance-actions.ts |
| `getParkedJobsCountAction` | `finance_subscriptions` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/node-deletion-reconciliation-actions.ts |
| `getPaymentsForAccountAction` | `finance_subscriptions` | read | `L0_READ` | wrap | `requireAuth` | — | — | src/lib/finance-actions.ts |
| `getPublicInvoiceAction` | `finance_subscriptions` | read | `L0_READ` | extend | — | — | `invoices` | src/lib/billing-actions.ts |
| `getReconciliationReportAction` | `finance_subscriptions` | read | `L0_READ` | unmapped | `canUser` | `canUser:finance`, `canUser:invoices`, `canUser:view` | — | src/lib/reconciliation-actions.ts |
| `getUnpaidInvoicesForEntityAction` | `finance_subscriptions` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `invoices` | src/lib/finance-actions.ts |
| `InvoiceLifecycleService` | `finance_subscriptions` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `financial_accounts`, `financial_transactions`, `invoices`, `payment_allocations`, `payments`, `system_counters` | src/lib/services/invoice-lifecycle-service.ts |
| `InvoiceSequenceService` | `finance_subscriptions` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `system_counters` | src/lib/services/invoice-sequence-service.ts |
| `InvoiceSnapshotService` | `finance_subscriptions` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `billing_profiles`, `workspace_entities` | src/lib/services/invoice-snapshot-service.ts |
| `joinPortalWaitlistAction` | `finance_subscriptions` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/actions/commerce-actions.ts |
| `LedgerService` | `finance_subscriptions` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `financial_accounts`, `financial_transactions` | src/lib/services/ledger-service.ts |
| `listAffiliatesByPortalAction` | `finance_subscriptions` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/commerce-actions.ts |
| `listCouponsByPortalAction` | `finance_subscriptions` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/commerce-actions.ts |
| `listOffersByPortalAction` | `finance_subscriptions` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/commerce-actions.ts |
| `listOrdersByPortalAction` | `finance_subscriptions` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/commerce-actions.ts |
| `PaymentPlanService` | `finance_subscriptions` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `collection_cases`, `payment_plans` | src/lib/services/payment-plan-service.ts |
| `PaymentService` | `finance_subscriptions` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `financial_accounts`, `financial_transactions`, `invoices`, `payment_allocations`, `payments` | src/lib/services/payment-service.ts |
| `processCheckoutOrderAction` | `finance_subscriptions` | execute | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/commerce-actions.ts |
| `reconcileOrphanedRunsAction` | `finance_subscriptions` | update | `L2_STATE_MUTATION` | unmapped | `assertAutomationManagePermission`, `requireAuth` | `assertAutomationManagePermission:edit` | `automation_jobs`, `automation_runs`, `automations` | src/app/actions/orphaned-runs-reconciliation-actions.ts |
| `reconcileParkedJobsOnNodeDeletionAction` | `finance_subscriptions` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/node-deletion-reconciliation-actions.ts |
| `ReconciliationService` | `finance_subscriptions` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `payments` | src/lib/services/reconciliation-service.ts |
| `recordPaymentAction` | `finance_subscriptions` | create | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireAuth` | `canUser:edit`, `canUser:finance`, `canUser:invoices` | `payments` | src/lib/finance-actions.ts |
| `recoverFailedRunsAction` | `finance_subscriptions` | execute | `L2_STATE_MUTATION`* | unmapped | `assertAutomationManagePermission`, `requireAuth` | `assertAutomationManagePermission:edit` | `automation_runs` | src/app/actions/orphaned-runs-reconciliation-actions.ts |
| `RecurringBillingService` | `finance_subscriptions` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `billing_agreements`, `billing_periods`, `billing_profiles`, `invoices` | src/lib/services/recurring-billing-service.ts |
| `registerAffiliatePartnerAction` | `finance_subscriptions` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/commerce-actions.ts |
| `resolveReconciliationDiscrepancyAction` | `finance_subscriptions` | draft | `L1_INTERNAL_DRAFT` | unmapped | `canUser` | `canUser:edit`, `canUser:finance`, `canUser:invoices` | — | src/lib/reconciliation-actions.ts |
| `scanOrphanedRunsAction` | `finance_subscriptions` | analyze | `L0_READ` | unmapped | `assertAutomationManagePermission`, `requireWorkspace` | `assertAutomationManagePermission:edit` | `automation_runs`, `automations` | src/app/actions/orphaned-runs-reconciliation-actions.ts |
| `StatementService` | `finance_subscriptions` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `financial_accounts`, `financial_transactions` | src/lib/services/statement-service.ts |
| `triggerDunningEscalationAction` | `finance_subscriptions` | execute | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/backoffice/backoffice-finance-actions.ts |
| `updateAffiliatePartnerStatusAction` | `finance_subscriptions` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/commerce-actions.ts |
| `updateInvoiceAction` | `finance_subscriptions` | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireAuth` | `canUser:edit`, `canUser:finance`, `canUser:invoices` | `invoices` | src/lib/billing-actions.ts |
| `updateOfferAction` | `finance_subscriptions` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/commerce-actions.ts |
| `validateCouponAction` | `finance_subscriptions` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/commerce-actions.ts |
| `voidInvoiceAction` | `finance_subscriptions` | execute | `L2_STATE_MUTATION`* | unmapped | `canUser`, `requireAuth` | `canUser:delete`, `canUser:finance`, `canUser:invoices` | `invoices` | src/lib/billing-actions.ts |
| `OPTIONS /api/external/forms/submit` | `forms_surveys` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/api/external/forms/submit/route.ts |
| `POST /api/external/forms/submit` | `forms_surveys` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/api/external/forms/submit/route.ts |
| `POST /api/migration/survey-seo` | `forms_surveys` | execute | `L2_STATE_MUTATION`* | unmapped | `authenticateApiRequest` | — | `surveys` | src/app/api/migration/survey-seo/route.ts |
| `addOrMoveEntityInPipeline` | `forms_surveys` | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `deals`, `onboardingStages` | src/lib/survey-actions.ts |
| `addSubmissionNoteAction` | `forms_surveys` | create | `L2_STATE_MUTATION` | unmapped | — | — | `form_submissions`, `notes` | src/lib/forms/form-response-actions.ts |
| `applySurveyAiOptimizationAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `surveys` | src/lib/surveys/survey-ai-intelligence-actions.ts |
| `assignSurveysToProjectAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `survey_projects`, `surveys` | src/lib/surveys/survey-project-actions.ts |
| `auditFormFrictionFlow` | `forms_surveys` | analyze | `L0_READ` | extend | — | — | `organizations` | src/ai/flows/ai-form-assistant-flow.ts |
| `auditSurveyQualityAction` | `forms_surveys` | analyze | `L0_READ` | wrap | `requireWorkspace` | — | `surveys` | src/lib/surveys/survey-ai-intelligence-actions.ts |
| `auditSurveyQualityFlow` | `forms_surveys` | analyze | `L0_READ` | extend | — | — | `organizations` | src/ai/flows/survey-ai-reviewer-flow.ts |
| `autoSaveSurveyAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | `canUser` | `canUser:studios`, `canUser:surveys` | `surveys` | src/lib/survey-actions.ts |
| `batchClassifySubmissionsAction` | `forms_surveys` | analyze | `L0_READ` | unmapped | `requireAuth` | — | `form_submissions`, `forms` | src/lib/forms/form-intelligence-actions.ts |
| `BulkActionsBar` | `forms_surveys` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/admin/surveys/components/BulkActionsBar.tsx |
| `bulkApplyTagsToSurveyEntitiesAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:contacts`, `canUser:edit`, `canUser:operations` | `contacts`, `workspace_entities` | src/lib/survey-entity-actions.ts |
| `bulkMoveSurveyEntitiesStageAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:operations`, `canUser:pipeline` | `contacts`, `deals`, `entities`, `onboardingStages`, `workspace_entities` | src/lib/survey-entity-actions.ts |
| `bulkUpdateSubmissionsAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | — | — | `form_submissions` | src/lib/forms/form-response-actions.ts |
| `calculateEntityPredictiveHealthAction` | `forms_surveys` | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireAuth`, `requireWorkspace` | — | `contacts`, `deals`, `responses`, `surveys`, `system_config`, `workspace_entities` | src/lib/surveys/survey-predictive-actions.ts |
| `classifyFormSubmissionFlow` | `forms_surveys` | analyze | `L0_READ` | extend | — | — | `organizations` | src/ai/flows/form-intelligence-flow.ts |
| `classifySubmissionAction` | `forms_surveys` | analyze | `L0_READ` | unmapped | `requireAuth` | — | `form_submissions`, `forms` | src/lib/forms/form-intelligence-actions.ts |
| `cloneFormAction` | `forms_surveys` | create | `L2_STATE_MUTATION` | unmapped | `canUser` | `canUser:create`, `canUser:forms`, `canUser:studios` | `forms` | src/lib/forms-actions.ts |
| `cloneSurvey` | `forms_surveys` | create | `L2_STATE_MUTATION` | unmapped | `canUser` | `canUser:create`, `canUser:studios`, `canUser:surveys` | `resultPages`, `surveys` | src/lib/survey-actions.ts |
| `clusterFormTopicsFlow` | `forms_surveys` | execute | `L2_STATE_MUTATION`* | extend | — | — | `organizations` | src/ai/flows/form-intelligence-flow.ts |
| `computeFormHealthScoreAction` | `forms_surveys` | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireAuth` | — | `forms`, `optimization` | src/lib/forms/form-optimization-actions.ts |
| `concludeSurveyWaveAction` | `forms_surveys` | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | `survey_projects`, `waves` | src/lib/surveys/survey-longitudinal-actions.ts |
| `createDistributionLinkAction` | `forms_surveys` | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `form_distributions`, `forms` | src/lib/forms/form-distribution-actions.ts |
| `createDraftVersionAction` | `forms_surveys` | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `surveys`, `versions` | src/lib/surveys/survey-version-actions.ts |
| `createFormAction` | `forms_surveys` | create | `L2_STATE_MUTATION` | unmapped | `canUser` | `canUser:create`, `canUser:forms`, `canUser:studios` | `forms` | src/lib/forms-actions.ts |
| `createFormExperimentAction` | `forms_surveys` | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `experiments`, `forms` | src/lib/forms/form-optimization-actions.ts |
| `createOrUpdateRoutingFormAction` | `forms_surveys` | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `routing_forms` | src/app/actions/routing-form-actions.ts |
| `createSurveyDeploymentAction` | `forms_surveys` | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `survey_deployments`, `surveys` | src/lib/surveys/survey-deployment-actions.ts |
| `createSurveyFromAiAction` | `forms_surveys` | create | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireAuth` | `canUser:create`, `canUser:studios`, `canUser:surveys` | `_`, `resultPages`, `surveys` | src/lib/ai-survey-actions.ts |
| `createSurveyProjectAction` | `forms_surveys` | create | `L2_STATE_MUTATION` | unmapped | — | — | `survey_projects`, `surveys` | src/lib/surveys/survey-project-actions.ts |
| `createSurveyWaveAction` | `forms_surveys` | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `survey_projects`, `waves` | src/lib/surveys/survey-longitudinal-actions.ts |
| `deleteDistributionLinkAction` | `forms_surveys` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireAuth` | — | `form_distributions` | src/lib/forms/form-distribution-actions.ts |
| `deleteFormAction` | `forms_surveys` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `canUser` | `canUser:delete`, `canUser:forms`, `canUser:studios` | `form_submissions`, `forms`, `versions` | src/lib/forms-actions.ts |
| `deleteFormSavedViewAction` | `forms_surveys` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireAuth` | — | `form_saved_views` | src/lib/forms/form-response-actions.ts |
| `deleteRoutingFormAction` | `forms_surveys` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireWorkspace` | — | `routing_forms` | src/app/actions/routing-form-actions.ts |
| `deleteSurveyAction` | `forms_surveys` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `canUser` | `canUser:delete`, `canUser:studios`, `canUser:surveys` | `responses`, `resultPages`, `surveys` | src/lib/survey-actions.ts |
| `deleteSurveyResponses` | `forms_surveys` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `canUser` | `canUser:delete`, `canUser:studios`, `canUser:surveys` | `responses`, `surveys` | src/lib/survey-actions.ts |
| `detectSurveyAnomaliesFlow` | `forms_surveys` | analyze | `L0_READ` | extend | — | — | `organizations` | src/ai/flows/survey-anomaly-detection-flow.ts |
| `dispatchFormNotifications` | `forms_surveys` | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | — | — | — | src/lib/forms/form-notification-actions.ts |
| `executeCrmInboundSurveyTriggerAction` | `forms_surveys` | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth`, `requireWorkspace` | — | `surveys` | src/lib/surveys/survey-crm-trigger-actions.ts |
| `executePredictiveNextBestAction` | `forms_surveys` | execute | `L2_STATE_MUTATION` | unmapped | — | — | `tasks` | src/lib/surveys/survey-predictive-actions.ts |
| `executeRecommendedAction` | `forms_surveys` | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `form_submissions`, `tasks` | src/lib/forms/form-intelligence-actions.ts |
| `executeSurveyCrmSyncAction` | `forms_surveys` | execute | `L2_STATE_MUTATION` | unmapped | — | — | `activities`, `contacts`, `tasks`, `workspace_entities` | src/lib/surveys/survey-crm-sync-actions.ts |
| `executeSurveyDataRetentionAction` | `forms_surveys` | execute | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `responses`, `surveys` | src/lib/surveys/survey-retention-actions.ts |
| `executeSurveyPipelineAndAutomations` | `forms_surveys` | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `deals`, `onboardingStages` | src/lib/survey-actions.ts |
| `executeSurveyResultButtonActions` | `forms_surveys` | execute | `L2_STATE_MUTATION` | unmapped | — | — | `surveys` | src/lib/survey-actions.ts |
| `exportAnalyticsDataAsCsvAction` | `forms_surveys` | read | `L0_READ` | unmapped | `requireAuth` | — | `app_fields`, `form_metrics_daily`, `forms` | src/lib/forms/form-analytics-actions.ts |
| `exportHighResolutionAssetAction` | `forms_surveys` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/creative-performance-actions.ts |
| `exportSubmissionsAsCsvAction` | `forms_surveys` | read | `L0_READ` | unmapped | — | — | `app_fields`, `form_submissions`, `forms` | src/lib/forms-actions.ts |
| `exportSurveyDataAction` | `forms_surveys` | read | `L0_READ` | unmapped | — | — | `responses`, `surveys` | src/lib/surveys/survey-analytics-actions.ts |
| `finalizeSurveySubmission` | `forms_surveys` | execute | `L2_STATE_MUTATION`* | unmapped | `ensureEntitySharedToWorkspace`, `requireAuth`, `requireWorkspace` | — | `deals`, `entities`, `onboardingStages`, `responses`, `surveys`, `webhooks`, `workspace_entities`, `workspaces` | src/lib/survey-actions.ts |
| `generateFormCustomReportAction` | `forms_surveys` | draft | `L1_INTERNAL_DRAFT` | wrap | `requireAuth` | — | `forms` | src/lib/forms/form-reports-actions.ts |
| `generateFormFlow` | `forms_surveys` | draft | `L1_INTERNAL_DRAFT` | extend | — | — | `organizations` | src/ai/flows/generate-form-flow.ts |
| `generateFormLogicWithAiAction` | `forms_surveys` | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireAuth` | — | — | src/lib/forms/form-ai-actions.ts |
| `generateFormWithAi` | `forms_surveys` | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireAuth` | — | `organizations` | src/ai/flows/generate-form-flow.ts |
| `generateFormWithAiAction` | `forms_surveys` | draft | `L1_INTERNAL_DRAFT` | wrap | `requireAuth` | — | `app_fields`, `draft_versions`, `forms` | src/lib/forms/form-ai-actions.ts |
| `generateKeywordsAction` | `forms_surveys` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/app/actions/survey-seo-actions.ts |
| `generateSurvey` | `forms_surveys` | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireAuth` | — | `organizations` | src/ai/flows/generate-survey-flow.ts |
| `generateSurveyBlueprint` | `forms_surveys` | draft | `L1_INTERNAL_DRAFT` | extend | — | — | `organizations` | src/ai/flows/generate-survey-chunked-flow.ts |
| `generateSurveyChunked` | `forms_surveys` | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireAuth` | — | `organizations` | src/ai/flows/generate-survey-chunked-flow.ts |
| `generateSurveyLogic` | `forms_surveys` | draft | `L1_INTERNAL_DRAFT` | extend | — | — | `organizations` | src/ai/flows/generate-survey-chunked-flow.ts |
| `generateSurveyQuestions` | `forms_surveys` | draft | `L1_INTERNAL_DRAFT` | extend | — | — | `organizations` | src/ai/flows/generate-survey-chunked-flow.ts |
| `generateSurveySentimentThemesFlow` | `forms_surveys` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | `organizations` | src/ai/flows/survey-sentiment-theme-flow.ts |
| `generateSurveySummary` | `forms_surveys` | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireAuth` | — | `organizations` | src/ai/flows/generate-survey-summary-flow.ts |
| `generateSurveyThematicInsightsAction` | `forms_surveys` | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireWorkspace` | — | `ai_insights`, `responses`, `surveys` | src/lib/surveys/survey-ai-intelligence-actions.ts |
| `getAssigneeDetails` | `forms_surveys` | read | `L0_READ` | unmapped | `requireAuth` | — | `users` | src/app/actions/survey-assignee-actions.ts |
| `getEntitySurveyHistoryAction` | `forms_surveys` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `responses`, `surveys` | src/lib/surveys/survey-crm-trigger-actions.ts |
| `getFormAnalyticsAction` | `forms_surveys` | read | `L0_READ` | wrap | `requireAuth` | — | `app_fields`, `form_metrics_daily`, `forms` | src/lib/forms/form-analytics-actions.ts |
| `getFormByIdAction` | `forms_surveys` | read | `L0_READ` | unmapped | — | — | `forms` | src/lib/forms-actions.ts |
| `getFormDistributionsAction` | `forms_surveys` | read | `L0_READ` | wrap | `requireAuth` | — | `form_distributions` | src/lib/forms/form-distribution-actions.ts |
| `getFormExperimentsAction` | `forms_surveys` | read | `L0_READ` | unmapped | `requireAuth` | — | `experiments`, `forms` | src/lib/forms/form-optimization-actions.ts |
| `getFormSavedViewsAction` | `forms_surveys` | read | `L0_READ` | unmapped | `requireAuth` | — | `form_saved_views` | src/lib/forms/form-response-actions.ts |
| `getFormSubmissionsAction` | `forms_surveys` | read | `L0_READ` | extend | — | — | `form_submissions` | src/lib/forms-actions.ts |
| `getFormWithVersionAction` | `forms_surveys` | read | `L0_READ` | unmapped | `requireAuth` | — | `forms`, `versions` | src/lib/forms-version-actions.ts |
| `getOrGenerateFormTopicClustersAction` | `forms_surveys` | read | `L0_READ` | wrap | `requireAuth` | — | `form_submissions`, `forms`, `intelligence` | src/lib/forms/form-intelligence-actions.ts |
| `getPlatformControlsAction` | `forms_surveys` | read | `L0_READ` | unmapped | — | — | — | src/lib/platform/platform-controls-actions.ts |
| `getProjectAnalyticsSummaryAction` | `forms_surveys` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `responses`, `survey_projects`, `surveys` | src/lib/surveys/survey-project-actions.ts |
| `getProjectLongitudinalAnalyticsAction` | `forms_surveys` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `responses`, `survey_projects`, `surveys`, `waves` | src/lib/surveys/survey-longitudinal-actions.ts |
| `getProjectPerformanceMetricsAction` | `forms_surveys` | read | `L0_READ` | unmapped | — | — | `creative_analytics` | src/app/actions/creative-performance-actions.ts |
| `getPublicFormDefinitionAction` | `forms_surveys` | read | `L0_READ` | unmapped | `requireAuth` | — | `app_fields`, `forms` | src/lib/forms-actions.ts |
| `getQuestionBankItemsAction` | `forms_surveys` | read | `L0_READ` | unmapped | — | — | `question_bank` | src/lib/surveys/question-bank-actions.ts |
| `getRoutingFormBySlugAction` | `forms_surveys` | read | `L0_READ` | unmapped | — | — | `routing_forms` | src/app/actions/routing-form-actions.ts |
| `getRoutingFormsAction` | `forms_surveys` | read | `L0_READ` | wrap | `requireWorkspace` | — | `routing_forms` | src/app/actions/routing-form-actions.ts |
| `getScheduledReportConfigAction` | `forms_surveys` | read | `L0_READ` | unmapped | `requireAuth` | — | `scheduled_reports` | src/lib/forms/form-reports-actions.ts |
| `getSubmissionNotesAction` | `forms_surveys` | read | `L0_READ` | unmapped | — | — | `form_submissions`, `notes` | src/lib/forms/form-response-actions.ts |
| `getSurveyAnalyticsOverviewAction` | `forms_surveys` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `responses`, `surveys` | src/lib/surveys/survey-analytics-actions.ts |
| `getSurveyCrmFieldDefinitionsAction` | `forms_surveys` | read | `L0_READ` | unmapped | — | — | `app_fields` | src/lib/surveys/survey-crm-sync-actions.ts |
| `getSurveyCrossTabsAction` | `forms_surveys` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `responses`, `surveys` | src/lib/surveys/survey-analytics-actions.ts |
| `getSurveyDeploymentsAction` | `forms_surveys` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `survey_deployments` | src/lib/surveys/survey-deployment-actions.ts |
| `getSurveyExperimentResultsAction` | `forms_surveys` | read | `L0_READ` | unmapped | — | — | `responses`, `surveys` | src/lib/surveys/survey-experiment-actions.ts |
| `getSurveyGovernanceOverviewAction` | `forms_surveys` | read | `L0_READ` | unmapped | — | — | — | src/lib/backoffice/backoffice-survey-actions.ts |
| `getSurveyProjectByIdAction` | `forms_surveys` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `survey_projects` | src/lib/surveys/survey-project-actions.ts |
| `getSurveyProjectsAction` | `forms_surveys` | read | `L0_READ` | unmapped | — | — | `survey_projects` | src/lib/surveys/survey-project-actions.ts |
| `getSurveyResponsesForContact` | `forms_surveys` | read | `L0_READ` | unmapped | `requireAuth` | — | `responses`, `surveys` | src/lib/survey-actions.ts |
| `getSurveyResponsesListAction` | `forms_surveys` | read | `L0_READ` | unmapped | — | — | `responses`, `surveys` | src/lib/surveys/survey-analytics-actions.ts |
| `getSurveysForContact` | `forms_surveys` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `surveys` | src/lib/survey-actions.ts |
| `getSurveyVersionHistoryAction` | `forms_surveys` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `surveys`, `versions` | src/lib/surveys/survey-version-actions.ts |
| `getSystemCrmFieldMappingTemplatesAction` | `forms_surveys` | read | `L0_READ` | unmapped | `requireAuth` | — | `system_settings` | src/lib/surveys/survey-crm-sync-actions.ts |
| `getSystemPredictiveWeightsAction` | `forms_surveys` | read | `L0_READ` | unmapped | `requireAuth` | — | `system_config` | src/lib/surveys/survey-predictive-actions.ts |
| `getSystemResearchGovernanceAction` | `forms_surveys` | read | `L0_READ` | unmapped | `requireAuth` | — | `system_settings` | src/lib/surveys/survey-retention-actions.ts |
| `getWorkspaceActiveSurveysAction` | `forms_surveys` | read | `L0_READ` | unmapped | — | — | `surveys` | src/lib/surveys/survey-crm-trigger-actions.ts |
| `getWorkspaceEntitiesForSimulationAction` | `forms_surveys` | read | `L0_READ` | extend | — | — | `entities`, `workspace_entities` | src/lib/survey-actions.ts |
| `getWorkspaceFormsExecutiveReportAction` | `forms_surveys` | read | `L0_READ` | unmapped | `requireAuth` | — | `deals`, `form_metrics_daily`, `forms` | src/lib/forms/form-reports-actions.ts |
| `getWorkspaceNotificationTemplatesAction` | `forms_surveys` | read | `L0_READ` | unmapped | `requireAuth` | — | `message_templates` | src/lib/forms/form-notification-actions.ts |
| `getWorkspacePipelinesAction` | `forms_surveys` | read | `L0_READ` | wrap | `requireWorkspace` | — | `pipelines` | src/lib/forms/crm-integration-actions.ts |
| `getWorkspacePredictiveOverviewAction` | `forms_surveys` | read | `L0_READ` | unmapped | `requireAuth`, `requireWorkspace` | — | `contacts`, `deals`, `responses`, `surveys`, `system_config`, `workspace_entities` | src/lib/surveys/survey-predictive-actions.ts |
| `getWorkspaceTeamMembersAction` | `forms_surveys` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `users` | src/lib/forms/crm-integration-actions.ts |
| `initializeFormSessionAction` | `forms_surveys` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `form_sessions` | src/lib/forms/form-session-actions.ts |
| `listWorkspaceCampaignPerformanceAction` | `forms_surveys` | read | `L0_READ` | extend | — | — | — | src/app/actions/creative-performance-actions.ts |
| `loadFormDraftAction` | `forms_surveys` | read | `L0_READ` | unmapped | — | — | `form_drafts` | src/lib/forms/form-draft-actions.ts |
| `logSurveyStartedAction` | `forms_surveys` | create | `L2_STATE_MUTATION` | unmapped | — | — | `surveys` | src/lib/survey-actions.ts |
| `modifySurvey` | `forms_surveys` | execute | `L2_STATE_MUTATION`* | extend | — | — | — | src/ai/flows/modify-survey-flow.ts |
| `optimizeFormWithAiAction` | `forms_surveys` | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | — | src/lib/forms/form-ai-actions.ts |
| `PlatformEventService` | `forms_surveys` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/analytics/platform-event-service.ts |
| `processFormSubmissionAction` | `forms_surveys` | execute | `L2_STATE_MUTATION` | unmapped | — | — | `form_submissions`, `forms` | src/lib/forms-actions.ts |
| `promoteWinningVariantAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `activities`, `experiments`, `forms` | src/lib/forms/form-optimization-actions.ts |
| `promoteWinningVariantAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | — | — | `surveys` | src/lib/surveys/survey-experiment-actions.ts |
| `publishFormVersionAction` | `forms_surveys` | publish | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | `canUser` | `canUser:edit`, `canUser:forms`, `canUser:studios` | `forms`, `versions` | src/lib/forms-version-actions.ts |
| `publishSurveyVersionAction` | `forms_surveys` | publish | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | `requireWorkspace` | — | `surveys`, `versions` | src/lib/surveys/survey-version-actions.ts |
| `purgeSpamSubmissionAction` | `forms_surveys` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/lib/backoffice/backoffice-survey-actions.ts |
| `querySurveyData` | `forms_surveys` | search | `L0_READ` | unmapped | `requireAuth` | — | `organizations` | src/ai/flows/query-survey-data-flow.ts |
| `querySurveyDataFlow` | `forms_surveys` | search | `L0_READ` | unmapped | — | — | `organizations` | src/ai/flows/query-survey-data-flow.ts |
| `querySurveyResearchAssistantAction` | `forms_surveys` | search | `L0_READ` | unmapped | `requireWorkspace` | — | `responses`, `summaries`, `surveys` | src/lib/surveys/survey-ai-intelligence-actions.ts |
| `recordFormEventAction` | `forms_surveys` | create | `L2_STATE_MUTATION` | unmapped | — | — | `form_events`, `form_sessions` | src/lib/forms/form-session-actions.ts |
| `recordFormTelemetryEventAction` | `forms_surveys` | create | `L2_STATE_MUTATION` | unmapped | — | — | `form_metrics_daily` | src/lib/forms/form-analytics-actions.ts |
| `refineSurveyQuestionAction` | `forms_surveys` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/lib/surveys/survey-ai-refinement-actions.ts |
| `refineSurveyQuestionFlow` | `forms_surveys` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/refine-survey-question-flow.ts |
| `RefineSurveyQuestionInputSchema` | `forms_surveys` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/refine-survey-question-flow.ts |
| `RefineSurveyQuestionOutputSchema` | `forms_surveys` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/refine-survey-question-flow.ts |
| `resolveOrMatchWorkspaceEntity` | `forms_surveys` | draft | `L1_INTERNAL_DRAFT` | unmapped | `ensureEntitySharedToWorkspace`, `requireWorkspace` | — | `entities`, `workspace_entities`, `workspaces` | src/lib/survey-actions.ts |
| `rewriteQuestionCopyAction` | `forms_surveys` | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | — | src/lib/forms/form-ai-actions.ts |
| `rewriteQuestionCopyFlow` | `forms_surveys` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `organizations` | src/ai/flows/ai-form-assistant-flow.ts |
| `runFormsFerAuditAction` | `forms_surveys` | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | — | src/lib/backoffice/backoffice-forms-actions.ts |
| `sanitizeEntityPayloadForUpdate` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | — | src/lib/survey-actions.ts |
| `saveFormCrmSettingsAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `forms` | src/lib/forms/crm-integration-actions.ts |
| `saveFormDraftAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | — | — | `form_drafts` | src/lib/forms/form-draft-actions.ts |
| `saveFormDraftVersionAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireAuth` | `canUser:edit`, `canUser:forms`, `canUser:studios` | `forms`, `versions` | src/lib/forms-version-actions.ts |
| `saveFormNotificationSettingsAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `forms` | src/lib/forms/form-notification-actions.ts |
| `saveFormSavedViewAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `form_saved_views` | src/lib/forms/form-response-actions.ts |
| `saveQuestionToBankAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `question_bank` | src/lib/surveys/question-bank-actions.ts |
| `saveScheduledReportConfigAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `scheduled_reports` | src/lib/forms/form-reports-actions.ts |
| `saveSurveyCrmConfigAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `surveys` | src/lib/surveys/survey-crm-sync-actions.ts |
| `saveSurveyExperimentConfigAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `surveys` | src/lib/surveys/survey-experiment-actions.ts |
| `saveSystemCrmFieldMappingTemplatesAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `system_settings` | src/lib/surveys/survey-crm-sync-actions.ts |
| `saveSystemPredictiveWeightsAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `system_config` | src/lib/surveys/survey-predictive-actions.ts |
| `saveSystemResearchGovernanceAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `system_settings` | src/lib/surveys/survey-retention-actions.ts |
| `scanFormAnomaliesAction` | `forms_surveys` | analyze | `L0_READ` | unmapped | `requireAuth` | — | `forms` | src/lib/forms/form-optimization-actions.ts |
| `seedAllPlatformTemplatesAction` | `forms_surveys` | create | `L2_STATE_MUTATION` | unmapped | — | — | `platform_templates` | src/app/actions/seed-platform-presets-action.ts |
| `seedIndustryFormTemplatesAction` | `forms_surveys` | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `forms` | src/lib/backoffice/backoffice-forms-actions.ts |
| `seedPlatformPageTemplatesAction` | `forms_surveys` | create | `L2_STATE_MUTATION` | unmapped | — | — | `platform_templates` | src/app/actions/seed-platform-page-templates-action.ts |
| `seedSystemQuestionBankAction` | `forms_surveys` | create | `L2_STATE_MUTATION` | unmapped | — | — | `question_bank` | src/lib/surveys/question-bank-actions.ts |
| `sendSurveyLinkToAssignee` | `forms_surveys` | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | `requireAuth` | — | `users` | src/app/actions/survey-assignee-actions.ts |
| `sendSurveyToContactAction` | `forms_surveys` | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | `requireAuth` | — | `surveys` | src/lib/surveys/survey-crm-trigger-actions.ts |
| `sendTestFormNotificationAction` | `forms_surveys` | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | `requireAuth` | — | — | src/lib/forms/form-notification-actions.ts |
| `sendTestReportEmailAction` | `forms_surveys` | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | `requireAuth` | — | `activities`, `forms` | src/lib/forms/form-reports-actions.ts |
| `setOutboundPausedAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/platform/platform-controls-actions.ts |
| `submitPublicSurveyLead` | `forms_surveys` | create | `L2_STATE_MUTATION` | unmapped | `ensureEntitySharedToWorkspace`, `requireAuth`, `requireWorkspace` | — | `deals`, `entities`, `media`, `onboardingStages`, `organizations`, `responses`, `surveys`, `webhooks`, `workspace_entities`, `workspaces` | src/lib/survey-actions.ts |
| `submitPublicSurveyResponse` | `forms_surveys` | create | `L2_STATE_MUTATION` | unmapped | `ensureEntitySharedToWorkspace`, `requireAuth`, `requireWorkspace` | — | `deals`, `entities`, `media`, `onboardingStages`, `organizations`, `responses`, `survey_sessions`, `surveys`, `webhooks`, `workspace_entities`, `workspaces` | src/lib/survey-actions.ts |
| `submitRoutingFormAction` | `forms_surveys` | create | `L2_STATE_MUTATION` | unmapped | — | — | `event_types`, `routing_forms`, `routing_submissions` | src/app/actions/routing-form-actions.ts |
| `submitStandaloneFormAction` | `forms_surveys` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/form-actions.ts |
| `suggestFormQuestionsAction` | `forms_surveys` | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireAuth` | — | — | src/lib/forms/form-ai-actions.ts |
| `suggestQuestionsFlow` | `forms_surveys` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | `organizations` | src/ai/flows/ai-form-assistant-flow.ts |
| `suggestSurveyVariantCopyAction` | `forms_surveys` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/lib/surveys/survey-experiment-actions.ts |
| `SurveyAnalyticsBulkActionsBar` | `forms_surveys` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `onboardingStages`, `pipelines` | src/app/admin/surveys/[id]/results/components/SurveyAnalyticsBulkActionsBar.tsx |
| `syncSurveyUploadedFilesToMedia` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `media` | src/lib/survey-actions.ts |
| `synthesizeLogicRuleFlow` | `forms_surveys` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | `organizations` | src/ai/flows/ai-form-assistant-flow.ts |
| `toggleFormStatusAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | `canUser` | `canUser:edit`, `canUser:forms`, `canUser:studios` | `forms` | src/lib/forms-actions.ts |
| `triggerSurveyWebhook` | `forms_surveys` | execute | `L2_STATE_MUTATION` | unmapped | — | — | `webhooks` | src/lib/survey-actions.ts |
| `unflagSubmissionAction` | `forms_surveys` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/backoffice/backoffice-survey-actions.ts |
| `updateDeploymentStatusAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `survey_deployments` | src/lib/surveys/survey-deployment-actions.ts |
| `updateExperimentStatusAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `experiments`, `forms` | src/lib/forms/form-optimization-actions.ts |
| `updateFormAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | `canUser` | `canUser:edit`, `canUser:forms`, `canUser:studios` | `forms` | src/lib/forms-actions.ts |
| `updateFormSlugAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `forms` | src/lib/forms/form-distribution-actions.ts |
| `updateSubmissionStatusAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | — | — | `deals`, `form_submissions` | src/lib/forms/form-response-actions.ts |
| `updateSurveyProjectAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `survey_projects` | src/lib/surveys/survey-project-actions.ts |
| `updateSurveyStatusAction` | `forms_surveys` | update | `L2_STATE_MUTATION` | unmapped | `canUser` | `canUser:edit`, `canUser:studios`, `canUser:surveys` | `surveys` | src/lib/survey-actions.ts |
| `DELETE /api/auth/session` | `identity_access` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/app/api/auth/session/route.ts |
| `POST /api/auth/session` | `identity_access` | execute | `L2_STATE_MUTATION`* | unmapped | `verifyIdToken` | — | — | src/app/api/auth/session/route.ts |
| `GET /api/auth/social/callback` | `identity_access` | read | `L0_READ` | unmapped | — | — | `socialAccounts` | src/app/api/auth/social/callback/route.ts |
| `POST /api/organizations/scrape` | `identity_access` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/api/organizations/scrape/route.ts |
| `GET /api/workspaces/[workspaceId]/contacts` | `identity_access` | read | `L0_READ` | unmapped | `authenticateApiRequest` | — | `workspace_entities` | src/app/api/workspaces/[workspaceId]/contacts/route.ts |
| `AccessSnapshotService` | `identity_access` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `access_snapshots` | src/lib/services/authorization/access-snapshot-service.ts |
| `adminResetUserPasswordAction` | `identity_access` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `organizations`, `users` | src/lib/user-invite-actions.ts |
| `adminUpdateUserAccessAction` | `identity_access` | update | `L2_STATE_MUTATION` | unmapped | — | — | `organizations`, `users` | src/lib/user-invite-actions.ts |
| `AiRoleAdvisorService` | `identity_access` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/ai/ai-role-advisor-service.ts |
| `archiveEntityAction` | `identity_access` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireAuth` | — | `workspace_entities` | src/lib/workspace-entity-actions.ts |
| `archiveOrganizationAction` | `identity_access` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `assertUserTenantPermission`, `requireAuth` | `assertUserTenantPermission:administrator` | `organizations` | src/lib/organization-actions.ts |
| `archiveWorkspaceAction` | `identity_access` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireAuth` | — | `workspaces` | src/lib/workspace-actions.ts |
| `archiveWorkspaceFromBackoffice` | `identity_access` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | `workspaces` | src/lib/backoffice/backoffice-workspace-actions.ts |
| `AuthorizationService` | `identity_access` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `policies`, `roles`, `users` | src/lib/services/authorization/authorization-service.ts |
| `BulkActionsFloatingToolbar` | `identity_access` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/admin/users/components/BulkActionsFloatingToolbar.tsx |
| `bulkArchiveEntitiesAction` | `identity_access` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | `workspace_entities` | src/lib/workspace-entity-actions.ts |
| `bulkDeleteEntitiesAction` | `identity_access` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | `entities`, `workspace_entities` | src/lib/workspace-entity-actions.ts |
| `completeForcePasswordResetAction` | `identity_access` | execute | `L2_STATE_MUTATION`* | unmapped | `verifyIdToken` | — | `people`, `users` | src/lib/user-invite-actions.ts |
| `createOrUpdateRoleAction` | `identity_access` | create | `L2_STATE_MUTATION` | unmapped | `hasPlatformAdminClaim`, `verifyCallerAuth`, `verifyIdToken` | — | `users` | src/app/actions/authorization-actions.ts |
| `dealItemInputSchema` | `identity_access` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/detect-organizational-patterns-flow.ts |
| `declineJoinRequestAction` | `identity_access` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `organizations`, `users` | src/lib/user-invite-actions.ts |
| `deleteEntityPermanentlyAction` | `identity_access` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireAuth` | — | `entities`, `workspace_entities` | src/lib/workspace-entity-actions.ts |
| `deleteOrganizationAction` | `identity_access` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `assertUserTenantPermission`, `requireAuth` | `assertUserTenantPermission:administrator` | `organizations`, `users`, `workspaces` | src/lib/organization-actions.ts |
| `deleteRoleAction` | `identity_access` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `hasPlatformAdminClaim`, `verifyCallerAuth`, `verifyIdToken` | — | `users` | src/app/actions/authorization-actions.ts |
| `deleteWorkspaceAction` | `identity_access` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireAuth` | — | `activities`, `pipelines`, `tasks`, `workspace_entities`, `workspaces` | src/lib/workspace-actions.ts |
| `detectedOpportunitySchema` | `identity_access` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/detect-organizational-patterns-flow.ts |
| `detectedRiskSchema` | `identity_access` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/detect-organizational-patterns-flow.ts |
| `detectedTrendSchema` | `identity_access` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/detect-organizational-patterns-flow.ts |
| `detectOrganizationalPatternsDeterministic` | `identity_access` | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/detect-organizational-patterns-flow.ts |
| `detectOrganizationalPatternsFlow` | `identity_access` | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/detect-organizational-patterns-flow.ts |
| `detectPatternsInputSchema` | `identity_access` | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/detect-organizational-patterns-flow.ts |
| `detectPatternsOutputSchema` | `identity_access` | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/detect-organizational-patterns-flow.ts |
| `dismissQueueItemAction` | `identity_access` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `lead_signals`, `tasks` | src/app/actions/seller-workspace-actions.ts |
| `enrichUsersWithWorkspaceRbac` | `identity_access` | update | `L2_STATE_MUTATION` | unmapped | — | — | `roles`, `users` | src/app/actions/rbac-workspace-migration-actions.ts |
| `enrichWorkspaceEntitiesContactsAction` | `identity_access` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `system_migrations`, `workspace_entities` | src/app/actions/enrich-workspace-entities-contacts-action.ts |
| `enrichWorkspacesWithIndustry` | `identity_access` | update | `L2_STATE_MUTATION` | unmapped | — | — | `workspaces` | src/app/actions/workspace-industry-migration-actions.ts |
| `ensureEntitySharedToWorkspace` | `identity_access` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `entities`, `workspace_entities`, `workspaces` | src/lib/workspace-entity-actions.ts |
| `EntitlementService` | `identity_access` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/entitlement-service.ts |
| `evaluateAccessAction` | `identity_access` | analyze | `L0_READ` | unmapped | `hasPlatformAdminClaim`, `verifyCallerAuth`, `verifyIdToken` | — | `users` | src/app/actions/authorization-actions.ts |
| `executeFixOrgAdminPermissionsFerAction` | `identity_access` | execute | `L2_STATE_MUTATION` | unmapped | — | — | `roles`, `system_config`, `system_migrations`, `users` | src/app/actions/fix-org-admin-permissions-fer-action.ts |
| `executeQuickActionAction` | `identity_access` | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `lead_signals`, `tasks` | src/app/actions/seller-workspace-actions.ts |
| `executeSeedAllWorkspacesFieldsFerAction` | `identity_access` | execute | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/seed-all-workspaces-fields-fer-action.ts |
| `executeWorkspaceScopeFetchEnrichRestoreAction` | `identity_access` | execute | `L2_STATE_MUTATION` | unmapped | — | — | `workspace_entities`, `workspaces` | src/app/actions/workspace-scope-migration-actions.ts |
| `explainUserAccessAction` | `identity_access` | analyze | `L0_READ` | unmapped | `hasPlatformAdminClaim`, `verifyCallerAuth`, `verifyIdToken` | — | `users` | src/app/actions/authorization-actions.ts |
| `fetchUsersForWorkspaceRbacMigration` | `identity_access` | read | `L0_READ` | unmapped | — | — | `users` | src/app/actions/rbac-workspace-migration-actions.ts |
| `fetchWorkspacesForIndustryMigration` | `identity_access` | read | `L0_READ` | unmapped | — | — | `workspaces` | src/app/actions/workspace-industry-migration-actions.ts |
| `flagMissingWorkspaceToAdmin` | `identity_access` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `activities` | src/lib/services/workspace-resolver.ts |
| `generateWorkspaceInsightsFlow` | `identity_access` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/generate-workspace-insights-flow.ts |
| `generateWorkspaceInsightsInputSchema` | `identity_access` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/generate-workspace-insights-flow.ts |
| `generateWorkspaceInsightsOutputSchema` | `identity_access` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/generate-workspace-insights-flow.ts |
| `getFilteredEntityIdsAction` | `identity_access` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `workspace_entities` | src/lib/workspace-entity-actions.ts |
| `getMyDayOverviewAction` | `identity_access` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `aiSalesRecommendations`, `buyerSignals`, `coachingProfiles`, `deals`, `forecastDeals`, `lead_signals`, `meetings`, `salesOrchestrationExecutions`, `salesPerformanceDaily`, `salesTargets`, `tasks`, `users` | src/app/actions/seller-workspace-actions.ts |
| `getPermissionCatalogAction` | `identity_access` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/authorization-actions.ts |
| `getTerminologyAction` | `identity_access` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `workspaces` | src/lib/workspace-actions.ts |
| `getWorkspaceAiSettingsAction` | `identity_access` | read | `L0_READ` | unmapped | `checkWorkspaceAccess`, `requireWorkspace` | — | `users` | src/lib/ai/actions/workspace-ai-actions.ts |
| `getWorkspaceDiagnostics` | `identity_access` | read | `L0_READ` | unmapped | — | — | `organizations`, `pipelines`, `teams`, `users`, `workspace_entities`, `workspaces` | src/lib/backoffice/backoffice-workspace-actions.ts |
| `inviteUserAction` | `identity_access` | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | — | — | `organizations`, `roles`, `users` | src/lib/user-invite-actions.ts |
| `linkEntityToWorkspaceAction` | `identity_access` | update | `L2_STATE_MUTATION` | unmapped | — | — | `entities`, `stages`, `workspace_entities`, `workspaces` | src/lib/workspace-entity-actions.ts |
| `listAllWorkspaces` | `identity_access` | read | `L0_READ` | unmapped | — | — | `organizations`, `users`, `workspaces` | src/lib/backoffice/backoffice-workspace-actions.ts |
| `listRolesAction` | `identity_access` | read | `L0_READ` | unmapped | `hasPlatformAdminClaim`, `verifyCallerAuth`, `verifyIdToken` | — | `users` | src/app/actions/authorization-actions.ts |
| `meetingCommitmentInputSchema` | `identity_access` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/detect-organizational-patterns-flow.ts |
| `memoryItemInputSchema` | `identity_access` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/detect-organizational-patterns-flow.ts |
| `migrateLegacyWorkspaceScopesAction` | `identity_access` | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | `workspaces` | src/lib/workspace-actions.ts |
| `PermissionRegistryService` | `identity_access` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/authorization/permission-registry-service.ts |
| `PermissionUsageService` | `identity_access` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/analytics/permission-usage-service.ts |
| `publicResetPasswordViaPhoneAction` | `identity_access` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `organizations`, `users` | src/lib/user-invite-actions.ts |
| `removeUserFromOrgAction` | `identity_access` | delete | `L2_STATE_MUTATION` | unmapped | — | — | `users` | src/lib/user-invite-actions.ts |
| `resolveContextWorkspaceId` | `identity_access` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | `contracts`, `meetings`, `pdf_forms`, `surveys`, `users`, `workspace_entities` | src/lib/services/workspace-resolver.ts |
| `resolveWorkspaceIdForUser` | `identity_access` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | `users` | src/lib/services/workspace-resolver.ts |
| `resolveWorkspaceIdFromContract` | `identity_access` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | `contracts` | src/lib/services/workspace-resolver.ts |
| `resolveWorkspaceIdFromEntity` | `identity_access` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | `workspace_entities` | src/lib/services/workspace-resolver.ts |
| `resolveWorkspaceIdFromMeeting` | `identity_access` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | `meetings` | src/lib/services/workspace-resolver.ts |
| `resolveWorkspaceIdFromPDFForm` | `identity_access` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | `pdf_forms` | src/lib/services/workspace-resolver.ts |
| `resolveWorkspaceIdFromSurvey` | `identity_access` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | `surveys` | src/lib/services/workspace-resolver.ts |
| `restoreWorkspaceFromBackoffice` | `identity_access` | update | `L2_STATE_MUTATION` | unmapped | — | — | `workspaces` | src/lib/backoffice/backoffice-workspace-actions.ts |
| `restoreWorkspaceIndustryMigration` | `identity_access` | update | `L2_STATE_MUTATION` | unmapped | — | — | `workspaces` | src/app/actions/workspace-industry-migration-actions.ts |
| `restoreWorkspaceRbacMigration` | `identity_access` | update | `L2_STATE_MUTATION` | unmapped | — | — | `users` | src/app/actions/rbac-workspace-migration-actions.ts |
| `RoleManagementService` | `identity_access` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `roles`, `workspace_memberships` | src/lib/services/authorization/role-management-service.ts |
| `rollbackWorkspaceIndustryMigration` | `identity_access` | update | `L2_STATE_MUTATION` | unmapped | — | — | `workspaces` | src/app/actions/workspace-industry-migration-actions.ts |
| `rollbackWorkspaceRbacMigration` | `identity_access` | update | `L2_STATE_MUTATION` | unmapped | — | — | `users` | src/app/actions/rbac-workspace-migration-actions.ts |
| `saveOrganizationAction` | `identity_access` | update | `L2_STATE_MUTATION` | unmapped | `assertUserTenantPermission`, `requireAuth` | `assertUserTenantPermission:administrator` | `modules`, `organizations`, `roles`, `users`, `zones` | src/lib/organization-actions.ts |
| `saveWorkspaceAction` | `identity_access` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `organizations`, `workspaces` | src/lib/workspace-actions.ts |
| `setOrganizationDefaultWorkspaceAction` | `identity_access` | update | `L2_STATE_MUTATION` | unmapped | `assertUserTenantPermission`, `requireAuth` | `assertUserTenantPermission:administrator` | `organizations` | src/lib/organization-actions.ts |
| `simulateRolePermissionsAction` | `identity_access` | draft | `L1_INTERNAL_DRAFT` | unmapped | `hasPlatformAdminClaim`, `verifyCallerAuth`, `verifyIdToken` | — | `users` | src/app/actions/authorization-actions.ts |
| `snoozeQueueItemAction` | `identity_access` | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | `tasks` | src/app/actions/seller-workspace-actions.ts |
| `unlinkEntityFromWorkspaceAction` | `identity_access` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `entities`, `workspace_entities` | src/lib/workspace-entity-actions.ts |
| `updateUserAiPreferencesAction` | `identity_access` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `users` | src/lib/user-preferences-actions.ts |
| `updateWorkspaceAiSettingsAction` | `identity_access` | update | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | `users` | src/lib/ai/actions/workspace-ai-actions.ts |
| `updateWorkspaceEntityAction` | `identity_access` | update | `L2_STATE_MUTATION` | extend | — | — | `entities`, `stages`, `workspace_entities` | src/lib/workspace-entity-actions.ts |
| `updateWorkspaceScopeAction` | `identity_access` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `workspace_entities`, `workspaces` | src/lib/workspace-actions.ts |
| `GET /api/v1/quick-notes/export` | `knowledge_memory` | read | `L0_READ` | unmapped | — | — | `api_keys` | src/app/api/v1/quick-notes/export/route.ts |
| `POST /api/v1/quick-notes/ingest` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `api_keys` | src/app/api/v1/quick-notes/ingest/route.ts |
| `aiAssistEditorAction` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | unmapped | `canUser` | `canUser:operations`, `canUser:view` | — | src/lib/quick-notes-ai-actions.ts |
| `aiLinkSuggestionOutputSchema` | `knowledge_memory` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/ai/flows/detect-knowledge-links-flow.ts |
| `applyConsolidationAction` | `knowledge_memory` | update | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess` | — | — | src/lib/memory/actions/orchestrator-actions.ts |
| `askKnowledgeInputSchema` | `knowledge_memory` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/ask-knowledge-rag-flow.ts |
| `askKnowledgeOutputSchema` | `knowledge_memory` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/ask-knowledge-rag-flow.ts |
| `askKnowledgeRagFlow` | `knowledge_memory` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/ask-knowledge-rag-flow.ts |
| `askSmartSappKnowledgeAction` | `knowledge_memory` | draft | `L1_INTERNAL_DRAFT` | unmapped | `canUser`, `requireAuth` | `canUser:operations`, `canUser:view` | `system_settings` | src/lib/quick-notes-search-actions.ts |
| `auditNoteGovernanceAction` | `knowledge_memory` | analyze | `L0_READ` | unmapped | `requireWorkspace` | — | — | src/lib/quick-notes-insight-actions.ts |
| `backfillCrmRelationsAction` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | unmapped | `canUser` | `canUser:edit`, `canUser:operations` | — | src/lib/quick-notes-graph-actions.ts |
| `buildContextAction` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | wrap | `checkWorkspaceAccess` | — | — | src/lib/memory/actions/context-builder-actions.ts |
| `bulkReviewInboxAction` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | — | src/lib/quick-notes-insight-actions.ts |
| `candidateObjectSchema` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/detect-knowledge-links-flow.ts |
| `challengeIdeaAssumptionsAiAction` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | — | src/lib/quick-notes-idea-actions.ts |
| `classifyDraftKnowledgeAction` | `knowledge_memory` | analyze | `L0_READ` | unmapped | `canUser` | `canUser:operations`, `canUser:view` | — | src/lib/quick-notes-ai-actions.ts |
| `classifyKnowledgeFlow` | `knowledge_memory` | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/classify-knowledge-flow.ts |
| `clearEmbeddingCacheAction` | `knowledge_memory` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth`, `verifyBackofficeAdmin` | — | `users` | src/lib/memory/actions/backoffice-companybrain-actions.ts |
| `cloneFederatedItemToWorkspaceAction` | `knowledge_memory` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/quick-notes-federation-actions.ts |
| `commitOfflineBatchAction` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/quick-notes-offline-actions.ts |
| `confirmMemoryAction` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | unmapped | `checkWorkspaceAccess` | — | — | src/lib/memory/actions/memory-actions.ts |
| `convertIdeaToTaskAction` | `knowledge_memory` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `tasks` | src/lib/quick-notes-idea-actions.ts |
| `convertInsightToIdeaAction` | `knowledge_memory` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | — | src/lib/quick-notes-insight-actions.ts |
| `convertInsightToTaskAction` | `knowledge_memory` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `tasks` | src/lib/quick-notes-insight-actions.ts |
| `createFederatedSpaceAction` | `knowledge_memory` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/quick-notes-federation-actions.ts |
| `createGraphEdgeAction` | `knowledge_memory` | create | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | — | src/lib/memory/actions/graph-actions.ts |
| `createIdeaAction` | `knowledge_memory` | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | — | src/lib/quick-notes-idea-actions.ts |
| `createKnowledgeRelationAction` | `knowledge_memory` | create | `L2_STATE_MUTATION` | unmapped | `canUser` | `canUser:edit`, `canUser:operations` | — | src/lib/quick-notes-graph-actions.ts |
| `createQuickNoteAction` | `knowledge_memory` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/quick-notes-actions.ts |
| `createTaskFromActionItem` | `knowledge_memory` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/quick-notes-ai-actions.ts |
| `decomposeIdeaCanvasAiAction` | `knowledge_memory` | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireWorkspace` | — | — | src/lib/quick-notes-idea-actions.ts |
| `deleteFederatedSpaceAction` | `knowledge_memory` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/lib/quick-notes-federation-actions.ts |
| `deleteGraphEdgeAction` | `knowledge_memory` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | — | src/lib/memory/actions/graph-actions.ts |
| `deleteIdeaAction` | `knowledge_memory` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireWorkspace` | — | — | src/lib/quick-notes-idea-actions.ts |
| `deleteInsightAction` | `knowledge_memory` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireWorkspace` | — | — | src/lib/quick-notes-insight-actions.ts |
| `deleteKnowledgeRelationAction` | `knowledge_memory` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `canUser` | `canUser:edit`, `canUser:operations` | — | src/lib/quick-notes-graph-actions.ts |
| `detectContradictionInputSchema` | `knowledge_memory` | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/detect-memory-contradictions-flow.ts |
| `detectContradictionOutputSchema` | `knowledge_memory` | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/detect-memory-contradictions-flow.ts |
| `detectKnowledgeLinksFlow` | `knowledge_memory` | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/detect-knowledge-links-flow.ts |
| `detectKnowledgeLinksInputSchema` | `knowledge_memory` | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/detect-knowledge-links-flow.ts |
| `detectKnowledgeLinksOutputSchema` | `knowledge_memory` | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/detect-knowledge-links-flow.ts |
| `detectMemoryContradictionsDeterministic` | `knowledge_memory` | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/detect-memory-contradictions-flow.ts |
| `detectMemoryContradictionsFlow` | `knowledge_memory` | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/detect-memory-contradictions-flow.ts |
| `detectWorkspaceContradictionsAction` | `knowledge_memory` | analyze | `L0_READ` | unmapped | `requireWorkspace` | — | — | src/lib/quick-notes-insight-actions.ts |
| `developRawIdeaAiAction` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | — | src/lib/quick-notes-idea-actions.ts |
| `embedText` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/embed-note-flow.ts |
| `enrichNoteLink` | `knowledge_memory` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/quick-notes-actions.ts |
| `explainGraphConnectionAction` | `knowledge_memory` | analyze | `L0_READ` | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | — | src/lib/memory/actions/graph-actions.ts |
| `explainGraphConnectionFlow` | `knowledge_memory` | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/explain-graph-connection-flow.ts |
| `explainGraphConnectionInputSchema` | `knowledge_memory` | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/explain-graph-connection-flow.ts |
| `explainGraphConnectionOutputSchema` | `knowledge_memory` | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/explain-graph-connection-flow.ts |
| `exportWorkspaceKnowledgeAction` | `knowledge_memory` | read | `L0_READ` | unmapped | — | — | — | src/lib/quick-notes-federation-actions.ts |
| `extractMemoriesFromNoteAction` | `knowledge_memory` | analyze | `L0_READ` | unmapped | `checkWorkspaceAccess` | — | — | src/lib/memory/actions/memory-actions.ts |
| `fetchAggregatedNotes` | `knowledge_memory` | read | `L0_READ` | unmapped | `canUser` | `canUser:operations`, `canUser:view` | — | src/lib/quick-notes-feed-actions.ts |
| `findConsolidationCandidatesAction` | `knowledge_memory` | search | `L0_READ` | unmapped | `checkWorkspaceAccess` | — | — | src/lib/memory/actions/orchestrator-actions.ts |
| `findGraphPathAction` | `knowledge_memory` | search | `L0_READ` | wrap | `checkWorkspaceAccess`, `requireAuth` | — | — | src/lib/memory/actions/graph-actions.ts |
| `generateIngestionWebhookKeyAction` | `knowledge_memory` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/lib/quick-notes-federation-actions.ts |
| `generateQuickNoteInsight` | `knowledge_memory` | draft | `L1_INTERNAL_DRAFT` | unmapped | `canUser` | `canUser:operations`, `canUser:view` | — | src/lib/quick-notes-ai-actions.ts |
| `generateQuickNotesDigest` | `knowledge_memory` | draft | `L1_INTERNAL_DRAFT` | unmapped | `canUser` | `canUser:operations`, `canUser:view` | — | src/lib/quick-notes-ai-actions.ts |
| `generateWorkspaceInsightsAction` | `knowledge_memory` | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireWorkspace` | — | — | src/lib/quick-notes-insight-actions.ts |
| `getBacklinksAction` | `knowledge_memory` | read | `L0_READ` | unmapped | `canUser` | `canUser:operations`, `canUser:view` | — | src/lib/quick-notes-graph-actions.ts |
| `getCompanyBrainHealthAction` | `knowledge_memory` | read | `L0_READ` | unmapped | `requireAuth`, `verifyBackofficeAdmin` | — | `users` | src/lib/memory/actions/backoffice-companybrain-actions.ts |
| `getDealDossierAction` | `knowledge_memory` | read | `L0_READ` | wrap | `checkWorkspaceAccess` | — | — | src/lib/memory/actions/context-builder-actions.ts |
| `getEntityAiSummary` | `knowledge_memory` | read | `L0_READ` | unmapped | — | — | — | src/lib/note-actions.ts |
| `getEntityDossierAction` | `knowledge_memory` | read | `L0_READ` | wrap | `checkWorkspaceAccess` | — | — | src/lib/memory/actions/context-builder-actions.ts |
| `getEntitySubGraphAction` | `knowledge_memory` | read | `L0_READ` | wrap | `checkWorkspaceAccess`, `requireAuth` | — | — | src/lib/memory/actions/graph-actions.ts |
| `getFederatedKnowledgeFeedAction` | `knowledge_memory` | read | `L0_READ` | unmapped | — | — | — | src/lib/quick-notes-federation-actions.ts |
| `getGraphTopologyMetricsAction` | `knowledge_memory` | read | `L0_READ` | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | — | src/lib/memory/actions/graph-actions.ts |
| `getLatestServerSnapshotsAction` | `knowledge_memory` | read | `L0_READ` | unmapped | — | — | — | src/lib/quick-notes-offline-actions.ts |
| `getMemoryHealthAction` | `knowledge_memory` | read | `L0_READ` | wrap | `checkWorkspaceAccess` | — | — | src/lib/memory/actions/orchestrator-actions.ts |
| `getMemoryHealthStatsAction` | `knowledge_memory` | read | `L0_READ` | unmapped | `checkWorkspaceAccess` | — | — | src/lib/memory/actions/memory-actions.ts |
| `getNoteMemoriesAction` | `knowledge_memory` | read | `L0_READ` | wrap | `checkWorkspaceAccess` | — | — | src/lib/memory/actions/memory-actions.ts |
| `getRelatedMemoriesAction` | `knowledge_memory` | read | `L0_READ` | wrap | `checkWorkspaceAccess` | — | — | src/lib/memory/actions/semantic-search-actions.ts |
| `getWorkspaceFederatedSpacesAction` | `knowledge_memory` | read | `L0_READ` | unmapped | — | — | — | src/lib/quick-notes-federation-actions.ts |
| `getWorkspaceGraphAction` | `knowledge_memory` | read | `L0_READ` | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | — | src/lib/memory/actions/graph-actions.ts |
| `getWorkspaceIdeasAction` | `knowledge_memory` | read | `L0_READ` | unmapped | — | — | — | src/lib/quick-notes-idea-actions.ts |
| `getWorkspaceInboxAction` | `knowledge_memory` | read | `L0_READ` | unmapped | `requireWorkspace` | — | — | src/lib/quick-notes-insight-actions.ts |
| `getWorkspaceInsightsAction` | `knowledge_memory` | read | `L0_READ` | unmapped | — | — | — | src/lib/quick-notes-insight-actions.ts |
| `getWorkspaceKnowledgeGraphAction` | `knowledge_memory` | read | `L0_READ` | unmapped | `canUser` | `canUser:operations`, `canUser:view` | — | src/lib/quick-notes-graph-actions.ts |
| `hybridSearchKnowledgeAction` | `knowledge_memory` | search | `L0_READ` | unmapped | `canUser`, `requireAuth` | `canUser:operations`, `canUser:view` | — | src/lib/quick-notes-search-actions.ts |
| `importKnowledgeArchiveAction` | `knowledge_memory` | create | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/lib/quick-notes-federation-actions.ts |
| `invalidateMemoryAction` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | unmapped | `checkWorkspaceAccess` | — | — | src/lib/memory/actions/memory-actions.ts |
| `knowledgeClassificationResultSchema` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/classify-knowledge-flow.ts |
| `listMemoryConflictsAction` | `knowledge_memory` | read | `L0_READ` | wrap | `checkWorkspaceAccess` | — | — | src/lib/memory/actions/orchestrator-actions.ts |
| `listStaleMemoriesAction` | `knowledge_memory` | read | `L0_READ` | wrap | `checkWorkspaceAccess` | — | — | src/lib/memory/actions/orchestrator-actions.ts |
| `listWorkspaceMemoriesAction` | `knowledge_memory` | read | `L0_READ` | wrap | `checkWorkspaceAccess` | — | — | src/lib/memory/actions/memory-actions.ts |
| `logNoteActivity` | `knowledge_memory` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/note-actions.ts |
| `logQuickNoteActivity` | `knowledge_memory` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/quick-notes-actions.ts |
| `logQuickNoteCreated` | `knowledge_memory` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/quick-notes-actions.ts |
| `memoryStatementSchema` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/detect-memory-contradictions-flow.ts |
| `mergeDuplicateNotesAction` | `knowledge_memory` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | — | src/lib/quick-notes-insight-actions.ts |
| `publishCollectionToSpaceAction` | `knowledge_memory` | publish | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | — | — | — | src/lib/quick-notes-federation-actions.ts |
| `quickNoteInsightSchema` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/summarize-quick-note-flow.ts |
| `quickNotesDigestFlow` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/quick-notes-digest-flow.ts |
| `quickNotesDigestSchema` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/quick-notes-digest-flow.ts |
| `ragActionSuggestionOutputSchema` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/ask-knowledge-rag-flow.ts |
| `ragChunkInputSchema` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/ask-knowledge-rag-flow.ts |
| `ragCitationOutputSchema` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/ask-knowledge-rag-flow.ts |
| `reconfirmMemoryFreshnessAction` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | unmapped | `checkWorkspaceAccess` | — | — | src/lib/memory/actions/orchestrator-actions.ts |
| `reindexMemoryAction` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | unmapped | `checkWorkspaceAccess` | — | — | src/lib/memory/actions/semantic-search-actions.ts |
| `reindexWorkspaceKnowledgeAction` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:operations` | — | src/lib/quick-notes-search-actions.ts |
| `reindexWorkspaceMemoriesAction` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | unmapped | `checkWorkspaceAccess` | — | — | src/lib/memory/actions/semantic-search-actions.ts |
| `resolveMemoryConflictAction` | `knowledge_memory` | draft | `L1_INTERNAL_DRAFT` | wrap | `checkWorkspaceAccess` | — | — | src/lib/memory/actions/orchestrator-actions.ts |
| `resolveNoteEntitiesAction` | `knowledge_memory` | draft | `L1_INTERNAL_DRAFT` | unmapped | `canUser` | `canUser:operations`, `canUser:view` | — | src/lib/quick-notes-ai-actions.ts |
| `reviewInboxItemAction` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | — | src/lib/quick-notes-insight-actions.ts |
| `saveIdeaCanvasLayoutAction` | `knowledge_memory` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | — | src/lib/quick-notes-idea-actions.ts |
| `scanDuplicatesAction` | `knowledge_memory` | analyze | `L0_READ` | unmapped | `requireWorkspace` | — | — | src/lib/quick-notes-insight-actions.ts |
| `scanMemoryConflictsBatchAction` | `knowledge_memory` | analyze | `L0_READ` | unmapped | `checkWorkspaceAccess` | — | — | src/lib/memory/actions/orchestrator-actions.ts |
| `semanticSearchMemoriesAction` | `knowledge_memory` | search | `L0_READ` | unmapped | `checkWorkspaceAccess` | — | — | src/lib/memory/actions/semantic-search-actions.ts |
| `semanticSearchNotes` | `knowledge_memory` | search | `L0_READ` | wrap | `canUser`, `requireAuth` | `canUser:operations`, `canUser:view` | — | src/lib/quick-notes-search-actions.ts |
| `subscribeToFederatedSpaceAction` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/quick-notes-federation-actions.ts |
| `suggestKnowledgeLinksAction` | `knowledge_memory` | draft | `L1_INTERNAL_DRAFT` | unmapped | `canUser` | `canUser:operations`, `canUser:view` | — | src/lib/quick-notes-graph-actions.ts |
| `summarizeEntityTimelineAction` | `knowledge_memory` | analyze | `L0_READ` | unmapped | `canUser` | `canUser:operations`, `canUser:view` | — | src/lib/quick-notes-ai-actions.ts |
| `summarizeQuickNoteFlow` | `knowledge_memory` | analyze | `L0_READ` | unmapped | — | — | — | src/ai/flows/summarize-quick-note-flow.ts |
| `syncWorkspaceGraphMeshAction` | `knowledge_memory` | update | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireAuth` | — | `contacts`, `deals`, `entities` | src/lib/memory/actions/graph-actions.ts |
| `synthesizeContextDossierWithAIAction` | `knowledge_memory` | draft | `L1_INTERNAL_DRAFT` | unmapped | `checkWorkspaceAccess` | — | — | src/lib/memory/actions/context-builder-actions.ts |
| `transitionIdeaStageAction` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | wrap | `requireWorkspace` | — | — | src/lib/quick-notes-idea-actions.ts |
| `triggerCompanyBrainReindexAction` | `knowledge_memory` | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth`, `verifyBackofficeAdmin` | — | `users` | src/lib/memory/actions/backoffice-companybrain-actions.ts |
| `unifiedRecallAction` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | unmapped | `checkWorkspaceAccess` | — | — | src/lib/memory/actions/orchestrator-actions.ts |
| `unsubscribeFromFederatedSpaceAction` | `knowledge_memory` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/quick-notes-federation-actions.ts |
| `updateFederatedSpaceAction` | `knowledge_memory` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/quick-notes-federation-actions.ts |
| `updateIdeaAction` | `knowledge_memory` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | — | src/lib/quick-notes-idea-actions.ts |
| `updateMemoryAction` | `knowledge_memory` | update | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess` | — | — | src/lib/memory/actions/memory-actions.ts |
| `GET /api/lead-intelligence/extension/download` | `lead_intelligence` | read | `L0_READ` | unmapped | — | — | `system_settings` | src/app/api/lead-intelligence/extension/download/route.ts |
| `GET /api/lead-intelligence/extension/scan` | `lead_intelligence` | read | `L0_READ` | unmapped | — | — | `prospects`, `system_settings` | src/app/api/lead-intelligence/extension/scan/route.ts |
| `OPTIONS /api/lead-intelligence/extension/scan` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/api/lead-intelligence/extension/scan/route.ts |
| `OPTIONS /api/lead-intelligence/extension/sync` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/api/lead-intelligence/extension/sync/route.ts |
| `POST /api/lead-intelligence/extension/sync` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `activities`, `entities`, `prospects`, `system_settings`, `workspace_entities` | src/app/api/lead-intelligence/extension/sync/route.ts |
| `POST /api/v1/media/recommendations` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | `authenticateApiRequest` | — | `media` | src/app/api/v1/media/recommendations/route.ts |
| `acceptInvitationAction` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/actions/workforce-actions.ts |
| `AccessRequestService` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `access_requests` | src/lib/services/workforce/access-request-service.ts |
| `addProspectsToListAction` | `lead_intelligence` | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `lead_lists` | src/app/actions/lead-intelligence-actions.ts |
| `applyAiRecommendationAction` | `lead_intelligence` | update | `L2_STATE_MUTATION` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/ai-workforce-actions.ts |
| `AutonomousSDREngine` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/lead-intelligence/sdr/AutonomousSDREngine.ts |
| `backfillDepartmentSeedsAction` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | `hasPlatformAdminClaim`, `verifyCallerAuth`, `verifyIdToken` | — | `users` | src/app/actions/workforce-actions.ts |
| `batchEnrichProspectsAction` | `lead_intelligence` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth`, `requireWorkspace` | — | `prospects`, `system_settings` | src/app/actions/lead-intelligence-actions.ts |
| `batchSyncProspectsAction` | `lead_intelligence` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `activities`, `entities`, `prospects`, `workspace_entities` | src/app/actions/lead-intelligence-actions.ts |
| `bulkVerifyProspectEmailsAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `prospects` | src/app/actions/lead-intelligence-actions.ts |
| `BulkWorkforceService` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/workforce/bulk-workforce-service.ts |
| `calculateStringSimilarity` | `lead_intelligence` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/lib/lead-intelligence/identity-resolver.ts |
| `canonicalizeDomain` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/lead-intelligence/identity-resolver.ts |
| `checkOffboardingReadinessAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/crm-workforce-actions.ts |
| `checkProspectCRMMatchAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `prospects`, `workspace_entities` | src/app/actions/lead-intelligence-actions.ts |
| `ContinuousSignalMonitorService` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/lead-intelligence/signals/ContinuousSignalMonitorService.ts |
| `createLeadListAction` | `lead_intelligence` | create | `L2_STATE_MUTATION` | wrap | `requireWorkspace` | — | `lead_lists` | src/app/actions/lead-intelligence-actions.ts |
| `createOrUpdateDepartmentAction` | `lead_intelligence` | create | `L2_STATE_MUTATION` | unmapped | `hasPlatformAdminClaim`, `verifyCallerAuth`, `verifyIdToken` | — | `users` | src/app/actions/workforce-actions.ts |
| `createOrUpdateTeamAction` | `lead_intelligence` | create | `L2_STATE_MUTATION` | unmapped | `hasPlatformAdminClaim`, `verifyCallerAuth`, `verifyIdToken` | — | `users` | src/app/actions/workforce-actions.ts |
| `CRMIntelligenceService` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/lead-intelligence/crm/CRMIntelligenceService.ts |
| `CrmWorkloadService` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `automations`, `contacts`, `crm_meetings`, `crm_tasks`, `deals` | src/lib/services/workforce/crm-workload-service.ts |
| `CSVImportProvider` | `lead_intelligence` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/lead-intelligence/providers/CSVImportProvider.ts |
| `DeepResearchDossierEngine` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/lead-intelligence/research/DeepResearchDossierEngine.ts |
| `deleteDepartmentAction` | `lead_intelligence` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `hasPlatformAdminClaim`, `verifyCallerAuth`, `verifyIdToken` | — | `users` | src/app/actions/workforce-actions.ts |
| `deleteDynamicSegmentAction` | `lead_intelligence` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireWorkspace` | — | `dynamic_segments` | src/app/actions/lead-intelligence-actions.ts |
| `deleteLeadListAction` | `lead_intelligence` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | wrap | `requireWorkspace` | — | `lead_lists` | src/app/actions/lead-intelligence-actions.ts |
| `deleteSavedViewAction` | `lead_intelligence` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireWorkspace` | — | `saved_views` | src/app/actions/lead-intelligence-actions.ts |
| `deleteTeamAction` | `lead_intelligence` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `hasPlatformAdminClaim`, `verifyCallerAuth`, `verifyIdToken` | — | `users` | src/app/actions/workforce-actions.ts |
| `DeliverabilityScoreEngine` | `lead_intelligence` | analyze | `L0_READ` | unmapped | — | — | — | src/lib/lead-intelligence/verification/DeliverabilityScoreEngine.ts |
| `DepartmentSeedService` | `lead_intelligence` | create | `L2_STATE_MUTATION` | unmapped | — | — | `departments`, `organizations`, `workspaces` | src/lib/services/workforce/department-seed-service.ts |
| `DepartmentService` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `departments`, `people` | src/lib/services/workforce/department-service.ts |
| `dismissAiRecommendationAction` | `lead_intelligence` | update | `L2_STATE_MUTATION` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/ai-workforce-actions.ts |
| `dismissCollisionAction` | `lead_intelligence` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `identity_collisions` | src/app/actions/lead-intelligence-actions.ts |
| `dismissSignalAction` | `lead_intelligence` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `lead_signals` | src/app/actions/lead-intelligence-actions.ts |
| `dispatchInvitationsAction` | `lead_intelligence` | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | `hasPlatformAdminClaim`, `verifyCallerAuth`, `verifyIdToken` | — | `users` | src/app/actions/workforce-actions.ts |
| `DisposableEmailDetector` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/lead-intelligence/verification/DisposableEmailDetector.ts |
| `DNSMXResolverService` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/lead-intelligence/verification/DNSMXResolverService.ts |
| `DOMScraperService` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/lead-intelligence/scraper/DOMScraperService.ts |
| `EmailSyntaxSanitizer` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/lead-intelligence/verification/EmailSyntaxSanitizer.ts |
| `enrichExistingCRMRecordAction` | `lead_intelligence` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `activities`, `entities`, `prospects`, `workspace_entities` | src/app/actions/lead-intelligence-actions.ts |
| `enrichProspectAction` | `lead_intelligence` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth`, `requireWorkspace` | — | `prospects`, `system_settings` | src/app/actions/lead-intelligence-actions.ts |
| `enrichTechnographicsDeepAction` | `lead_intelligence` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `prospects` | src/app/actions/lead-intelligence-actions.ts |
| `evaluateIdentityMatch` | `lead_intelligence` | analyze | `L0_READ` | unmapped | — | — | — | src/lib/lead-intelligence/identity-resolver.ts |
| `evaluateSegmentCountAction` | `lead_intelligence` | analyze | `L0_READ` | unmapped | `requireWorkspace` | — | `prospects` | src/app/actions/lead-intelligence-actions.ts |
| `executeAiRecommendationAction` | `lead_intelligence` | execute | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireWorkspace` | — | `aiSalesExecutions`, `aiSalesRecommendations` | src/app/actions/ai-sales-workforce-actions.ts |
| `executeBulkWorkforceAction` | `lead_intelligence` | execute | `L2_STATE_MUTATION` | unmapped | `hasPlatformAdminClaim`, `verifyCallerAuth`, `verifyIdToken` | — | `users` | src/app/actions/workforce-actions.ts |
| `executeCrmHygieneRepairAction` | `lead_intelligence` | execute | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireWorkspace` | — | `aiCrmHygieneIssues`, `contacts`, `deals` | src/app/actions/ai-sales-workforce-actions.ts |
| `executeDataRemediationAction` | `lead_intelligence` | execute | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `prospects` | src/app/actions/lead-intelligence-actions.ts |
| `executeEnterpriseDataImportAction` | `lead_intelligence` | execute | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `enterprise_governance`, `prospects` | src/app/actions/lead-intelligence-actions.ts |
| `executeIdentityMergeAction` | `lead_intelligence` | execute | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `entities`, `identity_collisions`, `prospects`, `workspace_entities` | src/app/actions/lead-intelligence-actions.ts |
| `executeProspectActivationAction` | `lead_intelligence` | execute | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `deals`, `prospects`, `tasks` | src/app/actions/lead-intelligence-actions.ts |
| `ExplainableScoringEngine` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/lead-intelligence/scoring/ExplainableScoringEngine.ts |
| `extensionTokenMatches` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/lead-intelligence/extension-token.ts |
| `FloatingActionToolbar` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/admin/lead-intelligence/components/FloatingActionToolbar.tsx |
| `generateAIOutreachDraftAction` | `lead_intelligence` | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireAuth` | — | `prospects` | src/app/actions/lead-intelligence-actions.ts |
| `generateAiRecommendationsAction` | `lead_intelligence` | draft | `L1_INTERNAL_DRAFT` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/ai-workforce-actions.ts |
| `generateAIResearchDossierAction` | `lead_intelligence` | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireWorkspace` | — | `prospects` | src/app/actions/lead-intelligence-actions.ts |
| `generateExtensionToken` | `lead_intelligence` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/lib/lead-intelligence/extension-token.ts |
| `getAccountMonitoringConfigAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `account_monitoring` | src/app/actions/lead-intelligence-actions.ts |
| `getAIResearchDossierAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `prospects` | src/app/actions/lead-intelligence-actions.ts |
| `getAiWorkforceDashboardDataAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `checkWorkspaceAccess`, `requireWorkspace` | — | `aiCrmHygieneIssues`, `aiSalesAgents`, `aiSalesApprovals`, `aiSalesExecutions`, `aiSalesGovernance`, `aiSalesRecommendations` | src/app/actions/ai-sales-workforce-actions.ts |
| `getCreditLedgerSummaryAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `enterprise_governance`, `prospects` | src/app/actions/lead-intelligence-actions.ts |
| `getDailyRepBriefingAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `prospects` | src/app/actions/lead-intelligence-actions.ts |
| `getEnrichmentDimensionsAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `prospects` | src/app/actions/lead-intelligence-actions.ts |
| `getEnterpriseGovernanceConfigAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `enterprise_governance` | src/app/actions/lead-intelligence-actions.ts |
| `getIdentityCollisionsAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `identity_collisions` | src/app/actions/lead-intelligence-actions.ts |
| `getIntelligenceInboxAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `identity_collisions`, `lead_signals`, `prospects` | src/app/actions/lead-intelligence-actions.ts |
| `getLeadListsAction` | `lead_intelligence` | read | `L0_READ` | wrap | `requireWorkspace` | — | `lead_lists` | src/app/actions/lead-intelligence-actions.ts |
| `getLeadSettingsAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `system_settings` | src/app/actions/lead-intelligence-actions.ts |
| `getOrganizationCrmWorkloadOverviewAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/crm-workforce-actions.ts |
| `getOrganizationRiskOverviewAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/ai-workforce-actions.ts |
| `getPersonCrmWorkloadAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/crm-workforce-actions.ts |
| `getPersonRiskScoreAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/ai-workforce-actions.ts |
| `getPredictiveConversionAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `prospects` | src/app/actions/lead-intelligence-actions.ts |
| `getPriorityQueueItemAction` | `lead_intelligence` | read | `L0_READ` | wrap | `requireWorkspace` | — | `prospects` | src/app/actions/lead-intelligence-actions.ts |
| `getProspectingCampaignsAction` | `lead_intelligence` | read | `L0_READ` | wrap | `requireWorkspace` | — | `prospecting_campaigns` | src/app/actions/lead-intelligence-actions.ts |
| `getProspectScoreHistoryAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `prospect_score_history` | src/app/actions/lead-intelligence-actions.ts |
| `getProspectSignalsAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `lead_signals` | src/app/actions/lead-intelligence-actions.ts |
| `getProviderHealthStatusAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `lead_intelligence_settings` | src/app/actions/lead-intelligence-actions.ts |
| `getRecentProspectsAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `prospects` | src/app/actions/lead-intelligence-actions.ts |
| `getRevenueAttributionReportAction` | `lead_intelligence` | read | `L0_READ` | wrap | `requireWorkspace` | — | `deals`, `prospects` | src/app/actions/lead-intelligence-actions.ts |
| `getSavedSearchesAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `saved_searches` | src/app/actions/lead-intelligence-actions.ts |
| `getSavedViewsAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `saved_views` | src/app/actions/lead-intelligence-actions.ts |
| `getUnifiedActivityTimelineAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `activities`, `lead_signals`, `prospect_score_history`, `prospects` | src/app/actions/lead-intelligence-actions.ts |
| `getWorkforceIntelligenceSnapshotAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/workforce-intelligence-actions.ts |
| `getWorkspaceScoringModelAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `scoring_models` | src/app/actions/lead-intelligence-actions.ts |
| `getWorkspaceSegmentsAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `dynamic_segments` | src/app/actions/lead-intelligence-actions.ts |
| `getWorkspaceSignalsAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `lead_signals` | src/app/actions/lead-intelligence-actions.ts |
| `GooglePlacesProvider` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/lead-intelligence/providers/GooglePlacesProvider.ts |
| `hashExtensionToken` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/lead-intelligence/extension-token.ts |
| `IdentityMergeService` | `lead_intelligence` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/lead-intelligence/identity/IdentityMergeService.ts |
| `importProspectsFromCSVAction` | `lead_intelligence` | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `prospects` | src/app/actions/lead-intelligence-actions.ts |
| `InvitationDispatchService` | `lead_intelligence` | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | — | — | `invitations`, `organizations`, `users` | src/lib/services/workforce/invitation-dispatch-service.ts |
| `InvitationLifecycleService` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `invitations` | src/lib/services/workforce/invitation-lifecycle-service.ts |
| `isSafeExternalDomain` | `lead_intelligence` | read | `L0_READ` | unmapped | — | — | — | src/lib/lead-intelligence/identity-resolver.ts |
| `launchProspectingCampaignAction` | `lead_intelligence` | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | wrap | `requireWorkspace` | — | `entities`, `prospecting_campaigns`, `prospects`, `workspace_entities` | src/app/actions/lead-intelligence-actions.ts |
| `leadEnrichmentFlow` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/lead-enrichment-flow.ts |
| `LeadIntelligenceEngine` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/lead-intelligence/LeadIntelligenceEngine.ts |
| `listAccessRequestsAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `hasPlatformAdminClaim`, `verifyCallerAuth`, `verifyIdToken` | — | `users` | src/app/actions/workforce-actions.ts |
| `listAiRecommendationsAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/ai-workforce-actions.ts |
| `listDepartmentsAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `hasPlatformAdminClaim`, `verifyCallerAuth`, `verifyIdToken` | — | `users` | src/app/actions/workforce-actions.ts |
| `listInvitationsAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `hasPlatformAdminClaim`, `verifyCallerAuth`, `verifyIdToken` | — | `users` | src/app/actions/workforce-actions.ts |
| `listOwnershipTransferJobsAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/crm-workforce-actions.ts |
| `listTeamsAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `hasPlatformAdminClaim`, `verifyCallerAuth`, `verifyIdToken` | — | `users` | src/app/actions/workforce-actions.ts |
| `markInboxItemReadAction` | `lead_intelligence` | update | `L2_STATE_MUTATION` | wrap | `requireWorkspace` | — | `lead_signals` | src/app/actions/lead-intelligence-actions.ts |
| `markSignalReadAction` | `lead_intelligence` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `lead_signals` | src/app/actions/lead-intelligence-actions.ts |
| `MeetingActionItemsDrawer` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/admin/meetings/[id]/components/MeetingActionItemsDrawer.tsx |
| `normalizeBusinessName` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/lead-intelligence/identity-resolver.ts |
| `normalizePhoneNumber` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/lead-intelligence/identity-resolver.ts |
| `OffboardingGuardService` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/workforce/offboarding-guard-service.ts |
| `OwnershipTransferService` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `automations`, `contacts`, `crm_meetings`, `crm_tasks`, `deals` | src/lib/services/workforce/ownership-transfer-service.ts |
| `parseNaturalLanguageQueryAction` | `lead_intelligence` | search | `L0_READ` | unmapped | `requireAuth` | — | — | src/app/actions/lead-intelligence-actions.ts |
| `PredictiveIntelligenceEngine` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/lead-intelligence/predictive/PredictiveIntelligenceEngine.ts |
| `previewEnrichmentCostAction` | `lead_intelligence` | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireAuth` | — | — | src/app/actions/lead-intelligence-actions.ts |
| `probeDomainSubdomainsAction` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | — | src/app/actions/lead-intelligence-actions.ts |
| `prospectEnrichmentOutputSchema` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/lead-enrichment-flow.ts |
| `ProspectingCampaignEngine` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/lead-intelligence/campaigns/ProspectingCampaignEngine.ts |
| `purgeSampleDepartmentsAction` | `lead_intelligence` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `hasPlatformAdminClaim`, `verifyCallerAuth`, `verifyIdToken` | — | `departments`, `organizations`, `people`, `users` | src/app/actions/workforce-actions.ts |
| `recalculateWorkspaceScoresAction` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | `prospect_score_history`, `prospects` | src/app/actions/lead-intelligence-actions.ts |
| `refreshWorkforceIntelligenceSnapshotAction` | `lead_intelligence` | update | `L2_STATE_MUTATION` | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/workforce-intelligence-actions.ts |
| `regenerateExtensionTokenAction` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | `system_settings` | src/app/actions/lead-intelligence-actions.ts |
| `reseedAiWorkforceDefaultsAction` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | `checkWorkspaceAccess`, `requireWorkspace` | — | — | src/app/actions/ai-sales-workforce-actions.ts |
| `resendInvitationAction` | `lead_intelligence` | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | `hasPlatformAdminClaim`, `verifyCallerAuth`, `verifyIdToken` | — | `invitations`, `users` | src/app/actions/workforce-actions.ts |
| `resolveAccessRequestAction` | `lead_intelligence` | draft | `L1_INTERNAL_DRAFT` | unmapped | `hasPlatformAdminClaim`, `verifyCallerAuth`, `verifyIdToken` | — | `users` | src/app/actions/workforce-actions.ts |
| `resolveAiApprovalAction` | `lead_intelligence` | draft | `L1_INTERNAL_DRAFT` | unmapped | `checkWorkspaceAccess`, `requireWorkspace` | — | `aiSalesApprovals` | src/app/actions/ai-sales-workforce-actions.ts |
| `RevenueAttributionEngine` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/lead-intelligence/attribution/RevenueAttributionEngine.ts |
| `revokeInvitationAction` | `lead_intelligence` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `hasPlatformAdminClaim`, `verifyCallerAuth`, `verifyIdToken` | — | `users` | src/app/actions/workforce-actions.ts |
| `RoleIntelligenceService` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/workforce-intelligence/role-intelligence-service.ts |
| `runCrmHygieneScanAction` | `lead_intelligence` | execute | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireWorkspace` | — | `aiCrmHygieneIssues`, `contacts`, `deals` | src/app/actions/ai-sales-workforce-actions.ts |
| `saveAccountMonitoringConfigAction` | `lead_intelligence` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `account_monitoring` | src/app/actions/lead-intelligence-actions.ts |
| `saveDynamicSegmentAction` | `lead_intelligence` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `dynamic_segments` | src/app/actions/lead-intelligence-actions.ts |
| `saveEnterpriseGovernanceConfigAction` | `lead_intelligence` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `enterprise_governance` | src/app/actions/lead-intelligence-actions.ts |
| `saveLeadSettingsAction` | `lead_intelligence` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `system_settings` | src/app/actions/lead-intelligence-actions.ts |
| `saveProspectingCampaignAction` | `lead_intelligence` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `prospecting_campaigns` | src/app/actions/lead-intelligence-actions.ts |
| `saveSearchAction` | `lead_intelligence` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `saved_searches` | src/app/actions/lead-intelligence-actions.ts |
| `saveViewAction` | `lead_intelligence` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `saved_views` | src/app/actions/lead-intelligence-actions.ts |
| `saveWorkspaceScoringModelAction` | `lead_intelligence` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `scoring_models` | src/app/actions/lead-intelligence-actions.ts |
| `scanWorkspaceForCollisionsAction` | `lead_intelligence` | analyze | `L0_READ` | unmapped | `requireWorkspace` | — | `identity_collisions`, `prospects`, `workspace_entities` | src/app/actions/lead-intelligence-actions.ts |
| `searchProspectsAction` | `lead_intelligence` | search | `L0_READ` | unmapped | `requireWorkspace` | — | `prospects`, `system_settings` | src/app/actions/lead-intelligence-actions.ts |
| `SegmentPredicateEvaluator` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/lead-intelligence/segmentation/SegmentPredicateEvaluator.ts |
| `SimulatedAIProvider` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/lead-intelligence/providers/SimulatedAIProvider.ts |
| `simulateScoringModelAction` | `lead_intelligence` | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireWorkspace` | — | `prospects`, `scoring_models` | src/app/actions/lead-intelligence-actions.ts |
| `SMTPHandshakeProberService` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/lead-intelligence/verification/SMTPHandshakeProberService.ts |
| `SubdomainProberService` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/lead-intelligence/scraper/SubdomainProberService.ts |
| `submitAccessRequestAction` | `lead_intelligence` | create | `L2_STATE_MUTATION` | unmapped | `hasPlatformAdminClaim`, `verifyCallerAuth`, `verifyIdToken` | — | `users` | src/app/actions/workforce-actions.ts |
| `syncProspectToCRMAction` | `lead_intelligence` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `activities`, `entities`, `prospects`, `workspace_entities` | src/app/actions/lead-intelligence-actions.ts |
| `TeamService` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `teams` | src/lib/services/workforce/team-service.ts |
| `TeamUtilizationService` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/workforce-intelligence/team-utilization-service.ts |
| `TechnographicsCategorizer` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/lead-intelligence/scraper/TechnographicsCategorizer.ts |
| `toggleAiMasterKillSwitchAction` | `lead_intelligence` | update | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireWorkspace` | — | `aiSalesGovernance` | src/app/actions/ai-sales-workforce-actions.ts |
| `transferOwnershipAction` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | `verifyCaller`, `verifyIdToken` | — | — | src/app/actions/crm-workforce-actions.ts |
| `triggerProspectDeltaScanAction` | `lead_intelligence` | execute | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `account_monitoring`, `lead_signals`, `prospects` | src/app/actions/lead-intelligence-actions.ts |
| `updateAgentAutonomyLevelAction` | `lead_intelligence` | update | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireWorkspace` | — | `aiSalesAgents` | src/app/actions/ai-sales-workforce-actions.ts |
| `updateAiGovernancePolicyAction` | `lead_intelligence` | update | `L2_STATE_MUTATION` | unmapped | `checkWorkspaceAccess`, `requireWorkspace` | — | `aiSalesGovernance` | src/app/actions/ai-sales-workforce-actions.ts |
| `UserHealthService` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/workforce-intelligence/user-health-service.ts |
| `validateInvitationTokenAction` | `lead_intelligence` | read | `L0_READ` | unmapped | — | — | — | src/app/actions/workforce-actions.ts |
| `verifyProspectEmailAction` | `lead_intelligence` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `prospects` | src/app/actions/lead-intelligence-actions.ts |
| `WaterfallEnrichmentEngine` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/lead-intelligence/waterfall/WaterfallEnrichmentEngine.ts |
| `WorkforceIntelligenceService` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/lib/services/workforce-intelligence/workforce-intelligence-service.ts |
| `WorkforceMetricsService` | `lead_intelligence` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `platform_events` | src/lib/services/analytics/workforce-metrics-service.ts |
| `POST /api/media-tracker` | `media_creative` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `media_share_analytics`, `sessions` | src/app/api/media-tracker/route.ts |
| `POST /api/organizations/upload-logo` | `media_creative` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/api/organizations/upload-logo/route.ts |
| `GET /api/proxy-image` | `media_creative` | read | `L0_READ` | unmapped | — | — | — | src/app/api/proxy-image/route.ts |
| `OPTIONS /api/proxy-image` | `media_creative` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/api/proxy-image/route.ts |
| `POST /api/qr/batch-export` | `media_creative` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/api/qr/batch-export/route.ts |
| `POST /api/qr/unlock` | `media_creative` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/api/qr/unlock/route.ts |
| `GET /api/v1/media/assets` | `media_creative` | read | `L0_READ` | unmapped | `authenticateApiRequest` | — | `media` | src/app/api/v1/media/assets/route.ts |
| `POST /api/v1/media/assets` | `media_creative` | execute | `L2_STATE_MUTATION`* | unmapped | `authenticateApiRequest` | — | `media` | src/app/api/v1/media/assets/route.ts |
| `GET /api/v1/media/assets/[assetId]` | `media_creative` | read | `L0_READ` | unmapped | `authenticateApiRequest` | — | `media`, `media_versions` | src/app/api/v1/media/assets/[assetId]/route.ts |
| `POST /api/v1/media/events` | `media_creative` | execute | `L2_STATE_MUTATION`* | unmapped | `authenticateApiRequest` | — | `media_page_events` | src/app/api/v1/media/events/route.ts |
| `POST /api/v1/media/search` | `media_creative` | execute | `L2_STATE_MUTATION`* | unmapped | `authenticateApiRequest` | — | `media_transcripts` | src/app/api/v1/media/search/route.ts |
| `addCustomDomain` | `media_creative` | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `organizations`, `qr_custom_domains`, `workspaces` | src/lib/qr-domain-security-actions.ts |
| `archiveQRCode` | `media_creative` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireWorkspace` | — | `organizations`, `qr_codes`, `workspaces` | src/lib/qr-actions.ts |
| `batchCreateQRCodes` | `media_creative` | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `organizations`, `qr_batch_jobs`, `qr_codes`, `short_paths`, `workspaces` | src/lib/qr-actions.ts |
| `bulkApplyTagsToMediaContactsAction` | `media_creative` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `contacts`, `workspace_entities` | src/lib/media-analytics-entity-actions.ts |
| `bulkMoveMediaContactsStageAction` | `media_creative` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `contacts`, `workspace_entities` | src/lib/media-analytics-entity-actions.ts |
| `bulkQRAction` | `media_creative` | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | `organizations`, `qr_codes`, `workspaces` | src/lib/qr-actions.ts |
| `bulkTagQRCodesAction` | `media_creative` | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | `organizations`, `qr_codes`, `workspaces` | src/lib/qr-actions.ts |
| `cancelBulkUploadAction` | `media_creative` | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `import_logs` | src/lib/bulk-upload-actions.ts |
| `checkSlugAvailabilityAction` | `media_creative` | read | `L0_READ` | unmapped | — | — | `media_shares` | src/lib/media-analytics-actions.ts |
| `ContextualActionBar` | `media_creative` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/components/shared/thumbnail-designer/ContextualActionBar.tsx |
| `correctDeadZoneCoordinates` | `media_creative` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/generate-thumbnail-flow.ts |
| `createQRCode` | `media_creative` | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `organizations`, `qr_codes`, `short_paths`, `workspaces` | src/lib/qr-actions.ts |
| `deleteAssetRecord` | `media_creative` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | `platform_assets` | src/lib/backoffice/backoffice-asset-actions.ts |
| `deleteCustomDomain` | `media_creative` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireWorkspace` | — | `organizations`, `qr_custom_domains`, `workspaces` | src/lib/qr-domain-security-actions.ts |
| `deleteMediaAsset` | `media_creative` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireAuth` | — | `media` | src/lib/media-actions.ts |
| `deleteQRCode` | `media_creative` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireWorkspace` | — | `organizations`, `qr_codes`, `short_paths`, `workspaces` | src/lib/qr-actions.ts |
| `deleteQRTemplate` | `media_creative` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireWorkspace` | — | `organizations`, `qr_code_templates`, `workspaces` | src/lib/qr-actions.ts |
| `duplicateQRCode` | `media_creative` | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `organizations`, `qr_codes`, `short_paths`, `workspaces` | src/lib/qr-actions.ts |
| `expireQRCode` | `media_creative` | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | `organizations`, `qr_codes`, `workspaces` | src/lib/qr-actions.ts |
| `generateContextualCopyAction` | `media_creative` | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireAuth` | — | — | src/app/actions/qr-ai-actions.ts |
| `generateQRFromPromptAction` | `media_creative` | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireAuth` | — | `organizations` | src/app/actions/qr-ai-actions.ts |
| `generateQRsForAudienceAction` | `media_creative` | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireWorkspace` | — | `organizations`, `qr_batch_jobs`, `qr_codes`, `short_paths`, `workspaces` | src/lib/qr-actions.ts |
| `generateThumbnailDesign` | `media_creative` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | — | src/ai/flows/generate-thumbnail-flow.ts |
| `getCustomDomains` | `media_creative` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `organizations`, `qr_custom_domains`, `workspaces` | src/lib/qr-domain-security-actions.ts |
| `getDuplicateRowsAction` | `media_creative` | read | `L0_READ` | unmapped | `requireAuth` | — | `duplicate_rows`, `entities`, `import_logs`, `workspace_entities` | src/lib/bulk-upload-actions.ts |
| `getFailedRowsAction` | `media_creative` | read | `L0_READ` | unmapped | `requireAuth` | — | `failed_rows`, `import_logs` | src/lib/bulk-upload-actions.ts |
| `getImportsLogsListAction` | `media_creative` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `import_logs` | src/lib/bulk-upload-actions.ts |
| `getMediaShareDrilldownAction` | `media_creative` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `contacts`, `entities`, `events`, `media`, `media_shares`, `sessions` | src/lib/media-analytics-actions.ts |
| `getQRAnalytics` | `media_creative` | read | `L0_READ` | unmapped | `requireAuth` | — | `organizations`, `qr_scan_events`, `workspaces` | src/lib/qr-scan-actions.ts |
| `getQRCode` | `media_creative` | read | `L0_READ` | unmapped | — | — | `organizations`, `qr_codes`, `workspaces` | src/lib/qr-actions.ts |
| `getQRCodeByShortPath` | `media_creative` | read | `L0_READ` | unmapped | — | — | `organizations`, `qr_codes`, `short_paths`, `workspaces` | src/lib/qr-actions.ts |
| `getQRCodeByUrl` | `media_creative` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `organizations`, `qr_codes`, `workspaces` | src/lib/qr-actions.ts |
| `getQRStudioStats` | `media_creative` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `organizations`, `qr_codes`, `workspaces` | src/lib/qr-actions.ts |
| `ingestBatchAction` | `media_creative` | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | `countries`, `deal_audit`, `deals`, `districts`, `duplicate_rows`, `entities`, `failed_rows`, `import_logs`, `in_app_notifications`, `modules`, `onboardingStages`, `organizations`, `pending_rows`, `pipelines`, `regions`, `subscription_packages`, `system_settings`, `tags`, `users`, `workspace_entities`, `workspaces`, `zones` | src/lib/bulk-upload-actions.ts |
| `ingestSchoolRowAction` | `media_creative` | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth`, `requireWorkspace` | — | `countries`, `deal_audit`, `deals`, `districts`, `duplicate_rows`, `entities`, `failed_rows`, `import_logs`, `in_app_notifications`, `modules`, `onboardingStages`, `organizations`, `pending_rows`, `pipelines`, `regions`, `subscription_packages`, `system_settings`, `tags`, `users`, `workspace_entities`, `workspaces`, `zones` | src/lib/bulk-upload-actions.ts |
| `listAllAssets` | `media_creative` | read | `L0_READ` | unmapped | — | — | `platform_assets` | src/lib/backoffice/backoffice-asset-actions.ts |
| `listMediaSharesWithStatsAction` | `media_creative` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `media`, `media_shares` | src/lib/media-analytics-actions.ts |
| `listQRCodes` | `media_creative` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `organizations`, `qr_codes`, `workspaces` | src/lib/qr-actions.ts |
| `listQRTemplates` | `media_creative` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `organizations`, `qr_code_templates`, `workspaces` | src/lib/qr-actions.ts |
| `MediaAnalyticsBulkActionsBar` | `media_creative` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `onboardingStages`, `pipelines` | src/app/admin/media/analytics/components/MediaAnalyticsBulkActionsBar.tsx |
| `modifyThumbnailDesign` | `media_creative` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/ai/flows/modify-thumbnail-flow.ts |
| `pauseQRCode` | `media_creative` | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | `organizations`, `qr_codes`, `workspaces` | src/lib/qr-actions.ts |
| `processImportChunkBackground` | `media_creative` | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `countries`, `deal_audit`, `deals`, `districts`, `duplicate_rows`, `entities`, `failed_rows`, `import_logs`, `in_app_notifications`, `modules`, `onboardingStages`, `organizations`, `pending_rows`, `pipelines`, `regions`, `subscription_packages`, `system_settings`, `tags`, `users`, `workspace_entities`, `workspaces`, `zones` | src/lib/bulk-upload-actions.ts |
| `purgeExpiredFailedImportsAction` | `media_creative` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireWorkspace` | — | `failed_rows`, `import_logs` | src/lib/bulk-upload-actions.ts |
| `recordExperimentEventServerAction` | `media_creative` | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `media_experiments` | src/lib/media-analytics-actions.ts |
| `recordMediaPageEventAction` | `media_creative` | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `events`, `media_experiments`, `media_shares`, `sessions`, `workspaces` | src/lib/media-analytics-actions.ts |
| `recordScanEvent` | `media_creative` | create | `L2_STATE_MUTATION` | unmapped | — | — | `organizations`, `qr_codes`, `qr_scan_events`, `workspaces` | src/lib/qr-scan-actions.ts |
| `removeImageBackgroundAction` | `media_creative` | delete | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/media-actions.ts |
| `resolveDuplicatesAction` | `media_creative` | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireAuth` | — | `countries`, `districts`, `duplicate_rows`, `entities`, `import_logs`, `modules`, `onboardingStages`, `pipelines`, `regions`, `subscription_packages`, `tags`, `users`, `workspace_entities`, `zones` | src/lib/bulk-upload-actions.ts |
| `resolveFailedRowAction` | `media_creative` | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireAuth` | — | `failed_rows`, `import_logs` | src/lib/bulk-upload-actions.ts |
| `resumeBulkUploadAction` | `media_creative` | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `countries`, `deal_audit`, `deals`, `districts`, `duplicate_rows`, `entities`, `failed_rows`, `import_logs`, `in_app_notifications`, `modules`, `onboardingStages`, `organizations`, `pending_rows`, `pipelines`, `regions`, `subscription_packages`, `system_settings`, `tags`, `users`, `workspace_entities`, `workspaces`, `zones` | src/lib/bulk-upload-actions.ts |
| `resumeQRCode` | `media_creative` | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | `organizations`, `qr_codes`, `workspaces` | src/lib/qr-actions.ts |
| `runGenerateHooks` | `media_creative` | execute | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/thumbnail-actions.ts |
| `runGenerateThumbnail` | `media_creative` | execute | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/thumbnail-actions.ts |
| `runModifyThumbnail` | `media_creative` | execute | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/thumbnail-actions.ts |
| `saveAssetRecord` | `media_creative` | update | `L2_STATE_MUTATION` | unmapped | — | — | `platform_assets` | src/lib/backoffice/backoffice-asset-actions.ts |
| `saveImageToMediaLibrary` | `media_creative` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `media` | src/lib/media-actions.ts |
| `saveQRTemplate` | `media_creative` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `organizations`, `qr_code_templates`, `workspaces` | src/lib/qr-actions.ts |
| `scheduleQRCode` | `media_creative` | execute | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `organizations`, `qr_codes`, `workspaces` | src/lib/qr-actions.ts |
| `setDefaultCustomDomain` | `media_creative` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `organizations`, `qr_custom_domains`, `workspaces` | src/lib/qr-domain-security-actions.ts |
| `transformCanvasThemeAction` | `media_creative` | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | — | src/app/actions/qr-ai-actions.ts |
| `updateFailedRowAction` | `media_creative` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `failed_rows`, `import_logs` | src/lib/bulk-upload-actions.ts |
| `updateMediaName` | `media_creative` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `media` | src/lib/media-actions.ts |
| `updateQRCode` | `media_creative` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `organizations`, `qr_codes`, `workspaces` | src/lib/qr-actions.ts |
| `updateQRDesign` | `media_creative` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `organizations`, `qr_codes`, `workspaces` | src/lib/qr-actions.ts |
| `updateQRDestination` | `media_creative` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `organizations`, `qr_codes`, `workspaces` | src/lib/qr-actions.ts |
| `updateQRLifecycle` | `media_creative` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `organizations`, `qr_codes`, `workspaces` | src/lib/qr-actions.ts |
| `updateQRSecurity` | `media_creative` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `organizations`, `qr_codes`, `workspaces` | src/lib/qr-actions.ts |
| `updateQRShortPath` | `media_creative` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `organizations`, `qr_codes`, `short_paths`, `workspaces` | src/lib/qr-actions.ts |
| `updateQRTemplate` | `media_creative` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `organizations`, `qr_code_templates`, `workspaces` | src/lib/qr-actions.ts |
| `verifyCustomDomain` | `media_creative` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `organizations`, `qr_custom_domains`, `workspaces` | src/lib/qr-domain-security-actions.ts |
| `GET /api/integrations/zoom/callback` | `meetings_conversations` | read | `L0_READ` | unmapped | — | — | `calendar_connections` | src/app/api/integrations/zoom/callback/route.ts |
| `POST /api/meetings/register` | `meetings_conversations` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `meetings`, `organizations`, `workspace_entities`, `workspaces` | src/app/api/meetings/register/route.ts |
| `addMeetingParticipantAction` | `meetings_conversations` | create | `L2_STATE_MUTATION` | extend | — | — | `meetings`, `participants`, `registrants` | src/app/actions/meeting-participant-actions.ts |
| `adminRegisterParticipantAction` | `meetings_conversations` | create | `L2_STATE_MUTATION` | unmapped | — | — | `meetings` | src/app/actions/meeting-registrants-actions.ts |
| `analyzeMeetingSpeechCoachingAction` | `meetings_conversations` | analyze | `L0_READ` | wrap | `requireWorkspace` | — | `meeting_speech_coaching` | src/app/actions/meeting-coach-actions.ts |
| `approveAndSyncActionItemAction` | `meetings_conversations` | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `meeting_action_items` | src/app/actions/meeting-action-items-actions.ts |
| `associateMeetingDealAction` | `meetings_conversations` | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | `meeting_deal_attributions` | src/app/actions/meeting-crm-actions.ts |
| `attachMeetingRecordingAction` | `meetings_conversations` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `meeting_recordings`, `meetings` | src/app/actions/meeting-recording-actions.ts |
| `bulkCancelMeetingsAction` | `meetings_conversations` | execute | `L2_STATE_MUTATION` | wrap | `requireWorkspace` | — | `meetings` | src/app/actions/meeting-bulk-actions.ts |
| `bulkImportParticipantsAction` | `meetings_conversations` | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `meetings`, `participants` | src/app/actions/meeting-participant-actions.ts |
| `bulkRegisterParticipantsAction` | `meetings_conversations` | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `entities`, `meetings` | src/app/actions/bulk-meeting-actions.ts |
| `bulkRegisterParticipantsActionCore` | `meetings_conversations` | create | `L2_STATE_MUTATION` | unmapped | — | — | `entities`, `meetings` | src/app/actions/bulk-meeting-actions.ts |
| `bulkRescheduleMeetingsAction` | `meetings_conversations` | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | `meetings` | src/app/actions/meeting-bulk-actions.ts |
| `cancelMeetingPostEvent` | `meetings_conversations` | execute | `L2_STATE_MUTATION` | wrap | `requireAuth` | — | `scheduled_messages` | src/app/actions/meeting-post-event-action.ts |
| `clearWorkspaceOAuthCredentialsAction` | `meetings_conversations` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `workspaces` | src/app/actions/calendar-connection-actions.ts |
| `convertActionItemToCrmTaskAction` | `meetings_conversations` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `meeting_intelligence`, `tasks` | src/app/actions/meeting-intelligence-actions.ts |
| `createBookingPaymentIntentAction` | `meetings_conversations` | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `payment_transactions` | src/app/actions/meeting-payment-actions.ts |
| `createEntityFromRegistration` | `meetings_conversations` | create | `L2_STATE_MUTATION` | extend | — | — | `automation_queue`, `meetings`, `registrants`, `workspace_entities` | src/app/actions/meeting-lead-capture-action.ts |
| `createGoogleCalendarEvent` | `meetings_conversations` | create | `L2_STATE_MUTATION` | extend | — | — | `calendar_connections`, `organizations`, `workspaces` | src/lib/services/integrations/google-calendar.ts |
| `createMeetingPollAction` | `meetings_conversations` | create | `L2_STATE_MUTATION` | wrap | `requireAuth` | — | `meeting_polls` | src/app/actions/meeting-poll-actions.ts |
| `createMicrosoftCalendarEvent` | `meetings_conversations` | create | `L2_STATE_MUTATION` | extend | — | — | `calendar_connections`, `organizations`, `workspaces` | src/lib/services/integrations/microsoft-calendar.ts |
| `createZoomMeeting` | `meetings_conversations` | create | `L2_STATE_MUTATION` | extend | — | — | `calendar_connections`, `organizations`, `workspaces` | src/lib/services/integrations/zoom-meeting.ts |
| `deleteGoogleCalendarEvent` | `meetings_conversations` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | `calendar_connections`, `organizations`, `workspaces` | src/lib/services/integrations/google-calendar.ts |
| `deleteMeetingRecordingAction` | `meetings_conversations` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireWorkspace` | — | `meeting_recordings` | src/app/actions/meeting-recording-actions.ts |
| `deleteMeetingWebhookAction` | `meetings_conversations` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `requireWorkspace` | — | `meeting_webhooks` | src/app/actions/meeting-webhook-actions.ts |
| `deleteMicrosoftCalendarEvent` | `meetings_conversations` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | `calendar_connections`, `organizations`, `workspaces` | src/lib/services/integrations/microsoft-calendar.ts |
| `deleteRegistrantAction` | `meetings_conversations` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | `scheduled_messages` | src/app/actions/meeting-registrants-actions.ts |
| `deleteWorkspaceResourceAction` | `meetings_conversations` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | `meeting_resources` | src/app/actions/meeting-resource-actions.ts |
| `deleteZoomMeeting` | `meetings_conversations` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | `calendar_connections`, `organizations`, `workspaces` | src/lib/services/integrations/zoom-meeting.ts |
| `deployMeetingTemplateAction` | `meetings_conversations` | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | `eventTypes` | src/app/actions/meeting-template-actions.ts |
| `disconnectCalendarConnectionAction` | `meetings_conversations` | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | `calendar_connections` | src/app/actions/calendar-connection-actions.ts |
| `endMeetingAction` | `meetings_conversations` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `meetings` | src/app/actions/meeting-post-event-action.ts |
| `evaluateRetentionPurgeAction` | `meetings_conversations` | analyze | `L0_READ` | wrap | `requireWorkspace` | — | `meetings` | src/app/actions/meeting-compliance-actions.ts |
| `exchangeGoogleCode` | `meetings_conversations` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `organizations`, `workspaces` | src/lib/services/integrations/google-calendar.ts |
| `exchangeMicrosoftCode` | `meetings_conversations` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `organizations`, `workspaces` | src/lib/services/integrations/microsoft-calendar.ts |
| `exchangeZoomCode` | `meetings_conversations` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `organizations`, `workspaces` | src/lib/services/integrations/zoom-meeting.ts |
| `exportMeetingAuditLogsAction` | `meetings_conversations` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `meetings` | src/app/actions/meeting-compliance-actions.ts |
| `extractActionItemsFromTranscript` | `meetings_conversations` | analyze | `L0_READ` | unmapped | — | — | — | src/lib/meetings/action-items-service.ts |
| `extractAndSaveMeetingActionItemsAction` | `meetings_conversations` | analyze | `L0_READ` | wrap | `requireAuth` | — | `meeting_action_items` | src/app/actions/meeting-action-items-actions.ts |
| `finalizeMeetingPollAction` | `meetings_conversations` | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | `meeting_polls`, `meetings` | src/app/actions/meeting-poll-actions.ts |
| `generateMeetingIntelligenceAction` | `meetings_conversations` | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireWorkspace` | — | `meeting_intelligence`, `meeting_transcripts`, `meetings`, `participants` | src/app/actions/meeting-intelligence-actions.ts |
| `generateMeetingPrepBriefAction` | `meetings_conversations` | draft | `L1_INTERNAL_DRAFT` | wrap | `requireWorkspace` | — | `meetings`, `participants` | src/app/actions/meeting-intelligence-actions.ts |
| `generateRecordingPlaybackUrlAction` | `meetings_conversations` | draft | `L1_INTERNAL_DRAFT` | unmapped | `requireWorkspace` | — | `meeting_recordings` | src/app/actions/meeting-recording-actions.ts |
| `getCalendarConnectionsAction` | `meetings_conversations` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `calendar_connections` | src/app/actions/calendar-connection-actions.ts |
| `getEventTypeWorkflowsAction` | `meetings_conversations` | read | `L0_READ` | unmapped | — | — | `meeting_workflows` | src/app/actions/meeting-workflow-actions.ts |
| `getGoogleAuthUrl` | `meetings_conversations` | read | `L0_READ` | unmapped | — | — | `organizations`, `workspaces` | src/lib/services/integrations/google-calendar.ts |
| `getGoogleAuthUrlAction` | `meetings_conversations` | read | `L0_READ` | unmapped | `requireWorkspace` | — | — | src/app/actions/calendar-connection-actions.ts |
| `getMeetingActionItemsAction` | `meetings_conversations` | read | `L0_READ` | wrap | `requireWorkspace` | — | `meeting_action_items` | src/app/actions/meeting-action-items-actions.ts |
| `getMeetingActivitiesAction` | `meetings_conversations` | read | `L0_READ` | wrap | `requireAuth` | — | `meeting_activities` | src/app/actions/meeting-activity-actions.ts |
| `getMeetingCRMContextAction` | `meetings_conversations` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `contacts`, `deals`, `meeting_activities` | src/app/actions/meeting-crm-actions.ts |
| `getMeetingFeedbackSummaryAction` | `meetings_conversations` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `meeting_feedback` | src/app/actions/meeting-feedback-actions.ts |
| `getMeetingIntelligenceAction` | `meetings_conversations` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `meeting_intelligence` | src/app/actions/meeting-intelligence-actions.ts |
| `getMeetingPollBySlugAction` | `meetings_conversations` | read | `L0_READ` | unmapped | — | — | `meeting_polls`, `votes` | src/app/actions/meeting-poll-actions.ts |
| `getMeetingPollsAction` | `meetings_conversations` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `meeting_polls` | src/app/actions/meeting-poll-actions.ts |
| `getMeetingRecordingsAction` | `meetings_conversations` | read | `L0_READ` | unmapped | — | — | `meeting_recordings` | src/app/actions/meeting-recording-actions.ts |
| `getMeetingReminderJobsAction` | `meetings_conversations` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `meeting_reminder_jobs` | src/app/actions/meeting-notification-actions.ts |
| `getMeetingsOperationalOverviewAction` | `meetings_conversations` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `bookings`, `meeting_participants`, `meetings` | src/app/actions/meeting-analytics-actions.ts |
| `getMeetingSpeechCoachingAction` | `meetings_conversations` | read | `L0_READ` | unmapped | `requireAuth` | — | `meeting_speech_coaching` | src/app/actions/meeting-coach-actions.ts |
| `getMeetingsTelemetryAction` | `meetings_conversations` | read | `L0_READ` | unmapped | — | — | — | src/lib/backoffice/backoffice-meetings-actions.ts |
| `getMeetingTemplatesAction` | `meetings_conversations` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `meeting_templates` | src/app/actions/meeting-template-actions.ts |
| `getMeetingWebhooksAction` | `meetings_conversations` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `meeting_webhooks` | src/app/actions/meeting-webhook-actions.ts |
| `getMicrosoftAuthUrl` | `meetings_conversations` | read | `L0_READ` | unmapped | — | — | `organizations`, `workspaces` | src/lib/services/integrations/microsoft-calendar.ts |
| `getMicrosoftAuthUrlAction` | `meetings_conversations` | read | `L0_READ` | unmapped | `requireWorkspace` | — | — | src/app/actions/calendar-connection-actions.ts |
| `getOrganizationOAuthCredentialsStatusAction` | `meetings_conversations` | read | `L0_READ` | unmapped | `assertUserTenantPermission`, `requireAuth` | `assertUserTenantPermission:administrator` | `organizations` | src/app/actions/calendar-connection-actions.ts |
| `getValidGoogleConnection` | `meetings_conversations` | read | `L0_READ` | unmapped | — | — | `calendar_connections`, `organizations`, `workspaces` | src/lib/services/integrations/google-calendar.ts |
| `getValidMicrosoftConnection` | `meetings_conversations` | read | `L0_READ` | unmapped | — | — | `calendar_connections`, `organizations`, `workspaces` | src/lib/services/integrations/microsoft-calendar.ts |
| `getValidZoomConnection` | `meetings_conversations` | read | `L0_READ` | unmapped | — | — | `calendar_connections`, `organizations`, `workspaces` | src/lib/services/integrations/zoom-meeting.ts |
| `getWebhookDeliveryLogsAction` | `meetings_conversations` | read | `L0_READ` | wrap | `requireWorkspace` | — | `webhook_delivery_logs` | src/app/actions/meeting-webhook-actions.ts |
| `getWorkspaceCalendarEventsAction` | `meetings_conversations` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `booking_holds`, `meetings` | src/app/actions/meeting-calendar-actions.ts |
| `getWorkspaceCompliancePolicyAction` | `meetings_conversations` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `meeting_compliance_policies` | src/app/actions/meeting-compliance-actions.ts |
| `getWorkspaceOAuthCredentialsStatusAction` | `meetings_conversations` | read | `L0_READ` | unmapped | `requireWorkspace` | — | `organizations`, `workspaces` | src/app/actions/calendar-connection-actions.ts |
| `getWorkspaceResourcesAction` | `meetings_conversations` | read | `L0_READ` | unmapped | — | — | `meeting_resources` | src/app/actions/meeting-resource-actions.ts |
| `getWorkspaceTelemetryMetricsAction` | `meetings_conversations` | read | `L0_READ` | unmapped | — | — | `meeting_telemetry_logs` | src/app/actions/meeting-telemetry-actions.ts |
| `getZoomAuthUrl` | `meetings_conversations` | read | `L0_READ` | unmapped | — | — | `organizations`, `workspaces` | src/lib/services/integrations/zoom-meeting.ts |
| `getZoomAuthUrlAction` | `meetings_conversations` | read | `L0_READ` | unmapped | `requireWorkspace` | — | — | src/app/actions/calendar-connection-actions.ts |
| `logFacilitatorAttendance` | `meetings_conversations` | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `attendees` | src/app/actions/meeting-facilitator-actions.ts |
| `manuallyUpdateGuestStatusAction` | `meetings_conversations` | update | `L2_STATE_MUTATION` | unmapped | — | — | `meetings`, `scheduled_messages` | src/app/actions/meeting-registrants-actions.ts |
| `migrateMeetingToUnifiedSchemaAction` | `meetings_conversations` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | — | src/app/actions/meeting-migration-actions.ts |
| `overrideSeriesInstanceAction` | `meetings_conversations` | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | `series_instance_overrides` | src/app/actions/meeting-bulk-actions.ts |
| `processBookingRefundAction` | `meetings_conversations` | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | `requireWorkspace` | — | `payment_transactions` | src/app/actions/meeting-payment-actions.ts |
| `queryGoogleFreeBusy` | `meetings_conversations` | search | `L0_READ` | unmapped | — | — | `calendar_connections`, `organizations`, `workspaces` | src/lib/services/integrations/google-calendar.ts |
| `queryMicrosoftFreeBusy` | `meetings_conversations` | search | `L0_READ` | unmapped | — | — | `calendar_connections`, `organizations`, `workspaces` | src/lib/services/integrations/microsoft-calendar.ts |
| `quickScheduleMeetingAction` | `meetings_conversations` | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth`, `requireWorkspace` | — | `booking_holds`, `meetings` | src/app/actions/meeting-calendar-actions.ts |
| `recordMeetingTelemetryAction` | `meetings_conversations` | create | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `meeting_telemetry_logs` | src/app/actions/meeting-telemetry-actions.ts |
| `refreshGoogleToken` | `meetings_conversations` | update | `L2_STATE_MUTATION` | unmapped | — | — | `calendar_connections`, `organizations`, `workspaces` | src/lib/services/integrations/google-calendar.ts |
| `refreshMicrosoftToken` | `meetings_conversations` | update | `L2_STATE_MUTATION` | unmapped | — | — | `calendar_connections`, `organizations`, `workspaces` | src/lib/services/integrations/microsoft-calendar.ts |
| `refreshZoomToken` | `meetings_conversations` | update | `L2_STATE_MUTATION` | unmapped | — | — | `calendar_connections`, `organizations`, `workspaces` | src/lib/services/integrations/zoom-meeting.ts |
| `removeParticipantAction` | `meetings_conversations` | delete | `L2_STATE_MUTATION` | unmapped | — | — | `meetings`, `participants`, `registrants` | src/app/actions/meeting-participant-actions.ts |
| `resendFacilitatorLinksAction` | `meetings_conversations` | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | — | — | `meetings` | src/app/actions/meeting-facilitator-actions.ts |
| `resendMagicJoinLinkAction` | `meetings_conversations` | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | — | — | — | src/lib/backoffice/backoffice-meetings-actions.ts |
| `reservePhysicalResourceAction` | `meetings_conversations` | execute | `L2_STATE_MUTATION`* | unmapped | `requireWorkspace` | — | `resource_reservations` | src/app/actions/meeting-resource-actions.ts |
| `resolveGoogleCredentials` | `meetings_conversations` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | `organizations`, `workspaces` | src/lib/services/integrations/google-calendar.ts |
| `resolveMicrosoftCredentials` | `meetings_conversations` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | `organizations`, `workspaces` | src/lib/services/integrations/microsoft-calendar.ts |
| `resolveZoomCredentials` | `meetings_conversations` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | `organizations`, `workspaces` | src/lib/services/integrations/zoom-meeting.ts |
| `runMeetingsFerAction` | `meetings_conversations` | execute | `L2_STATE_MUTATION` | unmapped | — | — | `meetings`, `registrants` | src/app/actions/run-meetings-fer-action.ts |
| `saveEventTypeWorkflowsAction` | `meetings_conversations` | update | `L2_STATE_MUTATION` | unmapped | — | — | `meeting_workflows` | src/app/actions/meeting-workflow-actions.ts |
| `saveMeetingWebhookAction` | `meetings_conversations` | update | `L2_STATE_MUTATION` | wrap | `requireAuth` | — | `meeting_webhooks` | src/app/actions/meeting-webhook-actions.ts |
| `saveOrganizationOAuthCredentialsAction` | `meetings_conversations` | update | `L2_STATE_MUTATION` | unmapped | `assertUserTenantPermission`, `requireAuth` | `assertUserTenantPermission:administrator` | `organizations` | src/app/actions/calendar-connection-actions.ts |
| `saveWorkspaceCompliancePolicyAction` | `meetings_conversations` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `meeting_compliance_policies` | src/app/actions/meeting-compliance-actions.ts |
| `saveWorkspaceOAuthCredentialsAction` | `meetings_conversations` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `workspaces` | src/app/actions/calendar-connection-actions.ts |
| `saveWorkspaceResourceAction` | `meetings_conversations` | update | `L2_STATE_MUTATION` | unmapped | — | — | `meeting_resources` | src/app/actions/meeting-resource-actions.ts |
| `scheduleMeetingPostEvent` | `meetings_conversations` | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | — | src/app/actions/meeting-post-event-action.ts |
| `scheduleMeetingRemindersAction` | `meetings_conversations` | execute | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `meeting_reminder_jobs` | src/app/actions/meeting-notification-actions.ts |
| `seedEnrichedMeetingTemplatesAction` | `meetings_conversations` | create | `L2_STATE_MUTATION` | unmapped | — | — | `message_templates` | src/app/actions/seed-meeting-invitation-templates-action.ts |
| `seedMeetingsV2Action` | `meetings_conversations` | create | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/seed-meetings-action.ts |
| `sendMeetingInvitationsAction` | `meetings_conversations` | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | — | — | `meetings`, `scheduled_messages` | src/app/actions/meeting-registrants-actions.ts |
| `sendRegistrantJoinLinkAction` | `meetings_conversations` | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | — | — | `meetings` | src/app/actions/meeting-registrants-actions.ts |
| `setPrimarySyncCalendarAction` | `meetings_conversations` | update | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `calendar_connections` | src/app/actions/calendar-connection-actions.ts |
| `submitPollVoteAction` | `meetings_conversations` | create | `L2_STATE_MUTATION` | unmapped | — | — | `meeting_polls`, `votes` | src/app/actions/meeting-poll-actions.ts |
| `submitPublicMeetingFeedbackAction` | `meetings_conversations` | create | `L2_STATE_MUTATION` | unmapped | — | — | `meeting_feedback`, `meetings` | src/app/actions/meeting-feedback-actions.ts |
| `submitRsvpResponseAction` | `meetings_conversations` | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `entities`, `meetings`, `scheduled_messages`, `workspace_entities` | src/app/actions/meeting-registrants-actions.ts |
| `syncBookingToExternalCalendarAction` | `meetings_conversations` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth`, `requireWorkspace` | — | `bookings` | src/app/actions/calendar-connection-actions.ts |
| `testDispatchWebhookAction` | `meetings_conversations` | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | wrap | `requireWorkspace` | — | `meeting_webhooks`, `webhook_delivery_logs` | src/app/actions/meeting-webhook-actions.ts |
| `toggleCalendarConflictCheckAction` | `meetings_conversations` | update | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `calendar_connections` | src/app/actions/calendar-connection-actions.ts |
| `toggleParticipantAttendanceAction` | `meetings_conversations` | update | `L2_STATE_MUTATION` | unmapped | — | — | `attendees`, `meetings`, `participants` | src/app/actions/meeting-participant-actions.ts |
| `triggerMeetingLifecycleWorkflowsAction` | `meetings_conversations` | execute | `L2_STATE_MUTATION` | unmapped | `requireWorkspace` | — | `contacts`, `meeting_workflows`, `scheduled_message_logs`, `tasks` | src/app/actions/meeting-workflow-actions.ts |
| `updateMeetingFacilitatorAction` | `meetings_conversations` | update | `L2_STATE_MUTATION` | wrap | `requireAuth` | — | `meetings` | src/app/actions/meeting-facilitator-actions.ts |
| `updateParticipantRoleAction` | `meetings_conversations` | update | `L2_STATE_MUTATION` | unmapped | — | — | `meetings`, `participants` | src/app/actions/meeting-participant-actions.ts |
| `updateParticipantRsvpAction` | `meetings_conversations` | update | `L2_STATE_MUTATION` | unmapped | — | — | `meetings`, `participants` | src/app/actions/meeting-participant-actions.ts |
| `updateRegistrantStatusAction` | `meetings_conversations` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/app/actions/meeting-registrants-actions.ts |
| `GET /api/integrations/google/callback` | `platform_integrations` | read | `L0_READ` | unmapped | — | — | `calendar_connections` | src/app/api/integrations/google/callback/route.ts |
| `GET /api/integrations/microsoft/callback` | `platform_integrations` | read | `L0_READ` | unmapped | — | — | `calendar_connections` | src/app/api/integrations/microsoft/callback/route.ts |
| `GET /api/webhooks/inbound/[id]` | `platform_integrations` | read | `L0_READ` | unmapped | — | — | `webhooks` | src/app/api/webhooks/inbound/[id]/route.ts |
| `POST /api/webhooks/inbound/[id]` | `platform_integrations` | execute | `L2_STATE_MUTATION`* | unmapped | `webhookSignature` | — | `webhooks` | src/app/api/webhooks/inbound/[id]/route.ts |
| `createMicrosoftTeamsMeeting` | `platform_integrations` | create | `L2_STATE_MUTATION` | unmapped | — | — | `calendar_connections`, `organizations`, `workspaces` | src/lib/services/integrations/microsoft-teams.ts |
| `deleteMicrosoftTeamsMeeting` | `platform_integrations` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | `calendar_connections`, `organizations`, `workspaces` | src/lib/services/integrations/microsoft-teams.ts |
| `detectEntityDrift` | `platform_integrations` | analyze | `L0_READ` | unmapped | — | — | — | src/lib/services/entity-sync-gateway.ts |
| `DirectorySyncService` | `platform_integrations` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/services/enterprise-identity/directory-sync-service.ts |
| `dispatchSignupWebhook` | `platform_integrations` | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | — | — | — | src/lib/webhook-actions.ts |
| `EntitySyncGateway` | `platform_integrations` | update | `L2_STATE_MUTATION` | unmapped | — | — | `entities`, `workspace_entities` | src/lib/services/entity-sync-gateway.ts |
| `exchangeMicrosoftCode` | `platform_integrations` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `organizations`, `workspaces` | src/lib/services/integrations/microsoft-teams.ts |
| `getIntegrationHealthOverviewAction` | `platform_integrations` | read | `L0_READ` | unmapped | — | — | `calendar_connections` | src/lib/backoffice/backoffice-integration-actions.ts |
| `getMicrosoftAuthUrl` | `platform_integrations` | read | `L0_READ` | unmapped | — | — | `organizations`, `workspaces` | src/lib/services/integrations/microsoft-teams.ts |
| `getValidConnection` | `platform_integrations` | read | `L0_READ` | unmapped | — | — | `calendar_connections`, `organizations`, `workspaces` | src/lib/services/integrations/microsoft-teams.ts |
| `manualReSyncBookingAction` | `platform_integrations` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/backoffice/backoffice-integration-actions.ts |
| `refreshMicrosoftToken` | `platform_integrations` | update | `L2_STATE_MUTATION` | unmapped | — | — | `calendar_connections`, `organizations`, `workspaces` | src/lib/services/integrations/microsoft-teams.ts |
| `resolveMicrosoftCredentials` | `platform_integrations` | draft | `L1_INTERNAL_DRAFT` | unmapped | — | — | `organizations`, `workspaces` | src/lib/services/integrations/microsoft-teams.ts |
| `verifyIntegrationConnectionAction` | `platform_integrations` | read | `L0_READ` | unmapped | — | — | `calendar_connections` | src/lib/backoffice/backoffice-integration-actions.ts |
| `GET /api/migration/schoolid-to-entityid-mapping` | `school_operations` | read | `L0_READ` | unmapped | `authenticateApiRequest` | — | `schools` | src/app/api/migration/schoolid-to-entityid-mapping/route.ts |
| `createApplication` | `school_operations` | create | `L2_STATE_MUTATION` | unmapped | — | — | `applications` | src/lib/school-enrollment-actions.ts |
| `createEnrollment` | `school_operations` | create | `L2_STATE_MUTATION` | unmapped | — | — | `enrollments` | src/lib/school-enrollment-actions.ts |
| `createSchoolVisit` | `school_operations` | create | `L2_STATE_MUTATION` | unmapped | — | — | `schoolVisits` | src/lib/school-enrollment-actions.ts |
| `extractSchoolData` | `school_operations` | analyze | `L0_READ` | unmapped | `requireAuth` | — | `organizations` | src/ai/flows/extract-school-data-flow.ts |
| `getApplicationsForEntity` | `school_operations` | read | `L0_READ` | unmapped | — | — | `applications` | src/lib/school-enrollment-actions.ts |
| `getEnrollmentsForEntity` | `school_operations` | read | `L0_READ` | unmapped | — | — | `enrollments` | src/lib/school-enrollment-actions.ts |
| `getSchoolVisitsForEntity` | `school_operations` | read | `L0_READ` | unmapped | — | — | `schoolVisits` | src/lib/school-enrollment-actions.ts |
| `logMeetingAttendance` | `school_operations` | create | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `attendees`, `meetings`, `registrants` | src/app/actions/meeting-attendance-actions.ts |
| `toggleRegistrantAttendance` | `school_operations` | update | `L2_STATE_MUTATION` | unmapped | — | — | `meetings`, `registrants` | src/app/actions/meeting-attendance-actions.ts |
| `updateApplicationStatus` | `school_operations` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/school-enrollment-actions.ts |
| `updateEnrollmentStatus` | `school_operations` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/school-enrollment-actions.ts |
| `updateVisitStatus` | `school_operations` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/school-enrollment-actions.ts |
| `validateRegistrantToken` | `school_operations` | read | `L0_READ` | unmapped | `requireAuth` | — | `meetings`, `registrants` | src/app/actions/meeting-attendance-actions.ts |
| `GET /api/tasks` | `tasks_productivity` | read | `L0_READ` | unmapped | — | — | — | src/app/api/tasks/route.ts |
| `POST /api/tasks` | `tasks_productivity` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `tasks` | src/app/api/tasks/route.ts |
| `DELETE /api/tasks/[taskId]` | `tasks_productivity` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/app/api/tasks/[taskId]/route.ts |
| `PATCH /api/tasks/[taskId]` | `tasks_productivity` | update | `L2_STATE_MUTATION` | unmapped | — | — | `tasks` | src/app/api/tasks/[taskId]/route.ts |
| `autoEndCompletedMeetings` | `tasks_productivity` | execute | `L2_STATE_MUTATION`* | unmapped | — | — | `meetings` | src/lib/reminder-actions.ts |
| `bulkCompleteTasks` | `tasks_productivity` | execute | `L2_STATE_MUTATION`* | extend | — | — | — | src/lib/task-actions.ts |
| `bulkCreateTasksAction` | `tasks_productivity` | create | `L2_STATE_MUTATION` | wrap | `requireAuth` | — | `tasks`, `workspace_entities` | src/app/actions/bulk-task-actions.ts |
| `bulkCreateTasksActionCore` | `tasks_productivity` | create | `L2_STATE_MUTATION` | unmapped | — | — | `tasks`, `workspace_entities` | src/app/actions/bulk-task-actions.ts |
| `bulkDeleteTasks` | `tasks_productivity` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/lib/task-actions.ts |
| `bulkDeleteTasksAction` | `tasks_productivity` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `canUser`, `requireWorkspace` | `canUser:delete`, `canUser:operations`, `canUser:tasks` | `tasks` | src/lib/task-server-actions.ts |
| `bulkUpdateTasks` | `tasks_productivity` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/task-actions.ts |
| `bulkUpdateTasksAction` | `tasks_productivity` | update | `L2_STATE_MUTATION` | unmapped | `canUser`, `requireWorkspace` | `canUser:edit`, `canUser:operations`, `canUser:tasks` | `tasks` | src/lib/task-server-actions.ts |
| `cancelRemindersForMeeting` | `tasks_productivity` | execute | `L2_STATE_MUTATION` | extend | — | — | `scheduled_messages` | src/lib/reminder-actions.ts |
| `completeTaskNonBlocking` | `tasks_productivity` | execute | `L2_STATE_MUTATION`* | extend | — | — | — | src/lib/task-actions.ts |
| `createTaskAction` | `tasks_productivity` | create | `L2_STATE_MUTATION` | wrap | `canUser` | `canUser:create`, `canUser:operations`, `canUser:tasks` | `tasks` | src/lib/task-server-actions.ts |
| `createTaskFromAutomation` | `tasks_productivity` | create | `L2_STATE_MUTATION` | unmapped | — | — | `tasks` | src/lib/task-server-actions.ts |
| `createTaskNonBlocking` | `tasks_productivity` | create | `L2_STATE_MUTATION` | unmapped | — | — | `tasks` | src/lib/task-actions.ts |
| `deleteTaskAction` | `tasks_productivity` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | `canUser` | `canUser:delete`, `canUser:operations`, `canUser:tasks` | `tasks` | src/lib/task-server-actions.ts |
| `deleteTaskNonBlocking` | `tasks_productivity` | delete | `L4_PRIVILEGED_DESTRUCTIVE` | unmapped | — | — | — | src/lib/task-actions.ts |
| `getTaskInterlinkUrl` | `tasks_productivity` | read | `L0_READ` | extend | — | — | — | src/lib/task-actions.ts |
| `getTasksForContact` | `tasks_productivity` | read | `L0_READ` | extend | — | — | `tasks` | src/lib/task-server-actions.ts |
| `processScheduledCampaigns` | `tasks_productivity` | execute | `L2_STATE_MUTATION` | unmapped | `cronSecret` | — | `message_campaigns` | src/lib/reminder-actions.ts |
| `processScheduledMessages` | `tasks_productivity` | execute | `L2_STATE_MUTATION` | unmapped | — | — | `meetings`, `registrants`, `scheduled_messages` | src/lib/reminder-actions.ts |
| `rescheduleRemindersForMeeting` | `tasks_productivity` | execute | `L2_STATE_MUTATION`* | unmapped | `requireAuth` | — | `entities`, `meetings`, `organizations`, `registrants`, `scheduled_messages` | src/lib/reminder-actions.ts |
| `scheduleFacilitatorAlerts` | `tasks_productivity` | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `scheduled_messages` | src/lib/reminder-actions.ts |
| `scheduleFormReminders` | `tasks_productivity` | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `entities`, `scheduled_messages` | src/lib/reminder-actions.ts |
| `scheduleMeetingInvitations` | `tasks_productivity` | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `organizations`, `scheduled_messages` | src/lib/reminder-actions.ts |
| `scheduleMessagingConfigReminders` | `tasks_productivity` | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `meetings`, `registrants`, `scheduled_messages` | src/lib/reminder-actions.ts |
| `schedulePostEventMessages` | `tasks_productivity` | execute | `L2_STATE_MUTATION` | wrap | `requireAuth` | — | `meetings`, `registrants`, `scheduled_messages` | src/lib/reminder-actions.ts |
| `scheduleRegistrationAck` | `tasks_productivity` | execute | `L2_STATE_MUTATION` | unmapped | `requireAuth` | — | `scheduled_messages` | src/lib/reminder-actions.ts |
| `scheduleRemindersForMeeting` | `tasks_productivity` | execute | `L2_STATE_MUTATION` | unmapped | — | — | `entities`, `scheduled_messages` | src/lib/reminder-actions.ts |
| `scheduleRemindersForNewRegistrant` | `tasks_productivity` | execute | `L2_STATE_MUTATION` | unmapped | — | — | `meetings`, `registrants`, `scheduled_messages` | src/lib/reminder-actions.ts |
| `sendFacilitatorNewRegistrationAlert` | `tasks_productivity` | execute | `L3_EXTERNAL_COMMUNICATION_FINANCE` | unmapped | — | — | `meetings`, `registrants`, `scheduled_messages` | src/lib/reminder-actions.ts |
| `updateTaskAction` | `tasks_productivity` | update | `L2_STATE_MUTATION` | wrap | `canUser` | `canUser:edit`, `canUser:operations`, `canUser:tasks` | `tasks` | src/lib/task-server-actions.ts |
| `updateTaskNonBlocking` | `tasks_productivity` | update | `L2_STATE_MUTATION` | unmapped | — | — | — | src/lib/task-actions.ts |

`*` = assigned by fallback / low confidence.
