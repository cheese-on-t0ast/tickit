import type { AppData } from '../types'

export interface Repository {
  load(): AppData | null
  save(data: AppData): void
}

const STORAGE_KEY = 'tickit:data:v1'

export class LocalStorageRepository implements Repository {
  load(): AppData | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as AppData
      if (parsed.schemaVersion !== 1) return null
      return parsed
    } catch {
      return null
    }
  }

  save(data: AppData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // localStorage unavailable (private mode, quota, etc.) — fail silently,
      // the in-memory session still works for the current tab.
    }
  }
}

export const repository: Repository = new LocalStorageRepository()
