import type {
  ID, OrderType, OrderStatus, PermissionKey, Role,
} from '@/types';

export const fmt = (n: number, dp = 2): string =>
  new Intl.NumberFormat('ar-EG', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(Number.isFinite(n) ? n : 0);

export const money = (n: number, currency = 'ج.م'): string =>
  `${fmt(n)} ${currency}`;

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export const todayISO = (): string => new Date().toISOString().slice(0, 10);

export const isoNow = (): string => new Date().toISOString();

export const fmtDate = (iso: string): string => {
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      year: 'numeric', month: 'short', day: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

export const fmtDateTime = (iso: string): string => {
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

export const fmtTime = (iso: string): string => {
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

export const uid = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const uid2 = (prefix: string): string =>
  `${prefix}_${uid()}`;

export const ALL_PERMISSIONS: { key: PermissionKey; label: string }[] = [
  { key: 'edit_prices', label: 'تعديل الأسعار' },
  { key: 'apply_discounts', label: 'الخصومات' },
  { key: 'cancel_orders', label: 'إلغاء الطلبات' },
  { key: 'process_returns', label: 'المرتجعات' },
  { key: 'credit_sales', label: 'الدفع الآجل' },
  { key: 'manage_purchases', label: 'المشتريات' },
  { key: 'manage_inventory', label: 'الجرد والمخزون' },
  { key: 'manage_expenses', label: 'المصروفات' },
  { key: 'view_reports', label: 'التقارير' },
  { key: 'manage_settings', label: 'الإعدادات' },
  { key: 'manage_users', label: 'إدارة المستخدمين' },
];

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'المالك',
  manager: 'مدير',
  cashier: 'كاشير',
  waiter: 'ويتر',
};

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  dine_in: 'صالة',
  takeaway: 'تيك أواي',
  delivery: 'ديليفري',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  open: 'مفتوح',
  sent: 'أُرسل للمطبخ',
  paid: 'مدفوع',
  cancelled: 'ملغي',
  returned: 'مرتجع',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  open: 'bg-ink-100 text-ink-600',
  sent: 'bg-secondary-100 text-secondary-700',
  paid: 'bg-success-100 text-success-700',
  cancelled: 'bg-error-100 text-error-700',
  returned: 'bg-warning-100 text-warning-700',
};

export const pct = (n: number, dp = 1): string => `${fmt(n, dp)}٪`;
