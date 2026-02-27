import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Building2,
  ShoppingCart,
  ArrowRightLeft,
  FileBarChart2,
  Server,
  Users,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/departments', icon: Building2, label: 'Departments' },
  { to: '/purchase-orders', icon: ShoppingCart, label: 'Purchase Orders' },
  { to: '/charge-outs', icon: ArrowRightLeft, label: 'Charge-Outs' },
  { to: '/reports', icon: FileBarChart2, label: 'Reports' },
  { to: '/users', icon: Users, label: 'Users' },
];

export default function Layout() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-slate-900 flex flex-col">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-700">
          <div className="bg-brand-600 rounded-lg p-1.5">
            <Server className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">GAH IT Inventory</p>
            <p className="text-slate-400 text-xs">Management System</p>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }
            >
              <Icon className="w-4.5 h-4.5 flex-shrink-0" size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-slate-700">
          {currentUser ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-slate-300 text-sm font-medium truncate">{currentUser.name}</span>
              </div>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 transition-colors flex-shrink-0"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <p className="text-slate-500 text-xs">GAH IT Department</p>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
