import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import AuthCard from '../../components/auth/AuthCard';
import FormField from '../../components/auth/FormField';
import PasswordInput from '../../components/auth/PasswordInput';
import { authService } from '../../services/authService';

export default function ResetPassword() {
  const [form, setForm] = useState({ password: '', confirm: '' }); const [loading, setLoading] = useState(false); const navigate = useNavigate();
  async function submit(e) { e.preventDefault(); if (form.password.length < 8) return toast.error('Use at least 8 characters.'); if (form.password !== form.confirm) return toast.error('Passwords do not match.'); setLoading(true); const { error } = await authService.updatePassword(form.password); setLoading(false); if (error) return toast.error(error.message); toast.success('Password updated.'); navigate('/login'); }
  return <AuthCard title="Choose a new password" subtitle="Create a strong password for your CloudRouter account."><form className="space-y-4" onSubmit={submit}><FormField label="New password"><PasswordInput value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" /></FormField><FormField label="Confirm password"><PasswordInput name="confirm" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} autoComplete="new-password" /></FormField><button disabled={loading} className="w-full rounded-xl bg-indigo-600 px-4 py-3.5 font-semibold text-white disabled:opacity-60">{loading ? 'Updating…' : 'Update password'}</button></form></AuthCard>;
}
