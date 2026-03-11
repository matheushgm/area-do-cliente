import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { Eye, EyeOff, Zap, Lock, Mail } from 'lucide-react'

export default function Login() {
  const { login } = useApp()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    await new Promise((r) => setTimeout(r, 600))
    const result = login(email, password)
    setLoading(false)
    if (result.ok) {
      navigate('/')
    } else {
      setError(result.error)
      setShake(true)
      setTimeout(() => setShake(false), 500)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-rl-purple/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-rl-blue/10 rounded-full blur-3xl pointer-events-none" />

      <div
        className={`relative z-10 w-full max-w-md animate-slide-up ${shake ? '[animation:shake_0.4s_ease]' : ''}`}
        style={shake ? { animation: 'shake 0.4s ease' } : {}}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-rl mb-4 shadow-glow animate-float">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-rl-text">Revenue Lab</h1>
          <p className="text-rl-muted text-sm mt-1">Internal — Área Restrita</p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <h2 className="text-lg font-semibold text-rl-text mb-1">Bem-vindo de volta</h2>
          <p className="text-rl-muted text-sm mb-6">Entre com suas credenciais para acessar o sistema.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="label-field">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rl-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@revenuelab.com"
                  className="input-field pl-10"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="label-field">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rl-muted" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-rl-muted hover:text-rl-subtle transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm animate-fade-in">
                <span className="w-4 h-4 shrink-0">⚠</span>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Entrar no Sistema
                </>
              )}
            </button>
          </form>

          {/* Hint */}
          <div className="mt-6 pt-5 border-t border-rl-border text-center">
            <p className="text-rl-muted text-xs">
              Credenciais de acesso fornecidas pelo administrador.
            </p>
            <div className="mt-3 flex items-center justify-center gap-3 text-xs text-rl-muted/60">
              <span>senha: Revenue@lab!</span>
            </div>
          </div>
        </div>

        <p className="text-center text-rl-muted/40 text-xs mt-6">
          Revenue Lab Internal v0.1 · Acesso apenas para colaboradores
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-8px); }
          40%      { transform: translateX(8px); }
          60%      { transform: translateX(-5px); }
          80%      { transform: translateX(5px); }
        }
      `}</style>
    </div>
  )
}
