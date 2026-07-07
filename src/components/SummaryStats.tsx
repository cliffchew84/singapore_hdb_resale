import React, { useState, useLayoutEffect, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SummaryStatsData } from '../types.ts';
import { formatCompactCurrency, formatCurrency, formatNumber, formatPercentage } from '../utils/formatters.ts';

// --- New Portal-based Tooltip Component ---
interface TooltipProps {
  children: ReactNode;
  targetRef: React.RefObject<HTMLElement>;
}

const Tooltip: React.FC<TooltipProps> = ({ children, targetRef }) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  // Start with an off-screen position to avoid flicker on first render
  const [position, setPosition] = useState({ top: -9999, left: -9999 });

  useLayoutEffect(() => {
    if (targetRef.current && tooltipRef.current) {
      const targetRect = targetRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      
      let left = targetRect.left + window.scrollX + (targetRect.width / 2) - (tooltipRect.width / 2);

      // Adjust if it goes off-screen right
      if (left + tooltipRect.width > window.innerWidth - 8) {
        left = window.innerWidth - tooltipRect.width - 8;
      }
      
      // Adjust if it goes off-screen left
      if (left < 8) {
        left = 8;
      }
      
      const gap = 8;
      // Default to showing ABOVE the target
      let top = targetRect.top + window.scrollY - tooltipRect.height - gap;

      // Flip to show BELOW if not enough space at the top of the viewport
      if (top < window.scrollY) {
          top = targetRect.bottom + window.scrollY + gap;
      }

      setPosition({ top, left });
    }
  }, [targetRef, children]); // Rerun if children change, as tooltip size might change

  return createPortal(
    <div
      ref={tooltipRef}
      className="absolute p-3 glass-tooltip text-slate-700 text-[18px] font-medium leading-tight z-50"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        maxWidth: '400px',
      }}
    >
      {children}
    </div>,
    document.body
  );
};


// --- Original Components (Modified to use new Tooltip) ---
const InfoIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const StatCard: React.FC<{ label: string; value: string; tooltip?: string; icon?: ReactNode }> = ({ label, value, tooltip, icon }) => {
    const [isTooltipVisible, setIsTooltipVisible] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    return (
        <div 
            ref={cardRef}
            className="bg-slate-50 border border-slate-100 p-5 rounded-xl transition-all hover:border-indigo-200 hover:shadow-md hover:bg-white cursor-help"
            onMouseEnter={() => tooltip && setIsTooltipVisible(true)}
            onMouseLeave={() => setIsTooltipVisible(false)}
        >
          <dt 
            className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate flex items-center justify-between"
          >
            <div className="flex items-center gap-1.5">
              <span>{label}</span>
              {tooltip && (
                  <InfoIcon />
              )}
            </div>
            {icon && <div className="text-slate-300">{icon}</div>}
          </dt>
          <dd className="mt-2 text-2xl font-bold text-slate-900 font-mono tracking-tight">{value}</dd>

          {isTooltipVisible && tooltip && cardRef.current && (
            <Tooltip targetRef={cardRef}>
                {tooltip}
            </Tooltip>
          )}
        </div>
    );
};

interface SummaryStatsProps {
  stats: SummaryStatsData;
}

const SummaryStats: React.FC<SummaryStatsProps> = React.memo(({ stats }) => {
  return (
    <div className="flex flex-col gap-6">
      {/* Row 1: Market Overview */}
      <div>
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Market Overview</h4>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total Transactions" value={formatNumber(stats.count)} />
          <StatCard 
            label="Gross Value" 
            value={formatCompactCurrency(stats.grossTransactionValue)}
            tooltip="Sum of all resale transaction prices, representing the total sales value."
          />
          <StatCard 
            label="Million-Dollar Flats" 
            value={formatPercentage(stats.millionDollarTransactionPercentage)}
            tooltip="Percentage of resale transactions that were sold for S$1,000,000 or more."
          />
        </dl>
      </div>

      {/* Row 2: Resale Price Statistics */}
      <div>
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Price Benchmarks</h4>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Highest Price" value={formatCurrency(stats.max)} />
          <StatCard label="Median Price" value={formatCurrency(stats.median)} />
          <StatCard label="Lowest Price" value={formatCurrency(stats.min)} />
        </dl>
      </div>
      
      {/* Row 3: PSF & Efficiency */}
      <div>
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Value Efficiency</h4>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard 
            label="Median Price p.s.f." 
            value={formatCurrency(stats.median_psf)} 
            tooltip="Median of all resale transaction prices divided by their floor area in square feet (p.s.f.)."
          />
          <StatCard 
            label="Median Price / Lease" 
            value={formatCurrency(stats.median_price_per_lease)} 
            tooltip="Resale price divided by remaining lease in years. Intuitively, this represents the annual cost of 'owning' the lease over its remaining life, similar to an annual rent."
          />
          <StatCard label="Min Price p.s.f." value={formatCurrency(stats.min_psf)} />
        </dl>
      </div>
    </div>
  );
});

export default SummaryStats;
