import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiMail } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import AuthCard from '../../components/auth/AuthCard';
import FormField from '../../components/auth/FormField';
import PasswordInput from '../../components/auth/PasswordInput';
import { authService } from '../../services/authService';
import { tenantService } from '../../services/tenantService';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);

    const { error } = await authService.login(form);

    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }

    const { data, error: membershipError } =
      await tenantService.getMemberships();

    setSubmitting(false);

    if (membershipError) {
      toast.error(`Login succeeded, but workspace lookup failed: ${membershipError.message}`);
      navigate('/onboarding/business', { replace: true });
      return;
    }

    const requestedPath = location.state?.from?.pathname;
    const destination = data?.length
      ? requestedPath || '/dashboard'
      : '/onboarding/business';

    navigate(destination, { replace: true });
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to continue to your business workspace."
      footer={
        <>
          New to CloudRouter?{' '}
          <Link className="font-semibold text-indigo-600" to="/register">
            Start free trial
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={submit}>
        <FormField label="Email address">
          <div className="relative">
            <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
              autoComplete="email"
              required
            />
          </div>
        </FormField>

        <FormField label="Password">
          <PasswordInput
            value={form.password}
            onChange={(event) =>
              setForm({ ...form, password: event.target.value })
            }
            autoComplete="current-password"
          />
        </FormField>

        <div className="text-right">
          <Link
            className="text-sm font-medium text-indigo-600"
            to="/forgot-password"
          >
            Forgot password?
          </Link>
        </div>

        <button
          disabled={submitting}
          className="w-full rounded-xl bg-indigo-600 px-4 py-3.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthCard>
  );
}
