import React from 'react';
import { GanttChartSquare, Layers, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function TimelinePage() {
  const { projects } = useApp();

  // Gantt chart visualization across months
  const months = ['Aug 2026', 'Sep 2026', 'Oct 2026', 'Nov 2026', 'Dec 2026', 'Jan 2027', 'Feb 2027'];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)] tracking-tight">Timeline & Gantt Roadmap</h1>
        <p className="text-xs sm:text-sm text-[var(--text-sec)] mt-0.5">
          High-level project durations, milestone dependencies, release timelines, and progress bars.
        </p>
      </div>

      {/* Gantt Container */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Timeline Headers */}
            <div className="grid grid-cols-8 border-b border-[var(--border)] bg-[var(--bg-main)] text-xs font-bold text-[var(--text-sec)] py-3 px-4">
              <div className="col-span-2">Project Portfolio</div>
              {months.map(m => (
                <div key={m} className="text-center">{m}</div>
              ))}
            </div>

            {/* Timeline Project Rows */}
            <div className="divide-y divide-[var(--border)]">
              {projects.map(p => {
                // compute simulated visual offset
                const progressWidth = `${p.progress}%`;

                return (
                  <div key={p.id} className="grid grid-cols-8 items-center py-4 px-4 hover:bg-[var(--bg-main)] transition-colors">
                    <div className="col-span-2 pr-4">
                      <h4 className="font-bold text-xs text-[var(--text-main)] truncate">{p.name}</h4>
                      <div className="flex items-center gap-2 text-[10px] text-[var(--text-sec)] mt-0.5">
                        <span>{p.startDate}</span>
                        <span>→</span>
                        <span>{p.dueDate}</span>
                      </div>
                    </div>

                    {/* Gantt bar spanning the 6 month columns */}
                    <div className="col-span-6 relative h-7 bg-[var(--border)]/40 rounded-lg overflow-hidden flex items-center px-1">
                      <div
                        className="h-5 rounded-md bg-gradient-to-r from-[#635BFF] to-[#8B5CF6] text-white text-[10px] font-bold flex items-center px-2 shadow-xs transition-all"
                        style={{ width: progressWidth, minWidth: '40px' }}
                      >
                        {p.progress}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

