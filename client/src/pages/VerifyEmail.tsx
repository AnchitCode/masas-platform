import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import authService from '../services/authService';
import logoUrl from '../assets/logo.jpg';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  // Derive initial state from token presence — avoids setState in effect for the no-token case
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>(token ? 'verifying' : 'error');
  const [message, setMessage] = useState(token ? '' : 'No verification token provided.');

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const verify = async () => {
      try {
        const response = await authService.verifyEmail(token);
        if (!cancelled) {
          setStatus('success');
          setMessage(response?.message || 'Email verified successfully.');
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setStatus('error');
          const data = (err as { response?: { data?: { message?: string } } })?.response?.data;
          setMessage(data?.message || 'Invalid or expired verification link.');
        }
      }
    };

    verify();

    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="flex flex-col items-center justify-center page-bg" style={{ minHeight: 'calc(100vh - var(--navbar-height))', padding: '48px 16px' }}>
      <div className="animate-fade-in" style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <img src={logoUrl} alt="MASAS Logo" style={{ height: 56, width: 'auto', objectFit: 'contain' }} />
        </div>

        <div className="card" style={{ padding: '48px 40px' }}>
          {status === 'verifying' && (
            <>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px',
              }}>
                <Loader2 style={{ width: 32, height: 32, color: 'var(--green-600)', animation: 'spin 1s linear infinite' }} />
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                Verifying your email...
              </h1>
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>
                Please wait while we verify your email address.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px',
              }}>
                <CheckCircle style={{ width: 36, height: 36, color: 'var(--green-600)' }} />
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                Email verified!
              </h1>
              <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 28 }}>
                {message || 'Your email has been successfully verified. You can now sign in to your account.'}
              </p>
              <Link to="/login">
                <Button size="lg" style={{ width: '100%' }} rightIcon={ArrowRight}>
                  Go to Sign In
                </Button>
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'linear-gradient(135deg, #fef2f2, #fecaca)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px',
              }}>
                <AlertTriangle style={{ width: 32, height: 32, color: '#dc2626' }} />
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                Verification failed
              </h1>
              <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 24 }}>
                {message}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                <Link to="/login" style={{ color: 'var(--green-600)', fontWeight: 500, fontSize: 14 }}>
                  Go to Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
