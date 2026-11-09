import AppShell from "@/components/layout/AppShell";

/** Every app route (Call Guard, Agent Lab) sits in the sidebar shell; the landing page at `/` does not. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
