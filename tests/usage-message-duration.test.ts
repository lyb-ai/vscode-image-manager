import { describe, expect, it, vi } from 'vitest'
import { waitForMinimumLoadingDuration } from '~/webview/image-manager/hooks/use-image-operation'

describe('waitForMinimumLoadingDuration', () => {
  it('waits the remaining time when loading finishes too quickly', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-12T10:00:00.000Z'))

    const pending = waitForMinimumLoadingDuration(Date.now() - 100, 500)
    let resolved = false
    void pending.then(() => {
      resolved = true
    })

    await vi.advanceTimersByTimeAsync(399)
    expect(resolved).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await pending
    expect(resolved).toBe(true)

    vi.useRealTimers()
  })

  it('does not wait when loading already exceeded the minimum duration', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-12T10:00:00.000Z'))

    const pending = waitForMinimumLoadingDuration(Date.now() - 500, 500)
    await expect(pending).resolves.toBeUndefined()

    vi.useRealTimers()
  })
})
