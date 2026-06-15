import { describe, it, expect } from 'vitest';
import {
  resolveRouteTitle,
  ADMIN_ROUTE_TITLES,
  BACKOFFICE_ROUTE_TITLES,
} from '../route-titles';

describe('resolveRouteTitle', () => {
  it('matches an exact route', () => {
    expect(resolveRouteTitle('/admin', ADMIN_ROUTE_TITLES)).toBe('Dashboard');
  });

  it('matches a nested route by its section prefix', () => {
    expect(resolveRouteTitle('/admin/entities/123', ADMIN_ROUTE_TITLES)).toBe('Entities');
  });

  it('prefers the longest (most specific) prefix', () => {
    expect(resolveRouteTitle('/admin/entities/lead-scoring', ADMIN_ROUTE_TITLES)).toBe('Lead Cleanup');
    expect(resolveRouteTitle('/admin/messaging/call-centre', ADMIN_ROUTE_TITLES)).toBe('Call Centre');
    expect(resolveRouteTitle('/admin/messaging/threads', ADMIN_ROUTE_TITLES)).toBe('Messaging');
  });

  it('does not let /admin swallow a deeper unknown route incorrectly', () => {
    // Unknown deep route still resolves to the nearest known prefix.
    expect(resolveRouteTitle('/admin/surveys/abc/edit', ADMIN_ROUTE_TITLES)).toBe('Surveys');
  });

  it('falls back when nothing matches', () => {
    expect(resolveRouteTitle('/totally/unknown', ADMIN_ROUTE_TITLES, 'Admin')).toBe('Admin');
    expect(resolveRouteTitle('/totally/unknown', ADMIN_ROUTE_TITLES)).toBe('');
  });

  it('does not partial-match a sibling that shares a prefix string', () => {
    // '/admin/users' must not match '/admin/users-archive'
    expect(resolveRouteTitle('/admin/users-archive', ADMIN_ROUTE_TITLES)).not.toBe('Users');
  });

  it('resolves backoffice routes', () => {
    expect(resolveRouteTitle('/backoffice', BACKOFFICE_ROUTE_TITLES)).toBe('Dashboard');
    expect(resolveRouteTitle('/backoffice/organizations/org_1', BACKOFFICE_ROUTE_TITLES)).toBe('Organizations');
    expect(resolveRouteTitle('/backoffice/messaging/blueprints', BACKOFFICE_ROUTE_TITLES)).toBe('System Blueprints');
  });
});
