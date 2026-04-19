import React, { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Trash2, X, ShieldCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, type AdminUserRow } from '../lib/api';

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
};

export const DashboardUsers: React.FC = () => {
  const { token, user } = useAuth();

  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<AdminUserRow | null>(null);
  const [actionError, setActionError] = useState('');
  const [flash, setFlash] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.adminListAllUsers(token);
      setUsers(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!token || !confirmTarget) return;
    setDeleting(true);
    setActionError('');
    try {
      const res = await api.adminDeleteUser(token, confirmTarget.id);
      setFlash(`Deleted ${res.email}.`);
      setConfirmTarget(null);
      await load();
      setTimeout(() => setFlash(''), 4000);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete user.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardLayout title="Users">
      <div className="flex flex-col h-[calc(100vh-64px)] bg-white">
        <div className="px-6 py-4 border-b border-[#F1F1F0] flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-black">All Users</h1>
            <p className="text-xs text-black/60 mt-1">
              Permanently remove accounts. Deletes the user and every record linked to them.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 h-9 rounded-lg border border-black/10 text-sm font-medium hover:bg-black/5 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {flash && (
          <div className="mx-6 mt-4 px-4 py-2 rounded-lg bg-green-50 text-green-800 text-sm border border-green-200">
            {flash}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center text-sm text-black/50 py-12">Loading users…</div>
          ) : error ? (
            <div className="text-center text-sm text-red-500 py-12">{error}</div>
          ) : users.length === 0 ? (
            <div className="text-center text-sm text-black/50 py-12">No users registered.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-black/5">
              <table className="min-w-full text-sm">
                <thead className="bg-[#F4F4F4] text-xs uppercase tracking-wide text-black/60">
                  <tr>
                    <th className="text-left px-4 py-3">Name</th>
                    <th className="text-left px-4 py-3">Email</th>
                    <th className="text-left px-4 py-3">Role</th>
                    <th className="text-left px-4 py-3">Joined</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = user?.id === u.id;
                    return (
                      <tr key={u.id} className="border-t border-black/5 hover:bg-[#FAFAFA]">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-black flex items-center gap-2">
                            {u.full_name}
                            {u.is_admin && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#A409D2]/10 text-[#A409D2] text-[10px] font-bold uppercase">
                                <ShieldCheck size={10} /> Admin
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-black/50">{u.phone || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-black/80">{u.email}</td>
                        <td className="px-4 py-3 text-black/70 capitalize">{u.role}</td>
                        <td className="px-4 py-3 text-black/70">{formatDate(u.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          {isSelf ? (
                            <span className="text-xs text-black/40">You</span>
                          ) : (
                            <button
                              onClick={() => { setConfirmTarget(u); setActionError(''); }}
                              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200"
                            >
                              <Trash2 size={12} />
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {confirmTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => !deleting && setConfirmTarget(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/10">
              <h2 className="text-lg font-semibold text-black">Delete this user?</h2>
              <button
                onClick={() => !deleting && setConfirmTarget(null)}
                className="p-1 rounded hover:bg-black/5 disabled:opacity-50"
                disabled={deleting}
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-black/70">
                This permanently removes <span className="font-semibold text-black">{confirmTarget.email}</span> and
                every record linked to them — conversations, messages, applications, bookings, and payments.
                This cannot be undone.
              </p>
              {actionError && (
                <p className="text-red-500 text-xs">{actionError}</p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-black/10 flex justify-end gap-2">
              <button
                onClick={() => setConfirmTarget(null)}
                disabled={deleting}
                className="px-4 h-10 rounded-lg text-sm font-medium text-black/70 hover:bg-black/5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 h-10 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
