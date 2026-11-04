import { Suspense } from "react";

import FocusedTestingPage from "@/components/agentTesting/components/FocusedTestingPage";

export default function ManualCallPage() {
  // FocusedTestingPage reads ?agent= with useSearchParams, which needs a Suspense boundary.
  return (
    <Suspense>
      <FocusedTestingPage view="manual" />
    </Suspense>
  );
}
