import type { ImageUsageRecord, ImageUsageStatus } from '../../hooks/use-image-usage-check/types'
import { atomWithReducer } from 'jotai/utils'

export type UsageState = {
  stale: boolean
  status: ImageUsageStatus
  lastCheckedAt?: number
  scannedFileCount: number
  error: boolean
  records: Record<string, ImageUsageRecord>
  lastSuccessfulResult?: {
    lastCheckedAt: number
    scannedFileCount: number
    records: Record<string, ImageUsageRecord>
  }
}

export enum UsageActionType {
  start = 'start',
  finish = 'finish',
  fail = 'fail',
  mark_stale = 'mark_stale',
  reset = 'reset',
}

const initialState: UsageState = {
  stale: false,
  status: 'idle',
  lastCheckedAt: undefined,
  scannedFileCount: 0,
  error: false,
  records: {},
  lastSuccessfulResult: undefined,
}

export const usageStateAtom = atomWithReducer(
  initialState,
  (
    state,
    action:
      | { type: UsageActionType.start }
      | { type: UsageActionType.finish, records: ImageUsageRecord[], scannedFileCount: number }
      | { type: UsageActionType.fail }
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
          error: false,
        }
      case UsageActionType.finish: {
        const nextRecords = action.records.reduce<Record<string, ImageUsageRecord>>((acc, item) => {
          acc[item.imagePath] = item
          return acc
        }, {})
        return {
          stale: false,
          status: 'completed',
          lastCheckedAt: Date.now(),
          scannedFileCount: action.scannedFileCount,
          error: false,
          records: nextRecords,
          lastSuccessfulResult: {
            lastCheckedAt: Date.now(),
            scannedFileCount: action.scannedFileCount,
            records: nextRecords,
          },
        }
      }
      case UsageActionType.fail:
        return {
          ...state,
          stale: false,
          status: 'completed',
          error: true,
          lastCheckedAt: state.lastSuccessfulResult?.lastCheckedAt,
          scannedFileCount: state.lastSuccessfulResult?.scannedFileCount || 0,
          records: state.lastSuccessfulResult?.records || {},
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
