'use client'

import { useMemo } from 'react'
import { ContentDocument } from './content-document'
import { MemoizedReactMarkdown } from './markdown'
import { PostDraft } from './post-draft'
import { SaveDraft } from './save-draft'

interface PostType {
  drafts?: string[]
  feedback?: string
}

interface AgentBodyProps {
  user_text?: string
  target_audience?: string
  edit_text?: string
  tweet?: PostType
  linkedin_post?: PostType
  n_drafts?: number
}

function PlatformDraftDocument({
  artifactId,
  draft,
  platform,
  chatId,
  index
}: {
  artifactId: string
  draft: string
  platform: 'Twitter' | 'LinkedIn'
  chatId: string
  index: number
}) {
  const content = useMemo(
    () => (
      <div className="p-1 flex flex-col space-y-4">
        <MemoizedReactMarkdown>{draft}</MemoizedReactMarkdown>
        <div className="flex flex-wrap gap-4">
          <SaveDraft
            draft={draft}
            platform={platform}
            chatId={chatId}
            artifactId={artifactId}
          />
          <PostDraft platform={platform} />
        </div>
      </div>
    ),
    [draft, platform, chatId, artifactId]
  )

  return (
    <ContentDocument
      id={artifactId}
      type={`${platform} Draft ${index + 1}`}
      name={`${platform} Draft ${index + 1}`}
      content={content}
    />
  )
}

function PlatformFeedbackDocument({
  artifactId,
  feedback,
  platform
}: {
  artifactId: string
  feedback: string
  platform: 'Twitter' | 'LinkedIn'
}) {
  const content = useMemo(
    () => (
      <div className="p-1">
        <MemoizedReactMarkdown>{feedback}</MemoizedReactMarkdown>
      </div>
    ),
    [feedback]
  )

  return (
    <ContentDocument
      id={artifactId}
      type={`${platform} Feedback`}
      name={`${platform} Feedback`}
      content={content}
    />
  )
}

export default function SocialMediaPost({
  agentBody,
  chatId,
  messageId
}: {
  agentBody: AgentBodyProps
  chatId: string
  messageId?: string
}) {
  const { tweet = {}, linkedin_post = {} } = agentBody || {}
  const idPrefix = messageId || chatId

  const renderPlatformContent = (
    postType: PostType = {},
    platform: 'Twitter' | 'LinkedIn'
  ) => {
    const drafts = postType.drafts || []
    const feedback = postType.feedback || ''

    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{platform} Content</h2>
        {drafts.length > 0 ? (
          <>
            {drafts.map((draft, index) => {
              const artifactId = `${idPrefix}-${platform.toLowerCase()}-draft-${index}`
              return (
                <PlatformDraftDocument
                  key={artifactId}
                  artifactId={artifactId}
                  draft={draft}
                  platform={platform}
                  chatId={chatId}
                  index={index}
                />
              )
            })}
            {feedback && (
              <PlatformFeedbackDocument
                key={`${idPrefix}-${platform.toLowerCase()}-feedback`}
                artifactId={`${idPrefix}-${platform.toLowerCase()}-feedback`}
                feedback={feedback}
                platform={platform}
              />
            )}
          </>
        ) : (
          <p className="text-sm text-gray-500">No content available</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full gap-8">
      {renderPlatformContent(tweet, 'Twitter')}
      {renderPlatformContent(linkedin_post, 'LinkedIn')}
    </div>
  )
}
