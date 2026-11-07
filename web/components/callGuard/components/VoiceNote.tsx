import { AlertCircle } from "lucide-react";

import { Typography } from "@ui/components/ui/typography";

import { useGetScenarios } from "../hooks/useGetScenarios";

/** Warns before a live call when the service has no speech keys; the start error says the same. */
export default function VoiceNote() {
  const { data } = useGetScenarios();
  if (!data || data.voiceAvailable) return null;
  return (
    <div className="note-box flex gap-3 border-amber-300 bg-amber-50 p-4 text-amber-950">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
      <Typography size="paragraph3" tone="inherit">Voice isn&apos;t set up on the service yet, so live calls won&apos;t connect. Add GNANI_API_KEY to services/narada/.env and restart it.</Typography>
    </div>
  );
}
