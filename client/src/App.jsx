import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Inventory from './pages/Inventory.jsx';
import Departments from './pages/Departments.jsx';
import PurchaseOrders from './pages/PurchaseOrders.jsx';
import ChargeOuts from './pages/ChargeOuts.jsx';
import Reports from './pages/Reports.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="departments" element={<Departments />} />
          <Route path="purchase-orders" element={<PurchaseOrders />} />
          <Route path="charge-outs" element={<ChargeOuts />} />
          <Route path="reports" element={<Reports />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
