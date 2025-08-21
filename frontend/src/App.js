import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);
  return [value, setValue];
}

function DraggableChatHead({ id = "me", initial = "😀", color = "#8b5cf6", storageKey = "ct_chat_head" }) {
  const rootRef = useRef(null);
  const [pos, setPos] = useLocalStorage(`${storageKey}_pos`, { x: 24, y: 24 });
  const [size, setSize] = useLocalStorage(`${storageKey}_size`, 64);
  const dragging = useRef(false);
  const resizing = useRef(false);
  const start = useRef({ x: 0, y: 0, px: 0, py: 0, s: 0 });

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
      if (dragging.current) setPos({ x: Math.max(0, start.current.px + dx), y: Math.max(0, start.current.py + dy) });
      if (resizing.current) setSize(Math.max(48, Math.min(200, start.current.s + dx)));
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
  }, [pos, size, setPos, setSize]);

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
const uuid = () => "mock-" + Math.random().toString(16).slice(2) + Date.now().toString(16);
const genCode = (n = 6) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
};
const getMockRooms = () => {
  try { return JSON.parse(localStorage.getItem("ct_mock_rooms") || "{}"); } catch { return {}; }
};
const setMockRooms = (obj) => { try { localStorage.setItem("ct_mock_rooms", JSON.stringify(obj)); } catch {} };
const mockEmbedDataUrl = (title = "Coffee Table Mock Browser") => {
  const html = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title><style>html,body{height:100%;margin:0;background:#0b1020;color:#e5e7eb;font-family:system-ui, -apple-system, Segoe UI, Roboto} .wrap{display:grid;place-items:center;height:100%} .card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:24px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.5);} .pulse{width:12px;height:12px;border-radius:12px;background:#22c55e;display:inline-block;box-shadow:0 0 0 0 rgba(34,197,94,.7);animation:pulse 1.8s infinite;} @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.7)}70%{box-shadow:0 0 0 18px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}} .muted{opacity:.8} </style></head><body><div class="wrap"><div class="card"><div style="font-size:18px;font-weight:800;letter-spacing:.4px;margin-bottom:6px">${title}</div><div class="muted" id="clock"></div><div style="margin-top:10px"><span class="pulse"></span> Connected</div></div></div><script>function tick(){ document.getElementById('clock').textContent=new Date().toLocaleString(); } setInterval(tick,1000); tick();</script></body></html>`;
  return "data:text/html;base64," + btoa(unescape(encodeURIComponent(html)));
};

function App() {
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem("hb_api_key") || "");
  const [startUrl, setStartUrl] = useState("https://www.google.com");
  const [size, setSize] = useState({ width: 1280, height: 720 });
  const [session, setSession] = useState(null); // { session_uuid, embed_url, created_at, metadata }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [bgType, setBgType] = useLocalStorage("ct_bg_type", "gradient"); // gradient | image
  const [bgImage, setBgImage] = useLocalStorage("ct_bg_image", "");
  const [frameStyle, setFrameStyle] = useLocalStorage("ct_frame_style", "glass");
  const [loopVideo, setLoopVideo] = useLocalStorage("ct_loop_video", "");
  const [mockMode, setMockMode] = useLocalStorage("ct_mock_mode", false);

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

  // chat audio volume (separate from browser audio)
  const [chatVolume, setChatVolume] = useLocalStorage("ct_chat_volume", 0.6);
  const chatAudioRef = useRef(null);
  useEffect(() => {
    if (!chatAudioRef.current) return;
    chatAudioRef.current.volume = chatVolume;
  }, [chatVolume]);

  useEffect(() => {
    if (apiKey) sessionStorage.setItem("hb_api_key", apiKey);
  }, [apiKey]);

  const headers = useMemo(() => ({
    Authorization: `Bearer ${apiKey}`,
  }), [apiKey]);

  // Initialize Hyperbeam SDK when session active in real mode
  useEffect(() => {
    let destroyed = false;

    async function initHB() {
      if (!session || mockMode) {
        cleanupHB();
        return;
      }
      setHbReady(false);
      setHbFallbackIframe(false);
      try {
        const mod = await import("@hyperbeam/web");
        const Hyperbeam = mod.default || mod;
        if (!hbMountRef.current) return;
        // Destroy existing
        if (hbClientRef.current) {
          try { hbClientRef.current.destroy(); } catch {}
          hbClientRef.current = null;
        }
        const client = await Hyperbeam(hbMountRef.current, session.embed_url, {
          volume: browserVolume,
          timeout: 15000,
          delegateKeyboard: true,
        });
        if (destroyed) {
          try { client.destroy(); } catch {}
          return;
        }
        hbClientRef.current = client;
        setHbReady(true);
      } catch (e) {
        console.error("Hyperbeam SDK failed, falling back to iframe", e);
        setHbFallbackIframe(true);
      }
    }

    initHB();
    return () => {
      destroyed = true;
      cleanupHB();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.embed_url, mockMode]);

  // Keep browser volume in sync
  useEffect(() => {
    if (hbClientRef.current) {
      try { hbClientRef.current.volume = browserVolume; } catch {}
    }
  }, [browserVolume]);

  function cleanupHB() {
    if (hbClientRef.current) {
      try { hbClientRef.current.destroy(); } catch {}
      hbClientRef.current = null;
    }
    setHbReady(false);
  }

  const createSession = async (e) => {
    e && e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (mockMode) {
        const fake = {
          session_uuid: uuid(),
          embed_url: mockEmbedDataUrl(),
          created_at: new Date().toISOString(),
          metadata: { width: Number(size.width) || 1280, height: Number(size.height) || 720, start_url: startUrl },
        };
        setSession(fake);
        setShareCode("");
      } else {
        if (!apiKey) {
          alert("Please paste your Hyperbeam API key");
          return;
        }
        const payload = {
          start_url: startUrl,
          width: Number(size.width) || 1280,
          height: Number(size.height) || 720,
          kiosk: true,
          timeout_absolute: 3600,
          timeout_inactive: 1800,
        };
        const res = await axios.post(`${API}/hb/sessions`, payload, { headers });
        setSession(res.data);
        setShareCode("");
      }
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || err.message || "Failed to create session");
    } finally {
      setLoading(false);
    }
  };

  const terminateSession = async () => {
    if (!session) return;
    if (!window.confirm("Terminate this session?")) return;
    setLoading(true);
    setError("");
    try {
      if (mockMode) {
        if (shareCode) {
          const rooms = getMockRooms();
          delete rooms[shareCode];
          setMockRooms(rooms);
        }
      } else {
        await axios.delete(`${API}/hb/sessions/${session.session_uuid}`, { headers });
      }
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || err.message || "Remote terminate error; marked inactive locally");
    } finally {
      cleanupHB();
      setSession(null);
      setShareCode("");
      setLoading(false);
    }
  };

  const createShareCode = async () => {
    if (!session) return;
    try {
      if (mockMode) {
        const code = genCode();
        const rooms = getMockRooms();
        rooms[code] = session; // store snapshot
        setMockRooms(rooms);
        setShareCode(code);
        navigator.clipboard?.writeText(code).catch(() => {});
      } else {
        const res = await axios.post(`${API}/hb/rooms`, { session_uuid: session.session_uuid }, {});
        setShareCode(res.data.code);
        navigator.clipboard?.writeText(res.data.code).catch(() => {});
      }
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || "Failed to create share code");
    }
  };

  const joinByCode = async (e) => {
    e && e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (mockMode) {
        const code = joinCode.toUpperCase();
        const rooms = getMockRooms();
        const s = rooms[code];
        if (!s) throw new Error("Invalid code");
        setSession(s);
        setShareCode(code);
      } else {
        const res = await axios.get(`${API}/hb/rooms/${joinCode}`);
        setSession(res.data);
        setShareCode(joinCode.toUpperCase());
      }
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || err.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const enterFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      el.requestFullscreen?.();
    }
  };

  const bgStyle = useMemo(() => {
    if (bgType === "image" && bgImage) {
      return { backgroundImage: `url(${bgImage})`, backgroundSize: "cover", backgroundPosition: "center" };
    }
    return {};
  }, [bgType, bgImage]);

  return (
    <div className="ct-root" style={bgStyle}>
      {mockMode && (
        <div className="ct-banner">Mock Mode is ON — no calls to Hyperbeam; sessions and rooms are simulated.</div>
      )}

      <audio ref={chatAudioRef} src="https://cdn.pixabay.com/download/audio/2022/03/15/audio_ade9b8b35e.mp3?filename=ping-notification-180739.mp3" preload="auto" />
      {/* Optional looping video when inactive */}
      {!session && loopVideo ? (
        <video className="ct-bg-video" src={loopVideo} autoPlay muted loop playsInline />
      ) : null}

      <header className="ct-header">
        <div className="ct-title">Coffee Table</div>
        <div className="ct-sub">Shared virtual browser powered by Hyperbeam</div>
      </header>

      <main className="ct-main">
        <section className="ct-panel">
          <form onSubmit={createSession} className="ct-form">
            <div className="ct-field">
              <label>Hyperbeam API Key</label>
              <input
                type="password"
                value={mockMode ? "" : apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={mockMode ? "Disabled in Mock Mode" : "sk_..."}
                autoComplete="off"
                disabled={mockMode}
              />
            </div>

            <div className="ct-field">
              <label className="ct-label-row">Start URL <span className="ct-badge">Optional</span></label>
              <input
                type="url"
                value={startUrl}
                onChange={(e) => setStartUrl(e.target.value)}
                placeholder="https://www.google.com"
              />
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
                {!session ? (
                  <button className="btn primary" type="submit" disabled={loading}>
                    {loading ? "Creating..." : "Create Session"}
                  </button>
                ) : (
                  <>
                    <button className="btn danger" type="button" onClick={terminateSession} disabled={loading}>
                      {loading ? "Terminating..." : "Terminate"}
                    </button>
                    <button className="btn ghost" type="button" onClick={createShareCode} disabled={loading || !!shareCode}>
                      {shareCode ? `Code: ${shareCode}` : "Create Share Code"}
                    </button>
                  </>
                )}
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
            {session ? (
              <div className="ct-alert success">
                Session Active • {session.session_uuid} {shareCode ? `• Code ${shareCode}` : ""}
              </div>
            ) : null}
          </form>

          <div className="ct-customize">
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

        <section className="ct-stage" ref={containerRef}>
          <div className={`ct-frame ${frameStyle}`}>
            {!session ? (
              <div className="ct-empty">
                <div>Start a session or join with a code to launch the shared browser</div>
              </div>
            ) : (
              <div className="ct-browser">
                {mockMode ? (
                  <iframe title="Coffee Table" src={session.embed_url} allow="clipboard-read; clipboard-write; autoplay; microphone; camera;" allowFullScreen />
                ) : hbFallbackIframe ? (
                  <iframe title="Coffee Table" src={session.embed_url} allow="clipboard-read; clipboard-write; autoplay; microphone; camera;" allowFullScreen />
                ) : (
                  <div ref={hbMountRef} style={{ width: "100%", height: "min(70vh, 760px)", borderRadius: 16, overflow: "hidden", background: "#0b1020" }} />
                )}

                <div className="ct-overlay">
                  <button className="btn ghost" onClick={enterFullscreen}>Fullscreen</button>
                  <a className="btn ghost" href={session.embed_url} target="_blank" rel="noreferrer">Open Tab</a>
                </div>

                {mockMode && <div className="ct-mock-label">MOCK</div>}
                {(!mockMode && hbFallbackIframe) && <div className="ct-mock-label" style={{background:"rgba(239,68,68,0.2)",borderColor:"rgba(239,68,68,0.5)",color:"#fecaca"}}>SDK Fallback</div>}
              </div>
            )}
          </div>

          {/* Chat heads overlay (local-only positioning/resizing per user) */}
          <DraggableChatHead />
        </section>
      </main>

      <footer className="ct-footer">
        <span>Tip: {mockMode ? "Mock Mode: no Hyperbeam required" : "Paste your Hyperbeam API key above and press Create Session"} • Share your code so friends can join</span>
      </footer>
    </div>
  );
}

export default App;