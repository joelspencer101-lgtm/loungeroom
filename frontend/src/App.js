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
      // Even if remote terminate fails, mark local UI as inactive to avoid stuck state
      console.error(err);
      setError(err?.response?.data?.detail || err.message || "Remote terminate error; marked inactive locally");
    } finally {
      setSession(null);
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
                <button className="btn danger" type="button" onClick={terminateSession} disabled={loading}>
                  {loading ? "Terminating..." : "Terminate"}
                </button>
              )}
            </div>

            {error ? <div className="ct-alert error">{String(error)}</div> : null}
            {session ? (
              <div className="ct-alert success">
                Session Active • {session.session_uuid}
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
          </div>
        </section>

        <section className="ct-stage" ref={containerRef}>
          <div className={`ct-frame ${frameStyle}`}>
            {!session ? (
              <div className="ct-empty">
                <div>Start a session to launch the shared browser</div>
              </div>
            ) : (
              <div className="ct-browser">
                {/* Using embed_url directly for MVP (SDK adds more control) */}
                <iframe title="Coffee Table" src={session.embed_url} allow="clipboard-read; clipboard-write; autoplay; microphone; camera;" allowFullScreen />

                <div className="ct-overlay">
                  <button className="btn ghost" onClick={enterFullscreen}>Fullscreen</button>
                  <a className="btn ghost" href={session.embed_url} target="_blank" rel="noreferrer">Open Tab</a>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="ct-footer">
        <span>Tip: paste your Hyperbeam API key above and press Create Session</span>
      </footer>
    </div>
  );
}

export default App;