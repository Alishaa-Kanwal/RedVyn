"use client";

import { useMemo, useState } from "react";
import { Eye, Loader2, Phone, Plus, RefreshCcw, Search, UserRound, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { StatusPill } from "./status-pill";
import { Pagination } from "./pagination";
import { SlideOver } from "./slide-over";
import { Modal } from "./modal";
import {
  useRegistryList,
  useRegistryDetail,
  useRegistryCreate,
  useRegistryUpdateStatus,
  useRegistryRevealPhone,
  useRegistryUpdateItem,
} from "@/hooks/use-registry";
import { cn } from "@/lib/utils";

function TableSkeleton({ columns }) {
  return (
    <>
      {[...Array(5)].map((_, rowIdx) => (
        <tr key={rowIdx} className="border-b border-border last:border-b-0">
          {columns.map((_, colIdx) => (
            <td key={colIdx} className="px-4 py-3">
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
            </td>
          ))}
          <td className="px-4 py-3">
            <div className="h-8 w-20 animate-pulse rounded-full bg-muted" />
          </td>
        </tr>
      ))}
    </>
  );
}

function EmptyState({ entityName, onAdd, canCreate }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <UserRound className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">No {entityName.toLowerCase()}s yet</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Add the first {entityName.toLowerCase()} to the registry to get started.
      </p>
      {canCreate && (
        <Button className="mt-5 bg-primary text-primary-foreground hover:bg-primary/90" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add {entityName}
        </Button>
      )}
    </div>
  );
}

function InlineError({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
      <p className="text-sm text-muted-foreground">
        {error?.message || "Unable to load data."}
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        <RefreshCcw className="mr-2 h-4 w-4" />
        Retry
      </Button>
    </div>
  );
}

export function RegistryPage({ config }) {
  const { user } = useAuth();
  const role = user?.role;

  const {
    data,
    pagination,
    loading: listLoading,
    error: listError,
    refresh: refreshList,
    page,
    setPage,
    pageSize,
    filters,
    setFilters,
  } = useRegistryList(config.basePath, config.initialFilters);

  const [selectedId, setSelectedId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [revealedPhone, setRevealedPhone] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  const {
    data: detailData,
    loading: detailLoading,
    error: detailError,
    refresh: refreshDetail,
  } = useRegistryDetail(config.basePath, selectedId);

  const create = useRegistryCreate();
  const updateStatus = useRegistryUpdateStatus();
  const revealPhone = useRegistryRevealPhone();
  const updateItem = useRegistryUpdateItem();

  const selectedItem = useMemo(() => {
    if (!detailData) return null;
    return config.detailKey ? detailData[config.detailKey] : detailData;
  }, [detailData, config.detailKey]);

  function selectItem(id) {
    setRevealedPhone(null);
    setActionError(null);
    setSelectedId(id);
  }

  function closeDetail() {
    setRevealedPhone(null);
    setActionError(null);
    setSelectedId(null);
  }

  const canCreate = config.canCreate(role);
  const canChangeStatus = config.canChangeStatus?.(role) ?? false;
  const canReveal = config.reveal ? config.canReveal?.(role) ?? false : false;
  const canEdit = config.EditForm ? config.canEdit?.(role) ?? false : false;

  async function handleCreate(body) {
    setActionError(null);
    try {
      await create(config.basePath, body);
      await refreshList();
      setCreateOpen(false);
    } catch (err) {
      throw err;
    }
  }

  async function handleStatusChange(id, status) {
    setActionError(null);
    setUpdatingStatusId(id);
    try {
      await updateStatus(config.basePath, id, status);
      await refreshList();
      if (selectedId === id) refreshDetail();
    } catch (err) {
      setActionError(err.message || "Could not update status");
    } finally {
      setUpdatingStatusId(null);
    }
  }

  async function handleReveal(id) {
    setActionError(null);
    try {
      const res = await revealPhone(config.basePath, id, config.reveal.type);
      setRevealedPhone(res.phone);
      if (selectedId !== id) selectItem(id);
    } catch (err) {
      setActionError(err.message || "Could not reveal phone");
    }
  }

  async function handleEdit(body) {
    setActionError(null);
    try {
      await updateItem(config.basePath, editingItem.id, body);
      await refreshList();
      if (selectedId === editingItem.id) refreshDetail();
      setEditingItem(null);
    } catch (err) {
      const message = err.message || "Could not update record";
      setActionError(message);
      throw new Error(message);
    }
  }

  const CreateForm = config.CreateForm;
  const EditForm = config.EditForm;

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const columnsWithActions = [
    ...config.columns,
    { key: "actions", header: "Actions", className: "w-40" },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">{config.title}</h1>
        {canCreate && (
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add {config.entityName}
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {config.filters.map((filter) =>
          filter.type === "search" ? (
            <div
              key={filter.key}
              className="flex flex-1 basis-48 items-center rounded-full border border-border bg-card px-3 py-2"
            >
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={filter.placeholder || "Search..."}
                value={filters[filter.key] || ""}
                onChange={(e) => updateFilter(filter.key, e.target.value)}
                className="ml-2 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
          ) : filter.type === "select" ? (
            <select
              key={filter.key}
              value={filters[filter.key] || ""}
              onChange={(e) => updateFilter(filter.key, e.target.value)}
              className="h-10 rounded-full border border-border bg-card px-3 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">{filter.label}</option>
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              key={filter.key}
              type="text"
              placeholder={filter.placeholder}
              value={filters[filter.key] || ""}
              onChange={(e) => updateFilter(filter.key, e.target.value)}
              className="h-10 rounded-full border border-border bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          ),
        )}
      </div>

      {/* Table card */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                {columnsWithActions.map((col) => (
                  <th
                    key={col.key}
                    className={cn("px-4 py-3 text-xs font-semibold uppercase tracking-wide", col.className)}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {listLoading ? (
                <TableSkeleton columns={config.columns} />
              ) : listError ? (
                <tr>
                  <td colSpan={columnsWithActions.length} className="px-4 py-8">
                    <InlineError error={listError} onRetry={refreshList} />
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columnsWithActions.length} className="px-4 py-8">
                    <EmptyState
                      entityName={config.entityName}
                      onAdd={() => setCreateOpen(true)}
                      canCreate={canCreate}
                    />
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-muted/30"
                  >
                    {config.columns.map((col) => (
                      <td key={col.key} className={cn("px-4 py-3 text-foreground", col.className)}>
                        {col.render ? col.render(item) : item[col.key] ?? "—"}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => selectItem(item.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted"
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {canReveal && (
                          <button
                            type="button"
                            onClick={() => handleReveal(item.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted"
                            title={`Reveal ${config.reveal.label}`}
                          >
                            <Phone className="h-4 w-4" />
                          </button>
                        )}

                        {canEdit && EditForm && (
                          <button
                            type="button"
                            onClick={() => setEditingItem(item)}
                            className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                          >
                            Edit
                          </button>
                        )}

                        {canChangeStatus && config.statusOptions && (
                          <select
                            value={item[config.statusField || "status"] || ""}
                            disabled={updatingStatusId === item.id}
                            onChange={(e) => handleStatusChange(item.id, e.target.value)}
                            className="h-8 rounded-full border border-border bg-card px-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                          >
                            {config.statusOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!listLoading && !listError && data.length > 0 && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={pagination.total}
            onChange={setPage}
          />
        )}
      </div>

      {/* Detail slide-over */}
      <SlideOver
        open={!!selectedId}
        onClose={closeDetail}
        title={selectedItem ? config.detailTitle(selectedItem) : config.title}
      >
        {detailLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : detailError ? (
          <InlineError error={detailError} onRetry={refreshDetail} />
        ) : selectedItem ? (
          <div className="space-y-5">
            {actionError && (
              <div className="rounded-xl bg-destructive/10 px-4 py-2 text-sm text-destructive">
                {actionError}
              </div>
            )}

            <div className="space-y-3">
              {config.detailFields.map((field, idx) => (
                <div key={idx}>
                  <p className="text-xs font-medium text-muted-foreground">{field.label}</p>
                  {/* A div, not a p: `render` fields return whole panels (lists, forms,
                      buttons), and block content inside a <p> is a hydration error. */}
                  <div className="text-sm font-semibold text-foreground">
                    {field.render
                      ? field.render(selectedItem)
                      : field.format
                        ? field.format(selectedItem[field.key])
                        : selectedItem[field.key] ?? "—"}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-5">
              {canReveal && (
                <>
                  {revealedPhone ? (
                    <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      {revealedPhone}
                      <button
                        type="button"
                        onClick={() => setRevealedPhone(null)}
                        className="ml-1"
                        aria-label="Hide phone"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-primary text-primary hover:bg-primary/10"
                      onClick={() => handleReveal(selectedItem.id)}
                    >
                      <Phone className="mr-2 h-4 w-4" />
                      Reveal {config.reveal.label}
                    </Button>
                  )}
                </>
              )}

              {canChangeStatus && config.statusOptions && (
                <select
                  value={selectedItem[config.statusField || "status"] || ""}
                  disabled={updatingStatusId === selectedItem.id}
                  onChange={(e) => handleStatusChange(selectedItem.id, e.target.value)}
                  className="h-9 rounded-full border border-border bg-card px-3 text-sm font-medium text-foreground focus:border-primary focus:outline-none"
                >
                  {config.statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}

              {canEdit && EditForm && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-primary text-primary hover:bg-primary/10"
                  onClick={() => setEditingItem(selectedItem)}
                >
                  Edit
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </SlideOver>

      {/* Create modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={`Add ${config.entityName}`}
      >
        {CreateForm && (
          <CreateForm
            onSubmit={handleCreate}
            onCancel={() => setCreateOpen(false)}
          />
        )}
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        title={`Edit ${config.entityName}`}
      >
        {editingItem && EditForm && (
          <EditForm
            item={editingItem}
            onSubmit={handleEdit}
            onCancel={() => setEditingItem(null)}
          />
        )}
      </Modal>
    </div>
  );
}
