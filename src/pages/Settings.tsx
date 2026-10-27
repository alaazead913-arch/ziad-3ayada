import { useState } from 'react';
import { useStore } from '@/store';
import type { PaymentMethod, PaymentMethodId } from '@/types';
import { PageHeader, ConfirmDialog } from '@/components/ui';
import { uid } from '@/lib/format';
import { Store, Phone, MapPin, Percent, DollarSign, Receipt, Save, Plus, Trash2, TriangleAlert as AlertTriangle, FileSliders as Sliders, Webhook, Copy, Check, Menu as MenuIcon, ShoppingCart } from 'lucide-react';

export function SettingsPage() {
  const { settings, setSettings, can, toast, logAction } = useStore();
  const [form, setForm] = useState(settings);
  const [deleteMethod, setDeleteMethod] = useState<PaymentMethod | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(settings);

  const update = <K extends keyof typeof form>(key: K, value: typeof form[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addMethod = () => {
    const id = `pm_${uid()}`;
    update('paymentMethods', [...form.paymentMethods, { id: id as PaymentMethodId, name: 'طريقة جديدة', accountName: '' }]);
  };
  const updateMethod = (idx: number, field: 'name' | 'accountName', val: string) => {
    update('paymentMethods', form.paymentMethods.map((m, i) => i === idx ? { ...m, [field]: val } : m));
  };
  const removeMethod = (idx: number) => {
    setDeleteMethod(form.paymentMethods[idx]);
  };
  const confirmRemove = () => {
    if (!deleteMethod) return;
    update('paymentMethods', form.paymentMethods.filter((m) => m.id !== deleteMethod.id));
    setDeleteMethod(null);
  };

  const save = () => {
    setSettings(form);
    logAction('تعديل الإعدادات', 'إعدادات المطعم');
    toast('success', 'تم حفظ الإعدادات بنجاح');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="الإعدادات"
        subtitle="إعدادات المطعم والضريبة وطرق الدفع"
        action={can('manage_settings') && dirty && (
          <button className="btn-primary" onClick={save}>
            <Save size={18} /> حفظ التغييرات
          </button>
        )}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Restaurant info */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center"><Store size={18} /></div>
            <h3 className="font-bold text-ink-800">بيانات المطعم</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="label">اسم المطعم</label>
              <input className="input" value={form.restaurantName} onChange={(e) => update('restaurantName', e.target.value)} disabled={!can('manage_settings')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label"><Phone size={14} className="inline ml-1" /> الهاتف</label>
                <input className="input nums" value={form.phone} onChange={(e) => update('phone', e.target.value)} disabled={!can('manage_settings')} />
              </div>
              <div>
                <label className="label"><DollarSign size={14} className="inline ml-1" /> العملة</label>
                <input className="input" value={form.currency} onChange={(e) => update('currency', e.target.value)} disabled={!can('manage_settings')} />
              </div>
            </div>
            <div>
              <label className="label"><MapPin size={14} className="inline ml-1" /> العنوان</label>
              <input className="input" value={form.address} onChange={(e) => update('address', e.target.value)} disabled={!can('manage_settings')} />
            </div>
          </div>
        </div>

        {/* Tax & inventory */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-lg bg-warning-50 text-warning-600 flex items-center justify-center"><Percent size={18} /></div>
            <h3 className="font-bold text-ink-800">الضريبة والمخزون</h3>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">نسبة الضريبة (٪)</label>
                <input type="number" className="input nums" value={form.taxRate} onChange={(e) => update('taxRate', Number(e.target.value) || 0)} disabled={!can('manage_settings')} />
              </div>
              <div>
                <label className="label">حد تنبيه النقص</label>
                <input type="number" className="input nums" value={form.lowStockThreshold} onChange={(e) => update('lowStockThreshold', Number(e.target.value) || 0)} disabled={!can('manage_settings')} />
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer mt-2">
              <input type="checkbox" checked={form.taxInclusive} onChange={(e) => update('taxInclusive', e.target.checked)} className="w-5 h-5 rounded accent-primary-600" disabled={!can('manage_settings')} />
              <span className="text-sm font-medium text-ink-700">الأسعار شاملة الضريبة</span>
            </label>
            <div className="rounded-xl bg-ink-50 p-3 text-xs text-ink-500 flex items-start gap-2">
              <AlertTriangle size={14} className="text-warning-500 shrink-0 mt-0.5" />
              <span>عند تفعيل "شاملة الضريبة"، تُحتسب الضريبة كقيمة مخصومة من السعر وليست إضافة عليه.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Print footer */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-lg bg-secondary-50 text-secondary-600 flex items-center justify-center"><Receipt size={18} /></div>
          <h3 className="font-bold text-ink-800">إعدادات الطباعة</h3>
        </div>
        <div>
          <label className="label">نص أسفل الفاتورة</label>
          <input className="input" value={form.printFooter} onChange={(e) => update('printFooter', e.target.value)} disabled={!can('manage_settings')} />
        </div>
      </div>

      {/* Chatbot APIs */}
      <ApiSection />

      {/* Payment methods */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-accent-50 text-accent-600 flex items-center justify-center"><Sliders size={18} /></div>
            <h3 className="font-bold text-ink-800">طرق الدفع</h3>
          </div>
          {can('manage_settings') && (
            <button onClick={addMethod} className="btn-ghost text-primary-600 text-sm">
              <Plus size={16} /> إضافة طريقة
            </button>
          )}
        </div>
        <div className="space-y-2">
          {form.paymentMethods.map((m, i) => (
            <div key={m.id} className="flex items-center gap-2">
              <input className="input flex-1" value={m.name} onChange={(e) => updateMethod(i, 'name', e.target.value)} disabled={!can('manage_settings')} placeholder="اسم الطريقة" />
              <input className="input flex-1" value={m.accountName} onChange={(e) => updateMethod(i, 'accountName', e.target.value)} disabled={!can('manage_settings')} placeholder="اسم الحساب" />
              {can('manage_settings') && form.paymentMethods.length > 1 && (
                <button onClick={() => removeMethod(i)} className="text-error-500 p-1.5 hover:bg-error-50 rounded-lg">
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteMethod}
        onClose={() => setDeleteMethod(null)}
        onConfirm={confirmRemove}
        title="حذف طريقة دفع"
        message={`هل تريد حذف طريقة الدفع "${deleteMethod?.name}"؟`}
        confirmLabel="حذف"
        danger
      />
    </div>
  );
}

// ============================================================================
// Chatbot API section — shows the two endpoints + curl commands
// ============================================================================
const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button onClick={copy} className="btn-ghost p-1.5 text-ink-400 hover:text-primary-600 shrink-0" title="نسخ">
      {copied ? <Check size={15} className="text-success-600" /> : <Copy size={15} />}
    </button>
  );
}

function CurlCard({
  icon, title, method, url, curl, badge,
}: {
  icon: React.ReactNode;
  title: string;
  method: 'GET' | 'POST';
  url: string;
  curl: string;
  badge: string;
}) {
  const methodColor = method === 'GET' ? 'bg-secondary-100 text-secondary-700' : 'bg-success-100 text-success-700';
  return (
    <div className="rounded-xl border border-ink-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-ink-50 border-b border-ink-100">
        <span className="text-primary-600">{icon}</span>
        <span className="font-semibold text-ink-800 text-sm">{title}</span>
        <span className={`chip ${methodColor} mr-auto nums`}>{method}</span>
        <span className="chip bg-ink-100 text-ink-500">{badge}</span>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <p className="text-xs text-ink-400 mb-1">رابط الـ API</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs nums bg-ink-50 rounded-lg px-3 py-2 text-ink-700 break-all ltr text-left" dir="ltr">{url}</code>
            <CopyButton text={url} />
          </div>
        </div>
        <div>
          <p className="text-xs text-ink-400 mb-1">أمر curl</p>
          <div className="flex items-start gap-2">
            <pre className="flex-1 text-xs nums bg-ink-900 text-ink-100 rounded-lg px-3 py-2.5 overflow-x-auto leading-relaxed ltr text-left" dir="ltr">{curl}</pre>
            <CopyButton text={curl} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ApiSection() {
  const menuUrl = `${API_BASE}/chatbot-menu`;
  const orderUrl = `${API_BASE}/chatbot-create-order`;

  const menuCurl = `curl -X GET "${menuUrl}" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer ${ANON_KEY}"`;

  const orderCurl = `curl -X POST "${orderUrl}" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer ${ANON_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "takeaway",
    "items": [
      { "product_id": "b0000000-0000-0000-0000-000000000001", "qty": 2, "note": "بدون بصل" }
    ],
    "customer_name": "اسم العميل"
  }'`;

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center"><Webhook size={18} /></div>
        <h3 className="font-bold text-ink-800">واجهات الشات بوت (API)</h3>
      </div>
      <p className="text-sm text-ink-500 mb-4">
        رابطان جاهزان للاستخدام في n8n أو أي أداة أتمتة — واحد لسحب المنيو وآخر لتسجيل الطلبات. استخدم مفتاح الـ anon في الترويسات.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CurlCard
          icon={<MenuIcon size={16} />}
          title="سحب المنيو"
          method="GET"
          url={menuUrl}
          curl={menuCurl}
          badge="للقراءة"
        />
        <CurlCard
          icon={<ShoppingCart size={16} />}
          title="تسجيل طلب"
          method="POST"
          url={orderUrl}
          curl={orderCurl}
          badge="للكتابة"
        />
      </div>

      <div className="mt-4 rounded-xl bg-ink-50 p-3 text-xs text-ink-500 flex items-start gap-2">
        <AlertTriangle size={14} className="text-warning-500 shrink-0 mt-0.5" />
        <span>
          مفتاح الـ anon آمن للاستخدام من جانب العميل ولا يمنح صلاحيات إدارية. الطلبات المسجلة عبر الـ API تظهر في قاعدة البيانات بمصدر «chatbot».
        </span>
      </div>
    </div>
  );
}
