/**
 * Auth module tests — auth store, login/register hooks, token handling.
 *
 * Run only this module:
 *   npx jest auth.test
 */

import "./setup";
import { useAuthStore } from "../store/authStore";

describe("Auth Store", () => {
  beforeEach(() => {
    // Reset store state between tests
    useAuthStore.setState({
      token: null,
      userId: null,
      role: null,
      isApproved: null,
      _hydrated: true,
    });
  });

  it("starts with null token", () => {
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.userId).toBeNull();
  });

  it("setAuth stores token, userId, role, and isApproved", () => {
    useAuthStore.getState().setAuth("jwt-token-123", "user-abc", "admin", true);
    const state = useAuthStore.getState();
    expect(state.token).toBe("jwt-token-123");
    expect(state.userId).toBe("user-abc");
    expect(state.role).toBe("admin");
    expect(state.isApproved).toBe(true);
  });

  it("setAuth defaults role and isApproved to null when omitted", () => {
    useAuthStore.getState().setAuth("token", "user-id");
    const state = useAuthStore.getState();
    expect(state.role).toBeNull();
    expect(state.isApproved).toBeNull();
  });

  it("clearAuth resets all fields to null", () => {
    useAuthStore.getState().setAuth("token", "user-id", "member", true);
    useAuthStore.getState().clearAuth();
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.userId).toBeNull();
    expect(state.role).toBeNull();
    expect(state.isApproved).toBeNull();
  });

  it("isApproved=false for pending users", () => {
    useAuthStore.getState().setAuth("token", "user-id", "member", false);
    expect(useAuthStore.getState().isApproved).toBe(false);
  });
});
