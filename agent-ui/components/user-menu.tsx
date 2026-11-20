'use client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useClerk } from '@clerk/nextjs'
export interface UserMenuProps {
  // user: User
}

function getUserInitials(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return 'U'
  const [firstName, lastName] = trimmed.split(' ')
  return lastName ? `${firstName[0]}${lastName[0]}` : firstName.slice(0, 2)
}

export function UserMenu({}: UserMenuProps) {
  const { signOut, user } = useClerk()
  const primaryEmail = user?.emailAddresses?.[0]?.emailAddress || ''
  const displayLabel = user?.firstName || user?.username || primaryEmail

  return (
    <div className="flex items-center justify-between">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="pl-0">
            <div className="flex size-7 shrink-0 select-none items-center justify-center rounded-full bg-muted/50 text-xs font-medium uppercase text-muted-foreground">
              {getUserInitials(displayLabel)}
            </div>
            <span className="ml-2 hidden md:block">
              {user?.firstName || user?.username || 'Account'}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent sideOffset={8} align="start" className="w-fit">
          {primaryEmail && (
            <>
              <DropdownMenuItem className="flex-col items-start">
                <div className="text-xs text-zinc-500">{primaryEmail}</div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <form>
            <button
              className=" relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none transition-colors hover:bg-red-500 hover:text-white focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
              onClick={() => signOut({ redirectUrl: '/' })}
              type="button"
            >
              Sign Out
            </button>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
