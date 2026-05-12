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

function normalizePath(filePath: string) {
  return slashPath(filePath)
}

function stripDotSlash(filePath: string) {
  return filePath.replace(/^\.\//, '')
}

function stripLeadingSlash(filePath: string) {
  return filePath.replace(/^\//, '')
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildImageReferenceCandidates(image: ImageType, projectRoot: string) {
  const workspaceRelative = normalizePath(path.relative(image.absWorkspaceFolder, image.path))
  const projectRelative = normalizePath(path.relative(projectRoot, image.path))

  const exactCandidates = [
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

  return {
    basename: image.basename,
    exact: Array.from(new Set(exactCandidates.filter(Boolean))).sort((a, b) => b.length - a.length),
  }
}

function shouldIgnoreFile(filePath: string, imagePathSet: Set<string>) {
  const normalized = normalizePath(filePath)
  return imagePathSet.has(normalized)
}

function getLineAndColumn(content: string, index: number) {
  const before = content.slice(0, index)
  const lines = before.split('\n')
  return {
    line: lines.length,
    column: (lines.at(-1)?.length || 0) + 1,
  }
}

function createReference(filePath: string, content: string, matchIndex: number, matchText: string): ImageUsageReference {
  const { line, column } = getLineAndColumn(content, matchIndex)
  return {
    filePath,
    line,
    column,
    text: matchText,
  }
}

function collectExactReferences(filePath: string, content: string, candidates: string[]) {
  const references: ImageUsageReference[] = []

  for (const candidate of candidates) {
    const pattern = new RegExp(escapeRegExp(candidate), 'g')

    while (true) {
      const match = pattern.exec(content)
      if (!match) {
        break
      }
      references.push(createReference(filePath, content, match.index, match[0]))
    }
  }

  return references
}

function collectBasenameReferences(filePath: string, content: string, basename: string) {
  const references: ImageUsageReference[] = []
  const pattern = new RegExp(`(?<![\\w./-])${escapeRegExp(basename)}(?![\\w./-])`, 'g')

  while (true) {
    const match = pattern.exec(content)
    if (!match) {
      break
    }
    references.push(createReference(filePath, content, match.index, match[0]))
  }

  return references
}

function dedupeReferences(references: ImageUsageReference[]) {
  const bestByLine = new Map<string, ImageUsageReference>()

  references.forEach((reference) => {
    const key = `${reference.filePath}:${reference.line}`
    const current = bestByLine.get(key)

    if (!current) {
      bestByLine.set(key, reference)
      return
    }

    if (reference.text.length > current.text.length) {
      bestByLine.set(key, reference)
      return
    }

    if (reference.text.length === current.text.length && reference.column < current.column) {
      bestByLine.set(key, reference)
    }
  })

  return Array.from(bestByLine.values()).sort((a, b) => {
    if (a.filePath !== b.filePath) {
      return a.filePath.localeCompare(b.filePath)
    }
    if (a.line !== b.line) {
      return a.line - b.line
    }
    return a.column - b.column
  })
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

  const records = new Map<string, { references: ImageUsageReference[], basename: string, exactCandidates: string[] }>()
  images.forEach((image) => {
    const candidates = buildImageReferenceCandidates(image, projectRoot)
    records.set(image.path, {
      references: [],
      basename: candidates.basename,
      exactCandidates: candidates.exact,
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

      const exactReferences = collectExactReferences(normalizedFilePath, content, record.exactCandidates)
      const basenameReferences = exactReferences.length
        ? []
        : collectBasenameReferences(normalizedFilePath, content, record.basename)

      if (!exactReferences.length && !basenameReferences.length) {
        continue
      }

      record.references.push(...exactReferences, ...basenameReferences)
    }
  }

  const resultRecords = images.map<ImageUsageResult>((image) => {
    const record = records.get(image.path)
    const references = dedupeReferences(record?.references || [])

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
