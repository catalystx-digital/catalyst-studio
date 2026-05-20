import type { ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#080808] px-4 py-12 text-white">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#0b1120] to-[#020617] opacity-90" />
        <div className="absolute -left-1/3 top-10 h-96 w-96 rounded-full bg-catalyst-orange/20 blur-3xl" />
        <div className="absolute -right-1/4 bottom-0 h-[28rem] w-[28rem] rounded-full bg-catalyst-blue/25 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(255,255,255,0.06),transparent_45%)]" />
      </div>
      <div className="relative w-full max-w-5xl">{children}</div>
    </div>
  );
}
