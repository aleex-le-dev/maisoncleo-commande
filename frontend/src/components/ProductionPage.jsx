import React, { useState, useMemo } from 'react'
import OrderHeader from './cartes/OrderHeader'
import { useUnifiedArticles } from './cartes/hooks/useUnifiedArticles'
import SimpleFlexGrid from './cartes/SimpleFlexGrid'
import { useQuery } from '@tanstack/react-query'
import LoadingSpinner from './LoadingSpinner'

/**
 * Page générique pour Maille/Couture
 */
const ProductionPage = ({ productionType, title }) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const { articles, isLoading, error } = useUnifiedArticles(productionType)
  
  // Les compteurs sont calculés instantanément côté client pour réactivité
  
  // Filtrage local par recherche et statut
  const filteredArticles = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    let filtered = articles
    
    // Filtrage par statut
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(article => article.status === selectedStatus)
    }
    
    // Filtrage par recherche
    if (term) {
      filtered = filtered.filter(article => 
        `${article.orderNumber}`.toLowerCase().includes(term) ||
        (article.customer || '').toLowerCase().includes(term) ||
        (article.product_name || '').toLowerCase().includes(term)
      )
    }
    
    return filtered
  }, [articles, searchTerm, selectedStatus])
  
  // Gérer l'ouverture des overlays
  const [openOverlayCardId, setOpenOverlayCardId] = useState(null)
  const handleOverlayOpen = (cardId) => {
    setOpenOverlayCardId(prevId => prevId === cardId ? null : cardId)
  }
  const handleClickOutside = () => {
    setOpenOverlayCardId(null)
  }

  // Fonctions pour les cartes
  const getArticleSize = (article) => {
    const name = article.product_name?.toLowerCase() || ''
    return name.includes('sweat') || name.includes('hoodie') || name.includes('cardigan') ? 'large' : 'medium'
  }

  const getArticleColor = (article) => {
    const colors = {
      'termine': 'border-green-500 bg-green-50',
      'en_cours': 'border-blue-500 bg-blue-50',
      'en_pause': 'border-yellow-500 bg-yellow-50',
      'a_faire': 'border-gray-300 bg-white'
    }
    return colors[article.status] || colors['a_faire']
  }

  const getArticleOptions = () => ({
    showAssignButton: true,
    showStatusButton: true,
    showNoteButton: true,
    showClientButton: true
  })

  const statusCounts = useMemo(() => {
    const counts = { a_faire: 0, en_cours: 0, en_pause: 0, termine: 0 }
    // Comptage instantané basé sur la liste déjà filtrée par type
    ;(articles || []).forEach(a => {
      if (counts[a.status] !== undefined) counts[a.status] += 1
    })
    return counts
  }, [articles])

  if (isLoading) return <LoadingSpinner />
  if (error) return <div className="max-w-6xl mx-auto"><div className="bg-white rounded-2xl shadow-sm border p-6 text-center text-red-600">Erreur de chargement</div></div>

  return (
    <div className="w-full px-4">
      <div className="mb-6">
        <OrderHeader
          selectedType={productionType}
          filteredArticlesCount={filteredArticles.length}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />
        
        {selectedStatus !== 'all' && (
          <div className="mt-2 text-sm text-gray-600">
            Filtre actif: <span className="font-semibold">
              {selectedStatus === 'a_faire' && '⏳ À faire'}
              {selectedStatus === 'en_cours' && '🔄 En cours'}
              {selectedStatus === 'en_pause' && '⏸️ En pause'}
              {selectedStatus === 'termine' && '✅ Terminé'}
            </span> - {filteredArticles.length} article{filteredArticles.length > 1 ? 's' : ''} affiché{filteredArticles.length > 1 ? 's' : ''}
          </div>
        )}
        
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          
          <button
            onClick={() => setSelectedStatus('all')}
            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors cursor-pointer ${
              selectedStatus === 'all' 
                ? 'bg-blue-100 border-blue-300 text-blue-800' 
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            📋 Total: <strong>{articles.length}</strong>
          </button>
          
          <button
            onClick={() => setSelectedStatus('a_faire')}
            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors cursor-pointer ${
              selectedStatus === 'a_faire' 
                ? 'bg-gray-100 border-gray-400 text-gray-800' 
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            ⏳ À faire: <strong>{statusCounts.a_faire}</strong>
          </button>
          
          <button
            onClick={() => setSelectedStatus('en_cours')}
            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors cursor-pointer ${
              selectedStatus === 'en_cours' 
                ? 'bg-blue-100 border-blue-400 text-blue-800' 
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            🔄 En cours: <strong>{statusCounts.en_cours}</strong>
          </button>
          
          <button
            onClick={() => setSelectedStatus('en_pause')}
            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors cursor-pointer ${
              selectedStatus === 'en_pause' 
                ? 'bg-yellow-100 border-yellow-400 text-yellow-800' 
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            ⏸️ En pause: <strong>{statusCounts.en_pause}</strong>
          </button>
          
          <button
            onClick={() => setSelectedStatus('termine')}
            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors cursor-pointer ${
              selectedStatus === 'termine' 
                ? 'bg-green-100 border-green-400 text-green-800' 
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            ✅ Terminé: <strong>{statusCounts.termine}</strong>
          </button>
        </div>
      </div>

      <SimpleFlexGrid
        filteredArticles={filteredArticles}
        getArticleSize={getArticleSize}
        getArticleColor={getArticleColor}
        getArticleOptions={getArticleOptions}
        handleOverlayOpen={handleOverlayOpen}
        openOverlayCardId={openOverlayCardId}
        searchTerm={searchTerm}
        productionType={productionType}
      />
    </div>
  )
}

export default ProductionPage
