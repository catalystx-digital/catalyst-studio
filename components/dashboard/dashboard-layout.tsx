import React from 'react';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-dark-primary flex flex-col">{children}</div>;
}


