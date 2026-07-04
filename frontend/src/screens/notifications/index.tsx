/**
 * Notifications popover preview - bypasses AppFrame.
 *
 * Picker id: `notifications`
 * Route path: `/preview/notifications` (Phase 9)
 *
 * Renders the `NotificationsPopover` domain component open by default so
 * the popover surface is visible as a flat preview. Phase 9 will move it
 * into the topbar bell trigger.
 */

import { BellIcon } from "lucide-react"
import { NotificationsPopover } from "@/components/domain/notifications-popover"
import { Button } from "@/components/ui/button-eb"

export default function NotificationsScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--bg)] p-8">
      <NotificationsPopover
        trigger={
          <Button
            variant="secondary"
            size="icon"
            aria-label="Open notifications"
          >
            <BellIcon className="size-4" />
          </Button>
        }
      />
    </div>
  )
}
