'use client'
import type { AI, UIState } from '@/app/(chat)/actions'
import { UserMessage } from '@/components/message'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { SignIn, useUser } from '@clerk/nextjs'
import { generateId } from 'ai'
import { useActions, useUIState } from 'ai/rsc'
import { useState } from 'react'
import { toast } from 'sonner'

export const GeneratePostButton = () => {
  const [, setMessages] = useUIState<typeof AI>()
  const { showForm } = useActions<typeof AI>()
  const { user } = useUser()
  const [showSignIn, setShowSignIn] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleClicked = async () => {
    if (!user) {
      setShowSignIn(true)
      return
    }

    if (isLoading) return
    setIsLoading(true)

    setMessages((currentMessages: UIState[]) => [
      ...currentMessages,
      {
        id: generateId(),
        role: 'human',
        display: (
          <UserMessage>
            PostBot 3000, generate engaging posts for me!
          </UserMessage>
        )
      }
    ])

    try {
      const responseMessage = await showForm(
        'PostBot 3000, generate engaging posts for me!'
      )

      setMessages((currentMessages: UIState[]) => [
        ...currentMessages,
        responseMessage
      ])
    } catch (error) {
      console.error('Failed to open post form:', error)
      toast.error('Failed to start a new post. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDialogClose = (open: boolean) => {
    setShowSignIn(open)
  }

  return (
    <>
      <Button
        className="px-8 text-lg w-full rounded-full drop-shadow"
        size={'lg'}
        onClick={handleClicked}
        disabled={isLoading}
      >
        {isLoading ? 'Loading...' : 'Generate a Post'}
      </Button>
      <Dialog open={showSignIn} onOpenChange={handleDialogClose}>
        <DialogContent className="flex items-center justify-center bg-transparent border-none shadow-none">
          <SignIn routing="hash" />
        </DialogContent>
      </Dialog>
    </>
  )
}
