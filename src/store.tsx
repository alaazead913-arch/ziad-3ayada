import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type {
  Order, Product, Category, Purchase, Shift, Expense, Settings,
  User, AuditEntry, StockMovement, CurrentUser,
} from '@/types';
import * as mock from '@/lib/mockData';

export interface ToastMsg {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  text: string;
}

interface StoreValue {
  // auth
  currentUser: CurrentUser | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  // data
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  categories: Category[];
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  purchases: Purchase[];
  setPurchases: React.Dispatch<React.SetStateAction<Purchase[]>>;
  shifts: Shift[];
  setShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  audit: AuditEntry[];
  setAudit: React.Dispatch<React.SetStateAction<AuditEntry[]>>;
  movements: StockMovement[];
  setMovements: React.Dispatch<React.SetStateAction<StockMovement[]>>;
  // toasts
  toasts: ToastMsg[];
  toast: (type: ToastMsg['type'], text: string) => void;
  dismissToast: (id: string) => void;
  // permissions
  can: (perm: string) => boolean;
  // audit helper
  logAction: (action: string, entity: string, before?: string, after?: string, reason?: string) => void;
}

const Ctx = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [products, setProducts] = useState<Product[]>(mock.products);
  const [categories] = useState<Category[]>(mock.categories);
  const [orders, setOrders] = useState<Order[]>(mock.orders);
  const [purchases, setPurchases] = useState<Purchase[]>(mock.purchases);
  const [shifts, setShifts] = useState<Shift[]>(mock.shifts);
  const [expenses, setExpenses] = useState<Expense[]>(mock.expenses);
  const [settings, setSettings] = useState<Settings>(mock.defaultSettings);
  const [users, setUsers] = useState<User[]>(mock.users);
  const [audit, setAudit] = useState<AuditEntry[]>(mock.auditLog);
  const [movements, setMovements] = useState<StockMovement[]>(mock.stockMovements);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const toast = useCallback((type: ToastMsg['type'], text: string) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    setToasts((p) => [...p, { id, type, text }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((p) => p.filter((t) => t.id !== id));
  }, []);

  const login = useCallback((username: string, _password: string): boolean => {
    const u = mock.users.find((x) => x.username === username && x.active);
    if (!u) return false;
    setCurrentUser({
      id: u.id, name: u.name, username: u.username, role: u.role, permissions: u.permissions,
    });
    return true;
  }, []);

  const logout = useCallback(() => setCurrentUser(null), []);

  const can = useCallback((perm: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'owner') return true;
    return currentUser.permissions.includes(perm as any);
  }, [currentUser]);

  const logAction = useCallback((action: string, entity: string, before?: string, after?: string, reason?: string) => {
    if (!currentUser) return;
    const entry: AuditEntry = {
      id: `a_${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      action, entity, before, after, reason,
      at: new Date().toISOString(),
    };
    setAudit((p) => [entry, ...p]);
  }, [currentUser]);

  const value: StoreValue = {
    currentUser, login, logout,
    products, setProducts, categories,
    orders, setOrders,
    purchases, setPurchases,
    shifts, setShifts,
    expenses, setExpenses,
    settings, setSettings,
    users, setUsers,
    audit, setAudit,
    movements, setMovements,
    toasts, toast, dismissToast,
    can, logAction,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore must be used within StoreProvider');
  return v;
}
