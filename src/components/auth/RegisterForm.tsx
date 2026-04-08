import React, { useState, useMemo, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase/client';

interface RegisterFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

function checkPasswordStrength(password: string): PasswordStrength {
  let score = 0;

  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500' };
  if (score <= 4) return { score, label: 'Medium', color: 'bg-yellow-500' };
  return { score, label: 'Strong', color: 'bg-green-500' };
}

export default function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordStrength = useMemo(
    () => (password ? checkPasswordStrength(password) : null),
    [password]
  );

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      onSuccess?.();
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="register-email"
          className="mb-1.5 block text-sm font-medium text-vw-text-secondary"
        >
          Email
        </label>
        <input
          id="register-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="your@email.com"
          className="w-full rounded-lg border border-vw-border bg-vw-bg-input px-4 py-2.5 text-vw-text placeholder-vw-text-muted outline-none transition-colors focus:border-vw-accent focus:ring-1 focus:ring-vw-accent"
          disabled={loading}
        />
      </div>

      <div>
        <label
          htmlFor="register-password"
          className="mb-1.5 block text-sm font-medium text-vw-text-secondary"
        >
          Password
        </label>
        <input
          id="register-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="Create a password"
          minLength={6}
          className="w-full rounded-lg border border-vw-border bg-vw-bg-input px-4 py-2.5 text-vw-text placeholder-vw-text-muted outline-none transition-colors focus:border-vw-accent focus:ring-1 focus:ring-vw-accent"
          disabled={loading}
        />

        {passwordStrength && (
          <div className="mt-2 space-y-1">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6].map((level) => (
                <div
                  key={level}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    level <= passwordStrength.score
                      ? passwordStrength.color
                      : 'bg-vw-border'
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-vw-text-muted">
              Password strength:{' '}
              <span className={passwordStrength.score <= 2 ? 'text-red-400' : passwordStrength.score <= 4 ? 'text-yellow-400' : 'text-green-400'}>
                {passwordStrength.label}
              </span>
            </p>
          </div>
        )}
      </div>

      <div>
        <label
          htmlFor="register-confirm-password"
          className="mb-1.5 block text-sm font-medium text-vw-text-secondary"
        >
          Confirm Password
        </label>
        <input
          id="register-confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          placeholder="Confirm your password"
          minLength={6}
          className="w-full rounded-lg border border-vw-border bg-vw-bg-input px-4 py-2.5 text-vw-text placeholder-vw-text-muted outline-none transition-colors focus:border-vw-accent focus:ring-1 focus:ring-vw-accent"
          disabled={loading}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-vw-accent px-4 py-2.5 font-medium text-white transition-all hover:bg-vw-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Creating account...
          </span>
        ) : (
          'Create Account'
        )}
      </button>

      {onSwitchToLogin && (
        <p className="text-center text-sm text-vw-text-muted">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-medium text-vw-accent hover:text-vw-accent-hover"
          >
            Sign in
          </button>
        </p>
      )}
    </form>
  );
}
