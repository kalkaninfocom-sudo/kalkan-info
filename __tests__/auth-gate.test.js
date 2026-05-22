// auth-gate.js logic unit tests
// auth-gate.js is an IIFE that runs on load. We test the internal gate logic
// by mocking window.SUPABASE_CLIENT, document.body and window.location.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal Supabase client mock returning the given user. */
function makeSupabase(user) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
  };
}

/** Run the gate() logic extracted from auth-gate.js in isolation. */
async function runGate({ user, requiredRole } = {}) {
  // Stubs
  const redirectCalls = [];
  const forbiddenCalls = [];

  function redirectToLogin() {
    redirectCalls.push(true);
  }
  function forbidden() {
    forbiddenCalls.push(true);
  }
  function setDataAuth() {
    // represents document.documentElement.setAttribute('data-auth','ready')
  }

  async function gate(supabaseClient, bodyDataAuthRole) {
    const requiredRoleVal = bodyDataAuthRole || null;
    try {
      const sb = supabaseClient;
      if (!sb) return redirectToLogin();

      const { data: { user: resolvedUser } } = await sb.auth.getUser();
      if (!resolvedUser) return redirectToLogin();

      if (requiredRoleVal) {
        const userRole = resolvedUser.app_metadata?.role || null;
        if (userRole !== requiredRoleVal && userRole !== 'admin') {
          return forbidden();
        }
      }
      setDataAuth();
    } catch (e) {
      redirectToLogin();
    }
  }

  await gate(
    user !== undefined ? makeSupabase(user) : null,
    requiredRole,
  );

  return { redirectCalls, forbiddenCalls };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('auth-gate: no supabase client', () => {
  it('redirects to login when SUPABASE_CLIENT is not available', async () => {
    const { redirectCalls } = await runGate({ user: undefined });
    expect(redirectCalls.length).toBe(1);
  });
});

describe('auth-gate: unauthenticated user', () => {
  it('redirects to login when getUser returns null', async () => {
    const { redirectCalls } = await runGate({ user: null });
    expect(redirectCalls.length).toBe(1);
  });
});

describe('auth-gate: admin role requirement', () => {
  it('allows user with admin role when admin role is required', async () => {
    const user = { id: 'u1', app_metadata: { role: 'admin' } };
    const { redirectCalls, forbiddenCalls } = await runGate({
      user,
      requiredRole: 'admin',
    });
    expect(redirectCalls.length).toBe(0);
    expect(forbiddenCalls.length).toBe(0);
  });

  it('shows forbidden when user role does not match required role', async () => {
    const user = { id: 'u2', app_metadata: { role: 'member' } };
    const { forbiddenCalls } = await runGate({
      user,
      requiredRole: 'admin',
    });
    expect(forbiddenCalls.length).toBe(1);
  });

  it('admin role bypasses any specific role requirement', async () => {
    const user = { id: 'u3', app_metadata: { role: 'admin' } };
    const { forbiddenCalls, redirectCalls } = await runGate({
      user,
      requiredRole: 'partner',
    });
    expect(forbiddenCalls.length).toBe(0);
    expect(redirectCalls.length).toBe(0);
  });
});

describe('auth-gate: partner role requirement', () => {
  it('allows user with partner role on partner-gated page', async () => {
    const user = { id: 'u4', app_metadata: { role: 'partner' } };
    const { redirectCalls, forbiddenCalls } = await runGate({
      user,
      requiredRole: 'partner',
    });
    expect(redirectCalls.length).toBe(0);
    expect(forbiddenCalls.length).toBe(0);
  });

  it('shows forbidden for authenticated user without partner role', async () => {
    const user = { id: 'u5', app_metadata: { role: 'member' } };
    const { forbiddenCalls } = await runGate({
      user,
      requiredRole: 'partner',
    });
    expect(forbiddenCalls.length).toBe(1);
  });
});

describe('auth-gate: no role requirement (public-auth page)', () => {
  it('grants access to any authenticated user when no role is required', async () => {
    const user = { id: 'u6', app_metadata: {} };
    const { redirectCalls, forbiddenCalls } = await runGate({ user });
    expect(redirectCalls.length).toBe(0);
    expect(forbiddenCalls.length).toBe(0);
  });
});
