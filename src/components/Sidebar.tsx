import React, { useState } from 'react';
import DateRangeSelector, { QuickFilterButton } from './DateRangeSelector.tsx';
import MultiSelectDropdown from './MultiSelectDropdown.tsx';
import LeaseRangeSelector from './LeaseRangeSelector.tsx';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  allMonths: string[];
  allMonthsToFetch: string[];
  selectedFlatTypes: string[];
  selectedTowns: string[];
  selectedDateRange: [string, string];
  setSelectedFlatTypes: (types: string[]) => void;
  setSelectedTowns: (towns: string[]) => void;
  setSelectedDateRange: (range: [string, string]) => void;
  flatTypes: string[];
  towns: string[];
  allLeaseYearsDomain: [number, number];
  selectedLeaseRange: [number, number];
  setSelectedLeaseRange: (range: [number, number]) => void;
  // Panel B
  selectedFlatTypesB: string[];
  selectedTownsB: string[];
  selectedLeaseRangeB: [number, number];
  setSelectedFlatTypesB: (types: string[]) => void;
  setSelectedTownsB: (towns: string[]) => void;
  setSelectedLeaseRangeB: (range: [number, number]) => void;
  isComparisonMode: boolean;
  setIsComparisonMode: (mode: boolean) => void;
  isDataFullyLoaded: boolean;
  ensureDataForRange: (start: string, end: string) => Promise<void>;
  loading: boolean;
  activeYears: string[];
  handleYearSelect: (year: string) => Promise<void>;
  removeDataForRange: (start: string, end: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  setIsOpen,
  allMonths,
  allMonthsToFetch,
  selectedFlatTypes,
  selectedTowns,
  selectedDateRange,
  setSelectedFlatTypes,
  setSelectedTowns,
  setSelectedDateRange,
  flatTypes,
  towns,
  allLeaseYearsDomain,
  selectedLeaseRange,
  setSelectedLeaseRange,
  selectedFlatTypesB,
  selectedTownsB,
  selectedLeaseRangeB,
  setSelectedFlatTypesB,
  setSelectedTownsB,
  setSelectedLeaseRangeB,
  isComparisonMode,
  setIsComparisonMode,
  isDataFullyLoaded,
  ensureDataForRange,
  loading,
  activeYears,
  handleYearSelect,
  removeDataForRange,
}) => {
  const [isFetching, setIsFetching] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  const onYearButtonClick = async (year: string) => {
    setIsFetching(true);
    try {
        await handleYearSelect(year);
    } catch (error) {
        console.error('Failed to fetch data:', error);
    } finally {
        setIsFetching(false);
    }
  };

  return (
    <>
        {/* Backdrop for mobile overlay */}
        <div
            className={`fixed inset-0 bg-black/60 z-30 lg:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
        />

        {/* Sidebar Panel */}
        <aside
            className="fixed top-0 left-0 h-full w-80 bg-white border-r border-slate-200 shadow-xl lg:shadow-none z-40 transition-transform duration-300 ease-in-out"
            style={{ transform: isOpen ? 'translateX(0)' : 'translateX(-100%)' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sidebar-title"
        >
            <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-4 border-b border-slate-200">
                    <h2 id="sidebar-title" className="text-xl font-bold text-slate-900">Filters</h2>
                    <button 
                        onClick={() => setIsOpen(false)} 
                        className="p-2 -mr-2 rounded-md text-slate-500 hover:bg-slate-200"
                        aria-label="Close filters sidebar"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 lg:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 hidden lg:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                        </svg>
                    </button>
                </div>
                <div className="flex-grow p-4 space-y-6 overflow-y-auto">
                    {!isDataFullyLoaded ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-4 text-slate-500">
                            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-sm font-medium">Loading filters...</p>
                        </div>
                    ) : (
                        <>
                            {/* Global Controls */}
                            <div className="pb-6 border-b border-slate-100">
                                <div className="flex items-center justify-between mb-4">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Comparison Mode</label>
                                    <button
                                        onClick={() => setIsComparisonMode(!isComparisonMode)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${isComparisonMode ? 'bg-indigo-600' : 'bg-slate-200'}`}
                                    >
                                        <span 
                                            className="inline-block h-4 w-4 rounded-full bg-white transition-transform duration-200 ease-in-out" 
                                            style={{ transform: isComparisonMode ? 'translateX(1.5rem)' : 'translateX(0.25rem)' }}
                                        />
                                    </button>
                                </div>

                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Selected Period</label>
                                <div className="grid grid-cols-4 gap-2 mb-4">
                                    {Array.from({ length: 2026 - 2020 + 1 }, (_, i) => (2026 - i).toString()).map(year => (
                                        <QuickFilterButton
                                            key={year}
                                            onClick={() => onYearButtonClick(year)}
                                            isActive={activeYears.includes(year)}
                                        >
                                            {year}
                                        </QuickFilterButton>
                                    ))}
                                    <button
                                        onClick={() => setShowContactModal(true)}
                                        className="px-3 py-1 text-xs font-semibold rounded-full transition-colors whitespace-nowrap bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200"
                                    >
                                        More?
                                    </button>
                                </div>
                                <DateRangeSelector
                                    allMonths={allMonths}
                                    allMonthsToFetch={allMonthsToFetch}
                                    selectedRange={selectedDateRange}
                                    onChange={setSelectedDateRange}
                                    disabled={allMonths.length === 0 || loading}
                                    ensureDataForRange={ensureDataForRange}
                                />
                            </div>

                            {/* Panel A Filters */}
                            <div className={`space-y-4 ${isComparisonMode ? 'p-3 bg-indigo-50/50 rounded-xl border border-indigo-100' : ''}`}>
                                {isComparisonMode && <h3 className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider mb-1">Panel A: Primary Segment</h3>}
                                <MultiSelectDropdown
                                    label="Room Type"
                                    options={flatTypes}
                                    selectedOptions={selectedFlatTypes}
                                    onChange={setSelectedFlatTypes}
                                    placeholder="All Room Types"
                                />
                                <MultiSelectDropdown
                                    label="Town"
                                    options={towns}
                                    selectedOptions={selectedTowns}
                                    onChange={setSelectedTowns}
                                    placeholder="All Towns"
                                />
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Remaining Lease</label>
                                    <LeaseRangeSelector
                                        min={allLeaseYearsDomain[0]}
                                        max={allLeaseYearsDomain[1]}
                                        selectedRange={selectedLeaseRange}
                                        onChange={setSelectedLeaseRange}
                                        disabled={allMonths.length === 0}
                                    />
                                </div>
                            </div>

                            {/* Panel B Filters */}
                            {isComparisonMode && (
                                <div className="space-y-4 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                                    <h3 className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Panel B: Comparison Segment</h3>
                                    <MultiSelectDropdown
                                        label="Room Type"
                                        options={flatTypes}
                                        selectedOptions={selectedFlatTypesB}
                                        onChange={setSelectedFlatTypesB}
                                        placeholder="All Room Types"
                                    />
                                    <MultiSelectDropdown
                                        label="Town"
                                        options={towns}
                                        selectedOptions={selectedTownsB}
                                        onChange={setSelectedTownsB}
                                        placeholder="All Towns"
                                    />
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Remaining Lease</label>
                                        <LeaseRangeSelector
                                            min={allLeaseYearsDomain[0]}
                                            max={allLeaseYearsDomain[1]}
                                            selectedRange={selectedLeaseRangeB}
                                            onChange={setSelectedLeaseRangeB}
                                            disabled={allMonths.length === 0}
                                        />
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
                <div className="p-4 border-t border-slate-200 space-y-4">
                    {isFetching && (
                        <div className="flex items-center justify-center space-x-2 text-indigo-600">
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-xs font-medium">Fetching data...</span>
                        </div>
                    )}
                </div>
            </div>
        </aside>

        {/* Contact Modal */}
        {showContactModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 transform transition-all animate-in fade-in zoom-in duration-200">
                    <div className="flex items-center justify-center w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full mb-4 mx-auto">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Want more data?</h3>
                    <p className="text-slate-600 text-center mb-6">
                        If you're interested in historical data beyond this range or specialized datasets, please click below to reach out to me on LinkedIn!
                    </p>
                    <a
                        href="https://www.linkedin.com/in/cliff-chew-kt/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full py-2.5 mb-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-center shadow-lg shadow-blue-200"
                    >
                        Connect on LinkedIn
                    </a>
                    <button
                        onClick={() => setShowContactModal(false)}
                        className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        )}
    </>
  );
};

export default Sidebar;
