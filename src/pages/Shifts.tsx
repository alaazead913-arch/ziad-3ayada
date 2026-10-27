import { useState, useMemo } from 'react';
import { useStore } from '@/store';
import type { Shift } from '@/types';
import { money, fmt, fmtDateTime, fmtTime, round2 } from '@/lib/format';
import { Modal, EmptyState, Badge } from '@/components/ui';
import {
  Clock, Play, Square, Wallet, TrendingUp, TrendingDown,
  Calculator, History, User as UserIcon,
} from 'lucide-react';

export function ShiftModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { shifts, setShifts, orders, currentUser, toast, logAction } = useStore();
  const [tab, setTab] = useState<'current' | 'history'>('current');
  const [closeTarget, setCloseTarget] = useState<Shift | null>(null);

  const myOpenShift = useMemo(
    () => shifts.find((s) => s.cashierId === currentUser?.id && s.status === 'open'),
    [shifts, currentUser],
  );

  const myShifts = useMemo(
    () => shifts.filter((s) => s.cashierId === currentUser?.id).sort((a, b) => b.openedAt.localeCompare(a.openedAt)),
    [shifts, currentUser],
  );

  const openShift = () => {
    if (!currentUser) return;
    if (myOpenShift) {
      toast('error', 'لديك وردية مفتوحة بالفعل');
      return;
    }
    const newShift: Shift = {
      id: `sh_${Date.now()}`,
      cashierId: currentUser.id,
      cashierName: currentUser.name,
      openedAt: new Date().toISOString(),
      openingAmount: 500,
      expectedCash: 500,
      status: 'open',
    };
    setShifts((prev) => [newShift, ...prev]);
    logAction('فتح وردية', currentUser.name);
    toast('success', 'تم فتح الوردية');
  };

  // Calculate expected cash for the open shift
  const expectedCash = useMemo(() => {
    if (!myOpenShift) return 0;
    const shiftOrders = orders.filter((o) =>
      o.status === 'paid' &&
      o.cashierId === currentUser?.id &&
      new Date(o.createdAt).getTime() >= new Date(myOpenShift.openedAt).getTime()
    );
    const cashSales = shiftOrders.reduce((s, o) =>
      s + o.payments.filter((p) => p.method === 'cash').reduce((ps, p) => ps + p.amount, 0), 0);
    return round2(myOpenShift.openingAmount + cashSales);
  }, [myOpenShift, orders, currentUser]);

  const confirmClose = (countedCash: number) => {
    if (!closeTarget || !currentUser) return;
    const diff = round2(countedCash - expectedCash);
    setShifts((prev) => prev.map((s) => s.id === closeTarget.id ? {
      ...s, status: 'closed', closedAt: new Date().toISOString(),
      expectedCash, countedCash, difference: diff,
    } : s));
    logAction('إغلاق وردية', closeTarget.cashierName, undefined, money(countedCash));
    toast(diff === 0 ? 'success' : 'warning', diff === 0 ? 'تم إغلاق الوردية بدون فرق' : `تم إغلاق الوردية — الفرق: ${money(diff)}`);
    setCloseTarget(null);
  };

  return (
    <Modal open={open} onClose={onClose} title="إدارة الوردية" size="lg">
      {/* Tabs */}
      <div className="flex items-center gap-1.5 mb-4">
        {([
          { k: 'current', l: 'الوردية الحالية', icon: <Clock size={16} /> },
          { k: 'history', l: 'السجل', icon: <History size={16} /> },
        ] as const).map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`btn px-4 py-2 ${tab === t.k ? 'bg-primary-600 text-white' : 'bg-white border border-ink-200 text-ink-600'}`}>
            {t.icon} {t.l}
          </button>
        ))}
      </div>

      {tab === 'current' && (
        <div className="space-y-4">
          {myOpenShift ? (
            <>
              {/* Open shift info */}
              <div className="rounded-2xl bg-success-50 border border-success-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-success-500 animate-pulse" />
                  <span className="font-bold text-success-700">وردية مفتوحة</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-success-700/70">الكاشير</p>
                    <p className="font-bold text-success-700">{myOpenShift.cashierName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-success-700/70">وقت الفتح</p>
                    <p className="font-bold text-success-700 nums">{fmtTime(myOpenShift.openedAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-success-700/70">رصيد الافتتاح</p>
                    <p className="font-bold text-success-700 nums">{money(myOpenShift.openingAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-success-700/70">النقد المتوقع</p>
                    <p className="font-bold text-success-700 nums">{money(expectedCash)}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={() => setCloseTarget(myOpenShift)} className="btn bg-error-600 text-white hover:bg-error-700 px-4 py-2.5">
                  <Square size={18} /> إغلاق الوردية
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-ink-100 flex items-center justify-center text-ink-400 mb-3">
                <Clock size={26} />
              </div>
              <p className="font-semibold text-ink-600">لا توجد وردية مفتوحة</p>
              <p className="text-sm text-ink-400 mt-1 mb-4">افتح وردية جديدة لبدء تسجيل المبيعات</p>
              <button onClick={openShift} className="btn-primary">
                <Play size={18} /> فتح وردية جديدة
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-2">
          {myShifts.length === 0 ? (
            <EmptyState icon={<History size={26} />} title="لا يوجد سجل ورديات" />
          ) : (
            myShifts.map((s) => (
              <div key={s.id} className="rounded-xl border border-ink-100 p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <UserIcon size={16} className="text-ink-400" />
                    <span className="font-semibold text-ink-800">{s.cashierName}</span>
                    {s.status === 'open'
                      ? <Badge className="bg-success-100 text-success-700">مفتوحة</Badge>
                      : <Badge className="bg-ink-100 text-ink-600">مغلقة</Badge>}
                  </div>
                  <span className="text-xs text-ink-400 nums">{fmtDateTime(s.openedAt)}</span>
                </div>
                {s.status === 'closed' && (
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div><p className="text-ink-400">الافتتاح</p><p className="nums font-semibold">{money(s.openingAmount)}</p></div>
                    <div><p className="text-ink-400">المتوقع</p><p className="nums font-semibold">{money(s.expectedCash)}</p></div>
                    <div><p className="text-ink-400">الفعلي</p><p className="nums font-semibold">{money(s.countedCash ?? 0)}</p></div>
                    <div>
                      <p className="text-ink-400">الفرق</p>
                      <p className={`nums font-semibold ${(s.difference ?? 0) === 0 ? 'text-success-600' : (s.difference ?? 0) > 0 ? 'text-secondary-600' : 'text-error-600'}`}>
                        {money(s.difference ?? 0)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Close shift modal */}
      {closeTarget && (
        <CloseShiftModal
          shift={closeTarget}
          expectedCash={expectedCash}
          onClose={() => setCloseTarget(null)}
          onConfirm={confirmClose}
        />
      )}
    </Modal>
  );
}

function CloseShiftModal({
  shift, expectedCash, onClose, onConfirm,
}: {
  shift: Shift;
  expectedCash: number;
  onClose: () => void;
  onConfirm: (countedCash: number) => void;
}) {
  const [countedCash, setCountedCash] = useState(expectedCash);
  const diff = round2(countedCash - expectedCash);

  return (
    <Modal open onClose={onClose} title="إغلاق الوردية" size="sm"
      footer={<>
        <button className="btn-outline" onClick={onClose}>إلغاء</button>
        <button className="btn bg-error-600 text-white hover:bg-error-700 px-4 py-2.5" onClick={() => onConfirm(countedCash)}>
          <Square size={18} /> تأكيد الإغلاق
        </button>
      </>}>
      <div className="space-y-4">
        <div className="rounded-xl bg-ink-50 p-3 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-ink-500">الكاشير:</span><span className="font-semibold">{shift.cashierName}</span></div>
          <div className="flex justify-between"><span className="text-ink-500">رصيد الافتتاح:</span><span className="nums font-semibold">{money(shift.openingAmount)}</span></div>
          <div className="flex justify-between"><span className="text-ink-500">النقد المتوقع:</span><span className="nums font-semibold">{money(expectedCash)}</span></div>
        </div>
        <div>
          <label className="label"><Calculator size={14} className="inline ml-1" /> النقد المعدود فعلياً</label>
          <input type="number" className="input nums text-lg" value={countedCash} onChange={(e) => setCountedCash(Number(e.target.value) || 0)} />
        </div>
        <div className={`rounded-xl p-3 flex items-center justify-between
          ${diff === 0 ? 'bg-success-50 border border-success-200' : diff > 0 ? 'bg-secondary-50 border border-secondary-200' : 'bg-error-50 border border-error-200'}`}>
          <span className="text-sm font-medium flex items-center gap-2">
            {diff === 0 ? <Wallet size={16} className="text-success-600" /> : diff > 0 ? <TrendingUp size={16} className="text-secondary-600" /> : <TrendingDown size={16} className="text-error-600" />}
            الفرق
          </span>
          <span className={`text-lg font-bold nums ${diff === 0 ? 'text-success-700' : diff > 0 ? 'text-secondary-700' : 'text-error-700'}`}>
            {money(diff)}
          </span>
        </div>
      </div>
    </Modal>
  );
}
