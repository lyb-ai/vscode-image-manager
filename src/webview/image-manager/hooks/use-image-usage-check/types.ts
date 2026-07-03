export type ImageUsageStatus = 'idle' | 'checking' | 'completed'

export type ImageUsageReference = {
  filePath: string
  line: number
  column: number
  text: string
}

export type ImageUsageResult = {
  imagePath: string
  status: 'used' | 'unused' | 'error'
  references: ImageUsageReference[]
  matchedCount: number
}

export type ImageUsageScanResult = {
  records: ImageUsageResult[]
  scannedFileCount: number
}

export type ImageUsageScanOptions = {
  include: string[]
  exclude: string[]
}

export type ImageUsageRecord = ImageUsageResult & {
  image: ImageType
}
