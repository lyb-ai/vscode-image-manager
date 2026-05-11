import type { ImageUsageRecord } from '../../hooks/use-image-usage-check/types'
import { useMemoizedFn } from 'ahooks'
import { useAtomValue, useSetAtom } from 'jotai'
import { UsageActionType, usageStateAtom } from './usage-store'

export function useUsageState() {
  return useAtomValue(usageStateAtom)
}

export function useUsageActions() {
  const dispatch = useSetAtom(usageStateAtom)

  const start = useMemoizedFn(() => {
    dispatch({ type: UsageActionType.start })
  })

  const finish = useMemoizedFn((records: ImageUsageRecord[]) => {
    dispatch({ type: UsageActionType.finish, records })
  })

  const markStale = useMemoizedFn(() => {
    dispatch({ type: UsageActionType.mark_stale })
  })

  const reset = useMemoizedFn(() => {
    dispatch({ type: UsageActionType.reset })
  })

  return {
    start,
    finish,
    markStale,
    reset,
  }
}
