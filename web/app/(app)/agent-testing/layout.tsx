import AgentLabTabs from "@/components/agentTesting/components/AgentLabTabs";

export default function AgentLabLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AgentLabTabs />
      {children}
    </>
  );
}
