import { MOCK_FORMS, MOCK_FORM_SUBMISSIONS } from './mockData'

const FORMS_KEY = 'shachaf_forms'
const SUBMISSIONS_KEY = 'shachaf_submissions'
const ADMINS_KEY = 'shachaf_admins'

// --- Forms ---

export function getForms() {
  try {
    const s = localStorage.getItem(FORMS_KEY)
    return s ? JSON.parse(s) : MOCK_FORMS
  } catch {
    return MOCK_FORMS
  }
}

export function saveForms(forms) {
  localStorage.setItem(FORMS_KEY, JSON.stringify(forms))
}

export function getForm(id) {
  return getForms().find(f => f.id === id) || null
}

export function upsertForm(form) {
  const forms = getForms()
  const idx = forms.findIndex(f => f.id === form.id)
  if (idx >= 0) forms[idx] = form
  else forms.push(form)
  saveForms(forms)
  return form
}

export function deleteForm(id) {
  saveForms(getForms().filter(f => f.id !== id))
}

export function newFormId() {
  return 'form-' + Date.now()
}

export function newFieldId() {
  return 'f-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
}

// --- Submissions ---

export function getSubmissions() {
  try {
    const s = localStorage.getItem(SUBMISSIONS_KEY)
    return s ? JSON.parse(s) : MOCK_FORM_SUBMISSIONS
  } catch {
    return MOCK_FORM_SUBMISSIONS
  }
}

export function getSubmissionsForForm(formId) {
  return getSubmissions().filter(s => s.formId === formId)
}

export function getSubmissionsForUser(userId) {
  return getSubmissions().filter(s => s.userId === userId)
}

export function hasSubmitted(userId, formId) {
  return getSubmissions().some(s => s.userId === userId && s.formId === formId)
}

export function saveSubmission(submission) {
  const subs = getSubmissions()
  const idx = subs.findIndex(s => s.formId === submission.formId && s.userId === submission.userId)
  if (idx >= 0) subs[idx] = submission
  else subs.push(submission)
  localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(subs))
}

// --- Admin promotion (super_admin feature) ---

export function getAdminOverrides() {
  try {
    const s = localStorage.getItem(ADMINS_KEY)
    return s ? JSON.parse(s) : {}
  } catch {
    return {}
  }
}

export function setAdminOverride(userId, role) {
  const overrides = getAdminOverrides()
  overrides[userId] = role
  localStorage.setItem(ADMINS_KEY, JSON.stringify(overrides))
}
