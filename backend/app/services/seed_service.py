import logging

from sqlalchemy import text
from sqlalchemy.engine import Connection

logger = logging.getLogger(__name__)


def seed_default_owner(conn: Connection) -> None:
    """Дефолтный владелец (идемпотентно по id).

    Если users.id=1 уже существует — ничего не делаем: логин обновляется
    позже в onboarding_complete / get_current_user под активного пользователя.
    """
    existing = conn.execute(
        text("SELECT username FROM users WHERE id = 1")
    ).fetchone()
    if existing is not None:
        return

    conn.execute(
        text(
            "INSERT INTO users (id, username, password_hash, is_active) "
            "VALUES (1, 'owner', '', 1)"
        )
    )


def _column_exists(conn: Connection, table: str, column: str) -> bool:
    """Проверяет наличие колонки в таблице (для схем-независимого сида)."""
    rows = conn.execute(text(f'PRAGMA table_info("{table}")')).fetchall()
    return any(row[1] == column for row in rows)


def seed_default_folders(conn: Connection) -> None:
    """Системные папки контактов BiziBox (идемпотентно по category_key).

    Таксономия: папки привязаны к сфере (life_sphere), категории каналов
    выделены category_key='channels' в каждой сфере.

    Схема-зависимый сид:
    - есть колонка sphere (новая схема, init_db) — новая таксономия со сферами;
    - иначе (initial-миграция, колонки ещё нет) — исходные системные папки
      без contact_type/sphere: сид выполняется в момент создания таблицы,
      до добавления под-колонок таксономии.
    """
    if _column_exists(conn, "contact_folders", "sphere"):
        defaults = [
            ("Семья", "#ec4899", 1, "family", "personal"),
            ("Друзья", "#8b5cf6", 2, "friends", "personal"),
            ("Учёба", "#6366f1", 3, "study", "personal"),
            ("Каналы", "#0ea5e9", 4, "channels", "personal"),
            ("Заказчики", "#f59e0b", 1, "customers", "work"),
            ("Поставщики", "#10b981", 2, "suppliers", "work"),
            ("Партнёры", "#3b82f6", 3, "partners", "work"),
            ("Подрядчики", "#8b5cf6", 4, "contractors", "work"),
            ("Сотрудники", "#ef4444", 5, "employees", "work"),
            ("Каналы", "#0ea5e9", 6, "channels", "work"),
        ]
        for name, color, sort_order, category_key, sphere in defaults:
            conn.execute(
                text(
                    "INSERT OR IGNORE INTO contact_folders "
                    "(owner_id, name, color, sort_order, is_default, category_key, sphere) "
                    "VALUES (1, :name, :color, :sort_order, 1, :category_key, :sphere)"
                ),
                {
                    "name": name,
                    "color": color,
                    "sort_order": sort_order,
                    "category_key": category_key,
                    "sphere": sphere,
                },
            )
        return

    legacy = [
        ("Семья", "#ec4899", 1, "family"),
        ("Друзья", "#8b5cf6", 2, "friends"),
        ("Группы", "#6366f1", 3, "groups"),
        ("Сервисы", "#f59e0b", 4, "service"),
        ("Каналы", "#0ea5e9", 5, "channels"),
    ]
    for name, color, sort_order, category_key in legacy:
        conn.execute(
            text(
                "INSERT OR IGNORE INTO contact_folders "
                "(owner_id, name, color, sort_order, is_default, category_key) "
                "VALUES (1, :name, :color, :sort_order, 1, :category_key)"
            ),
            {
                "name": name,
                "color": color,
                "sort_order": sort_order,
                "category_key": category_key,
            },
        )


def seed_default_type_templates(conn: Connection) -> None:
    """Системные шаблоны типов контактов (идемпотентно по slug).

    Проверка существования таблицы — безопасный no-op на старых схемах.
    """
    if not _column_exists(conn, "contact_type_templates", "id"):
        return
    defaults = [
        ("personal", "Друзья", "friends", 1),
        ("personal", "Семья", "family", 2),
        ("personal", "Учёба", "study", 3),
        ("work", "Клиент", "client", 1),
        ("work", "Поставщик", "supplier", 2),
        ("work", "Партнёр", "partner", 3),
        ("work", "Подрядчик", "contractor", 4),
        ("work", "Сотрудник", "employee", 5),
    ]
    for sphere, name, slug, sort_order in defaults:
        conn.execute(
            text(
                "INSERT OR IGNORE INTO contact_type_templates "
                "(owner_id, sphere, name, slug, sort_order, is_custom, is_system) "
                "VALUES (1, :sphere, :name, :slug, :sort_order, 0, 1)"
            ),
            {
                "sphere": sphere,
                "name": name,
                "slug": slug,
                "sort_order": sort_order,
            },
        )
