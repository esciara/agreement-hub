import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getContract, updateContract } from '../api';
import type { Contract, ContractInput } from '../types';
import ContractForm from '../components/ContractForm';

export default function ContractEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getContract(id)
      .then(setContract)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(values: ContractInput) {
    if (!id) return;
    await updateContract(id, values);
    navigate(`/contracts/${id}`);
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

  const initialValues: ContractInput = {
    title: contract.title,
    customer_name: contract.customer_name,
    status: contract.status,
    content: contract.content,
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link to="/" className="hover:text-indigo-600">Contracts</Link>
        <span>/</span>
        <Link to={`/contracts/${id}`} className="hover:text-indigo-600">{contract.title}</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">Edit</span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Edit Contract</h1>
        <ContractForm
          initialValues={initialValues}
          submitLabel="Save Changes"
          onSubmit={handleSubmit}
          onCancel={() => navigate(`/contracts/${id}`)}
        />
      </div>
    </div>
  );
}
