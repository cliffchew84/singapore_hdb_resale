import React, { useState, useMemo, useRef, useEffect } from 'react';
import { formatMonthYear } from '../utils/formatters.ts';

interface DateRangeSelectorProps {
  allMonths: string[];
  allMonthsToFetch: string[];
  monthsWithData: string[];
  selectedRange: [string, string];
  onChange: (range: [string, string]) => void;
  disabled?: boolean;
  ensureDataForRange: (start: string, end: string) => Promise<void>;
}

// Display months in reverse chronological order for the UI grid
const REVERSED_MONTH_NAMES = ["Dec", "Nov", "Oct", "Sep", "Aug", "Jul", "Jun", "May", "Apr", "Mar", "Feb", "Jan"];

const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

export const QuickFilterButton: React.FC<{
  onClick: () => void;
  isActive: boolean;
  children: React.ReactNode;
}> = ({ onClick, isActive, children }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors whitespace-nowrap ${
      isActive
        ? 'bg-indigo-600 text-white shadow'
        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
    }`}
  >
    {children}
  </button>
);

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({ allMonths, allMonthsToFetch, monthsWithData, selectedRange, onChange, disabled = false, ensureDataForRange }) => {
    const [openPicker, setOpenPicker] = useState<'start' | 'end' | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const groupedMonths = useMemo(() => {
        const groups: { [year: string]: number[] } = {};
        allMonths.forEach(monthStr => {
            if (typeof monthStr !== 'string') return;
            const parts = monthStr.split('-');
            if (parts.length !== 2) return;
            const [year, month] = parts.map(Number);
            if (!groups[year]) groups[year] = [];
            groups[year].push(month - 1);
        });
        Object.values(groups).forEach(months => months.sort((a, b) => a - b));
        // Sort years from newest to oldest
        return Object.entries(groups).sort((a, b) => parseInt(b[0]) - parseInt(a[0]));
    }, [allMonths]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpenPicker(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Scroll to the selected month when the picker opens
    useEffect(() => {
        if (openPicker && scrollContainerRef.current) {
            const targetMonthStr = openPicker === 'start' ? selectedRange[0] : selectedRange[1];
            const targetElement = scrollContainerRef.current.querySelector(`[data-month-str="${targetMonthStr}"]`);
            if (targetElement) {
                targetElement.scrollIntoView({ block: 'center', behavior: 'auto' });
            }
        }
    }, [openPicker, selectedRange]);

    const handleMonthSelect = async (year: string, monthIndex: number) => {
        const monthString = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
        let newRange: [string, string];
        if (openPicker === 'start') {
            const currentEndDateStr = selectedRange[1];
            newRange = [monthString, monthString > currentEndDateStr ? monthString : currentEndDateStr];
        } else { // openPicker === 'end'
            const currentStartDateStr = selectedRange[0];
            newRange = [monthString < currentStartDateStr ? monthString : currentStartDateStr, monthString];
        }
        
        await ensureDataForRange(newRange[0], newRange[1]);
        onChange(newRange);
        setOpenPicker(null);
    };
    
    // Compute the max available month (last month with data)
    const maxMonthWithData = monthsWithData.length > 0 ? monthsWithData[monthsWithData.length - 1] : null;

    const renderPicker = () => {
        if (!openPicker) return null;
        
        const [startRangeStr, endRangeStr] = selectedRange;

        return (
            <div ref={scrollContainerRef} className="absolute top-full mt-2 w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg z-10 max-h-72 overflow-y-auto">
                {groupedMonths.map(([year, months]) => (
                    <div key={year} className="p-2">
                        <h4 className="font-bold text-center text-sm text-slate-800 dark:text-slate-200 py-1">{year}</h4>
                        <div className="grid grid-cols-4 gap-1">
                            {REVERSED_MONTH_NAMES.map((name, revIndex) => {
                                // Convert reversed index (0=Dec) to standard month index (11=Dec)
                                const originalMonthIndex = 11 - revIndex;
                                
                                if (!months.includes(originalMonthIndex)) {
                                    return <div key={name} className="p-1.5 text-center text-xs rounded-md" />;
                                }
                                
                                const monthString = `${year}-${String(originalMonthIndex + 1).padStart(2, '0')}`;
                                
                                const isSelected = (
                                    (openPicker === 'start' && monthString === startRangeStr) ||
                                    (openPicker === 'end' && monthString === endRangeStr)
                                );

                                // For end date, disable months beyond the max available month
                                const isDisabled = openPicker === 'end' && maxMonthWithData !== null && monthString > maxMonthWithData;

                                const buttonClasses = `
                                    p-1.5 text-center text-xs rounded-md transition-colors
                                    ${isDisabled ? 'text-slate-400 dark:text-slate-500 cursor-not-allowed' : 'hover:bg-indigo-100 dark:hover:bg-indigo-500'}
                                    ${isSelected ? 'bg-indigo-500 text-white font-semibold' : 'text-slate-700 dark:text-slate-300'}
                                `;
                                
                                return (
                                    <button
                                        key={name}
                                        data-month-str={monthString}
                                        disabled={isDisabled}
                                        onClick={() => handleMonthSelect(year, originalMonthIndex)}
                                        className={buttonClasses}
                                    >
                                        {name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div ref={containerRef} className="relative w-full">
            <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                    <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Start Date</span>
                    <button
                        onClick={() => setOpenPicker(openPicker === 'start' ? null : 'start')}
                        disabled={disabled}
                        className="w-full flex justify-between items-center px-3 py-2 text-sm text-left border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="text-slate-900 dark:text-slate-100">{disabled ? 'Loading...' : formatMonthYear(selectedRange[0])}</span>
                        <ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${openPicker === 'start' ? 'rotate-180' : ''}`} />
                    </button>
                </div>
                <div className="flex-1">
                    <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">End Date</span>
                    <button
                        onClick={() => setOpenPicker(openPicker === 'end' ? null : 'end')}
                        disabled={disabled}
                        className="w-full flex justify-between items-center px-3 py-2 text-sm text-left border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="text-slate-900 dark:text-slate-100">{disabled ? 'Loading...' : formatMonthYear(selectedRange[1])}</span>
                        <ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${openPicker === 'end' ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>
            {renderPicker()}
        </div>
    );
};

export default DateRangeSelector;