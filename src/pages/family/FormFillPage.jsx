import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getForms, getSubmissions, saveSubmission, newFieldId } from '../../lib/formsStorage'
import { ClipboardList, CheckCircle2, ChevronDown } from 'lucide-react'
import clsx from 'clsx'

function FormCard({ form, submission, onFill }) {
  const done = !!submission

  return (
    <div className={clsx('card p-5 border-r-4', done ? 'border-green-400' : 'border-primary-400')}>
      <div className="flex items-start justify-between gap-3">
        <div className={clsx(
          'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
          done ? 'bg-green-100' : 'bg-primary-100'
        )}>
          <CheckCircle2 size={20} className={done ? 'text-green-600' : 'text-primary-400'} />
        </div>
        <div className="flex-1 text-right">
          <h3 className="font-semibold text-gray-800">{form.title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{form.description}</p>
          {done && (
            <p className="text-xs text-green-600 mt-1.5">
              ✓ הוגש ב-{new Date(submission.submittedAt).toLocaleDateString('he-IL')}
            </p>
          )}
        </div>
      </div>
      <div className="mt-4">
        {done ? (
          <button
            onClick={() => onFill(form, submission)}
            className="w-full py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            צפה בתשובות / ערוך
          </button>
        ) : (
          <button
            onClick={() => onFill(form, null)}
            className="w-full btn-primary py-2 text-sm"
          >
            מלא טופס →
          </button>
        )}
      </div>
    </div>
  )
}

function FieldInput({ field, value, onChange, error }) {
  const base = clsx('input w-full text-right', error && 'border-red-300 focus:ring-red-200')

  if (field.type === 'textarea') {
    return (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={3}
        className={clsx(base, 'resize-none')}
      />
    )
  }

  if (field.type === 'select') {
    return (
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className={clsx(base, 'appearance-none pl-8')}
        >
          <option value="">בחר...</option>
          {(field.options || []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>
    )
  }

  return (
    <input
      type={field.type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={field.placeholder}
      className={base}
      dir={field.type === 'email' || field.type === 'tel' ? 'ltr' : 'rtl'}
    />
  )
}

function FillView({ form, existing, onSubmit, onBack }) {
  const [values, setValues] = useState(() => {
    const init = {}
    form.fields.forEach(f => { init[f.id] = existing?.data?.[f.id] || '' })
    return init
  })
  const [errors, setErrors] = useState({})
  const [done, setDone] = useState(false)

  const validate = () => {
    const errs = {}
    form.fields.forEach(f => {
      if (f.required && !values[f.id]?.trim()) errs[f.id] = 'שדה זה נדרש'
    })
    return errs
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    onSubmit(values)
    setDone(true)
  }

  if (done) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={36} className="text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-1">הטופס הוגש בהצלחה!</h2>
        <p className="text-sm text-gray-500 mb-6">הפרטים נשמרו ויועברו לצוות</p>
        <button onClick={onBack} className="btn-primary px-8 py-2.5">חזרה לרשימה</button>
      </div>
    )
  }

  return (
    <div>
      <button onClick={onBack} className="text-sm text-primary-600 hover:underline mb-4 block">
        ← חזור
      </button>
      <h2 className="text-lg font-bold text-gray-800 mb-1">{form.title}</h2>
      {form.description && <p className="text-sm text-gray-500 mb-5">{form.description}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        {form.fields.map(field => (
          <div key={field.id}>
            <label className="label block mb-1 text-right flex items-center gap-1 justify-end">
              {field.required && <span className="text-red-400 text-xs">*</span>}
              {field.label}
            </label>
            <FieldInput
              field={field}
              value={values[field.id]}
              onChange={val => {
                setValues(v => ({ ...v, [field.id]: val }))
                setErrors(e => ({ ...e, [field.id]: '' }))
              }}
              error={errors[field.id]}
            />
            {errors[field.id] && (
              <p className="text-xs text-red-500 mt-1 text-right">{errors[field.id]}</p>
            )}
          </div>
        ))}

        <button type="submit" className="w-full btn-primary py-3 text-base mt-2">
          הגש טופס
        </button>
      </form>
    </div>
  )
}

export default function FormFillPage() {
  const { user } = useAuth()
  const [forms, setForms] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [filling, setFilling] = useState(null) // { form, existing }

  useEffect(() => {
    const allForms = getForms().filter(f =>
      f.status === 'published' &&
      (f.targetRole === user?.role || f.targetRole === 'all')
    )
    setForms(allForms)
    setSubmissions(getSubmissions().filter(s => s.userId === user?.id))
  }, [user])

  const getSubmission = (formId) => submissions.find(s => s.formId === formId)

  const handleSubmit = (form, values) => {
    const sub = {
      id: 'sub-' + Date.now(),
      formId: form.id,
      userId: user.id,
      userName: user.name,
      submittedAt: new Date().toISOString(),
      data: values,
    }
    saveSubmission(sub)
    setSubmissions(getSubmissions().filter(s => s.userId === user?.id))
  }

  if (filling) {
    return (
      <div className="page-container rtl" dir="rtl">
        <FillView
          form={filling.form}
          existing={filling.existing}
          onSubmit={(values) => handleSubmit(filling.form, values)}
          onBack={() => setFilling(null)}
        />
      </div>
    )
  }

  return (
    <div className="page-container rtl" dir="rtl">
      <div className="mb-6">
        <h1 className="text-xl font-black text-primary-800 flex items-center gap-2">
          <ClipboardList size={22} />
          הטפסים שלי
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {forms.filter(f => !getSubmission(f.id)).length} טפסים ממתינים למילוי
        </p>
      </div>

      <div className="space-y-3">
        {forms.map(form => (
          <FormCard
            key={form.id}
            form={form}
            submission={getSubmission(form.id)}
            onFill={(f, sub) => setFilling({ form: f, existing: sub })}
          />
        ))}
        {forms.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">אין טפסים ממתינים כרגע</p>
          </div>
        )}
      </div>
    </div>
  )
}
