import { useState } from 'react';
import type { ContractInput, ContractStatus } from '../types';

const STATUS_OPTIONS: ContractStatus[] = ['draft', 'active', 'expired', 'terminated'];

interface Props {
  initialValues?: ContractInput;
  onSubmit: (values: ContractInput) => Promise<void>;
  submitLabel: string;
  onCancel: () => void;
}

const DEFAULT_VALUES: ContractInput = {
  title: '',
  customer_name: '',
  status: 'draft',
  content: '',
};

export default function ContractForm({ initialValues, onSubmit, submitLabel, onCancel }: Props) {
  const [values, setValues] = useState<ContractInput>(initialValues ?? DEFAULT_VALUES);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ContractInput>(key: K, value: ContractInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Contract Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={values.title}
          onChange={(e) => set('title', e.target.value)}
          required
          maxLength={200}
          placeholder="e.g. Master Services Agreement — Acme Corp"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Customer Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={values.customer_name}
          onChange={(e) => set('customer_name', e.target.value)}
          required
          maxLength={200}
          placeholder="e.g. Acme Corporation"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select
          value={values.status}
          onChange={(e) => set('status', e.target.value as ContractStatus)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Contract Content</label>
        <textarea
          value={values.content}
          onChange={(e) => set('content', e.target.value)}
          rows={12}
          maxLength={100_000}
          placeholder="Paste or type the full contract text here…"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
        />
        <p className="text-xs text-gray-400 mt-1">{values.content.length.toLocaleString()} / 100,000 chars</p>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-indigo-600 text-white text-sm px-5 py-2 rounded hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Saving…' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-white border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
