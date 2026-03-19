import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/sync'

export default function SupervisorLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setErro('')

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      })

      if (authError) throw new Error('Email ou senha inválidos')

      // Verificar se é supervisor
      const { data: sup, error: supError } = await supabase
        .from('supervisores')
        .select('*')
        .eq('auth_uid', authData.user.id)
        .eq('ativo', true)
        .single()

      if (supError || !sup) {
        await supabase.auth.signOut()
        throw new Error('Usuário não é supervisor ou está inativo')
      }

      localStorage.setItem('supervisor', JSON.stringify({
        id: sup.id,
        nome: sup.nome,
        email: sup.email,
      }))

      navigate('/supervisor')
    } catch (err) {
      setErro(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-800 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Supervisor</h1>
          <p className="text-sm text-slate-500">Painel de Gestão</p>
        </div>

        {erro && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Email"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
          />
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            placeholder="Senha"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-700 text-white py-2.5 rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
