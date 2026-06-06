import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, getDoc, writeBatch,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from './firebase'

// ── Storage helpers ───────────────────────────────────────────────────────────
export async function uploadEventImage(eventId, file) {
  const ext = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `events/${eventId}.${ext}`
  const snap = await uploadBytes(ref(storage, path), file)
  const url  = await getDownloadURL(snap.ref)
  return { url, path }
}

export async function deleteEventImage(path) {
  if (!path) return
  try { await deleteObject(ref(storage, path)) } catch { /* already gone */ }
}

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

// ── Pending Families ──────────────────────────────────────────────────────────
export async function getPendingFamilies(role = null) {
  const q = role
    ? query(collection(db, 'pendingFamilies'), where('role', '==', role))
    : query(collection(db, 'pendingFamilies'), orderBy('importedAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function deletePendingFamily(emailId) {
  await deleteDoc(doc(db, 'pendingFamilies', emailId))
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

// ── Classes ───────────────────────────────────────────────────────────────────
export async function getClasses() {
  const snap = await getDocs(query(collection(db, 'classes'), orderBy('name', 'asc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function saveClass(cls) {
  const { id, ...data } = cls
  if (id && !id.startsWith('class-')) {
    await updateDoc(doc(db, 'classes', id), { ...data, updatedAt: serverTimestamp() })
    return cls
  }
  const ref = await addDoc(collection(db, 'classes'), { ...data, createdAt: serverTimestamp() })
  return { ...cls, id: ref.id }
}

export async function deleteClass(id) {
  await deleteDoc(doc(db, 'classes', id))
}

export async function assignClassAdmin(classId, uid) {
  const batch = writeBatch(db)
  const cls = await getDoc(doc(db, 'classes', classId))
  if (cls.exists()) {
    const adminUids = [...new Set([...(cls.data().adminUids || []), uid])]
    batch.update(doc(db, 'classes', classId), { adminUids })
  }
  const userSnap = await getDoc(doc(db, 'users', uid))
  if (userSnap.exists()) {
    const classAdminFor = [...new Set([...(userSnap.data().classAdminFor || []), classId])]
    batch.update(doc(db, 'users', uid), { classAdminFor })
  }
  await batch.commit()
}

export async function removeClassAdmin(classId, uid) {
  const batch = writeBatch(db)
  const cls = await getDoc(doc(db, 'classes', classId))
  if (cls.exists()) {
    batch.update(doc(db, 'classes', classId), {
      adminUids: (cls.data().adminUids || []).filter(u => u !== uid),
    })
  }
  const userSnap = await getDoc(doc(db, 'users', uid))
  if (userSnap.exists()) {
    batch.update(doc(db, 'users', uid), {
      classAdminFor: (userSnap.data().classAdminFor || []).filter(c => c !== classId),
    })
  }
  await batch.commit()
}

// ── Children ──────────────────────────────────────────────────────────────────
export async function getChildren(classId = null) {
  const q = classId
    ? query(collection(db, 'children'), where('classId', '==', classId), orderBy('name', 'asc'))
    : query(collection(db, 'children'), orderBy('name', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function saveChild(child) {
  const { id, ...data } = child
  if (id && !id.startsWith('child-')) {
    await updateDoc(doc(db, 'children', id), { ...data, updatedAt: serverTimestamp() })
    return child
  }
  const ref = await addDoc(collection(db, 'children'), { ...data, createdAt: serverTimestamp() })
  return { ...child, id: ref.id }
}

export async function deleteChild(id) {
  await deleteDoc(doc(db, 'children', id))
}

export async function bulkImportChildren(children) {
  const batch = writeBatch(db)
  children.forEach(child => {
    const ref = doc(collection(db, 'children'))
    batch.set(ref, { ...child, parentUids: [], createdAt: serverTimestamp() })
  })
  await batch.commit()
}

export async function linkChildToParent(childId, parentUid) {
  const childSnap = await getDoc(doc(db, 'children', childId))
  if (!childSnap.exists()) return
  const current = childSnap.data().parentUids || []
  if (current.includes(parentUid)) return
  const batch = writeBatch(db)
  batch.update(doc(db, 'children', childId), { parentUids: [...current, parentUid] })
  const userSnap = await getDoc(doc(db, 'users', parentUid))
  if (userSnap.exists()) {
    const childIds = [...new Set([...(userSnap.data().childIds || []), childId])]
    batch.update(doc(db, 'users', parentUid), { childIds })
  }
  await batch.commit()
}

export async function unlinkChildFromParent(childId, parentUid) {
  const childSnap = await getDoc(doc(db, 'children', childId))
  if (!childSnap.exists()) return
  const batch = writeBatch(db)
  batch.update(doc(db, 'children', childId), {
    parentUids: (childSnap.data().parentUids || []).filter(u => u !== parentUid),
  })
  const userSnap = await getDoc(doc(db, 'users', parentUid))
  if (userSnap.exists()) {
    batch.update(doc(db, 'users', parentUid), {
      childIds: (userSnap.data().childIds || []).filter(c => c !== childId),
    })
  }
  await batch.commit()
}

// ── Children (parent-scoped query) ───────────────────────────────────────────
export async function getChildrenByParent(uid) {
  const q = query(collection(db, 'children'), where('parentUids', 'array-contains', uid), orderBy('name', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ── Announcements ─────────────────────────────────────────────────────────────
export async function getAnnouncements() {
  const snap = await getDocs(query(collection(db, 'announcements'), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function saveAnnouncement(ann) {
  const { id, ...data } = ann
  if (id && !id.startsWith('ann-')) {
    await updateDoc(doc(db, 'announcements', id), { ...data, updatedAt: serverTimestamp() })
    return ann
  }
  const ref = await addDoc(collection(db, 'announcements'), { ...data, createdAt: serverTimestamp() })
  return { ...ann, id: ref.id }
}

export async function deleteAnnouncement(id) {
  await deleteDoc(doc(db, 'announcements', id))
}

// ── Committees ────────────────────────────────────────────────────────────────
export async function getCommittees() {
  const snap = await getDocs(query(collection(db, 'committees'), orderBy('order', 'asc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function saveCommittee(committee) {
  const { id, ...data } = committee
  if (id && !id.startsWith('committee-')) {
    await updateDoc(doc(db, 'committees', id), { ...data, updatedAt: serverTimestamp() })
    return committee
  }
  const ref = await addDoc(collection(db, 'committees'), { ...data, createdAt: serverTimestamp() })
  return { ...committee, id: ref.id }
}

export async function deleteCommittee(id) {
  await deleteDoc(doc(db, 'committees', id))
}
