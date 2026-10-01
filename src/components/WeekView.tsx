'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSubjects, getActivities, getExceptions, getTerms, deleteException } from '@/lib/firestore'
import type { Subject, Activity, ScheduleException } from '@/types'
import { format, startOfWeek, addDays, isSameDay } from 'date-fns'
import { th } from 'date-fns/locale'
import { useAuth } from '@/lib/auth-context'
import MoveSubjectModal from './MoveSubjectModal'
import CancelSubjectModal from './CancelSubjectModal'

const DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const HOURS = Array.from({ length: 24 }, (_, i) => i) // 0:00 - 23:00
const HOUR_HEIGHT = 64 // px per hour

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function getStyle(startTime: string, endTime: string) {
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = timeToMinutes(endTime)
  const top = (startMinutes / 60) * HOUR_HEIGHT
  const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT
  return { top, height }
}

interface ScheduleItem {
  id: string
  name: string
  startTime: string
  endTime: string
  type: 'subject' | 'activity'
  subject?: Subject
  activity?: Activity
}

export default function WeekView() {
  const { user } = useAuth()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [exceptions, setExceptions] = useState<ScheduleException[]>([])
  const [terms, setTerms] = useState<{ id: string; name: string; startDate: string; endDate: string }[]>([])
  const [currentWeekStart, setCurrentWeekStart] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)

  const loadData = useCallback(async (forceRefresh = false) => {
    if (!user) return
    setLoading(true)
    const [subjectsData, activitiesData, exceptionsData, termsData] = await Promise.all([
      getSubjects(user.uid, forceRefresh),
      getActivities(user.uid, forceRefresh),
      getExceptions(user.uid, forceRefresh),
      getTerms(user.uid),
    ])
    setSubjects(subjectsData)
    setActivities(activitiesData)
    setExceptions(exceptionsData)
    setTerms(termsData)
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user, loadData])

  const getWeekDays = () => {
    const start = startOfWeek(currentWeekStart, { weekStartsOn: 0 })
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }

  const getTermForDate = (dateStr: string) => {
    return terms.find((t) => dateStr >= t.startDate && dateStr <= t.endDate)
  }

  const getSubjectsForDay = (date: Date): Subject[] => {
    const dayOfWeek = date.getDay()
    const dateStr = format(date, 'yyyy-MM-dd')
    const termForDate = getTermForDate(dateStr)

    // Find subjects moved TO this date
    const movedToThisDate = exceptions.filter(
      (e) => e.type === 'move' && e.newDate === dateStr
    )
    const movedToThisDateIds = new Set(movedToThisDate.map((e) => e.subjectId))

    // Find subjects moved AWAY from this date
    const movedFromThisDate = exceptions.filter(
      (e) => e.type === 'move' && e.originalDate === dateStr
    )
    const movedFromThisDateIds = new Set(movedFromThisDate.map((e) => e.subjectId))

    // Find cancelled subjects for this date
    const cancelledIds = new Set(
      exceptions
        .filter((e) => e.type === 'cancel' && e.originalDate === dateStr)
        .map((e) => e.subjectId)
    )

    const mainSubjects = subjects.filter((s) => {
      if (s.type !== 'main' || s.dayOfWeek !== dayOfWeek) return false
      // Skip if moved away from this date
      if (movedFromThisDateIds.has(s.id)) return false
      // Skip if cancelled
      if (cancelledIds.has(s.id)) return false
      // If subject has a termId, only show if the date falls within that term
      if (s.termId) {
        const subjectTerm = terms.find((t) => t.id === s.termId)
        if (!subjectTerm) return false
        if (dateStr < subjectTerm.startDate || dateStr > subjectTerm.endDate) return false
      }
      return true
    })

    const electiveSubjects = subjects.filter((s) => {
      if (s.type !== 'elective' || s.specificDate !== dateStr) return false
      if (cancelledIds.has(s.id)) return false
      return true
    })

    // Add subjects moved TO this date (from any day)
    const movedSubjects: Subject[] = []
    for (const exception of movedToThisDate) {
      const subject = subjects.find((s) => s.id === exception.subjectId)
      if (subject) {
        movedSubjects.push({
          ...subject,
          startTime: exception.newStartTime || subject.startTime,
          endTime: exception.newEndTime || subject.endTime,
        })
      }
    }

    return [...mainSubjects, ...electiveSubjects, ...movedSubjects]
  }

  const getActivitiesForDay = (date: Date): Activity[] => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return activities.filter((a) => a.date === dateStr)
  }

  const getItemsForDay = (date: Date): ScheduleItem[] => {
    const subjectsForDay = getSubjectsForDay(date)
    const activitiesForDay = getActivitiesForDay(date)

    const subjectItems: ScheduleItem[] = subjectsForDay.map((s) => ({
      id: s.id,
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      type: 'subject',
      subject: s,
    }))

    const activityItems: ScheduleItem[] = activitiesForDay.map((a) => ({
      id: a.id,
      name: a.name,
      startTime: a.startTime,
      endTime: a.endTime,
      type: 'activity',
      activity: a,
    }))

    return [...subjectItems, ...activityItems].sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    )
  }

  const handleItemClick = (item: ScheduleItem, date: Date) => {
    if (item.type === 'subject' && item.subject) {
      setSelectedItem(item)
      setSelectedDate(format(date, 'yyyy-MM-dd'))
    }
  }

  const handleMove = () => {
    setShowMoveModal(true)
  }

  const handleCancel = () => {
    setShowCancelModal(true)
  }

  const handleUndoMove = async () => {
    if (!selectedItem?.subject || !user) return
    
    // Find the exception for this move
    const exception = exceptions.find(
      (e) => e.subjectId === selectedItem.subject.id && e.type === 'move' && e.newDate === selectedDate
    )
    
    if (exception) {
      await deleteException(user.uid, exception.id)
      setSelectedItem(null)
      loadData(true)
    }
  }

  const getExceptionForSelectedItem = () => {
    if (!selectedItem?.subject) return null
    return exceptions.find(
      (e) => e.subjectId === selectedItem.subject.id && e.type === 'move' && e.newDate === selectedDate
    )
  }

  const goToPrevWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, -7))
  }

  const goToNextWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, 7))
  }

  const goToCurrentWeek = () => {
    setCurrentWeekStart(new Date())
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-700">กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  const weekDays = getWeekDays()

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b">
        <button
          onClick={goToPrevWeek}
          className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 text-gray-700"
        >
          ← สัปดาห์ก่อน
        </button>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900">
            {format(weekDays[0], 'd MMMM yyyy', { locale: th })} - {format(weekDays[6], 'd MMMM yyyy', { locale: th })}
          </h2>
          <button
            onClick={goToCurrentWeek}
            className="text-sm text-blue-600 hover:underline"
          >
            กลับไปสัปดาห์ปัจจุบัน
          </button>
        </div>
        <button
          onClick={goToNextWeek}
          className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 text-gray-700"
        >
          สัปดาห์ถัดไป →
        </button>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header */}
          <div className="grid grid-cols-8 border-b">
            <div className="p-2 text-center text-sm font-medium text-gray-700 border-r">
              เวลา
            </div>
            {weekDays.map((day, index) => (
              <div
                key={index}
                className={`p-2 text-center border-r last:border-r-0 ${
                  isSameDay(day, new Date()) ? 'bg-blue-50' : ''
                }`}
              >
                <p className="text-sm font-medium text-gray-700">{DAYS[index]}</p>
                <p className={`text-lg font-bold ${isSameDay(day, new Date()) ? 'text-blue-600' : 'text-gray-900'}`}>
                  {format(day, 'd')}
                </p>
              </div>
            ))}
          </div>

          {/* Time slots */}
          <div className="grid grid-cols-8">
            <div className="border-r">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="h-16 border-b text-xs text-gray-500 text-right pr-2 pt-1"
                >
                  {hour}:00
                </div>
              ))}
            </div>
            {weekDays.map((day, dayIndex) => {
              const items = getItemsForDay(day)
              return (
                <div key={dayIndex} className="border-r last:border-r-0 relative" style={{ height: HOURS.length * HOUR_HEIGHT }}>
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="border-b"
                      style={{ height: HOUR_HEIGHT }}
                    />
                  ))}
                  {items.map((item) => {
                    const isSubject = item.type === 'subject'
                    const bgColor = isSubject
                      ? (item.subject?.color || '#3B82F6')
                      : '#6B7280'
                    const style = getStyle(item.startTime, item.endTime)
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleItemClick(item, day)}
                        className="absolute inset-x-1 rounded px-2 py-1 text-white text-xs overflow-hidden text-left hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: bgColor, top: style.top, height: style.height }}
                      >
                        <p className="font-medium truncate">{item.name}</p>
                        <p className="opacity-80">
                          {item.startTime}-{item.endTime}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Selected item actions */}
      {selectedItem && selectedItem.type === 'subject' && (
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{selectedItem.name}</p>
              <p className="text-sm text-gray-700">
                {selectedItem.startTime} - {selectedItem.endTime}
                {selectedItem.subject?.room && ` | ห้อง ${selectedItem.subject.room}`}
                {selectedItem.subject?.teacher && ` | ${selectedItem.subject.teacher}`}
              </p>
              {getExceptionForSelectedItem() && (
                <p className="text-sm text-blue-600 mt-1">
                  โยกมาจากวันที่ {getExceptionForSelectedItem()?.originalDate}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleMove}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              >
                โยกย้าย
              </button>
              {getExceptionForSelectedItem() && (
                <button
                  onClick={handleUndoMove}
                  className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
                >
                  ยกเลิกการโยก
                </button>
              )}
              <button
                onClick={handleCancel}
                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
              >
                ยกเลิกวิชา
              </button>
              <button
                onClick={() => setSelectedItem(null)}
                className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-300"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Modal */}
      {showMoveModal && selectedItem?.subject && (
        <MoveSubjectModal
          subject={selectedItem.subject}
          originalDate={selectedDate}
          onClose={() => setShowMoveModal(false)}
          onSuccess={loadData}
        />
      )}

      {/* Cancel Modal */}
      {showCancelModal && selectedItem?.subject && (
        <CancelSubjectModal
          subject={selectedItem.subject}
          originalDate={selectedDate}
          onClose={() => setShowCancelModal(false)}
          onSuccess={loadData}
        />
      )}
    </div>
  )
}
