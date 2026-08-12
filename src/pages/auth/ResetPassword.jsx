import { useState } from 'react';
import { toast } from 'react-hot-toast';

import AuthCard from '../../components/auth/AuthCard';
import FormField from '../../components/auth/FormField';
import PasswordInput from '../../components/auth/PasswordInput';
import { authService } from '../../services/authService';

export default function ResetPassword() {
  const [form, setForm] = useState({
    password: '',
    confirm: '',
  });

  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();

    if (form.password.length < 8) {
      toast.error('Use at least 8 characters.');
      return;
    }

    if (form.password !== form.confirm) {
      toast.error('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);

      const { error } =
        await authService.updatePassword(
          form.password,
        );

      if (error) {
        throw error;
      }

      toast.success(
        'Password updated. Opening your workspace...',
      );

      /*
       * Do not decide tenant membership here. Password recovery,
       * ordinary sign-in and invitation acceptance must all enter
       * through the same /dashboard gate. TenantContext then makes
       * the single authoritative workspace decision.
       */
      window.setTimeout(() => {
        window.location.replace('/dashboard');
      }, 350);
    } catch (error) {
      console.error(
        'Password reset failed:',
        error,
      );

      toast.error(
        error?.message ||
          'Password could not be updated.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Choose a new password"
      subtitle="Create a strong password for your CloudRouter account."
    >
      <form
        className="space-y-4"
        onSubmit={submit}
      >
        <FormField label="New password">
          <PasswordInput
            name="password"
            value={form.password}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
            autoComplete="new-password"
          />
        </FormField>

        <FormField label="Confirm password">
          <PasswordInput
            name="confirm"
            value={form.confirm}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                confirm: event.target.value,
              }))
            }
            autoComplete="new-password"
          />
        </FormField>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-indigo-600 px-4 py-3.5 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? 'Updating...'
            : 'Update password'}
        </button>
      </form>
    </AuthCard>
  );
}
