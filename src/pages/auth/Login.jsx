import { useState } from 'react';

import { Link } from 'react-router-dom';

import { FiMail } from 'react-icons/fi';
import { toast } from 'react-hot-toast';

import AuthCard from '../../components/auth/AuthCard';
import FormField from '../../components/auth/FormField';
import PasswordInput from '../../components/auth/PasswordInput';

import { authService } from '../../services/authService';

export default function Login() {
  const [form, setForm] = useState({
    email: '',
    password: '',
  });

  const [submitting, setSubmitting] =
    useState(false);


  async function submit(event) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const email =
      String(form.email || '')
        .trim()
        .toLowerCase();

    const password =
      String(form.password || '');

    if (!email) {
      toast.error(
        'Enter your email address.',
      );
      return;
    }

    if (!password) {
      toast.error(
        'Enter your password.',
      );
      return;
    }

    try {
      setSubmitting(true);

      // ======================================================
      // 1. AUTHENTICATE ONLY
      // ======================================================

      const {
        data,
        error,
      } =
        await authService.login({
          email,
          password,
        });

      if (error) {
        throw error;
      }

      // ======================================================
      // 2. DO NOT CHECK TENANT MEMBERSHIP HERE
      // ======================================================
      //
      // Login and TenantContext can update at slightly
      // different times.
      //
      // Previously Login.jsx did this:
      //
      //   login
      //      ↓
      //   getMemberships()
      //      ↓
      //   temporary []
      //      ↓
      //   /onboarding/business   ❌
      //
      // The user already has the correct tenant_users row.
      //
      // TenantContext + OnboardingGate are responsible for
      // resolving the tenant after authentication.
      // ======================================================

      toast.success(
        'Signed in successfully.',
      );

      /*
       * Use a clean application load after authentication.
       * This guarantees AuthContext and TenantContext start from
       * the newly persisted Supabase session instead of racing an
       * in-memory session from the previous user.
       */
      window.location.replace('/dashboard');

      return data;
    } catch (error) {
      console.error(
        'Login failed:',
        error,
      );

      toast.error(
        error?.message ||
          'Unable to sign in.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to continue to your CloudRouter workspace."
      footer={
        <>
          New to CloudRouter?{' '}

          <Link
            className="font-semibold text-indigo-600 transition hover:text-indigo-700"
            to="/register"
          >
            Start free trial
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={submit}
      >
        <FormField label="Email address">
          <div className="relative">
            <FiMail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

            <input
              className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm(
                  (current) => ({
                    ...current,

                    email:
                      event.target.value,
                  }),
                )
              }
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
          </div>
        </FormField>

        <FormField label="Password">
          <PasswordInput
            value={form.password}
            onChange={(event) =>
              setForm(
                (current) => ({
                  ...current,

                  password:
                    event.target.value,
                }),
              )
            }
            autoComplete="current-password"
          />
        </FormField>

        <div className="text-right">
          <Link
            className="text-sm font-medium text-indigo-600 transition hover:text-indigo-700"
            to="/forgot-password"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-indigo-600 px-4 py-3.5 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting
            ? 'Signing in…'
            : 'Sign in'}
        </button>
      </form>
    </AuthCard>
  );
}