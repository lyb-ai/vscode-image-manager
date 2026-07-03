import { createStore } from 'jotai/vanilla'
import { describe, expect, it } from 'vitest'
import { UsageActionType, usageStateAtom } from '~/webview/image-manager/stores/usage/usage-store'

function dispatch(action: { type: UsageActionType }) {
  const store = createStore()
  store.set(usageStateAtom as Parameters<typeof store.set>[0], action as Parameters<typeof store.set>[1])
  return store.get(usageStateAtom)
}

describe('usage state', () => {
  it('does not mark checking as an error state', () => {
    const nextState = dispatch({ type: UsageActionType.start })

    expect(nextState.status).toBe('checking')
    expect(nextState.error).toBe(false)
    expect(nextState.stale).toBe(false)
  })
})
