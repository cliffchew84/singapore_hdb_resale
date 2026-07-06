import { useState, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import { queryHdb, getUniqueFlatTypes } from '../services/parquetHdbService.ts';
import { FLAT_TYPE_MAP } from '../data/constants.ts';
import { HdbResaleRecord, BoxPlotStats, SummaryStatsData, LineChartDataPoint, BoxPlotMetric, StackedBarChartDataPoint, LineChartMetric, StackedBarChartMode, DashboardData } from '../types.ts';
import {
    parseRemainingLeaseToYears,
    calculateGlobalLeaseDomain,
    processDashboardData
} from '../utils/dataProcessor.ts';

export const useHdbData = () => {
    const [rawRecords, setRawRecords] = useState<HdbResaleRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [isIncrementalLoading, setIsIncrementalLoading] = useState<boolean>(false);
    const [isDataFullyLoaded, setIsDataFullyLoaded] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingMessage, setLoadingMessage] = useState<string>('Initializing DuckDB...');
    
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
    const [boxPlotMetric, setBoxPlotMetric] = useState<BoxPlotMetric>('price');
    const [lineChartMetric, setLineChartMetric] = useState<LineChartMetric>('grossTransactionValue');
    const [stackedBarChartMode, setStackedBarChartMode] = useState<StackedBarChartMode>('percentage');

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

    // Memoized calculation for stable domains
    const { allMonthsXDomain, allLeaseYearsDomain } = useMemo(() => {
        if (rawRecords.length === 0) return { 
            allMonthsXDomain: [], 
            allLeaseYearsDomain: [0, 99] as [number, number],
        };
        const allMonths = [...new Set(rawRecords.map(r => r.month))].sort();
        return { 
            allMonthsXDomain: allMonths, 
            allLeaseYearsDomain: [calculateGlobalLeaseDomain(rawRecords)[0], 99] as [number, number],
        };
    }, [rawRecords]);

    // Initial Data Load
    useEffect(() => {
        let isMounted = true;
        async function loadInitialData() {
            try {
                // DEBUG: Log unique flat types to console to verify mapping
                const uniqueTypes = await getUniqueFlatTypes();
                console.log('🔍 Unique Flat Types in Parquet:', uniqueTypes);

                setLoading(true);
                setLoadingMessage('Querying Parquet via DuckDB...');
                const initialFilter = {
                    startMonth: '2020-01',
                    endMonth: '2026-12',
                    selectedTowns: [],
                    selectedFlatTypes: [],
                    selectedLeaseRange: [0, 99],
                };
                const records = await queryHdb(initialFilter);
                if (isMounted) {
                    setRawRecords(records);
                    setIsDataFullyLoaded(true);
                    if (records.length > 0) {
                        const months = [...new Set(records.map(r => r.month))].sort();
                        const leaseDomain = calculateGlobalLeaseDomain(records);
                        setSelectedDateRange([months[0], months[months.length - 1]]);
                        setSelectedLeaseRange([leaseDomain[0], 99]);
                        setSelectedLeaseRangeB([leaseDomain[0], 99]);
                    }
                }
            } catch (e) {
                if (isMounted) setError(e instanceof Error ? e.message : 'An unknown error occurred.');
            } finally {
                if (isMounted) {
                    setLoading(false);
                    setLoadingMessage('');
                }
            }
        }
        loadInitialData();
        return () => { isMounted = false; };
    }, []);

    // Update records whenever the date range changes
    useEffect(() => {
        let isMounted = true;
        if (!selectedDateRange[0] || !selectedDateRange[1]) return;

        async function updateData() {
            try {
                setIsIncrementalLoading(true);
                setLoadingMessage('Updating dataset...');
                const filter = {
                    startMonth: selectedDateRange[0],
                    endMonth: selectedDateRange[1],
                    selectedTowns: [],
                    selectedFlatTypes: [],
                    selectedLeaseRange: [0, 99],
                };
                const data = await queryHdb(filter);
                if (isMounted) {
                    setRawRecords(data);
                    setLoadingMessage('');
                }
            } catch (e) {
                if (isMounted) setError(e instanceof Error ? e.message : 'An unknown error occurred.');
            } finally {
                if (isMounted) setIsIncrementalLoading(false);
            }
        }
        updateData();
        return () => { isMounted = false; };
    }, [selectedDateRange]);

    const ensureDataForRange = async (startDate: string, endDate: string) => {
        // Handled by the useEffect date range update
    };

    const removeDataForRange = (startDate: string, endDate: string) => {
        // Handled by the useEffect date range update
    };

    const handleYearSelect = async (year: string) => {
      const yearMonths = allMonthsToFetch.filter(m => m.startsWith(year));
      if (yearMonths.length === 0) return;
      const startDate = yearMonths[0];
      const endDate = yearMonths[yearMonths.length - 1];
      setSelectedDateRange(prev => {
          const newStart = prev[0] === '' || startDate < prev[0] ? startDate : prev[0];
          const newEnd = prev[1] === '' || endDate > prev[1] ? endDate : prev[1];
          return [newStart, newEnd];
      });
    };

    const activeYears = useMemo(() => {
        const years = new Set<string>();
        const [start, end] = selectedDateRange;
        if (!start || typeof start !== 'string' || !end || typeof end !== 'string') return [];
        const startYear = parseInt(start.split('-')[0]);
        const endYear = parseInt(end.split('-')[0]);
        
        if (isNaN(startYear) || isNaN(endYear)) return [];
        for (let y = startYear; y <= endYear; y++) {
            years.add(y.toString());
        }
        return Array.from(years);
    }, [selectedDateRange]);

    const filteredRecords = useMemo(() => {
        if (rawRecords.length === 0 || !selectedDateRange[0] || !selectedDateRange[1]) return [];
        const [startDateStr, endDateStr] = selectedDateRange;
        
        const mappedFlatTypes = selectedFlatTypes.map(t => FLAT_TYPE_MAP[t] || t);

        return rawRecords.filter(r => {
            const isInDateRange = r.month >= startDateStr && r.month <= endDateStr;
            const isTownMatch = selectedTowns.length === 0 || selectedTowns.includes(r.town);
            const isFlatTypeMatch = mappedFlatTypes.length === 0 || 
                (r.type && mappedFlatTypes.some(m => m.toUpperCase() === r.type.toUpperCase()));
            const leaseYears = parseRemainingLeaseToYears(r.lease);
            const isLeaseMatch = leaseYears !== null && leaseYears >= selectedLeaseRange[0] && leaseYears <= selectedLeaseRange[1];
            return isInDateRange && isTownMatch && isFlatTypeMatch && isLeaseMatch;
        });
    }, [rawRecords, selectedTowns, selectedFlatTypes, selectedDateRange, selectedLeaseRange]);

    const filteredRecordsB = useMemo(() => {
        if (!isComparisonMode || rawRecords.length === 0 || !selectedDateRange[0] || !selectedDateRange[1]) return [];
        const [startDateStr, endDateStr] = selectedDateRange;
        
        const mappedFlatTypesB = selectedFlatTypesB.map(t => FLAT_TYPE_MAP[t] || t);

        return rawRecords.filter(r => {
            const isInDateRange = r.month >= startDateStr && r.month <= endDateStr;
            const isTownMatch = selectedTownsB.length === 0 || selectedTownsB.includes(r.town);
            const isFlatTypeMatch = mappedFlatTypesB.length === 0 || 
                (r.type && mappedFlatTypesB.some(m => m.toUpperCase() === r.type.toUpperCase()));
            const leaseYears = parseRemainingLeaseToYears(r.lease);
            const isLeaseMatch = leaseYears !== null && leaseYears >= selectedLeaseRangeB[0] && leaseYears <= selectedLeaseRangeB[1];
            return isInDateRange && isTownMatch && isFlatTypeMatch && isLeaseMatch;
        });
    }, [isComparisonMode, rawRecords, selectedTownsB, selectedFlatTypesB, selectedDateRange, selectedLeaseRangeB]);
    
    const chartXDomain = useMemo(() => {
        if (!selectedDateRange[0] || !selectedDateRange[1] || allMonthsXDomain.length === 0) return [];
        const startIndex = allMonthsXDomain.indexOf(selectedDateRange[0]);
        const endIndex = allMonthsXDomain.indexOf(selectedDateRange[1]);
        if (startIndex === -1 || endIndex === -1) return [];
        return allMonthsXDomain.slice(startIndex, endIndex + 1);
    }, [allMonthsXDomain, selectedDateRange]);

    const dashboardDataA = useMemo<DashboardData>(() => 
        processDashboardData(filteredRecords, chartXDomain, boxPlotMetric),
        [filteredRecords, chartXDomain, boxPlotMetric]
    );

    const dashboardDataB = useMemo<DashboardData>(() => 
        processDashboardData(filteredRecordsB, chartXDomain, boxPlotMetric),
        [filteredRecordsB, chartXDomain, boxPlotMetric]
    );

    const syncedDashboardData = useMemo(() => {
        if (!isComparisonMode) return { a: dashboardDataA, b: dashboardDataB };
        const sync = (valA: [number, number], valB: [number, number]): [number, number] => [0, Math.max(valA[1], valB[1])];
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
