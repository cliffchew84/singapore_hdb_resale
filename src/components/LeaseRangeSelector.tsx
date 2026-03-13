import React, { useState, useMemo, useRef, useEffect } from 'react';

const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

interface LeaseRangeSelectorProps {
  min: number;
  max: number;
  selectedRange: [number, number];
  onChange: (range: [number, number]) => void;
  disabled?: boolean;
}

const LeaseRangeSelector: React.FC<LeaseRangeSelectorProps> = ({ min, max, selectedRange, onChange, disabled = false }) => {
    const [openPicker, setOpenPicker] = useState<'start' | 'end' | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLUListElement>(null);

    // Generate array of all possible years, from newest to oldest
    const allYears = useMemo(() => {
        if (min > max) return [];
        const years = [];
        for (let i = max; i >= min; i--) {
            years.push(i);
        }
        return years;
    }, [min, max]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpenPicker(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Scroll to the selected year when the picker opens
    useEffect(() => {
        if (openPicker && scrollContainerRef.current) {
            const targetYear = openPicker === 'start' ? selectedRange[0] : selectedRange[1];
            const targetElement = scrollContainerRef.current.querySelector(`[data-year="${targetYear}"]`);
            
            if (targetElement) {
                targetElement.scrollIntoView({ block: 'center', behavior: 'auto' });
            }
        }
    }, [openPicker, selectedRange]);

    const handleYearSelect = (year: number) => {
        const [startLease, endLease] = selectedRange;
        if (openPicker === 'start') {
            onChange([year, Math.max(year, endLease)]);
        } else {
            onChange([Math.min(year, startLease), year]);
        }
        setOpenPicker(null);
    };

    const renderPicker = () => {
        if (!openPicker) return null;
        
        const [startLease, endLease] = selectedRange;

        return (
            <div className="absolute top-full mt-2 w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg z-10 max-h-72 overflow-y-auto">
                <ul className="p-1" ref={scrollContainerRef}>
                    {allYears.map(year => {
                        const isSelected = (
                            (openPicker === 'start' && year === startLease) ||
                            (openPicker === 'end' && year === endLease)
                        );
                        const isDisabled = (
                            (openPicker === 'start' && year > endLease) ||
                            (openPicker === 'end' && year < startLease)
                        );
                        
                        const itemClasses = `
                            px-3 py-1.5 text-sm rounded-md transition-colors w-full text-left
                            ${isDisabled ? 'text-slate-400 dark:text-slate-500 cursor-not-allowed' : 'hover:bg-indigo-100 dark:hover:bg-indigo-500 cursor-pointer'}
                            ${isSelected ? 'bg-indigo-500 text-white font-semibold' : 'text-slate-700 dark:text-slate-300'}
                        `;
                        
                        return (
                            <li key={year}>
                                <button
                                    data-year={year}
                                    disabled={isDisabled}
                                    onClick={() => handleYearSelect(year)}
                                    className={itemClasses}
                                >
                                    {year} years
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    };

    return (
        <div ref={containerRef} className="relative w-full">
            <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                    <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Min Lease</span>
                    <button
                        onClick={() => setOpenPicker(openPicker === 'start' ? null : 'start')}
                        disabled={disabled}
                        className="w-full flex justify-between items-center px-3 py-2 text-sm text-left border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="text-slate-900 dark:text-slate-100">{disabled ? 'Loading...' : `${selectedRange[0]} yrs`}</span>
                        <ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${openPicker === 'start' ? 'rotate-180' : ''}`} />
                    </button>
                </div>
                <div className="flex-1">
                    <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Max Lease</span>
                    <button
                        onClick={() => setOpenPicker(openPicker === 'end' ? null : 'end')}
                        disabled={disabled}
                        className="w-full flex justify-between items-center px-3 py-2 text-sm text-left border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="text-slate-900 dark:text-slate-100">{disabled ? 'Loading...' : `${selectedRange[1]} yrs`}</span>
                        <ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${openPicker === 'end' ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>
            {renderPicker()}
        </div>
    );
};

export default LeaseRangeSelector;