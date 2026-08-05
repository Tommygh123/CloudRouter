import { useState } from 'react';
import {
  Link,
  useNavigate,
} from 'react-router-dom';
import {
  FiMail,
  FiUser,
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';

import AuthCard from '../../components/auth/AuthCard';
import FormField from '../../components/auth/FormField';
import PasswordInput from '../../components/auth/PasswordInput';
import { authService } from '../../services/authService';
import { validateRegister } from '../../utils/validators';

const initialForm = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
};

function Register() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  function change(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((current) => ({
        ...current,
        [name]: '',
      }));
    }
  }

  async function submit(event) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const nextErrors = validateRegister(form);

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } =
        await authService.register({
          fullName: form.fullName,
          email: form.email,
          password: form.password,
        });

      if (error) {
        toast.error(
          error.message ||
            'Unable to create your account.',
        );

        return;
      }

      if (!data?.user) {
        toast.error(
          'The account could not be created.',
        );

        return;
      }

      if (data.session) {
        toast.success(
          'Account created successfully.',
        );

        navigate('/onboarding/business', {
          replace: true,
        });

        return;
      }

      toast.success(
        'Account created. Check your email to verify your account.',
      );

      navigate('/verify-email', {
        replace: true,
        state: {
          email: form.email.trim().toLowerCase(),
        },
      });
    } catch (error) {
      console.error(
        'Unexpected registration error:',
        error,
      );

      toast.error(
        error?.message ||
          'An unexpected registration error occurred.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Start your free trial"
      subtitle="Create your account first. Your business workspace will be created after email verification."
      footer={
        <>
          Already registered?{' '}
          <Link
            className="font-semibold text-indigo-600"
            to="/login"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={submit}
        noValidate
      >
        <FormField
          label="Full name"
          error={errors.fullName}
        >
          <div className="relative">
            <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

            <input
              className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              type="text"
              name="fullName"
              value={form.fullName}
              onChange={change}
              autoComplete="name"
              placeholder="Your full name"
              required
            />
          </div>
        </FormField>

        <FormField
          label="Email address"
          error={errors.email}
        >
          <div className="relative">
            <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

            <input
              className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              type="email"
              name="email"
              value={form.email}
              onChange={change}
              autoComplete="email"
              placeholder="name@business.com"
              required
            />
          </div>
        </FormField>

        <FormField
          label="Password"
          error={errors.password}
        >
          <PasswordInput
            name="password"
            value={form.password}
            onChange={change}
            autoComplete="new-password"
            placeholder="Create a strong password"
            required
          />
        </FormField>

        <FormField
          label="Confirm password"
          error={errors.confirmPassword}
        >
          <PasswordInput
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={change}
            autoComplete="new-password"
            placeholder="Repeat password"
            required
          />
        </FormField>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-indigo-600 px-4 py-3.5 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting
            ? 'Creating account…'
            : 'Start 14-day free trial'}
        </button>

        <p className="text-center text-xs leading-5 text-slate-500">
          No credit card required. By continuing,
          you agree to the Terms and Privacy Policy.
        </p>
      </form>
    </AuthCard>
  );
}

export default Register;