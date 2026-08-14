// app/src/lib/auth.tsx
// AuthProvider, auth state, and route-guard decisions.
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { mapAuthError } from './authErrors';
import { normalizeIranianPhone, phoneToInternalEmail } from './phone';
import { getPocketBase } from './pocketbase';
import { FUNNEL_EVENTS, trackFunnel } from './telemetry';

export const COLLECTION = 'fep_users';

export type AccountStatus =
  | 'pending_payment'
  | 'payment_rejected'
  | 'active'
  | 'expired'
  | 'suspended';

export interface FepUser {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: 'student' | 'operator' | 'content_manager';
  account_status: AccountStatus;
  placement_completed: boolean;
  selected_level?: string | null;
  suggested_level?: string | null;
  expanded?: Record<string, unknown>;
}

export interface SignupInput {
  name: string;
  phone: string;
  email?: string;
  password: string;
  passwordConfirm: string;
}

export interface LoginInput {
  phone: string;
  password: string;
}

export interface AuthState {
  user: FepUser | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
}

export interface AuthContextValue extends AuthState {
  signup: (input: SignupInput) => Promise<FepUser>;
  login: (input: LoginInput) => Promise<FepUser>;
  logout: () => void;
  refresh: () => Promise<FepUser | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function requireAuthRecord(record: unknown, expectedId?: string): Record<string, unknown> {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw { status: 502, code: 'unavailable' };
  }
  const r = record as Record<string, unknown>;
  if (expectedId) {
    // Signup must never fall back to its create response: the authenticated
    // response is the authoritative record and must be the record just created.
    if (String(r.id ?? '') !== expectedId) {
      throw { status: 502, code: 'unavailable' };
    }
  } else if (typeof r.id !== 'string' || r.id.length === 0) {
    // Every server auth response carries the record id; without it the
    // profile cannot be authoritative.
    throw { status: 502, code: 'unavailable' };
  }
  return r;
}

// An auth-level rejection (invalid/expired/suspended) means the session is
// no longer usable and the persisted token must be cleared. Transport and
// server-side errors (network blip, PocketBase restarting, 429) must NOT
// destroy a still-valid session — the next load will retry the refresh.
function isAuthRejection(err: unknown): boolean {
  const e = err as { status?: number; response?: { status?: number } };
  const status = e.response?.status ?? e.status ?? 0;
  return status === 400 || status === 401 || status === 403;
}

export function toFepUser(record: unknown): FepUser {
  const r = requireAuthRecord(record);
  return {
    id: String(r.id ?? ''),
    email: String(r.email ?? ''),
    name: String(r.name ?? ''),
    phone: String(r.phone ?? ''),
    role: (r.role as FepUser['role']) ?? 'student',
    account_status: (r.account_status as AccountStatus) ?? 'pending_payment',
    placement_completed: Boolean(r.placement_completed),
    selected_level: (r.selected_level as string | null) ?? null,
    suggested_level: (r.suggested_level as string | null) ?? null,
    expanded: r as Record<string, unknown>,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const pb = getPocketBase();
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isInitializing: true,
  });

  const sync = useCallback(() => {
    try {
      if (pb.authStore.isValid && pb.authStore.record) {
        setState({
          user: toFepUser(pb.authStore.record),
          isAuthenticated: true,
          isInitializing: false,
        });
      } else {
        setState({ user: null, isAuthenticated: false, isInitializing: false });
      }
    } catch {
      // A malformed serialized record must fail closed, never render.
      pb.authStore.clear();
      setState({ user: null, isAuthenticated: false, isInitializing: false });
    }
  }, [pb]);

  // Initial session restore.
  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!pb.authStore.isValid) {
        if (!cancelled) setState((s) => ({ ...s, isInitializing: false }));
        return;
      }
      try {
        // Verify the token and hydrate from the fresh server response. Do
        // not render the record that was serialized in localStorage before
        // refresh; it can be stale or incomplete after an older deployment.
        const auth = await pb.collection(COLLECTION).authRefresh();
        if (cancelled) return;
        const record = requireAuthRecord(auth.record);
        setState({ user: toFepUser(record), isAuthenticated: true, isInitializing: false });
      } catch (err) {
        // Only auth-level rejections invalidate the persisted session;
        // transient transport/5xx errors keep the store so a reload during a
        // PocketBase restart recovers instead of logging the user out.
        if (isAuthRejection(err)) pb.authStore.clear();
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

  const signup = useCallback(
    async (input: SignupInput): Promise<FepUser> => {
      const phone = normalizeIranianPhone(input.phone);
      if (!phone) throw mapAuthError({ status: 400, message: 'invalid_phone' });
      try {
        const record = await pb.collection(COLLECTION).create({
          name: input.name,
          phone,
          email: input.email || phoneToInternalEmail(phone),
          password: input.password,
          passwordConfirm: input.passwordConfirm,
        });
        // Auto-authenticate after signup. Use the canonical phone as the
        // identity so the lookup matches the stored record regardless of
        // whether the user provided an email at signup. `phone` is a
        // password identity field on the `fep_users` collection.
        const auth = await pb.collection(COLLECTION).authWithPassword(phone, input.password);
        const serverRecord = requireAuthRecord(auth.record, String(record.id));
        const user = toFepUser(serverRecord);
        setState({ user, isAuthenticated: true, isInitializing: false });
        // Funnel telemetry: signup completed (no personal data — never
        // phone/name/email).
        trackFunnel(FUNNEL_EVENTS.signupCompleted);
        return user;
      } catch (err) {
        throw mapAuthError(err);
      }
    },
    [pb],
  );

  const login = useCallback(
    async (input: LoginInput): Promise<FepUser> => {
      const phone = normalizeIranianPhone(input.phone);
      if (!phone) throw mapAuthError({ status: 400, message: 'invalid_phone' });
      try {
        // Authenticate with the canonical phone directly. `phone` is a
        // password identity field on the `fep_users` collection, so the
        // lookup works regardless of whether the user provided an email
        // at signup or not.
        const auth = await pb.collection(COLLECTION).authWithPassword(phone, input.password);
        const serverRecord = requireAuthRecord(auth.record);
        const user = toFepUser(serverRecord);
        setState({ user, isAuthenticated: true, isInitializing: false });
        return user;
      } catch (err) {
        throw mapAuthError(err);
      }
    },
    [pb],
  );

  const logout = useCallback(() => {
    pb.authStore.clear();
    setState({ user: null, isAuthenticated: false, isInitializing: false });
  }, [pb]);

  const refresh = useCallback(async () => {
    if (!pb.authStore.isValid) return null;
    try {
      const auth = await pb.collection(COLLECTION).authRefresh();
      const serverRecord = requireAuthRecord(auth.record);
      const user = toFepUser(serverRecord);
      setState({ user, isAuthenticated: true, isInitializing: false });
      return user;
    } catch (err) {
      if (isAuthRejection(err)) pb.authStore.clear();
      setState({ user: null, isAuthenticated: false, isInitializing: false });
      return null;
    }
  }, [pb]);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signup, login, logout, refresh }),
    [state, signup, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

// Route guard decisions. Pure functions; safe to unit-test.
export type RouteKind = 'guest-only' | 'pending-only' | 'active-only' | 'public';

export type GuardDecision = { kind: 'allow' } | { kind: 'redirect'; to: string } | { kind: 'deny' };

export function decideRoute(
  kind: RouteKind,
  user: FepUser | null,
  isAuthenticated: boolean,
): GuardDecision {
  switch (kind) {
    case 'public':
      return { kind: 'allow' };
    case 'guest-only':
      if (isAuthenticated) {
        // Route active users based on placement completion state
        if (user?.account_status === 'active') {
          if (user?.placement_completed && user?.selected_level) {
            return { kind: 'redirect', to: '/' };
          }
          // Placement not completed — might be no attempt, in progress, or submitted without selection
          return { kind: 'redirect', to: '/placement' };
        }
        return { kind: 'redirect', to: '/payment' };
      }
      return { kind: 'allow' };
    case 'pending-only':
      if (!isAuthenticated) return { kind: 'redirect', to: '/login' };
      if (
        user?.account_status === 'pending_payment' ||
        user?.account_status === 'payment_rejected' ||
        user?.account_status === 'expired'
      ) {
        return { kind: 'allow' };
      }
      return {
        kind: 'redirect',
        to: user?.account_status === 'active' ? '/' : '/login',
      };
    case 'active-only':
      if (!isAuthenticated) return { kind: 'redirect', to: '/login' };
      if (user?.account_status === 'active') {
        // Allow access — the page itself will handle placement state
        return { kind: 'allow' };
      }
      return {
        kind: 'redirect',
        to:
          user?.account_status === 'suspended' || user?.account_status === 'expired'
            ? '/payment'
            : '/payment',
      };
  }
}
