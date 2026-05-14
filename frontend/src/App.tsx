import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import ContractList from './pages/ContractList';
import ContractNew from './pages/ContractNew';
import ContractDetail from './pages/ContractDetail';
import ContractEdit from './pages/ContractEdit';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link to="/" className="text-xl font-semibold text-indigo-700 tracking-tight">
              Agreement Hub
            </Link>
            <Link
              to="/contracts/new"
              className="text-sm bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition-colors"
            >
              + New Contract
            </Link>
          </div>
        </nav>

        <main className="max-w-5xl mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<ContractList />} />
            <Route path="/contracts/new" element={<ContractNew />} />
            <Route path="/contracts/:id" element={<ContractDetail />} />
            <Route path="/contracts/:id/edit" element={<ContractEdit />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
