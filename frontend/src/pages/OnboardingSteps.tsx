import { useState } from 'react'
import { MessageSquare, Globe, Shield, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { EMAIL_PROVIDERS } from '../utils/emailProviders'

export type StepData = {
  login: string
  telegram: { api_id: string; api_hash: string; phone: string; password_2fa: string; useCustomApi: boolean }
  email: { email: string; password: string; imap_host: string; smtp_host: string; imap_port: number; smtp_port: number }
  proxy: { type: string; host: string; port: string; username: string; password: string; secret: string; useCustomProxy: boolean }
}

export type UpdateData = (section: keyof StepData, field: string, value: string | number | boolean) => void

interface StepProps {
  data: StepData
  updateData: UpdateData
  expanded: boolean
  setExpanded: (value: boolean) => void
  serverProxy?: string
}

export function isValidLogin(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed.length <= 100
}

export function TelegramStep({ data, updateData, expanded, setExpanded }: StepProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-100 rounded-lg">
          <MessageSquare className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Подключение Telegram</h2>
          <p className="text-sm text-gray-500">Введите номер телефона для подключения</p>
        </div>
      </div>
      <div>
        <label htmlFor="login" className="block text-sm font-medium text-gray-700 mb-1">
          Логин <span className="text-red-500">*</span>
        </label>
        <input
          id="login"
          type="text"
          value={data.login}
          onChange={e => updateData('login', 'value', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          placeholder="your_login"
        />
        {!isValidLogin(data.login) && (
          <p className="text-xs text-red-500 mt-1">Введите логин длиной от 1 до 100 символов</p>
        )}
      </div>
      <div>
        <label htmlFor="tg-phone" className="block text-sm font-medium text-gray-700 mb-1">Номер телефона</label>
        <input
          id="tg-phone"
          type="tel" value={data.telegram.phone}
          onChange={e => updateData('telegram', 'phone', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          placeholder="+79991234567"
        />
      </div>
      <div>
        <label htmlFor="tg-2fa" className="block text-sm font-medium text-gray-700 mb-1">Пароль 2FA (если включена)</label>
        <input
          id="tg-2fa"
          type="password"
          value={data.telegram.password_2fa}
          onChange={e => updateData('telegram', 'password_2fa', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          placeholder="Пароль двухфакторной аутентификации"
        />
      </div>
      <div className="border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={() => {
            setExpanded(!expanded)
            updateData('telegram', 'useCustomApi', !expanded)
          }}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Использовать свои API ID и Hash
        </button>
        {expanded && (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-gray-400">Оставьте пустыми, чтобы использовать серверные настройки.</p>
            <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
              Где взять: <span className="font-mono">my.telegram.org</span> → «API development tools» → создайте приложение. API ID и API Hash появятся на странице приложения.
            </p>
            <div>
              <label htmlFor="tg-api-id" className="block text-sm font-medium text-gray-700 mb-1">API ID</label>
              <input
                id="tg-api-id"
                type="text" value={data.telegram.api_id}
                onChange={e => updateData('telegram', 'api_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="123456"
              />
            </div>
            <div>
              <label htmlFor="tg-api-hash" className="block text-sm font-medium text-gray-700 mb-1">API Hash</label>
              <input
                id="tg-api-hash"
                type="text" value={data.telegram.api_hash}
                onChange={e => updateData('telegram', 'api_hash', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="abc123def456..."
              />
            </div>
            {(data.telegram.api_id || data.telegram.api_hash) && (
              <button
                type="button"
                onClick={() => {
                  updateData('telegram', 'api_id', '')
                  updateData('telegram', 'api_hash', '')
                }}
                className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
              >
                Вернуть серверные настройки
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function EmailStep({ data, updateData }: { data: StepData; updateData: UpdateData }) {
  const [provider, setProvider] = useState('')

  const applyProvider = (key: string) => {
    setProvider(key)
    const p = EMAIL_PROVIDERS[key]
    if (p) {
      updateData('email', 'imap_host', p.imap_host)
      updateData('email', 'imap_port', p.imap_port)
      updateData('email', 'smtp_host', p.smtp_host)
      updateData('email', 'smtp_port', p.smtp_port)
    }
  }

  const selectedProvider = EMAIL_PROVIDERS[provider]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-green-100 rounded-lg">
          <Globe className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Подключение Email</h2>
          <p className="text-sm text-gray-500">Используйте пароль приложения для безопасности</p>
        </div>
      </div>
      <div>
        <label htmlFor="email-provider" className="block text-sm font-medium text-gray-700 mb-1">Провайдер</label>
        <select
          id="email-provider"
          value={provider}
          onChange={e => applyProvider(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">— Выберите почтовый сервис —</option>
          {Object.entries(EMAIL_PROVIDERS).map(([key, p]) => (
            <option key={key} value={key}>{p.label}</option>
          ))}
          <option value="__custom__">Свой вариант (ввести вручную)</option>
        </select>
        <p className="text-xs text-gray-400 mt-1">
          Хост и порты заполнятся автоматически. Для «Свой вариант» оставьте поле пустым и введите параметры вручную.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label htmlFor="email-addr" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            id="email-addr"
            type="email" value={data.email.email}
            onChange={e => updateData('email', 'email', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="email@example.com"
          />
        </div>
        <div className="col-span-2">
          <label htmlFor="email-pass" className="block text-sm font-medium text-gray-700 mb-1">Пароль приложения</label>
          <input
            id="email-pass"
            type="password" value={data.email.password}
            onChange={e => updateData('email', 'password', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="Пароль приложения"
          />
          <p className="text-xs text-gray-400 mt-1">
            Это не обычный пароль от почты: в настройках безопасности почты создаётся отдельный «пароль приложения».
          </p>
          {selectedProvider?.app_password_url && (
            <a
              href={selectedProvider.app_password_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 mt-1"
            >
              Где взять пароль приложения для {selectedProvider.label} <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        <div>
          <label htmlFor="email-imap-host" className="block text-sm font-medium text-gray-700 mb-1">IMAP хост</label>
          <input
            id="email-imap-host"
            type="text" value={data.email.imap_host}
            onChange={e => updateData('email', 'imap_host', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="imap.example.com"
          />
        </div>
        <div>
          <label htmlFor="email-imap-port" className="block text-sm font-medium text-gray-700 mb-1">IMAP порт</label>
          <input
            id="email-imap-port"
            type="number" value={data.email.imap_port}
            onChange={e => updateData('email', 'imap_port', Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="993"
          />
        </div>
        <div>
          <label htmlFor="email-smtp-host" className="block text-sm font-medium text-gray-700 mb-1">SMTP хост</label>
          <input
            id="email-smtp-host"
            type="text" value={data.email.smtp_host}
            onChange={e => updateData('email', 'smtp_host', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="smtp.example.com"
          />
        </div>
        <div>
          <label htmlFor="email-smtp-port" className="block text-sm font-medium text-gray-700 mb-1">SMTP порт</label>
          <input
            id="email-smtp-port"
            type="number" value={data.email.smtp_port}
            onChange={e => updateData('email', 'smtp_port', Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="465"
          />
        </div>
      </div>
    </div>
  )
}

export function ProxyStep({ data, updateData, expanded, setExpanded, serverProxy }: StepProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-purple-100 rounded-lg">
          <Shield className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Прокси / VPN</h2>
          <p className="text-sm text-gray-500">Опционально. Если VPN работает на уровне системы — просто пропустите.</p>
        </div>
      </div>
      {serverProxy && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
          Серверный прокси по умолчанию: <span className="font-mono">{serverProxy}</span>
        </p>
      )}
      <div className="border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={() => {
            setExpanded(!expanded)
            updateData('proxy', 'useCustomProxy', !expanded)
          }}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Подключаться через свой прокси / VPN
        </button>
        {expanded && (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
              Прокси нужен только для <b>Telegram</b>: он поддерживает SOCKS5, HTTP и
              MTProto. Если у вас VPN-приложение (v2rayN/Xray/Clash/Happ), укажите его{' '}
              <b>локальный</b> адрес — обычно <span className="font-mono">127.0.0.1:10808</span>,
              а не IP сервера. <b>Email и остальные каналы работают без прокси</b> — для них
              ничего менять не нужно. Настоящий системный VPN (WireGuard/OpenVPN) прокси не
              требует — оставьте этот блок выключенным.
            </p>
            <div>
              <label htmlFor="proxy-type" className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
              <select
                id="proxy-type"
                value={data.proxy.type}
                onChange={e => updateData('proxy', 'type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="socks5">SOCKS5</option>
                <option value="mtproto">MTProto</option>
                <option value="http">HTTP</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="proxy-host" className="block text-sm font-medium text-gray-700 mb-1">Хост</label>
                <input
                  id="proxy-host"
                  type="text" value={data.proxy.host}
                  onChange={e => updateData('proxy', 'host', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="127.0.0.1"
                  autoComplete="off"
                />
              </div>
              <div>
                <label htmlFor="proxy-port" className="block text-sm font-medium text-gray-700 mb-1">Порт</label>
                <input
                  id="proxy-port"
                  type="number" value={data.proxy.port}
                  onChange={e => updateData('proxy', 'port', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="10808"
                  autoComplete="off"
                />
              </div>
            </div>
            {data.proxy.type === 'mtproto' ? (
              <div>
                <label htmlFor="proxy-secret" className="block text-sm font-medium text-gray-700 mb-1">Secret</label>
                <input
                  id="proxy-secret"
                  type="text"
                  value={data.proxy.secret}
                  onChange={e => updateData('proxy', 'secret', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Секретный ключ MTProto-прокси"
                  autoComplete="off"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="proxy-user" className="block text-sm font-medium text-gray-700 mb-1">Логин</label>
                  <input
                    id="proxy-user"
                    type="text" value={data.proxy.username}
                    onChange={e => updateData('proxy', 'username', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="(опционально)"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="proxy-pass" className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
                  <input
                    id="proxy-pass"
                    type="password" value={data.proxy.password}
                    onChange={e => updateData('proxy', 'password', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="(опционально)"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            )}
            {(data.proxy.host || data.proxy.username || data.proxy.password || data.proxy.secret) && (
              <button
                type="button"
                onClick={() => {
                  updateData('proxy', 'host', '')
                  updateData('proxy', 'port', '')
                  updateData('proxy', 'username', '')
                  updateData('proxy', 'password', '')
                  updateData('proxy', 'secret', '')
                }}
                className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
              >
                Очистить поля
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
