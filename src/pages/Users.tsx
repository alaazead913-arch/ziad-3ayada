import { useState, useMemo } from 'react';
import { useStore } from '@/store';
import type { User, Role, PermissionKey } from '@/types';
import { fmtDate, ALL_PERMISSIONS, ROLE_LABELS, uid } from '@/lib/format';
import { PageHeader, Modal, ConfirmDialog, EmptyState, Badge } from '@/components/ui';
import {
  Plus, Search, Pencil, Trash2, Users as UsersIcon, UserPlus,
  Shield, UserCheck, UserX,
} from 'lucide-react';

const ROLE_COLORS: Record<Role, string> = {
  owner: 'bg-primary-100 text-primary-700',
  manager: 'bg-secondary-100 text-secondary-700',
  cashier: 'bg-accent-100 text-accent-700',
  waiter: 'bg-warning-100 text-warning-700',
};

export function UsersPage() {
  const { users, can, toast, setUsers, logAction, currentUser } = useStore();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const filtered = useMemo(() => {
    let r = users;
    if (roleFilter !== 'all') r = r.filter((u) => u.role === roleFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((u) => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
    }
    return r;
  }, [users, search, roleFilter]);

  const handleSave = (user: User) => {
    if (editing) {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? user : u)));
      logAction('تعديل مستخدم', user.name);
      toast('success', 'تم تحديث بيانات المستخدم');
    } else {
      setUsers((prev) => [user, ...prev]);
      logAction('إضافة مستخدم', user.name);
      toast('success', 'تم إضافة المستخدم');
    }
    setEditing(null);
    setCreating(false);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.id === currentUser?.id) {
      toast('error', 'لا يمكنك حذف حسابك الحالي');
      setDeleteTarget(null);
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
    logAction('حذف مستخدم', deleteTarget.name);
    toast('success', 'تم حذف المستخدم');
    setDeleteTarget(null);
  };

  const toggleActive = (user: User) => {
    if (user.id === currentUser?.id) {
      toast('error', 'لا يمكنك إيقاف حسابك الحالي');
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, active: !u.active } : u)));
    logAction(user.active ? 'إيقاف مستخدم' : 'تفعيل مستخدم', user.name);
    toast('success', user.active ? 'تم إيقاف المستخدم' : 'تم تفعيل المستخدم');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="المستخدمون"
        subtitle={`${users.length} مستخدم`}
        action={can('manage_users') && (
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <Plus size={18} /> مستخدم جديد
          </button>
        )}
      />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي المستخدمين', value: users.length, icon: <UsersIcon size={18} />, color: 'text-primary-600 bg-primary-50' },
          { label: 'نشطون', value: users.filter((u) => u.active).length, icon: <UserCheck size={18} />, color: 'text-success-600 bg-success-50' },
          { label: 'موقوفون', value: users.filter((u) => !u.active).length, icon: <UserX size={18} />, color: 'text-error-600 bg-error-50' },
          { label: 'مديرون', value: users.filter((u) => u.role === 'owner' || u.role === 'manager').length, icon: <Shield size={18} />, color: 'text-secondary-600 bg-secondary-50' },
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
          <input className="input pr-10" placeholder="ابحث بالاسم أو اسم المستخدم..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-1.5">
          {['all', 'owner', 'manager', 'cashier', 'waiter'].map((r) => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`chip ${roleFilter === r ? 'bg-primary-600 text-white' : 'bg-ink-100 text-ink-600'}`}>
              {r === 'all' ? 'الكل' : ROLE_LABELS[r as Role]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={<UsersIcon size={26} />} title="لا يوجد مستخدمون" hint="ابدأ بإضافة مستخدم جديد" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-500 text-xs">
                <tr>
                  <th className="text-right font-semibold px-4 py-3">الاسم</th>
                  <th className="text-right font-semibold px-4 py-3">اسم المستخدم</th>
                  <th className="text-right font-semibold px-4 py-3">الدور</th>
                  <th className="text-right font-semibold px-4 py-3">الصلاحيات</th>
                  <th className="text-right font-semibold px-4 py-3">الحالة</th>
                  <th className="text-right font-semibold px-4 py-3">تاريخ الإنشاء</th>
                  <th className="text-center font-semibold px-4 py-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="table-row">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold shrink-0">
                          {u.name.charAt(0)}
                        </div>
                        <span className="font-semibold text-ink-800">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-600 nums">@{u.username}</td>
                    <td className="px-4 py-3"><Badge className={ROLE_COLORS[u.role]}>{ROLE_LABELS[u.role]}</Badge></td>
                    <td className="px-4 py-3 text-ink-500 nums">
                      {u.role === 'owner' ? 'كل الصلاحيات' : `${u.permissions.length} صلاحية`}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => can('manage_users') && toggleActive(u)}
                        disabled={!can('manage_users')}
                        className={u.active ? 'chip bg-success-100 text-success-700' : 'chip bg-error-100 text-error-700'}
                      >
                        {u.active ? <><UserCheck size={12} /> نشط</> : <><UserX size={12} /> موقوف</>}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-ink-500 nums">{fmtDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setEditing(u)} className="p-1.5 text-ink-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition">
                          <Pencil size={16} />
                        </button>
                        {can('manage_users') && (
                          <button onClick={() => setDeleteTarget(u)} className="p-1.5 text-ink-400 hover:text-error-600 hover:bg-error-50 rounded-lg transition">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form */}
      {(editing || creating) && (
        <UserForm
          user={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSave={handleSave}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="حذف مستخدم"
        message={`هل تريد حذف المستخدم "${deleteTarget?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="حذف"
        danger
      />
    </div>
  );
}

function UserForm({
  user, onClose, onSave,
}: {
  user: User | null;
  onClose: () => void;
  onSave: (u: User) => void;
}) {
  const [name, setName] = useState(user?.name ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [role, setRole] = useState<Role>(user?.role ?? 'cashier');
  const [active, setActive] = useState(user?.active ?? true);
  const [perms, setPerms] = useState<PermissionKey[]>(user?.permissions ?? []);

  const togglePerm = (key: PermissionKey) => {
    setPerms((prev) => prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]);
  };

  const save = () => {
    if (!name.trim() || !username.trim()) return;
    onSave({
      id: user?.id ?? uid2('u'),
      name: name.trim(),
      username: username.trim(),
      role,
      active,
      permissions: role === 'owner' ? ALL_PERMISSIONS.map((p) => p.key) : perms,
      createdAt: user?.createdAt ?? new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={user ? `تعديل: ${user.name}` : 'مستخدم جديد'}
      size="lg"
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>إلغاء</button>
          <button className="btn-primary" onClick={save} disabled={!name.trim() || !username.trim()}>
            {user ? 'حفظ' : 'إضافة'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">الاسم الكامل</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الكامل..." />
          </div>
          <div>
            <label className="label">اسم المستخدم</label>
            <input className="input nums" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" />
          </div>
          <div>
            <label className="label">الدور</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer pb-2">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-5 h-5 rounded accent-primary-600" />
              <span className="text-sm font-medium text-ink-700">حساب نشط</span>
            </label>
          </div>
        </div>

        {role !== 'owner' && (
          <div>
            <label className="label">الصلاحيات</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ALL_PERMISSIONS.map((p) => {
                const sel = perms.includes(p.key);
                return (
                  <button
                    key={p.key}
                    onClick={() => togglePerm(p.key)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-medium text-right transition
                      ${sel ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-ink-200 text-ink-600 hover:bg-ink-50'}`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {role === 'owner' && (
          <div className="rounded-xl bg-primary-50 border border-primary-100 px-4 py-3 text-sm text-primary-700">
            المالك لديه جميع الصلاحيات تلقائياً.
          </div>
        )}
      </div>
    </Modal>
  );
}

function uid2(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
