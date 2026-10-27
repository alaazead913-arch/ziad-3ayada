// ============================================================================
// Domain types — Restaurant POS
// ============================================================================

export type ID = string;

// ----- Users & Auth ---------------------------------------------------------
export type PermissionKey =
  | 'edit_prices' | 'apply_discounts' | 'cancel_orders' | 'process_returns'
  | 'credit_sales' | 'manage_purchases' | 'manage_inventory' | 'manage_expenses'
  | 'view_reports' | 'manage_settings' | 'manage_users';

export type Role = 'owner' | 'manager' | 'cashier' | 'waiter';

export interface User {
  id: ID;
  name: string;
  username: string;
  role: Role;
  active: boolean;
  permissions: PermissionKey[];
  createdAt: string;
}

export interface CurrentUser {
  id: ID;
  name: string;
  username: string;
  role: Role;
  permissions: PermissionKey[];
}

// ----- Sales channels -------------------------------------------------------
export type OrderType = 'dine_in' | 'takeaway' | 'delivery';
export type DeliveryKind = 'restaurant' | 'external';
export type OrderStatus = 'open' | 'sent' | 'paid' | 'cancelled' | 'returned';
export type PaymentMethodId = 'cash' | 'card' | 'bank' | 'visa';

export interface PaymentSplit {
  method: PaymentMethodId;
  amount: number;
}

// ----- Products & recipes ---------------------------------------------------
export type ItemType = 'raw' | 'manufactured' | 'ready';

export interface Unit {
  id: ID;
  name: string;       // "كيلو", "جرام", "قطعة", "لتر"
  baseUnitId?: ID;    // link to base unit if convertible
  factor?: number;    // 1 of this = factor of base
}

export interface AddonOption {
  id: ID;
  name: string;
  price: number;
}

export interface AddonGroup {
  id: ID;
  name: string;
  required: boolean;
  multi: boolean;
  max?: number;
  options: AddonOption[];
}

export interface RecipeLine {
  itemId: ID;
  qty: number;
  wastePct: number; // percentage
}

export interface ProductSize {
  id: ID;
  name: string;       // "صغير", "وسط", "كبير"
  price: number;
  cost: number;
  recipe: RecipeLine[];
}

export interface Category {
  id: ID;
  name: string;
  parentId: ID | null;
}

export interface Product {
  id: ID;
  name: string;
  code: string;
  description?: string;
  imageUrl?: string;
  categoryId: ID;
  type: ItemType;
  unitId: ID;
  baseCost: number;     // last purchase cost for valuation
  taxRate: number;      // percentage
  available: number;    // stock qty (or null if not tracked)
  trackStock: boolean;
  sizes: ProductSize[];
  addonGroups: AddonGroup[];
  active: boolean;
}

// ----- Orders ---------------------------------------------------------------
export interface OrderLine {
  id: ID;
  productId: ID;
  productName: string;
  sizeId: ID;
  sizeName: string;
  unitPrice: number;
  qty: number;
  note?: string;
  addons: { id: ID; name: string; price: number }[];
  lineDiscount: number; // flat amount on this line
  lineTotal: number;    // computed
}

export interface Order {
  id: ID;
  number: string;
  type: OrderType;
  deliveryKind?: DeliveryKind;
  tableNumber?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  status: OrderStatus;
  lines: OrderLine[];
  subtotal: number;
  discount: number;    // invoice-level flat discount
  taxAmount: number;
  total: number;
  paid: number;
  payments: PaymentSplit[];
  isCredit: boolean;
  cashierId: ID;
  cashierName: string;
  createdAt: string;
  paidAt?: string;
  cancelReason?: string;
  returnReason?: string;
}

// ----- Inventory ------------------------------------------------------------
export interface StockMovement {
  id: ID;
  productId: ID;
  productName: string;
  type: 'purchase' | 'sale' | 'adjustment' | 'waste' | 'return';
  qty: number;          // positive in, negative out
  ref?: string;
  reason?: string;
  userId: ID;
  userName: string;
  createdAt: string;
}

export interface PurchaseLine {
  productId: ID;
  productName: string;
  qty: number;
  unitCost: number;
  lineTotal: number;
}

export interface Purchase {
  id: ID;
  number: string;
  supplierName: string;
  invoiceRef: string;
  date: string;
  lines: PurchaseLine[];
  total: number;
  paid: number;
  remaining: number;
  status: 'pending' | 'received';
  userId: ID;
  userName: string;
}

// ----- Cash & Expenses ------------------------------------------------------
export interface Shift {
  id: ID;
  cashierId: ID;
  cashierName: string;
  openedAt: string;
  closedAt?: string;
  openingAmount: number;
  expectedCash: number;
  countedCash?: number;
  difference?: number;
  status: 'open' | 'closed';
}

export interface Expense {
  id: ID;
  category: string;
  amount: number;
  method: PaymentMethodId;
  note?: string;
  date: string;
  userId: ID;
  userName: string;
}

export interface PaymentMethod {
  id: PaymentMethodId;
  name: string;
  accountName: string;
}

// ----- Settings -------------------------------------------------------------
export interface Settings {
  restaurantName: string;
  logoUrl?: string;
  currency: string;
  taxRate: number;
  taxInclusive: boolean;
  phone: string;
  address: string;
  lowStockThreshold: number;
  printFooter: string;
  itemTypes: { id: string; name: string }[];
  paymentMethods: PaymentMethod[];
}

// ----- Audit ----------------------------------------------------------------
export interface AuditEntry {
  id: ID;
  userId: ID;
  userName: string;
  action: string;
  entity: string;
  before?: string;
  after?: string;
  reason?: string;
  at: string;
}
