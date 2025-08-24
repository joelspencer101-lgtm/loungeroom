import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function wsUrlFromHttp(base, path) {
  if (!base) return path; // fallback
  return base.replace(/^http/, "ws") + path;
}

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : typeof initialValue === 'function' ? initialValue() : initialValue;
    } catch {
      return typeof initialValue === 'function' ? initialValue() : initialValue;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);
  return [value, setValue];
}

function DraggableChatHead({ id = "me", initial = "😀", color = "#8b5cf6", storageKey = "ct_chat_head", value, onChange }) {
  const rootRef = useRef(null);
  const [pos, setPos] = useLocalStorage(`${storageKey}_pos`, value?.pos || { x: 24, y: 24 });
  const [size, setSize] = useLocalStorage(`${storageKey}_size`, value?.size || 64);
  const dragging = useRef(false);
  const resizing = useRef(false);
  const start = useRef({ x: 0, y: 0, px: 0, py: 0, s: 0 });

  useEffect(() => {
    if (value?.pos) setPos(value.pos);
    if (value?.size) setSize(value.size);
    // eslint-disable-next-line
    }, [value?.pos?.x, value?.pos?.y, value?.size]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onPointerDown = (e) => {
      if (e.target.getAttribute("data-resizer") === "1") {
        resizing.current = true;
      } else {
        dragging.current = true;
      }
      start.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y, s: size };
      el.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e) => {
      if (!dragging.current && !resizing.current) return;
      const dx = e.clientX - start.current.x;
      const dy = e.clientY - start.current.y;
      let nextPos = pos;
      let nextSize = size;
      if (dragging.current) nextPos = { x: Math.max(0, start.current.px + dx), y: Math.max(0, start.current.py + dy) };
      if (resizing.current) nextSize = Math.max(48, Math.min(200, start.current.s + dx));
      setPos(nextPos);
      setSize(nextSize);
      onChange?.({ pos: nextPos, size: nextSize });
    };
    const onPointerUp = (e) => {
      dragging.current = false; resizing.current = false;
      try { el.releasePointerCapture(e.pointerId); } catch {}
    };
    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [pos, size, onChange]);

  return (
    <div ref={rootRef} className="ct-chat-head" style={{ left: pos.x, top: pos.y, width: size, height: size, background: color }}>
      <div className="ct-chat-initial" style={{ fontSize: Math.max(20, size / 2.8) }} title="Drag to move">
        {initial}
      </div>
      <div className="ct-resizer" data-resizer="1" title="Drag to resize" />
    </div>
  );
}

// Mock helpers
const uuid = () => "u-" + Math.random().toString(16).slice(2) + Date.now().toString(16);
const genCode = (n = 6) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
};
const getMockRooms = () => { try { return JSON.parse(localStorage.getItem("ct_mock_rooms") || "{}"); } catch { return {}; } };
const setMockRooms = (obj) => { try { localStorage.setItem("ct_mock_rooms", JSON.stringify(obj)); } catch {} };
const mockEmbedDataUrl = (title = "Coffee Table Mock Browser") => {
  const html = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title><style>html,body{height:100%;margin:0;background:#0b1020;color:#e5e7eb;font-family:system-ui, -apple-system, Segoe UI, Roboto} .wrap{display:grid;place-items:center;height:100%} .card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:24px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.5);} .pulse{width:12px;height:12px;border-radius:12px;background:#22c55e;display:inline-block;box-shadow:0 0 0 0 rgba(34,197,94,.7);animation:pulse 1.8s infinite;} @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.7)}70%{box-shadow:0 0 0 18px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}} .muted{opacity:.8} </style></head><body><div class="wrap"><div class="card"><div style="font-size:18px;font-weight:800;letter-spacing:.4px;margin-bottom:6px">${title}</div><div class="muted" id="clock"></div><div style="margin-top:10px"><span class="pulse"></span> Connected</div></div></div><script>function tick(){ document.getElementById('clock').textContent=new Date().toLocaleString(); } setInterval(tick,1000); tick();</script></body></html>`;
  return "data:text/html;base64," + btoa(unescape(encodeURIComponent(html)));
};

// App icon component with better icons than emojis
function AppIcon({ app, onClick, className = "" }) {
  return (
    <button 
      className={`ct-app-icon ${className}`} 
      style={{ background: app.bg }} 
      onClick={() => onClick(app)} 
      title={app.name}
      aria-label={`Launch ${app.name}`}
    >
      <div className="ct-app-icon-content">
        <div className="ct-app-icon-symbol" style={{ color: app.color }}>
          {app.icon}
        </div>
        <div className="ct-app-icon-name">{app.name}</div>
      </div>
    </button>
  );
}

// Bluey background images
const BLUEY_BACKGROUNDS = [
  { name: "Lounge", url: "https://www.bluey.tv/wp-content/uploads/2025/04/Lounge.png" },
  { name: "Kitchen", url: "https://www.bluey.tv/wp-content/uploads/2025/04/Kitchen.png" },
  { name: "Playroom", url: "https://www.bluey.tv/wp-content/uploads/2025/04/playroom.png" },
  { name: "Kids Room", url: "https://www.bluey.tv/wp-content/uploads/2025/04/Kids.png" },
  { name: "Dining", url: "https://www.bluey.tv/wp-content/uploads/2025/04/Dining.png" },
  { name: "Central Room", url: "https://www.bluey.tv/wp-content/uploads/2025/04/Central-Room.png" },
  { name: "Deck", url: "https://www.bluey.tv/wp-content/uploads/2025/04/Deck.png" },
  { name: "Backyard", url: "https://www.bluey.tv/wp-content/uploads/2025/04/backyard.png" },
  { name: "Bathroom", url: "https://www.bluey.tv/wp-content/uploads/2025/04/bathroom-1024x576.png" },
  { name: "Shed", url: "https://www.bluey.tv/wp-content/uploads/2025/04/Shed.png" },
];

// Default apps and games
const DEFAULT_APPS = [
  { 
    id: "youtube", 
    name: "YouTube", 
    url: "https://www.youtube.com", 
    icon: "▶", 
    color: "#ffffff", 
    bg: "linear-gradient(135deg, #ff0000, #cc0000)" 
  },
  { 
    id: "netflix", 
    name: "Netflix", 
    url: "https://www.netflix.com", 
    icon: "N", 
    color: "#ffffff", 
    bg: "linear-gradient(135deg, #e50914, #b20710)" 
  },
  { 
    id: "twitch", 
    name: "Twitch", 
    url: "https://www.twitch.tv", 
    icon: "T", 
    color: "#ffffff", 
    bg: "linear-gradient(135deg, #9146ff, #6441a4)" 
  },
  { 
    id: "spotify", 
    name: "Spotify", 
    url: "https://open.spotify.com", 
    icon: "♪", 
    color: "#ffffff", 
    bg: "linear-gradient(135deg, #1db954, #168c41)" 
  },
  { 
    id: "bluey-keepy-uppy", 
    name: "Keepy Uppy", 
    url: "https://embed.cbeebies.com/bluey-keepy-uppy/", 
    icon: "⚽", 
    color: "#ffffff", 
    bg: "linear-gradient(135deg, #ff6b6b, #4ecdc4)",
    isGame: true
  },
  { 
    id: "bluey-xylophone", 
    name: "Magic Xylophone", 
    url: "https://embed.cbeebies.com/bluey-magic-xylophone/", 
    icon: "🎵", 
    color: "#ffffff", 
    bg: "linear-gradient(135deg, #a8e6cf, #ff8b94)",
    isGame: true
  },
];

function App() {
  // user profile
  const [user] = useLocalStorage("ct_user", () => {
    const id = uuid();
    const initials = ["😀", "🙂", "🤠", "🦊", "🐼", "🐧", "🦄", "🐶"][Math.floor(Math.random()*8)];
    const color = ["#8b5cf6", "#06b6d4", "#f59e0b", "#ef4444", "#22c55e"][Math.floor(Math.random()*5)];
    return { id, initial: initials, color };
  });

  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem("hb_api_key") || "");
  const [startUrl, setStartUrl] = useState("https://www.google.com");
  const [size, setSize] = useState({ width: 1280, height: 720 });
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Set default background to Bluey Lounge
  const [bgType, setBgType] = useLocalStorage("ct_bg_type", "image");
  const [bgImage, setBgImage] = useLocalStorage("ct_bg_image", BLUEY_BACKGROUNDS[0].url);
  const [frameStyle, setFrameStyle] = useLocalStorage("ct_frame_style", "glass");
  const [loopVideo, setLoopVideo] = useLocalStorage("ct_loop_video", "");
  const [mockMode, setMockMode] = useLocalStorage("ct_mock_mode", false);

  // User's custom bookmarks
  const [customApps, setCustomApps] = useLocalStorage("ct_custom_apps", []);

  // Fullscreen and chat overlay states
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chatOverlay, setChatOverlay] = useLocalStorage("ct_chat_overlay", true);

  // Hyperbeam SDK state (real mode only)
  const hbMountRef = useRef(null);
  const hbClientRef = useRef(null);
  const [hbReady, setHbReady] = useState(false);
  const [browserVolume, setBrowserVolume] = useLocalStorage("ct_browser_volume", 0.8);
  const [hbFallbackIframe, setHbFallbackIframe] = useState(false);

  const containerRef = useRef(null);

  // share room code
  const [shareCode, setShareCode] = useState("");
  const [joinCode, setJoinCode] = useState("");

  // presence & chat via WebSocket or HTTP polling
  const [liveMode, setLiveMode] = useState("none"); // none | ws | poll
  const wsRef = useRef(null);
  const pollRef = useRef(null);
  const lastEventIdRef = useRef(0);
  const [messages, setMessages] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [others, setOthers] = useState({}); // userId -> {initial,color,pos,size}

  // chat audio volume (separate from browser audio)
  const [chatVolume, setChatVolume] = useLocalStorage("ct_chat_volume", 0.6);
  const chatAudioRef = useRef(null);
  useEffect(() => { if (chatAudioRef.current) chatAudioRef.current.volume = chatVolume; }, [chatVolume]);

  useEffect(() => { if (apiKey) sessionStorage.setItem("hb_api_key", apiKey); }, [apiKey]);

  const headers = useMemo(() => ({ Authorization: `Bearer ${apiKey}` }), [apiKey]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Initialize Hyperbeam SDK when session active in real mode
  useEffect(() => {
    let destroyed = false;

    async function initHB() {
      if (!session || mockMode) { cleanupHB(); return; }
      setHbReady(false);
      setHbFallbackIframe(false);
      try {
        const mod = await import("@hyperbeam/web");
        const Hyperbeam = mod.default || mod;
        if (!hbMountRef.current) return;
        if (hbClientRef.current) { try { hbClientRef.current.destroy(); } catch {} hbClientRef.current = null; }
        const client = await Hyperbeam(hbMountRef.current, session.embed_url, { volume: browserVolume, timeout: 15000, delegateKeyboard: true });
        if (destroyed) { try { client.destroy(); } catch {} return; }
        hbClientRef.current = client; setHbReady(true);
      } catch (e) { console.error("HB SDK failed", e); setHbFallbackIframe(true); }
    }

    initHB();
    return () => { destroyed = true; cleanupHB(); };
    // eslint-disable-next-line
  }, [session?.embed_url, mockMode]);

  useEffect(() => { if (hbClientRef.current) { try { hbClientRef.current.volume = browserVolume; } catch {} } }, [browserVolume]);

  function cleanupHB() { if (hbClientRef.current) { try { hbClientRef.current.destroy(); } catch {} hbClientRef.current = null; } setHbReady(false); }

  // Live connection management (WS first, then poll)
  const stopPolling = useCallback(() => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } }, []);
  const stopWS = useCallback(() => { try { wsRef.current?.close(); } catch {} wsRef.current = null; }, []);

  const startPolling = useCallback((code) => {
    stopPolling();
    setLiveMode("poll");
    lastEventIdRef.current = 0; // fresh
    const tick = async () => {
      try {
        const res = await axios.get(`${API}/hb/rooms/${code}/events`, { params: { since: lastEventIdRef.current } });
        const { events, last_id } = res.data || {};
        if (Array.isArray(events) && events.length) {
          events.forEach(handleInboundEvent);
          lastEventIdRef.current = last_id || lastEventIdRef.current;
        }
      } catch (e) {
        // keep polling even on transient errors
      }
    };
    tick();
    pollRef.current = setInterval(tick, 1200);
  }, [stopPolling]);

  const startWS = useCallback((code) => {
    stopWS();
    try {
      const url = wsUrlFromHttp(BACKEND_URL, `/api/hb/ws/room/${code}`);
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => {
        setLiveMode("ws");
        ws.send(JSON.stringify({ type: "hello", user }));
      };
      ws.onmessage = (ev) => {
        try { const data = JSON.parse(ev.data); handleInboundEvent(data); } catch {}
      };
      ws.onclose = () => {
        wsRef.current = null;
        // fallback to polling
        startPolling(code);
      };
      ws.onerror = () => {
        // fallback to polling
        try { ws.close(); } catch {}
        wsRef.current = null;
        startPolling(code);
      };
    } catch (e) {
      startPolling(code);
    }
  }, [startPolling, stopWS, user]);

  const handleInboundEvent = useCallback((data) => {
    if (data.type === "chat") {
      setMessages((m) => [...m, data]);
      if (data.user?.id !== user.id) chatAudioRef.current?.play().catch(() => {});
      return;
    }
    if (data.type === "presence") {
      if (data.event === "leave") {
        setOthers((o) => { const c = { ...o }; if (data.user?.id) delete c[data.user.id]; return c; });
      } else if (data.event === "join" && data.user?.id && data.user.id !== user.id) {
        setOthers((o) => ({ ...o, [data.user.id]: { initial: data.user.initial, color: data.user.color, pos: { x: 24, y: 24 }, size: 64 } }));
      } else if (data.head && data.user?.id && data.user.id !== user.id) {
        setOthers((o) => ({ ...o, [data.user.id]: { initial: data.user.initial, color: data.user.color, pos: data.head.pos, size: data.head.size } }));
      }
      return;
    }
    if (data.type === "session_end") {
      // Remote owner ended the session: reset local state
      cleanupHB();
      setSession(null);
      setShareCode("");
      stopPolling();
      stopWS();
      setLiveMode("none");
      setOthers({});
      setMessages([]);
      return;
    }
  }, [user.id]);

  // Connect live when we have shareCode and session
  useEffect(() => {
    stopPolling();
    stopWS();
    setLiveMode("none");
    setOthers({});
    setMessages([]);
    lastEventIdRef.current = 0;
    if (session && shareCode) {
      startWS(shareCode);
    }
    return () => { stopPolling(); stopWS(); };
  }, [session, shareCode, startWS, stopPolling, stopWS]);

  // Outbound helpers (WS preferred, then POST)
  const postEvent = useCallback(async (code, payload) => {
    try {
      await axios.post(`${API}/hb/rooms/${code}/events`, payload);
    } catch (e) {}
  }, []);

  const sendPresence = useCallback((head) => {
    if (!shareCode) return;
    const payload = { type: "presence", head, user };
    if (wsRef.current && liveMode === "ws") {
      try { wsRef.current.send(JSON.stringify(payload)); } catch {}
    } else {
      // throttle presence posts
      if (!sendPresence._t || Date.now() - sendPresence._t > 240) {
        sendPresence._t = Date.now();
        postEvent(shareCode, payload);
      }
    }
  }, [liveMode, postEvent, shareCode, user]);

  const sendChat = useCallback((text) => {
    if (!shareCode || !text?.trim()) return;
    const payload = { type: "chat", text: text.trim(), user };
    if (wsRef.current && liveMode === "ws") {
      try { wsRef.current.send(JSON.stringify(payload)); } catch {}
    } else {
      postEvent(shareCode, payload);
      // optimistic render
      handleInboundEvent(payload);
    }
  }, [handleInboundEvent, liveMode, postEvent, shareCode, user]);

  const [chatText, setChatText] = useState("");

  // Launch app/game
  const createSessionWithUrl = async (url) => {
    setLoading(true);
    setError("");
    try {
      if (mockMode) {
        const fake = { session_uuid: uuid(), embed_url: mockEmbedDataUrl(), created_at: new Date().toISOString(), metadata: { width: Number(size.width) || 1280, height: Number(size.height) || 720, start_url: url } };
        setSession(fake); setShareCode("");
      } else {
        if (!apiKey) { alert("Please paste your Hyperbeam API key"); return; }
        const payload = { start_url: url, width: Number(size.width) || 1280, height: Number(size.height) || 720, kiosk: true, timeout_absolute: 3600, timeout_inactive: 1800 };
        const res = await axios.post(`${API}/hb/sessions`, payload, { headers });
        setSession(res.data); setShareCode("");
      }
    } catch (err) { console.error(err); setError(err?.response?.data?.detail || err.message || "Failed to create session"); }
    finally { setLoading(false); }
  };

  const createSession = async (e) => {
    e && e.preventDefault();
    return createSessionWithUrl(startUrl);
  };

  const terminateSession = async () => {
    if (!session) return; if (!window.confirm("Close this session?")) return;
    setLoading(true); setError("");
    try {
      if (mockMode) {
        if (shareCode) {
          const rooms = getMockRooms();
          delete rooms[shareCode];
          setMockRooms(rooms);
          await axios.post(`${API}/hb/rooms/${shareCode}/events`, { type: "session_end", user });
        }
      } else {
        await axios.delete(`${API}/hb/sessions/${session.session_uuid}`, { headers });
        if (shareCode) {
          await axios.post(`${API}/hb/rooms/${shareCode}/events`, { type: "session_end", user });
        }
      }
    } catch (err) { console.error(err); setError(err?.response?.data?.detail || err.message || "Remote terminate error; marked inactive locally"); }
    finally { cleanupHB(); setSession(null); setShareCode(""); stopPolling(); stopWS(); setLiveMode("none"); setOthers({}); setMessages([]); setLoading(false); }
  };

  const createShareCode = async () => {
    if (!session) return;
    try {
      if (mockMode) { const code = genCode(); const rooms = getMockRooms(); rooms[code] = session; setMockRooms(rooms); setShareCode(code); navigator.clipboard?.writeText(code).catch(() => {}); }
      else { const res = await axios.post(`${API}/hb/rooms`, { session_uuid: session.session_uuid }, {}); setShareCode(res.data.code); navigator.clipboard?.writeText(res.data.code).catch(() => {}); }
    } catch (err) { console.error(err); setError(err?.response?.data?.detail || "Failed to create share code"); }
  };

  const joinByCode = async (e) => {
    e && e.preventDefault(); setLoading(true); setError("");
    try {
      if (mockMode) { const code = joinCode.toUpperCase(); const rooms = getMockRooms(); const s = rooms[code]; if (!s) throw new Error("Invalid code"); setSession(s); setShareCode(code); }
      else { const res = await axios.get(`${API}/hb/rooms/${joinCode}`); setSession(res.data); setShareCode(joinCode.toUpperCase()); }
    } catch (err) { console.error(err); setError(err?.response?.data?.detail || err.message || "Invalid code"); }
    finally { setLoading(false); }
  };

  // Enhanced fullscreen with chat overlay options
  const enterFullscreen = () => { 
    const el = containerRef.current; 
    if (!el) return; 
    if (document.fullscreenElement) { 
      document.exitFullscreen?.(); 
    } else { 
      el.requestFullscreen?.(); 
    } 
  };

  const bgStyle = useMemo(() => (bgType === "image" && bgImage ? { backgroundImage: `url(${bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}), [bgType, bgImage]);

  // Handle app launch
  const handleAppLaunch = (app) => {
    if (!mockMode && !apiKey) {
      alert("Enter your Hyperbeam API key or enable Mock Mode to launch");
      return;
    }
    createSessionWithUrl(app.url);
  };

  // Add custom app
  const addCustomApp = () => {
    const name = prompt("App name:");
    if (!name) return;
    const url = prompt("App URL:");
    if (!url) return;
    const icon = prompt("Icon (single character):", "🌐");
    const app = {
      id: `custom-${Date.now()}`,
      name,
      url,
      icon: icon || "🌐",
      color: "#ffffff",
      bg: "linear-gradient(135deg, #667eea, #764ba2)",
      isCustom: true
    };
    setCustomApps(prev => [...prev, app]);
  };

  // Remove custom app
  const removeCustomApp = (appId) => {
    if (window.confirm("Remove this app?")) {
      setCustomApps(prev => prev.filter(app => app.id !== appId));
    }
  };

  const allApps = [...DEFAULT_APPS, ...customApps];

  return (
    <div className="ct-root" style={bgStyle}>
      {mockMode && (<div className="ct-banner">Mock Mode is ON — no calls to Hyperbeam; sessions and rooms are simulated.</div>)}

      <audio ref={chatAudioRef} src="https://cdn.pixabay.com/download/audio/2022/03/15/audio_ade9b8b35e.mp3?filename=ping-notification-180739.mp3" preload="auto" />
      {!session && loopVideo ? (<video className="ct-bg-video" src={loopVideo} autoPlay muted loop playsInline />) : null}

      <header className="ct-header">
        <div className="ct-header-row">
          <div>
            <div className="ct-title">Coffee Table</div>
            <div className="ct-sub">Shared virtual browser powered by Hyperbeam</div>
          </div>
          <div className="ct-header-actions">
            {session && (
              <button className="btn danger" onClick={terminateSession} disabled={loading}>
                {loading ? "Closing..." : "Close Session"}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="ct-main">
        {!session ? (
          <>
            <section className="ct-panel">
              <form onSubmit={createSession} className="ct-form">
                <div className="ct-field">
                  <label>Hyperbeam API Key</label>
                  <input type="password" value={mockMode ? "" : apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={mockMode ? "Disabled in Mock Mode" : "sk_..."} autoComplete="off" disabled={mockMode} />
                </div>

                <div className="ct-field">
                  <label className="ct-label-row">Start URL <span className="ct-badge">Optional</span></label>
                  <input type="url" value={startUrl} onChange={(e) => setStartUrl(e.target.value)} placeholder="https://www.google.com" />
                </div>

                <div className="ct-row">
                  <div className="ct-field">
                    <label>Width</label>
                    <select value={size.width} onChange={(e) => setSize((s) => ({ ...s, width: e.target.value }))}>
                      <option value={1280}>1280</option>
                      <option value={1920}>1920</option>
                      <option value={1024}>1024</option>
                      <option value={800}>800</option>
                    </select>
                  </div>
                  <div className="ct-field">
                    <label>Height</label>
                    <select value={size.height} onChange={(e) => setSize((s) => ({ ...s, height: e.target.value }))}>
                      <option value={720}>720</option>
                      <option value={1080}>1080</option>
                      <option value={600}>600</option>
                      <option value={480}>480</option>
                    </select>
                  </div>
                </div>

                <div className="ct-row ct-split">
                  <div className="ct-toggle">
                    <input id="mockMode" type="checkbox" checked={!!mockMode} onChange={(e) => setMockMode(e.target.checked)} />
                    <label htmlFor="mockMode">Mock Mode</label>
                  </div>
                  <div className="ct-actions">
                    <button className="btn primary" type="submit" disabled={loading}>{loading ? "Creating..." : "Create Session"}</button>
                  </div>
                </div>

                <div className="ct-row" style={{ marginTop: 10 }}>
                  <div className="ct-field grow">
                    <label>Join by Code</label>
                    <div className="ct-join">
                      <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="ABC123" />
                      <button className="btn primary" onClick={joinByCode} type="button" disabled={loading || !joinCode}>Join</button>
                    </div>
                  </div>
                </div>

                {error ? <div className="ct-alert error">{String(error)}</div> : null}
              </form>

              <div className="ct-customize">
                <div className="ct-custom-title">Quick Backgrounds</div>
                <div className="ct-bg-grid">
                  {BLUEY_BACKGROUNDS.map(bg => (
                    <button
                      key={bg.name}
                      className={`ct-bg-thumb ${bgImage === bg.url ? 'active' : ''}`}
                      style={{ backgroundImage: `url(${bg.url})` }}
                      onClick={() => { setBgType("image"); setBgImage(bg.url); }}
                      title={bg.name}
                    >
                      <span className="ct-bg-name">{bg.name}</span>
                    </button>
                  ))}
                </div>

                <div className="ct-divider" />
                <div className="ct-custom-title">Customize</div>
                <div className="ct-row">
                  <div className="ct-field">
                    <label>Background</label>
                    <select value={bgType} onChange={(e) => setBgType(e.target.value)}>
                      <option value="gradient">Gradient</option>
                      <option value="image">Image URL</option>
                    </select>
                  </div>
                  {bgType === "image" && (
                    <div className="ct-field grow">
                      <label>Image URL</label>
                      <input value={bgImage} onChange={(e) => setBgImage(e.target.value)} placeholder="https://..." />
                    </div>
                  )}
                </div>
                <div className="ct-row">
                  <div className="ct-field">
                    <label>Frame Style</label>
                    <select value={frameStyle} onChange={(e) => setFrameStyle(e.target.value)}>
                      <option value="glass">Glass</option>
                      <option value="shadow">Shadow</option>
                      <option value="plain">Plain</option>
                    </select>
                  </div>
                  <div className="ct-field grow">
                    <label>Browser Volume</label>
                    <input type="range" min="0" max="1" step="0.01" value={browserVolume} onChange={(e) => setBrowserVolume(parseFloat(e.target.value))} disabled={mockMode || hbFallbackIframe} />
                    <div className="ct-tiny">{Math.round(browserVolume * 100)}% {mockMode ? "(mock)" : hbFallbackIframe ? "(iframe fallback)" : ""}</div>
                  </div>
                </div>
                <div className="ct-row">
                  <div className="ct-field grow">
                    <label>Chat Volume</label>
                    <input type="range" min="0" max="1" step="0.01" value={chatVolume} onChange={(e) => setChatVolume(parseFloat(e.target.value))} />
                    <div className="ct-tiny">{Math.round(chatVolume * 100)}% <button className="btn ghost" style={{height:30}} onClick={() => { chatAudioRef.current?.play(); }}>Test</button></div>
                  </div>
                </div>
              </div>
            </section>

            <section className="ct-stage">
              <div className="ct-apps-section">
                <div className="ct-section-title">
                  <span>Apps & Games</span>
                  <button className="btn ghost ct-add-app" onClick={addCustomApp}>+ Add Custom</button>
                </div>
                <div className="ct-apps-grid">
                  {allApps.map(app => (
                    <div key={app.id} className="ct-app-wrapper">
                      <AppIcon app={app} onClick={handleAppLaunch} />
                      {app.isCustom && (
                        <button 
                          className="ct-remove-app" 
                          onClick={() => removeCustomApp(app.id)}
                          title="Remove app"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="ct-stage ct-fullscreen-stage" ref={containerRef}>
            <div className={`ct-frame ${frameStyle} ${isFullscreen ? 'ct-fullscreen-frame' : ''}`}>
              <div className="ct-browser">
                {mockMode ? (
                  <iframe title="Coffee Table" src={session.embed_url} allow="clipboard-read; clipboard-write; autoplay; microphone; camera;" allowFullScreen />
                ) : hbFallbackIframe ? (
                  <iframe title="Coffee Table" src={session.embed_url} allow="clipboard-read; clipboard-write; autoplay; microphone; camera;" allowFullScreen />
                ) : (
                  <div ref={hbMountRef} style={{ width: "100%", height: isFullscreen ? "100vh" : "min(70vh, 760px)", borderRadius: isFullscreen ? 0 : 16, overflow: "hidden", background: "#0b1020" }} />
                )}

                {!isFullscreen && (
                  <div className="ct-overlay">
                    <button className="btn ghost" onClick={enterFullscreen}>Fullscreen</button>
                    <button className="btn ghost" onClick={createShareCode} disabled={loading || !!shareCode}>
                      {shareCode ? `Code: ${shareCode}` : "Share"}
                    </button>
                  </div>
                )}

                {isFullscreen && (
                  <div className="ct-fullscreen-controls">
                    <button className="btn ghost" onClick={enterFullscreen}>Exit Fullscreen</button>
                    <button 
                      className="btn ghost" 
                      onClick={() => setChatOverlay(!chatOverlay)}
                    >
                      {chatOverlay ? "Hide Chat" : "Show Chat"}
                    </button>
                    <button className="btn ghost" onClick={createShareCode} disabled={loading || !!shareCode}>
                      {shareCode ? `Code: ${shareCode}` : "Share"}
                    </button>
                  </div>
                )}

                {session && (
                  <div className="ct-session-info">
                    Session Active • {session.session_uuid} {shareCode ? `• Code ${shareCode}` : ""} {liveMode === 'ws' ? '• Live WS' : liveMode === 'poll' ? '• Live Poll' : ''}
                  </div>
                )}

                {mockMode && <div className="ct-mock-label">MOCK</div>}
                {(!mockMode && hbFallbackIframe) && <div className="ct-mock-label" style={{background:"rgba(239,68,68,0.2)",borderColor:"rgba(239,68,68,0.5)",color:"#fecaca"}}>SDK Fallback</div>}
              </div>
            </div>

            {/* Chat heads overlay - only show if chat overlay is enabled or not in fullscreen */}
            {(!isFullscreen || chatOverlay) && (
              <>
                <DraggableChatHead id={user.id} initial={user.initial} color={user.color} onChange={(head) => sendPresence({ ...head })} />
                {Object.entries(others).map(([uid, cfg]) => (
                  <DraggableChatHead key={uid} id={uid} initial={cfg.initial} color={cfg.color} value={{ pos: cfg.pos, size: cfg.size }} onChange={() => {}} storageKey={`ct_chat_head_${uid}`} />
                ))}
              </>
            )}

            {/* Fixed chat panel - always at bottom in fullscreen */}
            {(!isFullscreen || chatOverlay) && (
              <div className={`ct-chat-panel ${isFullscreen ? 'ct-chat-panel-fullscreen' : ''}`}>
                <button className="btn ghost" onClick={() => setChatOpen((v) => !v)}>
                  {chatOpen ? "Close Chat" : "Open Chat"}{liveMode !== 'none' ? (liveMode === 'ws' ? ' • Live WS' : ' • Live Poll') : ''}
                </button>
                {chatOpen && (
                  <div className="ct-chat-window">
                    <div className="ct-chat-messages">
                      {messages.map((m, i) => (
                        <div key={i} className="ct-chat-item">
                          <span className="ct-chat-tag" style={{background: m.user?.color || '#334155'}}>{m.user?.initial || '👤'}</span>
                          <span className="ct-chat-text">{m.text}</span>
                        </div>
                      ))}
                      {messages.length === 0 && <div className="ct-chat-empty">No messages yet</div>}
                    </div>
                    <div className="ct-chat-input">
                      <input value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Type a message" onKeyDown={(e) => { if (e.key === 'Enter') { sendChat(chatText); setChatText(''); } }} />
                      <button className="btn primary" onClick={() => { sendChat(chatText); setChatText(''); }}>Send</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </main>

      {!session && (
        <footer className="ct-footer">
          <span>Choose an app to get started, or paste your Hyperbeam API key and create a custom session</span>
        </footer>
      )}
    </div>
  );
}

export default App;