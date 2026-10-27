import { useState } from 'react';
import { useStore } from '@/store';
import { Store, Lock, User as UserIcon } from 'lucide-react';

export function LoginScreen() {
  const { login, settings, toast } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!username || !password) {
      setErr('من فضلك أدخل اسم المستخدم وكلمة المرور');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const ok = login(username.trim(), password);
      if (!ok) {
        setErr('اسم المستخدم غير صحيح أو الحساب موقوف');
        setLoading(false);
      }
    }, 350);
  };

  const fill = (u: string) => {
    setUsername(u);
    setPassword('1234');
    setErr('');
  };

  return (
    <div className="min-h-screen flex items-stretch bg-ink-900">
      {/* Left panel */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-bl from-primary-600 via-primary-700 to-ink-900" />
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary-500/30 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-secondary-500/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3 text-white">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
              <Store size={26} />
            </div>
            <div>
              <p className="text-2xl font-bold">{settings.restaurantName}</p>
              <p className="text-white/60 text-sm">نظام إدارة المبيعات</p>
            </div>
          </div>
        </div>
        <div className="relative text-white/90 space-y-4">
          <h2 className="text-3xl font-bold leading-snug">
            أدِر مطعمك بالكامل<br />من مكان واحد
          </h2>
          <ul className="space-y-2.5 text-white/70">
            <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary-300" /> نقطة بيع سريعة لكل أنواع الطلبات</li>
            <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary-300" /> مخزون ووصفات ومشتريات متكاملة</li>
            <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary-300" /> تقارير وأرباح وورديات دقيقة</li>
          </ul>
        </div>
        <div className="relative text-white/40 text-xs">© {new Date().getFullYear()} {settings.restaurantName}</div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-ink-50">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-11 h-11 rounded-xl bg-primary-600 text-white flex items-center justify-center">
              <Store size={22} />
            </div>
            <p className="text-xl font-bold text-ink-800">{settings.restaurantName}</p>
          </div>

          <h1 className="text-2xl font-bold text-ink-800 mb-1">تسجيل الدخول</h1>
          <p className="text-sm text-ink-500 mb-6">ادخل بياناتك للوصول إلى لوحة التحكم</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">اسم المستخدم</label>
              <div className="relative">
                <UserIcon size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  className="input pr-10"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="اكتب اسم المستخدم"
                  autoFocus
                />
              </div>
            </div>
            <div>
              <label className="label">كلمة المرور</label>
              <div className="relative">
                <Lock size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="password"
                  className="input pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>

            {err && (
              <div className="rounded-xl bg-error-50 border border-error-200 px-3.5 py-2.5 text-sm text-error-700 animate-fade-in">
                {err}
              </div>
            )}

            <button type="submit" className="btn-primary w-full py-3 text-base" disabled={loading}>
              {loading ? 'جارٍ الدخول...' : 'دخول'}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-7">
            <p className="text-xs text-ink-400 mb-2 text-center">حسابات تجريبية — اضغط للدخول السريع</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { u: 'owner', l: 'المالك' },
                { u: 'manager', l: 'مدير' },
                { u: 'sara', l: 'كاشير — سارة' },
                { u: 'karim', l: 'كاشير — كريم' },
              ].map((d) => (
                <button
                  key={d.u}
                  onClick={() => fill(d.u)}
                  className="btn-outline text-xs py-2"
                >
                  {d.l}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-ink-400 mt-3 text-center">كلمة المرور للتجربة: 1234</p>
          </div>
        </div>
      </div>
    </div>
  );
}
