import { useState, useMemo } from 'react';
import { useStore } from '@/store';
import type { Product, ItemType } from '@/types';
import { money, fmt, uid, ALL_PERMISSIONS, ROLE_LABELS } from '@/lib/format';
import { PageHeader, Modal, ConfirmDialog, EmptyState, Badge } from '@/components/ui';
import {
  Plus, Search, Pencil, Trash2, Package, Boxes, AlertTriangle,
  Tag, Layers, DollarSign,
} from 'lucide-react';

const TYPE_LABELS: Record<ItemType, string> = {
  raw: 'خام', manufactured: 'مصنع', ready: 'جاهز',
};
const TYPE_COLORS: Record<ItemType, string> = {
  raw: 'bg-ink-100 text-ink-600',
  manufactured: 'bg-secondary-100 text-secondary-700',
  ready: 'bg-accent-100 text-accent-700',
};

export function ProductsPage() {
  const { products, categories, settings, can, toast, setProducts, logAction } = useStore();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    let r = products;
    if (typeFilter !== 'all') r = r.filter((p) => p.type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
    }
    return r;
  }, [products, typeFilter, search]);

  const handleSave = (product: Product) => {
    if (editing) {
      const before = products.find((p) => p.id === editing.id);
      setProducts((prev) => prev.map((p) => p.id === product.id ? product : p));
      logAction('تعديل صنف', product.name, before ? JSON.stringify({ price: before.sizes[0]?.price }) : undefined, JSON.stringify({ price: product.sizes[0]?.price }));
      toast('success', 'تم تحديث الصنف');
    } else {
      setProducts((prev) => [product, ...prev]);
      logAction('إضافة صنف', product.name);
      toast('success', 'تم إضافة الصنف');
    }
    setEditing(null);
    setCreating(false);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    logAction('حذف صنف', deleteTarget.name);
    toast('success', 'تم حذف الصنف');
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="إدارة الأصناف"
        subtitle={`${products.length} صنف`}
        action={can('manage_settings') && (
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <Plus size={18} /> صنف جديد
          </button>
        )}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي الأصناف', value: fmt(products.length, 0), icon: <Package size={18} />, color: 'text-primary-600 bg-primary-50' },
          { label: 'جاهزة للبيع', value: fmt(products.filter((p) => p.type === 'ready').length, 0), icon: <Tag size={18} />, color: 'text-accent-600 bg-accent-50' },
          { label: 'مصنعة', value: fmt(products.filter((p) => p.type === 'manufactured').length, 0), icon: <Layers size={18} />, color: 'text-secondary-600 bg-secondary-50' },
          { label: 'تحت حد التنبيه', value: fmt(products.filter((p) => p.trackStock && p.available <= settings.lowStockThreshold && p.type !== 'raw').length, 0), icon: <AlertTriangle size={18} />, color: 'text-warning-600 bg-warning-50' },
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
          <input className="input pr-10" placeholder="ابحث باسم الصنف أو الكود..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-1.5">
          {['all', 'ready', 'manufactured', 'raw'].map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`chip ${typeFilter === t ? 'bg-primary-600 text-white' : 'bg-ink-100 text-ink-600'}`}>
              {t === 'all' ? 'الكل' : TYPE_LABELS[t as ItemType]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={<Package size={26} />} title="لا توجد أصناف" hint="ابدأ بإضافة صنف جديد" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-500 text-xs">
                <tr>
                  <th className="text-right font-semibold px-4 py-3">الصنف</th>
                  <th className="text-right font-semibold px-4 py-3">الكود</th>
                  <th className="text-right font-semibold px-4 py-3">القسم</th>
                  <th className="text-right font-semibold px-4 py-3">النوع</th>
                  <th className="text-right font-semibold px-4 py-3">التكلفة</th>
                  <th className="text-right font-semibold px-4 py-3">السعر</th>
                  <th className="text-right font-semibold px-4 py-3">المخزون</th>
                  <th className="text-center font-semibold px-4 py-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const cat = categories.find((c) => c.id === p.categoryId);
                  const price = p.sizes[0]?.price ?? 0;
                  const lowStock = p.trackStock && p.available <= settings.lowStockThreshold && p.type !== 'raw';
                  return (
                    <tr key={p.id} className="table-row">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-primary-50 text-primary-400 flex items-center justify-center font-bold shrink-0">
                            {p.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-ink-800 truncate">{p.name}</p>
                            {p.sizes.length > 1 && <p className="text-xs text-ink-400">{p.sizes.length} أحجام</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-ink-500 nums">{p.code}</td>
                      <td className="px-4 py-3 text-ink-600">{cat?.name ?? '—'}</td>
                      <td className="px-4 py-3"><Badge className={TYPE_COLORS[p.type]}>{TYPE_LABELS[p.type]}</Badge></td>
                      <td className="px-4 py-3 text-ink-600 nums">{money(p.baseCost, settings.currency)}</td>
                      <td className="px-4 py-3 font-semibold text-ink-800 nums">{price > 0 ? money(price, settings.currency) : '—'}</td>
                      <td className="px-4 py-3">
                        {p.trackStock ? (
                          <span className={`nums font-semibold ${lowStock ? 'text-warning-600' : 'text-ink-700'}`}>
                            {fmt(p.available, 0)} {lowStock && <AlertTriangle size={13} className="inline" />}
                          </span>
                        ) : <span className="text-ink-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setEditing(p)} className="p-1.5 text-ink-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition">
                            <Pencil size={16} />
                          </button>
                          {can('manage_settings') && (
                            <button onClick={() => setDeleteTarget(p)} className="p-1.5 text-ink-400 hover:text-error-600 hover:bg-error-50 rounded-lg transition">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit/Create modal */}
      {(editing || creating) && (
        <ProductForm
          product={editing}
          categories={categories}
          settings={settings}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSave={handleSave}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="حذف صنف"
        message={`هل تريد حذف "${deleteTarget?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="حذف"
        danger
      />
    </div>
  );
}

// ============================================================================
// Product form
// ============================================================================
function ProductForm({
  product, categories, settings, onClose, onSave,
}: {
  product: Product | null;
  categories: { id: string; name: string; parentId: string | null }[];
  settings: ReturnType<typeof useStore>['settings'];
  onClose: () => void;
  onSave: (p: Product) => void;
}) {
  const [name, setName] = useState(product?.name ?? '');
  const [code, setCode] = useState(product?.code ?? '');
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? categories[0]?.id ?? '');
  const [type, setType] = useState<ItemType>(product?.type ?? 'ready');
  const [baseCost, setBaseCost] = useState(product?.baseCost ?? 0);
  const [taxRate, setTaxRate] = useState(product?.taxRate ?? settings.taxRate);
  const [available, setAvailable] = useState(product?.available ?? 0);
  const [trackStock, setTrackStock] = useState(product?.trackStock ?? true);
  const [active, setActive] = useState(product?.active ?? true);
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product?.sizes[0]?.price ?? 0);

  const save = () => {
    if (!name.trim() || !code.trim()) return;
    const p: Product = {
      id: product?.id ?? uid2('p'),
      name: name.trim(),
      code: code.trim(),
      description: description.trim() || undefined,
      categoryId,
      type,
      unitId: type === 'ready' ? 'u_pc' : 'u_kg',
      baseCost,
      taxRate,
      available,
      trackStock,
      sizes: [{ id: 's_only', name: 'عادي', price, cost: baseCost, recipe: [] }],
      addonGroups: product?.addonGroups ?? [],
      active,
    };
    onSave(p);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={product ? `تعديل: ${product.name}` : 'صنف جديد'}
      size="lg"
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>إلغاء</button>
          <button className="btn-primary" onClick={save} disabled={!name.trim() || !code.trim()}>
            {product ? 'حفظ' : 'إضافة'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">اسم الصنف</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">الكود</label>
          <input className="input nums" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <div>
          <label className="label">القسم</label>
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">نوع الصنف</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value as ItemType)}>
            {settings.itemTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">التكلفة ({settings.currency})</label>
          <input type="number" className="input nums" value={baseCost || ''} onChange={(e) => setBaseCost(Number(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label">سعر البيع ({settings.currency})</label>
          <input type="number" className="input nums" value={price || ''} onChange={(e) => setPrice(Number(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label">نسبة الضريبة (٪)</label>
          <input type="number" className="input nums" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label">الكمية المتاحة</label>
          <input type="number" className="input nums" value={available || ''} onChange={(e) => setAvailable(Number(e.target.value) || 0)} disabled={!trackStock} />
        </div>
        <div className="col-span-2">
          <label className="label">الوصف</label>
          <textarea className="input min-h-[60px] resize-none" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="col-span-2 flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={trackStock} onChange={(e) => setTrackStock(e.target.checked)} className="w-5 h-5 rounded accent-primary-600" />
            <span className="text-sm font-medium text-ink-700">تتبع المخزون</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-5 h-5 rounded accent-primary-600" />
            <span className="text-sm font-medium text-ink-700">نشط</span>
          </label>
        </div>
      </div>
    </Modal>
  );
}

function uid2(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
