'use client';

/**
 * ARCHITECTURE:
 * Live Multi-User Cursor & Presence Overlay (Phase 7 - Real-Time Collaboration)
 * 
 * Renders peer user cursor tags, presence badges, and live selection highlights
 * in normalized canvas coordinate space (0-100%).
 * 
 * CAUTION:
 * Root layer must have pointer-events-none to prevent interfering with element manipulation.
 * Strict typing (0% any).
 */

import * as React from 'react';
import type { PresenceUser } from '@/lib/creative/creative-types';

interface LiveCursorOverlayProps {
  users: PresenceUser[];
}

export function LiveCursorOverlay({ users }: LiveCursorOverlayProps) {
  if (!users || users.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      {users.map((user) => {
        if (user.cursorX === undefined || user.cursorY === undefined) return null;

        return (
          <div
            key={user.id}
            style={{
              left: `${user.cursorX}%`,
              top: `${user.cursorY}%`,
              transition: 'left 80ms ease-out, top 80ms ease-out',
            }}
            className="absolute transform -translate-x-1 -translate-y-1 flex flex-col items-start gap-1"
          >
            {/* Cursor SVG Arrow */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="drop-shadow-md"
            >
              <path
                d="M0 0L14 5.5L7.5 7.5L5.5 14L0 0Z"
                fill={user.color || '#10b981'}
                stroke="#020617"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>

            {/* Name Tag Pill */}
            <div
              style={{ backgroundColor: user.color || '#10b981' }}
              className="px-2 py-0.5 rounded-full text-[10px] font-black text-slate-950 shadow-lg whitespace-nowrap"
            >
              {user.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}
