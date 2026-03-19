import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Clientes from './pages/Clientes'
import Propriedades from './pages/Propriedades'
import Pessoas from './pages/Pessoas'
import Maquinas from './pages/Maquinas'
import Visitas from './pages/Visitas'
import Negocios from './pages/Negocios'
import Dashboard from './pages/Dashboard'

// Supervisor
import SupervisorLogin from './supervisor/SupervisorLogin'
import SupervisorLayout from './supervisor/SupervisorLayout'
import SupervisorOverview from './supervisor/SupervisorOverview'
import SupervisorVendedores from './supervisor/SupervisorVendedores'
import SupervisorVisitas from './supervisor/SupervisorVisitas'
import SupervisorPosVendas from './supervisor/SupervisorPosVendas'
import SupervisorAlertas from './supervisor/SupervisorAlertas'

function ProtectedRoute({ children }) {
  const vendedor = localStorage.getItem('vendedor')
  if (!vendedor) return <Navigate to="/login" replace />
  return children
}

function SupervisorRoute({ children }) {
  const supervisor = localStorage.getItem('supervisor')
  if (!supervisor) return <Navigate to="/supervisor/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      {/* Vendedor */}
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="propriedades/:clienteId" element={<Propriedades />} />
        <Route path="pessoas/:propriedadeId" element={<Pessoas />} />
        <Route path="maquinas/:propriedadeId" element={<Maquinas />} />
        <Route path="visitas" element={<Visitas />} />
        <Route path="negocios" element={<Negocios />} />
      </Route>

      {/* Supervisor */}
      <Route path="/supervisor/login" element={<SupervisorLogin />} />
      <Route
        path="/supervisor"
        element={
          <SupervisorRoute>
            <SupervisorLayout />
          </SupervisorRoute>
        }
      >
        <Route index element={<SupervisorOverview />} />
        <Route path="vendedores" element={<SupervisorVendedores />} />
        <Route path="visitas" element={<SupervisorVisitas />} />
        <Route path="pos-vendas" element={<SupervisorPosVendas />} />
        <Route path="alertas" element={<SupervisorAlertas />} />
      </Route>
    </Routes>
  )
}
