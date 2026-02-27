import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Server, Delete } from 'lucide-react';
import * as api from '../lib/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Login() {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.users.list().then(setUsers);
  }, []);

  // Keyboard support
  useEffect(() => {
    if (!selected) return;
    const handler = (e) => {
      if (e.key >= '0' && e.key <= '9') addDigit(e.key);
      if (e.key === 'Backspace') removeDigit();
      if (e.key === 'Enter') handleSubmit();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selected, pin]);

  const addDigit = (d) => {
    setError('');
    setPin(p => p.length < 4 ? p + d : p);
  };

  const removeDigit = () => setPin(p => p.slice(0, -1));

  const handleSubmit = async () => {
    if (pin.length !== 4 || submitting) return;
    setSubmitting(true);
    try {
      const user = await api.users.verify(selected.id, pin);
      login(user);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Incorrect PIN. Try again.');
      setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  const selectUser = (user) => {
    setSelected(user);
    setPin('');
    setError('');
  };

  const back = () => {
    setSelected(null);
    setPin('');
    setError('');
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
          <p className="text-sm text-gray-500">Sign in to continue</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm w-full max-w-sm p-8">
        {!selected ? (
          /* --- User picker --- */
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Who are you?</h2>
            {users.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-500 text-sm mb-1">No users set up yet.</p>
                <p className="text-gray-400 text-xs">Go to the Users page after signing in to add users.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {users.map(u => (
                  <button
                    key={u.id}
                    onClick={() => selectUser(u)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 hover:border-brand-400 hover:bg-brand-50 transition-colors group"
                  >
                    <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-lg font-bold group-hover:bg-brand-600 group-hover:text-white transition-colors">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-800">{u.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* --- PIN entry --- */
          <div>
            <button onClick={back} className="text-xs text-brand-600 hover:text-brand-700 font-medium mb-5 flex items-center gap-1">
              ← Back
            </button>

            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-brand-600 text-white flex items-center justify-center text-2xl font-bold mx-auto mb-2">
                {selected.name.charAt(0).toUpperCase()}
              </div>
              <p className="font-semibold text-gray-900">{selected.name}</p>
              <p className="text-sm text-gray-500 mt-0.5">Enter your 4-digit PIN</p>
            </div>

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
                    className="h-14 rounded-xl border border-gray-200 text-lg font-semibold text-gray-800 hover:bg-gray-50 active:bg-gray-100 transition-colors">
                    {key}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleSubmit}
              disabled={pin.length !== 4 || submitting}
              className="w-full mt-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? 'Verifying…' : 'Sign In'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
