import { LoadingSpinnerWithMessage } from '@/components/loading-spinner-message'
import { BotCard, SpinnerMessage, UserMessage } from '@/components/message'
import { PostGeneratorForm } from '@/components/post-generator-form'
import SocialMediaPost from '@/components/socialmedia-post'
import { AgentState, Chat, Message, Role } from '@/lib/types'
import { getLoadingMessage } from '@/lib/utils'
import { auth } from '@clerk/nextjs/server'
import { generateId } from 'ai'
import {
  createAI,
  createStreamableUI,
  getAIState,
  getMutableAIState
} from 'ai/rsc'
import { RemoteRunnable } from 'langchain/runnables/remote'
import { ReactNode } from 'react'
import { saveChat } from '../actions'

const showForm = async (input: string): Promise<UIState> => {
  'use server'

  const aiState = getMutableAIState<typeof AI>()
  const messageId = generateId()
  const chatId = aiState.get().chatId

  aiState.update({
    ...aiState.get(),
    messages: [
      ...aiState.get().messages,
      {
        id: messageId,
        role: 'human',
        content: input
      }
    ]
  })

  const uiStream = createStreamableUI(<SpinnerMessage />)
  const aiMessageId = generateId()

  await new Promise<void>(resolve => {
    uiStream.update(
      <BotCard>
        <SpinnerMessage />
      </BotCard>
    )
    setTimeout(() => {
      uiStream.done(
        <BotCard>
          <div>
            <PostGeneratorForm id={aiMessageId} />
          </div>
        </BotCard>
      )
      resolve()
    }, 200)
  })

  aiState.done({
    ...aiState.get(),
    chatId: chatId,
    messages: [
      ...aiState.get().messages,
      {
        id: aiMessageId,
        role: 'ai',
        name: 'PostBot3000Form',
        content: JSON.stringify({
          postDetails: '',
          audience: '',
          drafts: '1',
          id: aiMessageId
        })
      }
    ]
  })

  return {
    id: aiMessageId,
    role: 'ai',
    display: uiStream.value
  }
}

const sendMessage = async (
  input: string,
  audience: string,
  n_drafts: number,
  postForm300Id?: string
): Promise<UIState> => {
  'use server'

  const aiState = getMutableAIState<typeof AI>()
  const humanMessageId = generateId()
  const aiMessageId = generateId()
  const chatId = aiState.get().chatId

  const sanitizedDrafts = Math.max(1, Math.min(5, Number(n_drafts) || 1))

  const existingMessages = [...aiState.get().messages]
  const existingMessageIndex = existingMessages.findIndex(
    message => message.id === postForm300Id
  )

  if (existingMessageIndex !== -1) {
    existingMessages[existingMessageIndex] = {
      ...existingMessages[existingMessageIndex],
      content: JSON.stringify({
        postDetails: input,
        audience: audience,
        drafts: String(sanitizedDrafts),
        id: postForm300Id
      })
    }
  }

  aiState.update({
    ...aiState.get(),
    messages: [
      ...existingMessages,
      {
        id: humanMessageId,
        role: 'human',
        content: input
      }
    ]
  })

  const uiStream = createStreamableUI(
    <BotCard>
      <LoadingSpinnerWithMessage message={getLoadingMessage('editing')} />
    </BotCard>
  )

  let streamData: AgentState = {
    tweet: {
      drafts: [],
      feedback: ''
    },
    linkedin_post: {
      drafts: [],
      feedback: ''
    },
    n_drafts: sanitizedDrafts,
    target_audience: audience,
    edit_text: '',
    user_text: input,
    workflow_status: ''
  }

  const cloneStreamData = (): AgentState => ({
    ...streamData,
    tweet: {
      drafts: [...streamData.tweet.drafts],
      feedback: streamData.tweet.feedback
    },
    linkedin_post: {
      drafts: [...streamData.linkedin_post.drafts],
      feedback: streamData.linkedin_post.feedback
    }
  })

  ;(async () => {
    let completed = false

    const remoteChain = new RemoteRunnable({
      url: process.env.AGENT_URL || 'http://localhost:8000',
      options: {
        timeout: 600000
      }
    })

    try {
      const stream = remoteChain.streamEvents(
        {
          user_text: input,
          target_audience: audience,
          edit_text: '',
          tweet: {
            drafts: [],
            feedback: ''
          },
          linkedin_post: {
            drafts: [],
            feedback: ''
          },
          n_drafts: sanitizedDrafts,
          workflow_status: ''
        },
        {
          version: 'v2',
          configurable: {
            thread_id: chatId || '',
            checkpoint_ns: '',
            checkpoint_id: ''
          }
        }
      )

      for await (const event of stream) {
        const eventType = event.event
        const eventName = event.name

        if (eventType === 'on_chain_end') {
          const data = event.data?.output
          if (!data || typeof data !== 'object') continue

          switch (eventName) {
            case 'editor':
              if (data.edit_text) {
                streamData.edit_text = data.edit_text
              }
              uiStream.update(
                <BotCard>
                  <LoadingSpinnerWithMessage
                    message={getLoadingMessage('tweetWriting')}
                  />
                </BotCard>
              )
              break
            case 'tweet_writer':
              if (data.tweet) {
                streamData.tweet = {
                  drafts: [...(data.tweet.drafts || [])],
                  feedback: data.tweet.feedback || ''
                }
              }
              uiStream.update(
                <BotCard>
                  <div className="flex flex-col gap-4">
                    <LoadingSpinnerWithMessage
                      message={getLoadingMessage('tweetWriting')}
                    />
                    <SocialMediaPost
                      agentBody={cloneStreamData()}
                      chatId={chatId}
                      messageId={aiMessageId}
                    />
                  </div>
                </BotCard>
              )
              break
            case 'linkedin_writer':
              if (data.linkedin_post) {
                streamData.linkedin_post = {
                  drafts: [...(data.linkedin_post.drafts || [])],
                  feedback: data.linkedin_post.feedback || ''
                }
              }
              uiStream.update(
                <BotCard>
                  <div className="flex flex-col gap-4">
                    <LoadingSpinnerWithMessage
                      message={getLoadingMessage('linkedInWriting')}
                    />
                    <SocialMediaPost
                      agentBody={cloneStreamData()}
                      chatId={chatId}
                      messageId={aiMessageId}
                    />
                  </div>
                </BotCard>
              )
              break
            case 'supervisor':
              streamData = {
                ...streamData,
                ...data,
                tweet: data.tweet
                  ? {
                      drafts: [...(data.tweet.drafts || [])],
                      feedback: data.tweet.feedback || ''
                    }
                  : streamData.tweet,
                linkedin_post: data.linkedin_post
                  ? {
                      drafts: [...(data.linkedin_post.drafts || [])],
                      feedback: data.linkedin_post.feedback || ''
                    }
                  : streamData.linkedin_post
              }

              if (streamData.workflow_status === 'completed') {
                completed = true
                const finalState = cloneStreamData()

                // Store only plain JSON-serializable data in AIState (never JSX)
                aiState.done({
                  ...aiState.get(),
                  chatId: chatId,
                  messages: [
                    ...aiState.get().messages,
                    {
                      id: aiMessageId,
                      role: 'ai',
                      name: 'AgentResponse',
                      content: JSON.stringify(finalState)
                    }
                  ]
                })

                uiStream.done(
                  <BotCard>
                    <div className="flex flex-col gap-4">
                      <SocialMediaPost
                        agentBody={finalState}
                        chatId={chatId}
                        messageId={aiMessageId}
                      />
                    </div>
                  </BotCard>
                )
              } else if (streamData.workflow_status === 'in_progress') {
                uiStream.update(
                  <BotCard>
                    <div className="flex flex-col gap-4">
                      <LoadingSpinnerWithMessage
                        message={getLoadingMessage('review')}
                      />
                      <SocialMediaPost
                        agentBody={cloneStreamData()}
                        chatId={chatId}
                        messageId={aiMessageId}
                      />
                    </div>
                  </BotCard>
                )
              }
              break
            case 'tweet_critique':
              if (data.tweet?.feedback !== undefined) {
                streamData.tweet.feedback = data.tweet.feedback
              }
              uiStream.update(
                <BotCard>
                  <div className="flex flex-col gap-4">
                    <LoadingSpinnerWithMessage
                      message={getLoadingMessage('critique')}
                    />
                    <SocialMediaPost
                      agentBody={cloneStreamData()}
                      chatId={chatId}
                      messageId={aiMessageId}
                    />
                  </div>
                </BotCard>
              )
              break
            case 'linkedin_critique':
              if (data.linkedin_post?.feedback !== undefined) {
                streamData.linkedin_post.feedback = data.linkedin_post.feedback
              }
              uiStream.update(
                <BotCard>
                  <div className="flex flex-col gap-4">
                    <LoadingSpinnerWithMessage
                      message={getLoadingMessage('critique')}
                    />
                    <SocialMediaPost
                      agentBody={cloneStreamData()}
                      chatId={chatId}
                      messageId={aiMessageId}
                    />
                  </div>
                </BotCard>
              )
              break
          }
        }
      }

      if (!completed) {
        const finalState = cloneStreamData()
        aiState.done({
          ...aiState.get(),
          chatId: chatId,
          messages: [
            ...aiState.get().messages,
            {
              id: aiMessageId,
              role: 'ai',
              name: 'AgentResponse',
              content: JSON.stringify(finalState)
            }
          ]
        })
        uiStream.done(
          <BotCard>
            <div className="flex flex-col gap-4">
              <SocialMediaPost
                agentBody={finalState}
                chatId={chatId}
                messageId={aiMessageId}
              />
            </div>
          </BotCard>
        )
      }
    } catch (error) {
      console.error('Error processing stream:', error)
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to generate posts. Please try again.'

      if (!completed) {
        aiState.done({
          ...aiState.get(),
          chatId: chatId
        })
        uiStream.done(
          <BotCard>
            <div className="text-sm text-red-600">
              Something went wrong while generating your posts: {errorMessage}
            </div>
          </BotCard>
        )
      }
    }
  })()

  return {
    id: aiMessageId,
    role: 'ai',
    display: uiStream.value
  }
}

export type AIState = {
  chatId: string
  messages: Array<Message>
}

export type UIState = {
  id: string
  role: Role
  display: ReactNode
  spinner?: ReactNode
}

export type AIActions = {
  sendMessage: typeof sendMessage
  showForm: typeof showForm
}

export const AI = createAI<AIState, UIState[], AIActions>({
  initialAIState: {
    chatId: generateId(),
    messages: []
  },
  initialUIState: [],
  actions: {
    sendMessage,
    showForm
  },
  onSetAIState: async ({
    state,
    done
  }: {
    state: AIState
    done: boolean
  }) => {
    'use server'

    if (!done) return

    const { userId } = auth()
    if (!userId) return

    const { chatId, messages } = state
    if (!messages?.length) return

    const createdAt = new Date()
    const path = `/chat/${chatId}`

    const postDetailsMessage = messages.find(
      (msg, idx) => msg.role === 'human' && idx > 0 && msg.content
    )
    const firstMessageContent =
      postDetailsMessage?.content || messages[0]?.content || 'PostBot 3000'
    const title = firstMessageContent.substring(0, 100)

    const chat: Chat = {
      chatId,
      title,
      userId,
      createdAt,
      messages,
      path
    }

    await saveChat(chat)
  },
  onGetUIState: async () => {
    'use server'

    const { userId } = auth()

    if (userId) {
      const aiState = getAIState() as Chat

      if (aiState) {
        const uiState = getUIStateFromAIState(aiState)
        return uiState
      }
    } else {
      return
    }
  }
})

function safeParseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export const getUIStateFromAIState = (aiState: Chat): UIState[] => {
  const chatId = aiState.chatId
  const messages = Array.isArray(aiState.messages) ? aiState.messages : []

  return messages.map((message, index) => {
    if (message.role === 'ai') {
      if (message.name === 'PostBot3000Form') {
        const data = safeParseJson<{
          postDetails?: string
          audience?: string
          drafts?: string | number
          id?: string
        }>(message.content)

        return {
          id: `${aiState.chatId}-${index}`,
          role: message.role,
          display: (
            <BotCard>
              <PostGeneratorForm
                initialPostDetails={data?.postDetails || ''}
                initialAudience={data?.audience || ''}
                initialDrafts={String(data?.drafts ?? '1')}
                id={data?.id || `${aiState.chatId}-${index}`}
              />
            </BotCard>
          )
        }
      } else if (message.name === 'AgentResponse') {
        const data = safeParseJson<AgentState>(message.content)
        return {
          id: `${aiState.chatId}-${index}`,
          role: message.role,
          display: (
            <BotCard>
              <SocialMediaPost
                agentBody={data || {}}
                chatId={chatId}
                messageId={message.id}
              />
            </BotCard>
          )
        }
      } else {
        return {
          id: `${aiState.chatId}-${index}`,
          role: message.role,
          display: (
            <BotCard>
              <p>{message.content}</p>
            </BotCard>
          )
        }
      }
    }

    return {
      id: `${aiState.chatId}-${index}`,
      role: message.role,
      display: <UserMessage>{message.content}</UserMessage>
    }
  })
}
