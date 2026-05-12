import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { APP_NAME } from '../../utils/constants';
import { LogOut, LayoutDashboard, Pill, Menu, X, Search } from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="bg-surface/80 backdrop-blur-md border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo Section */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="bg-primary/10 p-1.5 rounded-lg group-hover:bg-primary/20 transition-colors">
                <Pill className="w-5 h-5 text-primary" strokeWidth={2.5} />
              </div>
              <span className="text-lg font-bold text-text tracking-tight group-hover:text-primary transition-colors">
                {APP_NAME}
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/search"
              className="text-sm font-medium text-text-secondary hover:text-text transition-colors flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Search
            </Link>

            {isAuthenticated ? (
              <div className="flex items-center gap-4 border-l border-border pl-6">
                <Link
                  to="/dashboard"
                  className="btn btn-ghost btn-sm"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Link>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {user?.email?.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden lg:block text-left">
                    <p className="text-sm font-semibold text-text leading-tight">
                      {user?.email?.split('@')[0]}
                    </p>
                    <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                      {user?.role}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 text-text-muted hover:text-danger hover:bg-danger/10 rounded-md transition-colors ml-1"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 border-l border-border pl-6">
                <Link to="/login" className="text-sm font-medium text-text-secondary hover:text-text transition-colors">
                  Log in
                </Link>
                <Link to="/register" className="btn btn-primary btn-sm rounded-full px-4">
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 rounded-md text-text-secondary hover:bg-surface-hover hover:text-text transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-surface absolute w-full shadow-lg">
          <div className="px-4 py-3 space-y-1">
            <Link
              to="/search"
              className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium text-text-secondary hover:bg-surface-hover"
              onClick={() => setMobileOpen(false)}
            >
              <Search className="w-4 h-4" />
              Search Medicines
            </Link>

            {isAuthenticated ? (
              <>
                <Link
                  to="/dashboard"
                  className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium text-text-secondary hover:bg-surface-hover"
                  onClick={() => setMobileOpen(false)}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Link>
                <div className="border-t border-border pt-3 mt-3 px-3 pb-2">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {user?.email?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text">{user?.email}</p>
                      <p className="text-xs text-text-muted">{user?.role}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { handleLogout(); setMobileOpen(false); }}
                    className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md text-sm font-medium text-danger hover:bg-danger/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Log out
                  </button>
                </div>
              </>
            ) : (
              <div className="border-t border-border pt-3 mt-3 px-3 space-y-2 pb-2">
                <Link
                  to="/login"
                  className="block w-full text-center px-4 py-2 rounded-md text-sm font-medium text-text-secondary bg-surface-hover"
                  onClick={() => setMobileOpen(false)}
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="block w-full text-center px-4 py-2 rounded-md text-sm font-medium text-white bg-primary"
                  onClick={() => setMobileOpen(false)}
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
