import type { ReactNode } from 'react';

export default function MeetingsLayout({ children }: { children: ReactNode }) {
  return <div className="dark">{children}</div>;
}
