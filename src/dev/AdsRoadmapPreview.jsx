// Preview de DESENVOLVIMENTO do ADS Roadmap, sem login (rota /dev/ads-roadmap,
// só quando import.meta.env.DEV). A página é estática (dados em
// src/lib/adsRoadmap.js), então basta um AppContext fake pra sidebar montar.
import { AppContext } from '../context/AppContext'
import AdsRoadmap from '../pages/AdsRoadmap'

export default function AdsRoadmapPreview() {
  const value = {
    user: { id: 'dev', email: 'dev@revenuelab.com.br', name: 'Dev', avatar: 'DV', role: 'admin' },
    login: async () => {}, logout: () => {}, loginWithGoogle: async () => {}, loadingAuth: false, authError: null,
    projects: [], squads: [], teamMembers: [], loadingProjects: false, isSupabaseReady: true,
    addProject: async () => {}, updateProject: async () => {}, deleteProject: async () => {},
    addSquad: async () => {}, updateSquad: async () => {}, deleteSquad: async () => {},
    tasks: [], loadingTasks: false, addTask: async () => {}, updateTask: async () => {}, deleteTask: async () => {},
  }
  return (
    <AppContext.Provider value={value}>
      <AdsRoadmap />
    </AppContext.Provider>
  )
}
