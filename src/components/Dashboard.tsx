import React from 'react';
import { BoxPlotStats, SummaryStatsData, LineChartDataPoint, BoxPlotMetric, StackedBarChartDataPoint, LineChartMetric, StackedBarChartMode } from '../types.ts';
import Spinner from './Spinner.tsx';
import CollapsibleSection from './CollapsibleSection.tsx';
import SummaryStats from './SummaryStats.tsx';
import BoxPlot from './BoxPlot.tsx';
import LineChart from './LineChart.tsx';
import StackedBarChart from './StackedBarChart.tsx';

export interface SectionStates {
  summary: boolean;
  distribution: boolean;
  trends: boolean;
  categories: boolean;
}

interface DashboardProps {
  loading: boolean;
  error: string | null;
  loadingMessage: string;
  processedData: BoxPlotStats[];
  lineChartData: LineChartDataPoint[];
  stackedBarChartData: StackedBarChartDataPoint[];
  summaryStats: SummaryStatsData;
  chartXDomain: string[];
  yDomain: [number, number];
  transactionCountYDomain: [number, number];
  grossTransactionValueYDomain: [number, number];
  medianPsfYDomain: [number, number];
  medianPricePerLeaseYDomain: [number, number];
  millionDollarPercentageYDomain: [number, number];
  stackedBarChartYDomain: [number, number];
  boxPlotMetric: BoxPlotMetric;
  setBoxPlotMetric: (metric: BoxPlotMetric) => void;
  lineChartMetric: LineChartMetric;
  setLineChartMetric: (metric: LineChartMetric) => void;
  stackedBarChartMode: StackedBarChartMode;
  setStackedBarChartMode: (mode: StackedBarChartMode) => void;
  sectionStates?: SectionStates;
  onSectionToggle?: (section: keyof SectionStates, isOpen: boolean) => void;
}

const boxPlotTitles: Record<BoxPlotMetric, string> = {
  price: 'Monthly Resale Price Distribution',
  price_psf: 'Monthly Price p.s.f. Distribution',
  price_per_lease: 'Monthly Price / Lease Left (Yr) Distribution',
};

const MetricButton: React.FC<{
  onClick: () => void;
  isActive: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ onClick, isActive, children, className }) => (
  <button
    onClick={onClick}
    className={`px-3 py-2 text-sm font-semibold rounded-md transition-colors text-center ${
      isActive
        ? 'bg-indigo-600 text-white shadow'
        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
    } ${className || ''}`}
  >
    {children}
  </button>
);

const Dashboard: React.FC<DashboardProps> = ({
  loading,
  error,
  loadingMessage,
  processedData,
  lineChartData,
  stackedBarChartData,
  summaryStats,
  chartXDomain,
  yDomain,
  transactionCountYDomain,
  grossTransactionValueYDomain,
  medianPsfYDomain,
  medianPricePerLeaseYDomain,
  millionDollarPercentageYDomain,
  stackedBarChartYDomain,
  boxPlotMetric,
  setBoxPlotMetric,
  lineChartMetric,
  setLineChartMetric,
  stackedBarChartMode,
  setStackedBarChartMode,
  sectionStates,
  onSectionToggle,
}) => {
  const hasData = processedData.length > 0;

  const boxPlotActions = (
    <div className="p-1 bg-slate-100 rounded-lg flex items-stretch space-x-1">
      <MetricButton onClick={() => setBoxPlotMetric('price')} isActive={boxPlotMetric === 'price'} className="flex-1">
        Resale Price
      </MetricButton>
      <MetricButton onClick={() => setBoxPlotMetric('price_psf')} isActive={boxPlotMetric === 'price_psf'} className="flex-1">
        Price p.s.f.
      </MetricButton>
      <MetricButton onClick={() => setBoxPlotMetric('price_per_lease')} isActive={boxPlotMetric === 'price_per_lease'} className="flex-1">
        Price / Lease Left (Yr)
      </MetricButton>
    </div>
  );

  const lineChartActions = (
    <div className="p-1 bg-slate-100 rounded-lg flex flex-wrap items-stretch gap-1">
      <MetricButton onClick={() => setLineChartMetric('grossTransactionValue')} isActive={lineChartMetric === 'grossTransactionValue'} className="flex-1">
        Gross Txn. Value
      </MetricButton>
      <MetricButton onClick={() => setLineChartMetric('median_psf')} isActive={lineChartMetric === 'median_psf'} className="flex-1">
        Median Price p.s.f.
      </MetricButton>
      <MetricButton onClick={() => setLineChartMetric('median_price_per_lease')} isActive={lineChartMetric === 'median_price_per_lease'} className="flex-1">
        Median Price / Lease (Yr)
      </MetricButton>
      <MetricButton onClick={() => setLineChartMetric('millionDollarTransactionPercentage')} isActive={lineChartMetric === 'millionDollarTransactionPercentage'} className="flex-1">
        % of &gt; $1M Flats
      </MetricButton>
    </div>
  );
  
  const stackedBarChartActions = (
    <div className="p-1 bg-slate-100 rounded-lg flex items-stretch space-x-1">
      <MetricButton onClick={() => setStackedBarChartMode('percentage')} isActive={stackedBarChartMode === 'percentage'} className="flex-1">
        % of Sales
      </MetricButton>
      <MetricButton onClick={() => setStackedBarChartMode('count')} isActive={stackedBarChartMode === 'count'} className="flex-1">
        # of Sales
      </MetricButton>
    </div>
  );

  const lineChartY2Domain = React.useMemo(() => {
    if (lineChartMetric === 'median_psf') return medianPsfYDomain;
    if (lineChartMetric === 'median_price_per_lease') return medianPricePerLeaseYDomain;
    if (lineChartMetric === 'millionDollarTransactionPercentage') return millionDollarPercentageYDomain;
    return grossTransactionValueYDomain;
  }, [lineChartMetric, grossTransactionValueYDomain, medianPsfYDomain, medianPricePerLeaseYDomain, millionDollarPercentageYDomain]);
  
  const stackedBarChartTitle = stackedBarChartMode === 'percentage'
    ? '% of Sales by Price Category'
    : '# of Sales by Price Category';
    
  const stackedBarChartDescription = stackedBarChartMode === 'percentage'
    ? "This chart shows the monthly percentage breakdown of HDB resale transactions across different price brackets, with each bar summing to 100%."
    : "This chart shows the absolute number of monthly HDB resale transactions, stacked by price category.";

  if (error && !hasData) {
    return (
      <div className="flex flex-col justify-center items-center h-[600px] bg-red-50 text-red-700 p-8 rounded-2xl border border-red-200">
        <div className="bg-red-100 p-4 rounded-full mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold mb-2">Data Fetching Failed</h3>
        <p className="text-center max-w-md">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-6 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
        >
          Retry Loading
        </button>
      </div>
    );
  }

  if (loading && !hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px]">
        <Spinner />
        <span className="mt-4 text-slate-500 font-medium">{loadingMessage || 'Loading...'}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-amber-800">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-bold text-sm">Partial Data Loaded</p>
            <p className="text-sm opacity-90">{error}</p>
          </div>
        </div>
      )}

      {loading && hasData && (
        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex items-center gap-3 text-indigo-800 animate-pulse">
          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium">{loadingMessage}</p>
        </div>
      )}

      <CollapsibleSection 
        title="Transaction Summary"
        isOpen={sectionStates?.summary}
        onToggle={(isOpen) => onSectionToggle?.('summary', isOpen)}
      >
        <SummaryStats stats={summaryStats} />
      </CollapsibleSection>
      
      <CollapsibleSection 
        title={boxPlotTitles[boxPlotMetric]} 
        actions={boxPlotActions}
        description="This box plot visualizes the distribution of resale prices for each month. Each box represents the interquartile range (IQR), with the line indicating the median. Whiskers extend to the main data range, and individual points represent outliers."
        isOpen={sectionStates?.distribution}
        onToggle={(isOpen) => onSectionToggle?.('distribution', isOpen)}
      >
        <div className="w-full h-[500px] p-4 box-border">
          <BoxPlot data={processedData} xDomain={chartXDomain} yDomain={yDomain} boxPlotMetric={boxPlotMetric} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection 
        title="Market Trends"
        actions={lineChartActions}
        description="This chart tracks two key market indicators over time: the total number of monthly transactions (blue bars) and a selectable secondary metric (line)."
        isOpen={sectionStates?.trends}
        onToggle={(isOpen) => onSectionToggle?.('trends', isOpen)}
      >
        <div className="w-full h-[500px] p-4 box-border">
          <LineChart 
            data={lineChartData}
            xDomain={chartXDomain}
            y1Domain={transactionCountYDomain}
            y2Domain={lineChartY2Domain}
            lineChartMetric={lineChartMetric}
          />
        </div>
      </CollapsibleSection>
      
      <CollapsibleSection 
        title={stackedBarChartTitle}
        description={stackedBarChartDescription}
        actions={stackedBarChartActions}
        isOpen={sectionStates?.categories}
        onToggle={(isOpen) => onSectionToggle?.('categories', isOpen)}
      >
        <div className="w-full h-[500px] p-4 box-border">
          <StackedBarChart
            data={stackedBarChartData}
            xDomain={chartXDomain}
            mode={stackedBarChartMode}
            yDomain={stackedBarChartYDomain}
          />
        </div>
      </CollapsibleSection>
    </div>
  );
};

export default Dashboard;