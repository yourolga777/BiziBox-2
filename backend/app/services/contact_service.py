import csv
import io
import re
from typing import Any, List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import DEFAULT_OWNER_ID
from ..models import (
    ContactModel,
    ContactNoteModel,
    ContactTypeTemplateModel,
    MessageModel,
    TaskModel,
    contact_contact_type_association,
)
from ..repositories.contact import ContactRepository
from ..repositories.contact_folder import ContactFolderRepository
from ..schemas.contact import (
    ContactCreate,
    ContactResponse,
    ContactTypeTemplateCreate,
    ContactTypeTemplateResponse,
    ContactTypeTemplateUpdate,
    ContactUpdate,
    NoteCreate,
    NoteResponse,
    TimelineEvent,
)

_SLUG_OVERRIDES = {"ё": "e", "й": "i", "ь": "", "ъ": ""}


def _slugify(value: str) -> str:
    import unicodedata

    value = value.strip().lower()
    latin = unicodedata.normalize("NFKD", value)
    latin = latin.encode("ascii", "ignore").decode("ascii")
    for src, dst in _SLUG_OVERRIDES.items():
        latin = latin.replace(src, dst)
    slug = re.sub(r"[^a-z0-9]+", "-", latin).strip("-")
    return slug or "type"


class ContactService:
    def __init__(self, session: AsyncSession, owner_id: Optional[int] = None):
        self.session = session
        self.owner_id = owner_id
        self.contact_repo = ContactRepository(session, owner_id)

    async def get_all(
        self,
        search: Optional[str] = None,
        channel: Optional[str] = None,
        subsection: Optional[str] = None,
        life_sphere: Optional[str] = None,
        contact_type_ids: Optional[List[int]] = None,
        folder_id: Optional[int] = None,
        is_favorite: Optional[bool] = None,
        sort_by: str = "name",
        sort_order: str = "asc",
        skip: int = 0,
        limit: Optional[int] = None,
    ) -> List[ContactResponse]:
        contacts = await self.contact_repo.get_all(
            search=search,
            channel=channel,
            subsection=subsection,
            life_sphere=life_sphere,
            contact_type_ids=contact_type_ids,
            folder_id=folder_id,
            is_favorite=is_favorite,
            sort_by=sort_by,
            sort_order=sort_order,
            skip=skip,
            limit=limit,
        )
        return await self._enrich_contacts(contacts)

    async def get_deleted(
        self, skip: int = 0, limit: int = 100
    ) -> List[ContactResponse]:
        contacts = await self.contact_repo.get_deleted(skip=skip, limit=limit)
        return await self._enrich_contacts(contacts)

    async def get_by_id(self, contact_id: int) -> Optional[ContactResponse]:
        contact = await self.contact_repo.get_by_id(contact_id)
        if not contact:
            return None
        return await self._to_response(contact)

    async def _validate_folder(
        self, folder_id: Optional[int], life_sphere: Optional[str] = None
    ) -> None:
        if folder_id is None:
            return
        folder_repo = ContactFolderRepository(self.session, self.owner_id)
        folder = await folder_repo.get_by_id(int(folder_id))
        if folder is None:
            raise ValueError("Folder not found")
        if folder.sphere is not None and life_sphere is not None:
            if folder.sphere != life_sphere:
                raise ValueError(
                    f"Folder '{folder.name}' belongs to sphere "
                    f"'{folder.sphere}', not '{life_sphere}'"
                )

    async def create(self, data: ContactCreate) -> ContactResponse:
        create_dict = data.model_dump(exclude_unset=True)
        contact_type_ids = create_dict.pop("contact_type_ids", None)
        await self._validate_folder(
            create_dict.get("folder_id"),
            create_dict.get("life_sphere"),
        )
        contact = await self.contact_repo.create(**create_dict)
        if contact_type_ids:
            await self.contact_repo.set_contact_types(
                int(contact.id), contact_type_ids
            )
            refreshed = await self.contact_repo.get_by_id(int(contact.id))
            if refreshed is None:
                raise ValueError("Contact not found after creating type associations")
            contact = refreshed
        return await self._to_response(contact)

    async def update(
        self, contact_id: int, data: ContactUpdate
    ) -> Optional[ContactResponse]:
        update_dict = data.model_dump(exclude_unset=True)
        contact_type_ids = update_dict.pop("contact_type_ids", None)
        final_sphere = update_dict.get("life_sphere")
        if final_sphere is None:
            final_sphere = await self._get_contact_sphere(contact_id)
        await self._validate_folder(update_dict.get("folder_id"), final_sphere)
        contact = await self.contact_repo.update(
            contact_id,
            **update_dict,
        )
        if not contact:
            return None
        if contact_type_ids is not None:
            await self.contact_repo.set_contact_types(contact_id, contact_type_ids)
            contact = await self.contact_repo.get_by_id(contact_id)
            assert contact is not None
        return await self._to_response(contact)

    async def set_spam(self, contact_id: int, spam: bool) -> Optional[ContactResponse]:
        contact = await self.contact_repo.get_by_id(contact_id)
        if not contact:
            return None
        update_data: dict[str, object] = {}
        if spam:
            if contact.life_sphere != "spam":
                update_data = {
                    "life_sphere": "spam",
                    "previous_life_sphere": contact.life_sphere,
                    "folder_id": None,
                }
        else:
            if contact.life_sphere == "spam":
                update_data = {
                    "life_sphere": contact.previous_life_sphere,
                    "previous_life_sphere": None,
                }
        if update_data:
            await self.contact_repo.update(contact_id, **update_data)
        result = await self.contact_repo.get_by_id(contact_id)
        if result is None:
            return None
        return await self._to_response(result)

    async def _get_contact_sphere(self, contact_id: int) -> Optional[str]:
        query = select(ContactModel.life_sphere).where(ContactModel.id == contact_id)
        if self.owner_id is not None:
            query = query.where(ContactModel.owner_id == self.owner_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def append_fields(
        self, contact_id: int, data: ContactUpdate,
    ) -> Optional[ContactResponse]:
        contact = await self.contact_repo.get_by_id(contact_id)
        if not contact:
            return None
        update_dict = data.model_dump(exclude_unset=True)
        append_dict: dict[str, Any] = {}
        for key, value in update_dict.items():
            existing = getattr(contact, key, None)
            if value is not None and (existing is None or existing == ''):
                append_dict[key] = value
        if append_dict:
            await self.contact_repo.update(contact_id, **append_dict)
        result = await self.contact_repo.get_by_id(contact_id)
        if result is None:
            return None
        return await self._to_response(result)

    async def delete(self, contact_id: int) -> bool:
        return await self.contact_repo.soft_delete(contact_id)

    async def permanent_delete(self, contact_id: int) -> bool:
        contact = await self.contact_repo.get_by_id(contact_id)
        if not contact:
            return False
        name = contact.name or ""
        updates: dict[str, object] = {
            "telegram_id": None,
            "email": None,
            "telegram_username": None,
        }
        if name.isdigit():
            updates["name"] = "Контакт (удалён)"
        await self.contact_repo.update(contact_id, **updates)
        return await self.contact_repo.soft_delete(contact_id)

    async def restore(self, contact_id: int) -> Optional[ContactResponse]:
        contact = await self.contact_repo.restore(contact_id)
        if not contact:
            return None
        return await self._to_response(contact)

    async def merge(self, primary_id: int, secondary_id: int) -> Optional[ContactResponse]:
        if primary_id == secondary_id:
            return None

        primary = await self.contact_repo.get_by_id(primary_id)
        secondary = await self.contact_repo.get_by_id(secondary_id)
        if not primary or not secondary:
            return None

        update_data: dict[str, object] = {}
        conflicting: list[str] = []

        def _fill(field: str, label: str) -> None:
            pv = getattr(primary, field)
            sv = getattr(secondary, field)
            if sv in (None, ""):
                return
            if pv in (None, ""):
                update_data[field] = sv
            elif pv != sv:
                conflicting.append(f"{label}: {sv}")

        _fill("name", "Имя")
        _fill("phone", "Телефон")
        _fill("email", "Email")
        _fill("telegram_id", "Telegram ID")
        _fill("telegram_username", "Telegram @")
        if secondary.birthday is not None:
            if primary.birthday is None:
                update_data["birthday"] = secondary.birthday
            elif primary.birthday != secondary.birthday:
                conflicting.append(f"День рождения: {secondary.birthday.isoformat()}")

        if secondary.notes:
            if not (primary.notes or "").strip():
                update_data["notes"] = secondary.notes
            elif secondary.notes.strip() not in (primary.notes or ""):
                conflicting.append(f"Заметки: {secondary.notes.strip()}")

        update_data["is_known"] = bool(primary.is_known or secondary.is_known)
        update_data["is_favorite"] = bool(
            primary.is_favorite or secondary.is_favorite
        )
        if secondary.life_sphere == "spam" and primary.life_sphere != "spam":
            update_data["life_sphere"] = "spam"

        if conflicting:
            merged_notes = (primary.notes or "").strip()
            if merged_notes:
                merged_notes += "\n\n"
            merged_notes += "Объединённые данные:\n" + "\n".join(
                f"- {line}" for line in conflicting
            )
            update_data["notes"] = merged_notes

        # Освобождаем уникальные идентификаторы вторичного контакта ДО обновления
        # основного, чтобы не нарушить уникальные индексы (telegram_id, email).
        await self.contact_repo.update(
            secondary_id,
            telegram_id=None,
            telegram_username=None,
            email=None,
        )

        await self.contact_repo.update(primary_id, **update_data)
        primary = await self.contact_repo.get_by_id(primary_id)
        assert primary is not None

        await self._transfer_messages(secondary_id, primary_id)
        await self._transfer_tasks(secondary_id, primary_id)

        await self.contact_repo.soft_delete(secondary_id)

        return await self._to_response(primary)

    async def bulk_merge(self, primary_id: int, secondary_ids: List[int]) -> Optional[ContactResponse]:
        for sid in secondary_ids:
            await self.merge(primary_id, sid)
        return await self.get_by_id(primary_id)

    async def bulk_delete(self, ids: List[int]) -> int:
        count = 0
        for cid in ids:
            if await self.contact_repo.soft_delete(cid):
                count += 1
        return count

    async def bulk_restore(self, ids: List[int]) -> int:
        count = 0
        for cid in ids:
            if await self.contact_repo.restore(cid):
                count += 1
        return count

    async def _transfer_messages(self, from_id: int, to_id: int) -> None:
        await self.session.execute(
            MessageModel.__table__.update()  # type: ignore[attr-defined]
            .where(MessageModel.contact_id == from_id)
            .values(contact_id=to_id)
        )
        await self.session.flush()

    async def _transfer_tasks(self, from_id: int, to_id: int) -> None:
        await self.session.execute(
            TaskModel.__table__.update()  # type: ignore[attr-defined]
            .where(TaskModel.contact_id == from_id)
            .values(contact_id=to_id)
        )
        await self.session.flush()

    async def get_timeline(self, contact_id: int) -> list[TimelineEvent]:
        events: list[TimelineEvent] = []

        msg_query = (
            select(MessageModel)
            .where(MessageModel.contact_id == contact_id)
        )
        if self.owner_id is not None:
            msg_query = msg_query.where(
                MessageModel.owner_id == self.owner_id
            )
        msgs = await self.session.execute(
            msg_query.order_by(MessageModel.created_at.desc()).limit(20)
        )
        for m in msgs.scalars().all():
            direction = "📤" if m.direction == "outgoing" else "📥"
            events.append(TimelineEvent(
                type="message",
                title=f"{direction} Сообщение ({m.channel})",
                subtitle=((m.content or "")[:100]),
                created_at=m.created_at,
                link=f"/inbox?contact_id={contact_id}",
            ))

        task_query = (
            select(TaskModel)
            .where(TaskModel.contact_id == contact_id)
        )
        if self.owner_id is not None:
            task_query = task_query.where(TaskModel.owner_id == self.owner_id)
        tasks = await self.session.execute(
            task_query.order_by(TaskModel.created_at.desc()).limit(10)
        )
        for t in tasks.scalars().all():
            events.append(TimelineEvent(
                type="task",
                title=f"Задача: {t.title or 'Без названия'}",
                subtitle=f"Статус: {t.status or 'новая'}",
                created_at=t.created_at,
                link=f"/tasks?contact_id={contact_id}",
            ))

        return sorted(events, key=lambda e: e.created_at or "", reverse=True)[:30]

    async def get_notes(self, contact_id: int) -> list[NoteResponse]:
        query = select(ContactNoteModel).where(
            ContactNoteModel.contact_id == contact_id
        )
        if self.owner_id is not None:
            query = query.where(ContactNoteModel.owner_id == self.owner_id)
        result = await self.session.execute(
            query.order_by(ContactNoteModel.created_at.desc())
        )
        return [NoteResponse.model_validate(n) for n in result.scalars().all()]

    async def create_note(self, contact_id: int, data: NoteCreate) -> Optional[NoteResponse]:
        contact = await self.contact_repo.get_by_id(contact_id)
        if not contact:
            return None
        note = ContactNoteModel(
            contact_id=contact_id,
            content=data.content,
            author=data.author,
            owner_id=(
                self.owner_id if self.owner_id is not None else DEFAULT_OWNER_ID
            ),
        )
        self.session.add(note)
        await self.session.flush()
        return NoteResponse.model_validate(note)

    async def delete_note(self, note_id: int) -> bool:
        query = select(ContactNoteModel).where(ContactNoteModel.id == note_id)
        if self.owner_id is not None:
            query = query.where(ContactNoteModel.owner_id == self.owner_id)
        result = await self.session.execute(query)
        note = result.scalar_one_or_none()
        if not note:
            return False
        await self.session.delete(note)
        await self.session.flush()
        return True

    async def export_csv(self, ids: Optional[list[int]] = None) -> str:
        query = select(ContactModel).where(ContactModel.deleted_at.is_(None))
        if self.owner_id is not None:
            query = query.where(ContactModel.owner_id == self.owner_id)
        if ids:
            query = query.where(ContactModel.id.in_(ids))
        result = await self.session.execute(query.order_by(ContactModel.name))
        contacts = result.scalars().all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "id", "name", "phone", "email", "telegram_username",
            "is_known", "notes", "created_at",
        ])
        for c in contacts:
            writer.writerow([
                c.id, c.name, c.phone, c.email, c.telegram_username,
                int(c.is_known), c.notes, c.created_at,
            ])
        return output.getvalue()

    async def import_csv(self, content: str) -> dict[str, int]:
        reader = csv.DictReader(io.StringIO(content))
        created = 0
        updated = 0
        for row in reader:
            name = row.get("name", "").strip()
            phone = row.get("phone", "").strip() or None
            email = row.get("email", "").strip() or None
            if not name and not phone and not email:
                continue

            existing = None
            if phone:
                q = select(ContactModel).where(ContactModel.phone == phone)
                if self.owner_id is not None:
                    q = q.where(ContactModel.owner_id == self.owner_id)
                existing = (await self.session.execute(q)).scalar_one_or_none()
            if not existing and email:
                q = select(ContactModel).where(ContactModel.email == email)
                if self.owner_id is not None:
                    q = q.where(ContactModel.owner_id == self.owner_id)
                existing = (await self.session.execute(q)).scalar_one_or_none()

            if existing:
                update_data: dict[str, object] = {}
                if name and not existing.name:
                    update_data["name"] = name
                if phone and not existing.phone:
                    update_data["phone"] = phone
                if email and not existing.email:
                    update_data["email"] = email
                if update_data:
                    await self.contact_repo.update(int(existing.id), **update_data)
                updated += 1
            else:
                await self.contact_repo.create(
                    name=name,
                    phone=phone,
                    email=email,
                )
                created += 1

        return {"created": created, "updated": updated}

    async def bulk_update(self, ids: list[int], **fields: object) -> int:
        count = 0
        for cid in ids:
            result = await self.contact_repo.update(cid, **fields)
            if result:
                count += 1
        return count

    async def get_type_templates(
        self, sphere: Optional[str] = None
    ) -> List[ContactTypeTemplateResponse]:
        query = select(ContactTypeTemplateModel)
        if self.owner_id is not None:
            query = query.where(
                ContactTypeTemplateModel.owner_id == self.owner_id
            )
        if sphere:
            query = query.where(ContactTypeTemplateModel.sphere == sphere)
        query = query.order_by(
            ContactTypeTemplateModel.sort_order, ContactTypeTemplateModel.name
        )
        result = await self.session.execute(query)
        return [
            ContactTypeTemplateResponse.model_validate(t)
            for t in result.scalars().all()
        ]

    async def create_type_template(
        self, data: ContactTypeTemplateCreate
    ) -> ContactTypeTemplateResponse:
        slug = _slugify(data.name)
        existing: Optional[ContactTypeTemplateModel] = None
        if self.owner_id is not None:
            result = await self.session.execute(
                select(ContactTypeTemplateModel).where(
                    ContactTypeTemplateModel.owner_id == self.owner_id,
                    ContactTypeTemplateModel.slug == slug,
                )
            )
            existing = result.scalar_one_or_none()
        if existing:
            raise ValueError("Type with this name already exists")
        template = ContactTypeTemplateModel(
            owner_id=self.owner_id or DEFAULT_OWNER_ID,
            sphere=data.sphere,
            name=data.name,
            slug=slug,
            is_custom=True,
            is_system=False,
        )
        self.session.add(template)
        await self.session.flush()
        return ContactTypeTemplateResponse.model_validate(template)

    async def update_type_template(
        self, template_id: int, data: ContactTypeTemplateUpdate
    ) -> Optional[ContactTypeTemplateResponse]:
        update_dict = data.model_dump(exclude_unset=True)
        template = await self._get_template(template_id)
        if template is None:
            return None
        for key, value in update_dict.items():
            setattr(template, key, value)
        await self.session.flush()
        return ContactTypeTemplateResponse.model_validate(template)

    async def delete_type_template(self, template_id: int) -> bool:
        template = await self._get_template(template_id)
        if template is None:
            return False
        if template.is_system:
            raise ValueError("Cannot delete system template")
        await self.session.delete(template)
        await self.session.flush()
        return True

    async def _get_template(
        self, template_id: int
    ) -> Optional[ContactTypeTemplateModel]:
        query = select(ContactTypeTemplateModel).where(
            ContactTypeTemplateModel.id == template_id
        )
        if self.owner_id is not None:
            query = query.where(ContactTypeTemplateModel.owner_id == self.owner_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_duplicates(self, contact_id: int | None = None) -> list[dict[str, object]]:

        query = select(ContactModel).where(
            ContactModel.deleted_at.is_(None),
            ContactModel.email.is_not(None),
        )
        if self.owner_id is not None:
            query = query.where(ContactModel.owner_id == self.owner_id)
        result = await self.session.execute(query)
        contacts = list(result.scalars().all())

        seen_emails: dict[str, list[ContactModel]] = {}
        seen_phones: dict[str, list[ContactModel]] = {}
        for c in contacts:
            if c.email:
                key = c.email.strip().lower()
                seen_emails.setdefault(key, []).append(c)
            if c.phone:
                key = c.phone.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
                if len(key) >= 7:
                    seen_phones.setdefault(key, []).append(c)

        groups: list[dict[str, object]] = []
        for key, dups in {**seen_emails, **seen_phones}.items():
            if len(dups) < 2:
                continue
            resp_list = [await self._to_response(c) for c in dups]
            if contact_id and not any(c.id == contact_id for c in dups):
                continue
            groups.append({
                "reason": ", ".join(
                    str(c.email or c.phone or "") for c in dups if c.email or c.phone
                ),
                "contacts": resp_list,
            })

        return groups

    async def _enrich_contacts(self, contacts: list[ContactModel]) -> list[ContactResponse]:
        if not contacts:
            return []
        ids = [c.id for c in contacts]

        msg_rows = await self.session.execute(
            select(MessageModel.contact_id, func.count().label("cnt"))
            .where(MessageModel.contact_id.in_(ids))
            .group_by(MessageModel.contact_id)
        )
        msg_map = {cid: cnt for cid, cnt in msg_rows.all()}

        task_rows = await self.session.execute(
            select(TaskModel.contact_id, func.count().label("cnt"))
            .where(TaskModel.contact_id.in_(ids))
            .group_by(TaskModel.contact_id)
        )
        task_map = {cid: cnt for cid, cnt in task_rows.all()}

        last_msg_rows = await self.session.execute(
            select(
                MessageModel.contact_id,
                func.max(MessageModel.created_at),
            )
            .where(MessageModel.contact_id.in_(ids))
            .group_by(MessageModel.contact_id)
        )
        last_msg_map = {cid: ts for cid, ts in last_msg_rows.all()}

        type_rows = await self.session.execute(
            select(
                contact_contact_type_association.c.contact_id,
                ContactTypeTemplateModel.name,
                ContactTypeTemplateModel.id,
            )
            .join(
                ContactTypeTemplateModel,
                contact_contact_type_association.c.template_id
                == ContactTypeTemplateModel.id,
            )
            .where(
                contact_contact_type_association.c.contact_id.in_(ids),
                contact_contact_type_association.c.owner_id
                == self.owner_id,
            )
        )
        type_names: dict[int, list[str]] = {}
        type_ids_map: dict[int, list[int]] = {}
        for cid, name, tid in type_rows.all():
            type_names.setdefault(cid, []).append(name)
            type_ids_map.setdefault(cid, []).append(tid)

        responses = []
        for contact in contacts:
            cid = int(contact.id) if contact.id is not None else 0
            resp = ContactResponse.model_validate(
                {
                    c.name: getattr(contact, c.name)
                    for c in ContactModel.__table__.columns
                }
            )

            resp.message_count = msg_map.get(cid, 0)
            resp.task_count = task_map.get(cid, 0)

            channels: list[str] = []
            if contact.telegram_id:
                channels.append("telegram")
            if contact.email:
                channels.append("email")
            resp.channel_types = channels

            resp.last_message_at = last_msg_map.get(cid)

            resp.contact_types = type_names.get(cid, [])
            resp.contact_type_ids = type_ids_map.get(cid, [])

            responses.append(resp)

        return responses

    async def _to_response(self, contact: ContactModel) -> ContactResponse:
        resp = ContactResponse.model_validate(
            {c.name: getattr(contact, c.name) for c in ContactModel.__table__.columns}
        )

        msg_count = await self.session.execute(
            select(func.count()).where(MessageModel.contact_id == contact.id)
        )
        resp.message_count = msg_count.scalar() or 0

        task_count = await self.session.execute(
            select(func.count()).where(TaskModel.contact_id == contact.id)
        )
        resp.task_count = task_count.scalar() or 0

        channels: list[str] = []
        if contact.telegram_id:
            channels.append("telegram")
        if contact.email:
            channels.append("email")
        resp.channel_types = channels

        last_msg = await self.session.execute(
            select(func.max(MessageModel.created_at)).where(
                MessageModel.contact_id == contact.id
            )
        )
        resp.last_message_at = last_msg.scalar()

        type_slugs = await self.contact_repo.get_contact_type_slugs(int(contact.id))
        resp.contact_types = type_slugs

        type_ids = await self.session.execute(
            select(ContactTypeTemplateModel.id)
            .join(
                contact_contact_type_association,
                contact_contact_type_association.c.template_id
                == ContactTypeTemplateModel.id,
            )
            .where(
                contact_contact_type_association.c.contact_id == contact.id,
                contact_contact_type_association.c.owner_id == self.owner_id,
            )
        )
        resp.contact_type_ids = [int(t) for t in type_ids.scalars().all()]

        return resp
