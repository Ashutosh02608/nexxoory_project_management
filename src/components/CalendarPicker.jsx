import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { asDate } from '../utils/dateHelpers';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/**
 * Format date value into 'DD MMM YYYY' or 'Month YYYY'
 */
function formatDisplayDate(dateStr, monthStr) {
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${String(d).padStart(2, '0')} ${SHORT_MONTHS[m - 1]} ${y}`;
  }
  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    const [y, m] = monthStr.split('-').map(Number);
    return `${SHORT_MONTHS[m - 1]} ${y}`;
  }
  return 'Select Date';
}

export default function CalendarPicker({
  selectedMonth = '', // 'YYYY-MM'
  selectedDate = '', // 'YYYY-MM-DD' (optional)
  onChange, // ({ month: 'YYYY-MM', date: 'YYYY-MM-DD' | '' }) => void
  onClear
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse initial view year and month without calling impure functions during render
  const initialYear = useMemo(() => {
    if (selectedMonth && /^\d{4}-\d{2}$/.test(selectedMonth)) {
      return Number(selectedMonth.slice(0, 4));
    }
    return asDate().getFullYear();
  }, [selectedMonth]);

  const initialMonth = useMemo(() => {
    if (selectedMonth && /^\d{4}-\d{2}$/.test(selectedMonth)) {
      return Number(selectedMonth.slice(5, 7)) - 1;
    }
    return asDate().getMonth();
  }, [selectedMonth]);

  const [viewYear, setViewYear] = useState(initialYear);
  const [viewMonth, setViewMonth] = useState(initialMonth);
  const [currentSelectedDate, setCurrentSelectedDate] = useState(() => selectedDate || (selectedMonth ? `${selectedMonth}-01` : ''));

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const todayStr = useMemo(() => {
    const t = asDate();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }, []);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const handleSelectDay = (day) => {
    const mStr = String(viewMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const fullDate = `${viewYear}-${mStr}-${dStr}`;
    const targetMonth = `${viewYear}-${mStr}`;
    setCurrentSelectedDate(fullDate);
    onChange({ month: targetMonth, date: fullDate });
    setIsOpen(false);
  };

  const handleSelectToday = () => {
    const t = asDate();
    const y = t.getFullYear();
    const m = t.getMonth();
    const mStr = String(m + 1).padStart(2, '0');
    const dStr = String(t.getDate()).padStart(2, '0');
    const fullDate = `${y}-${mStr}-${dStr}`;
    const targetMonth = `${y}-${mStr}`;
    setViewYear(y);
    setViewMonth(m);
    setCurrentSelectedDate(fullDate);
    onChange({ month: targetMonth, date: fullDate });
    setIsOpen(false);
  };

  const handleClear = () => {
    const t = asDate();
    const y = t.getFullYear();
    const m = t.getMonth();
    const mStr = String(m + 1).padStart(2, '0');
    const defaultMonth = `${y}-${mStr}`;
    setViewYear(y);
    setViewMonth(m);
    setCurrentSelectedDate('');
    if (onClear) {
      onClear();
    } else {
      onChange({ month: defaultMonth, date: '' });
    }
    setIsOpen(false);
  };

  // Compute days in month and starting day of week
  const daysInMonth = useMemo(() => {
    return new Date(viewYear, viewMonth + 1, 0).getDate();
  }, [viewYear, viewMonth]);

  const startDayOfWeek = useMemo(() => {
    return new Date(viewYear, viewMonth, 1).getDay();
  }, [viewYear, viewMonth]);

  // Generate Year options: 5 years back to 5 years forward
  const yearOptions = useMemo(() => {
    const currentActualYear = asDate().getFullYear();
    const years = [];
    for (let y = currentActualYear - 7; y <= currentActualYear + 7; y++) {
      years.push(y);
    }
    return years;
  }, []);

  const displayText = formatDisplayDate(currentSelectedDate, selectedMonth);

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] hover:border-[#635BFF] transition-colors cursor-pointer select-none"
      >
        <CalendarIcon className="w-3.5 h-3.5 text-[#635BFF] shrink-0" />
        <span className="font-medium whitespace-nowrap">{displayText}</span>
      </button>

      {/* Popover */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Choose date"
          className="absolute z-50 mt-1.5 left-0 sm:left-auto sm:right-0 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl p-4 w-[280px] sm:w-[300px] text-[var(--text-main)] animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Header Controls: Month/Year navigation & Selectors */}
          <div className="flex items-center justify-between gap-1 pb-3 mb-2 border-b border-[var(--border)]">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Previous month"
              className="p-1 text-[var(--text-sec)] hover:text-[var(--text-main)] hover:bg-[var(--bg-main)] rounded-lg cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5">
              {/* Quick Month Select */}
              <select
                aria-label="Select month"
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="text-xs font-semibold bg-transparent text-[var(--text-main)] outline-none cursor-pointer py-0.5"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx}>{name}</option>
                ))}
              </select>

              {/* Quick Year Select */}
              <select
                aria-label="Select year"
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="text-xs font-semibold bg-transparent text-[var(--text-main)] outline-none cursor-pointer py-0.5"
              >
                {yearOptions.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={nextMonth}
              aria-label="Next month"
              className="p-1 text-[var(--text-sec)] hover:text-[var(--text-main)] hover:bg-[var(--bg-main)] rounded-lg cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {DAYS_OF_WEEK.map(d => (
              <span key={d} className="text-[10px] font-bold text-[var(--text-sec)]">
                {d}
              </span>
            ))}
          </div>

          {/* Calendar Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Empty slots before first day */}
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-7 w-7" />
            ))}

            {/* Days in Month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const mStr = String(viewMonth + 1).padStart(2, '0');
              const dStr = String(day).padStart(2, '0');
              const thisDateStr = `${viewYear}-${mStr}-${dStr}`;

              const isToday = thisDateStr === todayStr;
              const isSelected = thisDateStr === currentSelectedDate;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`h-7 w-7 text-xs rounded-lg font-medium flex items-center justify-center cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#635BFF] text-white font-bold shadow-xs'
                      : isToday
                      ? 'border border-[#635BFF] text-[#635BFF] font-semibold bg-[#635BFF]/10'
                      : 'text-[var(--text-main)] hover:bg-[var(--bg-main)]'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Popover Footer: Today & Clear */}
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-[var(--border)] text-xs">
            <button
              type="button"
              onClick={handleSelectToday}
              className="font-semibold text-[#635BFF] hover:underline cursor-pointer"
            >
              Today
            </button>

            <button
              type="button"
              onClick={handleClear}
              className="text-[var(--text-sec)] hover:text-rose-500 cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
