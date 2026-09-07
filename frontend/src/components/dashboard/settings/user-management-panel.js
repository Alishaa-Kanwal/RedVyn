"use client";

import { useCallback, useState } from "react";
import { Loader2, RefreshCcw, UserPlus } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/dashboard/form-fields";
import { formatDate } from "@/lib/registry-config";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

function InlineError({ error, onRetry }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
      <p className="text-sm text-muted-foreground">{error?.message || "Could not load users."}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        <RefreshCcw className="h-4 w-4" />
        Retry
      </button>
    </div>
  );
}

function AddUserForm({ onSuccess, onCancel }) {
  const [form, setForm] = useState({ email: "", name: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/auth/admin/users", {
        method: "POST",
        body: JSON.stringify({ ...form, role: "admin" }),
      });
      toast.success("Admin user created.");
      onSuccess();
    } catch (err) {
      setError(err.message || "Could not create user.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <FormInput
        id="user-name"
        label="Name"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        required
      />
      <FormInput
        id="user-email"
        label="Email"
        type="email"
        value={form.email}
        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        required
      />
      <FormInput
        id="user-password"
        label="Password"
        type="password"
        value={form.password}
        onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
        required
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create
        </Button>
      </div>
    </form>
  );
}

export function UserManagementPanel() {
  const { data, loading, error, refresh } = useApi("/api/auth/admin/users");
  const [showForm, setShowForm] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const users = data?.data || [];

  const toggleStatus = useCallback(
    async (id, isActive) => {
      setUpdatingId(id);
      try {
        await apiFetch(`/api/auth/admin/users/${id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ isActive }),
        });
        toast.success(isActive ? "User activated." : "User deactivated.");
        refresh();
      } catch (err) {
        toast.error(err.message || "Could not update status.");
      } finally {
        setUpdatingId(null);
      }
    },
    [refresh]
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-foreground">User Management</h2>
          <p className="text-sm text-muted-foreground">Manage admin users.</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <UserPlus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      {error && <InlineError error={error} onRetry={refresh} />}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Role</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Last Login</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    <p className="mt-2 text-sm">Loading users…</p>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-foreground">{user.name}</td>
                    <td className="px-4 py-3 text-foreground">{user.email}</td>
                    <td className="px-4 py-3 capitalize text-foreground">{user.role}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          user.isActive
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.lastLoginAt ? formatDate(user.lastLoginAt) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={updatingId === user.id}
                        onClick={() => toggleStatus(user.id, !user.isActive)}
                        className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
                      >
                        {user.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-foreground">Add User</h3>
          <AddUserForm onSuccess={() => { refresh(); setShowForm(false); }} onCancel={() => setShowForm(false)} />
        </div>
      )}
    </div>
  );
}
