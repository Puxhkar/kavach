import { Suspense } from "react";

import DrillView from "@/components/callGuard/components/DrillView";

export default function CallGuardDrillPage() {
  // DrillView reads ?drill= with useSearchParams, which needs a Suspense boundary.
  return (
    <Suspense>
      <DrillView />
    </Suspense>
  );
}
