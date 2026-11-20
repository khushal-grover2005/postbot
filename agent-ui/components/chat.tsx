'use client'

import { AI } from '@/app/(chat)/actions'
import { ChatList } from '@/components/chat-list'
import { ChatPanel } from '@/components/chat-panel'
import { EmptyScreen } from '@/components/empty-screen'
import { useLocalStorage } from '@/lib/hooks/use-local-storage'
import { useScrollAnchor } from '@/lib/hooks/use-scroll-anchor'
import { Message } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useAIState, useUIState } from 'ai/rsc'
import { useRouter } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

export interface ChatProps extends React.ComponentProps<'div'> {
  initialMessages?: Message[]
  chatId?: string
  userId: string | null
  missingKeys: string[]
  onArtifactCreated?: (artifact: {
    id: string
    type: string
    content: React.ReactNode
  }) => void
  onArtifactClicked?: (artifact: {
    id: string
    type: string
    content: React.ReactNode
  }) => void
}

export function Chat({
  chatId,
  className,
  userId,
  missingKeys,
  onArtifactCreated
}: ChatProps) {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [messages] = useUIState<typeof AI>()
  const [aiState] = useAIState<typeof AI>()
  const lastRefreshedLength = useRef<number>(0)

  const [, setNewChatId] = useLocalStorage('newChatId', chatId)

  useEffect(() => {
    const messagesLength = aiState.messages?.length || 0
    if (
      (messagesLength === 2 || messagesLength >= 4) &&
      messagesLength !== lastRefreshedLength.current
    ) {
      lastRefreshedLength.current = messagesLength
      router.refresh()
    }
  }, [aiState.messages, router])

  useEffect(() => {
    setNewChatId(chatId)
  }, [chatId, setNewChatId])

  useEffect(() => {
    missingKeys.forEach(key => {
      toast.error(`Missing ${key} environment variable!`)
    })
  }, [missingKeys])

  const { messagesRef, scrollRef, isAtBottom, scrollToBottom } =
    useScrollAnchor()

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[90vh]">
        <EmptyScreen />
      </div>
    )
  }

  return (
    <div className="group w-full overflow-auto h-full" ref={scrollRef}>
      <div
        className={cn('pb-[200px] pt-4 md:pt-10', className)}
        ref={messagesRef}
      >
        <React.Suspense fallback={null}>
          <ChatList
            messages={messages}
            isShared={false}
            userId={userId}
            onArtifactClick={onArtifactCreated}
          />
        </React.Suspense>
      </div>

      <ChatPanel
        chatId={chatId}
        input={input}
        setInput={setInput}
        isAtBottom={isAtBottom}
        scrollToBottom={scrollToBottom}
        onArtifactCreated={onArtifactCreated}
      />
    </div>
  )
}
