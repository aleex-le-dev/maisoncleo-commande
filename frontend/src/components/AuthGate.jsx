import React, { useEffect, useMemo, useState } from 'react'
import authService from '../services/authService'
import { ApiService } from '../services/apiService'

// Composant portail d'authentification minimaliste en plein écran.
// Bloque totalement l'accès à l'application tant que le mot de passe n'est pas validé.
// Le mot de passe est fourni via la variable d'environnement VITE_APP_PASSWORD.
// L'état est stocké en sessionStorage pour ne pas redemander sur chaque rafraîchissement d'onglet.
const AuthGate = ({ children, onAuthenticated }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const STORAGE_KEY = 'mc-auth-ok-v2'
  const [password, setPassword] = useState('')
  const [resetMode, setResetMode] = useState(false)
  const [resetToken, setResetToken] = useState('')
  const [resetNewPwd, setResetNewPwd] = useState('')
  const [showResetPwd, setShowResetPwd] = useState(false)
  const requiredPassword = useMemo(() => (import.meta.env.VITE_APP_PASSWORD || '').toString(), [])
  // plus d'affichage de logs, uniquement console

  // Restaurer la session pour les rafraîchissements d'onglet (sessionStorage)
  useEffect(() => {
    // Définir le favicon cadenas pour la page d'auth
    try {
      const setFavicon = (emoji) => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" height="64" width="64"><text y="50%" x="50%" dominant-baseline="middle" text-anchor="middle" font-size="52">${emoji}</text></svg>`
        const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
        let link = document.querySelector('link[rel="icon"]')
        if (!link) {
          link = document.createElement('link')
          link.rel = 'icon'
          document.head.appendChild(link)
        }
        link.href = url
      }
      setFavicon('🔒')
      document.title = 'Mot de passe – Maisoncléo'
    } catch {}
    const flag = sessionStorage.getItem(STORAGE_KEY)
    if (flag === '1') {
      setIsAuthenticated(true)
      if (typeof onAuthenticated === 'function') onAuthenticated()
    }
  }, [onAuthenticated])

  // Préchargement uniquement après authentification pour éviter les erreurs réseau sur l'écran mot de passe
  useEffect(() => {
    if (!isAuthenticated) return
    if (import.meta.env.PROD) return
    const prefetchDone = sessionStorage.getItem('mc-prefetch-ok-v1') === '1'
    if (!prefetchDone) {
      try { ApiService.prefetchAppData(); sessionStorage.setItem('mc-prefetch-ok-v1', '1') } catch {}
    }
  }, [isAuthenticated])

  // Activer le formulaire de réinitialisation si /password?token=... (support hash routing)
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      const pathname = (url.pathname || '').toLowerCase()
      const hash = (window.location.hash || '').toLowerCase()
      const isPasswordRoute = pathname.includes('/password') || hash.includes('/password')
      const tokenFromSearch = url.searchParams.get('token')
      const tokenFromHash = new URLSearchParams((window.location.hash.split('?')[1] || '')).get('token')
      const token = tokenFromSearch || tokenFromHash
      if (isPasswordRoute && token) {
        setResetMode(true)
        setResetToken(token)
      }
    } catch {}
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      // 1) Tenter d'abord la vérification backend (mot de passe dynamique)
      await authService.verify(password)
      sessionStorage.setItem(STORAGE_KEY, '1')
      setIsAuthenticated(true)
      if (typeof onAuthenticated === 'function') onAuthenticated()
      return
    } catch (err) {
      // 2) Fallback: si un mot de passe build-time est défini, l'accepter
      try {
        if (requiredPassword && password === requiredPassword) {
          sessionStorage.setItem(STORAGE_KEY, '1')
          setIsAuthenticated(true)
          if (typeof onAuthenticated === 'function') onAuthenticated()
          try {
            const link = document.querySelector('link[rel="icon"]')
            if (link) link.href = '/vite.svg'
          } catch {}
          return
        }
      } catch {}
      // Échec: animer le formulaire
    }
    // Échec: ne pas révéler d'information, secouer légèrement le formulaire
    const form = e?.currentTarget
    if (!form) return
    form.classList.remove('shake')
    // forcer reflow
    // eslint-disable-next-line no-unused-expressions
    form.offsetHeight
    form.classList.add('shake')
  }

  // Ne pas court-circuiter: si aucun VITE_APP_PASSWORD, on utilisera la vérification backend.

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ backgroundColor: '#0b0b0d' }}>
        <div className="w-full max-w-sm mx-4 rounded-2xl p-6 shadow-2xl" style={{ backgroundColor: '#ffffff' }}>
          <div className="text-center mb-4">
            <img src="/mclogosite.png" alt="Maisoncléo" className="mx-auto h-6" />
          </div>
          <h1 className="text-lg font-semibold text-center mb-2" style={{ color: '#111827' }}>{resetMode ? 'Définir un nouveau mot de passe' : 'Accès protégé et sécurisé'}</h1>
          {resetMode ? (
            <div className="transition-transform" style={{ transformOrigin: 'center' }}>
              <div className="relative mb-3">
                <input
                  type={showResetPwd ? 'text' : 'password'}
                  value={resetNewPwd}
                  onChange={(e) => setResetNewPwd(e.target.value)}
                  placeholder="Nouveau mot de passe (≥ 6 caractères)"
                  className="w-full border rounded-lg px-3 py-2 pr-10"
                  style={{ borderColor: '#d1d5db', color: '#111827' }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowResetPwd(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                  aria-label={showResetPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  title={showResetPwd ? 'Masquer' : 'Afficher'}
                >
                  {showResetPwd ? '🙈' : '👁️'}
                </button>
              </div>
              <button
                type="button"
                className="w-full rounded-lg px-3 py-2 font-medium cursor-pointer"
                style={{ backgroundColor: '#111827', color: '#ffffff' }}
                onClick={async () => {
                  try {
                    if (!resetNewPwd || resetNewPwd.length < 1) { alert('Mot de passe requis'); return }
                    const base = (import.meta.env.DEV ? 'http://localhost:3001' : (import.meta.env.VITE_API_URL || 'https://maisoncleo-commande.onrender.com'))
                    const res = await fetch(`${base}/api/auth/reset`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ token: resetToken, password: resetNewPwd })
                    })
                    const data = await res.json()
                    if (!res.ok || data.success !== true) throw new Error(data.error || 'Erreur reset')
                    alert('Mot de passe défini. Connecte-toi avec le nouveau mot de passe.')
                    try { window.history.replaceState({}, '', '/') } catch {}
                    setResetMode(false)
                    setPassword('')
                    setResetToken('')
                    setResetNewPwd('')
                  } catch (e) {
                    alert('Échec de définition du mot de passe.')
                  }
                }}
              >
                Définir le mot de passe
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="transition-transform" style={{ transformOrigin: 'center' }}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mot de passe"
                  className="w-full border rounded-lg px-3 py-2 mb-3"
                  style={{ borderColor: '#d1d5db', color: '#111827' }}
                  autoFocus
                />
                <button
                  type="submit"
                  className="w-full rounded-lg px-3 py-2 font-medium cursor-pointer"
                  style={{ backgroundColor: '#111827', color: '#ffffff' }}
                >
                  Entrer
                </button>
              </form>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await authService.forgot()
                    alert('Un nouveau mot de passe a été envoyé sur le mail c********@maisoncleo.com')
                  } catch (e) {
                    alert('Erreur envoi du mot de passe. Contactez le support.')
                  }
                }}
                className="w-full text-center mt-3 underline cursor-pointer"
                style={{ color: '#6b7280' }}
              >
                Mot de passe oublié ?
              </button>
            </>
          )}
          <style>{`
            .shake { animation: mc-shake 0.25s ease-in-out 2; }
            @keyframes mc-shake {
              0% { transform: translateX(0); }
              25% { transform: translateX(-6px); }
              50% { transform: translateX(6px); }
              75% { transform: translateX(-4px); }
              100% { transform: translateX(0); }
            }
          `}</style>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export default AuthGate


