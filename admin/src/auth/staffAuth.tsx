// admin/src/auth/staffAuth.tsx
// Staff Administrator authentication state and route guards.
//
// The single backstage identity: `staff_admins`. There are no roles,
// permissions or capability lists — a Staff account either exists and is
// active, or it is not. Authorization never relies on client routes,
// local storage, email text or a legacy `role` field; the server enforces
// the same rules via requireStaffAdmin (server/pb_hooks/guards.pb.js).
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getPocketBase, STAFF_COLLECTION } from './pocketbase';

export interface StaffAdmin {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  verified: boolean;
}

export interface StaffAuthState {
  user: StaffAdmin | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
}

export interface StaffAuthContextValue extends StaffAuthState {
  login: (email: string, password: string) => Promise<StaffAdmin>;
  logout: () => void;
}

const StaffAuthContext = createContext<StaffAuthContextValue | null>(null);

export function toStaffAdmin(record: unknown): StaffAdmin {
  const r = record as Record<string, unknown>;
  return {
    id: String(r.id ?? ''),
    email: String(r.email ?? ''),
    displayName: String(r.display_name ?? ''),
    isActive: r.is_active === true,
    verified: r.verified === true,
  };
}

export function StaffAuthProvider({ children }: { children: ReactNode }) {
  const pb = getPocketBase();
  const [state, setState] = useState<StaffAuthState>({
    user: null,
    isAuthenticated: false,
    isInitializing: true,
  });

  const sync = useCallback(() => {
    if (pb.authStore.isValid && pb.authStore.record) {
      setState({
        user: toStaffAdmin(pb.authStore.record),
        isAuthenticated: true,
        isInitializing: false,
      });
    } else {
      setState({ user: null, isAuthenticated: false, isInitializing: false });
    }
  }, [pb]);

  // Initial session restore: verify the stored token against the
  // `staff_admins` collection. Invalid or expired Staff sessions land on
  // the Admin Login (the guard redirects).
  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!pb.authStore.isValid) {
        if (!cancelled) setState((s) => ({ ...s, isInitializing: false }));
        return;
      }
      try {
        await pb.collection(STAFF_COLLECTION).authRefresh();
        if (cancelled) return;
        sync();
      } catch {
        pb.authStore.clear();
        if (!cancelled) setState({ user: null, isAuthenticated: false, isInitializing: false });
      }
    }
    void init();
    const unsub = pb.authStore.onChange(() => sync());
    return () => {
      cancelled = true;
      unsub();
    };
  }, [pb, sync]);

  const login = useCallback(
    async (email: string, password: string): Promise<StaffAdmin> => {
      const auth = await pb.collection(STAFF_COLLECTION).authWithPassword(email, password);
      const user = toStaffAdmin(auth.record);
      setState({ user, isAuthenticated: true, isInitializing: false });
      return user;
    },
    [pb],
  );

  const logout = useCallback(() => {
    // Clears ONLY the Staff AuthStore (its own localStorage key).
    pb.authStore.clear();
    setState({ user: null, isAuthenticated: false, isInitializing: false });
  }, [pb]);

  const value = useMemo<StaffAuthContextValue>(
    () => ({ ...state, login, logout }),
    [state, login, logout],
  );

  return <StaffAuthContext.Provider value={value}>{children}</StaffAuthContext.Provider>;
}

export function useStaffAuth(): StaffAuthContextValue {
  const ctx = useContext(StaffAuthContext);
  if (!ctx) {
    throw new Error('useStaffAuth must be used within a StaffAuthProvider');
  }
  return ctx;
}

// Route guard decisions. Pure function; safe to unit-test.
export type StaffRouteKind = 'guest-only' | 'staff-only' | 'public';

export type StaffGuardDecision = { kind: 'allow' } | { kind: 'redirect'; to: string };

export function decideStaffRoute(
  kind: StaffRouteKind,
  isAuthenticated: boolean,
): StaffGuardDecision {
  switch (kind) {
    case 'public':
      return { kind: 'allow' };
    case 'guest-only':
      return isAuthenticated ? { kind: 'redirect', to: '/' } : { kind: 'allow' };
    case 'staff-only':
      return isAuthenticated ? { kind: 'allow' } : { kind: 'redirect', to: '/login' };
  }
}
