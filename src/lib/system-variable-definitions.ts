import { VariableDefinition } from './types';

/**
 * Returns the list of standard system variables for Meetings.
 * These are guaranteed to exist for all meeting blueprints and are resolved via the Messaging Engine.
 */
export const getMeetingSystemVariables = (): VariableDefinition[] => [
    { id: 'mv_title', key: 'meeting_title', label: 'Meeting Title', entity: 'Meeting', source: 'static', category: 'meetings', path: 'meeting.heroTitle', type: 'string' },
    { id: 'mv_date', key: 'meeting_date', label: 'Meeting Date', entity: 'Meeting', source: 'static', category: 'meetings', path: 'meeting.meetingTime', type: 'date' },
    { id: 'mv_time', key: 'meeting_time', label: 'Meeting Time', entity: 'Meeting', source: 'static', category: 'meetings', path: 'meeting.meetingTime', type: 'time' },
    { id: 'mv_duration', key: 'meeting_duration', label: 'Duration (Mins)', entity: 'Meeting', source: 'static', category: 'meetings', path: 'meeting.durationMinutes', type: 'number' },
    { id: 'mv_timezone', key: 'meeting_timezone', label: 'Meeting Timezone', entity: 'Meeting', source: 'static', category: 'meetings', path: 'org.settings.defaultTimezone', type: 'string' },
    { id: 'mv_link', key: 'meeting_link', label: 'Meeting Link', entity: 'Meeting', source: 'static', category: 'meetings', path: 'meeting.meetingLink', type: 'url' },
    { id: 'mv_cal', key: 'calendar_link', label: 'Calendar Link', entity: 'Meeting', source: 'static', category: 'meetings', path: 'computed', type: 'url' },
    { id: 'mv_type', key: 'meeting_type', label: 'Meeting Type', entity: 'Meeting', source: 'static', category: 'meetings', path: 'meeting.type.name', type: 'string' },
    { id: 'mv_organizer', key: 'organizer_name', label: 'Organizer Name', entity: 'Meeting', source: 'static', category: 'meetings', path: 'meeting.assignedTo.name', type: 'string' },
    { id: 'mv_recording', key: 'recording_link', label: 'Recording Link', entity: 'Meeting', source: 'static', category: 'meetings', path: 'meeting.recordingUrl', type: 'url' },
    { id: 'mv_feedback', key: 'feedback_form_link', label: 'Feedback Form Link', entity: 'Meeting', source: 'static', category: 'meetings', path: 'meeting.feedbackFormUrl', type: 'url' },
    { id: 'mv_resource', key: 'resource_link', label: 'Resource Link', entity: 'Meeting', source: 'static', category: 'meetings', path: 'meeting.resourceUrl', type: 'url' },
    { id: 'mv_dashboard', key: 'dashboard_link', label: 'Dashboard Link', entity: 'Meeting', source: 'static', category: 'meetings', path: 'computed', type: 'url' },
    { id: 'mv_reg_count', key: 'registrant_count', label: 'Registrant Count', entity: 'Meeting', source: 'static', category: 'meetings', path: 'computed', type: 'number' },
    { id: 'mv_att_count', key: 'attendee_count', label: 'Attendee Count', entity: 'Meeting', source: 'static', category: 'meetings', path: 'computed', type: 'number' },
    { id: 'mv_noshow', key: 'no_show_count', label: 'No-Show Count', entity: 'Meeting', source: 'static', category: 'meetings', path: 'computed', type: 'number' },
    { id: 'mv_one_click', key: 'meeting_registrant_one_click_link', label: 'One-Click RSVP Link', entity: 'Meeting', source: 'static', category: 'meetings', path: 'computed', type: 'url' },
    { id: 'mv_join_link', key: 'registrant_join_link', label: 'Registrant Join Link', entity: 'Meeting', source: 'static', category: 'meetings', path: 'computed', type: 'url' },
];

/**
 * Returns standard system variables for Surveys (if applicable, separate from user-created fields).
 */
export const getSurveySystemVariables = (): VariableDefinition[] => [
    { id: 'sv_score', key: 'survey_score', label: 'Survey Score', entity: 'SurveyResponse', source: 'static', category: 'surveys', path: 'computed', type: 'number' },
    { id: 'sv_max', key: 'max_score', label: 'Max Score', entity: 'SurveyResponse', source: 'static', category: 'surveys', path: 'computed', type: 'number' },
    { id: 'sv_outcome', key: 'outcome_label', label: 'Outcome Label', entity: 'SurveyResponse', source: 'static', category: 'surveys', path: 'computed', type: 'string' },
    { id: 'sv_result', key: 'result_url', label: 'Result URL', entity: 'SurveyResponse', source: 'static', category: 'surveys', path: 'computed', type: 'url' },
];

/**
 * Returns standard system variables for common global contexts.
 */
export const getCommonSystemVariables = (): VariableDefinition[] => [
    { id: 'cv_org_name', key: 'organization_name', label: 'Organization Name', entity: 'Common', source: 'static', category: 'common', path: 'org.name', type: 'string' },
    { id: 'cv_ws_name', key: 'workspace_name', label: 'Workspace Name', entity: 'Common', source: 'static', category: 'common', path: 'workspace.name', type: 'string' },
    { id: 'cv_ent_name', key: 'entity_name', label: 'Entity Name', entity: 'Common', source: 'static', category: 'common', path: 'computed', type: 'string' },
    { id: 'cv_year', key: 'current_year', label: 'Current Year', entity: 'Common', source: 'static', category: 'common', path: 'computed', type: 'string' },
];

/**
 * Gets all globally applicable system variables that do not come from Firestore.
 */
export const getAllSystemVariables = (): VariableDefinition[] => {
    return [
        ...getMeetingSystemVariables(),
        ...getSurveySystemVariables(),
        ...getCommonSystemVariables(),
    ];
};
