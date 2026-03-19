import { useState, useEffect, useCallback } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { setSyncCallback, syncAll, countPending, supabase } from '../lib/sync'

const navItems = [
  { to: '/dashboard', label: 'Início', icon: '🏠' },
  { to: '/clientes', label: 'Clientes', icon: '👤' },
  { to: '/visitas', label: 'Visitas', icon: '📍' },
  { to: '/negocios', label: 'Negócios', icon: '💰' },
]

export default function Layout() {
  const navigate = useNavigate()
  const vendedor = JSON.parse(localStorage.getItem('vendedor') || '{}')
  const [online, setOnline] = useState(navigator.onLine)
  const [syncStatus, setSyncStatus] = useState({ status: 'idle', detail: '' })
  const [pending, setPending] = useState(0)

  const updatePending = useCallback(async () => {
    setPending(await countPending())
  }, [])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)

    // Registrar callback de sync
    setSyncCallback((s) => {
      setSyncStatus(s)
      if (s.status === 'done') updatePending()
    })

    // Contar pendentes ao montar
    updatePending()

    // Atualizar pendentes periodicamente
    const interval = setInterval(updatePending, 10000)

    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
      clearInterval(interval)
    }
  }, [updatePending])

  async function handleLogout() {
    await supabase.auth.signOut()
    localStorage.removeItem('vendedor')
    localStorage.removeItem('token')
    navigate('/login')
  }

  function handleSync() {
    if (navigator.onLine) syncAll()
  }

  const isSyncing = syncStatus.status === 'syncing' || syncStatus.status === 'pushing' || syncStatus.status === 'pulling'

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-800 text-white px-4 py-3 flex items-center justify-between safe-top">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold">Vendas App</h1>
          <span className={`w-2 h-2 rounded-full ${online ? 'bg-green-400' : 'bg-red-400'}`} />
        </div>
        <div className="flex items-center gap-3">
          {/* Botão de sync manual */}
          <button
            onClick={handleSync}
            disabled={!online || isSyncing}
            className="relative text-xs bg-blue-900 px-2 py-1 rounded active:bg-blue-950 disabled:opacity-50"
          >
            <span className={isSyncing ? 'animate-spin inline-block' : ''}>
              {isSyncing ? '⟳' : '↻'}
            </span>
            {pending > 0 && !isSyncing && (
              <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {pending > 9 ? '9+' : pending}
              </span>
            )}
          </button>
          <span className="text-sm opacity-80">{vendedor.nome}</span>
          <button
            onClick={handleLogout}
            className="text-xs bg-blue-900 px-2 py-1 rounded active:bg-blue-950"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Barra de status */}
      {!online && (
        <div className="bg-amber-500 text-white text-xs text-center py-1 font-medium">
          Modo offline - dados salvos localmente
          {pending > 0 && ` (${pending} pendente${pending > 1 ? 's' : ''})`}
        </div>
      )}

      {isSyncing && (
        <div className="bg-blue-600 text-white text-xs text-center py-1 font-medium flex items-center justify-center gap-2">
          <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          {syncStatus.detail}
        </div>
      )}

      {syncStatus.status === 'done' && (
        <div className="bg-green-600 text-white text-xs text-center py-1 font-medium animate-fade-in">
          {syncStatus.detail}
        </div>
      )}

      {syncStatus.status === 'error' && (
        <div className="bg-red-600 text-white text-xs text-center py-1 font-medium animate-fade-in">
          Erro: {syncStatus.detail}
        </div>
      )}

      <main className="flex-1 p-4 pb-20 overflow-y-auto">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex safe-bottom">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2.5 text-xs transition-colors ${
                isActive ? 'text-blue-700 font-bold' : 'text-slate-400'
              }`
            }
          >
            <span className="text-xl mb-0.5">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
