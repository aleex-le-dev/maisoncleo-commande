import React, { useState, useCallback } from 'react'
import { IoRefreshOutline } from 'react-icons/io5'
import { useQueryClient } from '@tanstack/react-query'
import { syncOrders, getSyncLogs } from '../services/mongodbService'

// Bouton de synchronisation réutilisable (desktop et mobile)
// Props:
// - variant: 'icon' | 'block' (affichage icône seule ou bouton pleine largeur avec texte)
// - className: classes additionnelles
// - onDone: callback après la synchro (ex: fermer le menu mobile)
const SyncButton = ({ variant = 'icon', className = '', onDone }) => {
  const queryClient = useQueryClient()
  const [isSyncing, setIsSyncing] = useState(false)

  const handleManualSync = useCallback(async () => {
    if (isSyncing) return
    const t0 = performance.now()
    console.log('🔄 [SYNC] Démarrage de la synchronisation manuelle (incrémentale depuis BDD)…')
    try {
      setIsSyncing(true)
      console.time('[SYNC] Durée')
      const result = await syncOrders({})
      console.log('✅ [SYNC] Réponse backend:', result)
      // Invalidation ciblée pour recharger depuis la BDD
      queryClient.invalidateQueries(['db-orders'])
      queryClient.invalidateQueries(['production-statuses'])
      queryClient.invalidateQueries(['unified-orders'])
      try { if (typeof window !== 'undefined' && window) window.mcBypassOrdersCache = true } catch {}
      await queryClient.refetchQueries({ queryKey: ['unified-orders'], type: 'active' })
      console.log('🗂️ [SYNC] Invalidation des caches React Query: [\'db-orders\'], [\'production-statuses\'], [\'unified-orders\'] + bypass cache')
      try {
        // Log de la dernière commande présente en BDD
        const base = (import.meta.env.DEV ? 'http://localhost:3001' : (import.meta.env.VITE_API_URL || 'https://maisoncleo-commande.onrender.com'))
        const res = await fetch(`${base}/api/orders`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          const orders = Array.isArray(data?.orders) ? data.orders : []
          if (orders.length > 0) {
            const lastByDate = [...orders].sort((a,b) => new Date(a.order_date) - new Date(b.order_date)).pop()
            console.log(`📌 [SYNC] Dernière commande en BDD → #${lastByDate.order_number} (${lastByDate.order_id}) du ${lastByDate.order_date}`)
          } else {
            console.log('📌 [SYNC] Aucune commande en BDD')
          }
        }
      } catch {}
      try {
        const syncLog = await getSyncLogs()
        console.log('📝 [SYNC] Dernier log backend:', syncLog)
      } catch (e) {
        console.warn('⚠️ [SYNC] Impossible de récupérer le log backend:', e)
      }
      const dt = Math.round(performance.now() - t0)
      console.timeEnd('[SYNC] Durée')
      console.log(`🎉 [SYNC] Terminé en ${dt}ms`)
    } catch (e) {
      console.error('❌ [SYNC] Échec de la synchronisation:', e)
    } finally {
      setIsSyncing(false)
      if (typeof onDone === 'function') onDone()
    }
  }, [isSyncing, onDone, queryClient])

  if (variant === 'block') {
    return (
      <button
        type="button"
        onClick={handleManualSync}
        className={`w-full px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 hover:bg-[var(--bg-tertiary)] disabled:opacity-60 ${className}`}
        style={{ color: 'var(--text-secondary)' }}
        aria-label="Synchroniser"
        disabled={isSyncing}
      >
        {isSyncing ? 'Synchronisation…' : 'Synchroniser'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleManualSync}
      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 cursor-pointer hover:bg-[var(--bg-tertiary)] disabled:opacity-60 ${className}`}
      style={{ color: 'var(--text-secondary)' }}
      title={isSyncing ? 'Synchronisation…' : 'Synchroniser'}
      aria-label="Synchroniser"
      disabled={isSyncing}
    >
      <IoRefreshOutline className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
    </button>
  )
}

export default SyncButton


