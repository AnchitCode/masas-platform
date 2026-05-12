import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import { Menu } from 'lucide-react';

/**
 * DashboardLayout — wraps all /dashboard/* pages with sidebar navigation.
 */
export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-bg">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 overflow-auto flex flex-col">
        {/* Mobile menu toggle */}
        <div className="lg:hidden p-4 border-b border-border bg-surface flex items-center">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5 mr-2" />
            <span className="text-sm font-medium">Menu</span>
          </button>
        </div>

        {/* Dashboard Content Container */}
        <div className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
