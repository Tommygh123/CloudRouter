import { Link, useLocation } from 'react-router-dom';
import { FiMail } from 'react-icons/fi';
import AuthCard from '../../components/auth/AuthCard';

export default function VerifyEmail() {
  const email = useLocation().state?.email;
  return <AuthCard title="Check your email" subtitle={email ? `We sent a verification link to ${email}.` : 'Open the verification email from CloudRouter to activate your account.'}>
    <div className="text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-2xl text-indigo-600"><FiMail /></div><p className="mt-5 text-sm leading-6 text-slate-600">After verification, return to CloudRouter and sign in. You will then create your business and begin the trial.</p><Link className="mt-6 inline-flex w-full justify-center rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white" to="/login">Go to sign in</Link></div>
  </AuthCard>;
}
