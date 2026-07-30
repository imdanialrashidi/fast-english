// app/src/app/routes/OperatorRoute.tsx
// P1-S2 — Operator route: dispatches between queue and detail views.

import { Route, Routes } from 'react-router';
import { OperatorDetailRoute, OperatorQueueRoute } from '../../features/operator';

export function OperatorRoute() {
  return (
    <Routes>
      <Route index element={<OperatorQueueRoute />} />
      <Route path="payment-requests/:requestId" element={<OperatorDetailRoute />} />
    </Routes>
  );
}
