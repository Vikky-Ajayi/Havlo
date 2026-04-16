import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, type UserProfile, type AuthResponse } from '../lib/api';

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  login: (resp: AuthResponse) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'havlo_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    token: localStorage.getItem(TOKEN_KEY),
    user: null,
    loading: !!localStorage.getItem(TOKEN_KEY),
  });

  const bootstrapped = useRef(false);

  const fetchUser = useCallback(async (tok: string): Promise<UserProfile> => {
    const user = await api.getMe(tok);
    setState({ token: tok, user, loading: false });
    return user;
  }, []);

  useEffect(() => {
    if (state.token && !state.user && state.loading && !bootstrapped.current) {
      bootstrapped.current = true;
      fetchUser(state.token).catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setState({ token: null, user: null, loading: false });
      });
    }
  }, [state.token, state.user, state.loading, fetchUser]);

  const login = useCallback(async (resp: AuthResponse) => {
    localStorage.setItem(TOKEN_KEY, resp.access_token);
    bootstrapped.current = true;
    try {
      await fetchUser(resp.access_token);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setState({ token: null, user: null, loading: false });
      throw new Error('Failed to load user profile. Please try again.');
    }
  }, [fetchUser]);

  const logout = useCallback(() => {
    if (state.token) {
      api.logout(state.token).catch(() => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    bootstrapped.current = false;
    setState({ token: null, user: null, loading: false });
  }, [state.token]);

  const refreshUser = useCallback(async () => {
    if (state.token) await fetchUser(state.token);
  }, [state.token, fetchUser]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
