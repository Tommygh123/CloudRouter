// src/components/layout/Topbar.jsx

import { useState } from 'react';
import {
  FiMenu,
  FiChevronDown,
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';

import {
  TenantLogo,
} from '../branding/TenantBrand';

export default function Topbar({
  onMenu,
}) {
  const [
    profileOpen,
    setProfileOpen,
  ] = useState(false);

  const [
    loggingOut,
    setLoggingOut,
  ] = useState(false);

  const navigate =
    useNavigate();

  const {
    user,
    signOut,
  } = useAuth();

  const {
    currentTenant,
    currentRole,
  } = useTenant();

  const tenantName =
    currentTenant?.business_name ||
    currentTenant?.name ||
    'Your hotspot business';

  const displayName =
    user?.user_metadata?.full_name ||
    user?.email ||
    'User';

  const roleName =
    currentRole?.name ||
    currentRole?.code ||
    'Account';

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      const result =
        await signOut();

      if (result?.error) {
        throw result.error;
      }

      setProfileOpen(false);

      navigate(
        '/login',
        {
          replace: true,
        },
      );
    } catch (error) {
      console.error(
        'Logout failed:',
        error,
      );

      setLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xl">

      <div className="flex min-h-[72px] items-center justify-between gap-3 px-3 py-3 sm:min-h-20 sm:px-6 lg:px-8">

        {/* ==================================================
            LEFT
        =================================================== */}

        <div className="flex min-w-0 items-center gap-3">

          {/* MOBILE HAMBURGER */}

          <button
            type="button"
            onClick={onMenu}
            aria-label="Open navigation menu"
            className="
              flex h-11 w-11
              shrink-0
              items-center justify-center
              rounded-xl
              border border-slate-200
              bg-white
              text-slate-700
              shadow-sm
              transition
              hover:bg-slate-50
              active:scale-95
              lg:hidden
            "
          >
            <FiMenu className="h-6 w-6" />
          </button>

          <TenantLogo
            tenant={currentTenant}
            size="sm"
            className="hidden sm:block"
          />

          <div className="min-w-0">

            <div className="flex items-center gap-2">

              <h1 className="max-w-[170px] truncate text-sm font-black text-slate-900 sm:max-w-none sm:text-xl">
                {tenantName}
              </h1>

              <span className="hidden rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 md:inline-flex">
                CloudRouter
              </span>

            </div>

            <p className="hidden truncate text-sm text-slate-500 sm:block">
              Hotspot business managed with CloudRouter
            </p>

          </div>

        </div>


        {/* ==================================================
            USER PROFILE
        =================================================== */}

        <div className="relative">

          <button
            type="button"
            onClick={() =>
              setProfileOpen(
                (current) => !current,
              )
            }
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-2 shadow-sm transition hover:bg-slate-50 sm:gap-3 sm:px-3"
            aria-expanded={
              profileOpen
            }
            aria-haspopup="menu"
          >

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700">

              {user?.email
                ?.charAt(0)
                ?.toUpperCase() ||
                'U'}

            </div>

            <div className="hidden max-w-44 text-left sm:block">

              <p className="truncate text-sm font-semibold text-slate-900">
                {displayName}
              </p>

              <p className="truncate text-xs capitalize text-slate-500">
                {roleName}
              </p>

            </div>

            <FiChevronDown className="hidden text-sm text-slate-500 sm:block" />

          </button>


          {profileOpen && (
            <>
              <button
                type="button"
                aria-label="Close profile menu"
                onClick={() =>
                  setProfileOpen(false)
                }
                className="fixed inset-0 z-40 cursor-default bg-transparent"
              />

              <div
                role="menu"
                className="absolute right-0 z-50 mt-2 w-[calc(100vw-2rem)] max-w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
              >

                <div className="border-b border-slate-100 bg-gradient-to-br from-blue-50 to-cyan-50 p-4">

                  <div className="flex items-center gap-3">

                    <TenantLogo
                      tenant={
                        currentTenant
                      }
                    />

                    <div className="min-w-0">

                      <p className="truncate text-sm font-bold text-slate-900">
                        {tenantName}
                      </p>

                      <p className="text-xs font-medium text-blue-700">
                        Powered by CloudRouter
                      </p>

                    </div>

                  </div>

                </div>


                <div className="border-b border-slate-100 px-4 py-3">

                  <p className="truncate text-sm font-semibold text-slate-900">
                    {displayName}
                  </p>

                  <p className="truncate text-xs text-slate-500">
                    {user?.email}
                  </p>

                  <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold capitalize text-slate-600">
                    {roleName}
                  </span>

                </div>


                <div className="p-2">

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(
                        false,
                      );

                      navigate(
                        '/dashboard/settings/profile',
                      );
                    }}
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100"
                  >
                    Business & branding
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(
                        false,
                      );

                      navigate(
                        '/dashboard/settings/account',
                      );
                    }}
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100"
                  >
                    Account settings
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(
                        false,
                      );

                      navigate(
                        '/dashboard/settings',
                      );
                    }}
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100"
                  >
                    System settings
                  </button>

                  <div className="my-2 border-t border-slate-200" />

                  <button
                    type="button"
                    role="menuitem"
                    onClick={
                      handleLogout
                    }
                    disabled={
                      loggingOut
                    }
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    {loggingOut
                      ? 'Signing out...'
                      : 'Sign out'}
                  </button>

                </div>

              </div>
            </>
          )}

        </div>

      </div>

    </header>
  );
}