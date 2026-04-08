# Meetings Feature Documentation

## Overview

The Meetings module is a comprehensive session management system for scheduling, hosting, and tracking institutional engagement sessions. It supports three distinct meeting types with public-facing portals, attendance tracking, and intelligence reporting.

## Meeting Types

### 1. Parent Engagement Sessions
- **Purpose**: Onboard parents to the SmartSapp platform
- **Public URL**: `/meetings/parent-engagement/{schoolSlug}`
- **Features**:
  - Countdown timer to meeting start
  - Join form with parent and children names
  - App download section
  - Profile setup guidance
  - Brochure downloads
  - Video recording playback
  - Help videos library
  - Testimonials section

### 2. Kickoff Meetings
- **Purpose**: Initial institutional onboarding and timeline setting
- **Public URL**: `/meetings/kickoff/{schoolSlug}`
- **Features**:
  - Countdown timer
  - Join form for institutional representatives
  - Recording playback
  - Simplified layout focused on institutional context

### 3. Training Sessions
- **Purpose**: Staff training on SmartSapp platform features
- **Public URL**: `/meetings/training/{schoolSlug}`
- **Features**:
  - Countdown timer
  - Join form for staff members
  - Recording playback
  - Training-focused messaging

## Core Functionalities

### Meeting Creation & Management

**Admin Interface** (`/admin/meetings`)
- List view with filtering by meeting type
- Calendar view for temporal visualization
- Quick actions: Copy link, View public page, View intelligence, Edit, Delete
- Schedule new meetings with comprehensive configuration

**Meeting Configuration**
- School/institution selection
- Meeting type selection
- Date and time scheduling
- Google Meet link integration
- Hero image upload
- Recording URL (YouTube)
- Brochure attachment
- Public URL slug customization

### Public Meeting Portals

**Dynamic Meeting Pages**
- Responsive hero section with school branding
- Real-time countdown timer
- Meeting state detection (upcoming, ended, recording available)
- Join form with validation
- Animated hero shapes and light rays effects
- Scroll indicators for content sections

**Join Form Features**
- Parent/guardian name capture
- Multiple children names (dynamic fields)
- Meeting time validation (5 minutes before start)
- Attendance logging to Firestore
- Automatic meeting room redirect

### Attendance Tracking

**Attendee Collection** (`meetings/{meetingId}/attendees`)
- Parent name
- Children names array
- Join timestamp
- School/entity association

**Real-time Tracking**
- Automatic logging on form submission
- Non-blocking (continues even if logging fails)
- Firestore subcollection structure

### Intelligence & Reporting

**Results Dashboard** (`/admin/meetings/{id}/results`)

**Key Metrics**
- Families joined count
- Children represented count
- Capture density (avg children per parent)
- Protocol status indicator

**Visualizations**
- Login velocity chart (time-series line chart)
- Attendance timeline by 10-minute intervals
- Real-time data updates

**Attendee Registry**
- Searchable table of all attendees
- Parent names with initials avatars
- Children names as badges
- Join timestamps
- Verification status

**Export Functionality**
- CSV export of attendance data
- Includes parent name, children, join timestamp
- Filename: `Attendance_{SchoolName}_{Date}.csv`

### Meeting Calendar

**Calendar View** (`MeetingCalendar.tsx`)
- Month-by-month navigation
- Day grid with meeting indicators
- Color-coded by meeting type
- Meeting count badges
- Click to view intelligence
- Today highlighting
- Meeting time display

### Multi-Workspace Support

**Workspace Visibility**
- Meetings inherit `workspaceIds` from parent school
- Automatic synchronization with school workspace assignments
- Workspace-scoped queries for admin views
- Cross-workspace meeting visibility when school is shared

### Entity Migration Support

**Dual-Write Pattern**
- Legacy fields: `schoolId`, `schoolName`, `schoolSlug`
- New fields: `entityId`, `entityType`
- Backward compatibility maintained
- Adapter layer integration for contact resolution

### Internal Notifications

**Admin Alert Configuration**
- Enable/disable admin notifications
- Channel selection (email, sms, both)
- Notify assigned manager option
- Specific user targeting
- Custom email/SMS templates
- Triggered on meeting creation/update

## Data Model

### Meeting Document Structure

```typescript
interface Meeting {
  id: string;
  // Legacy fields (backward compatibility)
  schoolId?: string;
  schoolName?: string;
  schoolSlug?: string;
  // New unified entity fields
  entityId?: string;
  entityType?: EntityType;
  // Multi-workspace support
  workspaceIds: string[];
  // Meeting details
  meetingTime: string; // ISO timestamp
  meetingLink: string; // Google Meet URL
  type: MeetingType; // { id, name, slug }
  // Assets
  heroImageUrl?: string;
  recordingUrl?: string;
  brochureUrl?: string;
  // Admin notifications
  adminAlertsEnabled?: boolean;
  adminAlertChannel?: 'email' | 'sms' | 'both';
  adminAlertNotifyManager?: boolean;
  adminAlertSpecificUserIds?: string[];
  adminAlertEmailTemplateId?: string;
  adminAlertSmsTemplateId?: string;
}
```

### Attendee Document Structure

```typescript
interface Attendee {
  id: string;
  meetingId: string;
  schoolId: string;
  parentName: string;
  childrenNames: string[];
  joinedAt: string; // ISO timestamp
}
```

## Components

### Public-Facing Components

**Meeting Hero Components**
- `MeetingHero.tsx` - Parent engagement hero
- `KickoffMeetingHero.tsx` - Kickoff meeting hero
- `TrainingMeetingHero.tsx` - Training session hero

**Supporting Components**
- `JoinMeetingForm.tsx` - Attendance form with validation
- `JoinMeetingButton.tsx` - Quick join button
- `CountdownTimer.tsx` - Real-time countdown display
- `RecordingSection.tsx` - Video playback section
- `MeetingNotFound.tsx` - 404 error state
- `SchoolMeetingLoader.tsx` - Dynamic meeting resolver

### Admin Components

**Management Interface**
- `MeetingsClient.tsx` - Main admin interface
- `MeetingCalendar.tsx` - Calendar visualization
- `ResultsClient.tsx` - Intelligence dashboard
- `BrochureSelect.tsx` - Brochure picker with media library

## Routes

### Public Routes
- `/meetings/[slug]` - Legacy redirector to parent-engagement
- `/meetings/parent-engagement/[schoolSlug]` - Parent engagement portal
- `/meetings/kickoff/[schoolSlug]` - Kickoff meeting portal
- `/meetings/training/[schoolSlug]` - Training session portal

### Admin Routes
- `/admin/meetings` - Meeting management hub
- `/admin/meetings/new` - Create new meeting
- `/admin/meetings/[id]/edit` - Edit meeting configuration
- `/admin/meetings/[id]/results` - View intelligence dashboard

## Integration Points

### Activity Logging
- Meeting creation triggers `meeting_created` activity
- Logs to activity timeline with workspace context
- Includes metadata: meetingId, meetingTime

### Automation Engine
- `MEETING_CREATED` trigger available
- Can trigger workflows on meeting scheduling
- Payload includes school/entity context

### Messaging System
- Send invites/reminders via messaging composer
- Pre-populated variables: school_name, meeting_type, date, time, link
- Template-based communication

### Dashboard Integration
- "Upcoming Meetings" widget on main dashboard
- Quick access to meeting management
- Metrics display (total meetings count)

## User Permissions

**Required Permissions**
- `meetings_manage` - Schedule and edit meetings
- `schools_view` - View associated schools
- `schools_edit` - Modify school meeting associations

## Best Practices

### Meeting Scheduling
1. Schedule meetings at least 24 hours in advance
2. Test Google Meet links before sharing
3. Upload hero images optimized for web (< 500KB)
4. Use descriptive slugs matching school names

### Attendance Tracking
1. Monitor join velocity in real-time
2. Export attendance data after each session
3. Follow up with non-attendees via messaging
4. Review intelligence metrics for engagement insights

### Recording Management
1. Upload recordings within 24 hours of session
2. Use YouTube for hosting (better streaming)
3. Update meeting with recording URL
4. Notify attendees when recording is available

### Multi-Workspace Considerations
1. Meetings inherit workspace visibility from schools
2. Ensure school is assigned to correct workspaces
3. Use workspace filters in admin views
4. Consider cross-workspace implications for shared schools

## Technical Notes

### Performance Optimizations
- Firestore queries use `workspaceIds` array-contains for efficient filtering
- Meeting resolution uses slug-based lookup with caching
- Attendance subcollections prevent main document bloat
- Calendar view uses memoized date calculations

### Security
- Public meeting pages require no authentication
- Admin pages protected by role-based access control
- Attendance logging is non-blocking to prevent abuse
- Meeting links are not validated server-side (trust Google Meet)

### Migration Strategy
- Meetings support both `schoolId` and `entityId` identifiers
- Adapter layer resolves contacts transparently
- Legacy meetings continue to function during migration
- New meetings populate both identifier sets (dual-write)

## Future Enhancements

### Planned Features
- Recurring meeting support
- Breakout room management
- Attendance reminders (automated)
- Post-meeting surveys
- Meeting analytics dashboard
- Integration with calendar systems (Google Calendar, Outlook)
- Waiting room functionality
- Meeting capacity limits

### Under Consideration
- Live polling during meetings
- Q&A session management
- Screen sharing controls
- Meeting recording automation
- Attendance certificates
- Multi-language support for public portals
