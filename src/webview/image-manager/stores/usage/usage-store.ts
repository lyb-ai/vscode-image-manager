import type { ImageUsageRecord, ImageUsageStatus } from '../../hooks/use-image-usage-check/types'
import { atomWithReducer } from 'jotai/utils'

export type UsageState = {
  stale: boolean
  status: ImageUsageStatus
  lastCheckedAt?: number
  records: Record<string, ImageUsageRecord>
}

export enum UsageActionType {
  start = 'start',
  finish = 'finish',
  mark_stale = 'mark_stale',
  reset = 'reset',
}

const initialState: UsageState = {
  stale: false,
  status: 'idle',
  lastCheckedAt: undefined,
  records: {},
}

export const usageStateAtom = atomWithReducer(
  initialState,
  (
    state,
    action:
      | { type: UsageActionType.start }
      | { type: UsageActionType.finish, records: ImageUsageRecord[] }
      | { type: UsageActionType.mark_stale }
      | { type: UsageActionType.reset }
      | undefined,
  ): UsageState => {
    if (!action) {
      return state
    }

    switch (action.type) {
      case UsageActionType.start:
        return {
          ...state,
          stale: false,
          status: 'checking',
        }
      case UsageActionType.finish:
        return {
          stale: false,
          status: 'completed',
          lastCheckedAt: Date.now(),
          records: action.records.reduce<Record<string, ImageUsageRecord>>((acc, item) => {
            acc[item.imagePath] = item
            return acc
          }, {}),
        }
      case UsageActionType.mark_stale:
        if (state.status === 'idle') {
          return state
        }
        return {
          ...state,
          stale: true,
        }
      case UsageActionType.reset:
        return initialState
      default:
        return state
    }
  },
)
