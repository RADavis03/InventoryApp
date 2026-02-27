import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Server, Delete } from 'lucide-react';
import * as api from '../lib/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Login() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (pin.length === 4) handleSubmit(pin);
  }, [pin]);

  // Keyboard support
  useEffect(() => {
    const handler = (e) => {
      if (e.key >= '0' && e.key <= '9') addDigit(e.key);
      if (e.key === 'Backspace') removeDigit();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const addDigit = (d) => {
    setError('');
    setPin(p => p.length < 4 ? p + d : p);
  };

  const removeDigit = () => {
    setError('');
    setPin(p => p.slice(0, -1));
  };

  const handleSubmit = async (currentPin) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const user = await api.users.login(currentPin);
      login(user);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Incorrect PIN. Try again.');
      setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  const PAD = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="bg-brand-600 rounded-xl p-2.5">
          <Server className="w-7 h-7 text-white" />
        </div>
        <div>
          <p className="text-xl font-bold text-gray-900 leading-tight">GAH IT Inventory</p>
          <p className="text-sm text-gray-500">Enter your PIN to sign in</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm w-full max-w-xs p-8">
        {/* PIN dots */}
        <div className="flex justify-center gap-4 mb-6">
          {[0,1,2,3].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full border-2 transition-colors ${
              pin.length > i ? 'bg-brand-600 border-brand-600' : 'border-gray-300'
            }`} />
          ))}
        </div>

        {error && (
          <p className="text-center text-sm text-red-600 mb-4">{error}</p>
        )}

        {submitting && (
          <p className="text-center text-sm text-gray-400 mb-4">Signing in…</p>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3">
          {PAD.map((key, i) => {
            if (key === '') return <div key={i} />;
            if (key === '⌫') return (
              <button key={i} onClick={removeDigit}
                className="h-14 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 active:bg-gray-100 transition-colors">
                <Delete size={18} />
              </button>
            );
            return (
              <button key={i} onClick={() => addDigit(key)}
                disabled={submitting}
                className="h-14 rounded-xl border border-gray-200 text-lg font-semibold text-gray-800 hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-40">
                {key}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
