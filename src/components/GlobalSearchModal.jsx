import React, { useState } from 'react';
import { Search, X, FolderKanban, ListTodo, UserCircle2, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';

export default function GlobalSearchModal() {
  const { searchOpen, setSearchOpen, projects, tasks, users } = useApp();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  if (!searchOpen) return null;

  const q = query.toLowerCase().trim();

  const filteredProjects = q ? projects.filter(p => p.name.toLowerCase().includes(q) || p.tags?.some(t => t.toLowerCase().includes(q))) : [];
  const filteredTasks = q ? tasks.filter(t => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)) : [];
  const filteredUsers = q ? users.filter(u => u.name.toLowerCase().includes(q) || u.department?.toLowerCase().includes(q)) : [];

  const handleSelect = (url) => {
    navigate(url);
    setSearchOpen(false);
    setQuery('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-start justify-center pt-20 px-4 animate-in fade-in duration-150">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Input Bar */}
        <div className="p-4 border-b border-[var(--border)] flex items-center gap-3">
          <Search className="w-5 h-5 text-[#635BFF]" />
          <input
            type="text"
            placeholder="Type to search projects, tasks, employees..."
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-[var(--text-main)] placeholder-[var(--text-sec)] text-sm outline-none"
          />
          <button
            onClick={() => {
              setSearchOpen(false);
              setQuery('');
            }}
            className="p-1 rounded-md text-[var(--text-sec)] hover:bg-[var(--bg-main)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto p-4 space-y-4">
          {!query && (
            <div className="text-center py-8 text-[var(--text-sec)] text-xs">
              Search by project name, task titles, tags, or employee names.
            </div>
          )}

          {query && filteredProjects.length === 0 && filteredTasks.length === 0 && filteredUsers.length === 0 && (
            <div className="text-center py-8 text-[var(--text-sec)] text-sm">
              No matching results found for "{query}".
            </div>
          )}

          {filteredProjects.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-[var(--text-sec)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FolderKanban className="w-3.5 h-3.5 text-[#635BFF]" /> Projects ({filteredProjects.length})
              </p>
              <div className="space-y-1">
                {filteredProjects.map(p => (
                  <div
                    key={p.id}
                    onClick={() => handleSelect(`/projects`)}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[var(--bg-main)] cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-main)]">{p.name}</p>
                      <p className="text-[11px] text-[var(--text-sec)] line-clamp-1">{p.description}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[var(--text-sec)]" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {filteredTasks.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-[var(--text-sec)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ListTodo className="w-3.5 h-3.5 text-[#16A36A]" /> Tasks ({filteredTasks.length})
              </p>
              <div className="space-y-1">
                {filteredTasks.map(t => (
                  <div
                    key={t.id}
                    onClick={() => handleSelect(`/tasks`)}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[var(--bg-main)] cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-main)]">{t.title}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-sec)]">
                        {t.status}
                      </span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[var(--text-sec)]" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {filteredUsers.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-[var(--text-sec)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <UserCircle2 className="w-3.5 h-3.5 text-[#E9A23B]" /> Employees ({filteredUsers.length})
              </p>
              <div className="space-y-1">
                {filteredUsers.map(u => (
                  <div
                    key={u.id}
                    onClick={() => handleSelect(`/employees`)}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[var(--bg-main)] cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <img src={u.avatar} alt={u.name} className="w-6 h-6 rounded-full object-cover" />
                      <div>
                        <p className="text-xs font-semibold text-[var(--text-main)]">{u.name}</p>
                        <p className="text-[10px] text-[var(--text-sec)]">{u.designation} • {u.department}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[var(--text-sec)]" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

