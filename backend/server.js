require('dotenv').config()
const express = require('express')
const cookieParser = require('cookie-parser')
const database = require('./services/database')
const { cors, corsMiddleware } = require('./middleware/cors')

// Import du routeur centralisé
const apiRoutes = require('./routes')

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(cookieParser())

// CORS
app.use(cors)
app.use(corsMiddleware)

// Routes centralisées
app.use('/api', apiRoutes)

// Routes de debug (temporaires)
const debugRoutes = require('./routes/debug')
app.use('/debug', debugRoutes)

// Gestion des erreurs 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route non trouvée',
    path: req.originalUrl,
    method: req.method
  })
})

// Gestion globale des erreurs
app.use((error, req, res, next) => {
  console.error('Erreur globale:', error)
  res.status(500).json({ 
    error: 'Erreur serveur interne',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
  })
})

// Fonction de démarrage
async function startServer() {
  try {
    // Connexion à la base de données
    await database.connect()
    
    // Démarrage du serveur avec gestion des ports occupés
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Serveur démarré sur le port ${PORT}`)
      console.log(`📊 Environnement: ${process.env.NODE_ENV || 'development'}`)
      console.log(`🌐 URL: http://localhost:${PORT}`)
    })
    
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`⚠️  Port ${PORT} occupé, tentative sur le port ${PORT + 1}`)
        const newServer = app.listen(PORT + 1, '0.0.0.0', () => {
          console.log(`🚀 Serveur démarré sur le port ${PORT + 1}`)
          console.log(`📊 Environnement: ${process.env.NODE_ENV || 'development'}`)
          console.log(`🌐 URL: http://localhost:${PORT + 1}`)
        })
        
        newServer.on('error', (err2) => {
          console.error('❌ Impossible de démarrer le serveur sur les ports', PORT, 'et', PORT + 1)
          console.error('Erreur:', err2.message)
          process.exit(1)
        })
      } else {
        console.error('❌ Erreur serveur:', err)
        process.exit(1)
      }
    })
  } catch (error) {
    console.error('❌ Erreur démarrage serveur:', error)
    process.exit(1)
  }
}

// Gestion de l'arrêt propre
process.on('SIGINT', async () => {
  console.log('\n🛑 Arrêt du serveur...')
  await database.disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n🛑 Arrêt du serveur...')
  await database.disconnect()
  process.exit(0)
})

// Démarrer le serveur
startServer()

module.exports = app