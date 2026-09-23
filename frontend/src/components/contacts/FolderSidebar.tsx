import { useState } from 'react'
import { Folder, Plus, Star, Tag, ChevronRight, Trash2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import Card from '../common/Card'
import { contactApi } from '../../api/client'
import { useFoldersQuery, useCreateFolderMutation } from '../../hooks/queries'
import { useToast } from '../common/Toast'
import { CONTACT_SPHERE_META } from '../../types/contactType'
import type { ContactSphere } from '../../types/contact'

export type ContactFilter =
  | { kind: 'all' }
  | { kind: 'favorites' }
  | { kind: 'sphere'; sphere: ContactSphere }
  | { kind: 'folder'; folderId: number }

const SPHERE_ORDER: ContactSphere[] = ['personal', 'work', 'spam']

export default function FolderSidebar({
  selected,
  onSelect,
  contactId,
  onDropContact,
}: {
  selected: ContactFilter
  onSelect: (filter: ContactFilter) => void
  contactId: number | null
  onDropContact: (contactId: number, folderId: number | null) => void
}) {
  const { data: folders = [] } = useFoldersQuery()
  const createFolder = useCreateFolderMutation()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSphere, setNewSphere] = useState<ContactSphere>('personal')
  const [newParent, setNewParent] = useState<number | null>(null)

  const topLevel = folders.filter(f => !f.parent_id)
  const subfoldersOf = (id: number) => folders.filter(f => f.parent_id === id)
  const foldersOfSphere = (sphere: ContactSphere) =>
    topLevel.filter(f => (f.sphere || 'personal') === sphere)

  const parentCandidates = folders.filter(
    f => (f.sphere || 'personal') === newSphere,
  )

  const handleCreate = async () => {
    if (!newName.trim()) return
    await createFolder.mutateAsync({
      name: newName.trim(),
      sphere: newSphere,
      parent_id: newParent,
    })
    setNewName('')
    setNewParent(null)
    setIsAdding(false)
  }

  const handleDragOver = (e: React.DragEvent, _folderId: number | null) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, folderId: number | null) => {
    e.preventDefault()
    if (contactId) {
      onDropContact(contactId, folderId)
    }
  }

  const handleDeleteFolder = async (folder: { id: number; name: string }) => {
    if (!window.confirm(`Удалить папку «${folder.name}»? Контакты из неё не удалятся.`)) return
    try {
      await contactApi.deleteFolder(folder.id)
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      showToast('Папка удалена', 'success')
    } catch {
      showToast('Не удалось удалить папку', 'error')
    }
  }

  const isSphereSelected = (s: ContactSphere) =>
    selected.kind === 'sphere' && selected.sphere === s

  return (
    <div className="w-60 shrink-0">
      <Card>
        <div className="space-y-0.5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">Контакты</h3>
            <button
              onClick={() => setIsAdding(true)}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
              title="Создать папку"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => onSelect({ kind: 'all' })}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              selected.kind === 'all' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Folder className="w-4 h-4" />
            Все контакты
          </button>

          <button
            onClick={() => onSelect({ kind: 'favorites' })}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              selected.kind === 'favorites' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Star className="w-4 h-4" />
            Избранное
          </button>

          <div className="pt-1 mt-1 border-t border-gray-100">
            {SPHERE_ORDER.map(s => {
              const sphereFolders = foldersOfSphere(s)
              const showFolders = s === 'personal' || s === 'work'
              return (
                <div key={s}>
                  <button
                    onClick={() => onSelect({ kind: 'sphere', sphere: s })}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      isSphereSelected(s) ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Tag className="w-4 h-4" />
                    <span className="flex-1 text-left">{CONTACT_SPHERE_META[s].label}</span>
                    {showFolders && (
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isSphereSelected(s) ? 'rotate-90' : ''}`} />
                    )}
                  </button>
                  {showFolders && isSphereSelected(s) && (
                    <div className="ml-4 pl-2 border-l border-gray-200">
                      {sphereFolders.map(folder => (
                        <FolderRow
                          key={folder.id}
                          folder={folder}
                          subfolders={subfoldersOf(folder.id)}
                          selected={selected}
                          onSelect={onSelect}
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                          onDelete={handleDeleteFolder}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {isAdding && (
            <div className="pt-2 mt-1 border-t border-gray-100 space-y-2">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setIsAdding(false); setNewName('') } }}
                placeholder="Название папки"
                className="w-full px-2 py-1 text-sm border rounded"
              />
              <select
                value={newSphere}
                onChange={e => { setNewSphere(e.target.value as ContactSphere); setNewParent(null) }}
                className="w-full px-2 py-1 text-sm border rounded"
              >
                {(['personal', 'work'] as ContactSphere[]).map(s => (
                  <option key={s} value={s}>{CONTACT_SPHERE_META[s].label}</option>
                ))}
              </select>
              {parentCandidates.length > 0 && (
                <select
                  value={newParent === null ? '' : String(newParent)}
                  onChange={e => setNewParent(e.target.value === '' ? null : Number(e.target.value))}
                  className="w-full px-2 py-1 text-sm border rounded"
                >
                  <option value="">Без родительской папки</option>
                  {parentCandidates.map(f => (
                    <option key={f.id} value={f.id}>Внутри «{f.name}»</option>
                  ))}
                </select>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  className="flex-1 px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded disabled:opacity-50"
                >
                  Создать
                </button>
                <button
                  onClick={() => { setIsAdding(false); setNewName('') }}
                  className="px-2 py-1 text-xs border rounded text-gray-600"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

function FolderRow({
  folder,
  subfolders,
  selected,
  onSelect,
  onDragOver,
  onDrop,
  onDelete,
}: {
  folder: { id: number; name: string; color: string | null }
  subfolders: { id: number; name: string; color: string | null }[]
  selected: ContactFilter
  onSelect: (filter: ContactFilter) => void
  onDragOver: (e: React.DragEvent, folderId: number | null) => void
  onDrop: (e: React.DragEvent, folderId: number | null) => void
  onDelete: (folder: { id: number; name: string }) => void
}) {
  const isSelected = selected.kind === 'folder' && selected.folderId === folder.id
  return (
    <div className="group">
      <button
        onClick={() => onSelect({ kind: 'folder', folderId: folder.id })}
        onDragOver={e => onDragOver(e, folder.id)}
        onDrop={e => onDrop(e, folder.id)}
        className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
          isSelected ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: folder.color || '#d1d5db' }} />
        <span className="truncate flex-1">{folder.name}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(folder) }}
          className="p-0.5 rounded text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-opacity shrink-0"
          title="Удалить папку"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </button>
      {subfolders.length > 0 && (
        <div className="ml-4 pl-2 border-l border-gray-200">
          {subfolders.map(sf => (
            <button
              key={sf.id}
              onClick={() => onSelect({ kind: 'folder', folderId: sf.id })}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                selected.kind === 'folder' && selected.folderId === sf.id ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sf.color || '#d1d5db' }} />
              <span className="truncate">{sf.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
