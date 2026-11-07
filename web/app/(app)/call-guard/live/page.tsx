import { Suspense } from "react";

import AnswerCallView from "@/components/callGuard/components/AnswerCallView";

export default function CallGuardLivePage() {
  // AnswerCallView reads ?call= with useSearchParams, which needs a Suspense boundary.
  return (
    <Suspense>
      <AnswerCallView />
    </Suspense>
  );
}
