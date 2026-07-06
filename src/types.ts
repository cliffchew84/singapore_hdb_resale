// Raw record from the HDB Resale Parquet file
export interface HdbResaleRecord {
  month: string;
  town: string;
  type: string;
  price: number;
  area: number;
  lease: number;
  _id?: number;
}

// The metric being displayed on the Box Plot's Y-axis
export type BoxPlotMetric = 'price' | 'price_psf' | 'price_per_lease';

// An outlier data point with additional context for tooltips
export interface Outlier {
  metricValue: number; // This is the value of the metric being plotted
  price: number;
  type: string;
  town: string;
  lease: number;
  area: number;
}

// Calculated box plot statistics for a given month
export interface BoxPlotStats {
  month: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  outliers: Outlier[];
}

// Data for the summary statistics card
export interface SummaryStatsData {
  count: number;
  median?: number;
  min?: number;
  max?: number;
  median_psf?: number;
  min_psf?: number;
  max_psf?: number;
  grossTransactionValue?: number;
  median_price_per_lease?: number;
  min_price_per_lease?: number;
  max_price_per_lease?: number;
  millionDollarTransactionPercentage?: number;
}

// The metric being displayed as a line on the Market Trends chart
export type LineChartMetric = 'grossTransactionValue' | 'median_psf' | 'median_price_per_lease' | 'millionDollarTransactionPercentage';

// Data for a single point in the new market trends line chart
export interface LineChartDataPoint {
  month: string;
  transactionCount: number | undefined;
  grossTransactionValue: number | undefined;
  median_psf?: number;
  median_price_per_lease?: number;
  millionDollarTransactionPercentage?: number;
}

// --- Types for Stacked Bar Chart ---

// Define the specific price categories as a const array
export const PRICE_CATEGORIES = ['0-300k', '300-500k', '500-800k', '800k-1m', '>=1m'] as const;

// Create a type from the const array
export type PriceCategory = typeof PRICE_CATEGORIES[number];

// Data structure for a single month in the stacked bar chart
export interface StackedBarChartDataPoint {
  month: string;
  '0-300k': number;
  '300-500k': number;
  '500-800k': number;
  '800k-1m': number;
  '>=1m': number;
  totalTransactions: number;
}

// The mode for the Stacked Bar Chart (percentage or absolute count)
export type StackedBarChartMode = 'percentage' | 'count';

// Combined data structure for all dashboard charts and stats
export interface DashboardData {
  processedData: BoxPlotStats[];
  summaryStats: SummaryStatsData;
  lineChartData: LineChartDataPoint[];
  stackedBarChartData: StackedBarChartDataPoint[];
  transactionCountYDomain: [number, number];
  grossTransactionValueYDomain: [number, number];
  medianPsfYDomain: [number, number];
  medianPricePerLeaseYDomain: [number, number];
  millionDollarPercentageYDomain: [number, number];
  stackedBarChartYDomain: [number, number];
  yDomain: [number, number];
}
