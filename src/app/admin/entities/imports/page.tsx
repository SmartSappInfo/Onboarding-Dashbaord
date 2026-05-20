import React from 'react';
import ImportsLogClient from './ImportsLogClient';

export const metadata = {
  title: 'Imports Log | Administrator',
};

export default function ImportsLogPage() {
  return (
    <div className="flex-1 w-full bg-slate-50/30 dark:bg-slate-950/20">
      <ImportsLogClient />
    </div>
  );
}
