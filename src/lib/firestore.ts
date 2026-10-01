import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Subject, Activity, Term, ScheduleException } from '@/types'
import {
  getCachedSubjects,
  setCachedSubjects,
  getCachedActivities,
  setCachedActivities,
  getCachedTerms,
  setCachedTerms,
  getCachedExceptions,
  setCachedExceptions,
  invalidateCache,
} from './cache'

// Subjects
export async function getSubjects(userId: string, forceRefresh = false): Promise<Subject[]> {
  if (!forceRefresh) {
    const cached = getCachedSubjects(userId)
    if (cached) return cached
  }

  const q = query(
    collection(db, 'users', userId, 'subjects'),
    orderBy('createdAt', 'asc')
  )
  const snapshot = await getDocs(q)
  const subjects = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Subject))
  setCachedSubjects(userId, subjects)
  return subjects
}

export async function addSubject(userId: string, subject: Omit<Subject, 'id' | 'createdAt'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'users', userId, 'subjects'), {
    ...subject,
    createdAt: new Date(),
  })
  invalidateCache(`subjects_${userId}`)
  return docRef.id
}

export async function updateSubject(userId: string, subjectId: string, data: Partial<Subject>): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'subjects', subjectId), data)
  invalidateCache(`subjects_${userId}`)
}

export async function deleteSubject(userId: string, subjectId: string): Promise<void> {
  // Delete the subject
  await deleteDoc(doc(db, 'users', userId, 'subjects', subjectId))
  
  // Also delete all exceptions related to this subject
  const exceptionsQuery = query(
    collection(db, 'users', userId, 'exceptions'),
    where('subjectId', '==', subjectId)
  )
  const exceptionsSnapshot = await getDocs(exceptionsQuery)
  const deletePromises = exceptionsSnapshot.docs.map((doc) => deleteDoc(doc.ref))
  await Promise.all(deletePromises)
  
  invalidateCache(`subjects_${userId}`)
  invalidateCache(`exceptions_${userId}`)
}

// Activities
export async function getActivities(userId: string, forceRefresh = false): Promise<Activity[]> {
  if (!forceRefresh) {
    const cached = getCachedActivities(userId)
    if (cached) return cached
  }

  const q = query(
    collection(db, 'users', userId, 'activities'),
    orderBy('date', 'asc')
  )
  const snapshot = await getDocs(q)
  const activities = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Activity))
  setCachedActivities(userId, activities)
  return activities
}

export async function addActivity(userId: string, activity: Omit<Activity, 'id' | 'createdAt'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'users', userId, 'activities'), {
    ...activity,
    createdAt: new Date(),
  })
  invalidateCache(`activities_${userId}`)
  return docRef.id
}

export async function updateActivity(userId: string, activityId: string, data: Partial<Activity>): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'activities', activityId), data)
  invalidateCache(`activities_${userId}`)
}

export async function deleteActivity(userId: string, activityId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'activities', activityId))
  invalidateCache(`activities_${userId}`)
}

// Terms
export async function getTerms(userId: string, forceRefresh = false): Promise<Term[]> {
  if (!forceRefresh) {
    const cached = getCachedTerms(userId)
    if (cached) return cached
  }

  const q = query(
    collection(db, 'users', userId, 'terms'),
    orderBy('createdAt', 'asc')
  )
  const snapshot = await getDocs(q)
  const terms = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Term))
  setCachedTerms(userId, terms)
  return terms
}

export async function addTerm(userId: string, term: Omit<Term, 'id' | 'createdAt'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'users', userId, 'terms'), {
    ...term,
    createdAt: new Date(),
  })
  invalidateCache(`terms_${userId}`)
  return docRef.id
}

export async function updateTerm(userId: string, termId: string, data: Partial<Term>): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'terms', termId), data)
  invalidateCache(`terms_${userId}`)
}

export async function deleteTerm(userId: string, termId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'terms', termId))
  invalidateCache(`terms_${userId}`)
}

// Schedule Exceptions
export async function getExceptions(userId: string, forceRefresh = false): Promise<ScheduleException[]> {
  if (!forceRefresh) {
    const cached = getCachedExceptions(userId)
    if (cached) return cached
  }

  const q = query(
    collection(db, 'users', userId, 'exceptions'),
    orderBy('createdAt', 'asc')
  )
  const snapshot = await getDocs(q)
  const exceptions = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ScheduleException))
  setCachedExceptions(userId, exceptions)
  return exceptions
}

export async function addException(userId: string, exception: Omit<ScheduleException, 'id' | 'createdAt'>): Promise<string> {
  // Check if there's already a move exception for this subject (regardless of originalDate)
  const existingQuery = query(
    collection(db, 'users', userId, 'exceptions'),
    where('subjectId', '==', exception.subjectId),
    where('type', '==', 'move')
  )
  const existingSnapshot = await getDocs(existingQuery)
  
  if (!existingSnapshot.empty) {
    // Update existing exception - keep the original originalDate, update newDate/time
    const existingDoc = existingSnapshot.docs[0]
    const existingData = existingDoc.data() as ScheduleException
    await updateDoc(doc(db, 'users', userId, 'exceptions', existingDoc.id), {
      newDate: exception.newDate,
      newStartTime: exception.newStartTime,
      newEndTime: exception.newEndTime,
      // Keep the original originalDate (first move target)
      originalDate: existingData.originalDate,
    })
    invalidateCache(`exceptions_${userId}`)
    return existingDoc.id
  }
  
  const docRef = await addDoc(collection(db, 'users', userId, 'exceptions'), {
    ...exception,
    createdAt: new Date(),
  })
  invalidateCache(`exceptions_${userId}`)
  return docRef.id
}

export async function deleteException(userId: string, exceptionId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'exceptions', exceptionId))
  invalidateCache(`exceptions_${userId}`)
}
