import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, BarChart3, User, Settings, LogOut, Store } from 'lucide-react';
import { APP_NAME } from '../../utils/constants';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import MasasLogo from '../ui/MasasLogo';

interface SidebarProps {
  open: boolean;
  onClose?: () => void;
  variant?: 'pharmacy' | 'admin';
}

export default function Sidebar({ open, onClose, variant = 'pharmacy' }: SidebarProps) {
  const { logout } = useAuth();
  
  const handleLogout = async () => {
    if (onClose) onClose();
    await logout();
  };

  interface NavItemConfig {
    to: string;
    icon: React.ElementType;
    label: string;
    end?: boolean;
    comingSoon?: boolean;
  }

  interface NavGroupConfig {
    label: string;
    items: NavItemConfig[];
  }

  const pharmacyNavGroups: NavGroupConfig[] = [
    {
      label: 'Main',
      items: [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Overview', end: true },
        { to: '/dashboard/inventory', icon: Package, label: 'Inventory' },
        { to: '/dashboard/analytics', icon: BarChart3, label: 'Analytics', comingSoon: true },
      ],
    },
    {
      label: 'Account',
      items: [
        { to: '/dashboard/profile', icon: User, label: 'Profile' },
        { to: '/dashboard/settings', icon: Settings, label: 'Settings', comingSoon: true },
      ],
    },
  ];

  const adminNavGroups: NavGroupConfig[] = [
    {
      label: 'Platform',
      items: [
        { to: '/admin', icon: LayoutDashboard, label: 'Overview', end: true },
        { to: '/admin/pharmacies', icon: Store, label: 'Pharmacies' },
      ],
    },
    {
      label: 'System',
      items: [
        { to: '/admin/settings', icon: Settings, label: 'Settings', comingSoon: true },
      ],
    },
  ];

  const navGroups = variant === 'admin' ? adminNavGroups : pharmacyNavGroups;

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
          <MasasLogo size={22} variant="white" />
          {APP_NAME}
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {navGroups.map((group) => (
            <div key={group.label} style={{ marginBottom: 16 }}>
              <div className="sidebar-section-label">{group.label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {group.items.map((item) =>
                  item.comingSoon ? (
                    <div
                      key={item.label}
                      className="sidebar-item sidebar-item--disabled"
                      aria-disabled="true"
                      title={`${item.label} — Coming soon`}
                    >
                      <item.icon className="sidebar-item-icon" />
                      <span>{item.label}</span>
                      <span className="sidebar-badge-soon">Soon</span>
                    </div>
                  ) : (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={onClose}
                      className={({ isActive }) => cn('sidebar-item', isActive && 'active')}
                    >
                      <item.icon className="sidebar-item-icon" />
                      <span>{item.label}</span>
                    </NavLink>
                  )
                )}
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
