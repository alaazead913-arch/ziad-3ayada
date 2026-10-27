import { useState, useMemo } from 'react';
import { useStore } from '@/store';
import { money, fmt, fmtDateTime, ORDER_TYPE_LABELS, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/format';
import { PageHeader, Modal, EmptyState, Badge } from '@/components/ui';
import {
  MessageCircle, Search, Eye, RefreshCw, Bot, Phone, MapPin,
  Clock, CheckCircle2, XCircle, ShoppingCart,
} from 'lucide-react';
import type { Order } from '@/types';
import { fetchOrdersFromDb } from '@/lib/ordersApi';

type StatusFilter = 'all' | 'paid' | 'open' | 'cancelled' | 'returned';

export function ChatbotOrdersPage() {
  const { orders, setOrders, settings, toast } = useStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewing, setViewing] = useState<Order | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Chatbot orders = those with cashier_name starting with "بوت" or source chatbot
  // Since our app Order type doesn't carry `source`, we detect by cashier_name prefix
  const chatbotOrders = useMemo(() => {
    return orders.filter((o) =>
      o.cashierName?.startsWith('بوت') || o.cashierName === 'شات بوت'
    );
  }, [orders]);

  const filtered = useMemo(() => {
    let r = chatbotOrders;
    if (statusFilter !== 'all') r = r.filter((o) => o.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((o) =>
        o.number.toLowerCase().includes(q) ||
        o.customerName?.toLowerCase().includes(q) ||
        o.customerPhone?.toLowerCase().includes(q)
      );
    }
    return [...r].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [chatbotOrders, search, statusFilter]);

  const refresh = async () => {
    setRefreshing(true);
    const dbOrders = await fetchOrdersFromDb();
    if (dbOrders.length > 0) {
      setOrders((prev) => {
        const dbIds = new Set(dbOrders.map((o) => o.id));
        return [...dbOrders, ...prev.filter((o) => !dbIds.has(o.id))];
      });
      toast('success', 'تم تحديث الطلبات');
    }
    setRefreshing(false);
  };

  const updateOrderStatus = (order: Order, status: Order['status']) => {
    setOrders((prev) => prev.map((o) =>
      o.id === order.id ? { ...o, status } : o
    ));
    toast('success', `تم تحديث حالة الطلب #${order.number}`);
    setViewing(null);
  };

  const totalSales = chatbotOrders
    .filter((o) => o.status === 'paid')
    .reduce((s, o) => s + o.total, 0);
  const paidCount = chatbotOrders.filter((o) => o.status === 'paid').length;
  const pendingCount = chatbotOrders.filter((o) => o.status === 'open').length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="طلبات الشات بوت"
        subtitle="الطلبات الواردة من واتساب والبوتات الأخرى"
        action={
          <button
            onClick={refresh}
            disabled={refreshing}
            className="btn-outline"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            تحديث
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي الطلبات', value: fmt(chatbotOrders.length, 0), icon: <MessageCircle size={18} />, color: 'text-primary-600 bg-primary-50' },
          { label: 'مبيعات البوت', value: money(totalSales, settings.currency), icon: <ShoppingCart size={18} />, color: 'text-success-600 bg-success-50' },
          { label: 'مدفوعة', value: fmt(paidCount, 0), icon: <CheckCircle2 size={18} />, color: 'text-secondary-600 bg-secondary-50' },
          { label: 'بانتظار', value: fmt(pendingCount, 0), icon: <Clock size={18} />, color: 'text-warning-600 bg-warning-50' },
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
          <input
            className="input pr-10"
            placeholder="ابحث برقم الطلب أو اسم العميل..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5">
          {(['all', 'paid', 'open', 'cancelled', 'returned'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`chip ${statusFilter === s ? 'bg-primary-600 text-white' : 'bg-ink-100 text-ink-600'}`}
            >
              {s === 'all' ? 'الكل' : ORDER_STATUS_LABELS[s as keyof typeof ORDER_STATUS_LABELS]}
            </button>
          ))}
        </div>
      </div>

      {/* Orders table */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Bot size={26} />}
            title="لا توجد طلبات من الشات بوت"
            hint="الطلبات الواردة من واتساب أو أي بلاتفورم هتظهر هنا"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-500 text-xs">
                <tr>
                  <th className="text-right font-semibold px-4 py-3">رقم</th>
                  <th className="text-right font-semibold px-4 py-3">المصدر</th>
                  <th className="text-right font-semibold px-4 py-3">النوع</th>
                  <th className="text-right font-semibold px-4 py-3">العميل</th>
                  <th className="text-right font-semibold px-4 py-3">الوقت</th>
                  <th className="text-right font-semibold px-4 py-3">المبلغ</th>
                  <th className="text-right font-semibold px-4 py-3">الحالة</th>
                  <th className="text-center font-semibold px-4 py-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="table-row">
                    <td className="px-4 py-3 font-semibold text-ink-800 nums">#{o.number}</td>
                    <td className="px-4 py-3">
                      <Badge className="bg-secondary-100 text-secondary-700">
                        <Bot size={12} /> {o.cashierName}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-ink-600">{ORDER_TYPE_LABELS[o.type]}</td>
                    <td className="px-4 py-3">
                      {o.customerName ? (
                        <div>
                          <p className="text-ink-700 font-medium">{o.customerName}</p>
                          {o.customerPhone && (
                            <p className="text-xs text-ink-400 nums flex items-center gap-1">
                              <Phone size={10} /> {o.customerPhone}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-500 nums text-xs">{fmtDateTime(o.createdAt)}</td>
                    <td className="px-4 py-3 font-bold text-ink-800 nums">{money(o.total, settings.currency)}</td>
                    <td className="px-4 py-3">
                      <span className={`chip ${ORDER_STATUS_COLORS[o.status]}`}>
                        {ORDER_STATUS_LABELS[o.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setViewing(o)}
                        className="p-1.5 text-ink-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                      >
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

      {/* View modal */}
      {viewing && (
        <Modal
          open
          onClose={() => setViewing(null)}
          title={`طلب #${viewing.number}`}
          size="lg"
          footer={
            <>
              <button className="btn-outline" onClick={() => setViewing(null)}>إغلاق</button>
              {viewing.status === 'paid' && (
                <button
                  className="btn bg-error-600 text-white hover:bg-error-700 px-4 py-2.5"
                  onClick={() => updateOrderStatus(viewing, 'returned')}
                >
                  <XCircle size={18} /> مرتجع
                </button>
              )}
              {viewing.status === 'open' && (
                <button
                  className="btn-primary"
                  onClick={() => updateOrderStatus(viewing, 'paid')}
                >
                  <CheckCircle2 size={18} /> اعتماد الدفع
                </button>
              )}
            </>
          }
        >
          <div className="space-y-4">
            {/* Order info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Bot size={16} className="text-secondary-500" />
                <span className="text-ink-400">المصدر:</span>
                <span className="font-semibold">{viewing.cashierName}</span>
              </div>
              <div>
                <span className="text-ink-400">النوع:</span>
                <span className="font-semibold mr-2">{ORDER_TYPE_LABELS[viewing.type]}</span>
              </div>
              {viewing.customerName && (
                <div>
                  <span className="text-ink-400">العميل:</span>
                  <span className="font-semibold mr-2">{viewing.customerName}</span>
                </div>
              )}
              {viewing.customerPhone && (
                <div className="flex items-center gap-1">
                  <Phone size={14} className="text-ink-400" />
                  <span className="nums font-semibold">{viewing.customerPhone}</span>
                </div>
              )}
              {viewing.deliveryAddress && (
                <div className="col-span-2 flex items-center gap-1">
                  <MapPin size={14} className="text-ink-400" />
                  <span className="text-ink-600">{viewing.deliveryAddress}</span>
                </div>
              )}
              <div className="col-span-2">
                <span className="text-ink-400">الوقت:</span>
                <span className="nums font-semibold mr-2">{fmtDateTime(viewing.createdAt)}</span>
              </div>
            </div>

            {/* Items */}
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
                  {viewing.lines.map((l) => (
                    <tr key={l.id} className="table-row">
                      <td className="px-3 py-2.5 font-semibold text-ink-800">
                        {l.productName}
                        {l.note && <p className="text-xs text-warning-600 mt-0.5">ملاحظة: {l.note}</p>}
                      </td>
                      <td className="px-3 py-2.5 nums">{fmt(l.qty, 0)}</td>
                      <td className="px-3 py-2.5 nums">{money(l.unitPrice, settings.currency)}</td>
                      <td className="px-3 py-2.5 text-left nums font-semibold">{money(l.lineTotal, settings.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end space-y-1 ml-auto w-48 text-sm">
              <div className="flex justify-between w-full">
                <span className="text-ink-500">الإجمالي الفرعي:</span>
                <span className="nums">{money(viewing.subtotal, settings.currency)}</span>
              </div>
              {viewing.discount > 0 && (
                <div className="flex justify-between w-full">
                  <span className="text-ink-500">الخصم:</span>
                  <span className="nums">-{money(viewing.discount, settings.currency)}</span>
                </div>
              )}
              <div className="flex justify-between w-full">
                <span className="text-ink-500">الضريبة:</span>
                <span className="nums">{money(viewing.taxAmount, settings.currency)}</span>
              </div>
              <div className="flex justify-between w-full text-base font-bold pt-1 border-t border-ink-200 mt-1">
                <span>الإجمالي:</span>
                <span className="nums">{money(viewing.total, settings.currency)}</span>
              </div>
            </div>

            {/* Status badge */}
            <div className="flex items-center justify-between pt-3 border-t border-ink-100">
              <span className="text-sm text-ink-500">الحالة الحالية:</span>
              <span className={`chip ${ORDER_STATUS_COLORS[viewing.status]}`}>
                {ORDER_STATUS_LABELS[viewing.status]}
              </span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
