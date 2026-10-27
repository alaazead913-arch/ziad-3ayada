import { useState } from 'react';
import { StoreProvider, useStore } from '@/store';
import { LoginScreen } from '@/components/LoginScreen';
import { Sidebar, Topbar, type PageKey } from '@/components/Shell';
import { ToastHost } from '@/components/ToastHost';
import { Dashboard } from '@/pages/Dashboard';
import { POS } from '@/pages/POS';
import { ProductsPage } from '@/pages/Products';
import { InventoryPage } from '@/pages/Inventory';
import { PurchasesPage } from '@/pages/Purchases';
import { ExpensesPage } from '@/pages/Expenses';
import { ReportsPage } from '@/pages/Reports';
import { UsersPage } from '@/pages/Users';
import { SettingsPage } from '@/pages/Settings';
import { ShiftModal } from '@/pages/Shifts';

const PAGE_TITLES: Record<PageKey, string> = {
  dashboard: 'لوحة التحكم',
  pos: 'نقطة البيع',
  products: 'إدارة الأصناف',
  inventory: 'المخزون والجرد',
  purchases: 'المشتريات',
  expenses: 'المصروفات',
  reports: 'التقارير',
  users: 'المستخدمون',
  settings: 'الإعدادات',
};

function Shell() {
  const { currentUser, logout, can, toast } = useStore();
  const [page, setPage] = useState<PageKey>('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);

  if (!currentUser) return <LoginScreen />;

  // Guard: if user navigates to a page they lack permission for, bounce to dashboard
  const PERM_MAP: Partial<Record<PageKey, string>> = {
    products: 'manage_settings',
    inventory: 'manage_inventory',
    purchases: 'manage_purchases',
    expenses: 'manage_expenses',
    reports: 'view_reports',
    users: 'manage_users',
    settings: 'manage_settings',
  };
  const required = PERM_MAP[page];
  if (required && !can(required)) {
    setPage('dashboard');
  }

  const margin = collapsed ? 'lg:mr-[68px]' : 'lg:mr-64';

  return (
    <div className="min-h-screen bg-ink-100">
      <Sidebar
        current={page}
        onNavigate={setPage}
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
      />
      <div className={`transition-all duration-300 ${margin}`}>
        <Topbar
          title={PAGE_TITLES[page]}
          onToggleSidebar={() => setCollapsed((v) => !v)}
          onLogout={() => { logout(); toast('info', 'تم تسجيل الخروج'); }}
          onOpenShift={() => setShiftOpen(true)}
        />
        <main className="p-4 sm:p-6 max-w-[1500px] mx-auto">
          {page === 'dashboard' && <Dashboard onNavigate={setPage} />}
          {page === 'pos' && <POS />}
          {page === 'products' && <ProductsPage />}
          {page === 'inventory' && <InventoryPage />}
          {page === 'purchases' && <PurchasesPage />}
          {page === 'expenses' && <ExpensesPage />}
          {page === 'reports' && <ReportsPage />}
          {page === 'users' && <UsersPage />}
          {page === 'settings' && <SettingsPage />}
        </main>
      </div>
      <ShiftModal open={shiftOpen} onClose={() => setShiftOpen(false)} />
      <ToastHost />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
