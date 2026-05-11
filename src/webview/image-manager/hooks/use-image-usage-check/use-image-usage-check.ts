import { lazy } from 'react'
import { useTranslation } from 'react-i18next'
import useImperativeModal from '../use-imperative-modal'

const ImageUsageCheck = lazy(() => import('./image-usage-check'))

export default function useImageUsageCheck() {
  const { t } = useTranslation()

  const { showModal } = useImperativeModal({
    id: 'image-usage-check',
    modalProps: {
      title: t('im.check_image_usages'),
      width: 960,
    },
    FC: ImageUsageCheck,
  })

  return {
    showImageUsageCheck: showModal,
  }
}
