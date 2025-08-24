from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends, WebSocket, WebSocketDisconnect, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from starlette.concurrency import run_in_threadpool
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Set
import uuid
from datetime import datetime, timezone, timedelta
import requests
import random
import string
import json


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create routers with the /api prefix
api_router = APIRouter(prefix="/api")
hb_router = APIRouter(prefix="/api/hb", tags=["hyperbeam"])

# -------------------------------------------------------------------------------------
# Helpers for Mongo serialization
# -------------------------------------------------------------------------------------
def now_iso():
    return datetime.now(timezone.utc).isoformat()

def prepare_for_mongo(data: Dict[str, Any]) -> Dict[str, Any]:
    # Ensure datetimes are strings
    for k, v in list(data.items()):
        if isinstance(v, datetime):
            data[k] = v.isoformat()
    return data

# -------------------------------------------------------------------------------------
# Demo Status models and routes (kept intact)
# -------------------------------------------------------------------------------------
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: str = Field(default_factory=now_iso)

class StatusCheckCreate(BaseModel):
    client_name: str

@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_obj = StatusCheck(client_name=input.client_name)
    await db.status_checks.insert_one(prepare_for_mongo(status_obj.model_dump()))
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(length=None)
    # Pydantic will ignore Mongo's _id
    return [StatusCheck(**sc) for sc in status_checks]

# -------------------------------------------------------------------------------------
# Hyperbeam proxy: create/list/terminate sessions via backend
# -------------------------------------------------------------------------------------
HYPERBEAM_BASE = "https://engine.hyperbeam.com/v0"

class HBCreatePayload(BaseModel):
    start_url: Optional[str] = None
    width: Optional[int] = 1280
    height: Optional[int] = 720
    kiosk: bool = True
    timeout_absolute: Optional[int] = 3600
    timeout_inactive: Optional[int] = 1800

class HBSessionResponse(BaseModel):
    session_uuid: str
    embed_url: str
    created_at: str
    metadata: Dict[str, Any] = Field(default_factory=dict)

async def _validate_api_key(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header. Use 'Bearer <api_key>'")
    return authorization.split("Bearer ", 1)[1]

# Admin token dependency
def _get_admin_token():
    token = os.environ.get("ADMIN_TOKEN", "")
    if not token:
        logging.warning("ADMIN_TOKEN is not set in environment")
    return token

async def _require_admin(x_admin_token: str = Header(default="", alias="X-Admin-Token")):
    expected = _get_admin_token()
    if not expected or x_admin_token != expected:
        raise HTTPException(status_code=401, detail="Unauthorized: invalid admin token")
    return True

# Convenience env getters
def _get_env_hb_key() -> str:
    key = os.environ.get("HYPERBEAM_API_KEY", "")
    return key

MAX_ACTIVE = int(os.environ.get("MAX_ACTIVE_SESSIONS", "0") or 0)
DEFAULT_IDLE_MIN = int(os.environ.get("JANITOR_IDLE_MINUTES", "60") or 60)

@hb_router.get("/health")
async def hb_health():
    return {"status": "healthy", "service": "hyperbeam-proxy", "timestamp": now_iso()}

@hb_router.post("/sessions", response_model=HBSessionResponse)
async def hb_create_session(payload: HBCreatePayload, api_key: str = Depends(_validate_api_key)):
    # Optional enforcement to respect test plan limits
    if MAX_ACTIVE and MAX_ACTIVE > 0:
        active_count = await db.hb_sessions.count_documents({"is_active": True})
        if active_count >= MAX_ACTIVE:
            raise HTTPException(status_code=429, detail=f"Max active sessions reached ({MAX_ACTIVE}). Use admin cleanup to free capacity.")

    body = {
        "start_url": payload.start_url or "https://www.google.com",
        "width": payload.width or 1280,
        "height": payload.height or 720,
        "kiosk": payload.kiosk,
        "timeout": {
            "absolute": payload.timeout_absolute or 3600,
            "inactive": payload.timeout_inactive or 1800,
        },
    }

    def _post():
        return requests.post(
            f"{HYPERBEAM_BASE}/vm",
            json=body,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            timeout=30,
        )

    try:
        resp = await run_in_threadpool(_post)
    except requests.RequestException as e:
        logging.exception("Network error calling Hyperbeam")
        raise HTTPException(status_code=503, detail="Service temporarily unavailable") from e

    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=f"Hyperbeam error: {resp.text}")

    data = resp.json()
    session_uuid = str(uuid.uuid4())

    doc = {
        "session_uuid": session_uuid,
        "hyperbeam_session_id": data.get("session_id"),
        "embed_url": data.get("embed_url"),
        "admin_token": data.get("admin_token"),
        "created_at": now_iso(),
        "last_accessed": now_iso(),
        "is_active": True,
        "metadata": {
            "width": body["width"],
            "height": body["height"],
            "start_url": body["start_url"],
        },
    }
    await db.hb_sessions.insert_one(prepare_for_mongo(doc))

    return HBSessionResponse(
        session_uuid=session_uuid,
        embed_url=data.get("embed_url"),
        created_at=doc["created_at"],
        metadata=doc["metadata"],
    )

@hb_router.get("/sessions/{session_uuid}", response_model=HBSessionResponse)
async def hb_get_session(session_uuid: str):
    doc = await db.hb_sessions.find_one({"session_uuid": session_uuid})
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")
    if not doc.get("is_active", False):
        raise HTTPException(status_code=410, detail="Session inactive")

    await db.hb_sessions.update_one(
        {"session_uuid": session_uuid},
        {"$set": {"last_accessed": now_iso()}},
    )

    return HBSessionResponse(
        session_uuid=doc["session_uuid"],
        embed_url=doc["embed_url"],
        created_at=doc["created_at"],
        metadata=doc.get("metadata", {}),
    )

@hb_router.delete("/sessions/{session_uuid}")
async def hb_terminate_session(session_uuid: str, api_key: str = Depends(_validate_api_key)):
    doc = await db.hb_sessions.find_one({"session_uuid": session_uuid})
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")

    hb_id = doc.get("hyperbeam_session_id")

    def _delete():
        return requests.delete(
            f"{HYPERBEAM_BASE}/vm/{hb_id}",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=30,
        )

    try:
        resp = await run_in_threadpool(_delete)
    except requests.RequestException as e:
        logging.exception("Network error calling Hyperbeam (terminate)")
        raise HTTPException(status_code=503, detail="Service temporarily unavailable") from e

    # Mark inactive regardless of external response to avoid zombie sessions
    await db.hb_sessions.update_one(
        {"session_uuid": session_uuid},
        {"$set": {"is_active": False, "last_accessed": now_iso()}},
    )

    if resp.status_code not in (200, 204):
        # Still consider session terminated locally
        return {"message": "Marked session inactive locally (remote terminate may have failed)", "session_uuid": session_uuid}

    return {"message": "Session terminated successfully", "session_uuid": session_uuid}

# -------------------------------------------------------------------------------------
# Simple Rooms: shareable code that maps to an existing session_uuid
# -------------------------------------------------------------------------------------
class CreateRoomPayload(BaseModel):
    session_uuid: str
    label: Optional[str] = None

class RoomResponse(BaseModel):
    code: str
    session_uuid: str
    created_at: str
    label: Optional[str] = None

def _gen_code(n: int = 6) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return ''.join(random.choice(alphabet) for _ in range(n))

@hb_router.post("/rooms", response_model=RoomResponse)
async def create_room(payload: CreateRoomPayload):
    sess = await db.hb_sessions.find_one({"session_uuid": payload.session_uuid, "is_active": True})
    if not sess:
        raise HTTPException(status_code=404, detail="Active session not found")

    # ensure unique code
    for _ in range(10):
        code = _gen_code()
        existing = await db.hb_rooms.find_one({"code": code})
        if not existing:
            break
    else:
        raise HTTPException(status_code=500, detail="Failed to generate room code")

    doc = {
        "code": code,
        "session_uuid": payload.session_uuid,
        "label": payload.label or "",
        "created_at": now_iso(),
    }
    await db.hb_rooms.insert_one(doc)
    return RoomResponse(**doc)

@hb_router.get("/rooms/{code}", response_model=HBSessionResponse)
async def get_room_session(code: str):
    room = await db.hb_rooms.find_one({"code": code})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    sess = await db.hb_sessions.find_one({"session_uuid": room["session_uuid"]})
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    if not sess.get("is_active", False):
        raise HTTPException(status_code=410, detail="Session inactive")

    return HBSessionResponse(
        session_uuid=sess["session_uuid"],
        embed_url=sess["embed_url"],
        created_at=sess["created_at"],
        metadata=sess.get("metadata", {}),
    )

# -------------------------------------------------------------------------------------
# WebSocket: presence + chat per room code
# -------------------------------------------------------------------------------------
class RoomManager:
    def __init__(self) -> None:
        self.rooms: Dict[str, Set[WebSocket]] = {}
        self.ident: Dict[WebSocket, Dict[str, Any]] = {}

    async def connect(self, code: str, websocket: WebSocket):
        await websocket.accept()
        self.rooms.setdefault(code, set()).add(websocket)

    def disconnect(self, code: str, websocket: WebSocket):
        try:
            self.rooms.get(code, set()).discard(websocket)
            self.ident.pop(websocket, None)
            if not self.rooms.get(code):
                self.rooms.pop(code, None)
        except Exception:
            pass

    async def broadcast(self, code: str, message: Dict[str, Any]):
        data = json.dumps(message)
        for ws in list(self.rooms.get(code, set())):
            try:
                await ws.send_text(data)
            except Exception:
                # drop broken connection silently
                self.disconnect(code, ws)

manager = RoomManager()

@hb_router.websocket("/ws/room/{code}")
async def ws_room(websocket: WebSocket, code: str):
    # Optionally, validate room code exists but allow ad-hoc for MVP
    await manager.connect(code, websocket)
    try:
        # Expect first message to be an identify payload
        # {"type":"hello","user":{"id":...,"name":...,"color":...}}
        raw = await websocket.receive_text()
        try:
            init = json.loads(raw)
        except Exception:
            init = {}
        if isinstance(init, dict) and init.get("type") == "hello":
            manager.ident[websocket] = init.get("user", {})
            # announce join
            await manager.broadcast(code, {"type": "presence", "event": "join", "user": manager.ident[websocket], "ts": now_iso()})
        else:
            manager.ident[websocket] = {"id": str(uuid.uuid4())}

        # Main loop
        while True:
            msg = await websocket.receive_text()
            try:
                data = json.loads(msg)
            except Exception:
                data = {"type": "unknown"}

            # basic validation
            if not isinstance(data, dict):
                continue

            # Broadcast to others in the same room
            await manager.broadcast(code, data)
    except WebSocketDisconnect:
        pass
    except Exception:
        logging.exception("ws_room error")
    finally:
        try:
            # announce leave
            user = manager.ident.get(websocket, {})
            await manager.broadcast(code, {"type": "presence", "event": "leave", "user": user, "ts": now_iso()})
        except Exception:
            pass
        manager.disconnect(code, websocket)

# -------------------------------------------------------------------------------------
# HTTP Polling fallback for realtime events (chat + presence)
# -------------------------------------------------------------------------------------
# In-memory event storage per room (MVP). Note: not multi-pod persistent.
ROOM_EVENTS: Dict[str, List[Dict[str, Any]]] = {}
ROOM_SEQ: Dict[str, int] = {}
MAX_EVENTS = 200

class EventIn(BaseModel):
    type: str
    text: Optional[str] = None
    head: Optional[Dict[str, Any]] = None
    user: Optional[Dict[str, Any]] = None

class EventsOut(BaseModel):
    events: List[Dict[str, Any]]
    last_id: int

@hb_router.post("/rooms/{code}/events", response_model=Dict[str, Any])
async def post_room_event(code: str, event: EventIn):
    seq = ROOM_SEQ.get(code, 0) + 1
    ROOM_SEQ[code] = seq
    payload = {
        "id": seq,
        "ts": now_iso(),
        "type": event.type,
        "text": event.text,
        "head": event.head,
        "user": event.user or {},
    }
    lst = ROOM_EVENTS.setdefault(code, [])
    lst.append(payload)
    if len(lst) > MAX_EVENTS:
        del lst[: len(lst) - MAX_EVENTS]
    return {"ok": True, "id": seq}

@hb_router.get("/rooms/{code}/events", response_model=EventsOut)
async def get_room_events(code: str, since: int = Query(0, ge=0)):
    lst = ROOM_EVENTS.get(code, [])
    if since <= 0:
        # Return the tail to avoid huge payloads
        tail = lst[-50:]
        last_id = tail[-1]["id"] if tail else 0
        return {"events": tail, "last_id": last_id}
    # Return events with id > since
    out = [e for e in lst if e["id"] > since]
    last_id = lst[-1]["id"] if lst else since
    return {"events": out, "last_id": last_id}

# -------------------------------------------------------------------------------------
# Admin: Session Janitor (list/cleanup/terminate) - uses env API key and ADMIN token
# -------------------------------------------------------------------------------------
class AdminCleanupIn(BaseModel):
    idle_minutes: Optional[int] = None
    max_active: Optional[int] = None
    dry_run: Optional[bool] = False

class AdminSessionOut(BaseModel):
    session_uuid: str
    hyperbeam_session_id: Optional[str] = None
    embed_url: Optional[str] = None
    is_active: bool
    created_at: str
    last_accessed: Optional[str] = None
    age_minutes: float

async def _list_active_sessions() -> List[Dict[str, Any]]:
    items = await db.hb_sessions.find({"is_active": True}).sort("created_at", 1).to_list(length=None)
    return items

async def _terminate_session_record(doc: Dict[str, Any], reason: str = "admin_cleanup") -> Dict[str, Any]:
    hb_id = doc.get("hyperbeam_session_id")
    api_key = _get_env_hb_key()

    def _delete():
        # If we have an API key and hb_id, attempt remote termination; otherwise skip remote call
        if api_key and hb_id:
            return requests.delete(
                f"{HYPERBEAM_BASE}/vm/{hb_id}",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=30,
            )
        class Dummy:
            status_code = 204
        return Dummy()

    try:
        resp = await run_in_threadpool(_delete)
    except Exception:
        logging.exception("Admin terminate remote call failed")
        # Proceed to mark inactive locally regardless
        resp = type("Dummy", (), {"status_code": 500})()

    await db.hb_sessions.update_one(
        {"session_uuid": doc["session_uuid"]},
        {"$set": {"is_active": False, "last_accessed": now_iso(), "terminated_by": reason}},
    )

    return {"session_uuid": doc["session_uuid"], "remote_status": getattr(resp, "status_code", None)}

@hb_router.get("/admin/active", response_model=List[AdminSessionOut], dependencies=[Depends(_require_admin)])
async def admin_list_active():
    items = await _list_active_sessions()
    out: List[AdminSessionOut] = []
    now = datetime.now(timezone.utc)
    for it in items:
        created = datetime.fromisoformat(it["created_at"]) if isinstance(it.get("created_at"), str) else now
        age = (now - created).total_seconds() / 60.0
        out.append(AdminSessionOut(
            session_uuid=it["session_uuid"],
            hyperbeam_session_id=it.get("hyperbeam_session_id"),
            embed_url=it.get("embed_url"),
            is_active=it.get("is_active", False),
            created_at=it.get("created_at"),
            last_accessed=it.get("last_accessed"),
            age_minutes=age,
        ))
    return out

@hb_router.post("/admin/cleanup", dependencies=[Depends(_require_admin)])
async def admin_cleanup(payload: AdminCleanupIn):
    idle_minutes = payload.idle_minutes if payload.idle_minutes is not None else DEFAULT_IDLE_MIN
    max_active = payload.max_active if payload.max_active is not None else MAX_ACTIVE
    dry_run = bool(payload.dry_run)

    active = await _list_active_sessions()

    # Determine idle sessions
    now = datetime.now(timezone.utc)
    to_terminate: List[Dict[str, Any]] = []

    # Terminate idle by last_accessed
    cutoff = now - timedelta(minutes=idle_minutes)
    for it in active:
        last = it.get("last_accessed") or it.get("created_at")
        try:
            last_dt = datetime.fromisoformat(last)
        except Exception:
            last_dt = now
        if last_dt.replace(tzinfo=timezone.utc) <= cutoff:
            to_terminate.append(it)

    # Enforce max_active by oldest first
    if max_active and max_active > 0 and len(active) - len(to_terminate) > max_active:
        remaining_after_idle = [it for it in active if it not in to_terminate]
        overflow = (len(remaining_after_idle) - max_active)
        if overflow > 0:
            to_terminate.extend(remaining_after_idle[:overflow])

    # Deduplicate
    seen = set()
    unique_terminate = []
    for it in to_terminate:
        key = it["session_uuid"]
        if key not in seen:
            seen.add(key)
            unique_terminate.append(it)

    if dry_run:
        return {"dry_run": True, "would_terminate": [it["session_uuid"] for it in unique_terminate], "count": len(unique_terminate)}

    results = []
    for it in unique_terminate:
        res = await _terminate_session_record(it, reason="admin_cleanup")
        results.append(res)

    return {"terminated": results, "count": len(results)}

@hb_router.delete("/admin/sessions/{session_uuid}", dependencies=[Depends(_require_admin)])
async def admin_terminate_one(session_uuid: str):
    doc = await db.hb_sessions.find_one({"session_uuid": session_uuid, "is_active": True})
    if not doc:
        raise HTTPException(status_code=404, detail="Active session not found")
    res = await _terminate_session_record(doc, reason="admin_force")
    return res

# Include routers in the main app
app.include_router(api_router)
app.include_router(hb_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"]
)