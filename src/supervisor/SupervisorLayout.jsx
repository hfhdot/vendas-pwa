import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/sync'

const navItems = [
  { to: '/supervisor', label: 'Geral', end: true },
  { to: '/supervisor/vendedores', label: 'Vendedores' },
  { to: '/supervisor/visitas', label: 'Visitas' },
  { to: '/supervisor/pos-vendas', label: 'Pós Vendas' },
  { to: '/supervisor/alertas', label: 'Alertas' },
]

export default function SupervisorLayout() {
  const navigate = useNavigate()
  const supervisor = JSON.parse(localStorage.getItem('supervisor') || '{}')

  async function handleLogout() {
    await supabase.auth.signOut()
    localStorage.removeItem('supervisor')
    navigate('/supervisor/login')
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">Supervisor</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm opacity-80">{supervisor.nome}</span>
          <button
            onClick={handleLogout}
            className="text-xs bg-slate-700 px-2 py-1 rounded active:bg-slate-600"
          >
            Sair
          </button>
        </div>
      </header>

      <nav className="bg-slate-700 flex overflow-x-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `px-4 py-2.5 text-sm whitespace-nowrap transition-colors ${
                isActive
                  ? 'text-white border-b-2 border-white font-bold'
                  : 'text-slate-300'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main className="flex-1 p-4 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
