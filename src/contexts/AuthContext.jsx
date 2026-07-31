
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { supabase } from '../lib/supabase';

export const AuthContext = createContext(null);

function isInvalidSessionError(error) {
  const message = String(
    error?.message || '',
  ).toLowerCase();

  return (
    message.includes(
      'user from sub claim in jwt does not exist',
    ) ||
    message.includes('invalid jwt') ||
    message.includes('jwt expired') ||
    message.includes('user not found') ||
    error?.status === 401 ||
    error?.status === 403 ||
    error?.code === 'user_not_found'
  );
}

function removeSupabaseAuthStorage() {
  if (typeof window === 'undefined') {
    return;
  }

  const clearStorage = (storage) => {
    const keysToRemove = [];

    for (
      let index = 0;
      index < storage.length;
      index += 1
    ) {
      const key = storage.key(index);

      if (
        key &&
        key.startsWith('sb-') &&
        key.includes('auth-token')
      ) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => {
      storage.removeItem(key);
    });
  };

  clearStorage(window.localStorage);
  clearStorage(window.sessionStorage);
}

export function AuthProvider({ children }) {
  const mountedRef = useRef(true);

  const [session, setSession] =
    useState(null);

  const [user, setUser] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [authError, setAuthError] =
    useState(null);

  const resetAuthState = useCallback(() => {
    if (!mountedRef.current) {
      return;
    }

    setSession(null);
    setUser(null);
    setAuthError(null);
  }, []);

  const clearLocalSession =
    useCallback(async () => {
      try {
        await supabase.auth.signOut({
          scope: 'local',
        });
      } catch (error) {
        console.warn(
          'Local Supabase sign-out failed:',
          error,
        );
      }

      removeSupabaseAuthStorage();
      resetAuthState();
    }, [resetAuthState]);

  const loadSession =
    useCallback(async () => {
      if (!mountedRef.current) {
        return {
          session: null,
          user: null,
          error: null,
        };
      }

      setLoading(true);
      setAuthError(null);

      try {
        const {
          data,
          error,
        } =
          await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        const nextSession =
          data?.session ?? null;

        if (!mountedRef.current) {
          return {
            session: null,
            user: null,
            error: null,
          };
        }

        if (
          !nextSession ||
          !nextSession.access_token ||
          !nextSession.user
        ) {
          setSession(null);
          setUser(null);

          return {
            session: null,
            user: null,
            error: null,
          };
        }

        setSession(nextSession);
        setUser(nextSession.user);

        return {
          session: nextSession,
          user: nextSession.user,
          error: null,
        };
      } catch (error) {
        console.error(
          'Authentication session check failed:',
          error,
        );

        if (isInvalidSessionError(error)) {
          await clearLocalSession();

          return {
            session: null,
            user: null,
            error: null,
          };
        }

        if (mountedRef.current) {
          setSession(null);
          setUser(null);
          setAuthError(error);
        }

        return {
          session: null,
          user: null,
          error,
        };
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }, [clearLocalSession]);

  useEffect(() => {
    mountedRef.current = true;

    loadSession();

    const {
      data: listenerData,
    } =
      supabase.auth.onAuthStateChange(
        (event, nextSession) => {
          if (!mountedRef.current) {
            return;
          }

          if (
            event === 'SIGNED_OUT' ||
            !nextSession ||
            !nextSession.user
          ) {
            setSession(null);
            setUser(null);
            setAuthError(null);
            setLoading(false);
            return;
          }

          setSession(nextSession);
          setUser(nextSession.user);
          setAuthError(null);
          setLoading(false);
        },
      );

    return () => {
      mountedRef.current = false;

      listenerData?.subscription?.unsubscribe();
    };
  }, [loadSession]);

  const logout =
    useCallback(async () => {
      setAuthError(null);

      try {
        const { error } =
          await supabase.auth.signOut({
            scope: 'local',
          });

        if (
          error &&
          !isInvalidSessionError(error)
        ) {
          throw error;
        }

        removeSupabaseAuthStorage();
        resetAuthState();

        return {
          success: true,
          error: null,
        };
      } catch (error) {
        console.error(
          'Logout failed:',
          error,
        );

        removeSupabaseAuthStorage();
        resetAuthState();

        if (mountedRef.current) {
          setAuthError(error);
        }

        return {
          success: false,
          error,
        };
      }
    }, [resetAuthState]);

  const refreshSession =
    useCallback(async () => {
      return loadSession();
    }, [loadSession]);

  const value = useMemo(
    () => ({
      session,
      user,

      loading,
      authLoading: loading,

      authError,

      isAuthenticated:
        Boolean(session && user),

      logout,
      signOut: logout,

      refreshSession,
      clearLocalSession,
    }),
    [
      session,
      user,
      loading,
      authError,
      logout,
      refreshSession,
      clearLocalSession,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;

