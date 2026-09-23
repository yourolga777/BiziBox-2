# BiziBox

**BiziBox** — личное PWA-приложение «сообщения и дела в одном окне». Локальное, приватное: все данные хранятся на вашем устройстве в зашифрованном SQLite.

Объединяет Telegram и Email в один inbox, ведёт контакты с типами и папками, управляет задачами и календарём, напоминает о делах и днях рождения.

## Возможности

- **Входящие** — сообщения из Telegram и Email в одном inbox; папки, каналы, типы контактов, спам.
- **Контакты** — типы (личные / сервисные / спам / прочее), папки, заметки, дни рождения, объединение дублей.
- **Задачи** — канбан (новые / в работе / выполнено), дедлайны, напоминания, повторяющиеся задачи.
- **Календарь** — задачи, события и дни рождения; виды месяц / неделя / день.
- **Напоминания** — фоновый scheduler по задачам.
- **Безопасность** — локальные данные (SQLite + Fernet-шифрование), ничего не уходит в облако.
- **Бэкап** — экспорт/импорт всех данных одним зашифрованным файлом.
- **PWA** — работает офлайн, устанавливается на телефон.

## Установка

1. Скачайте `BiziBox.exe` со [страницы релизов](https://github.com/yourolga777/BiziBox/releases/latest).
2. Поместите файл в любую папку (например, `D:\BiziBox`) и запустите.
3. Приложение запустится в фоне и откроет браузер; в системном трее появится иконка **BiziBox** («Открыть BiziBox» / «Выход»).

Подробная инструкция — в [руководстве пользователя](docs/user-guide.md).

## Стек

- **Backend:** Python 3.13, FastAPI, SQLAlchemy 2.0 (async), SQLite, Alembic
- **Frontend:** React 19, TypeScript 5.6+, Vite 6, Tailwind CSS 4, PWA (vite-plugin-pwa)
- **Проверки:** pytest, ruff, mypy, ESLint, Vitest

## Запуск для разработки

```powershell
# Backend (dev)
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --port 7910

# Frontend (dev, прокси /api -> localhost:7910)
cd frontend
npm install
npm run dev
```

Откройте `http://localhost:5173`.

## Проверки

```powershell
# Backend
cd backend
.venv\Scripts\ruff.exe check .
.venv\Scripts\python.exe -m pytest tests -q
backend\.venv\Scripts\mypy.exe backend

# Frontend
cd frontend
npm run lint
npm test
npm run build
```

## Документация

- [Руководство пользователя](docs/user-guide.md)
- [Архитектура](docs/architecture.md)
- [Описание продукта](docs/product_description.md)
