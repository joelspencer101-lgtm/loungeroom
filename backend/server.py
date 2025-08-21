from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends, WebSocket, WebSocketDisconnect
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
from datetime import datetime, timezone
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

@hb_router.get("/health")
async def hb_health():
    return {"status": "healthy", "service": "hyperbeam-proxy", "timestamp": now_iso()}

@hb_router.post("/sessions", response_model=HBSessionResponse)
async def hb_create_session(payload: HBCreatePayload, api_key: str = Depends(_validate_api_key)):
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
                payload = json.loads(msg)
            except Exception:
                continue
            mtype = payload.get("type")
            if mtype == "ping":
                await websocket.send_text(json.dumps({"type": "pong", "ts": now_iso()}))
                continue
            if mtype in ("chat", "presence"):
                # attach user
                payload["user"] = manager.ident.get(websocket, {})
                payload.setdefault("ts", now_iso())
                await manager.broadcast(code, payload)
    except WebSocketDisconnect:
        pass
    except Exception:
        logging.exception("WebSocket error")
    finally:
        user = manager.ident.get(websocket)
        manager.disconnect(code, websocket)
        if user:
            # announce leave
            try:
                await manager.broadcast(code, {"type": "presence", "event": "leave", "user": user, "ts": now_iso()})
            except Exception:
                pass

# Include routers in the main app
app.include_router(api_router)
app.include_router(hb_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()