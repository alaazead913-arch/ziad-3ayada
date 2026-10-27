import { useMemo, useState } from 'react';
import { useStore } from '@/store';
import { money, fmt, fmtTime, ORDER_TYPE_LABELS } from '@/lib/format';
import { BarChart, LineChart, DonutChart, type ChartPoint } from '@/components/charts';
import { PageHeader } from '@/components/ui';
import type { PageKey } from '@/components/Shell';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingBag,
  Receipt, Package, AlertTriangle, ArrowLeftRight, ShoppingCart,
} from 'lucide-react';

type Period = 'today' | '7d' | '30d';

export function Dashboard({ onNavigate }: { onNavigate: (k: PageKey) => void }) {
  const { orders, products, expenses, settings, shifts } = useStore();
  const [period, setPeriod] = useState<Period>('7d');

  const now = Date.now();
  const DAY = 86400000;
  const periodDays = period === 'today' ? 1 : period === '7d' ? 7 : 30;
  const startTs = now - periodDays * DAY;

  const filtered = useMemo(
    () => orders.filter((o) =>
      o.status === 'paid' && new Date(o.createdAt).getTime() >= startTs
    ),
    [orders, startTs],
  );

  const prevStart = startTs - periodDays * DAY;
  const prevFiltered = useMemo(
    () => orders.filter((o) =>
      o.status === 'paid' &&
      new Date(o.createdAt).getTime() >= prevStart &&
      new Date(o.createdAt).getTime() < startTs
    ),
    [orders, prevStart, startTs],
  );

  const sales = filtered.reduce((s, o) => s + o.total, 0);
  const prevSales = prevFiltered.reduce((s, o) => s + o.total, 0);
  const salesChange = prevSales > 0 ? ((sales - prevSales) / prevSales) * 100 : 0;

  const cost = filtered.reduce((s, o) =>
    s + o.lines.reduce((ls, l) => ls + (l.unitPrice * 0.42) * l.qty, 0), 0);
  const profit = sales - cost;
  const margin = sales > 0 ? (profit / sales) * 100 : 0;

  const taxTotal = filtered.reduce((s, o) => s + o.taxAmount, 0);
  const expenseTotal = expenses
    .filter((e) => new Date(e.date).getTime() >= startTs)
    .reduce((s, e) => s + e.amount, 0);
  const orderCount = filtered.length;
  const avgOrder = orderCount > 0 ? sales / orderCount : 0;

  // Sales by day chart
  const dailyData: ChartPoint[] = useMemo(() => {
    const days = periodDays;
    const arr: ChartPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const dayStart = now - i * DAY;
      const dStart = new Date(dayStart).setHours(0,0,0,0);
      const dEnd = dStart + DAY;
      const dayOrders = orders.filter((o) =>
        o.status === 'paid' &&
        new Date(o.createdAt).getTime() >= dStart &&
        new Date(o.createdAt).getTime() < dEnd
      );
      const label = new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: periodDays > 7 ? 'short' : 'numeric' })
        .format(new Date(dayStart));
      arr.push({ label, value: dayOrders.reduce((s, o) => s + o.total, 0) });
    }
    return arr;
  }, [orders, periodDays, now]);

  // Order type breakdown
  const typeData = useMemo(() => {
    const colors: Record<string, string> = {
      dine_in: '#f05e06', takeaway: '#0ea5e9', delivery: '#14b8a6',
    };
    const counts: Record<string, number> = {};
    filtered.forEach((o) => { counts[o.type] = (counts[o.type] || 0) + 1; });
    return Object.entries(counts).map(([k, v]) => ({
      label: ORDER_TYPE_LABELS[k as keyof typeof ORDER_TYPE_LABELS],
      value: v, color: colors[k] || '#94a3b8',
    }));
  }, [filtered]);

  // Payment methods
  const paymentData: ChartPoint[] = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((o) => o.payments.forEach((p) => {
      counts[p.method] = (counts[p.method] || 0) + p.amount;
    }));
    const names: Record<string, string> = { cash: 'نقد', card: 'بطاقة', bank: 'بنك', visa: 'فيزا' };
    return Object.entries(counts).map(([k, v]) => ({ label: names[k] || k, value: v }));
  }, [filtered]);

  // Low stock
  const lowStock = products.filter((p) => p.trackStock && p.available <= settings.lowStockThreshold && p.type !== 'raw');

  // Top products
  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; qty: number; total: number }> = {};
    filtered.forEach((o) => o.lines.forEach((l) => {
      if (!map[l.productId]) map[l.productId] = { name: l.productName, qty: 0, total: 0 };
      map[l.productId].qty += l.qty;
      map[l.productId].total += l.lineTotal;
    }));
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [filtered]);

  // Recent orders
  const recent = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);

  const stats = [
    { label: 'المبيعات', value: money(sales, settings.currency), change: salesChange,
      icon: <DollarSign size={20} />, color: 'text-primary-600 bg-primary-50' },
    { label: 'الأرباح', value: money(profit, settings.currency), change: margin,
      icon: <TrendingUp size={20} />, color: 'text-success-600 bg-success-50', isPct: true },
    { label: 'المصروفات', value: money(expenseTotal, settings.currency),
      icon: <Receipt size={20} />, color: 'text-error-600 bg-error-50' },
    { label: 'عدد الطلبات', value: fmt(orderCount, 0),
      icon: <ShoppingBag size={20} />, color: 'text-secondary-600 bg-secondary-50' },
    { label: 'متوسط الطلب', value: money(avgOrder, settings.currency),
      icon: <TrendingUp size={20} />, color: 'text-accent-600 bg-accent-50' },
    { label: 'إجمالي الضرائب', value: money(taxTotal, settings.currency),
      icon: <Receipt size={20} />, color: 'text-warning-600 bg-warning-50' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="لوحة التحكم"
        subtitle="نظرة عامة على أداء المطعم"
        action={
          <div className="flex items-center gap-1 bg-white rounded-xl border border-ink-200 p-1">
            {(['today', '7d', '30d'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition
                  ${period === p ? 'bg-primary-600 text-white' : 'text-ink-500 hover:bg-ink-100'}`}
              >
                {p === 'today' ? 'اليوم' : p === '7d' ? 'آخر ٧ أيام' : 'آخر ٣٠ يوم'}
              </button>
            ))}
          </div>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {stats.map((s, i) => (
          <div key={i} className="card p-4 animate-slide-up" style={{ animationDelay: `${i * 30}ms` }}>
            <div className="flex items-center justify-between mb-2">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.color}`}>
                {s.icon}
              </div>
              {s.change !== undefined && (
                <span className={`chip text-xs ${s.change >= 0 ? 'bg-success-50 text-success-700' : 'bg-error-50 text-error-700'}`}>
                  {s.change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {s.isPct ? fmt(s.change, 1) : fmt(s.change, 1)}٪
                </span>
              )}
            </div>
            <p className="text-xs text-ink-500 font-medium">{s.label}</p>
            <p className="text-lg font-bold text-ink-800 nums mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-ink-800">المبيعات اليومية</h3>
            <span className="text-sm text-ink-400">{money(sales, settings.currency)}</span>
          </div>
          <LineChart data={dailyData} />
        </div>

        <div className="card p-5">
          <h3 className="font-bold text-ink-800 mb-4">توزيع أنواع الطلب</h3>
          {typeData.length > 0 ? (
            <DonutChart data={typeData} />
          ) : (
            <p className="text-sm text-ink-400 text-center py-12">لا توجد بيانات</p>
          )}
        </div>
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Payment methods */}
        <div className="card p-5">
          <h3 className="font-bold text-ink-800 mb-4">طرق الدفع</h3>
          {paymentData.length > 0 ? (
            <BarChart data={paymentData} height={180} format={(n) => money(n, settings.currency)} />
          ) : (
            <p className="text-sm text-ink-400 text-center py-12">لا توجد بيانات</p>
          )}
        </div>

        {/* Top products */}
        <div className="card p-5">
          <h3 className="font-bold text-ink-800 mb-4">الأكثر مبيعاً</h3>
          <div className="space-y-3">
            {topProducts.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center text-sm font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-700 truncate">{p.name}</p>
                  <p className="text-xs text-ink-400 nums">{fmt(p.qty, 0)} قطعة</p>
                </div>
                <p className="text-sm font-bold text-ink-800 nums">{money(p.total, settings.currency)}</p>
              </div>
            ))}
            {topProducts.length === 0 && <p className="text-sm text-ink-400 text-center py-8">لا توجد بيانات</p>}
          </div>
        </div>

        {/* Low stock alert */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-ink-800">تنبيهات المخزون</h3>
            <button onClick={() => onNavigate('inventory')} className="text-xs text-primary-600 font-semibold hover:underline">
              عرض الكل
            </button>
          </div>
          <div className="space-y-2.5">
            {lowStock.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-warning-50 border border-warning-100">
                <AlertTriangle size={18} className="text-warning-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-700 truncate">{p.name}</p>
                  <p className="text-xs text-warning-700 nums">المتبقي: {fmt(p.available, 0)}</p>
                </div>
              </div>
            ))}
            {lowStock.length === 0 && (
              <div className="flex flex-col items-center py-8 text-ink-400">
                <Package size={28} />
                <p className="text-sm mt-2">المخزون في حالة جيدة</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent orders */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-ink-800">أحدث الطلبات</h3>
          <button onClick={() => onNavigate('pos')} className="text-xs text-primary-600 font-semibold hover:underline flex items-center gap-1">
            <ShoppingCart size={14} /> فتح نقطة البيع
          </button>
        </div>
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ink-400 text-xs border-b border-ink-100">
                <th className="text-right font-medium px-2 py-2">رقم</th>
                <th className="text-right font-medium px-2 py-2">النوع</th>
                <th className="text-right font-medium px-2 py-2">الوقت</th>
                <th className="text-right font-medium px-2 py-2">الكاشير</th>
                <th className="text-left font-medium px-2 py-2">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id} className="table-row">
                  <td className="px-2 py-2.5 font-semibold text-ink-700 nums">#{o.number}</td>
                  <td className="px-2 py-2.5 text-ink-600">{ORDER_TYPE_LABELS[o.type]}</td>
                  <td className="px-2 py-2.5 text-ink-500 nums">{fmtTime(o.createdAt)}</td>
                  <td className="px-2 py-2.5 text-ink-600">{o.cashierName}</td>
                  <td className="px-2 py-2.5 text-left font-bold text-ink-800 nums">{money(o.total, settings.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
