import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Bookmark, Settings, FolderOpen, RefreshCw } from 'lucide-react';
import { useFilesStore } from '../stores/filesStore';

interface LayoutProps {
  children: ReactNode;
}

interface NavItemProps {
  to: string;
  icon: ReactNode;
  label: string;
}

function NavItem({ to, icon, label }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
          isActive
            ? 'bg-primary-600 text-white'
            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
        }`
      }
    >
      {icon}
      <span className="font-medium">{label}</span>
    </NavLink>
  );
}

export default function Layout({ children }: LayoutProps) {
  const { isSyncing, syncProgress } = useFilesStore();

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-950 border-r border-gray-800 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-xl font-bold text-white">JumpChain Browser</h1>
          <p className="text-xs text-gray-500 mt-1">PDF Document Manager</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          <NavItem to="/" icon={<Home size={20} />} label="Home" />
          <NavItem to="/browse" icon={<FolderOpen size={20} />} label="Browse All" />
          <NavItem to="/bookmarks" icon={<Bookmark size={20} />} label="Bookmarks" />
          <NavItem to="/settings" icon={<Settings size={20} />} label="Settings" />
        </nav>

        {/* Sync Status */}
        {isSyncing && (
          <div className="p-4 border-t border-gray-800">
            <div className="flex items-center gap-2 text-primary-400">
              <RefreshCw size={16} className="animate-spin" />
              <span className="text-sm truncate">{syncProgress || 'Syncing...'}</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-800">
          <p className="text-xs text-gray-600 text-center">v{__APP_VERSION__}</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
