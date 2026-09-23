import pytest

from app.database import AsyncSessionLocal, init_db
from app.services.message_service import MessageService
from tests.conftest import make_client


@pytest.fixture(autouse=True)
async def setup_db():
    await init_db(clear_first=True)


@pytest.mark.asyncio
async def test_folder_crud():
    async with make_client() as client:
        created = await client.post(
            "/api/folders/", json={"name": "Работа", "color": "#123456"}
        )
        assert created.status_code == 201
        fid = created.json()["id"]
        assert created.json()["name"] == "Работа"

        listed = await client.get("/api/folders/")
        assert listed.status_code == 200
        assert any(f["id"] == fid for f in listed.json())

        updated = await client.patch(f"/api/folders/{fid}", json={"name": "Работа+"})
        assert updated.status_code == 200
        assert updated.json()["name"] == "Работа+"

        deleted = await client.delete(f"/api/folders/{fid}")
    assert deleted.status_code == 204


@pytest.mark.asyncio
async def test_delete_default_folder_returns_400():
    async with make_client() as client:
        folders = await client.get("/api/folders/")
        default = next(f for f in folders.json() if f["is_default"])
        resp = await client.delete(f"/api/folders/{default['id']}")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_assign_folder_to_contact():
    async with make_client() as client:
        folder = await client.post("/api/folders/", json={"name": "VIP"})
        fid = folder.json()["id"]

        contact = await client.post(
            "/api/contacts/", json={"name": "In VIP", "folder_id": fid}
        )
    assert contact.status_code == 201
    assert contact.json()["folder_id"] == fid


@pytest.mark.asyncio
async def test_messages_visible_by_folder_filter():
    async with make_client() as client:
        folder = await client.post("/api/folders/", json={"name": "Проекты"})
        fid = folder.json()["id"]

        in_contact = await client.post(
            "/api/contacts/", json={"name": "In Folder", "folder_id": fid}
        )
        in_cid = in_contact.json()["id"]
        out_contact = await client.post(
            "/api/contacts/", json={"name": "Out Folder"}
        )
        out_cid = out_contact.json()["id"]

        await client.post("/api/messages/", json={
            "contact_id": in_cid,
            "channel": "telegram",
            "content": "в папке",
            "direction": "incoming",
        })
        await client.post("/api/messages/", json={
            "contact_id": out_cid,
            "channel": "telegram",
            "content": "не в папке",
            "direction": "incoming",
        })

    async with AsyncSessionLocal() as session:
        service = MessageService(session)
        in_folder = await service.get_all(folder_id=fid)
        contents = [m.content for m in in_folder]

    assert "в папке" in contents
    assert "не в папке" not in contents
