'use client'
import React, { createContext, useCallback, useContext, useState } from 'react'

interface Artifact {
  id: string
  type: string
  content: React.ReactNode
}

interface ArtifactContextType {
  artifacts: Artifact[]
  addArtifact: (artifact: Artifact) => void
  clearArtifacts: () => void
  selectedArtifact: Artifact | null
  setSelectedArtifact: (artifact: Artifact | null) => void
}

const ArtifactContext = createContext<ArtifactContextType | undefined>(
  undefined
)

export function ArtifactProvider({ children }: { children: React.ReactNode }) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(
    null
  )

  const addArtifact = useCallback((artifact: Artifact) => {
    setArtifacts(prevArtifacts => {
      const existingIndex = prevArtifacts.findIndex(a => a.id === artifact.id)
      if (existingIndex === -1) {
        return [...prevArtifacts, artifact]
      }
      const updated = [...prevArtifacts]
      updated[existingIndex] = artifact
      return updated
    })

    setSelectedArtifact(prev => (prev?.id === artifact.id ? artifact : prev))
  }, [])

  const clearArtifacts = useCallback(() => {
    setArtifacts([])
    setSelectedArtifact(null)
  }, [])

  const contextValue = {
    artifacts,
    addArtifact,
    clearArtifacts,
    selectedArtifact,
    setSelectedArtifact
  }

  return (
    <ArtifactContext.Provider value={contextValue}>
      {children}
    </ArtifactContext.Provider>
  )
}

export function useArtifacts() {
  const context = useContext(ArtifactContext)
  if (context === undefined) {
    throw new Error('useArtifacts must be used within an ArtifactProvider')
  }
  return context
}
