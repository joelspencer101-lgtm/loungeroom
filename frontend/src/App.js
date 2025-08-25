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

// Pre-installed Chrome Extensions
const PRE_INSTALLED_EXTENSIONS = [
  {
    id: "pre_extension_1",
    name: "Extension 1",
    url: "https://chromewebstore.google.com/detail/gdcfjidbchfpojnfifkgghbamkdmbdaf",
    enabled: true,
    isPreInstalled: true
  },
  {
    id: "pre_extension_2", 
    name: "Extension 2",
    url: "https://chromewebstore.google.com/detail/mnjggcdmjocbbbhaepdhchncahnbgone",
    enabled: true,
    isPreInstalled: true
  },
  {
    id: "pre_extension_3",
    name: "Extension 3", 
    url: "https://chromewebstore.google.com/detail/mpnfoddkacdjocmjaobmkcphfncdoogp",
    enabled: true,
    isPreInstalled: true
  }
];

// Draggable Session Controls
function DraggableSessionControls({ 
  onCloseSession, 
  onFullscreen, 
  onChatToggle, 
  onShareCode, 
  isFullscreen, 
  chatOverlay, 
  loading, 
  shareCode 
}) {
  const [position, setPosition] = useLocalStorage("ct_session_controls_pos", { x: 20, y: 20 });
  const [isVisible, setIsVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);
  const mouseActivityRef = useRef(null);

  // Mouse activity detection
  useEffect(() => {
    let hideTimeout;

    const handleMouseMove = () => {
      setIsVisible(true);
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => {
        if (!isDragging) {
          setIsVisible(false);
        }
      }, 3000); // Hide after 3 seconds of inactivity
    };

    const handleMouseLeave = () => {
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => {
        if (!isDragging) {
          setIsVisible(false);
        }
      }, 1000);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      clearTimeout(hideTimeout);
    };
  }, [isDragging]);

  // Drag functionality
  useEffect(() => {
    const element = dragRef.current;
    if (!element) return;

    let startX, startY, startPosX, startPosY;

    const handleMouseDown = (e) => {
      if (e.target.closest('button')) return; // Don't drag when clicking buttons
      
      setIsDragging(true);
      startX = e.clientX;
      startY = e.clientY;
      startPosX = position.x;
      startPosY = position.y;

      const handleMouseMove = (e) => {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        const newX = Math.max(0, Math.min(window.innerWidth - 300, startPosX + deltaX));
        const newY = Math.max(0, Math.min(window.innerHeight - 50, startPosY + deltaY));
        setPosition({ x: newX, y: newY });
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };

    element.addEventListener('mousedown', handleMouseDown);

    return () => {
      element.removeEventListener('mousedown', handleMouseDown);
    };
  }, [position]);

  return (
    <div 
      ref={dragRef}
      className={`ct-session-controls-draggable ${isVisible ? 'visible' : 'hidden'} ${isDragging ? 'dragging' : ''}`}
      style={{ left: position.x, top: position.y }}
    >
      <div className="ct-drag-handle">⋮⋮</div>
      <div className="ct-controls-buttons">
        <button className="btn ghost" onClick={onCloseSession} disabled={loading}>
          {loading ? "Closing..." : "← Desktop"}
        </button>
        <button className="btn ghost" onClick={onFullscreen}>
          {isFullscreen ? "Exit FS" : "Fullscreen"}
        </button>
        {isFullscreen && (
          <button className="btn ghost" onClick={onChatToggle}>
            {chatOverlay ? "Hide Chat" : "Show Chat"}
          </button>
        )}
        <button className="btn ghost" onClick={onShareCode} disabled={loading || !!shareCode}>
          {shareCode ? `${shareCode}` : "Share"}
        </button>
      </div>
    </div>
  );
}

// Custom Icon Upload Component
function IconUploader({ onIconSelect, currentIcon }) {
  const [uploadedIcons, setUploadedIcons] = useLocalStorage("ct_uploaded_icons", []);
  const fileInputRef = useRef(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const iconData = {
          id: `uploaded_${Date.now()}`,
          name: file.name,
          dataUrl: e.target.result,
          uploaded: true
        };
        setUploadedIcons(prev => [...prev, iconData]);
        onIconSelect(iconData);
      };
      reader.readAsDataURL(file);
    }
  };

  const defaultIcons = [
    { id: 'age_restriction', emoji: '18+', name: 'Age Restriction' },
    { id: 'gaming_console', emoji: '🎮', name: 'Gaming Console' },
    { id: 'popcorn_movies', emoji: '🍿', name: 'Movies & Entertainment' },
    { id: 'retro_tv', emoji: '📺', name: 'Retro TV' },
    { id: 'sports', emoji: '🏀', name: 'Sports' }
  ];

  return (
    <div className="ct-icon-uploader">
      <div className="ct-icon-grid">
        {defaultIcons.map(icon => (
          <button
            key={icon.id}
            className={`ct-icon-option ${currentIcon?.id === icon.id ? 'selected' : ''}`}
            onClick={() => onIconSelect(icon)}
            title={icon.name}
          >
            <span className="ct-icon-emoji">{icon.emoji}</span>
          </button>
        ))}
        
        {uploadedIcons.map(icon => (
          <button
            key={icon.id}
            className={`ct-icon-option ${currentIcon?.id === icon.id ? 'selected' : ''}`}
            onClick={() => onIconSelect(icon)}
            title={icon.name}
          >
            <img src={icon.dataUrl} alt={icon.name} className="ct-uploaded-icon" />
          </button>
        ))}
        
        <button 
          className="ct-icon-upload-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Upload custom icon"
        >
          <span>+</span>
        </button>
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />
    </div>
  );
}

// Video Chat Head with WebRTC integration
function VideoChatHead({ 
  id = "me", 
  initial = "😀", 
  color = "#8b5cf6", 
  storageKey = "ct_chat_head", 
  value, 
  onChange,
  isMe = false,
  onVideoToggle,
  onAudioToggle,
  videoEnabled = false,
  audioEnabled = false,
  stream = null 
}) {
  const rootRef = useRef(null);
  const videoRef = useRef(null);
  const [pos, setPos] = useLocalStorage(`${storageKey}_pos`, value?.pos || { x: 24, y: 24 });
  const [size, setSize] = useLocalStorage(`${storageKey}_size`, value?.size || 80);
  const dragging = useRef(false);
  const resizing = useRef(false);
  const start = useRef({ x: 0, y: 0, px: 0, py: 0, s: 0 });

  useEffect(() => {
    if (value?.pos) setPos(value.pos);
    if (value?.size) setSize(value.size);
    // eslint-disable-next-line
    }, [value?.pos?.x, value?.pos?.y, value?.size]);

  // Set up video stream
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onPointerDown = (e) => {
      if (e.target.getAttribute("data-resizer") === "1") {
        resizing.current = true;
      } else if (e.target.closest('.ct-video-controls')) {
        return; // Don't drag when clicking video controls
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
      if (resizing.current) nextSize = Math.max(60, Math.min(300, start.current.s + dx));
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
    <div 
      ref={rootRef} 
      className={`ct-chat-head ct-video-chat-head ${videoEnabled ? 'ct-video-active' : ''}`} 
      style={{ left: pos.x, top: pos.y, width: size, height: size, background: videoEnabled ? 'transparent' : color }}
    >
      {videoEnabled && stream ? (
        <>
          <video 
            ref={videoRef} 
            className="ct-video-stream" 
            autoPlay 
            muted={isMe} 
            playsInline
            style={{ width: size, height: size }}
          />
          {!audioEnabled && <div className="ct-muted-indicator">🔇</div>}
        </>
      ) : (
        <div className="ct-chat-initial" style={{ fontSize: Math.max(20, size / 2.8) }} title="Drag to move">
          {initial}
        </div>
      )}
      
      {isMe && (
        <div className="ct-video-controls">
          <button 
            className={`ct-video-btn ${videoEnabled ? 'active' : ''}`}
            onClick={onVideoToggle}
            title={videoEnabled ? "Turn off camera" : "Turn on camera"}
          >
            {videoEnabled ? "📹" : "📷"}
          </button>
          <button 
            className={`ct-video-btn ${audioEnabled ? 'active' : ''}`}
            onClick={onAudioToggle}
            title={audioEnabled ? "Mute" : "Unmute"}
          >
            {audioEnabled ? "🎤" : "🔇"}
          </button>
        </div>
      )}
      
      <div className="ct-resizer" data-resizer="1" title="Drag to resize" />
    </div>
  );
}

// Multicursor component for other users
function MulticursorOverlay({ cursors }) {
  return (
    <div className="ct-multicursor-overlay">
      {Object.entries(cursors).map(([userId, cursor]) => (
        <div
          key={userId}
          className="ct-cursor"
          style={{
            left: cursor.x,
            top: cursor.y,
            borderColor: cursor.color,
            transform: `translate(-2px, -2px)`
          }}
        >
          <div className="ct-cursor-pointer" style={{ backgroundColor: cursor.color }}>
            <svg width="12" height="19" viewBox="0 0 12 19" fill="none">
              <path d="M0 0L0 14L4 10L6 15L8 14L6 9L12 9L0 0Z" fill="currentColor"/>
            </svg>
          </div>
          <div className="ct-cursor-label" style={{ backgroundColor: cursor.color }}>
            {cursor.name}
          </div>
        </div>
      ))}
    </div>
  );
}

// Timeout warning modal
function TimeoutWarning({ show, timeLeft, onStayConnected, onDisconnect }) {
  if (!show) return null;

  return (
    <div className="ct-timeout-modal">
      <div className="ct-timeout-content">
        <div className="ct-timeout-icon">⏰</div>
        <h3>Still there?</h3>
        <p>You've been inactive for a while. We'll disconnect in {timeLeft} seconds if you don't respond.</p>
        <div className="ct-timeout-buttons">
          <button className="btn primary" onClick={onStayConnected}>
            Keep Hanging Out! 🎉
          </button>
          <button className="btn ghost" onClick={onDisconnect}>
            Catch Ya Later! 👋
          </button>
        </div>
      </div>
    </div>
  );
}

// Chrome Extension Manager with Pre-installed Extensions
function ExtensionManager({ extensions, onAddExtension, onRemoveExtension, onToggleExtension }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newExtensionUrl, setNewExtensionUrl] = useState("");

  const handleAddExtension = () => {
    if (newExtensionUrl.trim()) {
      onAddExtension(newExtensionUrl.trim());
      setNewExtensionUrl("");
      setShowAddForm(false);
    }
  };

  return (
    <div className="ct-extension-manager">
      <div className="ct-section-header">
        <span>Chrome Extensions</span>
        <button className="btn ghost ct-small-btn" onClick={() => setShowAddForm(!showAddForm)}>
          + Add
        </button>
      </div>
      
      {showAddForm && (
        <div className="ct-add-extension-form">
          <input
            type="url"
            placeholder="Extension .crx URL or Chrome Store ID"
            value={newExtensionUrl}
            onChange={(e) => setNewExtensionUrl(e.target.value)}
          />
          <button className="btn primary ct-small-btn" onClick={handleAddExtension}>
            Add
          </button>
        </div>
      )}

      <div className="ct-extensions-list">
        {extensions.map(ext => (
          <div key={ext.id} className="ct-extension-item">
            <div className="ct-extension-info">
              <span className="ct-extension-name">
                {ext.name} {ext.isPreInstalled && <span className="ct-pre-installed">📌</span>}
              </span>
              <span className="ct-extension-status">
                {ext.enabled ? "✅ Active" : "⚫ Disabled"}
              </span>
            </div>
            <div className="ct-extension-controls">
              <button 
                className="btn ghost ct-tiny-btn" 
                onClick={() => onToggleExtension(ext.id)}
              >
                {ext.enabled ? "Disable" : "Enable"}
              </button>
              {!ext.isPreInstalled && (
                <button 
                  className="btn danger ct-tiny-btn" 
                  onClick={() => onRemoveExtension(ext.id)}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
        {extensions.length === 0 && (
          <div className="ct-empty-extensions">No extensions loaded</div>
        )}
      </div>
    </div>
  );
}

// Enhanced App Creation Modal
function AppCreationModal({ show, onClose, onSave }) {
  const [appData, setAppData] = useState({
    name: "",
    url: "",
    selectedIcon: null
  });

  const handleSave = () => {
    if (appData.name && appData.url && appData.selectedIcon) {
      onSave({
        ...appData,
        id: `custom-${Date.now()}`,
        icon: appData.selectedIcon.uploaded ? appData.selectedIcon.dataUrl : appData.selectedIcon.emoji,
        color: "#ffffff",
        bg: "linear-gradient(135deg, #667eea, #764ba2)",
        isCustom: true,
        defaultPosition: { x: 100 + Math.random() * 300, y: 200 + Math.random() * 200 }
      });
      setAppData({ name: "", url: "", selectedIcon: null });
      onClose();
    }
  };

  if (!show) return null;

  return (
    <div className="ct-modal-overlay">
      <div className="ct-modal-content">
        <div className="ct-modal-header">
          <h3>Create Custom App</h3>
          <button className="btn ghost" onClick={onClose}>×</button>
        </div>
        
        <div className="ct-modal-body">
          <div className="ct-field">
            <label>App Name</label>
            <input 
              type="text"
              value={appData.name}
              onChange={(e) => setAppData({...appData, name: e.target.value})}
              placeholder="My Custom App"
            />
          </div>
          
          <div className="ct-field">
            <label>App URL</label>
            <input 
              type="url"
              value={appData.url}
              onChange={(e) => setAppData({...appData, url: e.target.value})}
              placeholder="https://example.com"
            />
          </div>
          
          <div className="ct-field">
            <label>Choose Icon</label>
            <IconUploader 
              currentIcon={appData.selectedIcon}
              onIconSelect={(icon) => setAppData({...appData, selectedIcon: icon})}
            />
          </div>
        </div>
        
        <div className="ct-modal-footer">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button 
            className="btn primary" 
            onClick={handleSave}
            disabled={!appData.name || !appData.url || !appData.selectedIcon}
          >
            Create App
          </button>
        </div>
      </div>
    </div>
  );
}

// Draggable App Icon Component
function DraggableAppIcon({ app, position, onPositionChange, onClick, onRemove, className = "" }) {
  const rootRef = useRef(null);
  const dragging = useRef(false);
  const start = useRef({ x: 0, y: 0, px: 0, py: 0 });

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    
    const onPointerDown = (e) => {
      const removeBtn = e.target.closest('.ct-remove-app');
      if (removeBtn) return; // Don't drag when clicking remove button
      dragging.current = true;
      start.current = { x: e.clientX, y: e.clientY, px: position.x, py: position.y };
      el.setPointerCapture(e.pointerId);
      el.style.zIndex = '1000';
      e.preventDefault();
    };
    
    const onPointerMove = (e) => {
      if (!dragging.current) return;
      const dx = e.clientX - start.current.x;
      const dy = e.clientY - start.current.y;
      const newPos = { 
        x: Math.max(0, Math.min(window.innerWidth - 120, start.current.px + dx)), 
        y: Math.max(0, Math.min(window.innerHeight - 120, start.current.py + dy))
      };
      onPositionChange(app.id, newPos);
    };
    
    const onPointerUp = (e) => {
      if (dragging.current) {
        dragging.current = false;
        el.style.zIndex = '';
        try { el.releasePointerCapture(e.pointerId); } catch {}
      }
    };
    
    const onClickHandler = (e) => {
      if (!dragging.current && !e.target.closest('.ct-remove-app')) {
        onClick(app);
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    el.addEventListener("click", onClickHandler);
    
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("click", onClickHandler);
    };
  }, [app, position, onPositionChange, onClick]);

  return (
    <div 
      ref={rootRef}
      className={`ct-app-icon ct-draggable-app ${className}`} 
      style={{ 
        position: 'absolute',
        left: position.x,
        top: position.y,
        background: app.bg,
        cursor: dragging.current ? 'grabbing' : 'grab'
      }}
      title={app.name}
      aria-label={`Launch ${app.name}`}
    >
      <div className="ct-app-icon-content">
        <div className="ct-app-icon-symbol" style={{ color: app.color }}>
          {app.icon?.startsWith('data:') ? (
            <img src={app.icon} alt={app.name} className="ct-app-custom-icon" />
          ) : (
            app.icon || "🌐"
          )}
        </div>
        <div className="ct-app-icon-name">{app.name}</div>
      </div>
      {app.isCustom && (
        <button 
          className="ct-remove-app" 
          onClick={(e) => { e.stopPropagation(); onRemove(app.id); }}
          title="Remove app"
        >
          ×
        </button>
      )}
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

// Default apps and games with initial positions
const DEFAULT_APPS = [
  { 
    id: "youtube", 
    name: "YouTube", 
    url: "https://www.youtube.com", 
    icon: "▶", 
    color: "#ffffff", 
    bg: "linear-gradient(135deg, #ff0000, #cc0000)",
    defaultPosition: { x: 100, y: 200 }
  },
  { 
    id: "netflix", 
    name: "Netflix", 
    url: "https://www.netflix.com", 
    icon: "N", 
    color: "#ffffff", 
    bg: "linear-gradient(135deg, #e50914, #b20710)",
    defaultPosition: { x: 250, y: 200 }
  },
  { 
    id: "twitch", 
    name: "Twitch", 
    url: "https://www.twitch.tv", 
    icon: "T", 
    color: "#ffffff", 
    bg: "linear-gradient(135deg, #9146ff, #6441a4)",
    defaultPosition: { x: 400, y: 200 }
  },
  { 
    id: "spotify", 
    name: "Spotify", 
    url: "https://open.spotify.com", 
    icon: "♪", 
    color: "#ffffff", 
    bg: "linear-gradient(135deg, #1db954, #168c41)",
    defaultPosition: { x: 550, y: 200 }
  },
  { 
    id: "bluey-keepy-uppy", 
    name: "Keepy Uppy", 
    url: "https://embed.cbeebies.com/bluey-keepy-uppy/", 
    icon: "⚽", 
    color: "#ffffff", 
    bg: "linear-gradient(135deg, #ff6b6b, #4ecdc4)",
    isGame: true,
    defaultPosition: { x: 175, y: 350 }
  },
  { 
    id: "bluey-xylophone", 
    name: "Magic Xylophone", 
    url: "https://embed.cbeebies.com/bluey-magic-xylophone/", 
    icon: "🎵", 
    color: "#ffffff", 
    bg: "linear-gradient(135deg, #a8e6cf, #ff8b94)",
    isGame: true,
    defaultPosition: { x: 325, y: 350 }
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

  // Advanced Hyperbeam features
  const [persistenceEnabled, setPersistenceEnabled] = useLocalStorage("ct_persistence", true);
  const [multicursorEnabled, setMulticursorEnabled] = useLocalStorage("ct_multicursor", true);
  const [extensions, setExtensions] = useLocalStorage("ct_extensions", PRE_INSTALLED_EXTENSIONS);
  const [cursors, setCursors] = useState({});

  // Video chat features
  const [videoEnabled, setVideoEnabled] = useLocalStorage("ct_video_enabled", false);
  const [audioEnabled, setAudioEnabled] = useLocalStorage("ct_audio_enabled", false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // userId -> stream
  const [peerConnections, setPeerConnections] = useState({}); // userId -> RTCPeerConnection

  // Timeout management
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [timeoutCountdown, setTimeoutCountdown] = useState(120);
  const lastActivityRef = useRef(Date.now());
  const timeoutWarningRef = useRef(null);
  const disconnectTimeoutRef = useRef(null);

  // User's custom bookmarks and app positions
  const [customApps, setCustomApps] = useLocalStorage("ct_custom_apps", []);
  const [appPositions, setAppPositions] = useLocalStorage("ct_app_positions", {});

  // UI States
  const [showSettings, setShowSettings] = useState(false);
  const [showAppModal, setShowAppModal] = useState(false);

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

  // Initialize extensions with pre-installed ones if not already set
  useEffect(() => {
    if (extensions.length === 0) {
      setExtensions(PRE_INSTALLED_EXTENSIONS);
    }
  }, [extensions.length, setExtensions]);

  // WebRTC Video Chat Setup
  const initializeWebRTC = useCallback(async () => {
    try {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoEnabled,
        audio: audioEnabled
      });
      
      setLocalStream(stream);
      
      // Enable/disable tracks based on settings
      stream.getVideoTracks().forEach(track => {
        track.enabled = videoEnabled;
      });
      stream.getAudioTracks().forEach(track => {
        track.enabled = audioEnabled;
      });
      
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setVideoEnabled(false);
      setAudioEnabled(false);
    }
  }, [videoEnabled, audioEnabled, localStream]);

  // Initialize WebRTC when video/audio settings change
  useEffect(() => {
    if (videoEnabled || audioEnabled) {
      initializeWebRTC();
    } else {
      // Stop all tracks when disabled
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
    }
    // eslint-disable-next-line
  }, [videoEnabled, audioEnabled]);

  // WebRTC signaling through existing chat system
  const sendWebRTCSignal = useCallback((signal, targetUserId = null) => {
    if (!shareCode) return;
    const payload = { 
      type: "webrtc_signal", 
      signal, 
      targetUserId,
      user 
    };
    if (wsRef.current && liveMode === "ws") {
      try { wsRef.current.send(JSON.stringify(payload)); } catch {}
    } else {
      postEvent(shareCode, payload);
    }
  }, [shareCode, liveMode, user]);

  // Create peer connection for a user
  const createPeerConnection = useCallback((userId) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Add local stream tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    // Handle incoming stream
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setRemoteStreams(prev => ({
        ...prev,
        [userId]: remoteStream
      }));
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendWebRTCSignal({
          type: 'ice-candidate',
          candidate: event.candidate
        }, userId);
      }
    };

    setPeerConnections(prev => ({
      ...prev,
      [userId]: pc
    }));

    return pc;
  }, [localStream, sendWebRTCSignal]);

  // Handle WebRTC signaling
  const handleWebRTCSignal = useCallback(async (data) => {
    const { signal, user: signalUser } = data;
    const userId = signalUser.id;
    
    if (userId === user.id) return; // Ignore own signals
    
    let pc = peerConnections[userId];
    if (!pc) {
      pc = createPeerConnection(userId);
    }

    try {
      switch (signal.type) {
        case 'offer':
          await pc.setRemoteDescription(signal.offer);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendWebRTCSignal({
            type: 'answer',
            answer: answer
          }, userId);
          break;
          
        case 'answer':
          await pc.setRemoteDescription(signal.answer);
          break;
          
        case 'ice-candidate':
          await pc.addIceCandidate(signal.candidate);
          break;
      }
    } catch (error) {
      console.error('WebRTC signaling error:', error);
    }
  }, [user.id, peerConnections, createPeerConnection, sendWebRTCSignal]);

  // Start video call with all users
  const startVideoCall = useCallback(async () => {
    if (!localStream) return;
    
    // Create offers for all other users
    Object.keys(others).forEach(async (userId) => {
      const pc = peerConnections[userId] || createPeerConnection(userId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendWebRTCSignal({
          type: 'offer',
          offer: offer
        }, userId);
      } catch (error) {
        console.error('Error creating offer:', error);
      }
    });
  }, [localStream, others, peerConnections, createPeerConnection, sendWebRTCSignal]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    setVideoEnabled(prev => !prev);
  }, []);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    setAudioEnabled(prev => !prev);
  }, []);

  // Activity tracking for timeout management
  useEffect(() => {
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
      if (showTimeoutWarning) {
        setShowTimeoutWarning(false);
        if (timeoutWarningRef.current) clearTimeout(timeoutWarningRef.current);
        if (disconnectTimeoutRef.current) clearTimeout(disconnectTimeoutRef.current);
      }
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, updateActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity, true);
      });
    };
  }, [showTimeoutWarning]);

  // Timeout management (58 minutes = 3480000ms, then 2-minute countdown)
  useEffect(() => {
    if (!session) return;

    const checkActivity = () => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivityRef.current;
      const INACTIVE_THRESHOLD = 58 * 60 * 1000; // 58 minutes

      if (timeSinceActivity >= INACTIVE_THRESHOLD && !showTimeoutWarning) {
        setShowTimeoutWarning(true);
        setTimeoutCountdown(120); // 2 minutes

        // Start countdown
        const countdownInterval = setInterval(() => {
          setTimeoutCountdown(prev => {
            if (prev <= 1) {
              clearInterval(countdownInterval);
              handleTimeoutDisconnect();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        disconnectTimeoutRef.current = setTimeout(() => {
          handleTimeoutDisconnect();
        }, 120000); // 2 minutes
      }
    };

    const activityTimer = setInterval(checkActivity, 30000); // Check every 30 seconds
    return () => clearInterval(activityTimer);
  }, [session, showTimeoutWarning]);

  const handleTimeoutDisconnect = () => {
    setShowTimeoutWarning(false);
    closeSession();
  };

  const handleStayConnected = () => {
    lastActivityRef.current = Date.now();
    setShowTimeoutWarning(false);
    if (timeoutWarningRef.current) clearTimeout(timeoutWarningRef.current);
    if (disconnectTimeoutRef.current) clearTimeout(disconnectTimeoutRef.current);
  };

  // Initialize app positions
  const allApps = useMemo(() => [...DEFAULT_APPS, ...customApps], [customApps]);
  
  const getAppPosition = (appId) => {
    if (appPositions[appId]) return appPositions[appId];
    const app = allApps.find(a => a.id === appId);
    return app?.defaultPosition || { x: 100 + Math.random() * 200, y: 200 + Math.random() * 200 };
  };

  const updateAppPosition = (appId, position) => {
    setAppPositions(prev => ({ ...prev, [appId]: position }));
  };

  // Advanced Hyperbeam SDK initialization with all features including pre-installed extensions
  useEffect(() => {
    let destroyed = false;

    async function initAdvancedHB() {
      if (!session || mockMode) { cleanupHB(); return; }
      setHbReady(false);
      setHbFallbackIframe(false);
      
      try {
        const mod = await import("@hyperbeam/web");
        const Hyperbeam = mod.default || mod;
        if (!hbMountRef.current) return;
        if (hbClientRef.current) { try { hbClientRef.current.destroy(); } catch {} hbClientRef.current = null; }
        
        // Advanced configuration with pre-installed extensions
        const config = {
          volume: browserVolume,
          timeout: 15000,
          delegateKeyboard: true,
          // Persistence feature
          persistence: persistenceEnabled ? {
            enabled: true,
            namespace: `ct_${user.id}_${session.session_uuid.slice(-8)}`
          } : false,
          // Multicursor feature
          multicursor: multicursorEnabled ? {
            enabled: true,
            showCursors: true,
            cursorColors: true
          } : false,
          // Custom Chrome extensions including pre-installed ones
          extensions: extensions.filter(ext => ext.enabled).map(ext => ext.url),
          // Dynamic resize capability
          resize: {
            enabled: true,
            maintainAspectRatio: false
          }
        };

        const client = await Hyperbeam(hbMountRef.current, session.embed_url, config);
        if (destroyed) { try { client.destroy(); } catch {} return; }
        
        hbClientRef.current = client;
        
        // Set up multicursor event handlers
        if (multicursorEnabled && client.multicursor) {
          client.multicursor.on('cursor', (data) => {
            setCursors(prev => ({
              ...prev,
              [data.userId]: {
                x: data.x,
                y: data.y,
                color: data.color || '#8b5cf6',
                name: data.name || 'User'
              }
            }));
          });

          client.multicursor.on('cursor-leave', (data) => {
            setCursors(prev => {
              const newCursors = { ...prev };
              delete newCursors[data.userId];
              return newCursors;
            });
          });
        }

        // Set up resize handlers
        if (client.resize) {
          client.resize.on('size-changed', (data) => {
            console.log('Browser resized:', data.width, 'x', data.height);
          });
        }

        setHbReady(true);
      } catch (e) { 
        console.error("Advanced HB SDK failed", e); 
        setHbFallbackIframe(true); 
      }
    }

    initAdvancedHB();
    return () => { destroyed = true; cleanupHB(); };
    // eslint-disable-next-line
  }, [session?.embed_url, mockMode, persistenceEnabled, multicursorEnabled, extensions]);

  useEffect(() => { 
    if (hbClientRef.current) { 
      try { 
        hbClientRef.current.volume = browserVolume; 
        
        // Dynamic resize based on container
        if (hbClientRef.current.resize && hbMountRef.current) {
          const rect = hbMountRef.current.getBoundingClientRect();
          hbClientRef.current.resize.setSize(rect.width, rect.height);
        }
      } catch {} 
    } 
  }, [browserVolume, isFullscreen]);

  function cleanupHB() { 
    if (hbClientRef.current) { 
      try { hbClientRef.current.destroy(); } catch {} 
      hbClientRef.current = null; 
    } 
    setHbReady(false); 
    setCursors({});
  }

  // Extension management
  const addExtension = (url) => {
    const newExtension = {
      id: Date.now().toString(),
      name: url.includes('chrome.google.com') ? 'Chrome Store Extension' : 'Custom Extension',
      url: url,
      enabled: true,
      isPreInstalled: false
    };
    setExtensions(prev => [...prev, newExtension]);
  };

  const removeExtension = (id) => {
    setExtensions(prev => prev.filter(ext => ext.id !== id));
  };

  const toggleExtension = (id) => {
    setExtensions(prev => prev.map(ext => 
      ext.id === id ? { ...ext, enabled: !ext.enabled } : ext
    ));
  };

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
      ws.onerror = () => {
        // If WS fails, fall back to HTTP polling
        setLiveMode("poll");
        startPolling(code);
      };
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
    if (data.type === "webrtc_signal") {
      handleWebRTCSignal(data);
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
      // Clean up video chat
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
      Object.values(peerConnections).forEach(pc => pc.close());
      setPeerConnections({});
      setRemoteStreams({});
      return;
    }
  }, [user.id, handleWebRTCSignal, localStream, peerConnections]);

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
      // Start video call if enabled
      if (videoEnabled || audioEnabled) {
        setTimeout(startVideoCall, 1000); // Give time for others to connect
      }
    }
    return () => { stopPolling(); stopWS(); };
  }, [session, shareCode, startWS, stopPolling, stopWS, videoEnabled, audioEnabled, startVideoCall]);

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

  // Launch app/game with advanced Hyperbeam features including pre-installed extensions
  const createSessionWithUrl = async (url) => {
    setLoading(true);
    setError("");
    lastActivityRef.current = Date.now(); // Reset activity timer
    
    try {
      if (mockMode) {
        const fake = { session_uuid: uuid(), embed_url: mockEmbedDataUrl(), created_at: new Date().toISOString(), metadata: { width: Number(size.width) || 1280, height: Number(size.height) || 720, start_url: url } };
        setSession(fake); setShareCode("");
      } else {
        if (!apiKey) { alert("Please paste your Hyperbeam API key"); return; }
        
        // Enhanced payload with advanced features including pre-installed extensions
        const payload = { 
          start_url: url, 
          width: Number(size.width) || 1280, 
          height: Number(size.height) || 720, 
          kiosk: true, 
          timeout_absolute: 3600, 
          timeout_inactive: 1800,
          // Advanced Hyperbeam features
          persistence: persistenceEnabled,
          multicursor: multicursorEnabled,
          extensions: extensions.filter(ext => ext.enabled).map(ext => ext.url)
        };
        
        const res = await axios.post(`${API}/hb/sessions`, payload, { headers });
        setSession(res.data); setShareCode("");
      }
    } catch (err) { 
      console.error(err); 
      setError(err?.response?.data?.detail || err.message || "Failed to create session"); 
    }
    finally { setLoading(false); }
  };

  const createSession = async (e) => {
    e && e.preventDefault();
    return createSessionWithUrl(startUrl);
  };

  const closeSession = async () => {
    if (!session) return; 
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
    finally { 
      cleanupHB(); 
      setSession(null); 
      setShareCode(""); 
      stopPolling(); 
      stopWS(); 
      setLiveMode("none"); 
      setOthers({}); 
      setMessages([]); 
      setLoading(false);
      // Reset timeout states
      setShowTimeoutWarning(false);
      if (timeoutWarningRef.current) clearTimeout(timeoutWarningRef.current);
      if (disconnectTimeoutRef.current) clearTimeout(disconnectTimeoutRef.current);
      // Clean up video chat
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
      Object.values(peerConnections).forEach(pc => pc.close());
      setPeerConnections({});
      setRemoteStreams({});
    }
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

  // Enhanced fullscreen with proper aspect ratio
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

  // Enhanced app creation
  const handleCreateApp = (appData) => {
    setCustomApps(prev => [...prev, appData]);
  };

  // Remove custom app
  const removeCustomApp = (appId) => {
    if (window.confirm("Remove this app?")) {
      setCustomApps(prev => prev.filter(app => app.id !== appId));
      setAppPositions(prev => {
        const newPos = { ...prev };
        delete newPos[appId];
        return newPos;
      });
    }
  };

  return (
    <div className="ct-root" style={bgStyle}>
      {mockMode && (<div className="ct-banner">Mock Mode is ON — no calls to Hyperbeam; sessions and rooms are simulated.</div>)}

      <audio ref={chatAudioRef} src="https://cdn.pixabay.com/download/audio/2022/03/15/audio_ade9b8b35e.mp3?filename=ping-notification-180739.mp3" preload="auto" />
      {!session && loopVideo ? (<video className="ct-bg-video" src={loopVideo} autoPlay muted loop playsInline />) : null}

      {/* Timeout Warning Modal */}
      <TimeoutWarning 
        show={showTimeoutWarning}
        timeLeft={timeoutCountdown}
        onStayConnected={handleStayConnected}
        onDisconnect={handleTimeoutDisconnect}
      />

      {/* App Creation Modal */}
      <AppCreationModal 
        show={showAppModal}
        onClose={() => setShowAppModal(false)}
        onSave={handleCreateApp}
      />

      {!session ? (
        <>
          {/* Homepage - App Desktop */}
          <header className="ct-header">
            <div className="ct-header-row">
              <div>
                <div className="ct-title">Coffee Table</div>
                <div className="ct-sub">Advanced virtual browser with video chat & collaboration</div>
              </div>
              <div className="ct-header-actions">
                <button className="btn ghost" onClick={() => setShowSettings(!showSettings)}>
                  ⚙️ Settings
                </button>
              </div>
            </div>
          </header>

          {/* Advanced Settings Panel */}
          {showSettings && (
            <div className="ct-settings-panel">
              <div className="ct-settings-content">
                <div className="ct-settings-header">
                  <h3>Advanced Settings</h3>
                  <button className="btn ghost" onClick={() => setShowSettings(false)}>×</button>
                </div>

                <div className="ct-settings-section">
                  <h4>Hyperbeam Configuration</h4>
                  <div className="ct-field">
                    <label>API Key</label>
                    <input 
                      type="password" 
                      value={mockMode ? "" : apiKey} 
                      onChange={(e) => setApiKey(e.target.value)} 
                      placeholder={mockMode ? "Disabled in Mock Mode" : "sk_..."} 
                      disabled={mockMode} 
                    />
                  </div>
                  <div className="ct-toggle">
                    <input id="mockMode" type="checkbox" checked={!!mockMode} onChange={(e) => setMockMode(e.target.checked)} />
                    <label htmlFor="mockMode">Mock Mode (No API calls)</label>
                  </div>
                </div>

                <div className="ct-settings-section">
                  <h4>Advanced Features</h4>
                  <div className="ct-toggle">
                    <input id="persistence" type="checkbox" checked={!!persistenceEnabled} onChange={(e) => setPersistenceEnabled(e.target.checked)} />
                    <label htmlFor="persistence">🔄 Persistence (Save browser state)</label>
                  </div>
                  <div className="ct-toggle">
                    <input id="multicursor" type="checkbox" checked={!!multicursorEnabled} onChange={(e) => setMulticursorEnabled(e.target.checked)} />
                    <label htmlFor="multicursor">🖱️ Multicursor (Multiple user cursors)</label>
                  </div>
                </div>

                <div className="ct-settings-section">
                  <h4>Video Chat</h4>
                  <div className="ct-toggle">
                    <input id="videoEnabled" type="checkbox" checked={!!videoEnabled} onChange={(e) => setVideoEnabled(e.target.checked)} />
                    <label htmlFor="videoEnabled">📹 Enable Video Chat</label>
                  </div>
                  <div className="ct-toggle">
                    <input id="audioEnabled" type="checkbox" checked={!!audioEnabled} onChange={(e) => setAudioEnabled(e.target.checked)} />
                    <label htmlFor="audioEnabled">🎤 Enable Audio Chat</label>
                  </div>
                </div>

                <div className="ct-settings-section">
                  <ExtensionManager 
                    extensions={extensions}
                    onAddExtension={addExtension}
                    onRemoveExtension={removeExtension}
                    onToggleExtension={toggleExtension}
                  />
                </div>

                <div className="ct-settings-section">
                  <h4>Quick Backgrounds</h4>
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
                </div>

                <div className="ct-settings-section">
                  <h4>Join Session</h4>
                  <div className="ct-join">
                    <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="Enter code" />
                    <button className="btn primary" onClick={joinByCode} disabled={loading || !joinCode}>Join</button>
                  </div>
                </div>

                <div className="ct-settings-section">
                  <h4>Add Custom App</h4>
                  <button className="btn primary" onClick={() => setShowAppModal(true)}>+ Add Custom App</button>
                </div>

                {error && <div className="ct-alert error">{String(error)}</div>}
              </div>
            </div>
          )}

          {/* Desktop with Draggable Apps */}
          <div className="ct-desktop">
            {allApps.map(app => (
              <DraggableAppIcon
                key={app.id}
                app={app}
                position={getAppPosition(app.id)}
                onPositionChange={updateAppPosition}
                onClick={handleAppLaunch}
                onRemove={removeCustomApp}
              />
            ))}
          </div>

        </>
      ) : (
        /* Session View - Advanced Hyperbeam Browser with Video Chat */
        <div className="ct-session-view" ref={containerRef}>
          <div className={`ct-browser-container ${isFullscreen ? 'ct-browser-fullscreen' : ''}`}>
            <div className="ct-browser">
              {mockMode ? (
                <iframe 
                  title="Coffee Table" 
                  src={session.embed_url} 
                  allow="clipboard-read; clipboard-write; autoplay; microphone; camera;" 
                  allowFullScreen 
                  className="ct-browser-iframe"
                />
              ) : hbFallbackIframe ? (
                <iframe 
                  title="Coffee Table" 
                  src={session.embed_url} 
                  allow="clipboard-read; clipboard-write; autoplay; microphone; camera;" 
                  allowFullScreen 
                  className="ct-browser-iframe"
                />
              ) : (
                <div 
                  ref={hbMountRef} 
                  className="ct-hyperbeam-mount"
                />
              )}
              {/* WS Connectivity indicator & self-test */}
              <div style={{ position: "absolute", top: 20, right: 20, zIndex: 60 }}>
                <button className="btn ghost" onClick={() => {
                  if (!shareCode) return;
                  try {
                    if (wsRef.current && liveMode === "ws") {
                      wsRef.current.send(JSON.stringify({ type: "chat", text: "WS self-test ping", user }));
                    } else {
                      postEvent(shareCode, { type: "chat", text: "Poll self-test ping", user });
                    }
                  } catch (e) {}
                }}>
                  {liveMode === 'ws' ? '• WS Connected' : liveMode === 'poll' ? '• Live Poll' : '• Offline'}
                </button>
              </div>

              {/* Multicursor Overlay */}
              {multicursorEnabled && !mockMode && (
                <MulticursorOverlay cursors={cursors} />
              )}

              {/* Mouse-Interactive Draggable Session Controls */}
              <DraggableSessionControls
                onCloseSession={closeSession}
                onFullscreen={enterFullscreen}
                onChatToggle={() => setChatOverlay(!chatOverlay)}
                onShareCode={createShareCode}
                isFullscreen={isFullscreen}
                chatOverlay={chatOverlay}
                loading={loading}
                shareCode={shareCode}
              />

              {/* Advanced Features Status */}
              <div className="ct-session-info">
                {session.session_uuid} {shareCode ? `• ${shareCode}` : ""} {liveMode === 'ws' ? '• Live WS' : liveMode === 'poll' ? '• Live Poll' : ''}
                {persistenceEnabled && !mockMode && " • 🔄 Persistent"}
                {multicursorEnabled && !mockMode && " • 🖱️ Multicursor"}
                {extensions.filter(e => e.enabled).length > 0 && !mockMode && ` • 🧩 ${extensions.filter(e => e.enabled).length} Extensions`}
                {(videoEnabled || audioEnabled) && " • 📹 Video Chat"}
              </div>

              {mockMode && <div className="ct-mock-label">MOCK</div>}
              {(!mockMode && hbFallbackIframe) && <div className="ct-mock-label" style={{background:"rgba(239,68,68,0.2)",borderColor:"rgba(239,68,68,0.5)",color:"#fecaca"}}>SDK Fallback</div>}
            </div>
          </div>

          {/* Video Chat Heads - only show if chat overlay is enabled or not in fullscreen */}
          {(!isFullscreen || chatOverlay) && (
            <>
              <VideoChatHead 
                id={user.id} 
                initial={user.initial} 
                color={user.color} 
                onChange={(head) => sendPresence({ ...head })}
                isMe={true}
                onVideoToggle={toggleVideo}
                onAudioToggle={toggleAudio}
                videoEnabled={videoEnabled}
                audioEnabled={audioEnabled}
                stream={localStream}
              />
              {Object.entries(others).map(([uid, cfg]) => (
                <VideoChatHead 
                  key={uid} 
                  id={uid} 
                  initial={cfg.initial} 
                  color={cfg.color} 
                  value={{ pos: cfg.pos, size: cfg.size }} 
                  onChange={() => {}} 
                  storageKey={`ct_chat_head_${uid}`}
                  isMe={false}
                  videoEnabled={!!remoteStreams[uid]}
                  audioEnabled={!!remoteStreams[uid]}
                  stream={remoteStreams[uid]}
                />
              ))}
            </>
          )}

          {/* Fixed chat panel */}
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
        </div>
      )}

      {!session && (
        <footer className="ct-footer">
          <span>Drag apps to arrange your desktop • Click apps to launch • Advanced features: Video Chat, Persistence, Multicursor, Extensions</span>
        </footer>
      )}
    </div>
  );
}

export default App;