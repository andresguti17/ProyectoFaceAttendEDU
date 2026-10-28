"""In-process fakes of identity, authorization and academic for tests with several schools.

Two schools (100 and 200), one caller in each, a Super Administrador and a caller without an
academic actor. Every caller holds the staff permission; what changes is their school scope.
"""
from __future__ import annotations

from urllib.parse import unquote

from infrastructure.web import security

ADMIN_A = "aaaaaaaa-0000-4000-8000-00000000000a"
ADMIN_B = "bbbbbbbb-0000-4000-8000-00000000000a"
SUPER_ADMIN = "cccccccc-0000-4000-8000-00000000000a"
NO_ACTOR = "dddddddd-0000-4000-8000-00000000000a"

USERS = {  # session token -> (user id, own person id, roles)
    ADMIN_A: ("user-a", "person-admin-a", ["Administrador"]),
    ADMIN_B: ("user-b", "person-admin-b", ["Administrador"]),
    SUPER_ADMIN: ("user-sa", "person-sa", ["Super Administrador"]),
    NO_ACTOR: ("user-na", "person-na", ["Administrador"]),
}
PERSON_SCHOOL = {  # person id -> school of its academic actor (absent = no actor)
    "person-admin-a": 100, "person-admin-b": 200,
    "person-in-a": 100, "person-in-a2": 100, "person-in-b": 200,
}


async def get_json(url: str, token: str):
    if "/api/v1/sessions/" in url:
        user = USERS.get(url.rsplit("/", 1)[1])
        return (200, {"sessionStatus": "Active", "userId": user[0]}) if user else (404, None)
    if "/auth/evaluate" in url:
        return 200, {"allowed": True}  # every caller holds the staff permission
    user_id = url.rsplit("/", 1)[1]  # identity: GET /api/v1/users/{id}
    person = next((u[1] for u in USERS.values() if u[0] == user_id), None)
    return (200, {"personId": person}) if person else (404, None)


async def get_list(url: str, token: str):
    if "/roles" in url:
        user_id = url.split("/users/")[1].split("/")[0]
        return [{"roleName": r} for u in USERS.values() if u[0] == user_id for r in u[2]]
    if "/academic-actors?personId=" in url:
        school = PERSON_SCHOOL.get(unquote(url.split("personId=")[1]))
        return [{"academicActorId": 1, "schoolId": school}] if school else []
    return []


def install(monkeypatch) -> None:
    """Point the security module at the fakes (the process caches are cleared by conftest)."""
    monkeypatch.setattr(security, "_get_json", get_json)
    monkeypatch.setattr(security, "_get_list", get_list)
