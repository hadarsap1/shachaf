import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, getDoc, setDoc, writeBatch,
  getFirestore,
} from 'firebase/firestore'
import { getAuth, createUserWithEmailAndPassword, updateProfile as updateFBProfile, sendPasswordResetEmail } from 'firebase/auth'
import { initializeApp, deleteApp } from 'firebase/app'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage, firebaseConfig } from './firebase'

// ── Storage helpers ───────────────────────────────────────────────────────────
function safeExt(file) {
  return file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
}

export async function uploadEventImage(eventId, file) {
  const path = `events/${eventId}.${safeExt(file)}`
  const snap = await uploadBytes(ref(storage, path), file)
  return { url: await getDownloadURL(snap.ref), path }
}

export async function deleteEventImage(path) {
  if (!path) return
  try { await deleteObject(ref(storage, path)) } catch { /* already gone */ }
}

export async function uploadChildPhoto(childId, file) {
  const path = `children/${childId}/photo.${safeExt(file)}`
  const snap = await uploadBytes(ref(storage, path), file)
  return { url: await getDownloadURL(snap.ref), path }
}

export async function deleteChildPhoto(path) {
  if (!path) return
  try { await deleteObject(ref(storage, path)) } catch { /* already gone */ }
}

export async function uploadUserAvatar(uid, file) {
  const path = `users/${uid}/avatar.${safeExt(file)}`
  const snap = await uploadBytes(ref(storage, path), file)
  return { url: await getDownloadURL(snap.ref), path }
}

export async function deleteUserAvatar(path) {
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

// Fetch a specific set of user docs by uid — safe for non-admin callers.
// Uses individual GET reads so same-class Firestore read rule applies.
export async function getUsersByUids(uids) {
  if (!uids?.length) return []
  const results = await Promise.allSettled(
    uids.map(uid => getDoc(doc(db, 'users', uid)))
  )
  return results
    .filter(r => r.status === 'fulfilled' && r.value.exists())
    .map(r => ({ uid: r.value.id, id: r.value.id, ...r.value.data() }))
}

// For host-family view — queries only new_family users (backed by Firestore rule)
export async function getNewFamilies() {
  const q = query(collection(db, 'users'), where('role', '==', 'new_family'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ uid: d.id, id: d.id, ...d.data() }))
}

const ALLOWED_PROFILE_FIELDS = [
  'name', 'phone', 'address', 'avatar',
  'workplace', 'profession', 'hobbies', 'temporaryStatus',
]

export async function updateUserProfile(uid, data) {
  const safe = Object.fromEntries(
    Object.entries(data).filter(([k]) => ALLOWED_PROFILE_FIELDS.includes(k))
  )
  if (Object.keys(safe).length === 0) return
  await updateDoc(doc(db, 'users', uid), safe)
}

export async function updateChildProfile(childId, data) {
  const safe = Object.fromEntries(
    Object.entries(data).filter(([k]) => ['hobbies', 'pet', 'photoUrl', 'photoPath'].includes(k))
  )
  if (Object.keys(safe).length === 0) return
  await updateDoc(doc(db, 'children', childId), safe)
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

// Returns all submissions visible to a user — their own + any where they are a co-parent
export async function getSubmissionsForFamily(userId) {
  const [ownSnap, coSnap] = await Promise.all([
    getDocs(query(collection(db, 'submissions'), where('userId', '==', userId))),
    getDocs(query(collection(db, 'submissions'), where('coParentUids', 'array-contains', userId))),
  ])
  const seen = new Set()
  const all = []
  for (const snap of [ownSnap, coSnap]) {
    for (const d of snap.docs) {
      if (!seen.has(d.id)) { seen.add(d.id); all.push({ id: d.id, ...d.data() }) }
    }
  }
  return all
}

export async function getSubmissionsForForm(formId) {
  const q = query(collection(db, 'submissions'), where('formId', '==', formId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function saveSubmission(submission) {
  const { id, ...data } = submission
  // If editing an existing doc (e.g. co-parent updating), update in place
  if (id) {
    await updateDoc(doc(db, 'submissions', id), { ...data, updatedAt: serverTimestamp() })
    return { id, ...data }
  }
  // Otherwise, upsert by userId + formId
  const snap = await getDocs(query(
    collection(db, 'submissions'),
    where('userId', '==', data.userId),
    where('formId', '==', data.formId)
  ))
  if (!snap.empty) {
    await updateDoc(snap.docs[0].ref, { ...data, updatedAt: serverTimestamp() })
    return { id: snap.docs[0].id, ...data }
  }
  const ref = await addDoc(collection(db, 'submissions'), { ...data, submittedAt: serverTimestamp() })
  return { id: ref.id, ...data }
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
  const child = childSnap.data()
  const current = child.parentUids || []
  if (current.includes(parentUid)) return
  const batch = writeBatch(db)
  batch.update(doc(db, 'children', childId), { parentUids: [...current, parentUid] })
  const userSnap = await getDoc(doc(db, 'users', parentUid))
  if (userSnap.exists()) {
    const childIds = [...new Set([...(userSnap.data().childIds || []), childId])]
    // Keep classIds in sync so the children read rule grants this parent
    // access to their child's class roster.
    const classIds = child.classId
      ? [...new Set([...(userSnap.data().classIds || []), child.classId])]
      : (userSnap.data().classIds || [])
    batch.update(doc(db, 'users', parentUid), { childIds, classIds })
  }
  await batch.commit()
}

// Recompute users/{uid}.classIds from the children currently linked to them.
// Used to backfill existing users and to repair stale membership after unlink.
export async function syncUserClassIds(uid) {
  const kids = await getChildrenByParent(uid)
  const classIds = [...new Set(kids.map(c => c.classId).filter(Boolean))]
  await updateDoc(doc(db, 'users', uid), { classIds })
  return classIds
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
  // Recompute class membership from remaining children (may have dropped a class).
  try { await syncUserClassIds(parentUid) } catch { /* non-critical */ }
}

// ── Children (parent-scoped query) ───────────────────────────────────────────
export async function getChildrenByParent(uid) {
  const q = query(collection(db, 'children'), where('parentUids', 'array-contains', uid), orderBy('name', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ── Child notes (private per-parent) ─────────────────────────────────────────
export async function getChildNote(childId, parentId) {
  const snap = await getDoc(doc(db, 'childNotes', `${parentId}_${childId}`))
  return snap.exists() ? (snap.data().content || '') : ''
}

export async function saveChildNote(childId, parentId, content) {
  await setDoc(doc(db, 'childNotes', `${parentId}_${childId}`), {
    parentId, childId, content, updatedAt: serverTimestamp(),
  })
}

// ── Admin notes (admin-only per-child) ────────────────────────────────────────
export async function getAdminNote(childId) {
  const snap = await getDoc(doc(db, 'adminNotes', childId))
  return snap.exists() ? (snap.data().notes || '') : ''
}

export async function saveAdminNote(childId, notes) {
  await setDoc(doc(db, 'adminNotes', childId), {
    childId, notes, updatedAt: serverTimestamp(),
  })
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

// ── Committee messages ────────────────────────────────────────────────────────
export async function sendCommitteeMessage(committeeId, userId, userName, body) {
  await addDoc(collection(db, 'committeeMessages'), {
    committeeId, userId, userName,
    body: String(body).slice(0, 2000),
    createdAt: serverTimestamp(),
    read: false,
  })
}

export async function getCommitteeMessages(committeeId = null) {
  const q = committeeId
    ? query(collection(db, 'committeeMessages'), where('committeeId', '==', committeeId), orderBy('createdAt', 'desc'))
    : query(collection(db, 'committeeMessages'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function markCommitteeMessageRead(id) {
  await updateDoc(doc(db, 'committeeMessages', id), { read: true })
}

// ── Resources ─────────────────────────────────────────────────────────────────
export async function getResources() {
  const snap = await getDocs(query(collection(db, 'resources'), orderBy('category'), orderBy('order', 'asc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function saveResource(resource) {
  const { id, ...data } = resource
  if (id && !id.startsWith('resource-')) {
    await updateDoc(doc(db, 'resources', id), { ...data, updatedAt: serverTimestamp() })
    return resource
  }
  const ref = await addDoc(collection(db, 'resources'), { ...data, createdAt: serverTimestamp() })
  return { ...resource, id: ref.id }
}

export async function deleteResource(id) {
  await deleteDoc(doc(db, 'resources', id))
}

// ── Co-parent registration ────────────────────────────────────────────────────
// Creates a Firebase Auth account + Firestore profile for a co-parent without
// signing out the current user (uses a secondary app instance).
export async function registerCoParent(currentUser, { name, phone, email }) {
  const appName = `co-parent-${Date.now()}`
  const secondaryApp = initializeApp(firebaseConfig, appName)
  const secondaryAuth = getAuth(secondaryApp)
  const secondaryDb = getFirestore(secondaryApp)

  try {
    // Temp password — co-parent sets their own via the reset email we send
    const tempPw = `_Sh${Math.random().toString(36).slice(2, 10)}!`
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, tempPw)
    await updateFBProfile(cred.user, { displayName: name })
    const newUid = cred.user.uid

    // Create Firestore profile under secondary auth (request.auth.uid === newUid) ✓
    // classIds mirrors the inviting parent so the co-parent can read the class
    // roster immediately; it self-heals on their first login regardless.
    await setDoc(doc(secondaryDb, 'users', newUid), {
      name, email, phone: phone || '',
      role: currentUser.role,
      childIds: currentUser.childIds || [],
      classIds: currentUser.classIds || [],
      createdAt: serverTimestamp(),
    })

    // Link co-parent to every child already linked to current user
    const childIds = currentUser.childIds || []
    if (childIds.length > 0) {
      const batch = writeBatch(db)
      for (const childId of childIds) {
        const snap = await getDoc(doc(db, 'children', childId))
        if (snap.exists()) {
          const current = snap.data().parentUids || []
          if (!current.includes(newUid)) {
            batch.update(doc(db, 'children', childId), { parentUids: [...current, newUid] })
          }
        }
      }
      await batch.commit()
    }

    // Save co-parent info on current user's profile so SettingsPage can show it
    await updateDoc(doc(db, 'users', currentUser.uid), {
      coParent: { uid: newUid, name, email, phone: phone || '' },
    })

    // Send password reset so co-parent can choose their own password
    await sendPasswordResetEmail(secondaryAuth, email)

    return { uid: newUid, name, email, phone: phone || '' }
  } finally {
    try { await secondaryAuth.signOut() } catch {}
    try { await deleteApp(secondaryApp) } catch {}
  }
}
