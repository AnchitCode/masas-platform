import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { Mail, Lock, ArrowRight, User } from 'lucide-react';
import AlertBanner from '../components/ui/AlertBanner';
import { FormField, Input } from '../components/ui/forms';
import { Button } from '../components/ui/Button';
import { getErrorMessage } from '../lib/utils';
import axios from 'axios';
import logoUrl from '../assets/logo.jpg';

export default function Register() {
  const { register, googleAuth } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Array<{ field: string; message: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Google auth callback
  useGoogleAuth(async (idToken) => {
    setError('');
    setGoogleLoading(true);
    try {
      const response = await googleAuth(idToken);
      const res = response as { data?: { isNewUser?: boolean } };
      if (res?.data?.isNewUser) {
        // New user via Google → go to dashboard (profile setup flow)
        navigate('/dashboard', { replace: true });
      } else {
        // Existing user → go to dashboard
        navigate('/dashboard', { replace: true });
      }
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
    setFieldErrors([]);

    if (!agreedToTerms || !agreedToPrivacy) {
      setError('Please agree to the Terms of Service and Privacy Policy.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });
      // Redirect to account-created page (NOT dashboard — email verification required)
      navigate(`/account-created?email=${encodeURIComponent(formData.email)}`, { replace: true });
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data;
        if (data?.errors) {
          setFieldErrors(data.errors);
        }
        setError(data?.message || 'Registration failed');
      } else {
        setError(getErrorMessage(err, 'Registration failed'));
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
          <h1 className="masas-typography-page-title" style={{ fontSize: 24 }}>Create your account</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>Join MASAS to get started</p>
        </div>

        <div className="card" style={{ padding: 40 }}>
          {error && (
            <div style={{ marginBottom: 20 }}>
              <AlertBanner variant="error" title={error}>
                {fieldErrors.length > 0 && (
                  <ul style={{ margin: 0, paddingLeft: 16, marginTop: 4, listStyleType: 'disc' }}>
                    {fieldErrors.map((err, i) => (
                      <li key={i}>{err.field}: {err.message}</li>
                    ))}
                  </ul>
                )}
              </AlertBanner>
            </div>
          )}

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

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <FormField label="Full name">
              <Input
                id="name"
                type="text"
                leftIcon={User}
                placeholder="Anchit Gupta"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                autoComplete="name"
              />
            </FormField>

            <FormField label="Email address">
              <Input
                id="email"
                type="email"
                leftIcon={Mail}
                placeholder="pharmacy@example.com"
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
                placeholder="Min. 8 characters"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </FormField>

            <FormField label="Confirm Password">
              <Input
                id="confirmPassword"
                type="password"
                leftIcon={Lock}
                placeholder="Repeat your password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </FormField>

            {/* Terms & Privacy checkboxes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  style={{ width: 16, height: 16, marginTop: 1, accentColor: 'var(--green-600)' }}
                />
                <span>
                  I agree to the{' '}
                  <Link to="/terms" style={{ color: 'var(--green-600)', fontWeight: 500 }} target="_blank">
                    Terms of Service
                  </Link>
                </span>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={agreedToPrivacy}
                  onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                  style={{ width: 16, height: 16, marginTop: 1, accentColor: 'var(--green-600)' }}
                />
                <span>
                  I agree to the{' '}
                  <Link to="/privacy" style={{ color: 'var(--green-600)', fontWeight: 500 }} target="_blank">
                    Privacy Policy
                  </Link>
                </span>
              </label>
            </div>

            <Button
              type="submit"
              size="lg"
              style={{ width: '100%', marginTop: 8 }}
              rightIcon={ArrowRight}
              isLoading={loading}
            >
              Create Account
            </Button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--muted)', marginTop: 24 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--green-600)', fontWeight: 500 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
