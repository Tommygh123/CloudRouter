
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

function Topbar({ onMenu }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      const result = await signOut();

      if (result?.error) {
        throw result.error;
      }

      setProfileOpen(false);

      navigate('/login', {
        replace: true,
      });
    } catch (error) {
      console.error('Logout failed:', error);
      setLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
      <div className="flex h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenu}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-xl text-slate-700 shadow-sm hover:bg-slate-50 lg:hidden"
            aria-label="Open sidebar"
          >
            ☰
          </button>

          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">
              CloudRouter Dashboard
            </h1>

            <p className="hidden truncate text-sm text-slate-500 sm:block">
              Manage your business operations
            </p>
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setProfileOpen((current) => !current);
            }}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm hover:bg-slate-50"
            aria-expanded={profileOpen}
            aria-haspopup="menu"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700">
              {user?.email?.charAt(0)?.toUpperCase() || 'U'}
            </div>

            <div className="hidden max-w-44 text-left sm:block">
              <p className="truncate text-sm font-semibold text-slate-900">
                {user?.user_metadata?.full_name ||
                  user?.email ||
                  'User'}
              </p>

              <p className="truncate text-xs text-slate-500">
                Account
              </p>
            </div>

            <span className="text-xs text-slate-500">
              ▼
            </span>
          </button>

          {profileOpen && (
            <>
              <button
                type="button"
                aria-label="Close profile menu"
                onClick={() => {
                  setProfileOpen(false);
                }}
                className="fixed inset-0 z-40 cursor-default bg-transparent"
              />

              <div
                role="menu"
                className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileOpen(false);
                    navigate('/dashboard/settings/profile');
                  }}
                  className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100"
                >
                  Profile settings
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileOpen(false);
                    navigate('/dashboard/settings');
                  }}
                  className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100"
                >
                  System settings
                </button>

                <div className="my-2 border-t border-slate-200" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loggingOut ? 'Signing out...' : 'Sign out'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default Topbar;
