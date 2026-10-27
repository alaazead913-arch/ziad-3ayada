import { useState, useMemo, useCallback } from 'react';
import { useStore } from '@/store';
import type {
  Order, OrderLine, OrderType, PaymentSplit, PaymentMethodId, Product, ProductSize, AddonGroup,
} from '@/types';
import { money, fmt, uid, uid2, ORDER_TYPE_LABELS } from '@/lib/format';
import { Modal, ConfirmDialog } from '@/components/ui';
import { saveOrderToDb } from '@/lib/ordersApi';
import { Search, Plus, Minus, Trash2, ShoppingCart, UtensilsCrossed, Bike, ShoppingBag, X, Printer, Send, CreditCard, User as UserIcon, Phone, StickyNote, Percent, CircleCheck as CheckCircle2, ChefHat, ArrowRight } from 'lucide-react';

interface CartLine extends OrderLine {}
interface DraftOrder {
  type: OrderType;
  deliveryKind?: 'restaurant' | 'external';
  tableNumber?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  note?: string;
}

const EMPTY_DRAFT: DraftOrder = { type: 'dine_in' };

export function POS() {
  const { products, categories, orders, setOrders, settings, currentUser, can, toast, logAction, setMovements, movements, dbProductMap } = useStore();
  const [draft, setDraft] = useState<DraftOrder>(EMPTY_DRAFT);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<string>('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [invoiceDiscount, setInvoiceDiscount] = useState(0);
  const [editingLine, setEditingLine] = useState<CartLine | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [productPicker, setProductPicker] = useState<Product | null>(null);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // ----- Filter products (only sellable) -----
  const sellable = useMemo(
    () => products.filter((p) => p.active && p.type !== 'raw'),
    [products],
  );

  const filtered = useMemo(() => {
    let r = sellable;
    if (activeCat !== 'all') {
      const childIds = categories.filter((c) => c.parentId === activeCat).map((c) => c.id);
      r = r.filter((p) => p.categoryId === activeCat || childIds.includes(p.categoryId));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
    }
    return r;
  }, [sellable, activeCat, categories, search]);

  const rootCats = categories.filter((c) => !c.parentId);

  // ----- Cart calculations -----
  const subtotal = useMemo(() => cart.reduce((s, l) => s + l.lineTotal, 0), [cart]);
  const taxable = Math.max(0, subtotal - invoiceDiscount);
  const taxAmount = settings.taxInclusive
    ? Math.round((taxable - taxable / (1 + settings.taxRate / 100)) * 100) / 100
    : Math.round(taxable * (settings.taxRate / 100) * 100) / 100;
  const total = settings.taxInclusive ? taxable : Math.round((taxable + taxAmount) * 100) / 100;
  const totalItems = cart.reduce((s, l) => s + l.qty, 0);

  // ----- Add to cart -----
  const addToCart = useCallback((product: Product, sizeId?: string, addons?: {id:string;name:string;price:number}[], note?: string) => {
    const size: ProductSize = product.sizes.find((s) => s.id === (sizeId ?? product.sizes[0].id)) ?? product.sizes[0];
    const addonTotal = (addons ?? []).reduce((s, a) => s + a.price, 0);
    const unitPrice = size.price + addonTotal;
    const lineTotal = Math.round(unitPrice * 100) / 100;

    // Check if same line exists (same product+size+addons+note)
    const existingIdx = cart.findIndex((l) =>
      l.productId === product.id && l.sizeId === size.id &&
      l.note === (note ?? '') &&
      l.addons.length === (addons?.length ?? 0) &&
      (addons ?? []).every((a) => l.addons.some((la) => la.id === a.id))
    );

    if (existingIdx >= 0) {
      setCart((prev) => prev.map((l, i) =>
        i === existingIdx
          ? { ...l, qty: l.qty + 1, lineTotal: Math.round((l.unitPrice) * (l.qty + 1) * 100) / 100 }
          : l
      ));
    } else {
      const newLine: CartLine = {
        id: uid2('ln'),
        productId: product.id,
        productName: product.name,
        sizeId: size.id,
        sizeName: size.name,
        unitPrice,
        qty: 1,
        note,
        addons: addons ?? [],
        lineDiscount: 0,
        lineTotal,
      };
      setCart((prev) => [...prev, newLine]);
    }
  }, [cart]);

  const openProductPicker = (product: Product) => {
    if (product.sizes.length > 1 || product.addonGroups.length > 0) {
      setProductPicker(product);
    } else {
      addToCart(product);
    }
  };

  const changeQty = (lineId: string, delta: number) => {
    setCart((prev) => prev.map((l) => {
      if (l.id !== lineId) return l;
      const qty = Math.max(1, l.qty + delta);
      return { ...l, qty, lineTotal: Math.round(l.unitPrice * qty * 100) / 100 };
    }));
  };

  const removeLine = (lineId: string) => {
    setCart((prev) => prev.filter((l) => l.id !== lineId));
  };

  const clearCart = () => {
    setCart([]);
    setInvoiceDiscount(0);
    setDraft(EMPTY_DRAFT);
  };

  // ----- Order type tabs -----
  const setOrderType = (type: OrderType) => {
    setDraft((d) => ({ ...d, type, deliveryKind: type === 'delivery' ? (d.deliveryKind ?? 'restaurant') : undefined }));
  };

  // ----- Checkout -----
  const completeOrder = (payments: PaymentSplit[], isCredit: boolean) => {
    if (!currentUser) return;
    const order: Order = {
      id: uid2('o'),
      number: String(1000 + orders.length + 1),
      type: draft.type,
      deliveryKind: draft.deliveryKind,
      tableNumber: draft.tableNumber,
      customerName: draft.customerName,
      customerPhone: draft.customerPhone,
      deliveryAddress: draft.deliveryAddress,
      status: 'paid',
      lines: cart,
      subtotal: Math.round(subtotal * 100) / 100,
      discount: invoiceDiscount,
      taxAmount,
      total,
      paid: isCredit ? 0 : total,
      payments: isCredit ? [] : payments,
      isCredit,
      cashierId: currentUser.id,
      cashierName: currentUser.name,
      createdAt: new Date().toISOString(),
      paidAt: new Date().toISOString(),
    };
    setOrders((prev) => [order, ...prev]);

    // Deduct stock
    setMovements((prev) => {
      const newMovs = cart.map((l) => ({
        id: uid2('sm'),
        productId: l.productId,
        productName: l.productName,
        type: 'sale' as const,
        qty: -l.qty,
        ref: `#${order.number}`,
        userId: currentUser.id,
        userName: currentUser.name,
        createdAt: new Date().toISOString(),
      }));
      return [...newMovs, ...prev];
    });

    logAction('بيع', `#${order.number}`, undefined, money(total, settings.currency));
    toast('success', `تم إتمام الطلب #${order.number} بنجاح`);
    setLastOrder(order);
    setPayOpen(false);
    clearCart();

    // Persist to Supabase (fire-and-forget; surface error via toast)
    saveOrderToDb(order, products, dbProductMap).then((res) => {
      if (!res.success) {
        toast('error', 'تعذّر حفظ الطلب في قاعدة البيانات');
      }
    });
  };

  const sendToKitchen = () => {
    if (cart.length === 0) return;
    toast('info', 'تم إرسال الطلب إلى شاشة المطبخ');
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-7rem)]">
      {/* Left: products */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Order type tabs */}
        <div className="flex items-center gap-2 mb-3">
          {([
            { t: 'dine_in', label: 'صالة', icon: <UtensilsCrossed size={18} /> },
            { t: 'takeaway', label: 'تيك أواي', icon: <ShoppingBag size={18} /> },
            { t: 'delivery', label: 'ديليفري', icon: <Bike size={18} /> },
          ] as const).map((tab) => (
            <button
              key={tab.t}
              onClick={() => setOrderType(tab.t)}
              className={`btn px-4 py-2.5 flex-1 sm:flex-none
                ${draft.type === tab.t
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'bg-white border border-ink-200 text-ink-600 hover:bg-ink-50'}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
          <div className="flex-1" />
          <div className="hidden sm:flex bg-white rounded-xl border border-ink-200 p-1">
            <button onClick={() => setView('grid')} className={`p-2 rounded-lg ${view==='grid'?'bg-primary-50 text-primary-700':'text-ink-400'}`}>
              <div className="grid grid-cols-2 gap-0.5 w-4 h-4">
                <div className="bg-current rounded-sm" /><div className="bg-current rounded-sm" />
                <div className="bg-current rounded-sm" /><div className="bg-current rounded-sm" />
              </div>
            </button>
            <button onClick={() => setView('list')} className={`p-2 rounded-lg ${view==='list'?'bg-primary-50 text-primary-700':'text-ink-400'}`}>
              <div className="flex flex-col gap-0.5 w-4 h-4 justify-center">
                <div className="bg-current h-0.5 rounded" /><div className="bg-current h-0.5 rounded" /><div className="bg-current h-0.5 rounded" />
              </div>
            </button>
          </div>
        </div>

        {/* Delivery kind sub-options */}
        {draft.type === 'delivery' && (
          <div className="flex items-center gap-2 mb-3 animate-slide-down">
            <button
              onClick={() => setDraft((d) => ({ ...d, deliveryKind: 'restaurant' }))}
              className={`chip ${draft.deliveryKind === 'restaurant' ? 'bg-primary-600 text-white' : 'bg-white border border-ink-200 text-ink-600'}`}
            >دليفري المطعم</button>
            <button
              onClick={() => setDraft((d) => ({ ...d, deliveryKind: 'external' }))}
              className={`chip ${draft.deliveryKind === 'external' ? 'bg-primary-600 text-white' : 'bg-white border border-ink-200 text-ink-600'}`}
            >طلبات خارجية</button>
          </div>
        )}

        {/* Search + categories */}
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              className="input pr-10"
              placeholder="ابحث باسم الصنف أو الكود..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveCat('all')}
            className={`chip shrink-0 ${activeCat === 'all' ? 'bg-primary-600 text-white' : 'bg-white border border-ink-200 text-ink-600'}`}
          >الكل</button>
          {rootCats.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`chip shrink-0 ${activeCat === c.id ? 'bg-primary-600 text-white' : 'bg-white border border-ink-200 text-ink-600'}`}
            >{c.name}</button>
          ))}
        </div>

        {/* Products grid */}
        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {view === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5">
              {filtered.map((p) => {
                const price = p.sizes[0]?.price ?? 0;
                const out = p.trackStock && p.available <= 0;
                return (
                  <button
                    key={p.id}
                    disabled={out}
                    onClick={() => openProductPicker(p)}
                    className="card p-3 text-right hover:shadow-cardHover hover:border-primary-200 transition-all
                               active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100 group"
                  >
                    <div className="aspect-square rounded-xl bg-gradient-to-br from-primary-50 to-secondary-50
                                    flex items-center justify-center mb-2.5 relative overflow-hidden">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-3xl font-bold text-primary-300 group-hover:scale-110 transition-transform">
                          {p.name.charAt(0)}
                        </span>
                      )}
                      {out && (
                        <div className="absolute inset-0 bg-ink-900/60 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">نفذ المخزون</span>
                        </div>
                      )}
                      {p.sizes.length > 1 && (
                        <span className="absolute top-1.5 left-1.5 chip bg-white/90 text-ink-600 text-[10px]">
                          {p.sizes.length} أحجام
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-ink-800 leading-tight line-clamp-1">{p.name}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-ink-400 nums">كود: {p.code}</span>
                      <span className="text-sm font-bold text-primary-600 nums">{money(price, settings.currency)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((p) => {
                const price = p.sizes[0]?.price ?? 0;
                const out = p.trackStock && p.available <= 0;
                return (
                  <button
                    key={p.id}
                    disabled={out}
                    onClick={() => openProductPicker(p)}
                    className="card w-full p-3 flex items-center gap-3 text-right hover:border-primary-200 transition
                               disabled:opacity-50 active:scale-[0.98]"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center text-primary-400 font-bold shrink-0">
                      {p.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink-800 truncate">{p.name}</p>
                      <p className="text-xs text-ink-400 nums">{p.code} · متاح: {fmt(p.available, 0)}</p>
                    </div>
                    <span className="font-bold text-primary-600 nums">{money(price, settings.currency)}</span>
                  </button>
                );
              })}
            </div>
          )}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center py-16 text-ink-400">
              <Search size={32} />
              <p className="mt-2 text-sm">لا توجد أصناف مطابقة</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: cart */}
      <div className="lg:w-[380px] xl:w-[400px] shrink-0 flex flex-col card max-h-full">
        {/* Cart header */}
        <div className="flex items-center justify-between p-4 border-b border-ink-100">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-primary-600" />
            <h3 className="font-bold text-ink-800">السلة</h3>
            {totalItems > 0 && <span className="chip bg-primary-50 text-primary-700 nums">{totalItems}</span>}
          </div>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-error-500 hover:text-error-700 text-sm font-semibold flex items-center gap-1">
              <Trash2 size={15} /> تفريغ
            </button>
          )}
        </div>

        {/* Order context fields */}
        <div className="p-3 border-b border-ink-100 space-y-2">
          {draft.type === 'dine_in' && (
            <input
              className="input"
              placeholder="رقم الترابيزة (اختياري)"
              value={draft.tableNumber ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, tableNumber: e.target.value }))}
            />
          )}
          {draft.type === 'delivery' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <input className="input" placeholder="اسم العميل"
                  value={draft.customerName ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, customerName: e.target.value }))} />
                <input className="input" placeholder="الهاتف"
                  value={draft.customerPhone ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, customerPhone: e.target.value }))} />
              </div>
              <input className="input" placeholder="عنوان التوصيل"
                value={draft.deliveryAddress ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, deliveryAddress: e.target.value }))} />
            </>
          )}
          {(draft.type === 'takeaway' || draft.type === 'delivery') && (
            <input
              className="input"
              placeholder="اسم العميل (اختياري)"
              value={draft.customerName ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, customerName: e.target.value }))}
            />
          )}
        </div>

        {/* Cart lines */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-ink-300">
              <ShoppingCart size={40} />
              <p className="mt-3 text-sm font-medium">السلة فارغة</p>
              <p className="text-xs text-ink-400 mt-1">اضغط على صنف لإضافته</p>
            </div>
          ) : (
            cart.map((l) => (
              <div key={l.id} className="rounded-xl border border-ink-100 p-2.5 hover:border-primary-200 transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-800 truncate">{l.productName}</p>
                    <p className="text-xs text-ink-400">{l.sizeName}</p>
                    {l.addons.length > 0 && (
                      <p className="text-xs text-secondary-600 mt-0.5">
                        + {l.addons.map((a) => a.name).join('، ')}
                      </p>
                    )}
                    {l.note && (
                      <p className="text-xs text-warning-600 mt-0.5 flex items-center gap-1">
                        <StickyNote size={11} /> {l.note}
                      </p>
                    )}
                  </div>
                  <button onClick={() => removeLine(l.id)} className="text-ink-300 hover:text-error-500 p-0.5">
                    <X size={16} />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => changeQty(l.id, -1)} className="w-7 h-7 rounded-lg bg-ink-100 hover:bg-ink-200 flex items-center justify-center text-ink-600">
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-sm font-bold nums">{l.qty}</span>
                    <button onClick={() => changeQty(l.id, 1)} className="w-7 h-7 rounded-lg bg-primary-50 hover:bg-primary-100 flex items-center justify-center text-primary-700">
                      <Plus size={14} />
                    </button>
                  </div>
                  <button onClick={() => setEditingLine(l)} className="text-xs text-ink-400 hover:text-primary-600 font-semibold">
                    تعديل
                  </button>
                  <span className="text-sm font-bold text-ink-800 nums">{money(l.lineTotal, settings.currency)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart totals + actions */}
        {cart.length > 0 && (
          <div className="border-t border-ink-100 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-500">الإجمالي الفرعي</span>
              <span className="font-semibold nums text-ink-700">{money(subtotal, settings.currency)}</span>
            </div>

            {/* Invoice discount */}
            {can('apply_discounts') && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-500 flex items-center gap-1"><Percent size={14} /> الخصم</span>
                <input
                  type="number"
                  min={0}
                  max={subtotal}
                  value={invoiceDiscount || ''}
                  onChange={(e) => setInvoiceDiscount(Math.max(0, Math.min(subtotal, Number(e.target.value) || 0)))}
                  className="w-24 input py-1.5 text-left nums"
                  placeholder="0"
                />
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-500">الضريبة ({settings.taxRate}٪)</span>
              <span className="font-semibold nums text-ink-600">{money(taxAmount, settings.currency)}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-ink-100">
              <span className="font-bold text-ink-800">الإجمالي</span>
              <span className="text-xl font-bold text-primary-600 nums">{money(total, settings.currency)}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={sendToKitchen} className="btn-outline py-2.5">
                <ChefHat size={18} /> للمطبخ
              </button>
              <button onClick={() => setPayOpen(true)} className="btn-primary py-2.5">
                <CreditCard size={18} /> دفع
              </button>
            </div>
            <button onClick={() => setConfirmCancel(true)} className="btn-ghost w-full text-error-600 hover:bg-error-50 py-2">
              <Trash2 size={16} /> إلغاء الطلب
            </button>
          </div>
        )}
      </div>

      {/* Product picker modal (sizes + addons) */}
      {productPicker && (
        <ProductPicker
          product={productPicker}
          onClose={() => setProductPicker(null)}
          onAdd={(sizeId, addons, note) => {
            addToCart(productPicker, sizeId, addons, note);
            setProductPicker(null);
          }}
          currency={settings.currency}
        />
      )}

      {/* Line editor modal */}
      {editingLine && (
        <LineEditor
          line={editingLine}
          onClose={() => setEditingLine(null)}
          onSave={(updated) => {
            setCart((prev) => prev.map((l) => l.id === updated.id ? updated : l));
            setEditingLine(null);
          }}
          currency={settings.currency}
        />
      )}

      {/* Payment modal */}
      <PaymentModal
        open={payOpen}
        total={total}
        onClose={() => setPayOpen(false)}
        onComplete={completeOrder}
        canCredit={can('credit_sales')}
        currency={settings.currency}
        methods={settings.paymentMethods}
      />

      {/* Invoice / receipt modal */}
      {lastOrder && (
        <InvoiceModal
          order={lastOrder}
          settings={settings}
          onClose={() => setLastOrder(null)}
        />
      )}

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={clearCart}
        title="إلغاء الطلب"
        message="سيتم تفريغ السلة بالكامل. هل أنت متأكد؟"
        confirmLabel="نعم، إلغاء"
        danger
      />
    </div>
  );
}

// ============================================================================
// Product picker — sizes + addons + note
// ============================================================================
function ProductPicker({
  product, onClose, onAdd, currency,
}: {
  product: Product;
  onClose: () => void;
  onAdd: (sizeId: string, addons: {id:string;name:string;price:number}[], note?: string) => void;
  currency: string;
}) {
  const [sizeId, setSizeId] = useState(product.sizes[0]?.id ?? '');
  const [selectedAddons, setSelectedAddons] = useState<Record<string, string[]>>({});
  const [note, setNote] = useState('');

  const toggleAddon = (groupId: string, optId: string, multi: boolean) => {
    setSelectedAddons((prev) => {
      const cur = prev[groupId] ?? [];
      if (multi) {
        return { ...prev, [groupId]: cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId] };
      }
      return { ...prev, [groupId]: cur.includes(optId) ? [] : [optId] };
    });
  };

  const addonList: {id:string;name:string;price:number}[] = [];
  product.addonGroups.forEach((g) => {
    (selectedAddons[g.id] ?? []).forEach((optId) => {
      const opt = g.options.find((o) => o.id === optId);
      if (opt) addonList.push({ id: opt.id, name: opt.name, price: opt.price });
    });
  });

  const size = product.sizes.find((s) => s.id === sizeId);
  const addonTotal = addonList.reduce((s, a) => s + a.price, 0);
  const total = (size?.price ?? 0) + addonTotal;

  return (
    <Modal
      open
      onClose={onClose}
      title={product.name}
      size="md"
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>إلغاء</button>
          <button className="btn-primary" onClick={() => onAdd(sizeId, addonList, note.trim() || undefined)}>
            <Plus size={18} /> إضافة — {money(total, currency)}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Sizes */}
        {product.sizes.length > 1 && (
          <div>
            <label className="label">الحجم</label>
            <div className="grid grid-cols-3 gap-2">
              {product.sizes.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSizeId(s.id)}
                  className={`rounded-xl border p-3 text-center transition
                    ${sizeId === s.id ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-ink-200 text-ink-600 hover:bg-ink-50'}`}
                >
                  <p className="text-sm font-bold">{s.name}</p>
                  <p className="text-xs nums mt-0.5">{money(s.price, currency)}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Addon groups */}
        {product.addonGroups.map((g) => (
          <div key={g.id}>
            <label className="label">
              {g.name}
              {g.required && <span className="text-error-500 mr-1">*</span>}
              {g.multi && <span className="text-xs text-ink-400 mr-2">(اختيار متعدد{g.max ? ` — حتى ${g.max}` : ''})</span>}
            </label>
            <div className="space-y-1.5">
              {g.options.map((o) => {
                const sel = (selectedAddons[g.id] ?? []).includes(o.id);
                return (
                  <button
                    key={o.id}
                    onClick={() => toggleAddon(g.id, o.id, g.multi)}
                    className={`w-full rounded-xl border px-3.5 py-2.5 flex items-center justify-between transition
                      ${sel ? 'border-primary-500 bg-primary-50' : 'border-ink-200 hover:bg-ink-50'}`}
                  >
                    <span className="text-sm font-medium text-ink-700">{o.name}</span>
                    <div className="flex items-center gap-2">
                      {o.price > 0 && <span className="text-xs nums text-ink-500">+{money(o.price, currency)}</span>}
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center
                        ${sel ? 'bg-primary-600 border-primary-600' : 'border-ink-300'}`}>
                        {sel && <CheckCircle2 size={14} className="text-white" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Note */}
        <div>
          <label className="label">ملاحظة</label>
          <textarea
            className="input min-h-[60px] resize-none"
            placeholder="مثال: بدون بصل، سبايسي..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// Line editor — qty, note, line discount
// ============================================================================
function LineEditor({
  line, onClose, onSave, currency,
}: {
  line: CartLine;
  onClose: () => void;
  onSave: (l: CartLine) => void;
  currency: string;
}) {
  const [qty, setQty] = useState(line.qty);
  const [note, setNote] = useState(line.note ?? '');
  const [lineDiscount, setLineDiscount] = useState(line.lineDiscount);

  const unitPrice = line.unitPrice;
  const lineTotal = Math.round((unitPrice * qty - lineDiscount) * 100) / 100;

  const save = () => {
    onSave({
      ...line,
      qty: Math.max(1, qty),
      note: note.trim() || undefined,
      lineDiscount: Math.max(0, lineDiscount),
      lineTotal,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`تعديل: ${line.productName}`}
      size="sm"
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>إلغاء</button>
          <button className="btn-primary" onClick={save}>حفظ</button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">الكمية</label>
          <div className="flex items-center gap-2">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-10 h-10 rounded-xl bg-ink-100 flex items-center justify-center">
              <Minus size={18} />
            </button>
            <input type="number" min={1} className="input text-center nums" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
            <button onClick={() => setQty((q) => q + 1)} className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center">
              <Plus size={18} />
            </button>
          </div>
        </div>
        <div>
          <label className="label">خصم على السطر ({currency})</label>
          <input type="number" min={0} className="input nums" value={lineDiscount || ''} onChange={(e) => setLineDiscount(Math.max(0, Number(e.target.value) || 0))} placeholder="0" />
        </div>
        <div>
          <label className="label">ملاحظة</label>
          <textarea className="input min-h-[60px] resize-none" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة خاصة..." />
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-ink-100">
          <span className="text-sm text-ink-500">إجمالي السطر</span>
          <span className="text-lg font-bold text-primary-600 nums">{money(lineTotal, currency)}</span>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// Payment modal — split + credit
// ============================================================================
function PaymentModal({
  open, total, onClose, onComplete, canCredit, currency, methods,
}: {
  open: boolean;
  total: number;
  onClose: () => void;
  onComplete: (payments: PaymentSplit[], isCredit: boolean) => void;
  canCredit: boolean;
  currency: string;
  methods: { id: PaymentMethodId; name: string }[];
}) {
  const [splits, setSplits] = useState<PaymentSplit[]>([{ method: 'cash', amount: total }]);
  const [isCredit, setIsCredit] = useState(false);
  const [customerName, setCustomerName] = useState('');

  const paidTotal = splits.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.round((total - paidTotal) * 100) / 100;

  const updateSplit = (i: number, amount: number) => {
    setSplits((prev) => prev.map((s, idx) => idx === i ? { ...s, amount: Math.max(0, amount) } : s));
  };
  const changeMethod = (i: number, method: PaymentMethodId) => {
    setSplits((prev) => prev.map((s, idx) => idx === i ? { ...s, method } : s));
  };
  const addSplit = () => {
    const used = splits.map((s) => s.method);
    const avail = methods.find((m) => !used.includes(m.id));
    if (avail) setSplits((prev) => [...prev, { method: avail.id, amount: Math.max(0, remaining) }]);
  };
  const removeSplit = (i: number) => {
    setSplits((prev) => prev.filter((_, idx) => idx !== i));
  };
  const quickCash = () => setSplits([{ method: 'cash', amount: total }]);

  // Reset when opened
  useMemo(() => {
    if (open) {
      setSplits([{ method: 'cash', amount: total }]);
      setIsCredit(false);
      setCustomerName('');
    }
  }, [open, total]);

  const canComplete = isCredit ? (canCredit && customerName.trim().length > 0) : remaining <= 0.01;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="الدفع"
      size="md"
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>إلغاء</button>
          <button
            className="btn-primary"
            disabled={!canComplete}
            onClick={() => onComplete(isCredit ? [] : splits, isCredit)}
          >
            <CheckCircle2 size={18} /> تأكيد الدفع
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Total */}
        <div className="rounded-xl bg-primary-50 border border-primary-100 px-4 py-3 flex items-center justify-between">
          <span className="font-semibold text-primary-700">المبلغ المستحق</span>
          <span className="text-2xl font-bold text-primary-700 nums">{money(total, currency)}</span>
        </div>

        {/* Credit toggle */}
      {canCredit && (
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={isCredit} onChange={(e) => setIsCredit(e.target.checked)}
                   className="w-5 h-5 rounded accent-primary-600" />
            <span className="text-sm font-medium text-ink-700">دفع آجل (على الحساب)</span>
          </label>
        )}
      {isCredit && (
          <div className="animate-slide-up">
            <label className="label">اسم العميل</label>
            <input className="input" placeholder="اسم العميل للآجل" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            <p className="text-xs text-warning-600 mt-2">سيُسجّل المبلغ كذمم مستحقة على العميل</p>
          </div>
        )}

        {!isCredit && (
          <>
            {/* Payment splits */}
            <div className="space-y-2.5">
              {splits.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    className="input flex-1"
                    value={s.method}
                    onChange={(e) => changeMethod(i, e.target.value as PaymentMethodId)}
                  >
                    {methods.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="input w-28 text-left nums"
                    value={s.amount || ''}
                    onChange={(e) => updateSplit(i, Number(e.target.value) || 0)}
                    placeholder="0"
                  />
                  {splits.length > 1 && (
                    <button onClick={() => removeSplit(i)} className="text-error-500 p-1.5">
                      <X size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {splits.length < methods.length && (
              <button onClick={addSplit} className="btn-ghost text-primary-600 text-sm">
                <Plus size={16} /> إضافة طريقة دفع أخرى
              </button>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-ink-100">
              <span className="text-sm text-ink-500">المتبقي</span>
              <span className={`text-lg font-bold nums ${remaining > 0.01 ? 'text-error-600' : 'text-success-600'}`}>
                {money(remaining, currency)}
              </span>
            </div>
            {remaining > 0.01 && (
              <button onClick={quickCash} className="btn-outline w-full text-sm py-2">
                دفع كامل بالمبلغ المتبقي نقداً
              </button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

// ============================================================================
// Invoice / receipt modal — printable
// ============================================================================
function InvoiceModal({
  order, settings, onClose,
}: {
  order: Order;
  settings: ReturnType<typeof useStore>['settings'];
  onClose: () => void;
}) {
  return (
    <Modal
      open
      onClose={onClose}
      title="فاتورة الطلب"
      size="sm"
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>إغلاق</button>
          <button className="btn-primary" onClick={() => window.print()}>
            <Printer size={18} /> طباعة
          </button>
        </>
      }
    >
      <div id="print-area" className="bg-white p-4 font-mono text-sm">
        {/* Header */}
        <div className="text-center mb-4 pb-3 border-b border-dashed border-ink-300">
          <p className="text-xl font-bold">{settings.restaurantName}</p>
          <p className="text-xs text-ink-500 mt-1">{settings.address}</p>
          <p className="text-xs text-ink-500">{settings.phone}</p>
        </div>

        {/* Order info */}
        <div className="space-y-1 mb-3 text-xs">
          <div className="flex justify-between"><span>رقم الطلب:</span><span className="nums font-bold">#{order.number}</span></div>
          <div className="flex justify-between"><span>النوع:</span><span>{ORDER_TYPE_LABELS[order.type]}</span></div>
          {order.tableNumber && <div className="flex justify-between"><span>الترابيزة:</span><span className="nums">{order.tableNumber}</span></div>}
          {order.customerName && <div className="flex justify-between"><span>العميل:</span><span>{order.customerName}</span></div>}
          <div className="flex justify-between"><span>الكاشير:</span><span>{order.cashierName}</span></div>
          <div className="flex justify-between"><span>التاريخ:</span><span className="nums">{new Date(order.createdAt).toLocaleString('ar-EG')}</span></div>
        </div>

        {/* Lines */}
        <div className="border-y border-dashed border-ink-300 py-2 mb-3">
          {order.lines.map((l) => (
            <div key={l.id} className="mb-1.5">
              <div className="flex justify-between text-xs">
                <span>{l.qty}× {l.productName} ({l.sizeName})</span>
                <span className="nums">{money(l.lineTotal, settings.currency)}</span>
              </div>
              {l.addons.length > 0 && (
                <p className="text-[10px] text-ink-500 pr-4">+ {l.addons.map((a) => a.name).join('، ')}</p>
              )}
              {l.note && <p className="text-[10px] text-warning-600 pr-4">ملاحظة: {l.note}</p>}
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="space-y-1 text-xs">
          <div className="flex justify-between"><span>الإجمالي الفرعي:</span><span className="nums">{money(order.subtotal, settings.currency)}</span></div>
          {order.discount > 0 && <div className="flex justify-between"><span>الخصم:</span><span className="nums">-{money(order.discount, settings.currency)}</span></div>}
          <div className="flex justify-between"><span>الضريبة ({settings.taxRate}٪):</span><span className="nums">{money(order.taxAmount, settings.currency)}</span></div>
          <div className="flex justify-between text-base font-bold pt-1 border-t border-ink-300 mt-1">
            <span>الإجمالي:</span><span className="nums">{money(order.total, settings.currency)}</span>
          </div>
        </div>

        {/* Payment */}
        <div className="mt-3 pt-2 border-t border-dashed border-ink-300 text-xs">
          {order.isCredit ? (
            <p className="text-warning-700 font-semibold">دفع آجل</p>
          ) : (
            order.payments.map((p, i) => (
              <div key={i} className="flex justify-between">
                <span>{settings.paymentMethods.find((m) => m.id === p.method)?.name ?? p.method}</span>
                <span className="nums">{money(p.amount, settings.currency)}</span>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-4 pt-3 border-t border-dashed border-ink-300">
          <p className="text-xs text-ink-500">{settings.printFooter}</p>
        </div>
      </div>
    </Modal>
  );
}
