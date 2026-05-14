import { useNavigate, Link } from 'react-router-dom';
import { createContract } from '../api';
import type { ContractInput } from '../types';
import ContractForm from '../components/ContractForm';

export default function ContractNew() {
  const navigate = useNavigate();

  async function handleSubmit(values: ContractInput) {
    const created = await createContract(values);
    navigate(`/contracts/${created.id}`);
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link to="/" className="hover:text-indigo-600">Contracts</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">New Contract</span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">New Contract</h1>
        <ContractForm
          submitLabel="Create Contract"
          onSubmit={handleSubmit}
          onCancel={() => navigate('/')}
        />
      </div>
    </div>
  );
}
