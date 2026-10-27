import { useState, useMemo } from 'react';
import { useStore } from '@/store';
import type { Expense, PaymentMethodId } from '@/types';
import { money, fmt, fmtDate, todayISO } from '@/lib/format';
import { PageHeader, Modal, EmptyState, Badge } from '@/components/ui';
import { Plus, Wallet, Search, Trash2, Receipt, TrendingDown } from 'lucide-react';

const EXPENSE_CATEGORIES = [
  'كهرباء', 'مياه', 'إيجار', 'رواتب', 'صيانة', 'تسويق',
  'مستلزمات', 'غاز', 'نقل', 'ضيافة', 'أخرى',
];

export function ExpensesPage() {
  const { expenses, settings, can, toast, setExpenses, logAction, currentUser } = useStore();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const filtered = useMemo(() => {
    let r = expenses;
    if (catFilter !== 'all') r = r.filter((e) => e.category === catFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((e) => e.category.toLowerCase().includes(q) || e.note?.toLowerCase().includes(q));
    }
    return [...r].sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, search, catFilter]);

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => { map[e.category] = (map[e.category] || 0) + e.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const methodLabel = (m: PaymentMethodId) => settings.paymentMethods.find((p) => p.id === m)?.name ?? m;

  return (
    <div className="space-y-5">
      <PageHeader title="المصروفات" subtitle="تسجيل ومتابعة مصروفات المطعم"
        action={can('manage_expenses') && (
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <Plus size={18} /> مصروف جديد
          </button>
        )} />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-error-600 bg-error-50 mb-2"><Wallet size={18} /></div>
          <p className="text-xs text-ink-500 font-medium">إجمالي المصروفات</p>
          <p className="text-xl font-bold text-ink-800 nums">{money(totalExpenses, settings.currency)}</p>
        </div>
        <div className="card p-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-warning-600 bg-warning-50 mb-2"><Receipt size={18} /></div>
          <p className="text-xs text-ink-500 font-medium">عدد المصروفات</p>
          <p className="text-xl font-bold text-ink-800 nums">{fmt(expenses.length, 0)}</p>
        </div>
        <div className="card p-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-primary-600 bg-primary-50 mb-2"><TrendingDown size={18} /></div>
          <p className="text-xs text-ink-500 font-medium">أعلى بند</p>
          <p className="text-lg font-bold text-ink-800 truncate">{byCategory[0]?.[0] ?? '—'}</p>
        </div>
      </div>

      {/* By category breakdown */}
      {byCategory.length > 0 && (
        <div className="card p-4">
          <h3 className="font-bold text-ink-800 mb-3">المصروفات حسب البند</h3>
          <div className="space-y-2">
            {byCategory.map(([cat, amt], i) => {
              const pct = totalExpenses > 0 ? (amt / totalExpenses) * 100 : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-ink-600 w-24 shrink-0">{cat}</span>
                  <div className="flex-1 h-6 rounded-lg bg-ink-100 overflow-hidden">
                    <div className="h-full bg-error-400 rounded-lg transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm font-bold text-ink-700 nums w-24 text-left">{money(amt, settings.currency)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input className="input pr-10" placeholder="ابحث في المصروفات..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="all">كل البنود</option>
          {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={<Wallet size={26} />} title="لا توجد مصروفات" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-500 text-xs">
                <tr>
                  <th className="text-right font-semibold px-4 py-3">البند</th>
                  <th className="text-right font-semibold px-4 py-3">المبلغ</th>
                  <th className="text-right font-semibold px-4 py-3">طريقة الدفع</th>
                  <th className="text-right font-semibold px-4 py-3">ملاحظة</th>
                  <th className="text-right font-semibold px-4 py-3">المستخدم</th>
                  <th className="text-right font-semibold px-4 py-3">التاريخ</th>
                  <th className="text-center font-semibold px-4 py-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="table-row">
                    <td className="px-4 py-3"><Badge className="bg-error-50 text-error-700">{e.category}</Badge></td>
                    <td className="px-4 py-3 font-bold text-error-600 nums">{money(e.amount, settings.currency)}</td>
                    <td className="px-4 py-3 text-ink-600">{methodLabel(e.method)}</td>
                    <td className="px-4 py-3 text-ink-500 truncate max-w-[200px]">{e.note ?? '—'}</td>
                    <td className="px-4 py-3 text-ink-600">{e.userName}</td>
                    <td className="px-4 py-3 text-ink-500 nums">{fmtDate(e.date)}</td>
                    <td className="px-4 py-3 text-center">
                      {can('manage_expenses') && (
                        <button onClick={() => setDeleteTarget(e)} className="p-1.5 text-ink-400 hover:text-error-600 hover:bg-error-50 rounded-lg">
                          <Trash2 size={16} />
                        </button>
                      )}
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
        <ExpenseForm
          currency={settings.currency}
          methods={settings.paymentMethods}
          categories={EXPENSE_CATEGORIES}
          onClose={() => setCreating(false)}
          onSave={(exp) => {
            setExpenses((prev) => [exp, ...prev]);
            logAction('تسجيل مصروف', exp.category, undefined, money(exp.amount, settings.currency));
            toast('success', 'تم تسجيل المصروف');
            setCreating(false);
          }}
          userId={currentUser!.id}
          userName={currentUser!.name}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <Modal open onClose={() => setDeleteTarget(null)} title="حذف مصروف" size="sm"
          footer={<>
            <button className="btn-outline" onClick={() => setDeleteTarget(null)}>إلغاء</button>
            <button className="btn bg-error-600 text-white hover:bg-error-700 px-4 py-2.5" onClick={() => {
              setExpenses((prev) => prev.filter((e) => e.id !== deleteTarget.id));
              logAction('حذف مصروف', deleteTarget.category);
              toast('success', 'تم حذف المصروف');
              setDeleteTarget(null);
            }}>حذف</button>
          </>}>
          <p className="text-sm text-ink-600">هل تريد حذف مصروف "{deleteTarget.category}" بقيمة {money(deleteTarget.amount, settings.currency)}؟</p>
        </Modal>
      )}
    </div>
  );
}

function ExpenseForm({
  currency, methods, categories, onClose, onSave, userId, userName,
}: {
  currency: string;
  methods: { id: PaymentMethodId; name: string }[];
  categories: string[];
  onClose: () => void;
  onSave: (e: Expense) => void;
  userId: string;
  userName: string;
}) {
  const [category, setCategory] = useState(categories[0]);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethodId>('cash');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISO());

  const save = () => {
    if (amount <= 0) return;
    onSave({
      id: `e_${Date.now()}`, category, amount, method, note: note.trim() || undefined,
      date, userId, userName,
    });
  };

  return (
    <Modal open onClose={onClose} title="مصروف جديد" size="md"
      footer={<>
        <button className="btn-outline" onClick={onClose}>إلغاء</button>
        <button className="btn-primary" disabled={amount <= 0} onClick={save}>حفظ المصروف</button>
      </>}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">البند</label>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">المبلغ ({currency})</label>
          <input type="number" min={0} className="input nums" value={amount || ''} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label">طريقة الدفع</label>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethodId)}>
            {methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">التاريخ</label>
          <input type="date" className="input nums" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">ملاحظة</label>
          <textarea className="input min-h-[60px] resize-none" value={note} onChange={(e) => setNote(e.target.value)} placeholder="تفاصيل إضافية..." />
        </div>
      </div>
    </Modal>
  );
}
