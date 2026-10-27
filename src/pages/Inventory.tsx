import { useState, useMemo } from 'react';
import { useStore } from '@/store';
import type { StockMovement } from '@/types';
import { money, fmt, fmtDateTime, todayISO } from '@/lib/format';
import { PageHeader, Modal, EmptyState, Badge } from '@/components/ui';
import {
  Search, Boxes, AlertTriangle, ArrowDownUp,
  TrendingDown, Package, ClipboardList,
} from 'lucide-react';

const MOVEMENT_COLORS: Record<string, string> = {
  purchase: 'bg-secondary-100 text-secondary-700',
  sale: 'bg-primary-100 text-primary-700',
  adjustment: 'bg-warning-100 text-warning-700',
  waste: 'bg-error-100 text-error-700',
  return: 'bg-accent-100 text-accent-700',
};
const MOVEMENT_LABELS: Record<string, string> = {
  purchase: 'مشتريات', sale: 'بيع', adjustment: 'تسوية', waste: 'هالك', return: 'مرتجع',
};

export function InventoryPage() {
  const { products, movements, settings, can, toast, setProducts, setMovements, logAction, currentUser } = useStore();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'stock' | 'movements' | 'adjust'>('stock');
  const [adjustTarget, setAdjustTarget] = useState<typeof products[0] | null>(null);
  const [wasteTarget, setWasteTarget] = useState<typeof products[0] | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  }, [products, search]);

  const stockValue = products.reduce((s, p) => s + p.baseCost * p.available, 0);
  const lowStock = products.filter((p) => p.trackStock && p.available <= settings.lowStockThreshold && p.type !== 'raw');

  return (
    <div className="space-y-5">
      <PageHeader title="المخزون والجرد" subtitle="إدارة الكميات وحركات المخزون والتسويات" />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'قيمة المخزون', value: money(stockValue, settings.currency), icon: <Boxes size={18} />, color: 'text-primary-600 bg-primary-50' },
          { label: 'عدد الأصناف', value: fmt(products.length, 0), icon: <Package size={18} />, color: 'text-secondary-600 bg-secondary-50' },
          { label: 'تنبيهات نقص', value: fmt(lowStock.length, 0), icon: <AlertTriangle size={18} />, color: 'text-warning-600 bg-warning-50' },
          { label: 'حركات اليوم', value: fmt(movements.filter((m) => m.createdAt.slice(0,10) === todayISO()).length, 0), icon: <ArrowDownUp size={18} />, color: 'text-accent-600 bg-accent-50' },
        ].map((s, i) => (
          <div key={i} className="card p-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.color} mb-2`}>{s.icon}</div>
            <p className="text-xs text-ink-500 font-medium">{s.label}</p>
            <p className="text-xl font-bold text-ink-800 nums">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5">
        {([
          { k: 'stock', l: 'الأصناف', icon: <Package size={16} /> },
          { k: 'movements', l: 'حركات المخزون', icon: <ArrowDownUp size={16} /> },
          { k: 'adjust', l: 'جرد وتسوية', icon: <ClipboardList size={16} /> },
        ] as const).map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`btn px-4 py-2 ${tab === t.k ? 'bg-primary-600 text-white' : 'bg-white border border-ink-200 text-ink-600'}`}>
            {t.icon} {t.l}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="card p-3">
        <div className="relative">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input className="input pr-10" placeholder="ابحث عن صنف..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Stock table */}
      {tab === 'stock' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-500 text-xs">
                <tr>
                  <th className="text-right font-semibold px-4 py-3">الصنف</th>
                  <th className="text-right font-semibold px-4 py-3">الكود</th>
                  <th className="text-right font-semibold px-4 py-3">الكمية</th>
                  <th className="text-right font-semibold px-4 py-3">التكلفة</th>
                  <th className="text-right font-semibold px-4 py-3">القيمة</th>
                  <th className="text-right font-semibold px-4 py-3">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const low = p.trackStock && p.available <= settings.lowStockThreshold && p.type !== 'raw';
                  const value = p.baseCost * p.available;
                  return (
                    <tr key={p.id} className="table-row">
                      <td className="px-4 py-3 font-semibold text-ink-800">{p.name}</td>
                      <td className="px-4 py-3 text-ink-500 nums">{p.code}</td>
                      <td className="px-4 py-3 nums font-semibold">{fmt(p.available, 0)}</td>
                      <td className="px-4 py-3 text-ink-600 nums">{money(p.baseCost, settings.currency)}</td>
                      <td className="px-4 py-3 text-ink-800 nums font-semibold">{money(value, settings.currency)}</td>
                      <td className="px-4 py-3">
                        {low ? <Badge className="bg-warning-100 text-warning-700"><AlertTriangle size={12} /> منخفض</Badge>
                             : p.available <= 0 ? <Badge className="bg-error-100 text-error-700">نفذ</Badge>
                             : <Badge className="bg-success-100 text-success-700">متوفر</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Movements table */}
      {tab === 'movements' && (
        <div className="card overflow-hidden">
          {movements.length === 0 ? (
            <EmptyState icon={<ArrowDownUp size={26} />} title="لا توجد حركات" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 text-ink-500 text-xs">
                  <tr>
                    <th className="text-right font-semibold px-4 py-3">الصنف</th>
                    <th className="text-right font-semibold px-4 py-3">النوع</th>
                    <th className="text-right font-semibold px-4 py-3">الكمية</th>
                    <th className="text-right font-semibold px-4 py-3">المرجع</th>
                    <th className="text-right font-semibold px-4 py-3">السبب</th>
                    <th className="text-right font-semibold px-4 py-3">المستخدم</th>
                    <th className="text-right font-semibold px-4 py-3">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="table-row">
                      <td className="px-4 py-3 font-semibold text-ink-800">{m.productName}</td>
                      <td className="px-4 py-3"><Badge className={MOVEMENT_COLORS[m.type]}>{MOVEMENT_LABELS[m.type]}</Badge></td>
                      <td className={`px-4 py-3 nums font-semibold ${m.qty > 0 ? 'text-success-600' : 'text-error-600'}`}>
                        {m.qty > 0 ? '+' : ''}{fmt(m.qty, 2)}
                      </td>
                      <td className="px-4 py-3 text-ink-500 nums">{m.ref ?? '—'}</td>
                      <td className="px-4 py-3 text-ink-600">{m.reason ?? '—'}</td>
                      <td className="px-4 py-3 text-ink-600">{m.userName}</td>
                      <td className="px-4 py-3 text-ink-500 nums text-xs">{fmtDateTime(m.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Adjust tab */}
      {tab === 'adjust' && can('manage_inventory') && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-500 text-xs">
                <tr>
                  <th className="text-right font-semibold px-4 py-3">الصنف</th>
                  <th className="text-right font-semibold px-4 py-3">الكمية الحالية</th>
                  <th className="text-center font-semibold px-4 py-3">تسوية</th>
                  <th className="text-center font-semibold px-4 py-3">هالك</th>
                </tr>
              </thead>
              <tbody>
                {filtered.filter((p) => p.trackStock).map((p) => (
                  <tr key={p.id} className="table-row">
                    <td className="px-4 py-3 font-semibold text-ink-800">{p.name}</td>
                    <td className="px-4 py-3 nums font-semibold">{fmt(p.available, 0)}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => setAdjustTarget(p)} className="btn-outline py-1.5 px-3 text-xs">
                        <ArrowDownUp size={14} /> تسوية
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => setWasteTarget(p)} className="btn bg-error-50 text-error-700 hover:bg-error-100 py-1.5 px-3 text-xs">
                        <TrendingDown size={14} /> هالك
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjust modal */}
      {adjustTarget && (
        <AdjustModal
          product={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onConfirm={(newQty, reason) => {
            const diff = newQty - adjustTarget.available;
            setProducts((prev) => prev.map((p) => p.id === adjustTarget.id ? { ...p, available: newQty } : p));
            setMovements((prev) => [{
              id: `sm_${Date.now()}`, productId: adjustTarget.id, productName: adjustTarget.name,
              type: 'adjustment', qty: diff, reason, userId: currentUser!.id, userName: currentUser!.name,
              createdAt: new Date().toISOString(),
            } as StockMovement, ...prev]);
            logAction('تسوية جرد', adjustTarget.name, String(adjustTarget.available), String(newQty), reason);
            toast('success', 'تم تسوية المخزون');
            setAdjustTarget(null);
          }}
        />
      )}

      {/* Waste modal */}
      {wasteTarget && (
        <WasteModal
          product={wasteTarget}
          onClose={() => setWasteTarget(null)}
          onConfirm={(qty, reason) => {
            setProducts((prev) => prev.map((p) => p.id === wasteTarget.id ? { ...p, available: p.available - qty } : p));
            setMovements((prev) => [{
              id: `sm_${Date.now()}`, productId: wasteTarget.id, productName: wasteTarget.name,
              type: 'waste', qty: -qty, reason, userId: currentUser!.id, userName: currentUser!.name,
              createdAt: new Date().toISOString(),
            } as StockMovement, ...prev]);
            logAction('تسجيل هالك', wasteTarget.name, undefined, `-${qty}`, reason);
            toast('success', 'تم تسجيل الهالك وخصمه من المخزون');
            setWasteTarget(null);
          }}
        />
      )}
    </div>
  );
}

function AdjustModal({
  product, onClose, onConfirm,
}: {
  product: { id: string; name: string; available: number };
  onClose: () => void;
  onConfirm: (newQty: number, reason: string) => void;
}) {
  const [newQty, setNewQty] = useState(product.available);
  const [reason, setReason] = useState('');
  const diff = newQty - product.available;

  return (
    <Modal open onClose={onClose} title={`تسوية مخزون: ${product.name}`} size="sm"
      footer={<>
        <button className="btn-outline" onClick={onClose}>إلغاء</button>
        <button className="btn-primary" disabled={!reason.trim()} onClick={() => onConfirm(newQty, reason.trim())}>تأكيد التسوية</button>
      </>}>
      <div className="space-y-4">
        <div className="rounded-xl bg-ink-50 p-3 text-sm">
          <div className="flex justify-between"><span className="text-ink-500">الكمية الحالية:</span><span className="nums font-bold">{fmt(product.available, 0)}</span></div>
          <div className="flex justify-between mt-1"><span className="text-ink-500">الفرق:</span><span className={`nums font-bold ${diff > 0 ? 'text-success-600' : diff < 0 ? 'text-error-600' : 'text-ink-600'}`}>{diff > 0 ? '+' : ''}{fmt(diff, 0)}</span></div>
        </div>
        <div>
          <label className="label">الكمية الجديدة</label>
          <input type="number" className="input nums" value={newQty} onChange={(e) => setNewQty(Number(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label">سبب التسوية</label>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: جرد فعلي، خطأ إدخال..." />
        </div>
      </div>
    </Modal>
  );
}

function WasteModal({
  product, onClose, onConfirm,
}: {
  product: { id: string; name: string; available: number };
  onClose: () => void;
  onConfirm: (qty: number, reason: string) => void;
}) {
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState('');

  return (
    <Modal open onClose={onClose} title={`تسجيل هالك: ${product.name}`} size="sm"
      footer={<>
        <button className="btn-outline" onClick={onClose}>إلغاء</button>
        <button className="btn bg-error-600 text-white hover:bg-error-700 px-4 py-2.5" disabled={!reason.trim() || qty <= 0} onClick={() => onConfirm(qty, reason.trim())}>تأكيد الهالك</button>
      </>}>
      <div className="space-y-4">
        <div className="rounded-xl bg-error-50 border border-error-100 p-3 text-sm text-error-700">
          سيتم خصم الكمية من المخزون وتسجيلها كهالك/تالف.
        </div>
        <div>
          <label className="label">الكمية الهالكة</label>
          <input type="number" min={0} max={product.available} className="input nums" value={qty || ''} onChange={(e) => setQty(Math.min(product.available, Number(e.target.value) || 0))} />
        </div>
        <div>
          <label className="label">السبب</label>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: انتهاء صلاحية، تلف..." />
        </div>
      </div>
    </Modal>
  );
}
