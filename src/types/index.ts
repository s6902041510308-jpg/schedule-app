export interface Subject {
  id: string
  name: string
  code: string
  type: 'main' | 'elective'
  dayOfWeek: number | null // 0-6 for main subjects (Sunday-Saturday)
  startTime: string
  endTime: string
  room: string
  teacher: string
  color: string
  specificDate: string | null // For elective subjects (YYYY-MM-DD)
  termId: string | null // For main subjects - which term they belong to
  createdAt: Date
}

export interface Activity {
  id: string
  name: string
  date: string // YYYY-MM-DD
  startTime: string
  endTime: string
  createdAt: Date
}

export interface Term {
  id: string
  name: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  createdAt: Date
}

export interface ScheduleException {
  id: string
  subjectId: string
  originalDate: string // YYYY-MM-DD
  type: 'move' | 'cancel'
  newDate: string | null // For move
  newStartTime: string | null // For move
  newEndTime: string | null // For move
  createdAt: Date
}

export interface User {
  id: string
  email: string
  name: string
  createdAt: Date
}
