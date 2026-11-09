import { Suspense } from "react";

import ErrandsView from "@/components/callGuard/components/ErrandsView";

export default function CallGuardErrandsPage() {
  // ErrandsView reads ?errand= with useSearchParams, which needs a Suspense boundary.
  return (
    <Suspense>
      <ErrandsView />
    </Suspense>
  );
}
