import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as d3 from 'd3';
import { fetchHdbDataByMonth } from '../services/hdbService.ts';
import { fetchHistoricalData } from '../services/mongoService.ts';
import { HdbResaleRecord, BoxPlotStats, SummaryStatsData, LineChartDataPoint, BoxPlotMetric, StackedBarChartDataPoint, LineChartMetric, StackedBarChartMode, DashboardData } from '../types.ts';
import {
    parseRemainingLeaseToYears,
    calculateGlobalLeaseDomain,
    processDashboardData
} from '../utils/dataProcessor.ts';

// This custom hook encapsulates all logic for fetching, caching, and processing HDB data.
export const useHdbData = () => {
    const [rawRecords, setRawRecords] = useState<HdbResaleRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [isIncrementalLoading, setIsIncrementalLoading] = useState<boolean>(false);
    const isLoadingRef = useRef(false);
    const [isDataFullyLoaded, setIsDataFullyLoaded] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingMessage, setLoadingMessage] = useState<string>('Initializing...');
    
    // Filter states
    const [isComparisonMode, setIsComparisonMode] = useState<boolean>(false);
    
    // Panel A
    const [selectedFlatTypes, setSelectedFlatTypes] = useState<string[]>([]);
    const [selectedTowns, setSelectedTowns] = useState<string[]>([]);
    const [selectedLeaseRange, setSelectedLeaseRange] = useState<[number, number]>([0, 99]);

    // Panel B
    const [selectedFlatTypesB, setSelectedFlatTypesB] = useState<string[]>([]);
    const [selectedTownsB, setSelectedTownsB] = useState<string[]>([]);
    const [selectedLeaseRangeB, setSelectedLeaseRangeB] = useState<[number, number]>([0, 99]);

    const [selectedDateRange, setSelectedDateRange] = useState<[string, string]>(['', '']);
    const [boxPlotMetric, setBoxPlotMetric] = useState<BoxPlotMetric>('resale_price');
    const [lineChartMetric, setLineChartMetric] = useState<LineChartMetric>('grossTransactionValue');
    const [stackedBarChartMode, setStackedBarChartMode] = useState<StackedBarChartMode>('percentage');

    // Memoized calculation for stable domains for axes and filters.
    const { allMonthsXDomain, allLeaseYearsDomain } = useMemo(() => {
        if (rawRecords.length === 0) return { 
            allMonthsXDomain: [], 
            allLeaseYearsDomain: [0, 99] as [number, number],
        };
        // FIX: Explicitly type 'a' and 'b' as strings in the sort callback to resolve type inference issue.
        const allMonths = [...new Set(rawRecords.map(r => r.month))].sort();
        return { 
            allMonthsXDomain: allMonths, 
            allLeaseYearsDomain: [calculateGlobalLeaseDomain(rawRecords)[0], 99] as [number, number],
        };
    }, [rawRecords]);

    // Helper to generate all months
    const allMonthsToFetch = useMemo(() => {
        const startYear = 2020;
        const startMonth = 1;
        const endYear = 2026;

        const months = [];
        for (let year = startYear; year <= endYear; year++) {
            const monthStart = (year === startYear) ? startMonth : 1;
            const monthEnd = 12;
            for (let month = monthStart; month <= monthEnd; month++) {
                months.push(`${year}-${month.toString().padStart(2, '0')}`);
            }
        }
        return months;
    }, []);

    // Function to fetch data for a specific set of months
    const fetchMonths = async (months: string[]) => {
        const newRecords: HdbResaleRecord[] = [];
        for (const month of months) {
            setLoadingMessage(`Fetching data for ${month}...`);
            const monthData = await fetchHdbDataByMonth(month);
            newRecords.push(...monthData);
        }
        return newRecords;
    };

    // Function to fetch a full year of data from MongoDB (2020-2025)
    const fetchYearFromMongo = async (year: string): Promise<HdbResaleRecord[]> => {
        setLoadingMessage(`Fetching data for ${year}...`);
        return await fetchHistoricalData(year);
    };

    // Effect to fetch initial 2026 data
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setLoading(true);
                const initialMonths = allMonthsToFetch.filter(m => m.startsWith('2026'));
                const records = await fetchMonths(initialMonths);
                setRawRecords(records);
                setIsDataFullyLoaded(true);
                
                // Set initial date range
                if (records.length > 0) {
                    const months = [...new Set(records.map(r => r.month))].sort();
                    const leaseDomain = calculateGlobalLeaseDomain(records);
                    setSelectedDateRange([months[0], months[months.length - 1]]);
                    setSelectedLeaseRange([leaseDomain[0], 99]);
                    setSelectedLeaseRangeB([leaseDomain[0], 99]);
                }
            } catch (e) {
                setError(e instanceof Error ? e.message : 'An unknown error occurred.');
            } finally {
                setLoading(false);
                setLoadingMessage('');
            }
        };
        loadInitialData();
    }, [allMonthsToFetch]);

    // Function to ensure data is loaded for a given range.
    // Routes to MongoDB (year-level) for 2020-2025, HDB API (month-level) for 2026.
    const ensureDataForRange = async (startDate: string, endDate: string) => {
        if (isLoadingRef.current) return;

        const requiredMonths = allMonthsToFetch.filter(m => m >= startDate && m <= endDate);
        const loadedMonths = [...new Set(rawRecords.map(r => r.month))];
        const missingMonths = requiredMonths.filter(m => !loadedMonths.includes(m));

        if (missingMonths.length === 0) return;

        // Group missing months by year
        const missingYears = [...new Set(missingMonths.map(m => m.split('-')[0]))];

        isLoadingRef.current = true;
        setIsIncrementalLoading(true);
        try {
            const allNewRecords: HdbResaleRecord[] = [];
            for (const year of missingYears) {
                if (year === '2026') {
                    // HDB API: fetch only the specific missing months
                    const monthsForYear = missingMonths.filter(m => m.startsWith(year));
                    const records = await fetchMonths(monthsForYear);
                    allNewRecords.push(...records);
                } else {
                    // MongoDB: fetch the entire year in one call.
                    // Full year is stored so future range expansions within this year are free.
                    const records = await fetchYearFromMongo(year);
                    allNewRecords.push(...records);
                }
            }
            const loadedMonthsSet = new Set(loadedMonths);
            const uniqueNewRecords = allNewRecords.filter(r => !loadedMonthsSet.has(r.month));
            setRawRecords(prev => [...prev, ...uniqueNewRecords]);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred.');
        } finally {
            isLoadingRef.current = false;
            setIsIncrementalLoading(false);
            setLoadingMessage('');
        }
    };

    // Function to remove data for a given range
    const removeDataForRange = (startDate: string, endDate: string) => {
        setRawRecords(prev => prev.filter(r => r.month < startDate || r.month > endDate));
    };

    const handleYearSelect = async (year: string) => {
      const yearMonths = allMonthsToFetch.filter(m => m.startsWith(year));
      if (yearMonths.length === 0) return;
      
      const startDate = yearMonths[0];
      const endDate = yearMonths[yearMonths.length - 1];
      
      await ensureDataForRange(startDate, endDate);
      
      setSelectedDateRange(prev => {
          const newStart = prev[0] === '' || startDate < prev[0] ? startDate : prev[0];
          const newEnd = prev[1] === '' || endDate > prev[1] ? endDate : prev[1];
          return [newStart, newEnd];
      });
    };

    const activeYears = useMemo(() => {
        const years = new Set<string>();
        const [start, end] = selectedDateRange;
        if (!start || !end) return [];
        
        const startYear = parseInt(start.split('-')[0]);
        const endYear = parseInt(end.split('-')[0]);
        
        for (let y = startYear; y <= endYear; y++) {
            years.add(y.toString());
        }
        return Array.from(years);
    }, [selectedDateRange]);

    // Memoized filtering of records based on all user selections.
    const filteredRecords = useMemo(() => {
        if (rawRecords.length === 0 || !selectedDateRange[0] || !selectedDateRange[1]) return [];
        const [startDateStr, endDateStr] = selectedDateRange;

        return rawRecords.filter(r => {
            const isInDateRange = r.month >= startDateStr && r.month <= endDateStr;
            const isTownMatch = selectedTowns.length === 0 || selectedTowns.includes(r.town);
            const isFlatTypeMatch = selectedFlatTypes.length === 0 || selectedFlatTypes.includes(r.flat_type);
            const leaseYears = parseRemainingLeaseToYears(r.remaining_lease);
            const isLeaseMatch = leaseYears !== null && leaseYears >= selectedLeaseRange[0] && leaseYears <= selectedLeaseRange[1];
            return isInDateRange && isTownMatch && isFlatTypeMatch && isLeaseMatch;
        });
    }, [rawRecords, selectedTowns, selectedFlatTypes, selectedDateRange, selectedLeaseRange]);

    const filteredRecordsB = useMemo(() => {
        if (!isComparisonMode || rawRecords.length === 0 || !selectedDateRange[0] || !selectedDateRange[1]) return [];
        const [startDateStr, endDateStr] = selectedDateRange;

        return rawRecords.filter(r => {
            const isInDateRange = r.month >= startDateStr && r.month <= endDateStr;
            const isTownMatch = selectedTownsB.length === 0 || selectedTownsB.includes(r.town);
            const isFlatTypeMatch = selectedFlatTypesB.length === 0 || selectedFlatTypesB.includes(r.flat_type);
            const leaseYears = parseRemainingLeaseToYears(r.remaining_lease);
            const isLeaseMatch = leaseYears !== null && leaseYears >= selectedLeaseRangeB[0] && leaseYears <= selectedLeaseRangeB[1];
            return isInDateRange && isTownMatch && isFlatTypeMatch && isLeaseMatch;
        });
    }, [isComparisonMode, rawRecords, selectedTownsB, selectedFlatTypesB, selectedDateRange, selectedLeaseRangeB]);
    
    // Memoized x-axis domain for the chart, based on the selected date range.
    const chartXDomain = useMemo(() => {
        if (!selectedDateRange[0] || !selectedDateRange[1] || allMonthsXDomain.length === 0) return [];
        const startIndex = allMonthsXDomain.indexOf(selectedDateRange[0]);
        const endIndex = allMonthsXDomain.indexOf(selectedDateRange[1]);
        if (startIndex === -1 || endIndex === -1) return [];
        return allMonthsXDomain.slice(startIndex, endIndex + 1);
    }, [allMonthsXDomain, selectedDateRange]);

    // Single-pass processing of filtered records for all charts and stats.
    const dashboardDataA = useMemo<DashboardData>(() => 
        processDashboardData(filteredRecords, chartXDomain, boxPlotMetric),
        [filteredRecords, chartXDomain, boxPlotMetric]
    );

    const dashboardDataB = useMemo<DashboardData>(() => 
        processDashboardData(filteredRecordsB, chartXDomain, boxPlotMetric),
        [filteredRecordsB, chartXDomain, boxPlotMetric]
    );

    const syncedDashboardData = useMemo(() => {
        if (!isComparisonMode) {
            return { a: dashboardDataA, b: dashboardDataB };
        }

        const sync = (valA: [number, number], valB: [number, number]): [number, number] => {
            return [0, Math.max(valA[1], valB[1])];
        };

        const sharedTransactionCountYDomain = sync(dashboardDataA.transactionCountYDomain, dashboardDataB.transactionCountYDomain);
        const sharedGrossTransactionValueYDomain = sync(dashboardDataA.grossTransactionValueYDomain, dashboardDataB.grossTransactionValueYDomain);
        const sharedMedianPsfYDomain = sync(dashboardDataA.medianPsfYDomain, dashboardDataB.medianPsfYDomain);
        const sharedMedianPricePerLeaseYDomain = sync(dashboardDataA.medianPricePerLeaseYDomain, dashboardDataB.medianPricePerLeaseYDomain);
        const sharedMillionDollarPercentageYDomain = sync(dashboardDataA.millionDollarPercentageYDomain, dashboardDataB.millionDollarPercentageYDomain);
        const sharedYDomain = sync(dashboardDataA.yDomain, dashboardDataB.yDomain);

        const syncedA: DashboardData = {
            ...dashboardDataA,
            transactionCountYDomain: sharedTransactionCountYDomain,
            grossTransactionValueYDomain: sharedGrossTransactionValueYDomain,
            medianPsfYDomain: sharedMedianPsfYDomain,
            medianPricePerLeaseYDomain: sharedMedianPricePerLeaseYDomain,
            millionDollarPercentageYDomain: sharedMillionDollarPercentageYDomain,
            yDomain: sharedYDomain
        };

        const syncedB: DashboardData = {
            ...dashboardDataB,
            transactionCountYDomain: sharedTransactionCountYDomain,
            grossTransactionValueYDomain: sharedGrossTransactionValueYDomain,
            medianPsfYDomain: sharedMedianPsfYDomain,
            medianPricePerLeaseYDomain: sharedMedianPricePerLeaseYDomain,
            millionDollarPercentageYDomain: sharedMillionDollarPercentageYDomain,
            yDomain: sharedYDomain
        };

        return { a: syncedA, b: syncedB };
    }, [isComparisonMode, dashboardDataA, dashboardDataB]);

    return {
        loading, error, loadingMessage, isDataFullyLoaded, isIncrementalLoading, 
        dashboardDataA: syncedDashboardData.a, dashboardDataB: syncedDashboardData.b, isComparisonMode, setIsComparisonMode,
        allMonthsXDomain, allMonthsToFetch, chartXDomain, 
        allLeaseYearsDomain, boxPlotMetric, lineChartMetric, stackedBarChartMode,
        selectedFlatTypes, selectedTowns, selectedDateRange, selectedLeaseRange,
        selectedFlatTypesB, selectedTownsB, selectedLeaseRangeB,
        setSelectedFlatTypes, setSelectedTowns, setSelectedDateRange, setSelectedLeaseRange,
        setSelectedFlatTypesB, setSelectedTownsB, setSelectedLeaseRangeB,
        setBoxPlotMetric, setLineChartMetric, setStackedBarChartMode,
        ensureDataForRange,
        removeDataForRange,
        handleYearSelect,
        activeYears,
    };
};