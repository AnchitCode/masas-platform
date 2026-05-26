import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { FormField, Input } from '../components/ui/forms';
import { Button } from '../components/ui/Button';
import AlertBanner from '../components/ui/AlertBanner';
import { APP_NAME } from '../utils/constants';
import logoUrl from '../assets/logo.jpg';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors([]);

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
        email: formData.email,
        password: formData.password,
        role: 'PHARMACY',
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const data = err.response?.data;
      if (data?.errors) {
        setFieldErrors(data.errors);
      }
      setError(data?.message || 'Registration failed. Please try again.');
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

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
