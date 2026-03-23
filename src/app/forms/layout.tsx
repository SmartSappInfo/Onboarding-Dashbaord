import type { ReactNode } from 'react';

export default function FormsLayout({ children }: { children: ReactNode }) {
  return (
      <div className="light">
          {children}
      </div>
  );
}
