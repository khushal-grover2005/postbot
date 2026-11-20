import { notFound } from 'next/navigation'

import { getUIStateFromAIState } from '@/app/(chat)/actions'
import { getSharedChat } from '@/app/actions'
import { ChatList } from '@/components/chat-list'
import { formatDate } from '@/lib/utils'
import React from 'react'

interface SharePageProps {
  params: {
    id: string
  }
}

export default async function SharePage({ params }: SharePageProps) {
  const chat = await getSharedChat(params.id)

  if (!chat || !chat?.sharePath) {
    notFound()
  }

  const uiState = getUIStateFromAIState(chat)

  return (
    <div className="flex-1 space-y-6 overflow-auto pl-0 peer-[[data-state=open]]:lg:pl-[250px] peer-[[data-state=open]]:xl:pl-[300px]">
      <div className="border-b bg-background px-4 py-6 md:px-6 md:py-8">
        <div className="mx-auto max-w-2xl">
          <div className="space-y-1 md:-mx-8">
            <h1 className="text-2xl font-bold">{chat.title}</h1>
            <div className="text-sm text-muted-foreground">
              {formatDate(chat.createdAt)} · {chat.messages.length} messages
            </div>
          </div>
        </div>
      </div>
      <React.Suspense fallback={null}>
        <ChatList messages={uiState} isShared={true} userId={null} />
      </React.Suspense>
    </div>
  )
}
