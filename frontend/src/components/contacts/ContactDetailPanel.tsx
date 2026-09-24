import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog } from '@headlessui/react'
import { Mail, Phone, MessageCircle, Pencil, Trash2, ListTodo, Heart, XCircle, Folder, Tag, X, Ban, ShieldCheck } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import Card from '../common/Card'
import Timeline from './Timeline'
import NoteList from './NoteList'
import { contactApi } from '../../api/client'
import { useUpdateContactMutation, useFoldersQuery } from '../../hooks/queries'
import { CONTACT_SPHERE_META } from '../../types/contactType'
import { useToast } from '../common/Toast'
import type { Contact, ContactSphere } from '../../types/contact'

const SPHERES_WITH_FOLDERS: ContactSphere[] = ['personal', 'work']

function ClassifyDialog({
  contact,
  onClose,
}: {
  contact: Contact
  onClose: () => void
}) {
  const [sphere, setSphere] = useState<ContactSphere>(contact.life_sphere === 'spam' ? 'personal' : (contact.life_sphere || 'personal'))
  const [folderId, setFolderId] = useState<number | null>(null)
  const { data: folders = [] } = useFoldersQuery()
  const updateContact = useUpdateContactMutation()

  const availableFolders = folders.filter(
    (f) => !f.parent_id && (f.sphere || 'personal') === sphere,
  )

  const handleSave = async () => {
    const data: { life_sphere: ContactSphere; folder_id?: number | null } = { life_sphere: sphere }
    if (sphere === 'personal' || sphere === 'work') {
      data.folder_id = folderId
    } else {
      data.folder_id = null
    }
    await updateContact.mutateAsync({ id: contact.id, data })
    onClose()
  }

  return (
    <Dialog open={true} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-sm bg-white rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900">Классификация контакта</Dialog.Title>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Сфера</p>
              <div className="grid grid-cols-3 gap-2">
                {(['personal', 'work', 'spam'] as ContactSphere[]).map(s => (
                  <button
                    key={s}
                    onClick={() => { setSphere(s); setFolderId(null) }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      sphere === s ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {CONTACT_SPHERE_META[s].label}
                  </button>
                ))}
              </div>
            </div>

            {SPHERES_WITH_FOLDERS.includes(sphere) && (
              <div>
                <label htmlFor="classify-folder" className="block text-sm font-medium text-gray-700 mb-1">Папка</label>
                <select
                  id="classify-folder"
                  value={folderId === null ? '' : String(folderId)}
                  onChange={e => setFolderId(e.target.value === '' ? null : Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">Без папки</option>
                  {availableFolders.map(f => (
                    <option key={f.id} value={f.id}>{f.name} ({CONTACT_SPHERE_META[sphere].label})</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Отмена</button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg"
            >
              Сохранить
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}

export default function ContactDetailPanel({
  contact,
  onEdit,
  onDelete,
}: {
  contact: Contact
  onEdit: () => void
  onDelete: () => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const updateContact = useUpdateContactMutation()
  const { data: folders = [] } = useFoldersQuery()
  const [showClassify, setShowClassify] = useState(false)
  const { showToast } = useToast()

  const isSpam = contact.life_sphere === 'spam'
  const isDefined = !!contact.life_sphere || contact.folder_id !== null

  const folderName = folders.find(f => f.id === contact.folder_id)?.name

  const handleToggleFavorite = async () => {
    await updateContact.mutateAsync({ id: contact.id, data: { is_favorite: !contact.is_favorite } })
  }

  const handleToggleSpam = async () => {
    const next = contact.life_sphere !== 'spam'
    await contactApi.setSpam(contact.id, next)
    queryClient.invalidateQueries({ queryKey: ['messages'] })
    queryClient.invalidateQueries({ queryKey: ['inbox'] })
    queryClient.invalidateQueries({ queryKey: ['feed'] })
  }

  const handleBlock = async () => {
    if (!window.confirm(`Заблокировать контакт «${contact.name || 'Без имени'}»? Он не сможет писать.`)) return
    try {
      await contactApi.block(contact.id)
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contact', contact.id] })
      showToast('Контакт заблокирован', 'success')
    } catch {
      showToast('Не удалось заблокировать', 'error')
    }
  }

  const handleUnblock = async () => {
    try {
      await contactApi.unblock(contact.id)
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contact', contact.id] })
      showToast('Контакт разблокирован', 'success')
    } catch {
      showToast('Не удалось разблокировать', 'error')
    }
  }

  return (
    <div className="w-96 space-y-4 shrink-0 overflow-y-auto max-h-full">
      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={handleToggleFavorite}
                className="p-1 rounded-lg transition-colors shrink-0"
                title={contact.is_favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
              >
                <Heart className={`w-5 h-5 ${contact.is_favorite ? 'fill-red-500 text-red-500' : 'text-gray-300 hover:text-red-400'}`} />
              </button>
              <h3 className="text-lg font-semibold text-gray-900 truncate">{contact.name || 'Без имени'}</h3>
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={onEdit}
                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Редактировать"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={handleToggleSpam}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title={isSpam ? 'Убрать из спама' : 'Пометить как спам'}
              >
                <XCircle className={`w-4 h-4 ${isSpam ? 'text-red-500' : ''}`} />
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Удалить"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              {contact.is_blocked ? (
                <button
                  onClick={handleUnblock}
                  className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                  title="Разблокировать"
                >
                  <ShieldCheck className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleBlock}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Удалить и заблокировать"
                >
                  <Ban className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {contact.is_blocked && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">
                <Ban className="w-3 h-3" />
                Заблокирован
              </span>
            )}
            {isDefined ? (
              <div className="flex items-center gap-2 text-sm">
                {contact.life_sphere && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${CONTACT_SPHERE_META[contact.life_sphere].bg} ${CONTACT_SPHERE_META[contact.life_sphere].color}`}>
                    <Tag className="w-3 h-3" />
                    {CONTACT_SPHERE_META[contact.life_sphere].label}
                  </span>
                )}
                {contact.contact_types.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">
                    <Tag className="w-3 h-3" />
                    {t}
                  </span>
                ))}
                {folderName && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                    <Folder className="w-3 h-3" />
                    {folderName}
                  </span>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowClassify(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-dashed border-gray-300 text-gray-500 hover:text-blue-600 hover:border-blue-400 transition-colors"
              >
                <Tag className="w-3.5 h-3.5" />
                Классифицировать
              </button>
            )}
          </div>

          <div className="space-y-2 text-sm">
            {contact.telegram_username && (
              <div className="flex items-center gap-2 text-gray-600">
                <MessageCircle className="w-4 h-4 text-gray-400 shrink-0" />
                <span>@{contact.telegram_username.replace(/^@/, '')}</span>
              </div>
            )}
            {contact.telegram_id && !contact.telegram_username && (
              <div className="flex items-center gap-2 text-gray-600">
                <MessageCircle className="w-4 h-4 text-gray-400 shrink-0" />
                <span>ID: {contact.telegram_id}</span>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                <span>{contact.phone}</span>
              </div>
            )}
            {contact.email && (
              <div className="flex items-center gap-2 text-gray-600">
                <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                <span>{contact.email}</span>
              </div>
            )}
            {contact.birthday && (
              <div className="text-gray-600">
                <span className="text-gray-400">День рождения: </span>
                {contact.birthday}
              </div>
            )}
            {contact.notes && (
              <div className="pt-1 text-gray-500 text-xs border-t border-gray-100">
                <p className="font-medium text-gray-400 mb-0.5">Заметки</p>
                <p>{contact.notes}</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card title="Статистика">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => navigate(`/inbox?contact_id=${contact.id}`)}
            className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-blue-50 transition-colors group"
          >
            <MessageCircle className="w-5 h-5 text-blue-500 group-hover:text-blue-600" />
            <span className="text-xl font-bold text-blue-600">{contact.message_count ?? 0}</span>
            <span className="text-xs text-gray-500">Сообщений</span>
          </button>
          <button
            onClick={() => navigate(`/tasks?contact_id=${contact.id}`)}
            className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-purple-50 transition-colors group"
          >
            <ListTodo className="w-5 h-5 text-purple-500 group-hover:text-purple-600" />
            <span className="text-xl font-bold text-purple-600">{contact.task_count ?? 0}</span>
            <span className="text-xs text-gray-500">Задач</span>
          </button>
        </div>
      </Card>

      <Card title="Активность">
        <Timeline contactId={contact.id} />
      </Card>

      <Card>
        <NoteList contactId={contact.id} />
      </Card>

      {showClassify && (
        <ClassifyDialog contact={contact} onClose={() => setShowClassify(false)} />
      )}
    </div>
  )
}
