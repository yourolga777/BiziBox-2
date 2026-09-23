import { useState, useEffect, Fragment } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { GitMerge, Search } from 'lucide-react'
import { contactSchema, type ContactFormData } from '../../schemas'
import { contactApi } from '../../api/client'
import { useFoldersQuery } from '../../hooks/queries'
import { displayName } from '../../utils/contactDisplayName'
import { CONTACT_SPHERES, CONTACT_SPHERE_META } from '../../types/contactType'
import type { Contact, ContactSphere } from '../../types/contact'

function toNullableString(v: unknown): string | undefined {
  if (v === null || v === undefined || v === '') return undefined
  return String(v)
}

function toNullableNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  return Number(v)
}

const SPHERES_WITH_FOLDERS: ContactSphere[] = ['personal', 'work']

export default function ContactForm({
  initial,
  onSubmit,
  onCancel,
  onMerge,
}: {
  initial: Contact | null
  onSubmit: (data: ContactFormData) => Promise<void>
  onCancel: () => void
  onMerge?: (targetId: number) => Promise<void>
}) {
  const { data: folders = [] } = useFoldersQuery()
  const [showMerge, setShowMerge] = useState(false)
  const [mergeQuery, setMergeQuery] = useState('')
  const [mergeResults, setMergeResults] = useState<Contact[]>([])
  const [merging, setMerging] = useState(false)

  const { register, handleSubmit: withValidation, setError, control, formState: { errors, isSubmitting, isDirty } } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: initial?.name || '',
      phone: initial?.phone || '',
      email: initial?.email || '',
      telegram_username: initial?.telegram_username || '',
      notes: initial?.notes || '',
      is_favorite: initial?.is_favorite ?? false,
      life_sphere: (initial?.life_sphere || '') as ContactSphere | '',
      birthday: initial?.birthday ?? '',
      folder_id: initial?.folder_id ?? '',
    },
  })

  const selectedSphere = useWatch({ control, name: 'life_sphere' }) as ContactSphere | ''
  const effectiveSphere: ContactSphere | '' = selectedSphere || ''

  const foldersOfSphere = folders.filter(
    (f) => effectiveSphere !== '' && (f.sphere || 'personal') === effectiveSphere,
  )
  const topLevelFolders = foldersOfSphere.filter((f) => !f.parent_id)
  const subfoldersOf = (parentId: number) => foldersOfSphere.filter((f) => f.parent_id === parentId)

  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const handleCancel = () => {
    if (isDirty && !window.confirm('Есть несохранённые изменения. Выйти без сохранения?')) {
      return
    }
    onCancel()
  }

  const isEditing = !!initial

  const handleValidatedSubmit = async (data: ContactFormData) => {
    if (!isEditing && !data.name?.trim() && !data.phone?.trim() && !data.email?.trim()) {
      setError('name', { type: 'manual', message: 'Укажите хотя бы имя, телефон или email' })
      return
    }
    await onSubmit(data)
  }

  const handleMergeSearch = async (q: string) => {
    setMergeQuery(q)
    if (q.trim().length < 2) {
      setMergeResults([])
      return
    }
    try {
      const results = await contactApi.search(q)
      setMergeResults(Array.isArray(results) ? results.filter(c => c.id !== initial?.id) : [])
    } catch {
      setMergeResults([])
    }
  }

  const handleMerge = async (targetId: number) => {
    if (!onMerge || merging) return
    setMerging(true)
    try {
      await onMerge(targetId)
    } finally {
      setMerging(false)
    }
  }

  return (
    <form onSubmit={withValidation(handleValidatedSubmit)} className="space-y-4">
      <div>
        <label htmlFor="contact-name" className="block text-sm font-medium text-gray-700 mb-1">Имя</label>
        <input id="contact-name" {...register('name')} className="w-full px-3 py-2 border rounded-lg" />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
      </div>
      <div>
        <label htmlFor="contact-phone" className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
        <input id="contact-phone" {...register('phone')} className="w-full px-3 py-2 border rounded-lg" />
        {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>}
      </div>
      <div>
        <label htmlFor="contact-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input id="contact-email" type="email" {...register('email')} className="w-full px-3 py-2 border rounded-lg" />
        {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
      </div>
      <div>
        <label htmlFor="contact-tg-username" className="block text-sm font-medium text-gray-700 mb-1">Telegram @username</label>
        <input id="contact-tg-username" {...register('telegram_username')} placeholder="@username" className="w-full px-3 py-2 border rounded-lg" />
        {errors.telegram_username && <p className="text-xs text-red-500 mt-1">{errors.telegram_username.message}</p>}
      </div>
      <div>
        <label htmlFor="contact-notes" className="block text-sm font-medium text-gray-700 mb-1">Заметки</label>
        <textarea id="contact-notes" {...register('notes')} rows={3} className="w-full px-3 py-2 border rounded-lg" />
        {errors.notes && <p className="text-xs text-red-500 mt-1">{errors.notes.message}</p>}
      </div>

      <div>
        <label htmlFor="contact-life-sphere" className="block text-sm font-medium text-gray-700 mb-1">Сфера</label>
        <select id="contact-life-sphere" {...register('life_sphere')} className="w-full px-3 py-2 border rounded-lg">
          <option value="">Другое</option>
          {CONTACT_SPHERES.map(s => (
            <option key={s} value={s}>{CONTACT_SPHERE_META[s].label}</option>
          ))}
        </select>
        {errors.life_sphere && <p className="text-xs text-red-500 mt-1">{errors.life_sphere.message}</p>}
      </div>

      <div>
        <label htmlFor="contact-folder" className="block text-sm font-medium text-gray-700 mb-1">Папка</label>
        <select
          id="contact-folder"
          {...register('folder_id', { setValueAs: (v) => v === '' ? '' : Number(v) })}
          disabled={!effectiveSphere || !SPHERES_WITH_FOLDERS.includes(effectiveSphere)}
          className="w-full px-3 py-2 border rounded-lg disabled:opacity-50 disabled:bg-gray-50"
        >
          <option value="">Без папки</option>
          {topLevelFolders.map(f => (
            <Fragment key={f.id}>
              <option value={f.id}>{f.name}</option>
              {subfoldersOf(f.id).map(sf => (
                <option key={sf.id} value={sf.id}>&nbsp;&nbsp;&nbsp;&nbsp;↳ {sf.name}</option>
              ))}
            </Fragment>
          ))}
        </select>
        {effectiveSphere && !SPHERES_WITH_FOLDERS.includes(effectiveSphere) && (
          <p className="text-xs text-gray-400 mt-1">Для сферы «{CONTACT_SPHERE_META[effectiveSphere].label}» папки недоступны</p>
        )}
        {errors.folder_id && <p className="text-xs text-red-500 mt-1">{errors.folder_id.message}</p>}
      </div>

      <div>
        <label htmlFor="contact-birthday" className="block text-sm font-medium text-gray-700 mb-1">День рождения</label>
        <input id="contact-birthday" type="date" {...register('birthday')} className="w-full px-3 py-2 border rounded-lg" />
        {errors.birthday && <p className="text-xs text-red-500 mt-1">{errors.birthday.message}</p>}
      </div>

      <div className="flex items-center gap-3">
        <input id="contact-is-favorite" type="checkbox" {...register('is_favorite')} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
        <label htmlFor="contact-is-favorite" className="text-sm text-gray-700">Избранное</label>
      </div>

      {isEditing && onMerge && (
        <div className="border-t pt-3">
          <button
            type="button"
            onClick={() => setShowMerge(!showMerge)}
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600 transition-colors"
          >
            <GitMerge className="w-4 h-4" />
            Объединить с контактом
          </button>
          {showMerge && (
            <div className="mt-3 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={mergeQuery}
                  onChange={e => handleMergeSearch(e.target.value)}
                  placeholder="Поиск контакта для объединения..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              {mergeQuery.trim().length >= 2 && mergeResults.length === 0 && (
                <p className="text-xs text-gray-400">Ничего не найдено</p>
              )}
              {mergeResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {mergeResults.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleMerge(c.id)}
                      disabled={merging}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 text-sm transition-colors disabled:opacity-50"
                    >
                      <span className="font-medium text-gray-900">{displayName(c)}</span>
                      {c.phone && <span className="text-gray-500 ml-2">{c.phone}</span>}
                      {c.email && !c.phone && <span className="text-gray-500 ml-2">{c.email}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={handleCancel} className="px-4 py-2 text-sm border rounded-lg">Отмена</button>
        <button type="submit" disabled={isSubmitting || merging} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg disabled:opacity-50">
          {isSubmitting ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </form>
  )
}

export { toNullableString, toNullableNumber }
