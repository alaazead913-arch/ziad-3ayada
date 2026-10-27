import type {
  Product, Category, Order, Purchase, Shift, Expense, Settings,
  User, AuditEntry, StockMovement, Unit, PaymentMethod, PaymentMethodId,
  ItemType,
} from '@/types';

// ----- Units ----------------------------------------------------------------
export const units: Unit[] = [
  { id: 'u_kg', name: 'كيلو' },
  { id: 'u_g', name: 'جرام', baseUnitId: 'u_kg', factor: 0.001 },
  { id: 'u_pc', name: 'قطعة' },
  { id: 'u_l', name: 'لتر' },
  { id: 'u_ml', name: 'ملي', baseUnitId: 'u_l', factor: 0.001 },
  { id: 'u_box', name: 'علبة' },
];

// ----- Categories -----------------------------------------------------------
export const categories: Category[] = [
  { id: 'c_food', name: 'أكلات', parentId: null },
  { id: 'c_grill', name: 'مشويات', parentId: 'c_food' },
  { id: 'c_sand', name: 'ساندوتشات', parentId: 'c_food' },
  { id: 'c_drinks', name: 'مشروبات', parentId: null },
  { id: 'c_hot', name: 'ساخنة', parentId: 'c_drinks' },
  { id: 'c_cold', name: 'باردة', parentId: 'c_drinks' },
  { id: 'c_dessert', name: 'حلويات', parentId: null },
  { id: 'c_sides', name: 'إضافات', parentId: null },
];

const sizes = (base: number) => [
  { id: 's_s', name: 'صغير', price: base * 0.8, cost: base * 0.35, recipe: [] },
  { id: 's_m', name: 'وسط', price: base, cost: base * 0.42, recipe: [] },
  { id: 's_l', name: 'كبير', price: base * 1.25, cost: base * 0.5, recipe: [] },
];

const sizeSingle = (price: number, cost: number) => [
  { id: 's_only', name: 'عادي', price, cost, recipe: [] },
];

const addonGroups = () => [
  {
    id: 'ag_cheese', name: 'إضافة جبنة', required: false, multi: true, max: 3,
    options: [
      { id: 'ch_1', name: 'موتزاريلا', price: 8 },
      { id: 'ch_2', name: 'شيدر', price: 7 },
      { id: 'ch_3', name: 'بارميزان', price: 10 },
    ],
  },
  {
    id: 'ag_sauce', name: 'الصوص', required: false, multi: false,
    options: [
      { id: 'sa_1', name: 'كاتشاب', price: 0 },
      { id: 'sa_2', name: 'مايونيز', price: 2 },
      { id: 'sa_3', name: 'صوص حار', price: 3 },
    ],
  },
];

// ----- Products -------------------------------------------------------------
const P = (
  id: string, name: string, code: string, categoryId: string,
  baseCost: number, price: number, type: ItemType,
  available: number, multi = false,
  addonGroups: any[] = [],
): Product => ({
  id, name, code, categoryId, type,
  unitId: type === 'ready' ? 'u_pc' : 'u_kg',
  baseCost,
  taxRate: 14,
  available,
  trackStock: true,
  sizes: multi ? sizes(price) : sizeSingle(price, baseCost),
  addonGroups,
  active: true,
});

export const products: Product[] = [
  P('p_burger',  'برجر لحم',     'BRG-01', 'c_sand',    28, 65,  'manufactured', 120, true, addonGroups()),
  P('p_zinger',  'زنجر',         'ZNG-01', 'c_sand',    25, 55,  'manufactured', 100, true, addonGroups()),
  P('p_shawrma', 'شاورما دجاج',  'SHW-01', 'c_sand',    18, 45,  'manufactured', 80,  true, addonGroups()),
  P('p_pizza',   'بيتزا مارجريتا','PZA-01', 'c_food',   45, 110, 'manufactured', 40,  true, addonGroups()),
  P('p_grill_mx','مشاوي مشكلة',  'GRB-01', 'c_grill',   85, 180, 'manufactured', 35,  true),
  P('p_kofta',   'كفتة مشوية',   'KFT-01', 'c_grill',   40, 95,  'manufactured', 50,  true),
  P('p_cola',    'كولا',         'DRK-01', 'c_cold',    6,  18,  'ready',        200, false),
  P('p_water',   'مياه',         'DRK-02', 'c_cold',    2,  7,   'ready',        300, false),
  P('p_tea',     'شاي',          'DRK-03', 'c_hot',     3,  12,  'ready',        500, false),
  P('p_coffee',  'قهوة',         'DRK-04', 'c_hot',     8,  25,  'ready',        150, false),
  P('p_juice',   'عصير برتقال',  'DRK-05', 'c_cold',    12, 30,  'manufactured', 60,  false),
  P('p_fries',   'بطاطس مقلية',  'SID-01', 'c_sides',   7,  22,  'manufactured', 90,  false),
  P('p_rice',    'أرز',          'SID-02', 'c_sides',   5,  18,  'manufactured', 70,  false),
  P('p_salad',   'سلطة',         'SID-03', 'c_sides',   6,  20,  'manufactured', 40,  false),
  P('p_kunafa',  'كنافة',        'DST-01', 'c_dessert', 15, 40,  'manufactured', 25,  false),
  P('p_choco',   'كيك شوكولاتة', 'DST-02', 'c_dessert', 20, 50,  'manufactured', 20,  false),
  // raw
  P('r_meat',    'لحم بقري',     'RAW-01', 'c_grill',   180, 0, 'raw', 50, false),
  P('r_chicken', 'فراخ',         'RAW-02', 'c_grill',   65,  0, 'raw', 80, false),
  P('r_bread',   'عيش',          'RAW-03', 'c_sides',   1,   0, 'raw', 200, false),
];

// ----- Payment methods ------------------------------------------------------
export const paymentMethods: PaymentMethod[] = [
  { id: 'cash', name: 'نقد', accountName: 'الخزنة' },
  { id: 'card', name: 'بطاقة', accountName: 'حساب البطاقة' },
  { id: 'bank', name: 'بنك', accountName: 'الحساب البنكي' },
  { id: 'visa', name: 'فيزا', accountName: 'حساب الفيزا' },
];

// ----- Settings -------------------------------------------------------------
export const defaultSettings: Settings = {
  restaurantName: 'مطعمنا',
  currency: 'ج.م',
  taxRate: 14,
  taxInclusive: true,
  phone: '01000000000',
  address: 'شارع التحرير، القاهرة',
  lowStockThreshold: 10,
  printFooter: 'شكراً لزيارتكم — مطعمنا',
  itemTypes: [
    { id: 'raw', name: 'مواد خام' },
    { id: 'manufactured', name: 'مواد مصنعة' },
    { id: 'ready', name: 'جاهزة للبيع' },
  ],
  paymentMethods,
};

// ----- Users ----------------------------------------------------------------
const ALL_PERMS = [
  'edit_prices','apply_discounts','cancel_orders','process_returns',
  'credit_sales','manage_purchases','manage_inventory','manage_expenses',
  'view_reports','manage_settings','manage_users',
] as any;

export const users: User[] = [
  { id: 'u_owner', name: 'أحمد المالك', username: 'owner', role: 'owner', active: true, permissions: ALL_PERMS, createdAt: '2024-01-01' },
  { id: 'u_mgr',   name: 'محمود المدير', username: 'manager', role: 'manager', active: true, permissions: ALL_PERMS, createdAt: '2024-02-01' },
  { id: 'u_cash1', name: 'سارة الكاشير', username: 'sara', role: 'cashier', active: true,
    permissions: ['apply_discounts','cancel_orders','credit_sales','manage_expenses'] as any, createdAt: '2024-03-01' },
  { id: 'u_cash2', name: 'كريم الكاشير', username: 'karim', role: 'cashier', active: true,
    permissions: ['apply_discounts','cancel_orders'] as any, createdAt: '2024-04-01' },
];

// ----- Helpers to generate mock orders --------------------------------------
const NOW = Date.now();
const DAY = 86400000;

const mkOrder = (
  i: number, daysAgo: number, type: any, status: any,
  lines: any[], cashierId: string, cashierName: string,
  isCredit = false, discount = 0,
): Order => {
  const created = new Date(NOW - daysAgo * DAY - i * 60000).toISOString();
  let subtotal = 0;
  for (const l of lines) {
    const addonsTotal = l.addons.reduce((s: number, a: any) => s + a.price, 0);
    l.lineTotal = (l.unitPrice + addonsTotal) * l.qty - (l.lineDiscount || 0);
    subtotal += l.lineTotal;
  }
  const taxable = subtotal - discount;
  const taxAmount = Math.round(taxable * 0.14 * 100) / 100;
  const total = Math.round((taxable + taxAmount) * 100) / 100;
  return {
    id: `o_${daysAgo}_${i}`,
    number: `${1000 + i + daysAgo * 20}`,
    type, status,
    deliveryKind: type === 'delivery' ? 'restaurant' : undefined,
    lines,
    subtotal: Math.round(subtotal * 100) / 100,
    discount, taxAmount, total,
    paid: status === 'paid' ? total : (status === 'cancelled' || status === 'returned' ? 0 : 0),
    payments: status === 'paid' ? [{ method: i % 3 === 0 ? 'card' : 'cash', amount: total }] : [],
    isCredit,
    cashierId, cashierName,
    createdAt: created,
    paidAt: status === 'paid' ? created : undefined,
    cancelReason: status === 'cancelled' ? 'خطأ في الطلب' : undefined,
    returnReason: status === 'returned' ? 'عميل رفض الطلب' : undefined,
  };
};

const line = (productId: string, productName: string, sizeName: string, unitPrice: number, qty: number, addons: any[] = [], note?: string) => ({
  id: `ln_${productId}_${Math.random().toString(36).slice(2,6)}`,
  productId, productName, sizeId: 's_m', sizeName,
  unitPrice, qty, note,
  addons, lineDiscount: 0,
  lineTotal: 0,
});

const sampleLines = [
  [line('p_burger', 'برجر لحم', 'وسط', 65, 2, [{id:'ch_1',name:'موتزاريلا',price:8}], 'بدون بصل')],
  [line('p_zinger', 'زنجر', 'وسط', 55, 1), line('p_cola', 'كولا', 'عادي', 18, 1)],
  [line('p_pizza', 'بيتزا مارجريتا', 'وسط', 110, 1, [{id:'ch_2',name:'شيدر',price:7}])],
  [line('p_shawrma', 'شاورما دجاج', 'وسط', 45, 3), line('p_fries', 'بطاطس مقلية', 'عادي', 22, 2)],
  [line('p_grill_mx', 'مشاوي مشكلة', 'كبير', 225, 1), line('p_rice', 'أرز', 'عادي', 18, 2), line('p_salad', 'سلطة', 'عادي', 20, 1)],
  [line('p_kofta', 'كفتة مشوية', 'وسط', 95, 2), line('p_water', 'مياه', 'عادي', 7, 3)],
  [line('p_coffee', 'قهوة', 'عادي', 25, 2), line('p_kunafa', 'كنافة', 'عادي', 40, 1)],
  [line('p_choco', 'كيك شوكولاتة', 'عادي', 50, 1), line('p_coffee', 'قهوة', 'عادي', 25, 1)],
  [line('p_juice', 'عصير برتقال', 'عادي', 30, 2)],
  [line('p_cola', 'كولا', 'عادي', 18, 5)],
];

const types: any[] = ['dine_in','takeaway','takeaway','delivery','dine_in'];
const cashiers = [
  ['u_cash1','سارة الكاشير'],
  ['u_cash2','كريم الكاشير'],
] as const;

export const orders: Order[] = [];
for (let d = 0; d < 30; d++) {
  const count = 4 + (d % 4);
  for (let i = 0; i < count; i++) {
    const [cid, cname] = cashiers[(d + i) % 2];
    const li = sampleLines[(d + i) % sampleLines.length];
    const st = d === 0 && i < 2 ? 'open' : (i % 17 === 0 ? 'cancelled' : (i % 23 === 0 ? 'returned' : 'paid'));
    orders.push(mkOrder(i, d, types[(d+i) % types.length], st, JSON.parse(JSON.stringify(li)), cid, cname, i % 9 === 0, i % 5 === 0 ? 10 : 0));
  }
}

// ----- Purchases ------------------------------------------------------------
export const purchases: Purchase[] = [
  { id: 'pr_1', number: 'PUR-0001', supplierName: 'مصنع لحوم الأهرام', invoiceRef: 'INV-5521', date: new Date(NOW - 2*DAY).toISOString().slice(0,10),
    lines: [
      { productId: 'r_meat', productName: 'لحم بقري', qty: 20, unitCost: 170, lineTotal: 3400 },
      { productId: 'r_chicken', productName: 'فراخ', qty: 30, unitCost: 60, lineTotal: 1800 },
    ], total: 5200, paid: 5200, remaining: 0, status: 'received', userId: 'u_mgr', userName: 'محمود المدير' },
  { id: 'pr_2', number: 'PUR-0002', supplierName: 'شركة المشروبات', invoiceRef: 'INV-9032', date: new Date(NOW - 5*DAY).toISOString().slice(0,10),
    lines: [
      { productId: 'p_cola', productName: 'كولا', qty: 100, unitCost: 5.5, lineTotal: 550 },
      { productId: 'p_water', productName: 'مياه', qty: 200, unitCost: 1.8, lineTotal: 360 },
    ], total: 910, paid: 500, remaining: 410, status: 'received', userId: 'u_mgr', userName: 'محمود المدير' },
  { id: 'pr_3', number: 'PUR-0003', supplierName: 'مخبز النجاح', invoiceRef: 'INV-1187', date: new Date(NOW - 1*DAY).toISOString().slice(0,10),
    lines: [
      { productId: 'r_bread', productName: 'عيش', qty: 500, unitCost: 0.8, lineTotal: 400 },
    ], total: 400, paid: 400, remaining: 0, status: 'received', userId: 'u_mgr', userName: 'محمود المدير' },
];

// ----- Shifts ---------------------------------------------------------------
export const shifts: Shift[] = [
  { id: 'sh_1', cashierId: 'u_cash1', cashierName: 'سارة الكاشير', openedAt: new Date(NOW - 1*DAY).toISOString(), closedAt: new Date(NOW - 1*DAY + 8*3600000).toISOString(), openingAmount: 500, expectedCash: 3250, countedCash: 3200, difference: -50, status: 'closed' },
  { id: 'sh_2', cashierId: 'u_cash2', cashierName: 'كريم الكاشير', openedAt: new Date(NOW - 1*DAY).toISOString(), closedAt: new Date(NOW - 1*DAY + 8*3600000).toISOString(), openingAmount: 500, expectedCash: 2870, countedCash: 2870, difference: 0, status: 'closed' },
  { id: 'sh_3', cashierId: 'u_cash1', cashierName: 'سارة الكاشير', openedAt: new Date(NOW - 4*3600000).toISOString(), openingAmount: 500, expectedCash: 1450, status: 'open' },
];

// ----- Expenses -------------------------------------------------------------
export const expenses: Expense[] = [
  { id: 'e_1', category: 'كهرباء', amount: 850, method: 'cash', note: 'فاتورة الشهر', date: new Date(NOW - 3*DAY).toISOString().slice(0,10), userId: 'u_mgr', userName: 'محمود المدير' },
  { id: 'e_2', category: 'صيانة', amount: 300, method: 'cash', note: 'تصليح دولاب', date: new Date(NOW - 2*DAY).toISOString().slice(0,10), userId: 'u_mgr', userName: 'محمود المدير' },
  { id: 'e_3', category: 'رواتب', amount: 5000, method: 'bank', note: 'سلفة رواتب', date: new Date(NOW - 1*DAY).toISOString().slice(0,10), userId: 'u_mgr', userName: 'محمود المدير' },
  { id: 'e_4', category: 'إيجار', amount: 8000, method: 'bank', note: 'إيجار المحل', date: new Date(NOW).toISOString().slice(0,10), userId: 'u_owner', userName: 'أحمد المالك' },
];

// ----- Stock movements ------------------------------------------------------
export const stockMovements: StockMovement[] = [
  { id: 'sm_1', productId: 'r_meat', productName: 'لحم بقري', type: 'purchase', qty: 20, ref: 'PUR-0001', userId: 'u_mgr', userName: 'محمود المدير', createdAt: new Date(NOW - 2*DAY).toISOString() },
  { id: 'sm_2', productId: 'r_meat', productName: 'لحم بقري', type: 'waste', qty: -1.5, reason: 'تلف', userId: 'u_mgr', userName: 'محمود المدير', createdAt: new Date(NOW - 1*DAY).toISOString() },
  { id: 'sm_3', productId: 'p_cola', productName: 'كولا', type: 'sale', qty: -12, ref: 'ORD-1024', userId: 'u_cash1', userName: 'سارة الكاشير', createdAt: new Date(NOW - 5*3600000).toISOString() },
];

// ----- Audit log ------------------------------------------------------------
export const auditLog: AuditEntry[] = [
  { id: 'a_1', userId: 'u_mgr', userName: 'محمود المدير', action: 'تعديل سعر', entity: 'برجر لحم', before: '60', after: '65', at: new Date(NOW - 2*DAY).toISOString() },
  { id: 'a_2', userId: 'u_cash1', userName: 'سارة الكاشير', action: 'إلغاء طلب', entity: 'ORD-1021', reason: 'خطأ في الطلب', at: new Date(NOW - 1*DAY).toISOString() },
  { id: 'a_3', userId: 'u_owner', userName: 'أحمد المالك', action: 'تعديل إعداد', entity: 'نسبة الضريبة', before: '11', after: '14', at: new Date(NOW).toISOString() },
];

export const METHOD_NAME: Record<PaymentMethodId, string> = {
  cash: 'نقد', card: 'بطاقة', bank: 'بنك', visa: 'فيزا',
};
