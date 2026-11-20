'use client'

import { UIState } from '@/app/(chat)/actions'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useSearchParams } from 'next/navigation'
import React, { useEffect } from 'react'
import { useArtifacts } from './contexts/artifact-context'

export interface ChatList {
  messages: UIState[]
  userId: string | null
  isShared: boolean
  onArtifactClick?: (artifact: {
    id: string
    type: string
    content: React.ReactNode
  }) => void
}

export function ChatList({ messages }: ChatList) {
  const { artifacts, setSelectedArtifact } = useArtifacts()
  const searchParams = useSearchParams()
  const artifactId = searchParams.get('artifactId')

  useEffect(() => {
    if (artifactId && typeof artifactId === 'string') {
      const artifact = artifacts.find(a => a.id === artifactId)
      if (artifact) {
        setSelectedArtifact(artifact)
      }
    }
  }, [artifactId, artifacts, setSelectedArtifact])

  if (!messages.length) {
    return null
  }

  return (
    <div className="relative mx-auto max-w-2xl px-4">
      {messages.map((message, index) => (
        <div key={message.id} className={cn('my-4')}>
          {message.display}
          {index < messages.length - 1 && <Separator className="hidden" />}
        </div>
      ))}
    </div>
  )
}
