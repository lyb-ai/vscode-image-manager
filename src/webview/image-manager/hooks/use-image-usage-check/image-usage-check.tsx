import { Alert, Button, Divider, List, Space, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import EmptyImage from '../../components/empty'
import { useUsageState } from '../../stores/usage/hooks'

const { Text } = Typography

type Props = {
  onScan: () => Promise<void>
}

function ImageUsageCheck(props: Props) {
  const { onScan } = props
  const { t } = useTranslation()
  const usageState = useUsageState()
  const [activePath, setActivePath] = useState<string>()

  const records = useMemo(() => Object.values(usageState.records), [usageState.records])
  const unusedRecords = useMemo(() => records.filter(item => item.status === 'unused'), [records])
  const usedRecords = useMemo(() => records.filter(item => item.status === 'used'), [records])
  const activeRecord = activePath ? usageState.records[activePath] : undefined

  return (
    <div className='flex min-h-[480px] flex-col gap-4'>
      <Space className='w-full justify-between'>
        <div className='flex flex-col gap-1'>
          <Text strong>{t('im.check_image_usages')}</Text>
          <Text type='secondary'>
            {usageState.lastCheckedAt
              ? t('im.last_scanned_at', { time: dayjs(usageState.lastCheckedAt).format('YYYY-MM-DD HH:mm:ss') })
              : t('im.usage_scan_on_demand')}
          </Text>
        </div>
        <Button type='primary' loading={usageState.status === 'checking'} onClick={() => void onScan()}>
          {usageState.status === 'completed' ? t('im.rescan') : t('im.scan')}
        </Button>
      </Space>

      {usageState.stale && (
        <Alert
          type='warning'
          showIcon
          message={t('im.usage_results_may_be_outdated')}
        />
      )}

      {usageState.status === 'checking' && (
        <Alert type='info' showIcon message={t('im.scanning_workspace_references')} />
      )}

      {usageState.status === 'completed' && (
        <Space wrap>
          <Tag>
            {t('im.total_images')}
            :
            {' '}
            {records.length}
          </Tag>
          <Tag color='success'>
            {t('im.used')}
            :
            {' '}
            {usedRecords.length}
          </Tag>
          <Tag color='warning'>
            {t('im.unused')}
            :
            {' '}
            {unusedRecords.length}
          </Tag>
        </Space>
      )}

      {usageState.status === 'idle'
        ? (
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
        : (
            <div className='grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4'>
              <div className='min-h-0 overflow-auto rounded border border-solid border-[var(--ant-color-border-secondary)] p-3'>
                <div className='mb-2 text-sm font-medium'>{t('im.unused')}</div>
                <List
                  locale={{ emptyText: <EmptyImage /> }}
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
                  locale={{ emptyText: <EmptyImage /> }}
                  dataSource={usedRecords}
                  renderItem={item => (
                    <List.Item className='cursor-pointer' onClick={() => setActivePath(item.imagePath)}>
                      <Space direction='vertical' size={0}>
                        <Text>{item.image.basename}</Text>
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

                        {activeRecord.references.length
                          ? (
                              <List
                                size='small'
                                dataSource={activeRecord.references}
                                renderItem={reference => (
                                  <List.Item>
                                    <Text code>{reference}</Text>
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
          )}
    </div>
  )
}

export default memo(ImageUsageCheck)
