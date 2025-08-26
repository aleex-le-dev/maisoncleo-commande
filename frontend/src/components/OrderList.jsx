import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { FixedSizeGrid as Grid } from 'react-window'
import { 
  getProductionStatuses, 
  updateArticleStatus, 
  dispatchToProduction,
  syncOrders,
  getOrdersFromDatabase,
  getOrdersByProductionType,
  getSyncLogs
} from '../services/mongodbService'
import LoadingSpinner from './LoadingSpinner'

// Styles CSS personnalisés pour les cartes modernes
const cardStyles = `
  :root {
    --accent-pink: 236, 72, 153; /* RGB du rose réutilisable */
  }
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes pinkBlink {
    0%, 100% { box-shadow: 0 0 0 0 rgba(var(--accent-pink), 0.0); }
    50% { box-shadow: 0 0 0 4px rgba(var(--accent-pink), 0.35); }
  }
  .animate-pink-blink { animation: pinkBlink 1s ease-in-out infinite; }
  .border-accent { border-color: rgba(var(--accent-pink), 0.75); }
  .highlight-accent { background-color: rgba(var(--accent-pink), 0.25); color: rgb(var(--accent-pink)); border-radius: 0.25rem; padding: 0 0.15rem; }
  
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`

// Composant pour afficher l'image du produit
const ProductImage = ({ productId, productName, permalink }) => {
  const [imageUrl, setImageUrl] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [errorDetails, setErrorDetails] = useState('')

  useEffect(() => {
    if (productId) {
      // Reset l'état quand l'ID change
      setImageUrl(null)
      setHasError(false)
      setErrorDetails('')
      fetchProductImage(productId)
    }
  }, [productId])



  const fetchProductImage = async (id) => {
    if (!id) {
      console.warn('ProductImage: Pas d\'ID de produit fourni')
      setHasError(true)
      setErrorDetails('Pas d\'ID')
      return
    }

    setIsLoading(true)
    setHasError(false)
    setErrorDetails('')
    
    try {
      // Charger depuis le backend (image stockée en BDD) pour éviter CORS
      const backendUrl = 'http://localhost:3001/api/images/' + id
      const resp = await fetch(backendUrl, { method: 'GET', signal: AbortSignal.timeout(8000) })
      if (resp.ok) {
        // Utiliser l'URL directe de l'endpoint comme src
        setImageUrl(backendUrl)
      } else {
        // Fallback silencieux: garder l'icône placeholder
        setHasError(true)
        setErrorDetails('Image non trouvée')
      }
    } catch (error) {
      setHasError(true)
      setErrorDetails('Erreur image')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="w-16 h-16 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
      </div>
    )
  }

  if (hasError || !imageUrl) {
    return (
      <div className="w-16 h-16 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center group relative">
        <span className="text-xs text-gray-500">🖼️</span>
        {errorDetails && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
            {errorDetails}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
          </div>
        )}
      </div>
    )
  }

  return (
    <a
      href={permalink || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block"
      title="Voir l'image du produit"
    >
      <div className="w-16 h-16 bg-gray-100 rounded-lg border border-gray-200 overflow-hidden hover:bg-gray-200 transition-colors">
        <img 
          src={imageUrl} 
          alt={productName}
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
        />
      </div>
    </a>
  )
}

// Composant pour afficher et dérouler les notes
const NoteExpander = ({ note }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  const toggleNote = () => {
    if (isAnimating) return
    setIsAnimating(true)
    setIsExpanded(!isExpanded)
    setTimeout(() => setIsAnimating(false), 300)
  }

  const closeNote = () => {
    if (isAnimating) return
    setIsAnimating(true)
    setIsExpanded(false)
    setTimeout(() => setIsAnimating(false), 300)
  }

  return (
    <div className="mb-4">
      {/* Bouton pour voir la note */}
      <button
        onClick={toggleNote}
        className="w-full flex items-center justify-between p-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-all duration-300 group"
      >
        <div className="flex items-center">
          <span className="text-amber-600 mr-2">📝</span>
          <span className="text-sm font-medium text-amber-800">Voir la note</span>
        </div>
        <div className={`transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
          <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Note déroulée */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
        isExpanded ? 'max-h-96 opacity-100 mt-3' : 'max-h-0 opacity-0'
      }`}>
        <div className="relative bg-amber-50 border border-amber-200 rounded-lg p-4">
          {/* Bouton de fermeture */}
          <button
            onClick={closeNote}
            className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center bg-amber-200 hover:bg-amber-300 rounded-full transition-colors duration-200 group"
          >
            <svg className="w-4 h-4 text-amber-700 group-hover:text-amber-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {/* Contenu de la note */}
          <div className="pr-8">
            <div className="text-sm text-amber-800 leading-relaxed">
              <span className="font-medium">Note client:</span>
              <div className="mt-2 italic">"{note}"</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Composant carte d'article moderne optimisé
const ArticleCard = React.memo(({ article, index, getArticleSize, getArticleColor, getArticleOptions, onOverlayOpen, isOverlayOpen, isHighlighted, searchTerm }) => {
  const [imageUrl, setImageUrl] = useState(null)
  const [isImageLoading, setIsImageLoading] = useState(false)
  const [copiedText, setCopiedText] = useState('')

  const handleCopy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedText(label)
      setTimeout(() => setCopiedText(''), 2000)
    } catch (err) {
      console.error('Erreur lors de la copie:', err)
    }
  }

  useEffect(() => {
    // Utiliser l'image stockée en base de données si disponible
    if (article.image_url) {
      setImageUrl(article.image_url)
    } else if (article.product_id) {
      // Sinon, essayer de récupérer l'image depuis WooCommerce
      fetchCardImage(article.product_id)
    }
  }, [article.image_url, article.product_id])

  const fetchCardImage = async (productId) => {
    setIsImageLoading(true)
    try {
      // 1) Tenter via le backend (image stockée en BDD)
      const backendUrl = 'http://localhost:3001/api/images/' + productId
      const backendResp = await fetch(backendUrl, { method: 'GET', signal: AbortSignal.timeout(5000) })
      if (backendResp.ok) {
        setImageUrl(backendUrl)
        return
      }

      // 2) Fallback WordPress si indisponible (peut échouer CORS, mais non bloquant)
      const wordpressUrl = import.meta.env.VITE_WORDPRESS_URL
      const consumerKey = import.meta.env.VITE_WORDPRESS_CONSUMER_KEY
      const consumerSecret = import.meta.env.VITE_WORDPRESS_CONSUMER_SECRET
      if (wordpressUrl && consumerKey && consumerSecret) {
        const authParams = `consumer_key=${consumerKey}&consumer_secret=${consumerSecret}`
        const url = `${wordpressUrl}/wp-json/wc/v3/products/${productId}?${authParams}&_fields=id,images`
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(5000)
        })
        if (response.ok) {
          const product = await response.json()
          if (product?.images && product.images.length > 0) {
            setImageUrl(product.images[0].src)
          }
        }
      }
    } catch (error) {
      // Ignorer silencieusement les erreurs CORS ou réseau
      console.debug(`Image non disponible pour le produit ${productId}`)
    } finally {
      setIsImageLoading(false)
    }
  }

  // Formatte proprement l'adresse en mettant le code postal + ville à la ligne
  const renderFormattedAddress = (address) => {
    if (!address || typeof address !== 'string') {
      return 'Non renseignée'
    }
    const parts = address.split(',').map(p => p.trim()).filter(Boolean)
    if (parts.length >= 2) {
      const streetPart = parts.slice(0, -1).join(', ')
      const zipCityPart = parts[parts.length - 1]
      return (
        <span>
          <span>{highlightText(streetPart, searchTerm)}</span>
          <br />
          <span>{highlightText(zipCityPart, searchTerm)}</span>
        </span>
      )
    }
    return <span>{highlightText(address, searchTerm)}</span>
  }

  // Fonction simple de surlignage avec logs de debug
  const highlightText = (text, searchTerm) => {
    console.log('🔍 highlightText appelé avec:', { text, searchTerm })
    if (!searchTerm || !text) {
      console.log('❌ Pas de terme ou texte, retour:', text)
      return text
    }
    
    const term = searchTerm.toLowerCase().trim()
    const source = text.toLowerCase()
    console.log('🔍 Comparaison:', { term, source })
    
    if (source.includes(term)) {
      console.log('✅ Terme trouvé, surlignage appliqué')
      const parts = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
      return parts.map((part, i) => 
        part.toLowerCase() === term ? 
          <span key={i} className="highlight-accent">{part}</span> : 
          <span key={i}>{part}</span>
      )
    }
    
    console.log('❌ Terme non trouvé')
    return text
  }

  return (
    <div 
      className={`group relative bg-white rounded-3xl overflow-hidden shadow-lg h-[420px] ${isHighlighted ? `border-2 border-accent${searchTerm ? '' : ' animate-pink-blink'}` : ''}`}
      style={{ 
        animationName: searchTerm ? 'none' : 'fadeInUp',
        animationDuration: searchTerm ? '0s' : '0.6s',
        animationTimingFunction: searchTerm ? undefined : 'ease-out',
        animationFillMode: searchTerm ? undefined : 'forwards',
        animationDelay: searchTerm ? '0ms' : `${index * 150}ms`
      }}
    >
      {/* Image de fond avec overlay moderne */}
      <div className="relative h-60 overflow-hidden">
        {/* Image de base */}
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={article.product_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-400 flex items-center justify-center">
            {isImageLoading ? (
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-600 border-t-transparent"></div>
            ) : (
              <div className="text-6xl text-slate-500">📦</div>
            )}
          </div>
        )}
        
        {/* Bouton lien vers la commande complète (remplace l'overlay plein écran) */}
        <a
          href={`https://maisoncleo.com/wp-admin/post.php?post=${article.orderNumber}&action=edit`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute top-3 right-3 z-30 inline-flex items-center justify-center w-9 h-9 rounded-full border border-white/40 bg-black/30 text-white/90 hover:bg-black/50 hover:border-white/60 backdrop-blur-sm"
          title="Voir la commande complète"
          aria-label="Voir la commande complète"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 3h7v7" />
            <path d="M10 14L21 3" />
            <path d="M21 14v7h-7" />
            <path d="M3 10l11 11" />
          </svg>
        </a>
        
        {/* Overlay gradient moderne */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none"></div>
        
               {/* Numéro de commande - bien visible en haut à gauche */}
       <div className="absolute top-4 left-4 px-4 py-2 rounded-lg bg-black/25 backdrop-blur-sm text-white text-lg font-bold z-20">
         #{article.orderNumber}
       </div>
        
        {/* Icône d'information client sur le bord gauche */}
        <div className="absolute left-4 top-20 z-40 pointer-events-auto">
          {/* Icône pour les infos client (fond transparent + nouveau pictogramme) */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onOverlayOpen && onOverlayOpen()
            }}
            className={`w-10 h-10 rounded-full flex items-center justify-center border border-white/30 bg-transparent text-white/90 hover:bg-white/90 hover:text-black hover:border-white focus:outline-none focus:ring-2 focus:ring-white/40 ${
              isOverlayOpen ? 'bg-white/90 text-black border-white ring-2 ring-white/60' : ''
            }`}
            aria-label="Informations client"
            title="Informations client"
          >
            {/* SVG User icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              className="w-5 h-5"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21a8 8 0 0 0-16 0" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Zone d'informations dynamique en bas */}
      <div className="h-24 bg-white/95 backdrop-blur-md transition-all duration-300">
        <div className="p-4">
          {/* Informations principales pour tricoteuses */}
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-gray-900 line-clamp-1">
              {highlightText(article.product_name, searchTerm)}
            </h3>
            <div className="grid grid-cols-3 gap-3 text-base text-gray-700">
              <div className="text-center">
                <div className="text-sm text-gray-500">Quantité</div>
                <div className="text-lg font-semibold">{article.quantity}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-500">Taille</div>
                <div className="text-lg font-semibold">{getArticleSize(article.meta_data)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-500">Couleur</div>
                <div className="text-lg font-semibold">{getArticleColor(article.meta_data) !== 'Non spécifiée' ? getArticleColor(article.meta_data) : 'N/A'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay client affiché instantanément sans transition */}
      {isOverlayOpen && (
        <div 
          className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 rounded-3xl"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="relative h-full p-6 flex flex-col">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onOverlayOpen && onOverlayOpen()
            }}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-4xl font-light hover:font-bold w-8 h-8 flex items-center justify-center"
            aria-label="Fermer"
            title="Fermer"
          >
            ×
          </button>
          
          {/* Feedback de copie */}
          {copiedText && (
            <div className="mb-4 p-3 bg-green-100 border border-green-300 rounded-lg text-green-800 text-sm font-medium text-center">
              {copiedText}
            </div>
          )}
          
          <div className="space-y-4 pr-16 -ml-2">
            <div className="flex items-center space-x-3 w-full">
              {/* Icone utilisateur (uniforme 20px) */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-7 h-7 text-gray-700 flex-shrink-0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20a8 8 0 0 1 16 0" />
              </svg>
              <div 
                className="flex-1 min-w-0 text-base font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                onClick={() => handleCopy(article.customer, 'Client copié !')}
                title="Cliquer pour copier"
              >
                {highlightText(article.customer, searchTerm)}
              </div>
            </div>
            
            <div className="flex items-center space-x-3 w-full">
              {/* Icone calendrier (uniforme 20px) */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-7 h-7 text-gray-700 flex-shrink-0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="17" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              <div 
                className="flex-1 min-w-0 text-base font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                onClick={() => handleCopy(format(new Date(article.orderDate), 'dd/MM/yyyy', { locale: fr }), 'Date copiée !')}
                title="Cliquer pour copier"
              >
                {highlightText(format(new Date(article.orderDate), 'dd/MM/yyyy', { locale: fr }), searchTerm)}
              </div>
            </div>
            
            <div className="flex items-center space-x-3 w-full">
              {/* Icône email plus contrastée */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-7 h-7 text-gray-800 flex-shrink-0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 7l9 6 9-6" />
                <path d="M3 19l6-6" />
                <path d="M21 19l-6-6" />
              </svg>
              <div 
                className="flex-1 min-w-0 text-base font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                onClick={() => handleCopy(article.customerEmail || 'Non renseigné', 'Email copié !')}
                title="Cliquer pour copier"
              >
                {highlightText(article.customerEmail || 'Non renseigné', searchTerm)}
              </div>
            </div>
            
            <div className="flex items-center space-x-3 w-full">
              {/* Icone téléphone (uniforme 20px) */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-7 h-7 text-gray-700 flex-shrink-0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v2a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4 1.1h2a2 2 0 0 1 2 1.72c.12.9.33 1.77.61 2.61a2 2 0 0 1-.45 2.11L7 8.09a16 16 0 0 0 6 6l.55-.76a2 2 0 0 1 2.11-.45c.84.28 1.71.49 2.61.61A2 2 0 0 1 22 16.92z" />
              </svg>
              <div 
                className="flex-1 min-w-0 text-base font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                onClick={() => handleCopy(article.customerPhone || 'Non renseigné', 'Téléphone copié !')}
                title="Cliquer pour copier"
              >
                {highlightText(article.customerPhone || 'Non renseigné', searchTerm)}
              </div>
            </div>
            
            <div className="flex items-center space-x-3 w-full">
              {/* Icône adresse (maison) pour éviter le cercle intérieur */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-7 h-7 text-gray-700 flex-shrink-0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 10.5L12 3l9 7.5" />
                <path d="M5 10v10h14V10" />
                <path d="M9 20v-6h6v6" />
              </svg>
              <div 
                className="flex-1 min-w-0 text-base font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                onClick={() => handleCopy(article.customerAddress || 'Non renseignée', 'Adresse copiée !')}
                title="Cliquer pour copier"
              >
                {renderFormattedAddress(article.customerAddress)}
              </div>
            </div>
            
            <div className="flex items-center space-x-3 w-full">
              {/* Icone livraison (uniforme 20px) */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-7 h-7 text-gray-700 flex-shrink-0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7h11v8H3z" />
                <path d="M14 10h4l3 3v2h-7z" />
                <circle cx="7" cy="17" r="2" />
                <circle cx="17" cy="17" r="2" />
              </svg>
              <div 
                className="flex-1 min-w-0 text-base font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition-colors whitespace-nowrap"
                onClick={() => handleCopy(article.shippingMethod || 'Non renseigné', 'Transporteur copié !')}
                title="Cliquer pour copier"
              >
                {(() => {
                  const title = (article.shippingMethod || '').toLowerCase()
                  const isFree = title.includes('gratuit') || title.includes('free')
                  if (isFree) {
                    const carrier = article.shippingCarrier || ((article.customerCountry || '').toUpperCase() === 'FR' ? 'UPS' : 'DHL')
                    return highlightText(`Livraison gratuite (${carrier})`, searchTerm)
                  }
                  return highlightText(article.shippingMethod || 'Non renseigné', searchTerm)
                })()}
              </div>
            </div>
          </div>
        </div>
        </div>
      )}



      {/* Effet de brillance au survol */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 transform -skew-x-12 -translate-x-full group-hover:translate-x-full pointer-events-none"></div>
    </div>
  )
})

const OrderList = ({ onNavigateToType, selectedType: propSelectedType }) => {
  const [selectedType, setSelectedType] = useState(propSelectedType || 'all')
  const [openOverlayCardId, setOpenOverlayCardId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [highlightTerm, setHighlightTerm] = useState('')

  const [syncProgress, setSyncProgress] = useState({ isRunning: false, progress: 0, message: '' })
  const [syncLogs, setSyncLogs] = useState([])
  const queryClient = useQueryClient()

  // Mettre à jour le selectedType local quand la prop change
  useEffect(() => {
    if (propSelectedType) {
      setSelectedType(propSelectedType)
    }
  }, [propSelectedType])

  // Gérer l'ouverture des overlays (un seul à la fois)
  const handleOverlayOpen = useCallback((cardId) => {
    if (openOverlayCardId === cardId) {
      // Si on clique sur la même carte, fermer l'overlay
      setOpenOverlayCardId(null)
    } else {
      // Sinon, ouvrir l'overlay de cette carte
      setOpenOverlayCardId(cardId)
    }
  }, [openOverlayCardId])

  // Fermer l'overlay au clic ailleurs
  const handleClickOutside = useCallback(() => {
    setOpenOverlayCardId(null)
  }, [])

  // Synchronisation automatique au chargement de la page
  useEffect(() => {
    const performAutoSync = async () => {
      try {
        // Afficher le popup de progression
        setSyncProgress({ 
          isRunning: true, 
          progress: 0, 
          message: 'Connexion au backend...' 
        })
        
        // Étape 1: Connexion au backend
        setSyncProgress(prev => ({ ...prev, progress: 10, message: 'Connexion au backend...' }))
        await new Promise(resolve => setTimeout(resolve, 200))
        
        // Étape 2: Récupération des commandes WooCommerce
        setSyncProgress(prev => ({ ...prev, progress: 25, message: 'Récupération des commandes WooCommerce...' }))
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // Étape 3: Récupération des permalinks
        setSyncProgress(prev => ({ ...prev, progress: 40, message: 'Récupération des permalinks...' }))
        await new Promise(resolve => setTimeout(resolve, 400))
        
        // Étape 4: Synchronisation avec la base de données
        setSyncProgress(prev => ({ ...prev, progress: 60, message: 'Synchronisation avec la base de données...' }))
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // Étape 5: Appel de synchronisation
        setSyncProgress(prev => ({ ...prev, progress: 80, message: 'Synchronisation des données...' }))
        
        // Récupérer le dernier log en temps réel pendant la synchronisation
        const logsInterval = setInterval(async () => {
          try {
            const logs = await getSyncLogs()
            // Prendre seulement le dernier log au lieu de tous
            if (logs && logs.log) {
              setSyncLogs([logs.log])
            }
          } catch (error) {
            console.warn('Erreur lors de la récupération des logs:', error)
          }
        }, 200) // Plus rapide pour voir les logs en temps réel
        
        const syncResult = await syncOrders([])
        
        // Arrêter la récupération des logs
        clearInterval(logsInterval)
        
        // Récupérer le dernier log final
        const finalLogs = await getSyncLogs()
        if (finalLogs && finalLogs.log) {
          setSyncLogs([finalLogs.log])
        }
        
        // Étape 6: Afficher le résultat dans le popup de progression
        if (syncResult.results) {
          const { ordersCreated, itemsCreated } = syncResult.results
          const totalNew = ordersCreated + itemsCreated
          
          if (totalNew > 0) {
            setSyncProgress(prev => ({ 
              ...prev, 
              progress: 100, 
              message: `${ordersCreated} commande${ordersCreated > 1 ? 's' : ''} et ${itemsCreated} article${itemsCreated > 1 ? 's' : ''} récupéré${itemsCreated > 1 ? 's' : ''}`
            }))
          } else {
            setSyncProgress(prev => ({ 
              ...prev, 
              progress: 100, 
              message: 'Aucune nouvelle commande à traiter'
            }))
          }
        }
        
        // Rafraîchir les données
        queryClient.invalidateQueries(['db-orders'])
        queryClient.invalidateQueries(['production-statuses'])
        
        // Masquer le popup de progression après 3 secondes
        setTimeout(() => setSyncProgress({ isRunning: false, progress: 0, message: '' }), 3000)
        
      } catch (error) {
        console.error('Erreur lors de la synchronisation automatique:', error)
        
        // Afficher l'erreur dans le popup de progression
        setSyncProgress(prev => ({ 
          ...prev, 
          progress: 100, 
          message: 'Erreur lors de la synchronisation'
        }))
        
        // Masquer le popup après 3 secondes
        setTimeout(() => setSyncProgress({ isRunning: false, progress: 0, message: '' }), 3000)
      }
    }
    
    // Effectuer la synchronisation automatique
    performAutoSync()
  }, [queryClient])

  // Récupérer les commandes depuis la base de données
  const { data: dbOrders, isLoading: dbOrdersLoading, error: dbOrdersError } = useQuery({
    queryKey: ['db-orders', selectedType],
    queryFn: () => {
      if (propSelectedType && propSelectedType !== 'all') {
        return getOrdersByProductionType(propSelectedType)
      }
      return getOrdersFromDatabase()
    },
    refetchInterval: 30000, // Rafraîchir toutes les 30 secondes
    staleTime: 10000,
  })

  // Récupérer les statuts de production
  const { data: productionStatuses, isLoading: statusesLoading } = useQuery({
    queryKey: ['production-statuses'],
    queryFn: getProductionStatuses,
    refetchInterval: 10000,
    staleTime: 5000
  })

  // Fonction pour déterminer le type de production
  const getProductionType = useCallback((productName) => {
    const name = productName.toLowerCase()
    
    const mailleKeywords = ['tricotée', 'tricoté', 'knitted', 'pull', 'gilet', 'cardigan', 'sweat', 'hoodie', 'bonnet', 'écharpe', 'gants', 'chaussettes']
    
    if (mailleKeywords.some(keyword => name.includes(keyword))) {
      return { type: 'maille', color: 'bg-purple-100 text-purple-800' }
    } else {
      return { type: 'couture', color: 'bg-blue-100 text-blue-800' }
    }
  }, [])

  // Fonction pour obtenir la couleur du statut
  const getStatusColor = useCallback((status) => {
    const colors = {
      'a_faire': 'bg-gray-100 text-gray-800',
      'en_cours': 'bg-yellow-100 text-yellow-800',
      'termine': 'bg-green-100 text-green-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }, [])

  // Fonction pour récupérer le statut d'un article
  const getArticleStatus = useCallback((orderId, lineItemId) => {
    if (!productionStatuses) return 'a_faire'
    
    const status = productionStatuses.find(s => 
      s.order_id === orderId && s.line_item_id === lineItemId
    )
    
    return status ? status.status : 'a_faire'
  }, [productionStatuses])

  // Fonction pour extraire la taille d'un article
  const getArticleSize = useCallback((metaData) => {
    if (!metaData || !Array.isArray(metaData)) return 'Non spécifiée'
    
    const sizeMeta = metaData.find(meta => 
      meta.key && (
        meta.key.toLowerCase().includes('taille') ||
        meta.key.toLowerCase().includes('size') ||
        meta.key.toLowerCase().includes('dimension')
      )
    )
    
    return sizeMeta ? sizeMeta.value : 'Non spécifiée'
  }, [])

  // Fonction pour extraire les options d'un article
  const getArticleOptions = useCallback((metaData) => {
    if (!metaData || !Array.isArray(metaData)) return 'Aucune'
    
    const options = metaData
      .filter(meta => 
        meta.key && 
        !meta.key.toLowerCase().includes('taille') && 
        !meta.key.toLowerCase().includes('size') &&
        !meta.key.toLowerCase().includes('couleur') &&
        !meta.key.toLowerCase().includes('color') &&
        meta.key !== '_qty' &&
        meta.key !== '_tax_class' &&
        meta.key !== '_product_id' &&
        meta.key !== '_variation_id' &&
        meta.key !== '_line_subtotal' &&
        meta.key !== '_line_subtotal_tax' &&
        meta.key !== '_line_total' &&
        meta.key !== '_line_tax' &&
        meta.key !== '_line_tax_data' &&
        meta.key !== '_reduced_stock'
      )
      .map(meta => `${meta.key}: ${meta.value}`)
      .join(', ')
    
    return options || 'Aucune'
  }, [])

  // Fonction pour extraire la couleur d'un article
  const getArticleColor = useCallback((metaData) => {
    if (!metaData || !Array.isArray(metaData)) return 'Non spécifiée'
    
    const colorMeta = metaData.find(meta => 
      meta.key && (
        meta.key.toLowerCase().includes('couleur') ||
        meta.key.toLowerCase().includes('color') ||
        meta.key.toLowerCase().includes('colour')
      )
    )
    
    return colorMeta ? colorMeta.value : 'Non spécifiée'
  }, [])

  // Préparer les données des articles avec statuts
  const prepareArticles = useMemo(() => {
    if (!dbOrders) return []
    
    const articles = []
    dbOrders.forEach((order, orderIndex) => {
      order.items?.forEach((item, itemIndex) => {
        // Utiliser le type de production depuis la base de données si disponible
        let productionType = 'couture' // par défaut
        
        if (item.production_status && item.production_status.production_type) {
          productionType = item.production_status.production_type
        } else {
          // Fallback sur la détection automatique si pas de statut
          const detectedType = getProductionType(item.product_name)
          productionType = detectedType.type
        }
        
        const currentStatus = getArticleStatus(order.order_id, item.line_item_id)
        
        articles.push({
          ...item,
          orderId: order.order_id,
          orderNumber: order.order_number,
          orderDate: order.order_date,
          customer: order.customer_name,
          customerEmail: order.customer_email,
          customerPhone: order.customer_phone,
          customerAddress: order.customer_address,
          customerNote: order.customer_note,
          shippingMethod: order.shipping_title || order.shipping_method_title || order.shipping_method || 'Livraison gratuite',
          shippingCarrier: order.shipping_carrier || null,
          customerCountry: order.customer_country || null,
          permalink: item.permalink, // Utiliser le permalink stocké en BDD
          productionType: productionType,
          status: currentStatus,
          isDispatched: item.production_status && item.production_status.status !== 'a_faire'
        })
      })
    })
    
    return articles
  }, [dbOrders, getProductionType, getArticleStatus])

  // Filtrer les articles
  const allArticles = prepareArticles
  const term = searchTerm.toLowerCase().trim()
  const filteredArticles = useMemo(() => {
    return allArticles.filter(article => {
      const typeMatch = selectedType === 'all' || article.productionType === selectedType
      if (!typeMatch) return false
      if (!term) return true
      return (
        `${article.orderNumber}`.toLowerCase().includes(term) ||
        (article.customer || '').toLowerCase().includes(term) ||
        (article.product_name || '').toLowerCase().includes(term)
      )
    })
  }, [allArticles, selectedType, term])
  


  if (dbOrdersLoading || statusesLoading) {
    return <LoadingSpinner />
  }

  if (dbOrdersError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="text-red-800">
            <p className="font-medium">Erreur lors du chargement des commandes</p>
            <p className="text-sm">{dbOrdersError.message}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Injection des styles CSS pour les cartes */}
      <style dangerouslySetInnerHTML={{ __html: cardStyles }} />
      
      {/* Popup de progression de synchronisation */}
      {syncProgress.isRunning && (
        <div className="fixed top-4 right-4 z-50 p-4 bg-blue-100 text-blue-800 border border-blue-200 rounded-lg shadow-lg max-w-md">
          <div className="mb-3">
            <p className="font-medium">
              <svg 
                className={`w-5 h-5 inline-block mr-2 ${syncProgress.isRunning ? 'animate-spin' : ''}`}
                fill="none" 
                viewBox="0 0 24 24"
              >
                <circle 
                  className="opacity-25" 
                  cx="12" 
                  cy="12" 
                  r="10" 
                  stroke="currentColor" 
                  strokeWidth="4"
                />
                <path 
                  className="opacity-75" 
                  fill="currentColor" 
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Synchronisation
            </p>
          </div>
          
          {/* Log en temps réel */}
          <div className="bg-blue-50 rounded p-2">
            {syncLogs.length > 0 && syncLogs[0] ? (
              <div className="text-xs">
                    <span className="text-blue-600 font-mono">
                  {new Date(syncLogs[0].timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`ml-2 ${
                  syncLogs[0].type === 'success' ? 'text-green-600' :
                  syncLogs[0].type === 'error' ? 'text-red-600' :
                  syncLogs[0].type === 'warning' ? 'text-yellow-600' :
                      'text-blue-600'
                    }`}>
                  {syncLogs[0].message}
                    </span>
              </div>
            ) : (
              <p className="text-xs text-blue-500 italic">En attente des logs...</p>
            )}
          </div>
        </div>
      )}



      {/* En-tête avec titre et recherche */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-semibold text-gray-900">
          {propSelectedType === 'couture' ? '🧵 Couture' : 
           propSelectedType === 'maille' ? '🪡 Maille' : 
           'Gestion de Production'} ({filteredArticles.length} articles)
        </h2>
        <div className="w-full sm:w-80">
          <form onSubmit={(e)=>{e.preventDefault(); /* surlignage en direct */}}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher une commande (n°, client, produit)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
          </form>
        </div>
      </div>

      {/* Affichage des articles en cartes avec virtualisation */}
      {filteredArticles.length > 0 && (
        <div className="h-[800px] w-full">
          <Grid
            columnCount={Math.min(4, Math.ceil(window.innerWidth / 400))}
            columnWidth={400}
            height={800}
            rowCount={Math.ceil(filteredArticles.length / Math.min(4, Math.ceil(window.innerWidth / 400)))}
            rowHeight={450}
            width={window.innerWidth}
            itemData={{
              articles: filteredArticles,
              getArticleSize,
              getArticleColor,
              getArticleOptions,
              handleOverlayOpen,
              openOverlayCardId,
              searchTerm
            }}
          >
            {({ columnIndex, rowIndex, style, data }) => {
              const columnCount = Math.min(4, Math.ceil(window.innerWidth / 400))
              const index = rowIndex * columnCount + columnIndex
              const article = data.articles[index]
              if (!article) return null
              
              const cardId = `${article.orderId}-${article.line_item_id}`
              return (
                <div style={style} className="p-3">
                  <ArticleCard 
                    key={cardId}
                    article={article}
                    index={index}
                    getArticleSize={data.getArticleSize}
                    getArticleColor={data.getArticleColor}
                    getArticleOptions={data.getArticleOptions}
                    onOverlayOpen={() => data.handleOverlayOpen(cardId)}
                    isOverlayOpen={data.openOverlayCardId === cardId}
                    isHighlighted={data.searchTerm && (
                      `${article.orderNumber}`.toLowerCase().includes(data.searchTerm.toLowerCase()) ||
                      (article.customer || '').toLowerCase().includes(data.searchTerm.toLowerCase()) ||
                      (article.product_name || '').toLowerCase().includes(data.searchTerm.toLowerCase())
                    )}
                    searchTerm={data.searchTerm}
                  />
                </div>
              )
            }}
          </Grid>
        </div>
      )}
      
      {filteredArticles.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">Aucun article trouvé avec les filtres sélectionnés</p>
          <p className="text-sm text-gray-400 mt-2">
            Total d'articles en base: {allArticles.length} | Type sélectionné: {selectedType}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Actualisez la page pour synchroniser les nouvelles commandes
          </p>
        </div>
      )}
    </div>
  )
}

export default OrderList