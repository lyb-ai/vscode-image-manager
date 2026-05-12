import type { MessageInstance } from 'antd/es/message/interface'
import { Alert, Button, Divider, List, message, Space, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { memo, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CmdToVscode } from '~/message/cmd'
import { slashPath } from '~/utils'
import { vscodeApi } from '~/webview/vscode-api'
import EmptyImage from '../../components/empty'
import { useUsageState } from '../../stores/usage/hooks'

const { Text } = Typography

type Props = {
  onScan: (messageApi: MessageInstance) => Promise<void>
}

function ImageUsageCheck(props: Props) {
  const { onScan } = props
  const { t } = useTranslation()
  const usageState = useUsageState()
  const [messageApi, contextHolder] = message.useMessage()
  const [activePath, setActivePath] = useState<string>()

  const isChecking = usageState.status === 'checking'
  const hasScannedResult = usageState.lastCheckedAt !== undefined
  const hasFailedResult = usageState.error

  const records = useMemo(
    () => Object.values(usageState.records).sort((a, b) => a.image.relativePath.localeCompare(b.image.relativePath)),
    [usageState.records],
  )
  const unusedRecords = useMemo(
    () => records
      .filter(item => item.status === 'unused')
      .sort((a, b) => a.image.relativePath.localeCompare(b.image.relativePath)),
    [records],
  )
  const usedRecords = useMemo(
    () => records
      .filter(item => item.status === 'used')
      .sort((a, b) => b.matchedCount - a.matchedCount || a.image.relativePath.localeCompare(b.image.relativePath)),
    [records],
  )
  const hasError = useMemo(() => records.some(item => item.status === 'error'), [records])
  const activeRecord = activePath ? usageState.records[activePath] : undefined

  useEffect(() => {
    if (!records.length) {
      setActivePath(undefined)
      return
    }

    if (activePath && usageState.records[activePath]) {
      return
    }

    setActivePath(unusedRecords[0]?.imagePath || usedRecords[0]?.imagePath || records[0]?.imagePath)
  }, [activePath, records, unusedRecords, usedRecords, usageState.records])

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
    if (!hasScannedResult) {
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
    }

    if (hasFailedResult) {
      return <EmptyImage render={() => t('im.usage_scan_failed')} />
    }

    if (!records.length) {
      return <EmptyImage render={() => t('im.no_images_to_scan')} />
    }

    if (!usageState.scannedFileCount) {
      return <EmptyImage render={() => t('im.no_scannable_files_found')} />
    }

    return null
  }, [hasFailedResult, hasScannedResult, records.length, t, usageState.scannedFileCount])

  const shouldShowResultPanel = records.length > 0 && usageState.scannedFileCount > 0

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
          <Button type='primary' loading={isChecking} onClick={() => void onScan(messageApi)}>
            {hasScannedResult ? t('im.rescan') : t('im.scan')}
          </Button>
        </Space>

        {usageState.stale && (
          <Alert
            type='warning'
            showIcon
            message={t('im.usage_results_may_be_outdated')}
          />
        )}

        {hasError && usageState.status === 'completed' && (
          <Alert type='error' showIcon message={t('im.usage_scan_failed')} />
        )}

        {(hasScannedResult || records.length > 0) && (
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
