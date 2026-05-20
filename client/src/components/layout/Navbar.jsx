import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { APP_NAME } from '../../utils/constants';
import { Menu, X, LogOut } from 'lucide-react';
import { Button } from '../ui/Button';
import StatusBadge from '../ui/StatusBadge';
import { cn } from '../../lib/utils';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="navbar">
      <Link to="/" className="navbar-brand">
        <div className="navbar-dot" />
        {APP_NAME}
      </Link>

      <div className={cn('navbar-links', mobileOpen && 'open')}>
        <Link 
          to="/search" 
          className={cn('navbar-link', location.pathname === '/search' && 'active')}
        >
          Search medicines
        </Link>
        <Link 
          to="/register" 
          className={cn('navbar-link', location.pathname === '/register' && 'active')}
        >
          For pharmacies
        </Link>
        <Link 
          to="/about" 
          className={cn('navbar-link', location.pathname === '/about' && 'active')}
        >
          About
        </Link>
        {isAuthenticated && (
          <Link 
            to={user?.role === 'ADMIN' ? '/admin' : '/dashboard'} 
            className={cn(
              'navbar-link', 
              (user?.role === 'ADMIN' 
                ? location.pathname.startsWith('/admin') 
                : location.pathname.startsWith('/dashboard')
              ) && 'active'
            )}
          >
            {user?.role === 'ADMIN' ? 'Admin panel' : 'Dashboard'}
          </Link>
        )}
      </div>

      <div className="navbar-actions" style={{ marginLeft: 'auto' }}>
        {isAuthenticated ? (
          <>
            <div className="navbar-desktop-actions">
              {user?.role === 'ADMIN' ? (
                <StatusBadge variant="neutral">Admin</StatusBadge>
              ) : (
                <>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                    {user?.pharmacyName || user?.email?.split('@')[0]}
                  </span>
                  <StatusBadge variant="primary">{user?.role?.toLowerCase() || 'pharmacy'}</StatusBadge>
                </>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="btn btn-ghost btn-sm"
              style={{ padding: '6px' }}
              aria-label="Log out"
            >
              <LogOut style={{ width: 16, height: 16 }} />
            </button>
          </>
        ) : (
          <div className="navbar-desktop-actions">
            <Link to="/login" className="navbar-link" style={{ fontWeight: 500, padding: '0 12px' }}>
              Log in
            </Link>
            <Button size="sm" onClick={() => navigate('/register')}>
              Register pharmacy
            </Button>
          </div>
        )}

        <button
          className="btn btn-ghost btn-sm md:hidden"
          style={{ padding: '6px' }}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? (
            <X style={{ width: 20, height: 20 }} />
          ) : (
            <Menu style={{ width: 20, height: 20 }} />
          )}
        </button>
      </div>
    </header>
  );
}
