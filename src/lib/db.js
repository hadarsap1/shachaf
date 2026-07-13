import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, getDoc, setDoc, writeBatch,
  getFirestore, arrayUnion, arrayRemove, onSnapshot, limit,
} from 'firebase/firestore'
import { getAuth, createUserWithEmailAndPassword, updateProfile as updateFBProfile, sendPasswordResetEmail } from 'firebase/auth'
import { initializeApp, deleteApp } from 'firebase/app'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { compressImage } from './image'

// ── Read cache ────────────────────────────────────────────────────────────────
// Pages remount (and refetch) on every navigation; with hundreds of users that
// multiplies into millions of redundant Firestore reads. Reads of hot
// collections are cached for a short TTL and share in-flight promises (two
// components requesting the same collection at once trigger ONE fetch).
// Every mutator invalidates the keys it touches, so staleness is bounded by
// the TTL only for changes made by OTHER users on OTHER devices.
const _cache = new Map()
const MIN = 60 * 1000
function cached(key, ttl, fn) {
  const hit = _cache.get(key)
  if (hit && Date.now() - hit.t < ttl) return hit.p
  const promise = fn().catch(err => { _cache.delete(key); throw err })
  _cache.set(key, { t: Date.now(), p: promise })
  return promise
}
function invalidate(...prefixes) {
  for (const k of [..._cache.keys()]) {
    if (prefixes.some(pre => k === pre || k.startsWith(pre + ':'))) _cache.delete(k)
  }
}

import { db, storage, firebaseConfig } from './firebase'

// ── Storage helpers ───────────────────────────────────────────────────────────
const BLOCKED_EXTS = new Set(['svg', 'svgz', 'xml', 'html', 'htm', 'js', 'mjs'])
function safeExt(file) {
  const ext = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  return BLOCKED_EXTS.has(ext) ? 'jpg' : ext
}

export async function uploadEventImage(eventId, file) {
  file = await compressImage(file)
  const path = `events/${eventId}.${safeExt(file)}`
  const snap = await uploadBytes(ref(storage, path), file)
  return { url: await getDownloadURL(snap.ref), path }
}

export async function deleteEventImage(path) {
  if (!path) return
  try { await deleteObject(ref(storage, path)) } catch { /* already gone */ }
}

// A form file attached to a task (PDF or image). Images get compressed; PDFs
// upload as-is. Returns url + storage path + original file name.
export async function uploadTaskForm(taskId, file) {
  const name = file.name
  if (file.type?.startsWith('image/')) file = await compressImage(file)
  const path = `tasks/${taskId}.${safeExt(file)}`
  const snap = await uploadBytes(ref(storage, path), file, { contentType: file.type || 'application/octet-stream' })
  return { url: await getDownloadURL(snap.ref), path, name }
}

export async function deleteTaskForm(path) {
  if (!path) return
  try { await deleteObject(ref(storage, path)) } catch { /* already gone */ }
}

export async function uploadChildPhoto(childId, file) {
  file = await compressImage(file)
  const path = `children/${childId}/photo.${safeExt(file)}`
  const snap = await uploadBytes(ref(storage, path), file)
  return { url: await getDownloadURL(snap.ref), path }
}

export async function deleteChildPhoto(path) {
  if (!path) return
  try { await deleteObject(ref(storage, path)) } catch { /* already gone */ }
}

export async function uploadUserAvatar(uid, file) {
  file = await compressImage(file)
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
async function _getEvents() {
  const snap = await getDocs(query(collection(db, 'events'), orderBy('date', 'asc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

async function _saveEvent(event) {
  const { id, ...data } = event
  if (id && !id.startsWith('event-')) {
    await updateDoc(doc(db, 'events', id), { ...data, updatedAt: serverTimestamp() })
    return event
  }
  const ref = await addDoc(collection(db, 'events'), { ...data, createdAt: serverTimestamp() })
  return { ...event, id: ref.id }
}

async function _deleteEvent(id) {
  await deleteDoc(doc(db, 'events', id))
}

// ── Users ────────────────────────────────────────────────────────────────────
async function _getUsers() {
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
  'name', 'phone', 'address', 'avatar', 'avatarPath',
  'workplace', 'profession', 'hobbies', 'temporaryStatus',
]

// Record the user's informed consent — consentVersion + consentAt on the
// user doc are the stored evidence required by the privacy regulations.
// Also appended to the immutable consentLog (see logConsent).
export async function recordConsent(uid, version) {
  await updateDoc(doc(db, 'users', uid), {
    consentVersion: version,
    consentAt: serverTimestamp(),
  })
  logConsent(uid, 'initial_consent', { label: 'אישור תקנון ומדיניות פרטיות', version })
}

// ── Consent log ───────────────────────────────────────────────────────────────
// Append-only evidence of every consent checkbox the user ticked: the initial
// policy approval, child-photo publication, committee/group joins, event
// publication acknowledgments. Rules forbid update/delete so entries can't be
// doctored. Fire-and-forget: logging must never block or fail the action.
export function logConsent(uid, type, { label = '', version = '', context = '' } = {}) {
  return addDoc(collection(db, 'consentLog'), {
    uid, type,
    label: String(label).slice(0, 200),
    version: String(version).slice(0, 20),
    context: String(context).slice(0, 500),
    ua: (typeof navigator !== 'undefined' ? navigator.userAgent : '').slice(0, 300),
    createdAt: serverTimestamp(),
  }).catch(e => console.error('consent log failed:', type, e))
}

// The user's own consent history — shown on the "My Privacy" page.
export async function getMyConsentLog(uid) {
  const snap = await getDocs(query(collection(db, 'consentLog'), where('uid', '==', uid)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
}

// ── Audit log ─────────────────────────────────────────────────────────────────
// Append-only record of privileged actions (role changes, approvals, deletes).
// Required by the data-security regulations for the annual documented review
// (docs/security-compliance-plan-2026-07.md §5.4) — rules forbid update/delete
// for everyone, so entries can't be doctored after the fact.
// Fire-and-forget: auditing must never block or fail the action itself.
export function logAudit(actor, action, { targetUid = '', targetName = '', details = '' } = {}) {
  return addDoc(collection(db, 'auditLog'), {
    action,
    actorUid: actor?.uid || '',
    actorName: actor?.name || actor?.email || '',
    targetUid, targetName, details,
    createdAt: serverTimestamp(),
  }).catch(e => console.error('audit log failed:', action, e))
}

export async function getAuditLog(max = 200) {
  const snap = await getDocs(query(
    collection(db, 'auditLog'), orderBy('createdAt', 'desc'), limit(max),
  ))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// Backfill for pre-2026-07 imported families — lets them browse the
// unlinked-children roster during onboarding (admin-only by rules)
async function _markUsersImported(uids) {
  const batch = writeBatch(db)
  uids.forEach(uid => batch.update(doc(db, 'users', uid), { imported: true }))
  await batch.commit()
}

// Fully remove a user (super_admin only, enforced by rules): unlink from all
// children, delete avatar from Storage, delete the profile doc. The Firebase
// AUTH account is NOT removable from the client — delete it in Firebase
// Console → Authentication, otherwise a re-login recreates a fresh community
// profile.
async function _deleteUserCompletely(user) {
  // Revoke class-admin assignments first (removes uid from classes.adminUids)
  for (const classId of user.classAdminFor || []) {
    try { await removeClassAdmin(classId, user.uid) } catch { /* class gone */ }
  }
  const kids = await _getChildrenByParent(user.uid)
  const batch = writeBatch(db)
  kids.forEach(k => batch.update(doc(db, 'children', k.id), {
    parentUids: (k.parentUids || []).filter(u => u !== user.uid),
  }))
  batch.delete(doc(db, 'users', user.uid))
  await batch.commit()
  if (user.avatarPath) {
    try { await deleteObject(ref(storage, user.avatarPath)) } catch { /* already gone */ }
  }
}

async function _updateUserProfile(uid, data) {
  const safe = Object.fromEntries(
    Object.entries(data).filter(([k]) => ALLOWED_PROFILE_FIELDS.includes(k))
  )
  if (Object.keys(safe).length === 0) return
  await updateDoc(doc(db, 'users', uid), safe)
}

async function _updateChildProfile(childId, data) {
  const safe = Object.fromEntries(
    Object.entries(data).filter(([k]) => ['hobbies', 'pet', 'photoUrl', 'photoPath', 'photoConsentAt', 'birthDate'].includes(k))
  )
  if (Object.keys(safe).length === 0) return
  await updateDoc(doc(db, 'children', childId), safe)
}

// ── Forms ────────────────────────────────────────────────────────────────────
async function _getForms() {
  const snap = await getDocs(collection(db, 'forms'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

async function _saveForm(form) {
  const { id, ...data } = form
  if (id && !id.startsWith('form-')) {
    await updateDoc(doc(db, 'forms', id), { ...data, updatedAt: serverTimestamp() })
    return form
  }
  const ref = await addDoc(collection(db, 'forms'), { ...data, createdAt: serverTimestamp() })
  return { ...form, id: ref.id }
}

async function _deleteForm(id) {
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
// Best-effort crash logging — records render crashes so we can find and fix
// the intermittent ones. Never throws (a failing logger must not compound a crash).
export async function logCrash({ message, stack, componentStack, route, uid, name }) {
  try {
    await addDoc(collection(db, 'crashes'), {
      message: String(message || '').slice(0, 500),
      stack: String(stack || '').slice(0, 3000),
      componentStack: String(componentStack || '').slice(0, 3000),
      route: String(route || '').slice(0, 200),
      uid: uid || null,
      name: name || null,
      ua: (typeof navigator !== 'undefined' ? navigator.userAgent : '').slice(0, 300),
      createdAt: serverTimestamp(),
    })
  } catch { /* swallow */ }
}

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

// Messages a parent sent (their own thread). No orderBy — where+orderBy on
// different fields needs a composite index that doesn't exist; sort in JS.
export async function getMyMessages(uid) {
  const snap = await getDocs(query(collection(db, 'messages'), where('userId', '==', uid)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
}

// Append a reply to a message thread. fromAdmin replies raise the parent's
// unread flag; parent replies re-open it for admins (read=false).
export async function addMessageReply(id, { body, fromAdmin, byName }) {
  const entry = { body, fromAdmin: !!fromAdmin, byName: byName || '', at: Date.now() }
  const updates = { replies: arrayUnion(entry) }
  if (fromAdmin) updates.userUnread = true
  else { updates.read = false; updates.userUnread = false }
  await updateDoc(doc(db, 'messages', id), updates)
  return entry
}

// Parent opened their inbox — clear their unread flags
export async function markMyMessagesReadByUser(ids) {
  await Promise.all(ids.map(id =>
    updateDoc(doc(db, 'messages', id), { userUnread: false }).catch(() => {})))
}

// ── Classes ───────────────────────────────────────────────────────────────────
async function _getClasses() {
  const snap = await getDocs(query(collection(db, 'classes'), orderBy('name', 'asc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

async function _saveClass(cls) {
  const { id, ...data } = cls
  if (id && !id.startsWith('class-')) {
    await updateDoc(doc(db, 'classes', id), { ...data, updatedAt: serverTimestamp() })
    return cls
  }
  const ref = await addDoc(collection(db, 'classes'), { ...data, createdAt: serverTimestamp() })
  return { ...cls, id: ref.id }
}

async function _deleteClass(id) {
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

async function _removeClassAdmin(classId, uid) {
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
async function _getChildren(classId = null) {
  // where + orderBy on different fields needs a composite index (none exist) — sort in JS
  const q = classId
    ? query(collection(db, 'children'), where('classId', '==', classId))
    : query(collection(db, 'children'), orderBy('name', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'))
}

// Flat, queryable list of parent emails for a child — Firestore can't query the
// nested parents[].email, so we denormalize (used for auto-link-on-signup).
function childParentEmails(data) {
  return [...new Set((data.parents || []).map(p => (p.email || '').toLowerCase().trim()).filter(Boolean))]
}

// Restore the leading zero Sheets strips from IL mobiles (9 digits starting 5)
function fixPhone(raw) {
  const d = String(raw || '').replace(/\D/g, '')
  return /^5\d{8}$/.test(d) ? '0' + d : (raw || '')
}
function normalizeParents(data) {
  if (!Array.isArray(data.parents)) return data
  return { ...data, parents: data.parents.map(p => ({ ...p, phone: fixPhone(p.phone) })) }
}

async function _saveChild(child) {
  const { id, ...raw } = child
  const data = normalizeParents(raw)
  data.parentEmails = childParentEmails(data)
  if (id && !id.startsWith('child-')) {
    await updateDoc(doc(db, 'children', id), { ...data, updatedAt: serverTimestamp() })
    // Editing the child's class here doesn't retroactively update classIds on
    // already-linked parents (that only happens in linkChildToParent) — resync
    // so the class stays visible in their nav/dashboard/events.
    await Promise.allSettled((data.parentUids || []).map(uid => syncUserClassIds(uid)))
    return child
  }
  const ref = await addDoc(collection(db, 'children'), { ...data, createdAt: serverTimestamp() })
  return { ...child, id: ref.id }
}

async function _deleteChild(id) {
  await deleteDoc(doc(db, 'children', id))
}

async function _bulkImportChildren(children) {
  const batch = writeBatch(db)
  const created = children.map(child => {
    const ref = doc(collection(db, 'children'))
    const data = normalizeParents(child)
    batch.set(ref, { ...data, parentEmails: childParentEmails(data), parentUids: [], createdAt: serverTimestamp() })
    return { ...data, id: ref.id }
  })
  await batch.commit()
  return created
}

// Fill a linked parent's profile from the imported phone-book data:
// phone/address only if empty; name only if the current one has no Hebrew
// letters (e.g. email prefix or Google display name) — users can still
// change it later in settings.
export async function enrichUserFromImport(uid, { name, phone, address }) {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return
  const data = snap.data()
  const updates = {}
  // Sheets strips leading zeros from numeric cells — restore for IL mobiles
  if (phone && /^5\d{8}$/.test(phone.replace(/\D/g, ''))) phone = '0' + phone.replace(/\D/g, '')
  if (phone && !data.phone) updates.phone = phone
  if (address && !data.address) updates.address = address
  if (name && !/[א-ת]/.test(data.name || '')) updates.name = name
  if (Object.keys(updates).length) await updateDoc(doc(db, 'users', uid), updates)
}

// Auto-link a freshly-registered (or returning) parent to any imported children
// whose phone-book data lists their email. Runs fire-and-forget at login.
// Returns the number of children newly linked.
export async function autoLinkChildrenByEmail(uid, email) {
  const lower = (email || '').toLowerCase().trim()
  if (!lower) return 0
  let snap
  try {
    snap = await getDocs(query(collection(db, 'children'), where('parentEmails', 'array-contains', lower)))
  } catch { return 0 }   // rules may deny before any child is claimable — fine
  let linked = 0
  for (const d of snap.docs) {
    const child = d.data()
    if ((child.parentUids || []).includes(uid)) continue
    try {
      await _linkChildToParent(d.id, uid)
      const p = (child.parents || []).find(p => (p.email || '').toLowerCase().trim() === lower)
      if (p) {
        const name = p.name ? [p.name, child.familyName].filter(Boolean).join(' ') : ''
        await enrichUserFromImport(uid, { name, phone: p.phone || '', address: child.address || '' })
      }
      linked++
    } catch (e) { console.error('autoLink failed', d.id, e) }
  }
  if (linked) invalidate('children', 'childrenBy')
  return linked
}

async function _bulkDeleteChildren(ids) {
  for (let i = 0; i < ids.length; i += 450) {
    const batch = writeBatch(db)
    ids.slice(i, i + 450).forEach(id => batch.delete(doc(db, 'children', id)))
    await batch.commit()
  }
}

async function _linkChildToParent(childId, parentUid) {
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
    // access to their child's class roster. classProofChildId lets the rules
    // verify (via getAfter) that the added class belongs to a child this user
    // is a linked parent of — the child link lands in the same batch.
    const classIds = child.classId
      ? [...new Set([...(userSnap.data().classIds || []), child.classId])]
      : (userSnap.data().classIds || [])
    batch.update(doc(db, 'users', parentUid), { childIds, classIds, classProofChildId: childId })
  }
  await batch.commit()
}

// Recompute users/{uid}.classIds from the children currently linked to them.
// Used to backfill existing users and to repair stale membership after unlink.
// Rules only allow classIds to shrink freely; each ADDED class must be proven
// by a linked child in that class (classProofChildId) — so removals go in one
// write and additions go one class per write.
async function _syncUserClassIds(uid) {
  const userSnap = await getDoc(doc(db, 'users', uid))
  // Alumni keep no class membership even if children docs are still linked
  if (userSnap.data()?.status === 'alumni') {
    if ((userSnap.data()?.classIds || []).length > 0) {
      await updateDoc(doc(db, 'users', uid), { classIds: [] })
    }
    return []
  }
  const kids = await _getChildrenByParent(uid)
  const target = [...new Set(kids.map(c => c.classId).filter(Boolean))]
  const current = userSnap.data()?.classIds || []
  let acc = current.filter(id => target.includes(id))
  if (acc.length !== current.length) {
    await updateDoc(doc(db, 'users', uid), { classIds: acc })
  }
  for (const classId of target.filter(id => !acc.includes(id))) {
    const proof = kids.find(k => k.classId === classId)
    acc = [...acc, classId]
    await updateDoc(doc(db, 'users', uid), { classIds: acc, classProofChildId: proof.id })
  }
  return acc
}

async function _unlinkChildFromParent(childId, parentUid) {
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
async function _getChildrenByParent(uid) {
  // No orderBy here: array-contains + orderBy requires a composite index that
  // doesn't exist, so the query rejected and killed every Promise.all using it.
  const q = query(collection(db, 'children'), where('parentUids', 'array-contains', uid))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'))
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
async function _getAnnouncements() {
  const snap = await getDocs(query(collection(db, 'announcements'), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

async function _saveAnnouncement(ann) {
  const { id, ...data } = ann
  if (id && !id.startsWith('ann-')) {
    await updateDoc(doc(db, 'announcements', id), { ...data, updatedAt: serverTimestamp() })
    return ann
  }
  const ref = await addDoc(collection(db, 'announcements'), { ...data, createdAt: serverTimestamp() })
  return { ...ann, id: ref.id }
}

async function _deleteAnnouncement(id) {
  await deleteDoc(doc(db, 'announcements', id))
}

// ── Committees ────────────────────────────────────────────────────────────────
async function _getCommittees() {
  const snap = await getDocs(query(collection(db, 'committees'), orderBy('order', 'asc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

async function _saveCommittee(committee) {
  const { id, ...data } = committee
  if (id && !id.startsWith('committee-')) {
    await updateDoc(doc(db, 'committees', id), { ...data, updatedAt: serverTimestamp() })
    return committee
  }
  const ref = await addDoc(collection(db, 'committees'), { ...data, createdAt: serverTimestamp() })
  return { ...committee, id: ref.id }
}

async function _deleteCommittee(id) {
  await deleteDoc(doc(db, 'committees', id))
}

// A member requests a new committee — created as 'pending', reviewed by an admin
export async function requestCommittee({ name, description, requestedBy, requestedByName }) {
  const ref = await addDoc(collection(db, 'committees'), {
    name, description: description || '', icon: 'Users', color: '#1B3B70',
    members: [], memberUids: [requestedBy],
    order: 999, status: 'pending', requestedBy, requestedByName,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function approveCommittee(id) {
  await updateDoc(doc(db, 'committees', id), { status: 'active' })
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
    ? query(collection(db, 'committeeMessages'), where('committeeId', '==', committeeId))
    : query(collection(db, 'committeeMessages'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
}

export async function markCommitteeMessageRead(id) {
  await updateDoc(doc(db, 'committeeMessages', id), { read: true })
}

// ── Resources ─────────────────────────────────────────────────────────────────
async function _getResources() {
  const snap = await getDocs(query(collection(db, 'resources'), orderBy('category')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

async function _saveResource(resource) {
  const { id, ...data } = resource
  if (id && !id.startsWith('resource-')) {
    await updateDoc(doc(db, 'resources', id), { ...data, updatedAt: serverTimestamp() })
    return resource
  }
  const ref = await addDoc(collection(db, 'resources'), { ...data, createdAt: serverTimestamp() })
  return { ...resource, id: ref.id }
}

async function _deleteResource(id) {
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
    const arr = new Uint8Array(9)
    crypto.getRandomValues(arr)
    const tempPw = `_Sh${btoa(String.fromCharCode(...arr)).replace(/[+/=]/g, '').slice(0, 8)}!`
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, tempPw)
    await updateFBProfile(cred.user, { displayName: name })
    const newUid = cred.user.uid

    // Create Firestore profile under secondary auth (request.auth.uid === newUid) ✓
    // classIds must start empty (create rule forbids seeding it) — it syncs from
    // the linked children on the co-parent's first login (syncUserClassIds).
    await setDoc(doc(secondaryDb, 'users', newUid), {
      name, email, phone: phone || '',
      role: currentUser.role,
      childIds: currentUser.childIds || [],
      classIds: [],
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

// Create a new member account directly (admin action).
// Uses a secondary app so the current admin session is not affected.
async function _createMember({ name, email, phone, role, roles }) {
  const appName = `new-member-${Date.now()}`
  const secondaryApp = initializeApp(firebaseConfig, appName)
  const secondaryAuth = getAuth(secondaryApp)
  const secondaryDb = getFirestore(secondaryApp)
  try {
    const arr = new Uint8Array(9)
    crypto.getRandomValues(arr)
    const tempPw = `_Sh${btoa(String.fromCharCode(...arr)).replace(/[+/=]/g, '').slice(0, 8)}!`
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, tempPw)
    await updateFBProfile(cred.user, { displayName: name })
    const newUid = cred.user.uid
    await setDoc(doc(secondaryDb, 'users', newUid), {
      name, email, phone: phone || '',
      role: role || 'community',
      roles: roles || [],
      createdAt: serverTimestamp(),
    })
    await sendPasswordResetEmail(secondaryAuth, email)
    return { uid: newUid, name, email, phone: phone || '', role: role || 'new_family' }
  } finally {
    try { await secondaryAuth.signOut() } catch {}
    try { await deleteApp(secondaryApp) } catch {}
  }
}

// ── Hobby groups ───────────────────────────────────────────────────────────────
async function _getHobbyGroups() {
  const snap = await getDocs(query(collection(db, 'hobbyGroups'), orderBy('order', 'asc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

async function _saveHobbyGroup(group) {
  const { id, ...data } = group
  if (id && !id.startsWith('hobby-')) {
    await updateDoc(doc(db, 'hobbyGroups', id), { ...data, updatedAt: serverTimestamp() })
    return group
  }
  const r = await addDoc(collection(db, 'hobbyGroups'), { ...data, memberUids: [], createdAt: serverTimestamp() })
  return { ...group, id: r.id }
}

async function _deleteHobbyGroup(id) {
  await deleteDoc(doc(db, 'hobbyGroups', id))
}

// A member requests a new community group — created as 'pending', reviewed by an admin
export async function requestHobbyGroup({ name, description, requestedBy, requestedByName }) {
  const ref = await addDoc(collection(db, 'hobbyGroups'), {
    name, description: description || '',
    memberUids: [requestedBy],
    order: 999, status: 'pending', requestedBy, requestedByName,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function approveHobbyGroup(id) {
  await updateDoc(doc(db, 'hobbyGroups', id), { status: 'active' })
}

async function _joinHobbyGroup(groupId, uid) {
  await updateDoc(doc(db, 'hobbyGroups', groupId), { memberUids: arrayUnion(uid) })
}

async function _leaveHobbyGroup(groupId, uid) {
  await updateDoc(doc(db, 'hobbyGroups', groupId), { memberUids: arrayRemove(uid) })
}

async function _rsvpEvent(eventId, uid) {
  await updateDoc(doc(db, 'events', eventId), { attendeeUids: arrayUnion(uid) })
}

export async function unrsvpEvent(eventId, uid) {
  await updateDoc(doc(db, 'events', eventId), { attendeeUids: arrayRemove(uid) })
}

// ── Committee-scoped events ───────────────────────────────────────────────────
export async function getEventsByCommittee(committeeId) {
  const q = query(collection(db, 'events'), where('committeeId', '==', committeeId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
}

// ── Group member-contributed links ────────────────────────────────────────────
export async function getGroupLinks(groupId) {
  const q = query(collection(db, 'groupLinks'), where('groupId', '==', groupId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
}

export async function addGroupLink(groupId, uid, postedBy, label, url) {
  await addDoc(collection(db, 'groupLinks'), {
    groupId,
    uid,
    postedBy: String(postedBy).slice(0, 100),
    label: String(label).slice(0, 200),
    url: String(url).slice(0, 2000),
    createdAt: serverTimestamp(),
  })
}

export async function deleteGroupLink(id) {
  await deleteDoc(doc(db, 'groupLinks', id))
}

// ── Group member-contributed files ────────────────────────────────────────────
export async function uploadGroupFile(groupId, uid, file, label) {
  const ext = safeExt(file)
  const path = `groupFiles/${groupId}/${uid}_${Date.now()}.${ext}`
  const snap = await uploadBytes(ref(storage, path), file)
  const url = await getDownloadURL(snap.ref)
  await addDoc(collection(db, 'groupFiles'), {
    groupId,
    uid,
    label: String(label || file.name).slice(0, 200),
    fileName: file.name,
    fileUrl: url,
    filePath: path,
    createdAt: serverTimestamp(),
  })
}

export async function getGroupFiles(groupId) {
  const q = query(collection(db, 'groupFiles'), where('groupId', '==', groupId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
}

export async function deleteGroupFile(id, filePath) {
  await deleteDoc(doc(db, 'groupFiles', id))
  if (filePath) {
    try { await deleteObject(ref(storage, filePath)) } catch { /* already gone */ }
  }
}

// ── Group-scoped events ────────────────────────────────────────────────────────
export async function getGroupEvents(groupId) {
  const q = query(collection(db, 'events'), where('groupId', '==', groupId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
}

async function _createGroupEvent(groupId, uid, { title, date, time, location, description }) {
  await addDoc(collection(db, 'events'), {
    groupId,
    createdBy: uid,
    title: String(title).slice(0, 200),
    date,
    time: time || '',
    location: String(location || '').slice(0, 300),
    description: String(description || '').slice(0, 2000),
    type: 'community',
    attendeeUids: [],
    createdAt: serverTimestamp(),
  })
}

async function _deleteGroupEvent(id) {
  await deleteDoc(doc(db, 'events', id))
}

// ── Emergency mode ────────────────────────────────────────────────────────────
export async function getEmergencyMode() {
  const snap = await getDoc(doc(db, 'settings', 'emergencyMode'))
  return snap.exists() ? snap.data() : { active: false }
}

export async function setEmergencyMode(data, uid) {
  await setDoc(doc(db, 'settings', 'emergencyMode'), {
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  }, { merge: true })
}

// emergencySchedule doc id = `{classId}_{date}` (date: YYYY-MM-DD)
export async function getEmergencySchedule(classId, date) {
  const snap = await getDoc(doc(db, 'emergencySchedule', `${classId}_${date}`))
  return snap.exists() ? snap.data().slots || [] : []
}

export async function saveEmergencySchedule(classId, date, slots) {
  await setDoc(doc(db, 'emergencySchedule', `${classId}_${date}`), {
    classId,
    date,
    slots,
    updatedAt: serverTimestamp(),
  })
}

// Fetch all emergency schedule docs for a given date (all classes)
export async function getEmergencyScheduleForDate(date) {
  const q = query(collection(db, 'emergencySchedule'), where('date', '==', date))
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data())
}

// ── Onboarding ────────────────────────────────────────────────────────────────
export async function completeOnboarding(uid) {
  await updateDoc(doc(db, 'users', uid), { onboardingComplete: true })
}

// Returns children that have no parents yet (for onboarding self-linking).
// Security rule allows reading these docs for any authenticated user.
export async function getUnlinkedChildren() {
  // ponytail: no orderBy — avoids requiring a composite index; sort client-side
  const q = query(collection(db, 'children'), where('parentUids', '==', []))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'))
}

// ── Committee membership (UID-based join/leave) ───────────────────────────────
async function _joinCommittee(committeeId, uid) {
  await updateDoc(doc(db, 'committees', committeeId), { memberUids: arrayUnion(uid) })
}

async function _leaveCommittee(committeeId, uid) {
  await updateDoc(doc(db, 'committees', committeeId), { memberUids: arrayRemove(uid) })
}

// ── Committee chat ────────────────────────────────────────────────────────────
export function subscribeCommitteeChat(committeeId, callback) {
  const q = query(
    collection(db, 'committeeChat'),
    where('committeeId', '==', committeeId),
    limit(200),
  )
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)))
  })
}

export async function sendCommitteeChatMessage(committeeId, uid, name, text) {
  await addDoc(collection(db, 'committeeChat'), {
    committeeId, uid, name,
    text: String(text).slice(0, 2000),
    createdAt: serverTimestamp(),
  })
}

// ── Committee summaries (meeting notes & decisions) ───────────────────────────
export async function getCommitteeSummaries(committeeId) {
  const q = query(
    collection(db, 'committeeSummaries'),
    where('committeeId', '==', committeeId),
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
}

export async function saveCommitteeSummary(summary) {
  const { id, ...data } = summary
  if (id && !id.startsWith('summary-')) {
    await updateDoc(doc(db, 'committeeSummaries', id), { ...data, updatedAt: serverTimestamp() })
    return summary
  }
  const ref = await addDoc(collection(db, 'committeeSummaries'), { ...data, createdAt: serverTimestamp() })
  return { ...summary, id: ref.id }
}

export async function deleteCommitteeSummary(id) {
  await deleteDoc(doc(db, 'committeeSummaries', id))
}

// ── Community group chat ──────────────────────────────────────────────────────
export function subscribeGroupChat(groupId, callback) {
  const q = query(
    collection(db, 'groupChat'),
    where('groupId', '==', groupId),
    limit(200),
  )
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)))
  })
}

export async function sendGroupChatMessage(groupId, uid, name, text) {
  await addDoc(collection(db, 'groupChat'), {
    groupId, uid, name,
    text: String(text).slice(0, 2000),
    createdAt: serverTimestamp(),
  })
}

// ── Feedback / bug reports ──────────────────────────────────────────────────────
export async function saveFeedback({ text, screenshotUrl, submittedBy }) {
  const docRef = await addDoc(collection(db, 'feedback'), {
    text, screenshotUrl: screenshotUrl || null, submittedBy,
    createdAt: serverTimestamp(),
    status: 'new',
  })
  return docRef.id
}

export async function uploadFeedbackScreenshot(feedbackId, file) {
  file = await compressImage(file)
  const path = `feedback/${feedbackId}.${safeExt(file)}`
  const snap = await uploadBytes(ref(storage, path), file)
  return getDownloadURL(snap.ref)
}

export async function getFeedback() {
  const snap = await getDocs(query(collection(db, 'feedback'), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function updateFeedbackStatus(id, status) {
  await updateDoc(doc(db, 'feedback', id), { status })
}

export async function updateFeedbackScreenshot(id, screenshotUrl) {
  await updateDoc(doc(db, 'feedback', id), { screenshotUrl })
}

export async function replyToFeedback(id, reply) {
  await updateDoc(doc(db, 'feedback', id), { adminReply: reply, repliedAt: serverTimestamp(), status: 'resolved' })
}

// ── Community businesses ──────────────────────────────────────────────────────

async function _getBusinesses() {
  const snap = await getDocs(collection(db, 'communityBusinesses'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
}

async function _saveBusiness(biz) {
  const { id, ...data } = biz
  if (id && !id.startsWith('biz-')) {
    await updateDoc(doc(db, 'communityBusinesses', id), { ...data, updatedAt: serverTimestamp() })
    return biz
  }
  const ref2 = await addDoc(collection(db, 'communityBusinesses'), { ...data, createdAt: serverTimestamp() })
  return { ...biz, id: ref2.id }
}

async function _deleteBusiness(id) {
  const biz = (await getDoc(doc(db, 'communityBusinesses', id))).data()
  if (biz?.imagePath) try { await deleteObject(ref(storage, biz.imagePath)) } catch { /* already gone */ }
  await deleteDoc(doc(db, 'communityBusinesses', id))
}

export async function uploadBusinessImage(uid, bizId, file) {
  file = await compressImage(file)
  const path = `businesses/${uid}/${bizId}_${Date.now()}.${safeExt(file)}`
  const snap = await uploadBytes(ref(storage, path), file)
  return { url: await getDownloadURL(snap.ref), path }
}

// ── Cached-read + invalidating-mutator wrappers ───────────────────────────────
export function getClasses() { return cached('classes', 5 * MIN, () => _getClasses()) }
export function getEvents() { return cached('events', 2 * MIN, () => _getEvents()) }
export function getCommittees() { return cached('committees', 5 * MIN, () => _getCommittees()) }
export function getHobbyGroups() { return cached('groups', 5 * MIN, () => _getHobbyGroups()) }
export function getResources() { return cached('resources', 5 * MIN, () => _getResources()) }
export function getAnnouncements() { return cached('announcements', 5 * MIN, () => _getAnnouncements()) }
export function getForms() { return cached('forms', 5 * MIN, () => _getForms()) }
export function getUsers() { return cached('users', 1 * MIN, () => _getUsers()) }
export function getBusinesses() { return cached('businesses', 2 * MIN, () => _getBusinesses()) }
export function getChildren(classId = null) { return cached(`children:${classId || 'all'}`, 1 * MIN, () => _getChildren(classId)) }
export function getChildrenByParent(uid) { return cached(`childrenBy:${uid}`, 1 * MIN, () => _getChildrenByParent(uid)) }
export async function saveClass(...args) { const r = await _saveClass(...args); invalidate('classes'); return r }
export async function deleteClass(...args) { const r = await _deleteClass(...args); invalidate('classes'); return r }
export async function removeClassAdmin(...args) { const r = await _removeClassAdmin(...args); invalidate('classes', 'users'); return r }
export async function saveEvent(...args) { const r = await _saveEvent(...args); invalidate('events'); return r }
export async function deleteEvent(...args) { const r = await _deleteEvent(...args); invalidate('events'); return r }
export async function rsvpEvent(...args) { const r = await _rsvpEvent(...args); invalidate('events'); return r }
export async function createGroupEvent(...args) { const r = await _createGroupEvent(...args); invalidate('events'); return r }
export async function deleteGroupEvent(...args) { const r = await _deleteGroupEvent(...args); invalidate('events'); return r }
export async function saveCommittee(...args) { const r = await _saveCommittee(...args); invalidate('committees'); return r }
export async function deleteCommittee(...args) { const r = await _deleteCommittee(...args); invalidate('committees'); return r }
export async function joinCommittee(...args) { const r = await _joinCommittee(...args); invalidate('committees'); return r }
export async function leaveCommittee(...args) { const r = await _leaveCommittee(...args); invalidate('committees'); return r }
export async function saveHobbyGroup(...args) { const r = await _saveHobbyGroup(...args); invalidate('groups'); return r }
export async function deleteHobbyGroup(...args) { const r = await _deleteHobbyGroup(...args); invalidate('groups'); return r }
export async function joinHobbyGroup(...args) { const r = await _joinHobbyGroup(...args); invalidate('groups'); return r }
export async function leaveHobbyGroup(...args) { const r = await _leaveHobbyGroup(...args); invalidate('groups'); return r }
export async function saveResource(...args) { const r = await _saveResource(...args); invalidate('resources'); return r }
export async function deleteResource(...args) { const r = await _deleteResource(...args); invalidate('resources'); return r }
export async function saveAnnouncement(...args) { const r = await _saveAnnouncement(...args); invalidate('announcements'); return r }
export async function deleteAnnouncement(...args) { const r = await _deleteAnnouncement(...args); invalidate('announcements'); return r }
export async function saveForm(...args) { const r = await _saveForm(...args); invalidate('forms'); return r }
export async function deleteForm(...args) { const r = await _deleteForm(...args); invalidate('forms'); return r }
export async function updateUserProfile(...args) { const r = await _updateUserProfile(...args); invalidate('users'); return r }
export async function createMember(...args) { const r = await _createMember(...args); invalidate('users'); return r }
export async function markUsersImported(...args) { const r = await _markUsersImported(...args); invalidate('users'); return r }
export async function syncUserClassIds(...args) { const r = await _syncUserClassIds(...args); invalidate('users'); return r }
export async function deleteUserCompletely(...args) { const r = await _deleteUserCompletely(...args); invalidate('users', 'children', 'childrenBy'); return r }
export async function saveChild(...args) { const r = await _saveChild(...args); invalidate('children', 'childrenBy'); return r }
export async function deleteChild(...args) { const r = await _deleteChild(...args); invalidate('children', 'childrenBy'); return r }
export async function bulkImportChildren(...args) { const r = await _bulkImportChildren(...args); invalidate('children', 'childrenBy'); return r }
export async function bulkDeleteChildren(...args) { const r = await _bulkDeleteChildren(...args); invalidate('children', 'childrenBy'); return r }
export async function updateChildProfile(...args) { const r = await _updateChildProfile(...args); invalidate('children', 'childrenBy'); return r }
export async function linkChildToParent(...args) { const r = await _linkChildToParent(...args); invalidate('children', 'childrenBy', 'users'); return r }
export async function unlinkChildFromParent(...args) { const r = await _unlinkChildFromParent(...args); invalidate('children', 'childrenBy', 'users'); return r }
export async function saveBusiness(...args) { const r = await _saveBusiness(...args); invalidate('businesses'); return r }
export async function deleteBusiness(...args) { const r = await _deleteBusiness(...args); invalidate('businesses'); return r }
