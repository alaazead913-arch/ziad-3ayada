import { useState } from 'react';
import { useStore } from '@/store';
import { ROLE_LABELS } from '@/lib/format';
import {
  LayoutDashboard, ShoppingCart, Package, Boxes, Truck,
  Wallet, BarChart3, Users, Settings as SettingsIcon,
  ChevronRight, LogOut, Store, ChefHat, MessageCircle,
} from 'lucide-react';

export type PageKey =
  | 'dashboard' | 'pos' | 'products' | 'inventory'
  | 'purchases' | 'expenses' | 'reports' | 'users' | 'settings'
  | 'chatbot-orders';

const NAV: { key: PageKey; label: string; icon: any; perm?: string }[] = [
  { key: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
  { key: 'pos',       label: 'نقطة البيع',  icon: ShoppingCart },
  { key: 'chatbot-orders', label: 'طلبات الشات بوت', icon: MessageCircle },
  { key: 'products',  label: 'الأصناف',     icon: Package, perm: 'manage_settings' },
  { key: 'inventory', label: 'المخزون',     icon: Boxes, perm: 'manage_inventory' },
  { key: 'purchases', label: 'المشتريات',   icon: Truck, perm: 'manage_purchases' },
  { key: 'expenses',  label: 'المصروفات',   icon: Wallet, perm: 'manage_expenses' },
  { key: 'reports',   label: 'التقارير',    icon: BarChart3, perm: 'view_reports' },
  { key: 'users',     label: 'المستخدمون',  icon: Users, perm: 'manage_users' },
  { key: 'settings',  label: 'الإعدادات',   icon: SettingsIcon, perm: 'manage_settings' },
];

export function Sidebar({
  current, onNavigate, collapsed, onToggle,
}: {
  current: PageKey;
  onNavigate: (k: PageKey) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { currentUser, can, settings } = useStore();

  const visible = NAV.filter((n) => !n.perm || can(n.perm));

  return (
    <aside
      className={`fixed top-0 bottom-0 right-0 z-40 bg-ink-900 text-white flex flex-col
                  transition-all duration-300 ${collapsed ? 'w-[68px]' : 'w-64'}`}
    >
      {/* Brand */}
      <div className="h-16 flex items-center gap-3 px-4 border-b border-white/10 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center shrink-0 shadow-lg">
          <Store size={22} />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-bold truncate">{settings.restaurantName}</p>
            <p className="text-[11px] text-white/50">نظام إدارة المطعم</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-1">
        {visible.map((n) => {
          const Icon = n.icon;
          const active = current === n.key;
          return (
            <button
              key={n.key}
              onClick={() => onNavigate(n.key)}
              title={n.label}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold
                          transition-all ${active
                            ? 'bg-primary-600 text-white shadow-md'
                            : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
            >
              <Icon size={20} className="shrink-0" />
              {!collapsed && <span className="truncate">{n.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-2.5 space-y-1 shrink-0">
        {!collapsed && currentUser && (
          <div className="px-2 py-1.5">
            <p className="text-sm font-semibold truncate">{currentUser.name}</p>
            <p className="text-[11px] text-white/50">{ROLE_LABELS[currentUser.role]}</p>
          </div>
        )}
        <button
          onClick={onToggle}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/50 hover:bg-white/10 hover:text-white transition"
        >
          <ChevronRight size={20} className={`shrink-0 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          {!collapsed && <span>طي القائمة</span>}
        </button>
      </div>
    </aside>
  );
}

export function Topbar({
  title, onToggleSidebar, onLogout, onOpenShift,
}: {
  title: string;
  onToggleSidebar: () => void;
  onLogout: () => void;
  onOpenShift: () => void;
}) {
  const { currentUser, shifts, settings } = useStore();
  const openShift = shifts.find((s) => s.cashierId === currentUser?.id && s.status === 'open');
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-ink-100 flex items-center gap-3 px-4 sticky top-0 z-30">
      <button onClick={onToggleSidebar} className="btn-ghost p-2">
        <ChefHat size={22} />
      </button>
      <h2 className="text-lg font-bold text-ink-800 flex-1 truncate">{title}</h2>

      {/* Shift indicator */}
      {openShift && (
        <div className="hidden sm:flex items-center gap-2 chip bg-success-50 text-success-700 border border-success-200">
          <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
          وردية مفتوحة
        </div>
      )}

      {/* Offline indicator (mock, always online in phase 1) */}
      <div className="hidden md:flex items-center gap-2 chip bg-ink-100 text-ink-500">
        <span className="w-2 h-2 rounded-full bg-success-500" />
        متصل
      </div>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 hover:bg-ink-100 transition"
        >
          <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm">
            {currentUser?.name?.charAt(0) ?? '؟'}
          </div>
          <span className="hidden sm:block text-sm font-semibold text-ink-700">{currentUser?.name}</span>
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute left-0 mt-2 w-52 card p-1.5 z-50 animate-scale-in origin-top-left">
              <div className="px-3 py-2 border-b border-ink-100 mb-1">
                <p className="text-sm font-bold text-ink-800">{currentUser?.name}</p>
                <p className="text-xs text-ink-400">@{currentUser?.username}</p>
              </div>
              <button onClick={() => { onOpenShift(); setMenuOpen(false); }}
                      className="w-full text-right px-3 py-2 rounded-lg text-sm text-ink-600 hover:bg-ink-100 transition">
                إدارة الوردية
              </button>
              <button onClick={onLogout}
                      className="w-full text-right px-3 py-2 rounded-lg text-sm text-error-600 hover:bg-error-50 transition flex items-center gap-2">
                <LogOut size={16} /> تسجيل الخروج
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
