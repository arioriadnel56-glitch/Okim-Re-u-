import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ChangePassword from './pages/ChangePassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Sessions from './pages/Sessions.jsx';
import SessionNew from './pages/SessionNew.jsx';
import SessionDetail from './pages/SessionDetail.jsx';
import Receipts from './pages/Receipts.jsx';
import ReceiptDetail from './pages/ReceiptDetail.jsx';
import Sites from './pages/Sites.jsx';
import Staff from './pages/Staff.jsx';
import ClientPortal from './pages/ClientPortal.jsx';
import PublicVerify from './pages/PublicVerify.jsx';

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/connexion" element={<Login />} />
      <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
      <Route path="/verifier/:code" element={<PublicVerify />} />

      <Route path="/changer-mot-de-passe" element={
        <ProtectedRoute><ChangePassword /></ProtectedRoute>
      } />

      <Route path="/" element={
        <ProtectedRoute>
          {user?.role === 'client' ? <ClientPortal /> : <Dashboard />}
        </ProtectedRoute>
      } />

      <Route path="/sessions" element={
        <ProtectedRoute roles={['staff', 'super_admin']}><Sessions /></ProtectedRoute>
      } />
      <Route path="/sessions/nouvelle" element={
        <ProtectedRoute roles={['staff', 'super_admin']}><SessionNew /></ProtectedRoute>
      } />
      <Route path="/sessions/:id" element={
        <ProtectedRoute roles={['staff', 'super_admin']}><SessionDetail /></ProtectedRoute>
      } />

      <Route path="/receipts" element={
        <ProtectedRoute roles={['staff', 'super_admin']}><Receipts /></ProtectedRoute>
      } />
      <Route path="/receipts/:id" element={
        <ProtectedRoute><ReceiptDetail /></ProtectedRoute>
      } />

      <Route path="/sites" element={
        <ProtectedRoute roles={['super_admin']}><Sites /></ProtectedRoute>
      } />
      <Route path="/staff" element={
        <ProtectedRoute roles={['super_admin']}><Staff /></ProtectedRoute>
      } />

      <Route path="*" element={
        <div className="min-h-screen flex items-center justify-center text-stone-400 text-sm">
          Page introuvable.
        </div>
      } />
    </Routes>
  );
}
