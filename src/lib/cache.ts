import type { Subject, Activity, Term, ScheduleException } from '@/types'

interface CacheData<T> {
  data: T
  timestamp: number
}

const cache = new Map<string, CacheData<unknown>>()
const CACHE_DURATION = 5000 // 5 seconds

export function getCachedData<T>(key: string): T | null {
  const cached = cache.get(key)
  if (!cached) return null

  const now = Date.now()
  if (now - cached.timestamp > CACHE_DURATION) {
    cache.delete(key)
    return null
  }

  return cached.data as T
}

export function setCachedData<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  })
}

export function invalidateCache(key: string): void {
  cache.delete(key)
}

export function invalidateAllCache(): void {
  cache.clear()
}

// Specific cache helpers
export function getCachedSubjects(userId: string): Subject[] | null {
  return getCachedData<Subject[]>(`subjects_${userId}`)
}

export function setCachedSubjects(userId: string, subjects: Subject[]): void {
  setCachedData(`subjects_${userId}`, subjects)
}

export function getCachedActivities(userId: string): Activity[] | null {
  return getCachedData<Activity[]>(`activities_${userId}`)
}

export function setCachedActivities(userId: string, activities: Activity[]): void {
  setCachedData(`activities_${userId}`, activities)
}

export function getCachedTerms(userId: string): Term[] | null {
  return getCachedData<Term[]>(`terms_${userId}`)
}

export function setCachedTerms(userId: string, terms: Term[]): void {
  setCachedData(`terms_${userId}`, terms)
}

export function getCachedExceptions(userId: string): ScheduleException[] | null {
  return getCachedData<ScheduleException[]>(`exceptions_${userId}`)
}

export function setCachedExceptions(userId: string, exceptions: ScheduleException[]): void {
  setCachedData(`exceptions_${userId}`, exceptions)
}
