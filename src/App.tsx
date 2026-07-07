import React, { useState, useEffect } from 'react';
import { usePostHog } from 'posthog-js/react';
import { useHdbData } from './hooks/useHdbData.ts';
import Dashboard, { SectionStates } from './components/Dashboard.tsx';
import Sidebar from './components/Sidebar.tsx';
import { FLAT_TYPES, TOWNS } from './data/constants.ts';
import { formatMonthYear } from './utils/formatters.ts';

// --- Filter Summary Component ---
const FilterPill: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center text-[11px] uppercase tracking-wider font-semibold bg-slate-100 text-slate-600 rounded-md px-2 py-1 border border-slate-200">
    <span className="opacity-60 mr-1.5">{label}:</span>
    <span className="text-slate-900">{value}</span>
  </div>
);

interface FilterSummaryProps {
  filtersA: {
    towns: string[];
    flatTypes: string[];
    leaseRange: [number, number];
  };
  filtersB: {
    towns: string[];
    flatTypes: string[];
    leaseRange: [number, number];
  };
  selectedDateRange: [string, string];
  isComparisonMode: boolean;
  allLeaseYearsDomain: [number, number];
  allMonths: string[];
}

const FilterSummary: React.FC<FilterSummaryProps> = ({
  filtersA,
  filtersB,
  selectedDateRange,
  isComparisonMode,
  allLeaseYearsDomain,
  allMonths,
}) => {
  const isDefaultDateRange =
    allMonths.length > 0 &&
    selectedDateRange[0] === allMonths[0] &&
    selectedDateRange[1] === allMonths[allMonths.length - 1];
  
  const isDefaultLeaseRange = (range: [number, number]) =>
    allLeaseYearsDomain.length > 0 &&
    range[0] === allLeaseYearsDomain[0] &&
    range[1] === allLeaseYearsDomain[1];

  const getPillValue = (selectedItems: string[]): string => {
      if (selectedItems.length === 0) return 'All';
      if (selectedItems.length === 1) return selectedItems[0];
      if (selectedItems.length > 2) return `${selectedItems.length} selected`;
      return selectedItems.join(', ');
  };

  const getActiveFilters = (towns: string[], types: string[], lease: [number, number]) => [
    towns.length > 0 && { label: 'Town', value: getPillValue(towns) },
    types.length > 0 && { label: 'Room Type', value: getPillValue(types) },
    !isDefaultLeaseRange(lease) && { label: 'Lease', value: `${lease[0]} - ${lease[1]} yrs` },
  ].filter(Boolean) as { label: string; value: string }[];

  const activeFiltersA = getActiveFilters(filtersA.towns, filtersA.flatTypes, filtersA.leaseRange);
  const activeFiltersB = isComparisonMode ? getActiveFilters(filtersB.towns, filtersB.flatTypes, filtersB.leaseRange) : [];

  const hasAnyFilters = activeFiltersA.length > 0 || activeFiltersB.length > 0 || !isDefaultDateRange;

  if (!hasAnyFilters) return null;

  return (
    <div className="w-full mt-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          {!isDefaultDateRange && (
            <FilterPill 
              label="Date Range"
              value={`${formatMonthYear(selectedDateRange[0])} - ${formatMonthYear(selectedDateRange[1])}`} 
            />
          )}
          
          {isComparisonMode ? (
            <>
              <div className="flex items-center gap-2 p-1.5 bg-indigo-50 rounded-lg border border-indigo-100">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest px-1">A</span>
                {activeFiltersA.length > 0 ? activeFiltersA.map((f) => (
                  <FilterPill key={`A-${f.label}`} label={f.label} value={f.value} />
                )) : <span className="text-[10px] text-indigo-300 font-medium">No filters</span>}
              </div>
              <div className="flex items-center gap-2 p-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest px-1">B</span>
                {activeFiltersB.length > 0 ? activeFiltersB.map((f) => (
                  <FilterPill key={`B-${f.label}`} label={f.label} value={f.value} />
                )) : <span className="text-[10px] text-emerald-400 font-medium">No filters</span>}
              </div>
            </>
          ) : (
            activeFiltersA.map((f) => (
              <FilterPill key={f.label} label={f.label} value={f.value} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};


// --- Main App Component ---
const App: React.FC = () => {
  const hdbData = useHdbData();
  const posthog = usePostHog();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sectionStates, setSectionStates] = useState<SectionStates>({
    summary: true,
    distribution: true,
    trends: true,
    categories: true,
  });

  const handleSectionToggle = (section: keyof SectionStates, isOpen: boolean) => {
    setSectionStates(prev => ({
      ...prev,
      [section]: isOpen
    }));
  };

  // Set sidebar to be open by default on larger screens
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const handleResize = () => setIsSidebarOpen(mediaQuery.matches);
    handleResize(); // Set initial state
    mediaQuery.addEventListener('change', handleResize);
    return () => mediaQuery.removeEventListener('change', handleResize);
  }, []);

  // SEO: Dynamically update page title based on filters
  useEffect(() => {
    const baseTitle = 'SG HDB Resale Price Dashboard';
    
    const { filtersA } = hdbData;

    let prefix = '';
    if (filtersA.flatTypes.length > 0 || filtersA.towns.length > 0) {
        const parts = [];
        if (filtersA.flatTypes.length === 1) {
            parts.push(filtersA.flatTypes[0]);
        } else if (filtersA.flatTypes.length > 1) {
            parts.push(`${filtersA.flatTypes.length} Room Types`);
        }

        if (filtersA.towns.length === 1) {
            parts.push(`in ${filtersA.towns[0]}`);
        } else if (filtersA.towns.length > 1) {
            parts.push(`in ${filtersA.towns.length} Towns`);
        }
        prefix = parts.join(' ') + ' | ';
    }

    document.title = `${prefix}${baseTitle}`;

  }, [hdbData.filtersA]);

  // PostHog Tracking: Filters Applied (Debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (posthog) {
        posthog.capture('filters_applied', {
          towns: hdbData.filtersA.towns,
          flat_types: hdbData.filtersA.flatTypes,
          start_month: hdbData.selectedDateRange[0],
          end_month: hdbData.selectedDateRange[1],
          min_lease: hdbData.filtersA.leaseRange[0],
          max_lease: hdbData.filtersA.leaseRange[1],
          is_comparison_mode: hdbData.isComparisonMode,
          segment_b_towns: hdbData.isComparisonMode ? hdbData.filtersB.towns : undefined,
          segment_b_flat_types: hdbData.isComparisonMode ? hdbData.filtersB.flatTypes : undefined,
          segment_b_min_lease: hdbData.isComparisonMode ? hdbData.filtersB.leaseRange[0] : undefined,
          segment_b_max_lease: hdbData.isComparisonMode ? hdbData.filtersB.leaseRange[1] : undefined,
          active_years: hdbData.activeYears,
          active_years_count: hdbData.activeYears.length,
        });
      }
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [
    hdbData.filtersA, 
    hdbData.filtersB, 
    hdbData.selectedDateRange,
    hdbData.isComparisonMode,
    hdbData.activeYears,
    posthog
  ]);

  const sidebarProps = {
    isOpen: isSidebarOpen,
    setIsOpen: setIsSidebarOpen,
    allMonths: hdbData.allMonthsToFetch,
    allMonthsToFetch: hdbData.allMonthsToFetch,
    monthsWithData: hdbData.allMonthsXDomain,
    filtersA: hdbData.filtersA,
    filtersB: hdbData.filtersB,
    selectedDateRange: hdbData.selectedDateRange,
    setFiltersA: hdbData.setFiltersA,
    setFiltersB: hdbData.setFiltersB,
    setSelectedDateRange: hdbData.setSelectedDateRange,
    flatTypes: FLAT_TYPES,
    towns: TOWNS,
    allLeaseYearsDomain: hdbData.allLeaseYearsDomain,
    isComparisonMode: hdbData.isComparisonMode,
    setIsComparisonMode: (isComparison: boolean) => {
      hdbData.setIsComparisonMode(isComparison);
      posthog?.capture('comparison_mode_toggled', {
        is_comparison_mode: isComparison
      });
    },
    isDataFullyLoaded: hdbData.isDataFullyLoaded,
    ensureDataForRange: hdbData.ensureDataForRange,
    loading: hdbData.isIncrementalLoading,
    activeYears: hdbData.activeYears,
    handleYearSelect: async (year: string) => {
      await hdbData.handleYearSelect(year);
      posthog?.capture('year_toggled', {
        year: year,
        action: hdbData.activeYears.includes(year) ? 'removed' : 'added'
      });
    },
    removeDataForRange: hdbData.removeDataForRange,
  };

  const commonDashboardProps = {
    loading: hdbData.loading,
    error: hdbData.error,
    loadingMessage: hdbData.loadingMessage,
    chartXDomain: hdbData.chartXDomain,
    boxPlotMetric: hdbData.boxPlotMetric,
    setBoxPlotMetric: (metric: any) => {
      hdbData.setBoxPlotMetric(metric);
      posthog?.capture('metric_toggled', {
        chart_name: 'price_distribution',
        selected_metric: metric
      });
    },
    lineChartMetric: hdbData.lineChartMetric,
    setLineChartMetric: hdbData.setLineChartMetric,
    stackedBarChartMode: hdbData.stackedBarChartMode,
    setStackedBarChartMode: (mode: any) => {
      hdbData.setStackedBarChartMode(mode);
      posthog?.capture('chart_mode_toggled', {
        chart_name: 'transaction_volume',
        selected_mode: mode
      });
    },
    sectionStates,
    onSectionToggle: (section: keyof SectionStates, isOpen: boolean) => {
      handleSectionToggle(section, isOpen);
      posthog?.capture('section_toggled', {
        section_title: section,
        is_open: isOpen
      });
    },
  };

  const dashboardPropsA = {
    ...commonDashboardProps,
    ...hdbData.dashboardDataA,
  };

  const dashboardPropsB = {
    ...commonDashboardProps,
    ...hdbData.dashboardDataB,
  };
  
  const filterSummaryProps = {
    filtersA: hdbData.filtersA,
    filtersB: hdbData.filtersB,
    isComparisonMode: hdbData.isComparisonMode,
    selectedDateRange: hdbData.selectedDateRange,
    allMonths: hdbData.allMonthsToFetch,
    allLeaseYearsDomain: hdbData.allLeaseYearsDomain,
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      <Sidebar {...sidebarProps} />

      <div className={`flex flex-col flex-1 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'lg:ml-80' : 'lg:ml-0'}`}>
        <header className="sticky top-0 z-20 flex flex-col p-6 lg:px-10 border-b border-slate-200 bg-white/80 backdrop-blur-md">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className={`p-2 mr-4 rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${isSidebarOpen ? 'opacity-0 pointer-events-none w-0 mr-0' : 'opacity-100'}`}
                aria-label="Open filters sidebar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  HDB Market Intelligence
                </h1>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mt-1">Real-time Resale Analytics Dashboard</p>
              </div>
            </div>
          </div>
          <FilterSummary {...filterSummaryProps} />
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-10">
          {hdbData.isComparisonMode ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-bold shadow-lg shadow-indigo-200">A</div>
                  <h2 className="text-xl font-bold text-slate-800">Primary Segment</h2>
                </div>
                <Dashboard {...dashboardPropsA} />
              </div>
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-emerald-600 text-white rounded-lg flex items-center justify-center font-bold shadow-lg shadow-emerald-200">B</div>
                  <h2 className="text-xl font-bold text-slate-800">Comparison Segment</h2>
                </div>
                <Dashboard {...dashboardPropsB} />
              </div>
            </div>
          ) : (
            <Dashboard {...dashboardPropsA} />
          )}

          <footer className="text-center mt-12 pb-8 text-[11px] font-medium text-slate-400 uppercase tracking-widest">
            <p>Data provided by <a href="https://data.gov.sg" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">data.gov.sg</a></p>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default App;
