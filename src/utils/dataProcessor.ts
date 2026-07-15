import * as d3 from 'd3';
import { 
  HdbResaleRecord, 
  BoxPlotStats, 
  Outlier, 
  SummaryStatsData, 
  LineChartDataPoint, 
  BoxPlotMetric, 
  StackedBarChartDataPoint, 
  DashboardData
} from '../types.ts';

/**
 * Parses a "X years Y months" string into a fractional number of years.
 * @param leaseStr The string to parse (e.g., "69 years 04 months").
 * @returns The total number of years, or null if parsing fails.
 */
export const parseRemainingLeaseToYears = (lease: string | number | undefined): number | null => {
    if (lease === undefined || lease === null) return null;
    
    if (typeof lease === 'number') {
        // If the value is <= 120, it's likely already in years (e.g., 95).
        // If it's > 120, it's likely in months (e.g., 1140).
        return lease <= 120 ? lease : lease / 12;
    }
    
    if (/^\d+$/.test(lease)) {
        const val = parseInt(lease, 10);
        return val <= 120 ? val : val / 12;
    }

    const match = lease.match(/(\d+)\s+years?(?:\s+(\d+)\s+months?)?/);
    if (!match) return null;
    
    const years = parseInt(match[1], 10);
    const months = match[2] ? parseInt(match[2], 10) : 0;
    
    return years + (months / 12);
};

export const calculateGlobalLeaseDomain = (records: HdbResaleRecord[]): [number, number] => {
    if (records.length === 0) return [0, 99];
    
    const leaseYears = records
        .map(r => parseRemainingLeaseToYears(r.lease))
        .filter(y => y !== null) as number[];
        
    if (leaseYears.length === 0) return [0, 99];

    const minLease = Math.floor(d3.min(leaseYears) ?? 0);
    const maxLease = Math.ceil(d3.max(leaseYears) ?? 99);
    
    return [minLease, maxLease];
};

/**
 * Performs a single-pass processing of HDB records to calculate all dashboard statistics.
 * This is significantly more efficient than calling multiple independent calculation functions.
 */
export const processDashboardData = (
    records: HdbResaleRecord[],
    xDomain: string[],
    boxPlotMetric: BoxPlotMetric
): DashboardData => {
    // 1. Initialize structures
    const summary: SummaryStatsData = { count: 0, grossTransactionValue: 0 };
    const monthMap = new Map<string, {
        records: {
            value: number;
            resale_price: number;
            flat_type: string;
            town: string;
            remaining_lease?: string;
            floor_area_sqft?: string;
        }[];
        prices: number[];
        psfValues: number[];
        pricePerLeaseValues: number[];
        priceCounts: {
            '0-300k': number;
            '300-500k': number;
            '500-800k': number;
            '800k-1m': number;
            '>=1m': number;
        };
        totalTransactions: number;
    }>();

    // Initialize month map with empty structures for all months in xDomain
    for (const month of xDomain) {
        monthMap.set(month, {
            records: [],
            prices: [],
            psfValues: [],
            pricePerLeaseValues: [],
            priceCounts: { '0-300k': 0, '300-500k': 0, '500-800k': 0, '800k-1m': 0, '>=1m': 0 },
            totalTransactions: 0
        });
    }

    // Global accumulators for summary stats
    const allPrices: number[] = [];
    const allPsfValues: number[] = [];
    const allPricePerLeaseValues: number[] = [];
    let millionDollarCount = 0;

    // 2. Single pass over records
    for (const r of records) {
        const monthData = monthMap.get(r.month);
        if (!monthData) continue; // Skip records outside xDomain

        const price = r.price;
        const area_sqft = r.area; // Already in square feet (converted in Python preprocessing)
        const lease_years = parseRemainingLeaseToYears(r.lease);

        // Calculate metric value for box plot
        let metricValue: number | null = null;
        if (boxPlotMetric === 'price') {
            metricValue = price;
        } else if (boxPlotMetric === 'price_psf' && area_sqft > 0) {
            metricValue = price / area_sqft; // area is already in sqft
        } else if (boxPlotMetric === 'price_per_lease' && lease_years !== null && lease_years > 0) {
            metricValue = price / lease_years;
        }

        // Update global summary accumulators
        summary.count++;
        summary.grossTransactionValue! += price;
        allPrices.push(price);
        if (price >= 1000000) millionDollarCount++;

        // Update month-specific data
        monthData.totalTransactions++;
        monthData.prices.push(price);

        if (metricValue !== null && !isNaN(metricValue)) {
            monthData.records.push({
                value: metricValue,
                resale_price: price,
                flat_type: r.type,
                town: r.town,
                remaining_lease: r.lease.toString(),
                floor_area_sqft: r.area.toString()
            });
        }

        if (area_sqft > 0) {
            const psf = price / area_sqft; // area is already in sqft
            monthData.psfValues.push(psf);
            allPsfValues.push(psf);
        }

        if (lease_years !== null && lease_years > 0) {
            const ppl = price / lease_years;
            monthData.pricePerLeaseValues.push(ppl);
            allPricePerLeaseValues.push(ppl);
        }

        // Price categories for stacked bar
        if (price < 300000) monthData.priceCounts['0-300k']++;
        else if (price < 500000) monthData.priceCounts['300-500k']++;
        else if (price < 800000) monthData.priceCounts['500-800k']++;
        else if (price < 1000000) monthData.priceCounts['800k-1m']++;
        else monthData.priceCounts['>=1m']++;
    }

    // 3. Finalize global summary stats
    if (summary.count > 0) {
        allPrices.sort(d3.ascending);
        allPsfValues.sort(d3.ascending);
        allPricePerLeaseValues.sort(d3.ascending);

        summary.median = d3.quantile(allPrices, 0.5);
        summary.min = allPrices[0];
        summary.max = allPrices[allPrices.length - 1];
        summary.median_psf = d3.quantile(allPsfValues, 0.5);
        summary.min_psf = allPsfValues[0];
        summary.max_psf = allPsfValues[allPsfValues.length - 1];
        summary.median_price_per_lease = d3.quantile(allPricePerLeaseValues, 0.5);
        summary.min_price_per_lease = allPricePerLeaseValues[0];
        summary.max_price_per_lease = allPricePerLeaseValues[allPricePerLeaseValues.length - 1];
        summary.millionDollarTransactionPercentage = (millionDollarCount / summary.count) * 100;
    }

    // 4. Process month-specific data for charts
    const processedData: BoxPlotStats[] = [];
    const lineChartData: LineChartDataPoint[] = [];
    const stackedBarChartData: StackedBarChartDataPoint[] = [];

    // Domain trackers
    let maxBoxPlotValue = 0;
    let maxTransactionCount = 0;
    let maxGrossValue = 0;
    let maxMedianPsf = 0;
    let maxMedianPPL = 0;
    let maxMillionDollarPct = 0;
    let maxStackedBarTotal = 0;

    for (const month of xDomain) {
        const m = monthMap.get(month)!;
        if (m.totalTransactions > maxStackedBarTotal) maxStackedBarTotal = m.totalTransactions;

        // Box Plot Stats
        if (m.records.length >= 1) {
            const sortedValues = m.records.map(r => r.value).sort(d3.ascending);
            const q1 = d3.quantile(sortedValues, 0.25) ?? 0;
            const median = d3.quantile(sortedValues, 0.5) ?? 0;
            const q3 = d3.quantile(sortedValues, 0.75) ?? 0;
            const iqr = q3 - q1;
            const lowerFence = q1 - 1.5 * iqr;
            const upperFence = q3 + 1.5 * iqr;

            const outliers: Outlier[] = m.records
                .filter(r => r.value < lowerFence || r.value > upperFence)
                .map(r => ({
                    metricValue: r.value,
                    price: r.resale_price,
                    type: r.flat_type,
                    town: r.town,
                    lease: r.remaining_lease,
                    area: r.floor_area_sqft,
                }));
                
            const nonOutlierValues = m.records.filter(r => r.value >= lowerFence && r.value <= upperFence).map(r => r.value);
            const min = d3.min(nonOutlierValues) ?? q1;
            const max = d3.max(nonOutlierValues) ?? q3;

            const sortedAllValues = m.records.map(r => r.value).sort(d3.ascending);
            const absoluteMin = sortedAllValues[0] ?? q1;
            const absoluteMax = sortedAllValues[sortedAllValues.length - 1] ?? q3;

            const monthMax = absoluteMax;
            if (monthMax > maxBoxPlotValue) maxBoxPlotValue = monthMax;

            processedData.push({ month, min, q1, median, q3, max, absoluteMin, absoluteMax, outliers });
        }

        // Line Chart Point
        if (m.totalTransactions > 0) {
            const grossValue = d3.sum(m.prices);
            const millionCount = m.prices.filter(p => p >= 1000000).length;
            const millionPct = (millionCount / m.totalTransactions) * 100;
            
            m.psfValues.sort(d3.ascending);
            m.pricePerLeaseValues.sort(d3.ascending);
            
            const medianPsf = d3.quantile(m.psfValues, 0.5) ?? 0;
            const medianPPL = d3.quantile(m.pricePerLeaseValues, 0.5) ?? 0;

            lineChartData.push({
                month,
                transactionCount: m.totalTransactions,
                grossTransactionValue: grossValue,
                median_psf: medianPsf,
                median_price_per_lease: medianPPL,
                millionDollarTransactionPercentage: millionPct
            });

            // Update domains
            if (m.totalTransactions > maxTransactionCount) maxTransactionCount = m.totalTransactions;
            if (grossValue > maxGrossValue) maxGrossValue = grossValue;
            if (medianPsf > maxMedianPsf) maxMedianPsf = medianPsf;
            if (medianPPL > maxMedianPPL) maxMedianPPL = medianPPL;
            if (millionPct > maxMillionDollarPct) maxMillionDollarPct = millionPct;
        } else {
            lineChartData.push({ month, transactionCount: undefined, grossTransactionValue: undefined });
        }

        // Stacked Bar Point
        stackedBarChartData.push({
            month,
            ...m.priceCounts,
            totalTransactions: m.totalTransactions
        });
    }

    return {
        processedData,
        summaryStats: summary,
        lineChartData,
        stackedBarChartData,
        transactionCountYDomain: [0, maxTransactionCount * 1.2],
        grossTransactionValueYDomain: [0, maxGrossValue * 1.05],
        medianPsfYDomain: [0, maxMedianPsf * 1.05],
        medianPricePerLeaseYDomain: [0, maxMedianPPL * 1.05],
        millionDollarPercentageYDomain: [0, maxMillionDollarPct * 1.05],
        stackedBarChartYDomain: [0, maxStackedBarTotal * 1.1],
        yDomain: [0, maxBoxPlotValue * 1.05]
    };
};