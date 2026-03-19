import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/sync'

export default function Login() {
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
      // 1. Autenticar com Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      })

      if (authError) throw new Error('Email ou senha inválidos')

      // 2. Buscar dados do vendedor na tabela Tecnicos
      const { data: tecnico, error: tecError } = await supabase
        .from('Tecnicos')
        .select('*')
        .eq('auth_uid', authData.user.id)
        .eq('is_vendedor', true)
        .single()

      if (tecError || !tecnico) {
        // Fallback: tentar buscar por email
        const { data: tecByEmail } = await supabase
          .from('Tecnicos')
          .select('*')
          .eq('email', email)
          .single()

        if (tecByEmail) {
          if (!tecByEmail.is_vendedor) {
            await supabase.auth.signOut()
            throw new Error('Este usuário não é vendedor. Acesso negado.')
          }

          // Vincular auth_uid automaticamente
          await supabase
            .from('Tecnicos')
            .update({ auth_uid: authData.user.id })
            .eq('Id', tecByEmail.Id)

          localStorage.setItem('vendedor', JSON.stringify({
            id: tecByEmail.Id,
            nome: tecByEmail.Nome,
            email: email,
          }))
          navigate('/')
          return
        }

        await supabase.auth.signOut()
        throw new Error('Usuário não está cadastrado como vendedor')
      }

      // 3. Salvar dados do vendedor no localStorage
      localStorage.setItem('vendedor', JSON.stringify({
        id: tecnico.Id,
        nome: tecnico.Nome,
        email: email,
      }))

      navigate('/')
    } catch (err) {
      setErro(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-800 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h1 className="text-2xl font-bold text-center text-blue-800 mb-1">
          Vendas App
        </h1>
        <p className="text-sm text-center text-slate-500 mb-6">Entrar como vendedor</p>

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
            className="w-full bg-blue-700 text-white py-2.5 rounded-lg font-medium hover:bg-blue-800 disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-slate-200">
          <button
            onClick={() => {
              localStorage.setItem('vendedor', JSON.stringify({
                id: 1,
                nome: 'Vendedor Teste',
                email: 'teste@empresa.com',
              }))
              navigate('/')
            }}
            className="w-full bg-slate-100 text-slate-600 py-2.5 rounded-lg text-sm active:bg-slate-200"
          >
            Entrar sem login (teste)
          </button>
        </div>
      </div>
    </div>
  )
}
