// admin/src/features/payments/PaymentsRoute.tsx
// Staff payment-review workspace routes (queue + detail), reusing the
// migrated OperatorWorkspace. Deep links like /payments/:requestId survive
// refresh (SPA fallback).
import { Route, Routes } from 'react-router';
import { OperatorWorkspace } from './components/OperatorWorkspace';

export function PaymentsRoute() {
  return (
    <Routes>
      <Route index element={<OperatorWorkspace />} />
      <Route path=":requestId" element={<OperatorWorkspace />} />
    </Routes>
  );
}
