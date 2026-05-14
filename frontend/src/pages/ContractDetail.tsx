import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getContract, deleteContract } from '../api';
import type { Contract } from '../types';
import StatusBadge from '../components/StatusBadge';

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    getContract(id)
      .then(setContract)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!id || !window.confirm('Delete this contract? This action cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteContract(id);
      navigate('/');
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
    }
  }

  if (loading) {
    return <p className="text-gray-500 text-sm">Loading contract…</p>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded p-4 text-sm">
        {error}
      </div>
    );
  }

  if (!contract) return null;

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link to="/" className="hover:text-indigo-600">Contracts</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{contract.title}</span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-1">{contract.title}</h1>
            <p className="text-gray-500 text-sm">
              {contract.customer_name} &middot; Created {new Date(contract.created_at).toLocaleString()}
            </p>
          </div>
          <StatusBadge status={contract.status} />
        </div>

        <div className="mb-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Contract Content
          </h2>
          {contract.content ? (
            <div className="bg-gray-50 rounded border border-gray-200 p-4 text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
              {contract.content}
            </div>
          ) : (
            <p className="text-gray-400 text-sm italic">No content provided.</p>
          )}
        </div>

        <div className="flex gap-3">
          <Link
            to={`/contracts/${contract.id}/edit`}
            className="bg-indigo-600 text-white text-sm px-4 py-2 rounded hover:bg-indigo-700 transition-colors"
          >
            Edit Contract
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="bg-white border border-red-300 text-red-600 text-sm px-4 py-2 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete Contract'}
          </button>
          <Link
            to="/"
            className="bg-white border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded hover:bg-gray-50 transition-colors"
          >
            Back to List
          </Link>
        </div>
      </div>
    </div>
  );
}
