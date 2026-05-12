import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, User, X } from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Overview', end: true },
  { to: '/dashboard/inventory', icon: Package, label: 'Inventory' },
  { to: '/dashboard/profile', icon: User, label: 'Profile' },
];

export default function Sidebar({ open, onClose }) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-secondary/20 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-16 left-0 z-50 h-[calc(100vh-4rem)]
          w-64 bg-surface border-r border-border
          transform transition-transform duration-200 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full py-4">
          {/* Mobile close */}
          <div className="lg:hidden flex items-center justify-between px-6 pb-4 mb-2 border-b border-border">
            <span className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Menu</span>
            <button onClick={onClose} className="btn btn-ghost btn-sm text-text-muted hover:text-text">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-4 pb-2 hidden lg:block">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider ml-2">Dashboard</span>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 px-3 space-y-1 mt-2">
            {navItems.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={onClose}
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-primary/5 text-primary'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-text'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-primary' : 'text-text-muted group-hover:text-text'}`} strokeWidth={isActive ? 2.5 : 2} />
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          
          {/* Bottom section (Optional future user settings/help) */}
          <div className="px-4 pt-4 border-t border-border mt-auto">
             <div className="px-3 py-2 text-xs text-text-muted text-center">
               MASAS Platform v1.0
             </div>
          </div>
        </div>
      </aside>
    </>
  );
}
