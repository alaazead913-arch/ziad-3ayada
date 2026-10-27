import { useState, useMemo } from 'react';
import { useStore } from '@/store';
import type { Purchase, PurchaseLine } from '@/types';
import { money, fmt, fmtDate, todayISO, uid, round2 } from '@/lib/format';
import { PageHeader, Modal, EmptyState, Badge } from '@/components/ui';
import { Plus, Truck, Search, Eye, CheckCircle2, DollarSign, AlertCircle } from 'lucide-react';

export function PurchasesPage() {
  const { purchases, products, settings, can, toast, setPurchases, setProducts, logAction, currentUser } = useStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'received'>('all');
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Purchase | null>(null);

  const filtered = useMemo(() => {
    let r = purchases;
    if (statusFilter !== 'all') r = r.filter((p) => p.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((p) => p.supplierName.toLowerCase().includes(q) || p.number.toLowerCase().includes(q) || p.invoiceRef.toLowerCase().includes(q));
    }
    return [...r].sort((a, b) => b.date.localeCompare(a.date));
  }, [purchases, search, statusFilter]);

  const totalPurchased = purchases.reduce((s, p) => s + p.total, 0);
  const totalRemaining = purchases.reduce((s, p) => s + p.remaining, 0);

  const receivePurchase = (pur: Purchase) => {
    // Update stock + set last purchase cost
    setProducts((prev) => prev.map((prod) => {
      const line = pur.lines.find((l) => l.productId === prod.id);
      if (!line) return prod;
      return { ...prod, available: prod.available + line.qty, baseCost: line.unitCost };
    }));
    setPurchases((prev) => prev.map((p) => p.id === pur.id ? { ...p, status: 'received' } : p));
    logAction('اعتماد مشتريات', pur.number, undefined, undefined, `المورد: ${pur.supplierName}`);
    toast('success', 'تم اعتماد المشتريات وتحديث المخزون والتكلفة');
    setViewing(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="المشتريات" subtitle="فواتير الموردين وتحديث المخزون"
        action={can('manage_purchases') && (
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <Plus size={18} /> فاتورة شراء
          </button>
        )} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'عدد الفواتير', value: fmt(purchases.length, 0), icon: <Truck size={18} />, color: 'text-primary-600 bg-primary-50' },
          { label: 'إجمالي المشتريات', value: money(totalPurchased, settings.currency), icon: <DollarSign size={18} />, color: 'text-secondary-600 bg-secondary-50' },
          { label: 'المتبقي للموردين', value: money(totalRemaining, settings.currency), icon: <AlertCircle size={18} />, color: 'text-warning-600 bg-warning-50' },
          { label: 'فواتير معلقة', value: fmt(purchases.filter((p) => p.status === 'pending').length, 0), icon: <AlertCircle size={18} />, color: 'text-error-600 bg-error-50' },
        ].map((s, i) => (
          <div key={i} className="card p-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.color} mb-2`}>{s.icon}</div>
            <p className="text-xs text-ink-500 font-medium">{s.label}</p>
            <p className="text-xl font-bold text-ink-800 nums">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input className="input pr-10" placeholder="ابحث برقم الفاتورة أو المورد..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-1.5">
          {(['all', 'received', 'pending'] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`chip ${statusFilter === s ? 'bg-primary-600 text-white' : 'bg-ink-100 text-ink-600'}`}>
              {s === 'all' ? 'الكل' : s === 'received' ? 'مستلمة' : 'معلقة'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={<Truck size={26} />} title="لا توجد فواتير" hint="ابدأ بإضافة فاتورة شراء" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-500 text-xs">
                <tr>
                  <th className="text-right font-semibold px-4 py-3">رقم</th>
                  <th className="text-right font-semibold px-4 py-3">المورد</th>
                  <th className="text-right font-semibold px-4 py-3">مرجع الفاتورة</th>
                  <th className="text-right font-semibold px-4 py-3">التاريخ</th>
                  <th className="text-right font-semibold px-4 py-3">الإجمالي</th>
                  <th className="text-right font-semibold px-4 py-3">المدفوع</th>
                  <th className="text-right font-semibold px-4 py-3">المتبقي</th>
                  <th className="text-right font-semibold px-4 py-3">الحالة</th>
                  <th className="text-center font-semibold px-4 py-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="table-row">
                    <td className="px-4 py-3 font-semibold text-ink-800 nums">{p.number}</td>
                    <td className="px-4 py-3 text-ink-700">{p.supplierName}</td>
                    <td className="px-4 py-3 text-ink-500 nums">{p.invoiceRef}</td>
                    <td className="px-4 py-3 text-ink-500 nums">{fmtDate(p.date)}</td>
                    <td className="px-4 py-3 font-semibold text-ink-800 nums">{money(p.total, settings.currency)}</td>
                    <td className="px-4 py-3 text-success-600 nums">{money(p.paid, settings.currency)}</td>
                    <td className="px-4 py-3 text-warning-600 nums">{money(p.remaining, settings.currency)}</td>
                    <td className="px-4 py-3">
                      <Badge className={p.status === 'received' ? 'bg-success-100 text-success-700' : 'bg-warning-100 text-warning-700'}>
                        {p.status === 'received' ? 'مستلمة' : 'معلقة'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => setViewing(p)} className="p-1.5 text-ink-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg">
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create modal */}
      {creating && (
        <PurchaseForm
          products={products.filter((p) => p.type === 'raw' || p.type === 'manufactured')}
          currency={settings.currency}
          onClose={() => setCreating(false)}
          onSave={(pur) => {
            setPurchases((prev) => [pur, ...prev]);
            logAction('إنشاء فاتورة شراء', pur.number);
            toast('success', 'تم إنشاء فاتورة الشراء');
            setCreating(false);
          }}
          nextNumber={`PUR-${String(purchases.length + 1).padStart(4, '0')}`}
          userId={currentUser!.id}
          userName={currentUser!.name}
        />
      )}

      {/* View modal */}
      {viewing && (
        <Modal open onClose={() => setViewing(null)} title={`فاتورة شراء: ${viewing.number}`} size="lg"
          footer={
            viewing.status === 'pending' && can('manage_purchases') ? (
              <button className="btn-primary" onClick={() => receivePurchase(viewing)}>
                <CheckCircle2 size={18} /> اعتماد وتحديث المخزون
              </button>
            ) : <button className="btn-outline" onClick={() => setViewing(null)}>إغلاق</button>
          }>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-ink-400">المورد:</span> <span className="font-semibold">{viewing.supplierName}</span></div>
              <div><span className="text-ink-400">مرجع الفاتورة:</span> <span className="font-semibold nums">{viewing.invoiceRef}</span></div>
              <div><span className="text-ink-400">التاريخ:</span> <span className="font-semibold nums">{fmtDate(viewing.date)}</span></div>
              <div><span className="text-ink-400">المستخدم:</span> <span className="font-semibold">{viewing.userName}</span></div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-ink-100">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 text-ink-500 text-xs">
                  <tr>
                    <th className="text-right font-semibold px-3 py-2.5">الصنف</th>
                    <th className="text-right font-semibold px-3 py-2.5">الكمية</th>
                    <th className="text-right font-semibold px-3 py-2.5">سعر الوحدة</th>
                    <th className="text-left font-semibold px-3 py-2.5">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {viewing.lines.map((l, i) => (
                    <tr key={i} className="table-row">
                      <td className="px-3 py-2.5 font-semibold text-ink-800">{l.productName}</td>
                      <td className="px-3 py-2.5 nums">{fmt(l.qty, 0)}</td>
                      <td className="px-3 py-2.5 nums">{money(l.unitCost, settings.currency)}</td>
                      <td className="px-3 py-2.5 text-left nums font-semibold">{money(l.lineTotal, settings.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end space-y-1 ml-auto w-48 text-sm space-x-0">
              <div className="flex justify-between w-full"><span className="text-ink-500">الإجمالي:</span><span className="font-bold nums">{money(viewing.total, settings.currency)}</span></div>
              <div className="flex justify-between w-full"><span className="text-ink-500">المدفوع:</span><span className="text-success-600 font-bold nums">{money(viewing.paid, settings.currency)}</span></div>
              <div className="flex justify-between w-full"><span className="text-ink-500">المتبقي:</span><span className="text-warning-600 font-bold nums">{money(viewing.remaining, settings.currency)}</span></div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PurchaseForm({
  products, currency, onClose, onSave, nextNumber, userId, userName,
}: {
  products: ReturnType<typeof useStore>['products'];
  currency: string;
  onClose: () => void;
  onSave: (p: Purchase) => void;
  nextNumber: string;
  userId: string;
  userName: string;
}) {
  const [supplierName, setSupplierName] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [date, setDate] = useState(todayISO());
  const [paid, setPaid] = useState(0);
  const [lines, setLines] = useState<PurchaseLine[]>([]);

  const sellableProducts = products;
  const total = lines.reduce((s, l) => s + l.lineTotal, 0);
  const remaining = Math.max(0, total - paid);

  const addLine = () => {
    const prod = sellableProducts.find((p) => !lines.find((l) => l.productId === p.id));
    if (!prod) return;
    setLines((prev) => [...prev, { productId: prod.id, productName: prod.name, qty: 1, unitCost: prod.baseCost, lineTotal: prod.baseCost }]);
  };
  const updateLine = (i: number, field: 'qty' | 'unitCost', val: number) => {
    setLines((prev) => prev.map((l, idx) => {
      if (idx !== i) return l;
      const updated = { ...l, [field]: Math.max(0, val) };
      updated.lineTotal = round2(updated.qty * updated.unitCost);
      return updated;
    }));
  };
  const changeProduct = (i: number, prodId: string) => {
    const prod = sellableProducts.find((p) => p.id === prodId);
    if (!prod) return;
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, productId: prod.id, productName: prod.name, unitCost: prod.baseCost, lineTotal: round2(l.qty * prod.baseCost) } : l));
  };
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  const save = () => {
    if (!supplierName.trim() || lines.length === 0) return;
    onSave({
      id: `pr_${Date.now()}`, number: nextNumber, supplierName: supplierName.trim(),
      invoiceRef: invoiceRef.trim() || '—', date, lines,
      total: round2(total), paid: Math.min(paid, total), remaining: round2(remaining),
      status: 'pending', userId, userName,
    });
  };

  return (
    <Modal open onClose={onClose} title="فاتورة شراء جديدة" size="xl"
      footer={<>
        <button className="btn-outline" onClick={onClose}>إلغاء</button>
        <button className="btn-primary" disabled={!supplierName.trim() || lines.length === 0} onClick={save}>حفظ الفاتورة</button>
      </>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="label">اسم المورد</label>
            <input className="input" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="اسم المورد..." />
          </div>
          <div>
            <label className="label">مرجع الفاتورة</label>
            <input className="input nums" value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} placeholder="INV-..." />
          </div>
          <div>
            <label className="label">التاريخ</label>
            <input type="date" className="input nums" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        {/* Lines */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">أصناف الفاتورة</label>
            <button onClick={addLine} className="btn-ghost text-primary-600 text-sm"><Plus size={16} /> إضافة صنف</button>
          </div>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <select className="input flex-1" value={l.productId} onChange={(e) => changeProduct(i, e.target.value)}>
                  {sellableProducts.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                </select>
                <input type="number" min={0} className="input w-20 nums" value={l.qty} onChange={(e) => updateLine(i, 'qty', Number(e.target.value) || 0)} placeholder="كمية" />
                <input type="number" min={0} className="input w-24 nums" value={l.unitCost} onChange={(e) => updateLine(i, 'unitCost', Number(e.target.value) || 0)} placeholder="سعر" />
                <span className="w-24 text-left text-sm font-semibold nums">{money(l.lineTotal, currency)}</span>
                <button onClick={() => removeLine(i)} className="text-error-500 p-1">×</button>
              </div>
            ))}
            {lines.length === 0 && <p className="text-sm text-ink-400 text-center py-4">أضف أصناف للفاتورة</p>}
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-ink-100">
          <div className="rounded-xl bg-ink-50 p-3 text-center">
            <p className="text-xs text-ink-500">الإجمالي</p>
            <p className="text-lg font-bold text-ink-800 nums">{money(total, currency)}</p>
          </div>
          <div>
            <label className="label">المدفوع</label>
            <input type="number" min={0} max={total} className="input nums" value={paid || ''} onChange={(e) => setPaid(Math.min(total, Number(e.target.value) || 0))} />
          </div>
          <div className="rounded-xl bg-warning-50 p-3 text-center">
            <p className="text-xs text-warning-600">المتبقي</p>
            <p className="text-lg font-bold text-warning-700 nums">{money(remaining, currency)}</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
