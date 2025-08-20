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

  const createSession = async (e) => {
    e && e.preventDefault();
    setLoading(true);
    setError("");
    if (!apiKey) {
      setLoading(false);
      alert("Please paste your Hyperbeam API key");
      return;
    }
    try {
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
      await axios.delete(`${API}/hb/sessions/${session.session_uuid}`, { headers });
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || err.message || "Remote terminate error; marked inactive locally");
    } finally {
      setSession(null);
      setShareCode("");
      setLoading(false);
    }
  };

  const createShareCode = async () => {
    if (!session) return;
    try {
      const res = await axios.post(`${API}/hb/rooms`, { session_uuid: session.session_uuid }, {});
      setShareCode(res.data.code);
      navigator.clipboard?.writeText(res.data.code).catch(() => {});
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
      const res = await axios.get(`${API}/hb/rooms/${joinCode}`);
      setSession(res.data);
      setShareCode(joinCode.toUpperCase());
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || "Invalid code");
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
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk_..."
                autoComplete="off"
              />
            </div>
            <div className="ct-field">
              <label>Start URL</label>
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
                <label>Looping Video (shown when inactive)</label>
                <input value={loopVideo} onChange={(e) => setLoopVideo(e.target.value)} placeholder="https://...mp4" />
              </div>
            </div>

            <div className="ct-row">
              <div className="ct-field grow">
                <label>Chat Volume</label>
                <input type="range" min="0" max="1" step="0.01" value={chatVolume} onChange={(e) => setChatVolume(parseFloat(e.target.value))} />
                <div className="ct-tiny">{Math.round(chatVolume * 100)}% <button className="btn ghost" style={{height:30}} onClick={() => { chatAudioRef.current?.play(); }}>Test</button></div>
              </div>
              <div className="ct-field grow">
                <label>Browser Volume</label>
                <input type="range" min="0" max="1" step="0.01" value={1} onChange={() => {}} disabled />
                <div className="ct-tiny">Coming soon (requires Hyperbeam SDK)</div>
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
                {/* Using embed_url directly for MVP; SDK for richer control will replace this */}
                <iframe title="Coffee Table" src={session.embed_url} allow="clipboard-read; clipboard-write; autoplay; microphone; camera;" allowFullScreen />

                <div className="ct-overlay">
                  <button className="btn ghost" onClick={enterFullscreen}>Fullscreen</button>
                  <a className="btn ghost" href={session.embed_url} target="_blank" rel="noreferrer">Open Tab</a>
                </div>
              </div>
            )}
          </div>

          {/* Chat heads overlay (local-only positioning/resizing per user) */}
          <DraggableChatHead />
        </section>
      </main>

      <footer className="ct-footer">
        <span>Tip: paste your Hyperbeam API key above and press Create Session • Share your code so friends can join</span>
      </footer>
    </div>
  );
}

export default App;