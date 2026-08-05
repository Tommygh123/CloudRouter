import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { tenantService } from '../../services/tenantService';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Completing email verification…');

  useEffect(() => {
    let active = true;

    async function completeVerification() {
      const { data, error } = await supabase.auth.getSession();

      if (!active) return;

      if (error || !data.session) {
        navigate('/login', { replace: true });
        return;
      }

      setMessage('Checking your business workspace…');

      const { data: memberships } = await tenantService.getMemberships();

      if (!active) return;

      navigate(
        memberships?.length ? '/dashboard' : '/onboarding/business',
        { replace: true }
      );
    }

    completeVerification();

    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="rounded-2xl bg-white px-6 py-5 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-700">{message}</p>
      </div>
    </main>
  );
}
