import { useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import AlertBanner from '../components/ui/AlertBanner';
import { FormField, Input } from '../components/ui/forms';
import { Button } from '../components/ui/Button';
import { getErrorMessage } from '../lib/utils';
import logoUrl from '../assets/logo.jpg';
import axios from 'axios';

export default function Login() {
  const { login, googleAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Redirect helper based on user role and pharmacy status
  const getRedirectPath = (user: Record<string, unknown>) => {
    if (user?.role === 'ADMIN') return '/admin';

    const from = location.state?.from?.pathname;
    if (from && from !== '/login' && from !== '/register') return from;

    return '/dashboard';
  };

  // Google auth callback
  useGoogleAuth(async (idToken) => {
    setError('');
    setGoogleLoading(true);
    try {
      const response = await googleAuth(idToken);
      const res = response as { data?: { user?: Record<string, unknown>; isNewUser?: boolean } };
      const user = res?.data?.user;
      navigate(getRedirectPath(user || {}), { replace: true });
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        setError(err.response?.data?.message || 'This account cannot use Google sign-in.');
      } else {
        setError(getErrorMessage(err, 'Google sign-in failed. Please try again.'));
      }
    } finally {
      setGoogleLoading(false);
    }
  }, googleBtnRef);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await login({ ...formData, rememberMe });
      const res = response as { data?: { user?: Record<string, unknown> } };
      const user = res?.data?.user;
      navigate(getRedirectPath(user || {}), { replace: true });
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        setError(err.response?.data?.message || 'Please verify your email address.');
      } else {
        setError(
          getErrorMessage(err, 'Login failed. Please check your credentials.')
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center page-bg" style={{ minHeight: 'calc(100vh - var(--navbar-height))', padding: '48px 16px' }}>
      <div className="animate-fade-in" style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <img src={logoUrl} alt="MASAS Logo" style={{ height: 64, width: 'auto', objectFit: 'contain' }} />
          </div>
          <h1 className="masas-typography-page-title" style={{ fontSize: 24 }}>Welcome back</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>Sign in to continue to MASAS</p>
        </div>

        <div className="card" style={{ padding: 40 }}>
          {error ? (
            <div style={{ marginBottom: 20 }}>
              <AlertBanner variant="error" title="Sign-in failed">
                {error}
              </AlertBanner>
            </div>
          ) : null}

          {/* Google Sign-In Button */}
          <div
            ref={googleBtnRef}
            style={{
              width: '100%',
              minHeight: 44,
              display: 'flex',
              justifyContent: 'center',
              opacity: googleLoading ? 0.6 : 1,
              pointerEvents: googleLoading ? 'none' : 'auto',
            }}
          />

          {/* Divider */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            margin: '20px 0', color: 'var(--muted)', fontSize: 13,
          }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span>or</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <FormField label="Email address">
              <Input
                id="email"
                type="email"
                leftIcon={Mail}
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                autoComplete="email"
              />
            </FormField>

            <FormField label="Password">
              <Input
                id="password"
                type="password"
                leftIcon={Lock}
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                autoComplete="current-password"
              />
            </FormField>

            {/* Remember me + Forgot password row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--green-600)' }}
                />
                Remember me
              </label>
              <Link to="/forgot-password" style={{ fontSize: 13, color: 'var(--green-600)', fontWeight: 500, textDecoration: 'none' }}>
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              size="lg"
              style={{ width: '100%', marginTop: 8 }}
              rightIcon={ArrowRight}
              isLoading={loading}
            >
              Sign in
            </Button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--muted)', marginTop: 24 }}>
          Don&apos;t have an account?{' '}
          <Link to="/register" style={{ color: 'var(--green-600)', fontWeight: 500 }}>
            Register
          </Link>
        </p>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
          By continuing you agree to our{' '}
          <Link to="/terms" style={{ color: 'var(--green-600)' }}>Terms of Service</Link>
          {' · '}
          <Link to="/privacy" style={{ color: 'var(--green-600)' }}>Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}
