from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from ..repositories.contact_folder import ContactFolderRepository
from ..schemas.contact_folder import (
    ContactFolderCreate,
    ContactFolderResponse,
    ContactFolderUpdate,
)


class FolderService:
    def __init__(self, session: AsyncSession, owner_id: Optional[int] = None):
        self.session = session
        self.owner_id = owner_id
        self.folder_repo = ContactFolderRepository(session, owner_id)

    async def get_all(self) -> List[ContactFolderResponse]:
        folders = await self.folder_repo.get_all()
        return [ContactFolderResponse.model_validate(f) for f in folders]

    async def get_by_id(self, folder_id: int) -> Optional[ContactFolderResponse]:
        folder = await self.folder_repo.get_by_id(folder_id)
        if folder is None:
            return None
        return ContactFolderResponse.model_validate(folder)

    async def create(self, data: ContactFolderCreate) -> ContactFolderResponse:
        folder = await self.folder_repo.create(**data.model_dump())
        return ContactFolderResponse.model_validate(folder)

    async def update(
        self, folder_id: int, data: ContactFolderUpdate
    ) -> Optional[ContactFolderResponse]:
        folder = await self.folder_repo.update(
            folder_id, **data.model_dump(exclude_unset=True)
        )
        if folder is None:
            return None
        return ContactFolderResponse.model_validate(folder)

    async def delete(self, folder_id: int) -> bool:
        folder = await self.folder_repo.get_by_id(folder_id)
        if folder is None:
            return False
        if folder.is_default:
            raise ValueError("Cannot delete default folders")
        return await self.folder_repo.delete(folder_id)
