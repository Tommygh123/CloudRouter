import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useAuth } from '../hooks/useAuth';
import { tenantService } from '../services/tenantService';

export const TenantContext = createContext(null);

const APP_CODE =
  import.meta.env.VITE_APP_CODE ||
  'cloudrouter';

const ACTIVE_TENANT_KEY =
  `${APP_CODE}:active-tenant-id`;

function getStoredTenantId() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(
    ACTIVE_TENANT_KEY,
  );
}

function storeTenantId(tenantId) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!tenantId) {
    window.localStorage.removeItem(
      ACTIVE_TENANT_KEY,
    );

    return;
  }

  window.localStorage.setItem(
    ACTIVE_TENANT_KEY,
    tenantId,
  );
}

export function TenantProvider({ children }) {
  const {
    user,
    loading: authLoading,
  } = useAuth();

  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  const [memberships, setMemberships] =
    useState([]);

  const [
    currentMembership,
    setCurrentMembership,
  ] = useState(null);

  const [subscription, setSubscription] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(null);

  // Tracks the auth user for whom workspace membership has
  // actually been resolved. This prevents a post-login render
  // from treating the previous empty tenant state as a genuine
  // 'no workspace' result before the membership request starts.
  const [resolvedUserId, setResolvedUserId] =
    useState(null);

  const resetTenantState =
    useCallback(
      ({
        clearStoredTenant = false,
      } = {}) => {
        requestIdRef.current += 1;

        if (!mountedRef.current) {
          return;
        }

        setMemberships([]);
        setCurrentMembership(null);
        setSubscription(null);
        setError(null);
        setResolvedUserId(null);
        setLoading(false);

        if (clearStoredTenant) {
          storeTenantId(null);
        }
      },
      [],
    );

  const loadSubscription =
    useCallback(
      async (
        tenantId,
        requestId = null,
      ) => {
        if (!tenantId) {
          if (mountedRef.current) {
            setSubscription(null);
          }

          return {
            data: null,
            error: null,
          };
        }

        try {
          const {
            data,
            error: subscriptionError,
          } =
            await tenantService.getSubscription(
              tenantId,
            );

          if (
            requestId !== null &&
            requestId !==
              requestIdRef.current
          ) {
            return {
              data: null,
              error: null,
              cancelled: true,
            };
          }

          if (!mountedRef.current) {
            return {
              data: null,
              error: null,
              cancelled: true,
            };
          }

          if (subscriptionError) {
            console.error(
              'Subscription loading failed:',
              subscriptionError,
            );

            setSubscription(null);

            return {
              data: null,
              error: subscriptionError,
            };
          }

          setSubscription(data ?? null);

          return {
            data: data ?? null,
            error: null,
          };
        } catch (subscriptionError) {
          if (
            requestId !== null &&
            requestId !==
              requestIdRef.current
          ) {
            return {
              data: null,
              error: null,
              cancelled: true,
            };
          }

          if (mountedRef.current) {
            console.error(
              'Subscription loading failed:',
              subscriptionError,
            );

            setSubscription(null);
          }

          return {
            data: null,
            error: subscriptionError,
          };
        }
      },
      [],
    );

  const refreshMemberships =
    useCallback(async () => {
      const requestId =
        requestIdRef.current + 1;

      requestIdRef.current = requestId;

      if (authLoading) {
        if (mountedRef.current) {
          setLoading(true);
        }

        return {
          data: [],
          error: null,
          pending: true,
        };
      }

      if (!user?.id) {
        resetTenantState({
          clearStoredTenant: false,
        });

        return {
          data: [],
          error: null,
        };
      }

      if (mountedRef.current) {
        setLoading(true);
        setError(null);
        setResolvedUserId(null);
      }

      try {
        const {
          data,
          error: membershipError,
        } =
          await tenantService.getMemberships(
            user.id,
          );

        if (
          requestId !==
          requestIdRef.current
        ) {
          return {
            data: [],
            error: null,
            cancelled: true,
          };
        }

        if (!mountedRef.current) {
          return {
            data: [],
            error: null,
            cancelled: true,
          };
        }

        if (membershipError) {
          throw membershipError;
        }

        const nextMemberships =
          Array.isArray(data)
            ? data
            : [];

        setMemberships(
          nextMemberships,
        );

        setResolvedUserId(user.id);

        if (
          nextMemberships.length === 0
        ) {
          setCurrentMembership(null);
          setSubscription(null);
          storeTenantId(null);

          return {
            data: [],
            error: null,
          };
        }

        const storedTenantId =
          getStoredTenantId();

        const selectedMembership =
          nextMemberships.find(
            (membership) =>
              membership.tenant_id ===
              storedTenantId,
          ) ?? nextMemberships[0];

        setCurrentMembership(
          selectedMembership,
        );

        storeTenantId(
          selectedMembership.tenant_id,
        );

        await loadSubscription(
          selectedMembership.tenant_id,
          requestId,
        );

        return {
          data: nextMemberships,
          error: null,
        };
      } catch (nextError) {
        if (
          requestId !==
          requestIdRef.current
        ) {
          return {
            data: [],
            error: null,
            cancelled: true,
          };
        }

        if (mountedRef.current) {
          console.error(
            'Workspace loading failed:',
            nextError,
          );

          setMemberships([]);
          setCurrentMembership(null);
          setSubscription(null);
          setError(nextError);
          setResolvedUserId(user?.id ?? null);
        }

        return {
          data: [],
          error: nextError,
        };
      } finally {
        if (
          mountedRef.current &&
          requestId ===
            requestIdRef.current
        ) {
          setLoading(false);
        }
      }
    }, [
      authLoading,
      user?.id,
      loadSubscription,
      resetTenantState,
    ]);

  useEffect(() => {
    mountedRef.current = true;

    if (authLoading) {
      setLoading(true);

      return undefined;
    }

    if (!user?.id) {
      resetTenantState({
        clearStoredTenant: false,
      });

      return undefined;
    }

    refreshMemberships();

    return undefined;
  }, [
    authLoading,
    user?.id,
    refreshMemberships,
    resetTenantState,
  ]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  const selectTenant =
    useCallback(
      async (tenantOrId) => {
        const selectedTenantId =
          typeof tenantOrId === 'string'
            ? tenantOrId
            : tenantOrId?.id ||
              tenantOrId?.tenant_id;

        if (!selectedTenantId) {
          const selectionError =
            new Error(
              'A valid tenant is required.',
            );

          setError(selectionError);

          return {
            success: false,
            error: selectionError,
          };
        }

        const selectedMembership =
          memberships.find(
            (membership) =>
              membership.tenant_id ===
              selectedTenantId,
          );

        if (!selectedMembership) {
          const selectionError =
            new Error(
              'You do not have access to this workspace.',
            );

          setError(selectionError);

          return {
            success: false,
            error: selectionError,
          };
        }

        const requestId =
          requestIdRef.current + 1;

        requestIdRef.current = requestId;

        setCurrentMembership(
          selectedMembership,
        );

        setSubscription(null);
        setError(null);
        setLoading(true);

        storeTenantId(
          selectedTenantId,
        );

        const subscriptionResult =
          await loadSubscription(
            selectedTenantId,
            requestId,
          );

        if (
          mountedRef.current &&
          requestId ===
            requestIdRef.current
        ) {
          setLoading(false);
        }

        return {
          success:
            !subscriptionResult.error,
          error:
            subscriptionResult.error ||
            null,
        };
      },
      [
        memberships,
        loadSubscription,
      ],
    );

  const clearWorkspace =
    useCallback(() => {
      resetTenantState({
        clearStoredTenant: true,
      });
    }, [resetTenantState]);

  const currentTenant =
    currentMembership?.tenants ??
    null;

  const currentRole =
    currentMembership?.roles ??
    null;

  const tenantId =
    currentMembership?.tenant_id ??
    null;

  const roleCode =
    currentRole?.code ??
    null;

  const hasWorkspace =
    Boolean(
      currentMembership &&
      currentTenant,
    );

  const value = useMemo(
    () => ({
      memberships,

      currentMembership,

      currentTenant,
      tenant: currentTenant,

      currentRole,
      role: currentRole,

      tenantId,
      roleCode,

      subscription,

      loading,
      tenantLoading: loading,

      error,
      tenantError: error,
      workspaceError: error,

      hasWorkspace,
      resolvedUserId,
      workspaceResolved:
        Boolean(user?.id && resolvedUserId === user.id),
      hasMembership:
        memberships.length > 0,

      selectTenant,
      setCurrentTenant:
        selectTenant,

      refresh:
        refreshMemberships,

      refreshMemberships,

      refreshTenant:
        refreshMemberships,

      clearWorkspace,
    }),
    [
      memberships,
      currentMembership,
      currentTenant,
      currentRole,
      tenantId,
      roleCode,
      subscription,
      loading,
      error,
      hasWorkspace,
      resolvedUserId,
      user?.id,
      selectTenant,
      refreshMemberships,
      clearWorkspace,
    ],
  );

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}
export default TenantContext;

