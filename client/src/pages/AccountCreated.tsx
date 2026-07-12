import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Mail, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
import authService from '../services/authService';
import logoUrl from '../assets/logo.jpg';

export default function AccountCreated() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';

  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (!email || cooldown > 0) return;
    setResending(true);
    try {
      await authService.resendVerification(email);
      setResent(true);
      setCooldown(60);
    } catch {
      // Silent fail — no user enumeration
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center page-bg" style={{ minHeight: 'calc(100vh - var(--navbar-height))', padding: '48px 16px' }}>
      <div className="animate-fade-in" style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <img src={logoUrl} alt="MASAS Logo" style={{ height: 56, width: 'auto', objectFit: 'contain' }} />
        </div>

        <div className="card" style={{ padding: '48px 40px' }}>
          {/* Success icon */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            <CheckCircle style={{ width: 36, height: 36, color: 'var(--green-600)' }} />
          </div>

          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            Account created successfully!
          </h1>

          <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 4 }}>
            We&apos;ve sent a verification email to
          </p>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }}>
            {email || 'your email address'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 28 }}>
            Please check your inbox and click the link to verify your email address and activate your account.
          </p>

          {/* Resend button */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Button
              variant="outline"
              size="sm"
              leftIcon={Mail}
              onClick={handleResend}
              isLoading={resending}
              style={{ minWidth: 200 }}
              disabled={cooldown > 0}
            >
              {cooldown > 0 ? `Resend email (${cooldown}s)` : 'Resend email'}
            </Button>
            {resent && (
              <p style={{ fontSize: 12, color: 'var(--green-600)', fontWeight: 500 }}>
                Verification email resent!
              </p>
            )}
          </div>
        </div>

        <Link
          to="/login"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--green-600)', fontWeight: 500, marginTop: 24, textDecoration: 'none' }}
        >
          <ArrowLeft style={{ width: 14, height: 14 }} />
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
