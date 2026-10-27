import { useState, useMemo } from 'react';
import { useStore } from '@/store';
import { money, fmt, fmtDate, ORDER_TYPE_LABELS, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/format';
import { BarChart, LineChart, type ChartPoint } from '@/components/charts';
import { PageHeader, EmptyState } from '@/components/ui';
import {
  BarChart3, DollarSign, TrendingUp, Receipt, Percent,
  Package, ShoppingCart, ArrowDownUp, Download, Calendar,
} from 'lucide-react';

type DateRange = 'today' | '7d' | '30d';
type ReportTab = 'sales' | 'profits' | 'taxes' | 'payments' | 'cashiers' | 'discounts' | 'cancellations';

export function ReportsPage() {
  const { orders, expenses, products, settings } = useStore();
  const [range, setRange] = useState<DateRange>('7d');
  const [tab, setTab] = useState<ReportTab>('sales');

  const now = Date.now();
  const DAY = 86400000;
  const days = range === 'today' ? 1 : range === '7d' ? 7 : 30;
  const startTs = now - days * DAY;

  const paidOrders = useMemo(
    () => orders.filter((o) => o.status === 'paid' && new Date(o.createdAt).getTime() >= startTs),
    [orders, startTs],
  );

  const sales = paidOrders.reduce((s, o) => s + o.total, 0);
  const cost = paidOrders.reduce((s, o) => s + o.lines.reduce((ls, l) => ls + l.unitPrice * 0.42 * l.qty, 0), 0);
  const profit = sales - cost;
  const margin = sales > 0 ? (profit / sales) * 100 : 0;
  const taxTotal = paidOrders.reduce((s, o) => s + o.taxAmount, 0);
  const discountTotal = paidOrders.reduce((s, o) => s + o.discount, 0);
  const cancelled = orders.filter((o) => o.status === 'cancelled' && new Date(o.createdAt).getTime() >= startTs);
  const returned = orders.filter((o) => o.status === 'returned' && new Date(o.createdAt).getTime() >= startTs);
  const expenseTotal = expenses.filter((e) => new Date(e.date).getTime() >= startTs).reduce((s, e) => s + e.amount, 0);

  // Daily chart
  const dailyData: ChartPoint[] = useMemo(() => {
    const arr: ChartPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const dStart = new Date(now - i * DAY).setHours(0,0,0,0);
      const dEnd = dStart + DAY;
      const dayOrders = orders.filter((o) => o.status === 'paid' && new Date(o.createdAt).getTime() >= dStart && new Date(o.createdAt).getTime() < dEnd);
      const label = new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: days > 7 ? 'short' : 'numeric' }).format(new Date(now - i * DAY));
      arr.push({ label, value: dayOrders.reduce((s, o) => s + o.total, 0) });
    }
    return arr;
  }, [orders, days, now]);

  // By type
  const byType = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    paidOrders.forEach((o) => {
      if (!map[o.type]) map[o.type] = { count: 0, total: 0 };
      map[o.type].count++; map[o.type].total += o.total;
    });
    return Object.entries(map);
  }, [paidOrders]);

  // By payment method
  const byPayment = useMemo(() => {
    const map: Record<string, number> = {};
    paidOrders.forEach((o) => o.payments.forEach((p) => { map[p.method] = (map[p.method] || 0) + p.amount; }));
    const names: Record<string, string> = { cash: 'نقد', card: 'بطاقة', bank: 'بنك', visa: 'فيزا' };
    return Object.entries(map).map(([k, v]) => ({ label: names[k] || k, value: v }));
  }, [paidOrders]);

  // By cashier
  const byCashier = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    paidOrders.forEach((o) => {
      if (!map[o.cashierName]) map[o.cashierName] = { count: 0, total: 0 };
      map[o.cashierName].count++; map[o.cashierName].total += o.total;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [paidOrders]);

  // By product
  const byProduct = useMemo(() => {
    const map: Record<string, { name: string; qty: number; total: number }> = {};
    paidOrders.forEach((o) => o.lines.forEach((l) => {
      if (!map[l.productId]) map[l.productId] = { name: l.productName, qty: 0, total: 0 };
      map[l.productId].qty += l.qty; map[l.productId].total += l.lineTotal;
    }));
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [paidOrders]);

  const TABS: { k: ReportTab; l: string; icon: any }[] = [
    { k: 'sales', l: 'المبيعات', icon: <ShoppingCart size={16} /> },
    { k: 'profits', l: 'الأرباح', icon: <TrendingUp size={16} /> },
    { k: 'taxes', l: 'الضرائب', icon: <Percent size={16} /> },
    { k: 'payments', l: 'طرق الدفع', icon: <DollarSign size={16} /> },
    { k: 'cashiers', l: 'أداء الكاشير', icon: <BarChart3 size={16} /> },
    { k: 'discounts', l: 'الخصومات', icon: <Receipt size={16} /> },
    { k: 'cancellations', l: 'الإلغاءات والمرتجعات', icon: <ArrowDownUp size={16} /> },
  ];

  const exportCSV = () => {
    const rows = paidOrders.map((o) => [o.number, o.type, o.cashierName, o.subtotal, o.discount, o.taxAmount, o.total, o.createdAt]);
    const csv = ['رقم,النوع,الكاشير,الإجمالي الفرعي,الخصم,الضريبة,الإجمالي,التاريخ', ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `تقرير-المبيعات-${range}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="التقارير" subtitle="تحليل أداء المطعم والمبيعات"
        action={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white rounded-xl border border-ink-200 p-1">
              {(['today', '7d', '30d'] as DateRange[]).map((p) => (
                <button key={p} onClick={() => setRange(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition
                    ${range === p ? 'bg-primary-600 text-white' : 'text-ink-500 hover:bg-ink-100'}`}>
                  {p === 'today' ? 'اليوم' : p === '7d' ? '٧ أيام' : '٣٠ يوم'}
                </button>
              ))}
            </div>
            <button onClick={exportCSV} className="btn-outline">
              <Download size={16} /> تصدير
            </button>
          </div>
        } />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        {[
          { label: 'المبيعات', value: money(sales, settings.currency), icon: <DollarSign size={18} />, color: 'text-primary-600 bg-primary-50' },
          { label: 'الأرباح', value: money(profit, settings.currency), icon: <TrendingUp size={18} />, color: 'text-success-600 bg-success-50' },
          { label: 'هامش الربح', value: `${fmt(margin, 1)}٪`, icon: <Percent size={18} />, color: 'text-accent-600 bg-accent-50' },
          { label: 'الضرائب', value: money(taxTotal, settings.currency), icon: <Receipt size={18} />, color: 'text-warning-600 bg-warning-50' },
          { label: 'المصروفات', value: money(expenseTotal, settings.currency), icon: <ArrowDownUp size={18} />, color: 'text-error-600 bg-error-50' },
          { label: 'الطلبات', value: fmt(paidOrders.length, 0), icon: <ShoppingCart size={18} />, color: 'text-secondary-600 bg-secondary-50' },
        ].map((s, i) => (
          <div key={i} className="card p-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.color} mb-2`}>{s.icon}</div>
            <p className="text-xs text-ink-500 font-medium">{s.label}</p>
            <p className="text-lg font-bold text-ink-800 nums">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`btn px-4 py-2 shrink-0 ${tab === t.k ? 'bg-primary-600 text-white' : 'bg-white border border-ink-200 text-ink-600'}`}>
            {t.icon} {t.l}
          </button>
        ))}
      </div>

      {/* Report content */}
      {tab === 'sales' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-bold text-ink-800 mb-4">المبيعات اليومية</h3>
            <LineChart data={dailyData} />
          </div>
          <div className="card p-5">
            <h3 className="font-bold text-ink-800 mb-4">المبيعات حسب نوع الطلب</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-ink-400 text-xs border-b border-ink-100">
                  <tr>
                    <th className="text-right font-medium px-3 py-2">النوع</th>
                    <th className="text-right font-medium px-3 py-2">عدد الطلبات</th>
                    <th className="text-left font-medium px-3 py-2">إجمالي المبيعات</th>
                  </tr>
                </thead>
                <tbody>
                  {byType.map(([type, data]) => (
                    <tr key={type} className="table-row">
                      <td className="px-3 py-2.5 font-semibold text-ink-700">{ORDER_TYPE_LABELS[type as keyof typeof ORDER_TYPE_LABELS]}</td>
                      <td className="px-3 py-2.5 nums text-ink-600">{fmt(data.count, 0)}</td>
                      <td className="px-3 py-2.5 text-left font-bold nums">{money(data.total, settings.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card p-5">
            <h3 className="font-bold text-ink-800 mb-4">المبيعات حسب الصنف</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-ink-400 text-xs border-b border-ink-100">
                  <tr>
                    <th className="text-right font-medium px-3 py-2">الصنف</th>
                    <th className="text-right font-medium px-3 py-2">الكمية</th>
                    <th className="text-left font-medium px-3 py-2">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {byProduct.slice(0, 10).map((p, i) => (
                    <tr key={i} className="table-row">
                      <td className="px-3 py-2.5 font-semibold text-ink-700">{p.name}</td>
                      <td className="px-3 py-2.5 nums text-ink-600">{fmt(p.qty, 0)}</td>
                      <td className="px-3 py-2.5 text-left font-bold nums">{money(p.total, settings.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'profits' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-5 text-center">
              <p className="text-sm text-ink-500">إجمالي المبيعات</p>
              <p className="text-2xl font-bold text-primary-600 nums mt-1">{money(sales, settings.currency)}</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-sm text-ink-500">تكلفة البضاعة</p>
              <p className="text-2xl font-bold text-error-600 nums mt-1">{money(cost, settings.currency)}</p>
            </div>
            <div className="card p-5 text-center bg-success-50 border-success-100">
              <p className="text-sm text-success-700">صافي الربح</p>
              <p className="text-2xl font-bold text-success-700 nums mt-1">{money(profit, settings.currency)}</p>
            </div>
          </div>
          <div className="card p-5">
            <h3 className="font-bold text-ink-800 mb-4">تطور الأرباح</h3>
            <BarChart
              data={dailyData.map((d) => ({ ...d, value: d.value * 0.58 }))}
              color="bg-success-500"
              height={200}
              format={(n) => money(n, settings.currency)}
            />
          </div>
        </div>
      )}

      {tab === 'taxes' && (
        <div className="card p-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="rounded-xl bg-warning-50 p-4 text-center">
              <p className="text-sm text-warning-700">إجمالي الضريبة المحصلة</p>
              <p className="text-2xl font-bold text-warning-700 nums mt-1">{money(taxTotal, settings.currency)}</p>
            </div>
            <div className="rounded-xl bg-ink-50 p-4 text-center">
              <p className="text-sm text-ink-600">نسبة الضريبة</p>
              <p className="text-2xl font-bold text-ink-800 nums mt-1">{settings.taxRate}٪</p>
            </div>
            <div className="rounded-xl bg-ink-50 p-4 text-center">
              <p className="text-sm text-ink-600">الأسعار</p>
              <p className="text-lg font-bold text-ink-800 mt-1">{settings.taxInclusive ? 'شاملة الضريبة' : 'غير شاملة'}</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'payments' && (
        <div className="card p-5">
          <h3 className="font-bold text-ink-800 mb-4">توزيع طرق الدفع</h3>
          {byPayment.length > 0 ? (
            <BarChart data={byPayment} color="bg-secondary-500" height={220} format={(n) => money(n, settings.currency)} />
          ) : <EmptyState icon={<DollarSign size={26} />} title="لا توجد بيانات" />}
        </div>
      )}

      {tab === 'cashiers' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-500 text-xs">
                <tr>
                  <th className="text-right font-semibold px-4 py-3">الكاشير</th>
                  <th className="text-right font-semibold px-4 py-3">عدد الطلبات</th>
                  <th className="text-right font-semibold px-4 py-3">إجمالي المبيعات</th>
                  <th className="text-right font-semibold px-4 py-3">متوسط الطلب</th>
                </tr>
              </thead>
              <tbody>
                {byCashier.map(([name, data]) => (
                  <tr key={name} className="table-row">
                    <td className="px-4 py-3 font-semibold text-ink-800">{name}</td>
                    <td className="px-4 py-3 nums text-ink-600">{fmt(data.count, 0)}</td>
                    <td className="px-4 py-3 nums font-bold">{money(data.total, settings.currency)}</td>
                    <td className="px-4 py-3 nums text-ink-600">{money(data.total / data.count, settings.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'discounts' && (
        <div className="card p-5">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="rounded-xl bg-primary-50 p-4 text-center">
              <p className="text-sm text-primary-700">إجمالي الخصومات</p>
              <p className="text-2xl font-bold text-primary-700 nums mt-1">{money(discountTotal, settings.currency)}</p>
            </div>
            <div className="rounded-xl bg-ink-50 p-4 text-center">
              <p className="text-sm text-ink-600">طلبات بها خصم</p>
              <p className="text-2xl font-bold text-ink-800 nums mt-1">{fmt(paidOrders.filter((o) => o.discount > 0).length, 0)}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-ink-400 text-xs border-b border-ink-100">
                <tr>
                  <th className="text-right font-medium px-3 py-2">رقم الطلب</th>
                  <th className="text-right font-medium px-3 py-2">الكاشير</th>
                  <th className="text-left font-medium px-3 py-2">قيمة الخصم</th>
                </tr>
              </thead>
              <tbody>
                {paidOrders.filter((o) => o.discount > 0).map((o) => (
                  <tr key={o.id} className="table-row">
                    <td className="px-3 py-2.5 font-semibold nums">#{o.number}</td>
                    <td className="px-3 py-2.5 text-ink-600">{o.cashierName}</td>
                    <td className="px-3 py-2.5 text-left font-bold text-primary-600 nums">{money(o.discount, settings.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'cancellations' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-5 text-center">
              <p className="text-sm text-ink-500">الطلبات الملغاة</p>
              <p className="text-2xl font-bold text-error-600 nums mt-1">{fmt(cancelled.length, 0)}</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-sm text-ink-500">المرتجعات</p>
              <p className="text-2xl font-bold text-warning-600 nums mt-1">{fmt(returned.length, 0)}</p>
            </div>
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 text-ink-500 text-xs">
                  <tr>
                    <th className="text-right font-semibold px-4 py-3">رقم</th>
                    <th className="text-right font-semibold px-4 py-3">النوع</th>
                    <th className="text-right font-semibold px-4 py-3">الحالة</th>
                    <th className="text-right font-semibold px-4 py-3">السبب</th>
                    <th className="text-right font-semibold px-4 py-3">الكاشير</th>
                    <th className="text-right font-semibold px-4 py-3">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {[...cancelled, ...returned].map((o) => (
                    <tr key={o.id} className="table-row">
                      <td className="px-4 py-3 font-semibold nums">#{o.number}</td>
                      <td className="px-4 py-3 text-ink-600">{ORDER_TYPE_LABELS[o.type]}</td>
                      <td className="px-4 py-3">
                        <span className={`chip ${ORDER_STATUS_COLORS[o.status]}`}>{ORDER_STATUS_LABELS[o.status]}</span>
                      </td>
                      <td className="px-4 py-3 text-ink-600">{o.cancelReason ?? o.returnReason ?? '—'}</td>
                      <td className="px-4 py-3 text-ink-600">{o.cashierName}</td>
                      <td className="px-4 py-3 nums font-semibold">{money(o.total, settings.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
