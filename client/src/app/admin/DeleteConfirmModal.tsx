"use client";

interface Props {
  isOpen: boolean;
  componentName?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function DeleteConfirmModal({
  isOpen,
  componentName,
  onConfirm,
  onCancel,
  loading = false,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
          <span className="text-xl font-bold text-red-400">!</span>
        </div>

        <h2 className="text-lg font-semibold text-white">Delete Component</h2>
        <p className="mt-2 text-sm text-slate-400">
          Are you sure you want to delete{" "}
          <span className="font-medium text-white">
            {componentName ?? "this component"}
          </span>
          ? This action cannot be undone.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            id="delete-cancel-btn"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            id="delete-confirm-btn"
            onClick={onConfirm}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-500/20 transition hover:bg-red-400 disabled:opacity-60"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Deleting…
              </>
            ) : (
              "Delete"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
