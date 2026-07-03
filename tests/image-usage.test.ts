import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkImageUsages } from '~/core/analysis/image-usage'

const fixtureRoot = path.resolve(__dirname, 'fixture', 'image-usage')

function createImage(overrides: Partial<ImageType> = {}): ImageType {
  const imagePath = path.join(fixtureRoot, 'assets', 'logo.png')
  const workspaceRoot = fixtureRoot
  const imageDir = path.dirname(imagePath)

  return {
    basename: 'logo.png',
    name: 'logo',
    extname: '.png',
    path: imagePath,
    stats: {} as ImageType['stats'],
    dirPath: './assets',
    absDirPath: imageDir,
    relativePath: './assets/logo.png',
    vscodePath: imagePath,
    key: imagePath,
    workspaceFolder: 'fixture',
    absWorkspaceFolder: workspaceRoot,
    info: undefined,
    ...overrides,
  } as ImageType
}

describe('checkImageUsages', () => {
  it('still scans default file types when scan options omit file type filters', async () => {
    const result = await checkImageUsages({
      images: [createImage()],
      roots: [fixtureRoot],
      scanOptions: {
        include: [],
        exclude: [],
      },
    })

    expect(result.scannedFileCount).toBe(1)
    expect(result.records[0]?.status).toBe('used')
    expect(result.records[0]?.references).toHaveLength(1)
    expect(result.records[0]?.references[0]?.filePath).toContain('index.ts')
  })
})
