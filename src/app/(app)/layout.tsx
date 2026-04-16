/**
 * Authenticated app shell layout.
 * Phase 1: add AuthBoundary redirect + Sidebar + Topbar + BellMenu.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Phase 1: Sidebar goes here */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
