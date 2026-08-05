import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import AuthCard from '../../components/auth/AuthCard';
import FormField from '../../components/auth/FormField';
import { authService } from '../../services/authService';

export default function ForgotPassword() {
  const [email, setEmail] = useState(''); const [loading, setLoading] = useState(false);
  async function submit(e) { e.preventDefault(); setLoading(true); const { error } = await authService.forgotPassword(email); setLoading(false); error ? toast.error(error.message) : toast.success('Password reset link sent.'); }
  return <AuthCard title="Reset your password" subtitle="Enter your account email and we will send a secure reset link." footer={<Link className="font-semibold text-indigo-600" to="/login">Back to sign in</Link>}><form className="space-y-4" onSubmit={submit}><FormField label="Email address"><input className="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></FormField><button disabled={loading} className="w-full rounded-xl bg-indigo-600 px-4 py-3.5 font-semibold text-white disabled:opacity-60">{loading ? 'Sending…' : 'Send reset link'}</button></form></AuthCard>;
}
