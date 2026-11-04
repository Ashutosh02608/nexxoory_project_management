import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  MessageSquare, Send, Paperclip, Smile, MoreVertical, Hash, User,
  Search, Bell, BellOff, Pin, PinOff, Trash2, Edit3, Reply,
  Users, ChevronRight, X, Check, CheckCheck, Megaphone, FolderOpen,
  Building2, AtSign, Inbox, ArrowLeft, ArrowRight, Info, ChevronDown, Plus, Copy
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useMessaging } from '../context/MessagingContext';
import { getInitials } from '../utils/avatar';
import { format, isToday, isYesterday } from '../utils/dateHelpers';

// ─── Utility ───────────────────────────────────────────────────────────────
function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d)) return '';
  if (isToday(d)) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isYesterday(d)) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function fmtFull(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '✅', '👏'];

function getConvIcon(type) {
  if (type === 'announcements') return '📢';
  if (type === 'project') return '📁';
  if (type === 'department') return '🏢';
  return null;
}

// ─── Avatar ────────────────────────────────────────────────────────────────
function Avatar({ name, icon, size = 'sm', online = false }) {
  const sz = size === 'lg' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs';
  if (icon) {
    return (
      <div className={`${sz} rounded-full bg-[var(--bg-main)] border border-[var(--border)] flex items-center justify-center text-base shrink-0 relative`}>
        {icon}
        {online && <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border-2 border-[var(--surface)]" />}
      </div>
    );
  }
  const initials = getInitials(name || '?');
  const colors = ['bg-[#635BFF]', 'bg-[#1E6091]', 'bg-[#52B69A]', 'bg-[#34A0A4]', 'bg-purple-500', 'bg-rose-500'];
  const col = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div className={`${sz} rounded-full ${col} text-white font-bold flex items-center justify-center shrink-0 relative`}>
      {initials}
      {online && <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border-2 border-[var(--surface)]" />}
    </div>
  );
}

// ─── Emoji Picker ──────────────────────────────────────────────────────────
function EmojiPicker({ onPick, onClose }) {
  return (
    <div className="absolute bottom-8 right-0 z-50 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl p-2 flex gap-1">
      {EMOJIS.map(e => (
        <button key={e} onClick={() => { onPick(e); onClose(); }}
          className="text-lg hover:scale-125 transition-transform p-1 rounded">
          {e}
        </button>
      ))}
    </div>
  );
}

// ─── Left Nav Panel ────────────────────────────────────────────────────────
const NAV_SECTIONS = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'dm', label: 'Direct Messages', icon: AtSign },
  { id: 'project', label: 'Project Groups', icon: FolderOpen },
  { id: 'department', label: 'Department Groups', icon: Building2 },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
];

function LeftNav({ activeSection, onSection, totalUnread }) {
  return (
    <div className="w-56 shrink-0 border-r border-[var(--border)] bg-[var(--bg-main)] flex flex-col h-full min-h-0 py-4">
      <div className="px-4 pb-3">
        <h2 className="text-xs font-bold text-[var(--text-sec)] uppercase tracking-wider flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5" /> Messages
          {totalUnread > 0 && (
            <span className="ml-auto bg-[#635BFF] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </h2>
      </div>
      <nav className="flex-1 space-y-0.5 px-2">
        {NAV_SECTIONS.map(sec => {
          const Icon = sec.icon;
          const active = activeSection === sec.id;
          return (
            <button key={sec.id} onClick={() => onSection(sec.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${active
                  ? 'bg-[#635BFF] text-white shadow-sm'
                  : 'text-[var(--text-sec)] hover:text-[var(--text-main)] hover:bg-[var(--surface)]'
                }`}>
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{sec.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ─── Conversation List Item ─────────────────────────────────────────────────
function ConvItem({ conv, isActive, onClick, unread, lastMsg, pinned, muted, users, currentUser }) {
  const otherUser = conv.type === 'dm'
    ? users.find(u => conv.participantIds?.find(pid => pid !== currentUser?.id) === u.id)
    : null;
  const isDeletedParticipant = conv.type === 'dm' && !otherUser;
  const displayName = conv.type === 'dm'
    ? (otherUser?.name || (isDeletedParticipant ? 'Deleted Employee' : conv.name))
    : conv.name;
  const icon = conv.icon || getConvIcon(conv.type);

  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-all hover:bg-[var(--bg-main)] ${isActive ? 'bg-[var(--bg-main)] border-l-2 border-[#635BFF]' : 'border-l-2 border-transparent'
        }`}>
      <div className="relative shrink-0">
        <Avatar name={displayName} icon={icon} size="sm" />
        {conv.type === 'dm' && otherUser?.status === 'active' && (
          <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border-2 border-[var(--surface)]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className={`text-xs font-semibold truncate ${isActive ? 'text-[#635BFF]' : 'text-[var(--text-main)]'}`}>
            {displayName}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {pinned && <Pin className="w-2.5 h-2.5 text-[var(--text-sec)]" />}
            {muted && <BellOff className="w-2.5 h-2.5 text-[var(--text-sec)]" />}
            {lastMsg && <span className="text-[9px] text-[var(--text-sec)]">{fmtTime(lastMsg.timestamp)}</span>}
          </div>
        </div>
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <p className="text-[10px] text-[var(--text-sec)] truncate">
            {lastMsg?.deleted ? '🗑 Message deleted' : (lastMsg?.title ? `📢 ${lastMsg.title}` : lastMsg?.text || 'No messages yet')}
          </p>
          {unread > 0 && !muted && (
            <span className="shrink-0 bg-[#635BFF] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Middle Panel ──────────────────────────────────────────────────────────
function ConversationList({ section, convList, activeConvId, onSelect, search, onSearch, users, currentUser, getUnreadCount, getLastMessage, getUserSetting }) {
  const filtered = useMemo(() => {
    let list = convList;
    if (section !== 'inbox') {
      const typeMap = { dm: 'dm', project: 'project', department: 'department', announcements: 'announcements' };
      const t = typeMap[section];
      if (t) list = list.filter(c => c.type === t);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name?.toLowerCase().includes(q));
    }
    // Sort: pinned first, then by last message time
    return [...list].sort((a, b) => {
      const ap = getUserSetting(a.id, currentUser?.id)?.pinned ? 1 : 0;
      const bp = getUserSetting(b.id, currentUser?.id)?.pinned ? 1 : 0;
      if (bp !== ap) return bp - ap;
      const am = getLastMessage(a.id)?.timestamp || a.createdAt || '';
      const bm = getLastMessage(b.id)?.timestamp || b.createdAt || '';
      return bm.localeCompare(am);
    });
  }, [convList, section, search, currentUser, getUserSetting, getLastMessage]);

  return (
    <div className="w-72 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col h-full min-h-0">
      {/* Search */}
      <div className="p-3 border-b border-[var(--border)] shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-sec)]" />
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search conversations…"
            className="w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--text-main)] placeholder:text-[var(--text-sec)] focus:outline-none focus:ring-1 focus:ring-[#635BFF]/50"
          />
        </div>
      </div>
      {/* List with Scroll */}
      <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-[var(--border)]/30">
        {filtered.length === 0 && (
          <div className="p-6 text-center text-xs text-[var(--text-sec)]">
            No conversations
          </div>
        )}
        {filtered.map(c => (
          <ConvItem
            key={c.id}
            conv={c}
            isActive={c.id === activeConvId}
            onClick={() => onSelect(c.id)}
            unread={getUnreadCount(c.id, currentUser?.id)}
            lastMsg={getLastMessage(c.id)}
            pinned={getUserSetting(c.id, currentUser?.id)?.pinned}
            muted={getUserSetting(c.id, currentUser?.id)?.muted}
            users={users}
            currentUser={currentUser}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Message Bubble ────────────────────────────────────────────────────────
function MessageBubble({ msg, isMine, isEditable, users, currentUser, onReply, onEdit, onReact, messages }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(msg.text);
  const menuRef = useRef(null);

  const sender = users.find(u => u.id === msg.senderId);
  const replyMsg = msg.replyToId ? messages.find(m => m.id === msg.replyToId) : null;
  const replySender = replyMsg ? users.find(u => u.id === replyMsg.senderId) : null;

  useEffect(() => {
    function outside(e) { if (menuRef.current && !menuRef.current.contains(e.target)) { setShowMenu(false); setShowEmoji(false); } }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  if (msg.deleted) {
    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1`}>
        <span className="text-[10px] italic text-[var(--text-sec)] px-3 py-1">Message deleted</span>
      </div>
    );
  }

  const isAnn = msg.isAnnouncement;
  const priorityBg = { urgent: 'bg-red-500/10 border-red-500/30', important: 'bg-amber-500/10 border-amber-500/30', normal: '' };

  return (
    <div className={`flex ${isMine ? 'flex-row-reverse' : 'flex-row'} items-end gap-2 mb-3 group`}>
      {!isMine && <Avatar name={sender?.name} size="sm" />}

      <div className={`max-w-[70%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Sender name in groups */}
        {!isMine && sender && (
          <span className="text-[9px] font-semibold text-[var(--text-sec)] mb-1 ml-1">{sender.name}</span>
        )}

        {/* Reply preview */}
        {replyMsg && (
          <div className={`text-[10px] mb-1 px-2 py-1 rounded-lg border-l-2 border-[#635BFF] bg-[var(--bg-main)] ${isMine ? 'self-end' : 'self-start'}`}>
            <span className="font-semibold text-[#635BFF]">{replySender?.name || 'Unknown'}</span>
            <p className="text-[var(--text-sec)] truncate">{replyMsg.deleted ? 'Deleted message' : replyMsg.text}</p>
          </div>
        )}

        {/* Announcement badge */}
        {isAnn && msg.priority && msg.priority !== 'normal' && (
          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full mb-1 ${msg.priority === 'urgent' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
            }`}>{msg.priority}</span>
        )}
        {isAnn && msg.title && (
          <span className="text-xs font-bold text-[var(--text-main)] mb-1">{msg.title}</span>
        )}

        <div className="relative" ref={menuRef}>
          {/* Bubble */}
          <div
            className={`px-3 py-2 rounded-2xl text-xs leading-relaxed cursor-default select-text ${isAnn
                ? `border ${priorityBg[msg.priority] || ''} bg-[var(--surface)] text-[var(--text-main)] rounded-xl`
                : isMine
                  ? 'bg-[#635BFF] text-white rounded-br-sm'
                  : 'bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border)] rounded-bl-sm'
              }`}
          >
            {editing ? (
              <div className="flex gap-2 items-center">
                <input
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { onEdit(msg.id, editText); setEditing(false); }
                    if (e.key === 'Escape') setEditing(false);
                  }}
                  className="bg-transparent border-b border-white/50 outline-none flex-1 text-xs"
                  autoFocus
                />
                <button onClick={() => { onEdit(msg.id, editText); setEditing(false); }} className="opacity-80 hover:opacity-100">
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <span>{msg.text}</span>
            )}
            {msg.edited && <span className="text-[9px] opacity-60 ml-1">(edited)</span>}
          </div>

          {/* Hover actions */}
          <div className={`absolute top-0 ${isMine ? 'right-full mr-1' : 'left-full ml-1'} hidden group-hover:flex items-center gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-1.5 py-1 shadow-md`}>
            <button onClick={() => setShowEmoji(v => !v)} title="React" className="p-0.5 rounded hover:bg-[var(--bg-main)]">
              <Smile className="w-3.5 h-3.5 text-[var(--text-sec)]" />
            </button>
            <button onClick={() => onReply(msg)} title="Reply" className="p-0.5 rounded hover:bg-[var(--bg-main)]">
              <Reply className="w-3.5 h-3.5 text-[var(--text-sec)]" />
            </button>
            {isEditable && (
              <button onClick={() => setEditing(true)} title="Edit" className="p-0.5 rounded hover:bg-[var(--bg-main)]">
                <Edit3 className="w-3.5 h-3.5 text-[var(--text-sec)]" />
              </button>
            )}
            <button onClick={() => { navigator.clipboard?.writeText(msg.text); }} title="Copy" className="p-0.5 rounded hover:bg-[var(--bg-main)]">
              <Copy className="w-3.5 h-3.5 text-[var(--text-sec)]" />
            </button>
            {showEmoji && (
              <EmojiPicker onPick={e => onReact(msg.id, e)} onClose={() => setShowEmoji(false)} />
            )}
          </div>
        </div>

        {/* Reactions */}
        {Object.keys(msg.reactions || {}).length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
            {Object.entries(msg.reactions).map(([emoji, reactors]) =>
              reactors.length > 0 && (
                <button key={emoji} onClick={() => onReact(msg.id, emoji)}
                  className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border transition-all ${reactors.includes(currentUser?.id)
                      ? 'bg-[#635BFF]/10 border-[#635BFF]/30 text-[#635BFF]'
                      : 'bg-[var(--bg-main)] border-[var(--border)] text-[var(--text-sec)] hover:border-[#635BFF]/30'
                    }`}>
                  {emoji} {reactors.length}
                </button>
              )
            )}
          </div>
        )}

        {/* Timestamp */}
        <span className={`text-[9px] text-[var(--text-sec)] mt-0.5 ${isMine ? 'self-end' : 'self-start'}`}>
          {fmtFull(msg.timestamp)}
          {isMine && <CheckCheck className="w-2.5 h-2.5 inline ml-1 text-[#635BFF]" />}
        </span>
      </div>
    </div>
  );
}

// ─── Announcement Composer ─────────────────────────────────────────────────
function AnnouncementComposer({ onPublish, onClose }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState('normal');

  const submit = () => {
    if (!title.trim() || !content.trim()) return;
    onPublish(title.trim(), content.trim(), priority);
    onClose();
  };

  return (
    <div className="border border-[var(--border)] rounded-xl p-4 bg-[var(--bg-main)] mb-3">
      <h3 className="text-xs font-bold text-[var(--text-main)] mb-3 flex items-center gap-2">
        <Megaphone className="w-3.5 h-3.5 text-[#635BFF]" /> New Announcement
      </h3>
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Announcement title…"
        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[#635BFF]/50 mb-2"
      />
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Write your announcement…"
        rows={3}
        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[#635BFF]/50 mb-2 resize-none"
      />
      <div className="flex items-center gap-2">
        <select value={priority} onChange={e => setPriority(e.target.value)}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-main)] focus:outline-none">
          <option value="normal">Normal</option>
          <option value="important">Important</option>
          <option value="urgent">Urgent</option>
        </select>
        <div className="flex-1" />
        <button onClick={onClose} className="text-xs text-[var(--text-sec)] hover:text-[var(--text-main)] px-2 py-1.5">Cancel</button>
        <button onClick={submit} disabled={!title.trim() || !content.trim()}
          className="bg-[#635BFF] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#4f46e5] disabled:opacity-40 transition-colors">
          Publish
        </button>
      </div>
    </div>
  );
}

// ─── DM Starter ────────────────────────────────────────────────────────────
function NewDMModal({ users, currentUser, onStart, onClose }) {
  const [q, setQ] = useState('');
  const filtered = users.filter(u => u.id !== currentUser?.id && u.status !== 'inactive' &&
    (u.name?.toLowerCase().includes(q.toLowerCase()) || u.email?.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="absolute inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--text-main)]">New Direct Message</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-[var(--text-sec)]" /></button>
        </div>
        <div className="p-3">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search employees…"
            className="w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#635BFF]/50" autoFocus />
        </div>
        <div className="max-h-60 overflow-y-auto px-2 pb-3">
          {filtered.map(u => (
            <button key={u.id} onClick={() => { onStart(u.id); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--bg-main)] text-left">
              <Avatar name={u.name} size="sm" />
              <div>
                <p className="text-xs font-semibold text-[var(--text-main)]">{u.name}</p>
                <p className="text-[10px] text-[var(--text-sec)]">{u.role?.replace('_', ' ')} · {u.department}</p>
              </div>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-xs text-[var(--text-sec)] text-center py-4">No employees found</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Info Panel ────────────────────────────────────────────────────────────
function ConvInfoPanel({ conv, users, currentUser, onClose, onPin, onMute, pinned, muted }) {
  const participants = (conv?.participantIds || []).map(id => users.find(u => u.id === id)).filter(Boolean);
  return (
    <div className="w-64 shrink-0 border-l border-[var(--border)] bg-[var(--bg-main)] flex flex-col">
      <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
        <h3 className="text-xs font-bold text-[var(--text-main)]">Info</h3>
        <button onClick={onClose}><X className="w-3.5 h-3.5 text-[var(--text-sec)]" /></button>
      </div>
      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-2 w-12 h-12 rounded-full bg-[#635BFF]/10 flex items-center justify-center text-2xl">
            {conv?.icon || <MessageSquare className="w-6 h-6 text-[#635BFF]" />}
          </div>
          <p className="text-xs font-bold text-[var(--text-main)]">{conv?.name}</p>
          <p className="text-[10px] text-[var(--text-sec)] capitalize">{conv?.type?.replace('_', ' ')}</p>
        </div>

        <div className="flex gap-2">
          <button onClick={onPin}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-semibold border transition-all ${pinned ? 'bg-[#635BFF] text-white border-[#635BFF]' : 'border-[var(--border)] text-[var(--text-sec)] hover:bg-[var(--surface)]'
              }`}>
            {pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
            {pinned ? 'Unpin' : 'Pin'}
          </button>
          <button onClick={onMute}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-semibold border transition-all ${muted ? 'bg-amber-500 text-white border-amber-500' : 'border-[var(--border)] text-[var(--text-sec)] hover:bg-[var(--surface)]'
              }`}>
            {muted ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
            {muted ? 'Unmute' : 'Mute'}
          </button>
        </div>

        {participants.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-[var(--text-sec)] uppercase tracking-wider mb-2">
              Participants ({participants.length})
            </p>
            <div className="space-y-2">
              {participants.map(u => (
                <div key={u.id} className="flex items-center gap-2">
                  <Avatar name={u.name} size="sm" />
                  <div>
                    <p className="text-[10px] font-semibold text-[var(--text-main)]">{u.name}</p>
                    <p className="text-[9px] text-[var(--text-sec)] capitalize">{u.role?.replace('_', ' ')}</p>
                  </div>
                  {u.id === currentUser?.id && (
                    <span className="ml-auto text-[9px] bg-[#635BFF]/10 text-[#635BFF] px-1.5 rounded-full font-semibold">You</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Chat Panel ────────────────────────────────────────────────────────
function ChatPanel({ convId: activeConvId, conversations, messages: allMessages, users, currentUser, permissions,
  sendMessage, editMessage, addReaction, markRead, publishAnnouncement,
  pinConversation, muteConversation, getUserSetting, getUnreadCount }) {

  const conv = conversations[activeConvId];
  const messages = allMessages[activeConvId] || [];
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showAnnComposer, setShowAnnComposer] = useState(false);
  const [msgSearch, setMsgSearch] = useState('');
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const scrollContainerRef = useRef(null);
  const inputRef = useRef(null);
  const prevConvIdRef = useRef(activeConvId);

  const userSettings = getUserSetting(activeConvId, currentUser?.id) || {};
  const pinned = userSettings.pinned;
  const muted = userSettings.muted;

  // Controlled scroll strictly inside the message container without moving window/panel
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // When switching to a different conversation, immediately position at the bottom of message history
    if (prevConvIdRef.current !== activeConvId) {
      prevConvIdRef.current = activeConvId;
      container.scrollTop = container.scrollHeight;
      return;
    }

    // When a new message arrives in the current conversation, auto-scroll only if user is near bottom
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    if (isNearBottom) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [messages.length, activeConvId]);

  // Mark read on open
  useEffect(() => {
    if (activeConvId) markRead(activeConvId);
  }, [activeConvId, markRead]);

  const canSend = useMemo(() => {
    if (!conv) return false;
    if (conv.isReadOnly && conv.type !== 'announcements') return false;
    if (conv.type === 'announcements') return permissions?.isAdmin;
    return true;
  }, [conv, permissions]);

  const handleSend = useCallback(() => {
    if (!input.trim() || !canSend) return;
    sendMessage(activeConvId, input.trim(), replyTo?.id || null).catch(error => {
      console.error('[MESSAGING] Message send failed:', error);
      window.alert(error.message || 'Message could not be sent. Please try again.');
    });
    setInput('');
    setReplyTo(null);
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
      }
    }, 50);
  }, [input, canSend, sendMessage, activeConvId, replyTo]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const visibleMessages = useMemo(() => {
    if (!msgSearch.trim()) return messages.filter(m => !m.deleted || m.isAnnouncement);
    return messages.filter(m => !m.deleted && m.text?.toLowerCase().includes(msgSearch.toLowerCase()));
  }, [messages, msgSearch]);

  // Identify user's single latest message in this conversation
  const latestMyMessageId = useMemo(() => {
    if (!currentUser?.id || !messages.length) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.senderId === currentUser.id && !m.deleted) {
        return m.id;
      }
    }
    return null;
  }, [messages, currentUser?.id]);

  if (!conv) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-sec)] gap-3">
        <MessageSquare className="w-10 h-10 opacity-30" />
        <p className="text-sm font-medium">Select a conversation</p>
        <p className="text-xs opacity-60">Choose from the list to start messaging</p>
      </div>
    );
  }

  const otherUser = conv.type === 'dm'
    ? users.find(u => conv.participantIds?.includes(u.id) && u.id !== currentUser?.id)
    : null;
  const isDeletedParticipant = conv.type === 'dm' && !otherUser;
  const displayName = conv.type === 'dm'
    ? (otherUser?.name || (isDeletedParticipant ? 'Deleted Employee' : conv.name))
    : conv.name;
  const icon = conv.icon || getConvIcon(conv.type);

  return (
    <div className="flex-1 flex min-w-0 h-full min-h-0 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 h-full min-h-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)] shrink-0 z-10">
          <div className="relative">
            <Avatar name={displayName} icon={icon} size="lg" />
            {conv.type === 'dm' && otherUser?.status === 'active' && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[var(--surface)]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[var(--text-main)] truncate">{displayName}</h3>
              {conv.projectId && (
                <a
                  href="/projects"
                  className="text-[10px] font-semibold text-[#1E6091] hover:underline flex items-center gap-0.5 shrink-0"
                  title="View project details"
                >
                  View Project <ArrowRight className="w-2.5 h-2.5 inline" />
                </a>
              )}
            </div>
            <p className="text-[10px] text-[var(--text-sec)]">
              {conv.type === 'dm' ? (otherUser?.role?.replace('_', ' ') || 'Direct Message') :
                conv.type === 'project' ? `${conv.participantIds?.length || 0} members · Project Group` :
                  conv.type === 'department' ? `${conv.participantIds?.length || 0} members · Department Group` :
                    'Company Announcements · Read-only for non-admins'}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setShowMsgSearch(v => !v)}
              className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-main)] transition-colors">
              <Search className="w-3.5 h-3.5 text-[var(--text-sec)]" />
            </button>
            <button onClick={() => setShowInfo(v => !v)}
              className={`p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-main)] transition-colors ${showInfo ? 'bg-[#635BFF]/10 border-[#635BFF]/30' : ''}`}>
              <Info className="w-3.5 h-3.5 text-[var(--text-sec)]" />
            </button>
            {permissions?.isAdmin && conv.type === 'announcements' && (
              <button onClick={() => setShowAnnComposer(v => !v)}
                className="flex items-center gap-1 bg-[#635BFF] text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-[#4f46e5] transition-colors">
                <Plus className="w-3 h-3" /> Announce
              </button>
            )}
          </div>
        </div>

        {/* Message search bar */}
        {showMsgSearch && (
          <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-main)]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-sec)]" />
              <input value={msgSearch} onChange={e => setMsgSearch(e.target.value)} placeholder="Search messages…"
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#635BFF]/50" autoFocus />
            </div>
          </div>
        )}

        {/* Messages */}
        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-1">
          {visibleMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-[var(--text-sec)] gap-2 py-8">
              <div className="text-4xl">{conv.icon || '💬'}</div>
              <p className="text-xs font-medium">No messages yet</p>
              <p className="text-[10px] opacity-60">
                {conv.isReadOnly ? 'This channel is read-only' : 'Send the first message!'}
              </p>
            </div>
          )}
          {visibleMessages.map((msg) => {
            const isMine = msg.senderId === currentUser?.id;
            const isLatest = msg.id === latestMyMessageId;
            const ageMs = Date.now() - new Date(msg.timestamp).getTime();
            const isWithin10Min = ageMs <= 10 * 60 * 1000;
            const isEditable = isMine && isLatest && isWithin10Min && !msg.isAnnouncement && !msg.deleted;

            return (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isMine={isMine}
                isEditable={isEditable}
                users={users}
                currentUser={currentUser}
                messages={messages}
                onReply={m => { setReplyTo(m); inputRef.current?.focus(); }}
                onEdit={(id, text) => editMessage(activeConvId, id, text)}
                onReact={(id, emoji) => addReaction(activeConvId, id, emoji)}
              />
            );
          })}
        </div>

        {/* Announcement Composer */}
        {showAnnComposer && permissions?.isAdmin && (
          <div className="px-4">
            <AnnouncementComposer
              onPublish={(title, content, priority) => publishAnnouncement(title, content, priority)}
              onClose={() => setShowAnnComposer(false)}
            />
          </div>
        )}

        {/* Composer */}
        {canSend && (
          <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--surface)] shrink-0">
            {replyTo && (
              <div className="flex items-center gap-2 bg-[var(--bg-main)] border border-[var(--border)] rounded-lg px-3 py-2 mb-2">
                <Reply className="w-3 h-3 text-[#635BFF]" />
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] font-bold text-[#635BFF]">
                    Replying to {users.find(u => u.id === replyTo.senderId)?.name || 'Unknown'}
                  </span>
                  <p className="text-[10px] text-[var(--text-sec)] truncate">{replyTo.text}</p>
                </div>
                <button onClick={() => setReplyTo(null)}><X className="w-3 h-3 text-[var(--text-sec)]" /></button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={conv.type === 'announcements' ? 'Write announcement message…' : `Message ${displayName}…`}
                  rows={1}
                  className="w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-xs text-[var(--text-main)] placeholder:text-[var(--text-sec)] focus:outline-none focus:ring-1 focus:ring-[#635BFF]/50 resize-none max-h-32 leading-relaxed"
                  style={{ minHeight: '40px' }}
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="bg-[#635BFF] text-white p-2.5 rounded-xl hover:bg-[#4f46e5] disabled:opacity-40 transition-all shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[9px] text-[var(--text-sec)] mt-1.5">Enter to send · Shift+Enter for new line</p>
          </div>
        )}
        {!canSend && conv && (
          <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--bg-main)] text-center text-xs text-[var(--text-sec)]">
            {conv.isReadOnly ? '🔒 This conversation is read-only' : '🔒 You cannot send messages here'}
          </div>
        )}
      </div>

      {/* Info panel */}
      {showInfo && (
        <ConvInfoPanel
          conv={conv}
          users={users}
          currentUser={currentUser}
          onClose={() => setShowInfo(false)}
          pinned={pinned}
          muted={muted}
          onPin={() => pinConversation(activeConvId, !pinned)}
          onMute={() => muteConversation(activeConvId, !muted)}
        />
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function MessagesPage() {
  const { currentUser, users, permissions } = useApp();
  const {
    conversations, messages, getConversationsForUser, getUnreadCount, getLastMessage,
    getUserSetting, sendMessage, editMessage, addReaction, markRead,
    startDM, pinConversation, muteConversation, publishAnnouncement,
  } = useMessaging();

  const [activeSection, setActiveSection] = useState('inbox');
  const [activeConvId, setActiveConvId] = useState(null);
  const [search, setSearch] = useState('');
  const [showNewDM, setShowNewDM] = useState(false);
  // Mobile: 'list' or 'chat'
  const [mobileView, setMobileView] = useState('list');

  const convList = useMemo(() =>
    getConversationsForUser(currentUser?.id, currentUser?.role),
    [conversations, currentUser, getConversationsForUser]
  );

  const totalUnread = useMemo(() =>
    convList.reduce((sum, c) => sum + getUnreadCount(c.id, currentUser?.id), 0),
    [convList, currentUser, getUnreadCount, messages]
  );

  const handleSelectConv = (id) => {
    setActiveConvId(id);
    setMobileView('chat');
  };

  const handleStartDM = async (userId) => {
    try {
      const cid = await startDM(userId);
      if (!cid) return;
      setActiveSection('dm');
      setActiveConvId(cid);
      setMobileView('chat');
      setShowNewDM(false);
    } catch (error) {
      console.error('[MESSAGING] Unable to start direct message:', error);
      window.alert(error.message || 'Unable to start conversation. Please try again.');
    }
  };

  return (
    <div className="h-full w-full flex bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xs relative">
      {/* Left Nav — hidden on mobile unless list view */}
      <div className={`${mobileView === 'chat' ? 'hidden lg:flex' : 'flex'} flex-col h-full min-h-0 shrink-0`}>
        <LeftNav activeSection={activeSection} onSection={(s) => { setActiveSection(s); setMobileView('list'); }} totalUnread={totalUnread} />
      </div>

      {/* Middle: Conversation list */}
      <div className={`${mobileView === 'chat' ? 'hidden lg:flex' : 'flex'} flex-col h-full min-h-0 shrink-0`}>
        <div className="flex-1 flex flex-col h-full min-h-0">
          {/* Header for section */}
          <div className="px-3 pt-3 pb-2 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface)] shrink-0">
            <h3 className="text-xs font-bold text-[var(--text-main)] capitalize">
              {NAV_SECTIONS.find(s => s.id === activeSection)?.label || 'All'}
            </h3>
            {activeSection === 'dm' && (
              <button onClick={() => setShowNewDM(true)}
                className="flex items-center gap-1 text-[10px] font-semibold text-[#635BFF] hover:text-[#4f46e5]">
                <Plus className="w-3 h-3" /> New DM
              </button>
            )}
          </div>
          <ConversationList
            section={activeSection}
            convList={convList}
            activeConvId={activeConvId}
            onSelect={handleSelectConv}
            search={search}
            onSearch={setSearch}
            users={users}
            currentUser={currentUser}
            getUnreadCount={getUnreadCount}
            getLastMessage={getLastMessage}
            getUserSetting={getUserSetting}
          />
        </div>
      </div>

      {/* Right: Chat */}
      <div className={`${mobileView === 'list' ? 'hidden lg:flex' : 'flex'} flex-1 flex-col h-full min-h-0 overflow-hidden`}>
        {/* Mobile back button */}
        {mobileView === 'chat' && (
          <div className="lg:hidden px-3 py-2 border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
            <button onClick={() => setMobileView('list')} className="flex items-center gap-1 text-xs text-[#635BFF] font-semibold">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          </div>
        )}
        <ChatPanel
          convId={activeConvId}
          conversations={conversations}
          messages={messages}
          users={users}
          currentUser={currentUser}
          permissions={permissions}
          sendMessage={sendMessage}
          editMessage={editMessage}
          addReaction={addReaction}
          markRead={markRead}
          publishAnnouncement={publishAnnouncement}
          pinConversation={pinConversation}
          muteConversation={muteConversation}
          getUserSetting={getUserSetting}
          getUnreadCount={getUnreadCount}
        />
      </div>

      {/* New DM modal */}
      {showNewDM && (
        <NewDMModal
          users={users}
          currentUser={currentUser}
          onStart={handleStartDM}
          onClose={() => setShowNewDM(false)}
        />
      )}
    </div>
  );
}
