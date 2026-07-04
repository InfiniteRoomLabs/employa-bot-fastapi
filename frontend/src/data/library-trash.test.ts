import { afterEach, describe, expect, it } from "vitest"

import {
  __resetForTests,
  deleteProject,
  getDeletionImpact,
  getProjects,
  getTrash,
  purgeLibraryItem,
  restoreLibraryItem,
} from "./api"

afterEach(() => __resetForTests())

// D24 -- Library soft-delete, trash, restore, purge, dependent-count.
describe("library soft-delete + trash", () => {
  it("soft-deletes: gone from the live list, present in trash, restorable", async () => {
    const target = (await getProjects())[0]

    await deleteProject(target.id)
    expect(
      (await getProjects()).find((p) => p.id === target.id),
    ).toBeUndefined()

    const trash = await getTrash()
    expect(trash.some((t) => t.id === target.id && t.kind === "project")).toBe(
      true,
    )

    await restoreLibraryItem("project", target.id)
    expect((await getProjects()).find((p) => p.id === target.id)).toBeDefined()
  })

  it("purge permanently removes the item from trash", async () => {
    const target = (await getProjects())[0]
    await deleteProject(target.id)
    await purgeLibraryItem("project", target.id)
    expect((await getTrash()).some((t) => t.id === target.id)).toBe(false)
  })

  it("reports dependent accomplishments before a project delete", async () => {
    const impact = await getDeletionImpact("project", "pj-ingest")
    expect(impact.total).toBeGreaterThan(0)
    expect(impact.dependents.some((d) => d.kind === "accomplishment")).toBe(
      true,
    )
  })
})
