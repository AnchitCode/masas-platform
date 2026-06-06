import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import { Menu } from 'lucide-react';

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="dashboard-shell">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        variant="admin"
      />

      <main className="dashboard-main flex-col">
        {/* Mobile Header */}
        <div
          className="md:hidden"
          style={{
            display: 'flex',
            alignItems: 'center',
            paddingBottom: 20,
            marginBottom: 20,
            borderBottom: '0.5px solid var(--border)',
          }}
        >
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ padding: 6, marginRight: 12 }}
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu style={{ width: 20, height: 20 }} />
          </button>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Admin Panel</span>
        </div>

        <div style={{ flex: 1 }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
