import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';
import AlertBanner from '../components/ui/AlertBanner';
import { FormField, Input } from '../components/ui/forms';
import { Button } from '../components/ui/Button';
import authService from '../services/authService';
import { getErrorMessage } from '../lib/utils';
import logoUrl from '../assets/logo.jpg';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      await authService.resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to reset password. The link may be invalid or expired.'));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center page-bg" style={{ minHeight: 'calc(100vh - var(--navbar-height))', padding: '48px 16px' }}>
        <div className="animate-fade-in card" style={{ width: '100%', maxWidth: 400, padding: 40, textAlign: 'center' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, #fef2f2, #fecaca)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            <AlertTriangle style={{ width: 32, height: 32, color: '#dc2626' }} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Invalid reset link</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 24 }}>This link is missing or invalid.</p>
          <Link to="/forgot-password" style={{ color: 'var(--green-600)', fontWeight: 500, fontSize: 14 }}>
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center page-bg" style={{ minHeight: 'calc(100vh - var(--navbar-height))', padding: '48px 16px' }}>
      <div className="animate-fade-in" style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <img src={logoUrl} alt="MASAS Logo" style={{ height: 56, width: 'auto', objectFit: 'contain' }} />
        </div>

        <div className="card" style={{ padding: 40 }}>
          {!success ? (
            <>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8, textAlign: 'center' }}>
                Create new password
              </h1>
              <p style={{ fontSize: 14, color: 'var(--muted)', textAlign: 'center', marginBottom: 28 }}>
                Enter your new password below.
              </p>

              {error && (
                <div style={{ marginBottom: 20 }}>
                  <AlertBanner variant="error" title="Error">
                    {error}
                  </AlertBanner>
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <FormField label="New password">
                  <Input
                    id="password"
                    type="password"
                    leftIcon={Lock}
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </FormField>

                <FormField label="Confirm password">
                  <Input
                    id="confirmPassword"
                    type="password"
                    leftIcon={Lock}
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </FormField>

                <Button
                  type="submit"
                  size="lg"
                  style={{ width: '100%' }}
                  rightIcon={ArrowRight}
                  isLoading={loading}
                >
                  Reset Password
                </Button>
              </form>
            </>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px',
              }}>
                <CheckCircle style={{ width: 36, height: 36, color: 'var(--green-600)' }} />
              </div>

              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                Password updated!
              </h2>
              <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 24 }}>
                Your password has been successfully updated. You can now sign in with your new password.
              </p>

              <Link to="/login">
                <Button size="lg" style={{ width: '100%' }} rightIcon={ArrowRight}>
                  Go to Sign In
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
