import { useState } from 'react';
import { FiEye, FiEyeOff, FiLock } from 'react-icons/fi';

export default function PasswordInput({ value, onChange, name = 'password', placeholder = 'Enter password', autoComplete = 'current-password' }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <FiLock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-11 text-base outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
        type={show ? 'text' : 'password'}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <FiEyeOff /> : <FiEye />}
      </button>
    </div>
  );
}
