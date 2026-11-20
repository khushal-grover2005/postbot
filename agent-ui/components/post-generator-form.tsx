'use client'

import type { AI, UIState } from '@/app/(chat)/actions'
import { UserMessage } from '@/components/message'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { generateId } from 'ai'
import { useActions, useUIState } from 'ai/rsc'
import { useState } from 'react'
import { toast } from 'sonner'

interface PostGeneratorFormProps {
  id: string
  initialPostDetails?: string
  initialAudience?: string
  initialDrafts?: string | number
}

export function PostGeneratorForm({
  initialDrafts,
  initialAudience,
  initialPostDetails,
  id
}: PostGeneratorFormProps) {
  const [, setMessages] = useUIState<typeof AI>()
  const { sendMessage } = useActions<typeof AI>()

  const [postDetails, setPostDetails] = useState(initialPostDetails || '')
  const [audience, setAudience] = useState(initialAudience || '')
  const [drafts, setDrafts] = useState(String(initialDrafts || '1'))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(
    Boolean(initialPostDetails && initialPostDetails.length > 0) ||
      Boolean(initialAudience && initialAudience.length > 0)
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting || isSubmitted) return

    setIsSubmitting(true)

    setMessages((currentMessages: UIState[]) => [
      ...currentMessages,
      {
        id: generateId(),
        role: 'human',
        display: (
          <UserMessage>
            <div className="flex flex-col w-full gap-4">
              <div className="flex flex-col w-full gap-1">
                <h3 className="font-semibold font-urban">Post Details:</h3>
                <p className="font-poppins"> {postDetails}</p>
              </div>
              <div className="flex flex-col w-full gap-1">
                <h3 className="font-semibold font-urban">Audience:</h3>
                <p className="font-poppins"> {audience}</p>
              </div>
            </div>
          </UserMessage>
        )
      }
    ])

    try {
      const responseMessage = await sendMessage(
        postDetails,
        audience,
        parseInt(drafts, 10) || 1,
        id
      )

      setMessages((currentMessages: UIState[]) => [
        ...currentMessages,
        responseMessage
      ])
      setIsSubmitted(true)
    } catch (error) {
      console.error('Failed to submit post form:', error)
      toast.error('Failed to generate drafts. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isButtonDisabled = isSubmitting || isSubmitted

  return (
    <div className="">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="post-details" className="text-primary font-medium">
            Post Details
          </Label>
          <Textarea
            id="post-details"
            placeholder="Enter your post details here..."
            value={postDetails}
            onChange={e => setPostDetails(e.target.value)}
            disabled={isButtonDisabled}
            required
            className="w-full px-3 py-2 text-primary border rounded-lg focus:outline-none focus:border-blue-500 transition-colors duration-300"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="audience" className="text-primary font-medium">
            Audience
          </Label>
          <Input
            id="audience"
            placeholder="Define your audience"
            value={audience}
            onChange={e => setAudience(e.target.value)}
            disabled={isButtonDisabled}
            required
            className="w-full px-3 py-2 text-primary border rounded-lg focus:outline-none focus:border-blue-500 transition-colors duration-300"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="drafts" className="text-primary font-medium">
            Number of Drafts
          </Label>
          <Select
            value={drafts}
            onValueChange={setDrafts}
            disabled={isButtonDisabled}
          >
            <SelectTrigger className="w-full px-3 py-2 text-primary border rounded-lg focus:outline-none focus:border-blue-500 transition-colors duration-300">
              <SelectValue placeholder="Select number of drafts" />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map(num => (
                <SelectItem
                  key={num}
                  value={num.toString()}
                  className="text-primary"
                >
                  {num}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" className="w-full" disabled={isButtonDisabled}>
          {isSubmitting
            ? 'Generating...'
            : isSubmitted
              ? 'Drafts Generated'
              : 'Generate Drafts'}
        </Button>
      </form>
    </div>
  )
}
