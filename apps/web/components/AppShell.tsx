import { ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";
import { RightPanel } from "@/components/RightPanel";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <Sidebar />
      </aside>
      <main className="feed">{children}</main>
      <aside className="right-sidebar">
        <RightPanel />
      </aside>
    </div>
  );
}
