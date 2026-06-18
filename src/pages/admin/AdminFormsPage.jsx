import { useState, useEffect } from 'react'
import {
  getForms, saveForm, deleteForm, getClasses, getSubmissionsForForm,
} from '../../lib/db'
import { newFormId, newFieldId } from '../../lib/formsStorage'
import {
  FileText, Plus, Edit2, Trash2, Eye, ChevronUp, ChevronDown,
  ToggleLeft, ToggleRight, X, Check, GripVertical, Users, User, GraduationCap,
  Loader2,
} from 'lucide-react'
import clsx from 'clsx'

const FIELD_TYPES = [
  { value: 'text',     label: 'טקסט קצר' },
  { value: 'textarea', label: 'טקסט ארוך' },
  { value: 'email',    label: 'אימייל' },
  { value: 'tel',      label: 'טלפון' },
  { value: 'select',   label: 'רשימה' },
]

const TARGET_OPTIONS = [
  { value: 'new_family',  label: 'משפחות חדשות',  icon: User },
  { value: 'host_family', label: 'משפחות מארחות', icon: Users },
  { value: 'all',         label: 'כולם',           icon: Users },
  { value: 'class',       label: 'כיתה ספציפית',  icon: GraduationCap },
]

const STATUS_LABELS = { draft: 'טיוטה', published: 'פורסם' }

// ---- Field editor row ----

function FieldRow({ field, index, total, onChange, onDelete, onMove }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setOpen(!open)}
      >
        <GripVertical size={14} className="text-gray-300 flex-shrink-0" />
        <div className="flex-1 text-right min-w-0">
          <span className="text-sm font-medium text-gray-800 truncate block">{field.label || 'שדה ללא שם'}</span>
          <span className="text-xs text-gray-400">{FIELD_TYPES.find(t => t.value === field.type)?.label}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {field.required && <span className="text-xs bg-primary-50 text-primary-600 px-1.5 py-0.5 rounded">נדרש</span>}
          <button onClick={e => { e.stopPropagation(); onMove(index, -1) }} disabled={index === 0}
            className="p-1 hover:bg-gray-100 rounded disabled:opacity-30">
            <ChevronUp size={14} />
          </button>
          <button onClick={e => { e.stopPropagation(); onMove(index, 1) }} disabled={index === total - 1}
            className="p-1 hover:bg-gray-100 rounded disabled:opacity-30">
            <ChevronDown size={14} />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete() }}
            className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded">
            <Trash2 size={14} />
          </button>
          <span className="text-gray-300">{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50 space-y-3">
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="label block mb-1 text-right text-xs">סוג שדה</label>
              <select
                value={field.type}
                onChange={e => onChange({ ...field, type: e.target.value, options: e.target.value === 'select' ? [''] : undefined })}
                className="input w-full text-right text-sm py-2"
              >
                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label block mb-1 text-right text-xs">כותרת השדה</label>
              <input
                value={field.label}
                onChange={e => onChange({ ...field, label: e.target.value })}
                className="input w-full text-right text-sm py-2"
                placeholder="שם השדה"
              />
            </div>
          </div>

          <div>
            <label className="label block mb-1 text-right text-xs">טקסט עזרה (placeholder)</label>
            <input
              value={field.placeholder || ''}
              onChange={e => onChange({ ...field, placeholder: e.target.value })}
              className="input w-full text-right text-sm py-2"
              placeholder="לדוגמה: הכנס שם..."
            />
          </div>

          {field.type === 'select' && (
            <div>
              <label className="label block mb-1 text-right text-xs">אפשרויות (אחת לשורה)</label>
              <textarea
                value={(field.options || []).join('\n')}
                onChange={e => onChange({ ...field, options: e.target.value.split('\n').filter(Boolean) })}
                className="input w-full text-right text-sm py-2 resize-none"
                rows={4}
                placeholder="אפשרות א׳&#10;אפשרות ב׳&#10;אפשרות ג׳"
              />
            </div>
          )}

          <label className="flex items-center justify-end gap-2 cursor-pointer">
            <span className="text-sm text-gray-700">שדה נדרש</span>
            <button
              onClick={() => onChange({ ...field, required: !field.required })}
              className={clsx(
                'w-10 h-5 rounded-full transition-colors relative',
                field.required ? 'bg-primary-500' : 'bg-gray-200'
              )}
            >
              <span className={clsx(
                'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all',
                field.required ? 'right-0.5' : 'left-0.5'
              )} />
            </button>
          </label>
        </div>
      )}
    </div>
  )
}

// ---- Form builder view ----

function FormBuilder({ form, onSave, onCancel, classes = [] }) {
  const [draft, setDraft] = useState({ classIds: [], ...form })

  const addField = () => {
    setDraft(d => ({
      ...d,
      fields: [...d.fields, {
        id: newFieldId(),
        type: 'text',
        label: '',
        placeholder: '',
        required: false,
      }],
    }))
  }

  const updateField = (index, updated) => {
    setDraft(d => {
      const fields = [...d.fields]
      fields[index] = updated
      return { ...d, fields }
    })
  }

  const deleteField = (index) => {
    setDraft(d => ({ ...d, fields: d.fields.filter((_, i) => i !== index) }))
  }

  const moveField = (index, dir) => {
    setDraft(d => {
      const fields = [...d.fields]
      const target = index + dir
      if (target < 0 || target >= fields.length) return d
      ;[fields[index], fields[target]] = [fields[target], fields[index]]
      return { ...d, fields }
    })
  }

  return (
    <div className="space-y-5">
      {/* Form metadata */}
      <div className="card p-5 space-y-4">
        <h3 className="font-bold text-gray-700 text-sm">פרטי הטופס</h3>
        <div>
          <label className="label block mb-1 text-right">כותרת הטופס</label>
          <input
            value={draft.title}
            onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
            className="input w-full text-right"
            placeholder="למשל: טופס פרטי משפחה"
          />
        </div>
        <div>
          <label className="label block mb-1 text-right">תיאור קצר</label>
          <input
            value={draft.description}
            onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
            className="input w-full text-right"
            placeholder="הוראות קצרות למילוי הטופס"
          />
        </div>
        <div>
          <label className="label block mb-1 text-right">קהל יעד</label>
          <div className="grid grid-cols-2 gap-2">
            {TARGET_OPTIONS.map(opt => {
              const Icon = opt.icon
              return (
                <button
                  key={opt.value}
                  onClick={() => setDraft(d => ({
                    ...d,
                    targetRole: opt.value,
                    classIds: opt.value !== 'class' ? [] : d.classIds,
                  }))}
                  className={clsx(
                    'flex flex-col items-center gap-1 p-2 rounded-xl border text-xs font-medium transition-all',
                    draft.targetRole === opt.value
                      ? 'bg-primary-50 border-primary-300 text-primary-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  )}
                >
                  <Icon size={15} />
                  {opt.label}
                </button>
              )
            })}
          </div>
          {draft.targetRole === 'class' && (
            <div className="mt-2 bg-gray-50 rounded-xl px-4 py-3 space-y-2 max-h-40 overflow-y-auto">
              {classes.length === 0 && <p className="text-sm text-gray-400 text-center py-1">אין כיתות במערכת</p>}
              {classes.map(cls => (
                <label key={cls.id} className="flex items-center justify-end gap-2 cursor-pointer">
                  <span className="text-sm text-gray-700 flex items-center gap-1.5">
                    {cls.name}
                    <span className="w-2 h-2 rounded-full inline-block"
                      style={{ backgroundColor: cls.color || '#1B3B70' }} />
                  </span>
                  <input type="checkbox"
                    checked={(draft.classIds || []).includes(cls.id)}
                    onChange={() => {
                      const next = (draft.classIds || []).includes(cls.id)
                        ? (draft.classIds || []).filter(id => id !== cls.id)
                        : [...(draft.classIds || []), cls.id]
                      setDraft(d => ({ ...d, classIds: next }))
                    }}
                    className="w-4 h-4 accent-primary-600 flex-shrink-0" />
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fields */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={addField}
            className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            <Plus size={15} />
            הוסף שדה
          </button>
          <h3 className="font-bold text-gray-700 text-sm">שדות הטופס ({draft.fields.length})</h3>
        </div>
        <div className="space-y-2">
          {draft.fields.map((field, i) => (
            <FieldRow
              key={field.id}
              field={field}
              index={i}
              total={draft.fields.length}
              onChange={updated => updateField(i, updated)}
              onDelete={() => deleteField(i)}
              onMove={(idx, dir) => moveField(idx, dir)}
            />
          ))}
          {draft.fields.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">
              אין שדות עדיין — לחץ "הוסף שדה" כדי להתחיל
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onSave({ ...draft, status: 'published' })}
          className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2"
        >
          <Check size={15} />
          שמור ופרסם
        </button>
        <button
          onClick={() => onSave({ ...draft, status: 'draft' })}
          className="flex-1 btn-outline py-2.5"
        >
          שמור כטיוטה
        </button>
        <button onClick={onCancel} className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

// ---- Submissions panel ----

function SubmissionsPanel({ form, onClose }) {
  const [subs, setSubs]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSubmissionsForForm(form.id)
      .then(setSubs)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [form.id])

  const fmtDate = (ts) => {
    if (!ts) return ''
    const d = ts?.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleDateString('he-IL')
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 flex flex-col animate-slide-from-right" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
          <div className="text-right">
            <h2 className="font-bold text-gray-800">{form.title}</h2>
            <p className="text-xs text-gray-500">{loading ? 'טוען...' : `${subs.length} תגובות`}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={24} className="animate-spin text-primary-400" />
            </div>
          ) : subs.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">עדיין אין תגובות</div>
          ) : subs.map(sub => (
            <div key={sub.id} className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">{fmtDate(sub.submittedAt)}</span>
                <span className="font-semibold text-gray-800 text-sm">{sub.userName}</span>
              </div>
              {form.fields.map(field => (
                sub.data?.[field.id] ? (
                  <div key={field.id} className="text-right">
                    <span className="text-xs text-gray-500">{field.label}: </span>
                    <span className="text-sm text-gray-800">{sub.data[field.id]}</span>
                  </div>
                ) : null
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ---- Main page ----

export default function AdminFormsPage() {
  const [forms, setForms] = useState([])
  const [view, setView] = useState('list') // 'list' | 'builder'
  const [editingForm, setEditingForm] = useState(null)
  const [viewingSubmissions, setViewingSubmissions] = useState(null)
  const [targetFilter, setTargetFilter] = useState('all')
  const [classes, setClasses] = useState([])

  useEffect(() => {
    Promise.all([getForms(), getClasses()])
      .then(([f, c]) => { setForms(f); setClasses(c) })
      .catch(() => {})
  }, [])

  const handleNew = () => {
    setEditingForm({
      id: newFormId(),
      title: '',
      description: '',
      targetRole: 'all',
      classIds: [],
      status: 'draft',
      createdAt: new Date().toISOString().slice(0, 10),
      fields: [],
    })
    setView('builder')
  }

  const handleEdit = (form) => {
    setEditingForm({ ...form, fields: form.fields.map(f => ({ ...f })) })
    setView('builder')
  }

  const handleSave = async (form) => {
    const saved = await saveForm(form)
    setForms(prev => {
      const idx = prev.findIndex(f => f.id === saved.id)
      return idx >= 0 ? prev.map(f => f.id === saved.id ? saved : f) : [...prev, saved]
    })
    setView('list')
    setEditingForm(null)
  }

  const handleDelete = async (id) => {
    await deleteForm(id)
    setForms(prev => prev.filter(f => f.id !== id))
  }

  const toggleStatus = async (form) => {
    const updated = { ...form, status: form.status === 'published' ? 'draft' : 'published' }
    await saveForm(updated)
    setForms(prev => prev.map(f => f.id === updated.id ? updated : f))
  }

  const targetLabel = (role) => TARGET_OPTIONS.find(t => t.value === role)?.label || role

  return (
    <div className="page-container rtl" dir="rtl">
      {view === 'builder' ? (
        <>
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => { setView('list'); setEditingForm(null) }}
              className="text-sm text-primary-600 hover:underline flex items-center gap-1"
            >
              ← חזור לרשימה
            </button>
            <h1 className="text-xl font-black text-primary-800">
              {editingForm?.title || 'טופס חדש'}
            </h1>
          </div>
          <FormBuilder
            form={editingForm}
            onSave={handleSave}
            onCancel={() => { setView('list'); setEditingForm(null) }}
            classes={classes}
          />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <button onClick={handleNew} className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
              <Plus size={16} />
              טופס חדש
            </button>
            <div>
              <h1 className="text-xl font-black text-primary-800 flex items-center gap-2 justify-end">
                <FileText size={22} />
                ניהול טפסים
              </h1>
              <p className="text-sm text-gray-500 mt-0.5 text-right">{forms.length} טפסים</p>
            </div>
          </div>

          {/* Audience filter */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
            {TARGET_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setTargetFilter(opt.value)}
                className={clsx(
                  'flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                  targetFilter === opt.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-300'
                )}>
                {opt.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {forms.filter(f => targetFilter === 'all' || f.targetRole === targetFilter).map(form => (
              <div key={form.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                    <button
                      onClick={() => setViewingSubmissions(form)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary-600 border border-gray-200 hover:border-primary-200 px-2 py-1 rounded-lg transition-colors"
                    >
                      <Eye size={12} />
                      תגובות
                    </button>
                    <button
                      onClick={() => handleEdit(form)}
                      className="flex items-center gap-1 text-xs text-primary-600 bg-primary-50 hover:bg-primary-100 px-2 py-1 rounded-lg transition-colors"
                    >
                      <Edit2 size={12} />
                      ערוך
                    </button>
                    <button
                      onClick={() => toggleStatus(form)}
                      className={clsx(
                        'flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors',
                        form.status === 'published'
                          ? 'text-green-700 bg-green-50 hover:bg-green-100'
                          : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                      )}
                    >
                      {form.status === 'published' ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                      {STATUS_LABELS[form.status]}
                    </button>
                    <button
                      onClick={() => handleDelete(form.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="text-right flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800">{form.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{form.description}</p>
                    <div className="flex items-center gap-2 mt-1.5 justify-end">
                      <span className="text-xs text-gray-400">{form.fields.length} שדות</span>
                      <span className="badge badge-primary text-xs">{targetLabel(form.targetRole)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {forms.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <FileText size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">אין טפסים עדיין</p>
                <button onClick={handleNew} className="mt-3 text-sm text-primary-600 hover:underline">
                  צור את הטופס הראשון
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {viewingSubmissions && (
        <SubmissionsPanel
          form={viewingSubmissions}
          onClose={() => setViewingSubmissions(null)}
        />
      )}
    </div>
  )
}
