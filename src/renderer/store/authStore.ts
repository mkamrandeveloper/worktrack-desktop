import { create } from 'zustand';
import { AuthState, User, Organization, UserRole, SignupCreateOrgPayload, SignupJoinOrgPayload, ClientAcceptPayload } from '@shared/types';

interface AuthStore extends AuthState {
  setAuthState: (state: AuthState) => void;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signupCreateOrg: (payload: SignupCreateOrgPayload) => Promise<{ ok: boolean; error?: string }>;
  signupJoinOrg: (payload: SignupJoinOrgPayload) => Promise<{ ok: boolean; error?: string }>;
  acceptClientInvite: (payload: ClientAcceptPayload) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  // Role helpers
  isOwner: () => boolean;
  isAdmin: () => boolean;
  isManager: () => boolean;
  isManagerOrAbove: () => boolean;
  isAdminOrAbove: () => boolean;
  isEmployee: () => boolean;
  isClient: () => boolean;
  hasRole: (role: UserRole) => boolean;
  getRoleBadge: () => { label: string; color: string };
}

const MANAGER_ABOVE: UserRole[] = ['OWNER', 'ADMIN', 'MANAGER'];
const ADMIN_ABOVE: UserRole[] = ['OWNER', 'ADMIN'];

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  organization: null,
  tokens: null,
  isAuthenticated: false,

  setAuthState: (state: AuthState) => set(state),

  isOwner: () => get().user?.role === 'OWNER',
  isAdmin: () => get().user?.role === 'ADMIN',
  isManager: () => MANAGER_ABOVE.includes(get().user?.role as UserRole),
  isManagerOrAbove: () => MANAGER_ABOVE.includes(get().user?.role as UserRole),
  isAdminOrAbove: () => ADMIN_ABOVE.includes(get().user?.role as UserRole),
  isEmployee: () => get().user?.role === 'EMPLOYEE',
  isClient: () => get().user?.role === 'CLIENT',
  hasRole: (role: UserRole) => get().user?.role === role,

  getRoleBadge: () => {
    const role = get().user?.role;
    switch (role) {
      case 'OWNER':   return { label: 'Owner', color: 'text-amber-400 bg-amber-400/10 border-amber-400/30' };
      case 'ADMIN':   return { label: 'Admin', color: 'text-rose-400 bg-rose-400/10 border-rose-400/30' };
      case 'MANAGER': return { label: 'Manager', color: 'text-primary bg-primary/10 border-primary/30' };
      case 'CLIENT':  return { label: 'Client', color: 'text-teal-400 bg-teal-400/10 border-teal-400/30' };
      default:        return { label: 'Employee', color: 'text-muted-foreground bg-muted border-border' };
    }
  },

  login: async (email: string, password: string) => {
    const result = await window.worktrack.auth.login({ email, password });
    if (result.success && result.data) {
      set({
        user: result.data.user as User,
        organization: result.data.organization as Organization,
        tokens: result.data.tokens,
        isAuthenticated: true,
      });
      return { ok: true };
    }
    return { ok: false, error: result.error ?? 'Login failed.' };
  },

  signupCreateOrg: async (payload: SignupCreateOrgPayload) => {
    const result = await window.worktrack.auth.signupCreateOrg(payload);
    if (result.success && result.data) {
      set({
        user: result.data.user as User,
        organization: result.data.organization as Organization,
        tokens: result.data.tokens,
        isAuthenticated: true,
      });
      return { ok: true };
    }
    return { ok: false, error: result.error ?? 'Signup failed.' };
  },

  signupJoinOrg: async (payload: SignupJoinOrgPayload) => {
    const result = await window.worktrack.auth.signupJoinOrg(payload);
    if (result.success) {
      return { ok: true };
    }
    return { ok: false, error: result.error ?? 'Join request failed.' };
  },

  acceptClientInvite: async (payload: ClientAcceptPayload) => {
    const result = await window.worktrack.clients.accept(payload);
    if (result.success && result.data) {
      set({
        user: result.data.user as User,
        organization: result.data.organization as Organization,
        tokens: result.data.tokens,
        isAuthenticated: true,
      });
      return { ok: true };
    }
    return { ok: false, error: result.error ?? 'Could not accept invitation.' };
  },

  logout: async () => {
    await window.worktrack.auth.logout();
    set({ user: null, organization: null, tokens: null, isAuthenticated: false });
  },
}));
