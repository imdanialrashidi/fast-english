// app/src/app/routes/OperatorRoute.tsx
// Operator workspace: one route surface for the queue index and the
// selected request (`/operator` + `/operator/payment-requests/:id`). The
// shared shell keeps the workspace mounted across both paths so the queue
// pane preserves filter/scroll context during selection.

import { Route, Routes } from 'react-router';
import { OperatorWorkspace } from '../../features/operator';

export function OperatorRoute() {
  return (
    <Routes>
      <Route index element={<OperatorWorkspace />} />
      <Route path="payment-requests/:requestId" element={<OperatorWorkspace />} />
    </Routes>
  );
}
