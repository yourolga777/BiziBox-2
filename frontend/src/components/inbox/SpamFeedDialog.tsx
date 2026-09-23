import { useState, useMemo } from 'react'
import { MessageSquare, ShieldAlert } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useSpamMessagesQuery, useContactsQuery } from '../../hooks/queries'
import { useToast } from '../../components/common/Toast'
import { contactApi, messageApi } from '../../api/client'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { displayNameShort } from '../../utils/contactDisplayName'
import { formatRelativeTime } from '../../utils/format'
import type { Message } from '../../types/message'
import type { Contact } from '../../types/contact'

interface Props {
  open: boolean
  onClose: () => void
  type?: 'spam'
}

interface DialogChatItem {
  contact: Contact
  lastMessage: Message
}

const POLL_INTERVAL = 10000

export default function SpamFeedDialog({ open, onClose, type = 'spam' }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [loadingSpam, setLoadingSpam] = useState(false)
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const spamQuery = useSpamMessagesQuery({
    enabled: loaded,
    refetchInterval: loaded ? POLL_INTERVAL : undefined,
  })

  const handleLoad = async () => {
    setLoadingSpam(true)
    try {
      await messageApi.loadSpam()
      setLoaded(true)
      queryClient.invalidateQueries({ queryKey: ['messages', 'spam', 'count'] })
      queryClient.invalidateQueries({ queryKey: ['messages', 'spam'] })
    } catch {
      showToast('Не удалось загрузить спам', 'error')
    } finally {
      setLoadingSpam(false)
    }
  }

  const messages: Message[] = spamQuery.data ?? []
  const isLoading = spamQuery.isLoading

  const { data: contacts = [] } = useContactsQuery(undefined)

  const contactsMap = useMemo(() => {
    const map = new Map<number, Contact>()
    if (Array.isArray(contacts)) {
      contacts.forEach((c: Contact) => map.set(c.id, c))
    }
    return map
  }, [contacts])

  const chats = useMemo<DialogChatItem[]>(() => {
    const grouped = new Map<number, Message[]>()
    for (const msg of messages) {
      const contact = contactsMap.get(msg.contact_id)
      if (!contact) continue
      const list = grouped.get(msg.contact_id)
      if (list) list.push(msg)
      else grouped.set(msg.contact_id, [msg])
    }
    const result: DialogChatItem[] = []
    for (const [contactId, msgs] of grouped) {
      const contact = contactsMap.get(contactId)!
      const sorted = [...msgs].sort((a, b) => {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      })
      result.push({ contact, lastMessage: sorted[0] })
    }
    result.sort((a, b) => {
      return new Date(b.lastMessage.created_at || 0).getTime() - new Date(a.lastMessage.created_at || 0).getTime()
    })
    return result
  }, [messages, contactsMap])

  const handleUnspam = async (contactId: number) => {
    try {
      await contactApi.update(contactId, { life_sphere: 'personal', folder_id: null })
      showToast('Контакт возвращён из спама', 'success')
      spamQuery.refetch()
    } catch {
      showToast('Ошибка', 'error')
    }
  }

  if (!open) return null

  const title = type === 'spam' ? 'Спам' : 'Лента'
  const Icon = ShieldAlert

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      <div className="absolute inset-0 bg-black/40" role="button" tabIndex={0} onClick={onClose} onKeyDown={(e) => e.key === 'Enter' && onClose()} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {chats.length > 0 && (
              <span className="text-sm text-gray-400">{chats.length}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {!loaded ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">
                Помеченные как спам диалоги
              </p>
              <Button onClick={handleLoad} disabled={loadingSpam}>
                {loadingSpam ? 'Загрузка...' : 'Загрузить'}
              </Button>
            </div>
          ) : isLoading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Загрузка...</p>
            </div>
          ) : chats.length === 0 ? (
            <Card>
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Нет спам-диалогов</p>
              </div>
            </Card>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.contact.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 bg-white"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {displayNameShort(chat.contact)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 truncate mt-0.5">
                    {chat.lastMessage.content}
                  </p>
                  <span className="text-xs text-gray-400">
                    {formatRelativeTime(chat.lastMessage.created_at)}
                  </span>
                </div>
                <Button size="sm" variant="secondary" onClick={() => handleUnspam(chat.contact.id)}>
                  Не спам
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
