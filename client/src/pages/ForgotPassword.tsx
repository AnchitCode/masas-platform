import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, ArrowRight, Send } from 'lucide-react';
import AlertBanner from '../components/ui/AlertBanner';
import { FormField, Input } from '../components/ui/forms';
import { Button } from '../components/ui/Button';
import authService from '../services/authService';
import { getErrorMessage } from '../lib/utils';
import logoUrl from '../assets/logo.jpg';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authService.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to send reset link. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center page-bg" style={{ minHeight: 'calc(100vh - var(--navbar-height))', padding: '48px 16px' }}>
      <div className="animate-fade-in" style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <img src={logoUrl} alt="MASAS Logo" style={{ height: 56, width: 'auto', objectFit: 'contain' }} />
        </div>

        <div className="card" style={{ padding: 40 }}>
          {!sent ? (
            <>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8, textAlign: 'center' }}>
                Reset your password
              </h1>
              <p style={{ fontSize: 14, color: 'var(--muted)', textAlign: 'center', marginBottom: 28, lineHeight: 1.5 }}>
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>

              {error && (
                <div style={{ marginBottom: 20 }}>
                  <AlertBanner variant="error" title="Error">
                    {error}
                  </AlertBanner>
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <FormField label="Email address">
                  <Input
                    id="email"
                    type="email"
                    leftIcon={Mail}
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </FormField>

                <Button
                  type="submit"
                  size="lg"
                  style={{ width: '100%' }}
                  rightIcon={ArrowRight}
                  isLoading={loading}
                >
                  Send reset link
                </Button>
              </form>
            </>
          ) : (
            <div style={{ textAlign: 'center' }}>
              {/* Sent confirmation */}
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px',
              }}>
                <Send style={{ width: 32, height: 32, color: 'var(--green-600)' }} />
              </div>

              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                Reset link sent!
              </h2>
              <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 4 }}>
                We&apos;ve sent a password reset link to
              </p>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }}>
                {email}
              </p>
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                Check your inbox and click the link to continue. The link expires in 1 hour.
              </p>
            </div>
          )}
        </div>

        <Link
          to="/login"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 14, color: 'var(--green-600)', fontWeight: 500, marginTop: 24, textDecoration: 'none' }}
        >
          <ArrowLeft style={{ width: 14, height: 14 }} />
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
