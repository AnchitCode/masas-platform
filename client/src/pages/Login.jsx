import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import AlertBanner from '../components/ui/AlertBanner';
import { FormField, Input } from '../components/ui/forms';
import { Button } from '../components/ui/Button';
import logoUrl from '../assets/logo.jpg';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await login(formData);
      // Determine default redirect path based on user role
      // response structure from authService is typically { data: { user: { role: '...' }, ... } }
      // Due to Axios, it might be nested under another data: response.data.data.user
      const userRole = response?.data?.data?.user?.role || response?.data?.user?.role;

      let redirectPath = '/dashboard';
      if (userRole === 'ADMIN') {
        redirectPath = '/admin';
      }

      // If there's a specific 'from' state, use it unless it's the default '/dashboard'
      // and the user is an admin.
      const finalDest = location.state?.from?.pathname
        ? (location.state.from.pathname === '/dashboard' && userRole === 'ADMIN' ? '/admin' : location.state.from.pathname)
        : redirectPath;

      navigate(finalDest, { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message || 'Login failed. Please check your credentials.'
      );
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
        </div>

        <div className="card" style={{ padding: 40 }}>
          {error ? (
            <div style={{ marginBottom: 20 }}>
              <AlertBanner variant="error" title="Sign-in failed">
                {error}
              </AlertBanner>
            </div>
          ) : null}

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
      </div>
    </div>
  );
}
