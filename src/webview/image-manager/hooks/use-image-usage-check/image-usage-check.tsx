import type { MessageInstance } from 'antd/es/message/interface'
import type { ImageUsageScanOptions } from './types'
import { MoreOutlined } from '@ant-design/icons'
import { Alert, Button, Divider, Input, List, message, Segmented, Space, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { memo, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CmdToVscode } from '~/message/cmd'
import { slashPath } from '~/utils'
import { vscodeApi } from '~/webview/vscode-api'
import EmptyImage from '../../components/empty'
import { useUsageState } from '../../stores/usage/hooks'

const { Text } = Typography

function parseUsageList(value: string) {
  return value
    .split(/\r?\n|,/)
    .map(item => item.trim())
    .filter(Boolean)
}

// eslint-disable-next-line react-refresh/only-export-components
export function getInitialScanFiltersExpanded(includeInput: string, excludeInput: string) {
  return Boolean(includeInput.trim() || excludeInput.trim())
}

export type UsageEmptyState = 'on_demand' | 'scan_failed' | 'no_images' | 'no_search_results' | null

// eslint-disable-next-line react-refresh/only-export-components
export function getUsageEmptyState(args: {
  hasScannedResult: boolean
  hasFailedResult: boolean
  recordsCount: number
  filteredRecordsCount: number
}): UsageEmptyState {
  const { hasScannedResult, hasFailedResult, recordsCount, filteredRecordsCount } = args
  if (!hasScannedResult) {
    return 'on_demand'
  }
  if (hasFailedResult && !recordsCount) {
    return 'scan_failed'
  }
  if (!recordsCount) {
    return 'no_images'
  }
  if (!filteredRecordsCount) {
    return 'no_search_results'
  }
  return null
}

type Props = {
  onScan: (messageApi: MessageInstance, scanOptions: ImageUsageScanOptions) => Promise<void>
}

function ImageUsageCheck(props: Props) {
  const { onScan } = props
  const { t } = useTranslation()
  const usageState = useUsageState()
  const [messageApi, contextHolder] = message.useMessage()
  const [activePath, setActivePath] = useState<string>()
  const [searchValue, setSearchValue] = useState('')
  const [resultFilter, setResultFilter] = useState<'all' | 'used' | 'possibly_unused'>('all')
  const [includeInput, setIncludeInput] = useState('')
  const [excludeInput, setExcludeInput] = useState('')
  const [showScanFilters, setShowScanFilters] = useState(() => getInitialScanFiltersExpanded('', ''))

  const isChecking = usageState.status === 'checking'
  const hasScannedResult = usageState.lastCheckedAt !== undefined
  const hasFailedResult = usageState.error

  const scanOptions = useMemo<ImageUsageScanOptions>(() => {
    return {
      include: parseUsageList(includeInput),
      exclude: parseUsageList(excludeInput),
    }
  }, [excludeInput, includeInput])

  const records = useMemo(
    () => Object.values(usageState.records).sort((a, b) => a.image.relativePath.localeCompare(b.image.relativePath)),
    [usageState.records],
  )
  const hasError = useMemo(() => records.some(item => item.status === 'error'), [records])
  const normalizedSearchValue = searchValue.trim().toLowerCase()
  const filteredRecords = useMemo(() => {
    return records.filter((item) => {
      const matchesFilter = resultFilter === 'all'
        || (resultFilter === 'used' && item.status === 'used')
        || (resultFilter === 'possibly_unused' && item.status === 'unused')

      if (!matchesFilter) {
        return false
      }

      if (!normalizedSearchValue) {
        return true
      }

      const keywords = [item.image.basename, item.image.relativePath, item.image.dirPath]
        .filter(Boolean)
        .map(value => value.toLowerCase())

      return keywords.some(value => value.includes(normalizedSearchValue))
    })
  }, [normalizedSearchValue, records, resultFilter])
  const unusedRecords = useMemo(
    () => filteredRecords
      .filter(item => item.status === 'unused')
      .sort((a, b) => a.image.relativePath.localeCompare(b.image.relativePath)),
    [filteredRecords],
  )
  const usedRecords = useMemo(
    () => filteredRecords
      .filter(item => item.status === 'used')
      .sort((a, b) => b.matchedCount - a.matchedCount || a.image.relativePath.localeCompare(b.image.relativePath)),
    [filteredRecords],
  )
  const activeRecord = activePath ? usageState.records[activePath] : undefined

  useEffect(() => {
    if (!filteredRecords.length) {
      setActivePath(undefined)
      return
    }

    if (activePath && filteredRecords.some(item => item.imagePath === activePath)) {
      return
    }

    setActivePath(unusedRecords[0]?.imagePath || usedRecords[0]?.imagePath || filteredRecords[0]?.imagePath)
  }, [activePath, filteredRecords, unusedRecords, usedRecords])

  const activeReferences = useMemo(() => {
    if (!activeRecord) {
      return []
    }

    return activeRecord.references.map((reference) => {
      const normalizedReference = slashPath(reference.filePath)
      const relativePath = slashPath(normalizedReference.replace(`${slashPath(activeRecord.image.absWorkspaceFolder)}/`, ''))
      return {
        ...reference,
        relativePath: `./${relativePath}`,
      }
    })
  }, [activeRecord])

  const summaryDescription = useMemo(() => {
    if (!hasScannedResult) {
      return null
    }

    return t('im.usage_summary', {
      imageCount: records.length,
      fileCount: usageState.scannedFileCount,
    })
  }, [hasScannedResult, records.length, t, usageState.scannedFileCount])

  const emptyContent = useMemo(() => {
    switch (getUsageEmptyState({
      hasScannedResult,
      hasFailedResult,
      recordsCount: records.length,
      filteredRecordsCount: filteredRecords.length,
    })) {
      case 'on_demand':
        return (
          <EmptyImage render={description => (
            <span>
              {description}
              {' '}
              ·
              {' '}
              {t('im.usage_scan_on_demand')}
            </span>
          )}
          />
        )
      case 'scan_failed':
        return <EmptyImage render={() => t('im.usage_scan_failed')} />
      case 'no_images':
        return <EmptyImage render={() => t('im.no_images_to_scan')} />
      case 'no_search_results':
        return <EmptyImage render={() => t('im.no_search_results')} />
      default:
        return null
    }
  }, [filteredRecords.length, hasFailedResult, hasScannedResult, records.length, t])

  const shouldShowResultPanel = filteredRecords.length > 0

  return (
    <>
      {contextHolder}
      <div className='flex min-h-[480px] flex-col gap-4'>
        <Space className='w-full justify-between'>
          <div className='flex flex-col gap-1'>
            <Text strong>{t('im.check_image_usages')}</Text>
            <Text type='secondary'>
              {usageState.lastCheckedAt
                ? t('im.last_scanned_at', { time: dayjs(usageState.lastCheckedAt).format('YYYY-MM-DD HH:mm:ss') })
                : t('im.usage_scan_on_demand')}
            </Text>
            {summaryDescription && <Text type='secondary'>{summaryDescription}</Text>}
          </div>
          <Space>
            <Button
              icon={<MoreOutlined />}
              onClick={() => setShowScanFilters(value => !value)}
              aria-label={t('im.toggle_options')}
            />
            <Button type='primary' loading={isChecking} onClick={() => void onScan(messageApi, scanOptions)}>
              {hasScannedResult ? t('im.rescan') : t('im.scan')}
            </Button>
          </Space>
        </Space>

        {showScanFilters && (
          <Space direction='vertical' className='w-full' size='small'>
            <div className='flex flex-col gap-1'>
              <Text type='secondary'>{t('im.files_to_include')}</Text>
              <Input
                value={includeInput}
                onChange={e => setIncludeInput(e.target.value)}
                placeholder={t('im.include_glob_placeholder')}
              />
            </div>
            <div className='flex flex-col gap-1'>
              <Text type='secondary'>{t('im.files_to_exclude')}</Text>
              <Input
                value={excludeInput}
                onChange={e => setExcludeInput(e.target.value)}
                placeholder={t('im.exclude_glob_placeholder')}
              />
            </div>
          </Space>
        )}

        {usageState.stale && (
          <Alert
            type='warning'
            showIcon
            message={t('im.usage_results_may_be_outdated')}
            description={t('im.usage_rescan_recommended')}
            action={<Button size='small' type='primary' loading={isChecking} onClick={() => void onScan(messageApi, scanOptions)}>{t('im.rescan')}</Button>}
          />
        )}

        {hasError && usageState.status === 'completed' && (
          <Alert type='error' showIcon message={t('im.usage_scan_failed')} />
        )}

        {hasScannedResult && !hasFailedResult && records.length > 0 && !usageState.scannedFileCount && (
          <Alert
            type='info'
            showIcon
            message={t('im.no_scannable_files_found')}
            description={t('im.no_scannable_files_found_description')}
          />
        )}

        {(hasScannedResult || records.length > 0) && (
          <Space direction='vertical' className='w-full' size='small'>
            <Space wrap>
              <Tag>
                {t('im.total_images')}
                :
                {' '}
                {records.length}
              </Tag>
              <Tag>
                {t('im.scanned_files')}
                :
                {' '}
                {usageState.scannedFileCount}
              </Tag>
              <Tag color='success'>
                {t('im.used')}
                :
                {' '}
                {usedRecords.length}
              </Tag>
              <Tag color='warning'>
                {t('im.possibly_unused')}
                :
                {' '}
                {unusedRecords.length}
              </Tag>
            </Space>
            <Space wrap className='w-full justify-between'>
              <Segmented
                value={resultFilter}
                onChange={value => setResultFilter(value as 'all' | 'used' | 'possibly_unused')}
                options={[
                  { label: t('im.all_results'), value: 'all' },
                  { label: t('im.used'), value: 'used' },
                  { label: t('im.possibly_unused'), value: 'possibly_unused' },
                ]}
              />
              <Input
                allowClear
                value={searchValue}
                onChange={e => setSearchValue(e.target.value)}
                placeholder={t('im.search_usage_results')}
                className='w-full max-w-80'
              />
            </Space>
          </Space>
        )}

        {shouldShowResultPanel
          ? (
              <div className='grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4'>
                <div className='min-h-0 overflow-auto rounded border border-solid border-[var(--ant-color-border-secondary)] p-3'>
                  <div className='mb-2 text-sm font-medium'>{t('im.possibly_unused')}</div>
                  <List
                    locale={{ emptyText: <EmptyImage render={() => t('im.no_possibly_unused_images')} /> }}
                    dataSource={unusedRecords}
                    renderItem={item => (
                      <List.Item className='cursor-pointer' onClick={() => setActivePath(item.imagePath)}>
                        <Space direction='vertical' size={0}>
                          <Text>{item.image.basename}</Text>
                          <Text type='secondary'>{item.image.relativePath}</Text>
                        </Space>
                      </List.Item>
                    )}
                  />

                  <Divider />

                  <div className='mb-2 text-sm font-medium'>{t('im.used')}</div>
                  <List
                    locale={{ emptyText: <EmptyImage render={() => t('im.no_used_images')} /> }}
                    dataSource={usedRecords}
                    renderItem={item => (
                      <List.Item className='cursor-pointer' onClick={() => setActivePath(item.imagePath)}>
                        <Space direction='vertical' size={0}>
                          <Text>{item.image.basename}</Text>
                          <Text type='secondary'>{item.image.relativePath}</Text>
                          <Text type='secondary'>
                            {item.matchedCount}
                            {' '}
                            {t('im.references')}
                          </Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                </div>

                <div className='min-h-0 overflow-auto rounded border border-solid border-[var(--ant-color-border-secondary)] p-3'>
                  {activeRecord
                    ? (
                        <Space direction='vertical' className='w-full' size='middle'>
                          <div>
                            <Text strong>{activeRecord.image.basename}</Text>
                            <div>
                              <Text type='secondary'>{activeRecord.image.relativePath}</Text>
                            </div>
                          </div>

                          {activeReferences.length
                            ? (
                                <List
                                  size='small'
                                  dataSource={activeReferences}
                                  renderItem={reference => (
                                    <List.Item>
                                      <Button
                                        type='link'
                                        className='!px-0'
                                        onClick={() => {
                                          setActivePath(activeRecord.imagePath)
                                          vscodeApi.postMessage({
                                            cmd: CmdToVscode.open_file_in_text_editor,
                                            data: {
                                              filePath: reference.filePath,
                                              line: reference.line,
                                              column: reference.column,
                                            },
                                          })
                                        }}
                                      >
                                        <Text code>{reference.relativePath}</Text>
                                        <Text type='secondary'>
                                          {`:${reference.line}:${reference.column}`}
                                        </Text>
                                      </Button>
                                    </List.Item>
                                  )}
                                />
                              )
                            : (
                                <EmptyImage render={() => t('im.no_references_found')} />
                              )}
                        </Space>
                      )
                    : <EmptyImage render={() => t('im.select_image_usage_result')} />}
                </div>
              </div>
            )
          : emptyContent}
      </div>
    </>
  )
}

export default memo(ImageUsageCheck)
