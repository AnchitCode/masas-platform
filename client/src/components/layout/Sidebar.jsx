import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, BarChart3, User, Settings, LogOut } from 'lucide-react';
import { APP_NAME } from '../../utils/constants';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

export default function Sidebar({ open, onClose, variant = 'pharmacy' }) {
  const { logout } = useAuth();
  
  const handleLogout = async () => {
    if (onClose) onClose();
    await logout();
  };

  const navGroups = [
    {
      label: 'Main',
      items: [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Overview', end: true },
        { to: '/dashboard/inventory', icon: Package, label: 'Inventory' },
        { to: '/dashboard/analytics', icon: BarChart3, label: 'Analytics' },
      ],
    },
    {
      label: 'Account',
      items: [
        { to: '/dashboard/profile', icon: User, label: 'Profile' },
        { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
      ],
    },
  ];

  return (
    <>
      {open && (
        <div 
          className="sidebar-overlay" 
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside 
        className={cn(
          'sidebar', 
          variant === 'pharmacy' ? 'sidebar-pharmacy' : 'sidebar-admin',
          open && 'sidebar-open'
        )}
      >
        <div className="sidebar-logo">
          <div className="navbar-dot" style={{ backgroundColor: variant === 'pharmacy' ? '#4ade80' : '#22c55e' }} />
          {APP_NAME}
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {navGroups.map((group) => (
            <div key={group.label} style={{ marginBottom: 16 }}>
              <div className="sidebar-section-label">{group.label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {group.items.map(({ to, icon: Icon, label, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={onClose}
                    className={({ isActive }) => cn('sidebar-item', isActive && 'active')}
                  >
                    <Icon className="sidebar-item-icon" />
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}

          <div className="sidebar-spacer" />
          
          <button 
            onClick={handleLogout}
            className="sidebar-item"
            style={{ width: '100%', marginTop: 'auto' }}
          >
            <LogOut className="sidebar-item-icon" />
            Log out
          </button>
        </nav>
      </aside>
    </>
  );
}
