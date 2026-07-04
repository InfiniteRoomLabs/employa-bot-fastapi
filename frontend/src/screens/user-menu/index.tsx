/**
 * User menu popover preview - bypasses AppFrame.
 *
 * Picker id: `user-menu`
 * Route path: `/preview/user-menu` (Phase 9)
 *
 * Renders the `UserMenuPopover` domain component anchored to a static avatar
 * button. Phase 9 will move it into the sidebar user pod.
 */

import { UserIcon } from "lucide-react"
import { UserMenuPopover } from "@/components/domain/user-menu-popover"
import { Button } from "@/components/ui/button-eb"

export default function UserMenuScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--bg)] p-8">
      <UserMenuPopover
        trigger={
          <Button variant="secondary" size="icon" aria-label="Open user menu">
            <UserIcon className="size-4" />
          </Button>
        }
      />
    </div>
  )
}
