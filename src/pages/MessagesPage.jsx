import React, { useState } from 'react';
import { MessageSquare, Send, Paperclip, Smile, MoreVertical, Hash, User } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StorageService } from '../services/storageService';

export default function MessagesPage() {
  const { conversations, currentUser } = useApp();

  const [activeConvId, setActiveConvId] = useState(conversations[0]?.id || 'conv-1');
  const [messages, setMessages] = useState(() => StorageService.getMessages(activeConvId));
  const [inputText, setInputText] = useState('');

  const activeConv = conversations.find(c => c.id === activeConvId);

  const handleSelectConv = (id) => {
    setActiveConvId(id);
    setMessages(StorageService.getMessages(id));
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg = StorageService.sendMessage(activeConvId, {
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      text: inputText
    });

    setMessages([...messages, newMsg]);
    setInputText('');
  };

  const handleAddReaction = (msgId, emoji) => {
    StorageService.toggleReaction(activeConvId, msgId, emoji);
    setMessages(StorageService.getMessages(activeConvId));
  };

  return (
    <div className="h-[calc(100vh-8.5rem)] flex bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xs">
      {/* Panel 1: Conversations List */}
      <div className="w-72 border-r border-[var(--border)] bg-[var(--bg-main)] flex flex-col shrink-0">
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="font-bold text-sm text-[var(--text-main)] flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#635BFF]" />
            Discussions
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]/50">
          {conversations.map(c => {
            const isSelected = c.id === activeConvId;
            return (
              <div
                key={c.id}
                onClick={() => handleSelectConv(c.id)}
                className={`p-3 cursor-pointer transition-colors ${
                  isSelected ? 'bg-[var(--surface)] border-l-4 border-[#635BFF]' : 'hover:bg-[var(--surface)]/60'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--text-main)] truncate">
                    {c.type === 'project' && <Hash className="w-3.5 h-3.5 text-[#635BFF]" />}
                    {c.type === 'team' && <Hash className="w-3.5 h-3.5 text-[#16A36A]" />}
                    {c.type === 'direct' && <User className="w-3.5 h-3.5 text-[#E9A23B]" />}
                    <span className="truncate">{c.name}</span>
                  </div>
                  <span className="text-[10px] text-[var(--text-sec)]">{c.lastMessageTime}</span>
                </div>
                <p className="text-[11px] text-[var(--text-sec)] line-clamp-1">{c.lastMessage}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Panel 2 & 3: Chat History & Input */}
      <div className="flex-1 flex flex-col justify-between bg-[var(--surface)]">
        {/* Chat Header */}
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-[var(--text-main)] flex items-center gap-1.5">
              {activeConv?.name}
            </h3>
            <span className="text-[10px] text-[var(--text-sec)] uppercase font-semibold">
              {activeConv?.type} conversation • {activeConv?.participants?.length} participants
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map(m => {
            const isMe = m.senderId === currentUser.id;
            return (
              <div key={m.id} className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                <img src={m.senderAvatar} alt={m.senderName} className="w-8 h-8 rounded-full object-cover shrink-0" />
                <div className={`max-w-md ${isMe ? 'items-end' : ''}`}>
                  <div className={`flex items-center gap-2 mb-1 ${isMe ? 'justify-end' : ''}`}>
                    <span className="text-xs font-semibold text-[var(--text-main)]">{m.senderName}</span>
                    <span className="text-[10px] text-[var(--text-sec)]">{m.timestamp}</span>
                  </div>
                  <div className={`p-3 rounded-2xl text-xs ${
                    isMe ? 'bg-[#635BFF] text-white rounded-tr-none' : 'bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border)] rounded-tl-none'
                  }`}>
                    {m.text}
                  </div>

                  {/* Reaction badge & trigger */}
                  <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : ''}`}>
                    {m.reactions?.map((r, idx) => (
                      <span key={idx} className="text-xs bg-[var(--bg-main)] border border-[var(--border)] px-1.5 py-0.5 rounded-full">
                        {r}
                      </span>
                    ))}
                    <button
                      onClick={() => handleAddReaction(m.id, '👍')}
                      className="text-[10px] text-[var(--text-sec)] hover:text-[#635BFF] px-1 cursor-pointer"
                    >
                      +👍
                    </button>
                    <button
                      onClick={() => handleAddReaction(m.id, '❤️')}
                      className="text-[10px] text-[var(--text-sec)] hover:text-rose-500 px-1 cursor-pointer"
                    >
                      +❤️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="p-3 border-t border-[var(--border)] bg-[var(--surface)] flex items-center gap-2">
          <button type="button" className="p-2 text-[var(--text-sec)] hover:bg-[var(--bg-main)] rounded-lg cursor-pointer">
            <Paperclip className="w-4 h-4" />
          </button>
          <input
            type="text"
            placeholder="Type your message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 px-3 py-2 text-xs rounded-xl border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
          />
          <button
            type="submit"
            className="p-2 rounded-xl bg-[#635BFF] hover:bg-[#4942D9] text-white transition-colors cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

