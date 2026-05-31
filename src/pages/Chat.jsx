import React, {
  useState, useRef, useEffect, useCallback, useMemo
} from 'react';
import { io } from 'socket.io-client';
import { useApp } from '../contexts/AppContext';
import api, { getAccessToken } from '../api';
import {
  MdSearch, MdAdd, MdPeople, MdExplore, MdMessage,
  MdSend, MdAttachFile, MdEmojiEmotions, MdSettings,
  MdClose, MdPersonAdd, MdCheck, MdBlock,
  MdArrowBack, MdMoreVert,
} from 'react-icons/md';
import './Chat.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const USER_COLORS = [
  '#0F6E56','#f59e0b','#ec4899','#3b82f6',
  '#f97316','#10b981','#06b6d4','#e11d48',
];
const REACTION_OPTIONS = ['❤️','🙌','😊','🙏','💡','🔥','✨','😂'];
const ACTIVE_POLL_MS   = 5 * 60 * 1000;

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function colorFor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return USER_COLORS[Math.abs(h) % USER_COLORS.length];
}
function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function isOwn(msg, myId) {
  if (!myId) return false;
  if (msg.from === 'me') return true;
  if (msg.userId) return msg.userId.toString() === myId.toString();
  return !!msg._isOptimistic;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ name = '', size = 36 }) {
  return (
    <div className="avatar" style={{
      background: colorFor(name), width: size, height: size,
      fontSize: Math.floor(size * 0.38), minWidth: size,
    }}>
      {name[0]?.toUpperCase() || '?'}
    </div>
  );
}

function MessageBubble({ msg, myId, onReact }) {
  const [hover, setHover] = useState(false);
  const own  = isOwn(msg, myId);
  const name = msg.username || msg.name || 'Unknown';

  return (
    <div
      className={`msg-row${own ? ' msg-row--own' : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {!own && <Avatar name={name} size={30} />}
      <div className="msg-body">
        {!own && (
          <div className="msg-meta">
            <span className="msg-author" style={{ color: colorFor(name) }}>{name}</span>
            <span className="msg-time">{fmtTime(msg.createdAt || msg.time)}</span>
          </div>
        )}
        <div className="msg-bubble-wrap">
          <div className={[
            'msg-bubble',
            own ? 'msg-bubble--own' : '',
            msg._isOptimistic && !msg._failed ? 'msg-bubble--pending' : '',
            msg._failed ? 'msg-bubble--failed' : '',
          ].filter(Boolean).join(' ')}>
            {msg.content || msg.text}
          </div>
          {hover && !msg.isSystem && (
            <div className={`reaction-picker${own ? ' reaction-picker--own' : ''}`}>
              {REACTION_OPTIONS.map(e => (
                <button key={e} className="reaction-opt"
                  onClick={() => onReact(msg._id || msg.id, e)}>{e}</button>
              ))}
            </div>
          )}
        </div>
        {msg.reactions?.length > 0 && (
          <div className="msg-reactions">
            {msg.reactions.map((r, i) => (
              <span key={i} className="reaction-chip">{r.emoji} {r.count}</span>
            ))}
          </div>
        )}
        <div className="msg-footer">
          {own && <span className="msg-own-time">{fmtTime(msg.createdAt || msg.time)}</span>}
          {msg._isOptimistic && !msg._failed && <span className="msg-status">Sending…</span>}
          {msg._failed && <span className="msg-status msg-status--err">⚠ Failed</span>}
        </div>
      </div>
    </div>
  );
}

function DateDivider({ date }) {
  return (
    <div className="date-divider">
      <span className="date-pill">{date}</span>
    </div>
  );
}

function TypingIndicator({ typingUsers }) {
  const names = Object.keys(typingUsers);
  if (!names.length) return null;
  const label = names.length === 1
    ? `${names[0]} is typing…`
    : `${names.length} people are typing…`;
  return (
    <div className="typing-row">
      <div className="typing-dots"><span/><span/><span/></div>
      <span className="typing-label">{label}</span>
    </div>
  );
}

function RoomSkeleton() {
  return (
    <div className="skeleton-list">
      {[1,2,3].map(i => (
        <div key={i} className="sk-row">
          <div className="sk-avatar"/>
          <div className="sk-lines">
            <div className="sk-line sk-line--s"/>
            <div className="sk-line sk-line--l"/>
          </div>
        </div>
      ))}
    </div>
  );
}

function DMBanner({ req, onAccept, onDecline }) {
  return (
    <div className="dm-banner">
      <Avatar name={req.fromUsername || '?'} size={32} />
      <div className="dm-banner-info">
        <b>{req.fromUsername || req.fromName}</b>
        <span>wants to send you a message</span>
      </div>
      <button className="btn-accept" onClick={() => onAccept(req.id)}>
        <MdCheck size={14}/> Accept
      </button>
      <button className="btn-decline" onClick={() => onDecline(req.id)}>
        <MdBlock size={14}/> Decline
      </button>
    </div>
  );
}

function AdminModal({ room, members, myId, onRemove, onTransfer, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <span>Manage · {room?.name}</span>
          <button className="modal-x" onClick={onClose}><MdClose size={16}/></button>
        </div>
        <div className="modal-body">
          <p className="section-label">Members ({members.length})</p>
          {members.map(m => (
            <div key={m.userId} className="admin-row">
              <Avatar name={m.username || '?'} size={30} />
              <span className="admin-name">{m.username}</span>
              {m.isAdmin && <span className="badge-admin">admin</span>}
              {m.userId !== myId && (
                <div className="admin-actions">
                  <button className="btn-sm btn-danger" onClick={() => onRemove(m.userId)}>Remove</button>
                  {!m.isAdmin && (
                    <button className="btn-sm" onClick={() => onTransfer(m.userId)}>Make admin</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CreateModal({ onClose, onCreated }) {
  const [name, setName]     = useState('');
  const [desc, setDesc]     = useState('');
  const [icon, setIcon]     = useState('💬');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const ICONS = ['💬','🌿','🧘','⚡','🎯','🏃','📚','🎨','🌍','🤝'];

  const submit = async () => {
    if (!name.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await api.post('/rooms', { name: name.trim(), description: desc.trim(), icon });
      onCreated(res.data.room);
      onClose();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to create');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <span>Create Community</span>
          <button className="modal-x" onClick={onClose}><MdClose size={16}/></button>
        </div>
        <div className="modal-body">
          <label className="field-label">Icon</label>
          <div className="icon-grid">
            {ICONS.map(ic => (
              <button key={ic} className={`icon-opt${icon===ic?' icon-opt--on':''}`}
                onClick={() => setIcon(ic)}>{ic}</button>
            ))}
          </div>
          <label className="field-label">Name</label>
          <input className="field-input" placeholder="e.g. Morning Routines"
            value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()} />
          <label className="field-label">Description</label>
          <textarea className="field-textarea" rows={3}
            placeholder="What is this community about?"
            value={desc} onChange={e => setDesc(e.target.value)} />
          {error && <p className="field-error">{error}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-confirm" onClick={submit} disabled={!name.trim() || loading}>
            {loading ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── User Search Modal ─────────────────────────────────────────────────────────

function UserSearchModal({ onClose, myId, chatSocket, dmConversations, addDMConversation, setActiveDM, setSidebarTab }) {
  const [q, setQ]             = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [sentIds, setSentIds] = useState(new Set());
  const [status, setStatus]   = useState({}); // userId → 'sent' | 'accepted' | 'existing'

  // Pre-mark existing DM partners
  useEffect(() => {
    const existingMap = {};
    dmConversations.forEach(c => {
      if (c.userId) existingMap[c.userId] = 'existing';
    });
    setStatus(existingMap);
  }, [dmConversations]);

  const search = useCallback(async () => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true); setError('');
    try {
      const res = await api.get('/users/search', { params: { q: trimmed } });
      const users = res.data.users || res.data || [];
      setResults(users.filter(u => u._id?.toString() !== myId && u.id?.toString() !== myId));
    } catch (e) {
      setError(e.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [q, myId]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') search();
  };

  const sendRequest = (user) => {
    const uid = user._id || user.id;
    if (!chatSocket || sentIds.has(uid)) return;
    chatSocket.emit('dm_request', { toId: uid });
    setSentIds(p => new Set([...p, uid]));
    setStatus(p => ({ ...p, [uid]: 'sent' }));
  };

  const openExisting = (user) => {
    const uid = user._id || user.id;
    const conv = dmConversations.find(c => c.userId === uid || c.userId === uid?.toString());
    if (conv) {
      setActiveDM(conv.id);
      setSidebarTab('messages');
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--sm" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <span>Find People</span>
          <button className="modal-x" onClick={onClose}><MdClose size={16}/></button>
        </div>
        <div className="modal-body">
          <div className="user-search-bar">
            <input
              className="field-input"
              placeholder="Search by username or name…"
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <button className="btn-search-go" onClick={search} disabled={loading}>
              {loading ? <span className="spinner-sm"/> : <MdSearch size={18}/>}
            </button>
          </div>
          {error && <p className="field-error">{error}</p>}
          <div className="dm-list">
            {results.length === 0 && !loading && q.trim() && (
              <p style={{ textAlign:'center', color:'var(--color-text-muted)', fontSize:13, padding:'16px 0' }}>
                No users found for "{q}"
              </p>
            )}
            {results.length === 0 && !loading && !q.trim() && (
              <p style={{ textAlign:'center', color:'var(--color-text-muted)', fontSize:13, padding:'16px 0' }}>
                Type a name and press Enter to search
              </p>
            )}
            {results.map(u => {
              const uid   = u._id || u.id;
              const st    = status[uid] || status[uid?.toString()];
              return (
                <div key={uid} className="user-search-row">
                  <Avatar name={u.username || u.name || '?'} size={36}/>
                  <div className="room-info">
                    <span className="room-name">{u.username || u.name}</span>
                    {u.email && <span className="room-meta">{u.email}</span>}
                  </div>
                  {st === 'existing' ? (
                    <button className="btn-sm btn-primary" onClick={() => openExisting(u)}>
                      <MdMessage size={14}/> Message
                    </button>
                  ) : st === 'sent' ? (
                    <span className="badge-pending">Request Sent</span>
                  ) : (
                    <button className="btn-sm btn-primary" onClick={() => sendRequest(u)}>
                      <MdPersonAdd size={14}/> Add
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function JoinPreviewPanel({ room, onJoin, onClose, joining }) {
  return (
    <div className="join-preview">
      <div className="join-preview-inner">
        <div className="join-room-icon">{room.icon || '💬'}</div>
        <h2 className="join-room-name">{room.name}</h2>
        {room.description && <p className="join-room-desc">{room.description}</p>}
        <div className="join-stats">
          <span className="join-stat">
            <span className="join-stat-num">{room.memberCount ?? 0}</span>
            <span className="join-stat-label">members</span>
          </span>
          {room.liveCount > 0 && (
            <span className="join-stat">
              <span className="join-stat-num join-stat-num--live">{room.liveCount}</span>
              <span className="join-stat-label">online now</span>
            </span>
          )}
        </div>
        <button className="btn-join" onClick={onJoin} disabled={joining}>
          {joining ? 'Joining…' : 'Join Community'}
        </button>
        <button className="btn-join-cancel" onClick={onClose}>Maybe later</button>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function Chat() {
  const {
    user, dmConversations, sendDM, receiveDM, addDMConversation,
    activeDM, setActiveDM,
  } = useApp();
  const myId = (user?._id ?? user?.id ?? user?.userId)?.toString();

  // ── State ─────────────────────────────────────────────────────────────────

  const [rooms, setRooms]                 = useState([]);
  const [discoverRooms, setDiscoverRooms] = useState([]);
  const [roomsLoading, setRoomsLoading]   = useState(true);
  const [roomsError, setRoomsError]       = useState('');
  const [activeRoom, setActiveRoom]       = useState(null);

  const [sidebarTab, setSidebarTab]       = useState('communities');
  const [previewRoom, setPreviewRoom]     = useState(null);
  const [joining, setJoining]             = useState(false);
  const [joinError, setJoinError]         = useState('');

  const [messages, setMessages]           = useState([]);
  const [msgsLoading, setMsgsLoading]     = useState(false);
  const [hasMore, setHasMore]             = useState(false);
  const [loadingMore, setLoadingMore]     = useState(false);

  const [roomReady, setRoomReady]         = useState(false);
  const [activeCount, setActiveCount]     = useState(null);
  const [roomMembers, setRoomMembers]     = useState([]);
  const [isAdmin, setIsAdmin]             = useState(false);

  const [search, setSearch]               = useState('');
  const [input, setInput]                 = useState('');
  const [sendError, setSendError]         = useState('');
  const [typingUsers, setTypingUsers]     = useState({});
  const [dmRequests, setDmRequests]       = useState([]);
  const [dmReqIds, setDmReqIds]           = useState(new Set());

  const [showCreate, setShowCreate]       = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [showAdmin, setShowAdmin]         = useState(false);
  const [connected, setConnected]         = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const joinedRooms   = useRef(new Set());
  const typingTimer   = useRef(null);
  const typingEmitted = useRef(false);
  const messagesEl    = useRef(null);
  const bottomEl      = useRef(null);
  const inputEl       = useRef(null);
  const activeRoomRef = useRef(activeRoom);
  const pollTimer     = useRef(null);
  const prevRoomRef   = useRef(null);

  const mode = sidebarTab === 'messages' ? 'dm' : 'group';
  useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);

  // ── Socket ────────────────────────────────────────────────────────────────
  const socketRef = useRef(null);
  const [chatSocket, setChatSocket] = useState(null);
  const [tokenReady, setTokenReady] = useState(false);

  useEffect(() => {
    if (tokenReady) return;
    if (!user) return;
    if (getAccessToken()) { setTokenReady(true); return; }
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (getAccessToken()) { setTokenReady(true); clearInterval(interval); }
      else if (attempts >= 30) { clearInterval(interval); }
    }, 100);
    return () => clearInterval(interval);
  }, [user, tokenReady]);

  useEffect(() => {
    const uid = user?._id ?? user?.id ?? user?.userId;
    if (!uid || !tokenReady) return;
    if (socketRef.current) return;
    const token = getAccessToken();
    const socket = io(
     'https://calmspacebackend.onrender.com/chat',
      {
        withCredentials: true,
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        transports: ['websocket', 'polling'],
        auth: { token },
        query: { token },
      }
    );
    socketRef.current = socket;
    setChatSocket(socket);
    return () => {};
  }, [user, tokenReady]);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // ── Load rooms ─────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      api.get('/rooms/joined'),
      api.get('/rooms'),
    ])
      .then(([joinedRes, discoverRes]) => {
        const joinedList = joinedRes.data.joined ?? [];
        const allPublicList = discoverRes.data.discover
          ? [...(discoverRes.data.joined || []), ...(discoverRes.data.discover || [])]
          : (discoverRes.data.rooms ?? discoverRes.data ?? []);
        setRooms(joinedList);
        setDiscoverRooms(allPublicList);
        if (joinedList.length > 0) {
          setActiveRoom(joinedList[0]._id);
          setSidebarTab('communities');
        } else {
          setSidebarTab('discover');
          setActiveRoom(null);
        }
      })
      .catch((err) => {
        console.error('[Chat] Failed to load rooms:', err);
        setRoomsError('Failed to load communities');
      })
      .finally(() => setRoomsLoading(false));
  }, []);

  // ── Load DM history from API on mount ──────────────────────────────────────
  useEffect(() => {
    if (!myId) return;
    api.get('/dm/conversations')
      .then(res => {
        const convs = res.data.conversations || res.data || [];
        convs.forEach(c => addDMConversation(c));
      })
      .catch(() => {}); // silently fail — static DMs will still show
  }, [myId, addDMConversation]);

  // ── Active count poll ──────────────────────────────────────────────────────
  useEffect(() => {
    clearInterval(pollTimer.current);
    if (!activeRoom || mode !== 'group' || !chatSocket) return;
    chatSocket.emit('get_active_count', { roomId: activeRoom });
    pollTimer.current = setInterval(() => {
      chatSocket?.emit('get_active_count', { roomId: activeRoomRef.current });
    }, ACTIVE_POLL_MS);
    return () => clearInterval(pollTimer.current);
  }, [activeRoom, mode, chatSocket]);

  // ── Socket listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!chatSocket) return;

    const onConnect = () => {
      setConnected(true);
      joinedRooms.current.clear();
      setRoomReady(false);
      if (activeRoomRef.current) {
        chatSocket.emit('join_room', { roomId: activeRoomRef.current });
      }
    };

    const onDisconnect = () => {
      setConnected(false);
      setRoomReady(false);
    };

    const onConnectError = (err) => {
      console.error('[socket connect_error]', err.message, err.data);
      setConnected(false);
    };

    const onNewMessage = (msg) => {
      if (msg.roomId !== activeRoomRef.current) return;
      setMessages(prev => {
        if (msg.tempId) {
          const idx = prev.findIndex(m => m._tempId === msg.tempId);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = { ...msg };
            return next;
          }
        }
        if (prev.some(m => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    };

    const onRoomHistory = ({ roomId, messages: msgs, isPaginated }) => {
      if (roomId !== activeRoomRef.current) return;
      const clean = (msgs || []).filter(m => !m.isSystem);
      if (isPaginated) {
        setMessages(prev => [...clean, ...prev]);
        setHasMore(clean.length === 30);
        setLoadingMore(false);
      } else {
        setMessages(clean);
        setHasMore(clean.length === 30);
        setMsgsLoading(false);
      }
    };

    const onRoomJoined = ({ members, adminId, isAdmin: ia }) => {
      setRoomMembers(members || []);
      setIsAdmin(ia ?? (adminId?.toString() === myId));
      setRoomReady(true);
    };

    const onActiveCount = ({ roomId, count }) => {
      if (roomId !== activeRoomRef.current) return;
      setActiveCount(count);
      setRooms(prev => prev.map(r => r._id === roomId ? { ...r, liveCount: count } : r));
    };

    const onUserTyping = ({ userId, username, isTyping }) => {
      if (!username || userId === myId) return;
      setTypingUsers(prev => {
        const next = { ...prev };
        if (isTyping) next[username] = true; else delete next[username];
        return next;
      });
    };

    const onMemberRemoved = ({ userId, roomId }) => {
      if (roomId !== activeRoomRef.current) return;
      setRoomMembers(prev => prev.filter(m => m.userId !== userId));
      if (userId === myId) {
        setActiveRoom(null);
        setMessages([]);
        setRoomReady(false);
        setSendError('You were removed from this room.');
      }
    };

    const onAdminTransferred = ({ newAdminId }) => {
      setIsAdmin(newAdminId?.toString() === myId);
      setRoomMembers(prev => prev.map(m => ({ ...m, isAdmin: m.userId === newAdminId })));
    };

    const onError = ({ event, message: msg }) => {
      console.warn(`[socket error] ${event}: ${msg}`);
      if (event === 'send_message') {
        setSendError(msg);
        setMessages(prev => prev.map(m =>
          m._isOptimistic ? { ...m, _failed: true } : m
        ));
      }
    };

    // ── DM request: someone wants to DM you ──────────────────────────────────
    const onDmRequest = (req) => {
      setDmRequests(prev => {
        if (prev.some(r => r.id === req.id)) return prev;
        return [...prev, req];
      });
    };

    // ── DM accepted: your request was accepted ────────────────────────────────
    const onDmAccepted = ({ requestId, partnerId, partnerUsername }) => {
      setDmRequests(prev => prev.filter(r => r.id !== requestId));
      setDmReqIds(p => { const n = new Set(p); n.delete(partnerId); return n; });
      // Add or update conversation
      addDMConversation({
        id: `dm-${partnerId}`,
        userId: partnerId,
        name: partnerUsername || partnerId,
        status: 'online',
        dmStatus: 'accepted',
        messages: [],
      });
      setActiveDM(`dm-${partnerId}`);
      setSidebarTab('messages');
    };

    const onDmDeclined = ({ requestId, partnerId }) => {
      setDmRequests(prev => prev.filter(r => r.id !== requestId));
      setDmReqIds(p => { const n = new Set(p); n.delete(partnerId); return n; });
    };

    // ── Incoming DM message ───────────────────────────────────────────────────
    const onNewDm = (msg) => {
      const fromId  = msg.fromId || msg.senderId;
      const fromName = msg.fromUsername || msg.fromName || 'User';
      const content  = msg.content || msg.text || '';
      receiveDM(fromId, fromName, content);
      // Auto-switch to messages tab if not already there
      setSidebarTab(prev => prev !== 'messages' ? 'messages' : prev);
    };

    // ── DM history from server (on joining a DM) ──────────────────────────────
const onDmHistory = ({ partnerId, partnerUsername, messages: msgs }) => {
  if (!partnerId || !msgs) return;
 
  const myIdStr = myId?.toString();
 
  addDMConversation({
    id:       `dm-${partnerId}`,
    userId:   partnerId,
    // Server now sends partnerUsername explicitly — no fragile msg[0] fallback
    name:     partnerUsername || partnerId,
    dmStatus: 'accepted',
    messages: msgs.map(m => ({
      id:        m._id,
      from:      m.senderId === myIdStr ? 'me' : m.senderId,
      text:      m.content,
      content:   m.content,
      time:      fmtTime(m.createdAt),
      createdAt: m.createdAt,
    })),
  });
}

    const onMessageReaction = ({ messageId, reactions }) => {
      setMessages(prev => prev.map(m =>
        m._id === messageId ? { ...m, reactions } : m
      ));
    };

    chatSocket.on('connect',             onConnect);
    chatSocket.on('disconnect',          onDisconnect);
    chatSocket.on('connect_error',       onConnectError);
    chatSocket.on('new_message',         onNewMessage);
    chatSocket.on('room_history',        onRoomHistory);
    chatSocket.on('room_joined',         onRoomJoined);
    chatSocket.on('room_active_count',   onActiveCount);
    chatSocket.on('user_typing',         onUserTyping);
    chatSocket.on('member_removed',      onMemberRemoved);
    chatSocket.on('admin_transferred',   onAdminTransferred);
    chatSocket.on('error',               onError);
    chatSocket.on('dm_request',          onDmRequest);
    chatSocket.on('dm_request_accepted', onDmAccepted);
    chatSocket.on('dm_request_declined', onDmDeclined);
    chatSocket.on('new_dm',              onNewDm);
    chatSocket.on('dm_history',          onDmHistory);
    chatSocket.on('message_reaction',    onMessageReaction);

    if (chatSocket.connected) {
      setConnected(true);
      if (activeRoomRef.current) {
        chatSocket.emit('join_room', { roomId: activeRoomRef.current });
      }
    }

    return () => {
      chatSocket.off('connect',             onConnect);
      chatSocket.off('disconnect',          onDisconnect);
      chatSocket.off('connect_error',       onConnectError);
      chatSocket.off('new_message',         onNewMessage);
      chatSocket.off('room_history',        onRoomHistory);
      chatSocket.off('room_joined',         onRoomJoined);
      chatSocket.off('room_active_count',   onActiveCount);
      chatSocket.off('user_typing',         onUserTyping);
      chatSocket.off('member_removed',      onMemberRemoved);
      chatSocket.off('admin_transferred',   onAdminTransferred);
      chatSocket.off('error',               onError);
      chatSocket.off('dm_request',          onDmRequest);
      chatSocket.off('dm_request_accepted', onDmAccepted);
      chatSocket.off('dm_request_declined', onDmDeclined);
      chatSocket.off('new_dm',              onNewDm);
      chatSocket.off('dm_history',          onDmHistory);
      chatSocket.off('message_reaction',    onMessageReaction);
    };
  }, [chatSocket, myId, setActiveDM, sendDM, receiveDM, addDMConversation]);

  // ── Join room on switch ────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeRoom || mode !== 'group' || !connected || !chatSocket) return;
    setMessages([]);
    setMsgsLoading(true);
    setTypingUsers({});
    setActiveCount(null);
    setRoomReady(false);
    joinedRooms.current.add(activeRoom);
    chatSocket.emit('join_room', { roomId: activeRoom });
  }, [activeRoom, mode, connected, chatSocket]);

  // ── Open a DM: request history from server ────────────────────────────────
  useEffect(() => {
    if (mode !== 'dm' || !activeDM || !chatSocket || !connected) return;
    const conv = dmConversations.find(c => c.id === activeDM);
    if (conv?.userId) {
      chatSocket.emit('get_dm_history', { partnerId: conv.userId });
    }
  }, [activeDM, mode, chatSocket, connected, dmConversations]);

  // ── Leave previous room ────────────────────────────────────────────────────
  useEffect(() => {
    const prev = prevRoomRef.current;
    prevRoomRef.current = activeRoom;
    if (prev && prev !== activeRoom && chatSocket) {
      chatSocket.emit('leave_room', { roomId: prev });
      joinedRooms.current.delete(prev);
    }
  }, [activeRoom, chatSocket]);

  // Auto-scroll
  useEffect(() => {
    bottomEl.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeDM]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const emitTyping = useCallback(() => {
    if (!activeRoom || mode !== 'group' || !chatSocket) return;
    if (!typingEmitted.current) {
      chatSocket.emit('typing', { roomId: activeRoom, isTyping: true });
      typingEmitted.current = true;
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      chatSocket?.emit('typing', { roomId: activeRoom, isTyping: false });
      typingEmitted.current = false;
    }, 2500);
  }, [activeRoom, mode, chatSocket]);

  const handleScroll = useCallback(() => {
    if (messagesEl.current?.scrollTop === 0 && hasMore && !loadingMore && chatSocket) {
      setLoadingMore(true);
      chatSocket.emit('get_history', { roomId: activeRoom, before: messages[0]?.createdAt });
    }
  }, [hasMore, loadingMore, activeRoom, messages, chatSocket]);

  const handleSend = useCallback((e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || !chatSocket) return;
    setInput('');
    setSendError('');

    if (mode === 'group' && activeRoom) {
      const tempId = `opt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setMessages(prev => [...prev, {
        _id: tempId, _tempId: tempId, _isOptimistic: true,
        userId: myId,
        username: user?.username || user?.name || 'Me',
        content: text, roomId: activeRoom,
        createdAt: new Date().toISOString(), reactions: [],
      }]);
      chatSocket.emit('send_message', { roomId: activeRoom, content: text, tempId });
    } else if (mode === 'dm' && activeDM) {
      const conv = dmConversations.find(c => c.id === activeDM);
      if (!conv) return;
      const tempId = `temp-dm-${Date.now()}`;
      // Optimistic local
      sendDM(activeDM, text);
      // Real socket emit
      chatSocket.emit('send_dm', { toId: conv.userId, content: text, tempId });
    }
  }, [input, mode, activeRoom, activeDM, myId, user, sendDM, chatSocket, dmConversations]);

  const handleReact = useCallback((msgId, emoji) => {
    if (mode !== 'group') return;
    setMessages(prev => prev.map(m =>
      m._id === msgId
        ? { ...m, reactions: [...(m.reactions || []), { emoji, count: 1 }] }
        : m
    ));
    if (chatSocket) {
      chatSocket.emit('react_message', { roomId: activeRoom, messageId: msgId, emoji });
    }
  }, [mode, chatSocket, activeRoom]);

  const switchRoom = useCallback((roomId) => {
    if (roomId === activeRoom) return;
    if (typingEmitted.current && chatSocket) {
      chatSocket.emit('typing', { roomId: activeRoom, isTyping: false });
      typingEmitted.current = false;
    }
    setPreviewRoom(null);
    setActiveRoom(roomId);
    setSidebarTab('communities');
    setTypingUsers({});
  }, [activeRoom, chatSocket]);

  const handleJoin = useCallback(async () => {
    if (!previewRoom) return;
    setJoining(true); setJoinError('');
    try {
      const res = await api.post(`/rooms/${previewRoom._id}/join`);
      const joinedRoomData = res.data.room ?? previewRoom;
      setRooms(prev => {
        if (prev.some(r => r._id === joinedRoomData._id)) return prev;
        return [...prev, joinedRoomData];
      });
      setPreviewRoom(null);
      setActiveRoom(joinedRoomData._id);
      setSidebarTab('communities');
    } catch (e) {
      setJoinError(e.response?.data?.error || e.response?.data?.message || 'Failed to join room');
    } finally {
      setJoining(false);
    }
  }, [previewRoom]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const currentRoom = useMemo(() => rooms.find(r => r._id === activeRoom), [rooms, activeRoom]);
  const currentDM   = useMemo(() => dmConversations?.find(c => c.id === activeDM), [dmConversations, activeDM]);

  const filteredJoinedRooms = useMemo(
    () => rooms.filter(r => r.name?.toLowerCase().includes(search.toLowerCase())),
    [rooms, search]
  );
  const filteredDiscoverRooms = useMemo(
    () => discoverRooms.filter(r => r.name?.toLowerCase().includes(search.toLowerCase())),
    [discoverRooms, search]
  );
  const filteredDMs = useMemo(
    () => (dmConversations || []).filter(c => c.name?.toLowerCase().includes(search.toLowerCase())),
    [dmConversations, search]
  );

  // For DM mode, use the conversation's stored messages
  const dmMessages = useMemo(() => {
    if (!currentDM) return [];
    return (currentDM.messages || []).map(m => ({
      ...m,
      userId:   m.from === 'me' ? myId : currentDM.userId,
      username: m.from === 'me' ? (user?.username || 'Me') : (currentDM.name || ''),
      content:  m.content || m.text,
      createdAt: m.createdAt || m.time,
    }));
  }, [currentDM, myId, user]);

  const displayMessages = mode === 'group' ? messages : dmMessages;

  const groupedMessages = useMemo(() => {
    const groups = [];
    let lastDate = null;
    for (const msg of displayMessages) {
      const d = fmtDate(msg.createdAt || msg.time);
      if (d && d !== lastDate) {
        groups.push({ type: 'divider', date: d, key: `div-${d}-${msg._id || msg.id}` });
        lastDate = d;
      }
      groups.push({ type: 'msg', msg, key: msg._id || msg.id || Math.random() });
    }
    return groups;
  }, [displayMessages]);

  const activeSub = useMemo(() => {
    if (mode !== 'group') return '';
    const n = activeCount ?? currentRoom?.liveCount ?? currentRoom?.memberCount;
    if (n == null) return 'Active now';
    if (n === 0) return 'No one active';
    return `${n} member${n !== 1 ? 's' : ''} active`;
  }, [mode, activeCount, currentRoom]);

  const canSend = !!chatSocket && (
    mode === 'dm'
      ? (!!activeDM && !!input.trim() && currentDM?.dmStatus === 'accepted')
      : (!!activeRoom && roomReady && !!input.trim())
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="chat-root">
      {/* DM request banners */}
      {dmRequests.map(req => (
        <DMBanner key={req.id} req={req}
          onAccept={id => {
            chatSocket?.emit('dm_request_accept', { requestId: id });
            setDmRequests(p => p.filter(r => r.id !== id));
          }}
          onDecline={id => {
            chatSocket?.emit('dm_request_decline', { requestId: id });
            setDmRequests(p => p.filter(r => r.id !== id));
          }}
        />
      ))}

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="sidebar">

        {/* Header */}
        <div className="sidebar-hdr">
          <div className="sidebar-brand">
            <div className="sidebar-brand-dot"/>
            <h2 className="sidebar-title">Community</h2>
          </div>
          <button className="btn-new"
            onClick={() => sidebarTab === 'messages' ? setShowUserSearch(true) : setShowCreate(true)}>
            <MdAdd size={16}/>
            <span>{sidebarTab === 'messages' ? 'New Chat' : 'New'}</span>
          </button>
        </div>

        {/* Search */}
        <div className="sidebar-search">
          <MdSearch size={14} className="sidebar-search-icon"/>
          <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Tabs */}
        <div className="tab-row">
          <button
            className={`tab${sidebarTab === 'communities' ? ' tab--on' : ''}`}
            onClick={() => setSidebarTab('communities')}
            title="Communities"
          >
            <MdPeople size={15}/> Communities
          </button>
          <button
            className={`tab${sidebarTab === 'discover' ? ' tab--on' : ''}`}
            onClick={() => setSidebarTab('discover')}
            title="Discover"
          >
            <MdExplore size={15}/> Discover
          </button>
          <button
            className={`tab${sidebarTab === 'messages' ? ' tab--on' : ''}`}
            onClick={() => setSidebarTab('messages')}
            title="Messages"
          >
            <MdMessage size={15}/> DMs
          </button>
        </div>

        {/* ── Communities tab ─────────────────────────────────────────────── */}
        {sidebarTab === 'communities' && (
          <div className="sidebar-list">
            {roomsLoading && <RoomSkeleton />}
            {roomsError && (
              <div className="list-error">
                <span>⚠ {roomsError}</span>
                <button onClick={() => window.location.reload()}>Retry</button>
              </div>
            )}
            {!roomsLoading && !roomsError && (
              <>
                {filteredJoinedRooms.length > 0 && (
                  <p className="list-label">Your communities ({filteredJoinedRooms.length})</p>
                )}
                {filteredJoinedRooms.map(room => (
                  <button
                    key={room._id}
                    className={`room-row ${activeRoom === room._id && mode === 'group' ? 'room-row--active' : ''}`}
                    onClick={() => switchRoom(room._id)}
                  >
                    <span className="room-icon">{room.icon || '💬'}</span>
                    <div className="room-info">
                      <span className="room-name">{room.name}</span>
                      <span className="room-meta">{room.memberCount || 0} members</span>
                    </div>
                  </button>
                ))}
                {filteredJoinedRooms.length === 0 && (
                  <div className="list-empty-state">
                    <div className="list-empty-icon">🏘️</div>
                    <p>No communities yet</p>
                    <button className="btn-create-empty" onClick={() => setSidebarTab('discover')}>
                      Browse communities
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Discover tab ────────────────────────────────────────────────── */}
        {sidebarTab === 'discover' && (
          <div className="sidebar-list">
            {roomsLoading && <RoomSkeleton />}
            {!roomsLoading && (
              <>
                {filteredDiscoverRooms.length > 0 && (
                  <p className="list-label">Explore public spaces ({filteredDiscoverRooms.length})</p>
                )}
                {filteredDiscoverRooms.map(room => {
                  const alreadyJoined = rooms.some(j => j._id === room._id);
                  return (
                    <button
                      key={room._id}
                      className={`room-row ${previewRoom?._id === room._id ? 'room-row--preview' : ''}`}
                      onClick={() => setPreviewRoom(room)}
                    >
                      <span className="room-icon">{room.icon || '💬'}</span>
                      <div className="room-info">
                        <span className="room-name">{room.name}</span>
                        <span className="room-meta">
                          {room.memberCount || 0} members{alreadyJoined ? ' · Joined ✓' : ''}
                        </span>
                      </div>
                    </button>
                  );
                })}
                {filteredDiscoverRooms.length === 0 && (
                  <p className="empty-label">No communities found.</p>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Messages tab ────────────────────────────────────────────────── */}
        {sidebarTab === 'messages' && (
          <div className="sidebar-list">
            {filteredDMs.length === 0 ? (
              <div className="list-empty-state">
                <div className="list-empty-icon">💌</div>
                <p>No direct messages yet</p>
                <button className="btn-create-empty" onClick={() => setShowUserSearch(true)}>
                  Find someone to message
                </button>
              </div>
            ) : (
              <>
                <p className="list-label">Direct messages</p>
                {filteredDMs.map(conv => {
                  const last = conv.messages?.[conv.messages.length - 1];
                  return (
                    <button key={conv.id}
                      className={`dm-row${activeDM === conv.id && mode === 'dm' ? ' dm-row--active' : ''}`}
                      onClick={() => { setActiveDM(conv.id); setSidebarTab('messages'); }}>
                      <div className="dm-avatar-wrap">
                        <Avatar name={conv.name} size={38}/>
                        <span className={`status-dot status-dot--${conv.status || 'offline'}`}/>
                      </div>
                      <div className="room-info">
                        <div className="dm-name-row">
                          <span className="room-name">{conv.name}</span>
                          {conv.dmStatus === 'pending' && <span className="badge-pending">pending</span>}
                          <span className="room-sub-time">{last?.time || ''}</span>
                        </div>
                        <span className="room-sub">{last?.text || last?.content || 'No messages yet'}</span>
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        )}
      </aside>

      {/* ── Chat main ────────────────────────────────────────────────────── */}
      <main className="chat-main">

        {chatSocket && !connected && (
          <div className="conn-banner">
            <span className="conn-dot"/>
            Reconnecting…
          </div>
        )}
        {!chatSocket && (
          <div className="conn-banner conn-banner--warn">
            <span className="conn-dot"/>
            Waiting for session…
          </div>
        )}

        {previewRoom ? (
          <>
            <div className="chat-hdr">
              <div className="chat-hdr-icon">{previewRoom.icon || '💬'}</div>
              <div className="chat-hdr-info">
                <span className="chat-hdr-name">{previewRoom.name}</span>
                <span className="chat-hdr-sub">{previewRoom.memberCount ?? 0} members</span>
              </div>
              <button className="hdr-btn" onClick={() => setPreviewRoom(null)} title="Close">
                <MdClose size={18}/>
              </button>
            </div>
            <JoinPreviewPanel room={previewRoom} onJoin={handleJoin}
              onClose={() => setPreviewRoom(null)} joining={joining}/>
            {joinError && (
              <div className="send-error">
                ⚠ {joinError}
                <button onClick={() => setJoinError('')}><MdClose size={14}/></button>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Header */}
            <div className="chat-hdr">
              {mode === 'group' && currentRoom ? (
                <>
                  <div className="chat-hdr-icon">{currentRoom.icon || '💬'}</div>
                  <div className="chat-hdr-info">
                    <span className="chat-hdr-name">{currentRoom.name}</span>
                    <span className="chat-hdr-sub">
                      <span className="online-pip"/>
                      {activeSub}
                      {!roomReady && connected && <span className="joining-hint"> · joining…</span>}
                    </span>
                  </div>
                  <div className="chat-hdr-btns">
                    <button className="hdr-btn" title="Members">
                      <MdPeople size={18}/>
                    </button>
                    {isAdmin && (
                      <button className="hdr-btn" title="Manage" onClick={() => setShowAdmin(true)}>
                        <MdSettings size={18}/>
                      </button>
                    )}
                  </div>
                </>
              ) : mode === 'dm' && currentDM ? (
                <>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <Avatar name={currentDM.name} size={36}/>
                    <span className={`status-dot status-dot--${currentDM.status || 'offline'}`}
                      style={{ position:'absolute', bottom:1, right:1 }}/>
                  </div>
                  <div className="chat-hdr-info">
                    <span className="chat-hdr-name">{currentDM.name}</span>
                    <span className="chat-hdr-sub">{currentDM.status || 'offline'}</span>
                  </div>
                  <div className="chat-hdr-btns">
                    {currentDM.dmStatus !== 'accepted' && !dmReqIds.has(currentDM.userId) && (
                      <button className="hdr-btn hdr-btn--primary"
                        onClick={() => {
                          if (!chatSocket) return;
                          chatSocket.emit('dm_request', { toId: currentDM.userId });
                          setDmReqIds(p => new Set([...p, currentDM.userId]));
                        }}>
                        <MdPersonAdd size={16}/> Request DM
                      </button>
                    )}
                    {dmReqIds.has(currentDM.userId) && currentDM.dmStatus !== 'accepted' && (
                      <span className="badge-pending">Request Sent</span>
                    )}
                  </div>
                </>
              ) : (
                <div className="chat-hdr-info">
                  <span className="chat-hdr-name">Welcome</span>
                  <span className="chat-hdr-sub">
                    {sidebarTab === 'discover'
                      ? 'Click a community to preview and join'
                      : 'Select a community or start a conversation'}
                  </span>
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="messages-area" ref={messagesEl} onScroll={handleScroll}>
              {hasMore && (
                <div className="load-more">
                  <button disabled={loadingMore} onClick={() => {
                    if (!chatSocket) return;
                    setLoadingMore(true);
                    chatSocket.emit('get_history', { roomId: activeRoom, before: messages[0]?.createdAt });
                  }}>
                    {loadingMore ? <span className="spinner"/> : '↑ Load earlier'}
                  </button>
                </div>
              )}

              {msgsLoading && (
                <div className="msgs-skeleton">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={`sk-msg${i%2===0?' sk-msg--own':''}`}>
                      {i%2!==0 && <div className="sk-avatar"/>}
                      <div className="sk-bubble" style={{ width:`${110+i*28}px` }}/>
                    </div>
                  ))}
                </div>
              )}

              {!msgsLoading && displayMessages.length === 0 && (mode === 'group' ? currentRoom : currentDM) && (
                <div className="chat-empty">
                  <div className="chat-empty-icon">
                    {mode === 'group' ? (currentRoom?.icon || '💬') : '💌'}
                  </div>
                  <p className="chat-empty-t">
                    {mode === 'group' ? `Welcome to ${currentRoom?.name}` : `Chat with ${currentDM?.name}`}
                  </p>
                  <p className="chat-empty-s">
                    {mode === 'dm' && currentDM?.dmStatus !== 'accepted'
                      ? 'Send a DM request to start chatting'
                      : 'Be the first to say something 👋'}
                  </p>
                </div>
              )}

              {!msgsLoading && sidebarTab === 'discover' && !previewRoom && !currentRoom && (
                <div className="chat-empty">
                  <div className="chat-empty-icon">🔍</div>
                  <p className="chat-empty-t">Find your community</p>
                  <p className="chat-empty-s">Click any community on the left to preview it</p>
                </div>
              )}

              {!msgsLoading && !currentRoom && !currentDM && mode === 'group' && sidebarTab === 'communities' && (
                <div className="chat-empty">
                  <div className="chat-empty-icon">🏘️</div>
                  <p className="chat-empty-t">No community selected</p>
                  <p className="chat-empty-s">Choose from the sidebar or discover new ones</p>
                </div>
              )}

              {!msgsLoading && !currentDM && mode === 'dm' && (
                <div className="chat-empty">
                  <div className="chat-empty-icon">💌</div>
                  <p className="chat-empty-t">No conversation selected</p>
                  <button className="btn-create-empty" onClick={() => setShowUserSearch(true)}>
                    Find someone to message
                  </button>
                </div>
              )}

              {!msgsLoading && groupedMessages.map(item =>
                item.type === 'divider'
                  ? <DateDivider key={item.key} date={item.date}/>
                  : (
                    <MessageBubble
                      key={item.key}
                      msg={item.msg}
                      myId={myId}
                      onReact={handleReact}
                    />
                  )
              )}

              <TypingIndicator typingUsers={typingUsers}/>
              <div ref={bottomEl}/>
            </div>

            {sendError && (
              <div className="send-error">
                ⚠ {sendError}
                <button onClick={() => setSendError('')}><MdClose size={14}/></button>
              </div>
            )}

            {/* DM pending notice */}
            {mode === 'dm' && currentDM && currentDM.dmStatus !== 'accepted' && (
              <div className="dm-pending-notice">
                <MdPersonAdd size={16}/>
                You need to send a DM request before messaging {currentDM.name}.
                <button className="btn-sm btn-primary" style={{ marginLeft: 10 }}
                  onClick={() => {
                    if (!chatSocket) return;
                    chatSocket.emit('dm_request', { toId: currentDM.userId });
                    setDmReqIds(p => new Set([...p, currentDM.userId]));
                  }}>
                  Send Request
                </button>
              </div>
            )}

            {/* Input bar */}
            <form className="input-bar" onSubmit={handleSend}>
              <button type="button" className="input-attach" title="Attach">
                <MdAttachFile size={18}/>
              </button>
              <div className="input-wrap">
                <input
                  ref={inputEl}
                  className="input-field"
                  placeholder={
                    !chatSocket ? 'Connecting…'
                    : !connected ? 'Reconnecting…'
                    : !currentRoom && !currentDM ? 'Select a conversation…'
                    : mode === 'group' && !roomReady ? 'Joining room…'
                    : mode === 'dm' && currentDM?.dmStatus !== 'accepted' ? 'Send a request first…'
                    : mode === 'group' ? `Message ${currentRoom?.name || '…'}`
                    : `Message ${currentDM?.name || '…'}`
                  }
                  value={input}
                  disabled={
                    !chatSocket || !connected
                    || (mode === 'group' && (!activeRoom || !roomReady))
                    || (mode === 'dm' && currentDM?.dmStatus !== 'accepted')
                  }
                  onChange={e => { setInput(e.target.value); emitTyping(); }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleSend(e); }}
                  maxLength={2000}
                  autoComplete="off"
                />
                <button type="button" className="input-emoji" title="Emoji">
                  <MdEmojiEmotions size={18}/>
                </button>
              </div>
              <button type="submit" className="input-send" disabled={!canSend}>
                <MdSend size={18}/>
              </button>
            </form>
          </>
        )}
      </main>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreated={room => {
          setRooms(p => [...p, room]);
          setActiveRoom(room._id);
          setSidebarTab('communities');
        }}/>
      )}
      {showUserSearch && (
        <UserSearchModal
          onClose={() => setShowUserSearch(false)}
          myId={myId}
          chatSocket={chatSocket}
          dmConversations={dmConversations}
          addDMConversation={addDMConversation}
          setActiveDM={setActiveDM}
          setSidebarTab={setSidebarTab}
        />
      )}
      {showAdmin && currentRoom && (
        <AdminModal room={currentRoom} members={roomMembers} myId={myId}
          onRemove={u => chatSocket?.emit('remove_member', { roomId: activeRoom, userId: u })}
          onTransfer={u => chatSocket?.emit('transfer_admin', { roomId: activeRoom, userId: u })}
          onClose={() => setShowAdmin(false)}/>
      )}
    </div>
  );
}
