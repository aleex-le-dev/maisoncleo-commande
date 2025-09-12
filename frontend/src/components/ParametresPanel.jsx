import React, { useState, useEffect } from 'react'
import { getParametresSubTabFromLocation, navigateToParametresSubTab } from '../router'

import TricoteusesTab from './cartes/TricoteusesTab'
import StatusTab from './cartes/StatusTab'
import StatsTab from './cartes/StatsTab'
import ArchivedTab from './cartes/ArchivedTab'
import DateLimiteTab from './cartes/DateLimiteTab'
import ImportTab from './cartes/ImportTab'

const ParametresPanel = () => {
  const [activeTab, setActiveTab] = useState(getParametresSubTabFromLocation())

  const tabs = [
    { id: 'tricoteuses', label: 'Couturières', icon: '🧶', url: 'couturiere' },
    { id: 'dateLimite', label: 'Date limite', icon: '⏰', url: 'date-limite' },
    { id: 'stats', label: 'Stats & archives', icon: '📈', url: 'stats' },
    { id: 'status', label: 'Statut et tests', icon: '📊', url: 'status' },
    { id: 'import', label: 'Import', icon: '📥', url: 'import' }
  ]

  const activeTabMeta = tabs.find(t => t.id === activeTab) || tabs[0]

  // Synchroniser avec l'URL
  useEffect(() => {
    const onNav = () => setActiveTab(getParametresSubTabFromLocation())
    window.addEventListener('popstate', onNav)
    window.addEventListener('hashchange', onNav)
    window.addEventListener('mc-route-update', onNav)
    return () => {
      window.removeEventListener('popstate', onNav)
      window.removeEventListener('hashchange', onNav)
      window.removeEventListener('mc-route-update', onNav)
    }
  }, [])

  useEffect(() => {
    if (activeTabMeta) {
      document.title = `${activeTabMeta.icon} ${activeTabMeta.label} – Paramètres`
    }
    return () => {}
  }, [activeTabMeta])

  const renderTabContent = () => {
    switch (activeTab) {
      case 'tricoteuses':
        return <TricoteusesTab />
      case 'status':
        return <StatusTab />
      case 'dateLimite':
        return <DateLimiteTab />
      case 'stats':
        return (
          <div className="space-y-10">
            <StatsTab />
            <div className="pt-2 border-t" />
            <ArchivedTab />
          </div>
        )
      case 'import':
        return <ImportTab />
      default:
        return <TricoteusesTab />
    }
  }

  try {
    return (
      <div className="w-full">
        {/* Onglets Admin */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id)
                    navigateToParametresSubTab(tab.url)
                  }}
                  className={`py-2 px-1 border-b-2 font-medium text-sm cursor-pointer ${
                    activeTab === tab.id
                      ? 'border-[var(--rose-clair)] text-[var(--rose-clair-text)]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
        {/* Titre dynamique de l'onglet actif */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <span>{activeTabMeta.icon}</span>
            <span>{activeTabMeta.label}</span>
          </h2>
        </div>

        {/* Contenu de l'onglet actif */}
        <div>
          {renderTabContent()}
        </div>
      </div>
    )
  } catch (error) {
    console.error('Error in ParametresPanel:', error)
    return <div className="p-4 bg-red-50 text-red-600">Erreur dans ParametresPanel: {error.message}</div>
  }
}

export default ParametresPanel
