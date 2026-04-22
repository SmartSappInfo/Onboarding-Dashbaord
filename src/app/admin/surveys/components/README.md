# Survey Assignee Links Feature

## Overview

This feature allows surveys with multiple assignees to display a modal with unique links for each assignee. Each link includes a `ref` parameter that tracks which user the survey was assigned to.

## Components

### AssigneeLinksModal

A modal component that displays:
- List of all assignees with their details (name, email, phone)
- Unique survey link for each assignee
- Copy button for each link
- Quick send buttons for email and SMS (if contact info available)

**Props:**
- `open`: boolean - Controls modal visibility
- `onOpenChange`: (open: boolean) => void - Callback when modal state changes
- `surveyTitle`: string - Title of the survey to display
- `assigneeLinks`: AssigneeLink[] - Array of assignee details with links
- `onSendMessage`: (userId: string, channel: 'email' | 'sms') => Promise<void> - Callback to send messages
- `isLoading`: boolean - Shows loading state while fetching assignee details

## Server Actions

### getAssigneeDetails

Fetches user details for a list of user IDs.

**Parameters:**
- `userIds`: string[] - Array of user IDs to fetch

**Returns:**
```typescript
{
  success: boolean;
  assignees?: AssigneeDetails[];
  error?: string;
}
```

### sendSurveyLinkToAssignee

Sends a survey link to an assignee via email or SMS.

**Parameters:**
- `userId`: string - User ID of the assignee
- `surveyTitle`: string - Title of the survey
- `surveyLink`: string - Unique survey link for the assignee
- `channel`: 'email' | 'sms' - Communication channel

**Returns:**
```typescript
{
  success: boolean;
  error?: string;
}
```

## Usage

In the surveys list view, when clicking the "Copy Public Link" button:

1. **No assignees or single assignee**: Copies the link directly to clipboard
2. **Multiple assignees**: Opens the AssigneeLinksModal with:
   - All assignee details
   - Unique links with `?ref={userId}` parameter
   - Options to copy individual links
   - Options to send via email/SMS

## Link Format

- **Generic link**: `/surveys/{slug}`
- **Single assignee**: `/surveys/{slug}?ref={userId}`
- **Multiple assignees**: Each gets `/surveys/{slug}?ref={userId}`

The `ref` parameter is used by the survey page to track which user was assigned the survey.

## Message Templates

When sending via email or SMS, the system uses the `sendRawMessage` function with:

**Email:**
- Subject: "Survey Assignment: {surveyTitle}"
- HTML body with survey title, personalized greeting, and CTA button

**SMS:**
- Plain text with survey title and link

## Future Enhancements

- [ ] Custom message templates for survey assignments
- [ ] Bulk send to all assignees
- [ ] Track link opens and survey completions per assignee
- [ ] Reminder functionality for incomplete surveys
