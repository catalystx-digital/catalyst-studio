import { dirname, join, normalize } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { type GeneratedFile } from '../core/types'

function normalizePath(path: string): string {
  return normalize(path).replace(/\\+/g, '/').replace(/^\//, '')
}

export class ProjectBuilder {
  private readonly files = new Map<string, GeneratedFile>()

  constructor(private readonly rootDir: string) {}

  getRootDir(): string {
    return this.rootDir
  }

  addFile(path: string, contents: string | Buffer, mode?: number): void {
    const normalized = normalizePath(path)
    if (this.files.has(normalized)) {
      throw new Error(`File already registered: ${normalized}`)
    }
    this.files.set(normalized, { path: normalized, contents, mode })
  }

  listFiles(): GeneratedFile[] {
    return Array.from(this.files.values())
  }

  async writeToDisk(): Promise<void> {
    for (const file of this.files.values()) {
      const absolutePath = join(this.rootDir, file.path)
      await mkdir(dirname(absolutePath), { recursive: true })
      await writeFile(absolutePath, file.contents, file.mode ? { mode: file.mode } : undefined)
    }
  }
}

