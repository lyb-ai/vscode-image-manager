import { describe, expect, it } from 'vitest'
import { getInitialScanFiltersExpanded, getUsageEmptyState } from '~/webview/image-manager/hooks/use-image-usage-check/image-usage-check'

describe('getInitialScanFiltersExpanded', () => {
  it('returns false when include and exclude are both empty', () => {
    expect(getInitialScanFiltersExpanded('', '')).toBe(false)
  })

  it('returns true when include has a value', () => {
    expect(getInitialScanFiltersExpanded('src/**', '')).toBe(true)
  })

  it('returns true when exclude has a value', () => {
    expect(getInitialScanFiltersExpanded('', 'dist/**')).toBe(true)
  })
})

describe('getUsageEmptyState', () => {
  it('returns on_demand before any scan has run', () => {
    expect(getUsageEmptyState({ hasScannedResult: false, hasFailedResult: false, recordsCount: 0, filteredRecordsCount: 0 })).toBe('on_demand')
  })

  it('returns scan_failed when the scan failed and no records exist', () => {
    expect(getUsageEmptyState({ hasScannedResult: true, hasFailedResult: true, recordsCount: 0, filteredRecordsCount: 0 })).toBe('scan_failed')
  })

  it('returns no_images when a scan finished but no images exist', () => {
    expect(getUsageEmptyState({ hasScannedResult: true, hasFailedResult: false, recordsCount: 0, filteredRecordsCount: 0 })).toBe('no_images')
  })

  it('returns no_search_results when records exist but the filter matches none', () => {
    expect(getUsageEmptyState({ hasScannedResult: true, hasFailedResult: false, recordsCount: 5, filteredRecordsCount: 0 })).toBe('no_search_results')
  })

  it('does not hide results when records exist but no files were scanned', () => {
    expect(getUsageEmptyState({ hasScannedResult: true, hasFailedResult: false, recordsCount: 5, filteredRecordsCount: 5 })).toBeNull()
  })
})
