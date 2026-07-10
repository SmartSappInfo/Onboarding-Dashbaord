'use client';

import * as React from 'react';

export interface WorkspaceContextType {
  readonly workspaceId?: string;
  readonly organizationId?: string;
}

export const WorkspaceContext = React.createContext<WorkspaceContextType>({});
