export type ImageUsageStatus = 'idle' | 'checking' | 'completed'

export type ImageUsageResult = {
  imagePath: string
  status: 'used' | 'unused' | 'error'
  references: string[]
  matchedCount: number
}

export type ImageUsageRecord = ImageUsageResult & {
  image: ImageType
}
