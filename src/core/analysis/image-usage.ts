import path from 'node:path'
import fs from 'fs-extra'
import { globby } from 'globby'
import { slashPath } from '~/utils'

const DEFAULT_SCAN_GLOBS = [
  '**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts,vue,svelte,astro,html,htm,css,scss,sass,less,styl,pcss,postcss,json,json5,md,mdx,yml,yaml,xml,svg,txt}',
]

const DEFAULT_IGNORE_GLOBS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/coverage/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/.vercel/**',
  '**/.idea/**',
  '**/.turbo/**',
  '**/.output/**',
  '**/.cache/**',
  '**/dist-webview/**',
]

export type ImageUsageResult = {
  imagePath: string
  status: 'used' | 'unused' | 'error'
  references: string[]
  matchedCount: number
}

export type ImageUsageScanResult = {
  records: ImageUsageResult[]
  scannedFileCount: number
}

function normalizePath(filePath: string) {
  return slashPath(filePath)
}

function stripDotSlash(filePath: string) {
  return filePath.replace(/^\.\//, '')
}

function stripLeadingSlash(filePath: string) {
  return filePath.replace(/^\//, '')
}

function buildImageReferenceCandidates(image: ImageType, projectRoot: string) {
  const workspaceRelative = normalizePath(path.relative(image.absWorkspaceFolder, image.path))
  const projectRelative = normalizePath(path.relative(projectRoot, image.path))

  const candidates = [
    image.basename,
    image.relativePath,
    stripDotSlash(image.relativePath),
    workspaceRelative,
    `./${workspaceRelative}`,
    stripLeadingSlash(workspaceRelative),
    projectRelative,
    `./${projectRelative}`,
    stripLeadingSlash(projectRelative),
    normalizePath(path.join(image.workspaceFolder, workspaceRelative)),
  ]

  return Array.from(new Set(candidates.filter(Boolean))).sort((a, b) => b.length - a.length)
}

function shouldIgnoreFile(filePath: string, imagePathSet: Set<string>) {
  const normalized = normalizePath(filePath)
  return imagePathSet.has(normalized)
}

export async function checkImageUsages(options: {
  images: ImageType[]
  roots: string[]
}) {
  const { images, roots } = options

  const normalizedRoots = Array.from(new Set(roots.map(root => normalizePath(root))))
  const projectRoot = normalizedRoots.length > 1
    ? normalizePath(path.dirname(normalizedRoots[0]))
    : normalizedRoots[0]

  const imagePathSet = new Set(images.map(image => normalizePath(image.path)))
  const textFiles = await globby(DEFAULT_SCAN_GLOBS, {
    cwd: projectRoot,
    absolute: true,
    onlyFiles: true,
    dot: false,
    ignore: DEFAULT_IGNORE_GLOBS,
    gitignore: true,
  })

  const normalizedTextFiles = textFiles.filter(filePath => !shouldIgnoreFile(filePath, imagePathSet))

  const records = new Map<string, { references: Set<string>, candidates: string[] }>()
  images.forEach((image) => {
    records.set(image.path, {
      references: new Set<string>(),
      candidates: buildImageReferenceCandidates(image, projectRoot),
    })
  })

  for (const filePath of normalizedTextFiles) {
    let content = ''
    try {
      content = await fs.readFile(filePath, 'utf-8')
    }
    catch {
      continue
    }

    const normalizedFilePath = normalizePath(filePath)

    for (const image of images) {
      const record = records.get(image.path)
      if (!record)
        continue

      if (record.references.has(normalizedFilePath))
        continue

      if (record.candidates.some(candidate => content.includes(candidate))) {
        record.references.add(normalizedFilePath)
      }
    }
  }

  const resultRecords = images.map<ImageUsageResult>((image) => {
    const record = records.get(image.path)
    const references = Array.from(record?.references || [])

    return {
      imagePath: image.path,
      status: references.length ? 'used' : 'unused',
      references,
      matchedCount: references.length,
    }
  })

  return {
    records: resultRecords,
    scannedFileCount: normalizedTextFiles.length,
  } satisfies ImageUsageScanResult
}
