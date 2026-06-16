import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Calendar', icon: Calendar, path: '/calendar' },
  { label: 'Services', icon: ({ className }) => <img src="https://media.base44.com/images/public/6a00fd2cdf7102da68e71190/2491b7148_image-removebg-preview.png" alt="" className={`${className} object-contain`} />, path: '/services' },
  { label: 'Staff', icon: Users, path: '/staff' },
  { label: 'Settings', icon: Settings, path: '/settings' },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Guard: re-fetch fresh user from DB on every business-route mount.
  // If the salon was deleted (role reset to 'user'), kick them back home.
  useEffect(() => {
    base44.auth.me().then((freshUser) => {
      if (!freshUser) return;
      if (freshUser.role !== 'admin') {
        // Check if they still have an active staff record
        base44.entities.Staff.filter({ user_email: freshUser.email, is_active: true }).then((staffRecords) => {
          if (staffRecords.length === 0) {
            navigate('/', { replace: true });
          }
        });
      }
    });
  }, [location.pathname]);

  useEffect(() => {
    if (!user?.email) return;
    // Try staff record first, then ClientPreference, fall back to user.full_name
    Promise.all([
      base44.entities.Staff.filter({ user_email: user.email }),
      base44.entities.ClientPreference.filter({ customer_email: user.email }),
    ]).then(([staffRecords, prefs]) => {
      const staffName = staffRecords[0]?.name;
      const prefName = prefs[0]?.customer_name;
      setDisplayName(staffName || prefName || user.full_name || '');
    });
  }, [user]);

  const handleLogout = () => base44.auth.logout('/');

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-64 bg-card border-r border-border
        flex flex-col transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="https://media.base44.com/images/public/6a00fd2cdf7102da68e71190/2491b7148_image-removebg-preview.png" alt="CareBook" className="w-6 h-6 object-contain" />
            <span className="font-bebas text-2xl tracking-widest text-primary">CareBook</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ label, icon: Icon, path }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all group ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
                {active && <ChevronRight className="w-3 h-3 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-primary text-xs font-bold">
                {(displayName || user?.full_name || 'U').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{displayName || user?.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-4 px-4 py-3 border-b border-border bg-card z-10 relative">
          <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground p-2 -ml-2 rounded-lg hover:bg-secondary active:bg-secondary transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <Link to="/" className="flex items-center gap-2">
            <img src="https://media.base44.com/images/public/6a00fd2cdf7102da68e71190/2491b7148_image-removebg-preview.png" alt="CareBook" className="w-5 h-5 object-contain" />
            <span className="font-bebas text-xl tracking-widest text-primary">CareBook</span>
          </Link>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}