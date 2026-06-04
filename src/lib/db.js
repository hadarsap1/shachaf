import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, getDoc,
} from 'firebase/firestore'
import { db } from './firebase'

// ── Milestones (static config, no DB needed) ─────────────────────────────────
export const MILESTONES = [
  { id: 'm1', title: 'היכרות ראשונית',    icon: '👋' },
  { id: 'm2', title: 'רישום לבית הספר',   icon: '📝' },
  { id: 'm3', title: 'הכנה לתחילת שנה',  icon: '🎒' },
  { id: 'm4', title: 'שילוב בקהילה',      icon: '🤝' },
  { id: 'm5', title: 'שגרת לימודים',      icon: '📚' },
]

// ── Tasks ────────────────────────────────────────────────────────────────────
export async function getTasks(assignedTo = null) {
  const q = assignedTo
    ? query(collection(db, 'tasks'), where('assignedTo', '==', assignedTo))
    : query(collection(db, 'tasks'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function saveTask(task) {
  const { id, ...data } = task
  if (id && !id.startsWith('task-')) {
    await updateDoc(doc(db, 'tasks', id), { ...data, updatedAt: serverTimestamp() })
    return task
  }
  const ref = await addDoc(collection(db, 'tasks'), { ...data, createdAt: serverTimestamp() })
  return { ...task, id: ref.id }
}

export async function deleteTask(id) {
  await deleteDoc(doc(db, 'tasks', id))
}

// ── Events ───────────────────────────────────────────────────────────────────
export async function getEvents() {
  const snap = await getDocs(query(collection(db, 'events'), orderBy('date', 'asc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function saveEvent(event) {
  const { id, ...data } = event
  if (id && !id.startsWith('event-')) {
    await updateDoc(doc(db, 'events', id), { ...data, updatedAt: serverTimestamp() })
    return event
  }
  const ref = await addDoc(collection(db, 'events'), { ...data, createdAt: serverTimestamp() })
  return { ...event, id: ref.id }
}

export async function deleteEvent(id) {
  await deleteDoc(doc(db, 'events', id))
}

// ── Users ────────────────────────────────────────────────────────────────────
export async function getUsers() {
  const snap = await getDocs(collection(db, 'users'))
  return snap.docs.map(d => ({ uid: d.id, id: d.id, ...d.data() }))
}

const ALLOWED_PROFILE_FIELDS = ['name', 'phone', 'address', 'avatar']

export async function updateUserProfile(uid, data) {
  const safe = Object.fromEntries(
    Object.entries(data).filter(([k]) => ALLOWED_PROFILE_FIELDS.includes(k))
  )
  if (Object.keys(safe).length === 0) return
  await updateDoc(doc(db, 'users', uid), safe)
}

// ── Forms ────────────────────────────────────────────────────────────────────
export async function getForms() {
  const snap = await getDocs(collection(db, 'forms'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function saveForm(form) {
  const { id, ...data } = form
  if (id && !id.startsWith('form-')) {
    await updateDoc(doc(db, 'forms', id), { ...data, updatedAt: serverTimestamp() })
    return form
  }
  const ref = await addDoc(collection(db, 'forms'), { ...data, createdAt: serverTimestamp() })
  return { ...form, id: ref.id }
}

export async function deleteForm(id) {
  await deleteDoc(doc(db, 'forms', id))
}

// ── Submissions ───────────────────────────────────────────────────────────────
export async function getSubmissions(userId = null) {
  const q = userId
    ? query(collection(db, 'submissions'), where('userId', '==', userId))
    : collection(db, 'submissions')
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function saveSubmission(submission) {
  const q = query(
    collection(db, 'submissions'),
    where('userId', '==', submission.userId),
    where('formId', '==', submission.formId)
  )
  const snap = await getDocs(q)
  if (!snap.empty) {
    await updateDoc(snap.docs[0].ref, { ...submission, updatedAt: serverTimestamp() })
    return { id: snap.docs[0].id, ...submission }
  }
  const ref = await addDoc(collection(db, 'submissions'), { ...submission, submittedAt: serverTimestamp() })
  return { id: ref.id, ...submission }
}

// ── Messages (contact us) ─────────────────────────────────────────────────────
export async function sendMessage(msg) {
  await addDoc(collection(db, 'messages'), { ...msg, createdAt: serverTimestamp(), read: false })
}

export async function getMessages() {
  const snap = await getDocs(query(collection(db, 'messages'), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function markMessageRead(id) {
  await updateDoc(doc(db, 'messages', id), { read: true })
}
