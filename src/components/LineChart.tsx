import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { LineChartDataPoint, LineChartMetric } from '../types.ts';

interface LineChartProps {
  data: LineChartDataPoint[];
  xDomain: string[];
  y1Domain: [number, number]; // Transaction Count
  y2Domain: [number, number]; // Dynamic line metric
  lineChartMetric: LineChartMetric;
}

const LineChart: React.FC<LineChartProps> = React.memo(({ data, xDomain, y1Domain, y2Domain, lineChartMetric }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const chartElementsRef = useRef<{
    g?: d3.Selection<SVGGElement, unknown, null, undefined>;
    xAxis?: d3.Selection<SVGGElement, unknown, null, undefined>;
    y1Axis?: d3.Selection<SVGGElement, unknown, null, undefined>;
    y2Axis?: d3.Selection<SVGGElement, unknown, null, undefined>;
    grid?: d3.Selection<SVGGElement, unknown, null, undefined>;
    yearSeparators?: d3.Selection<SVGGElement, unknown, null, undefined>;
    linePath?: d3.Selection<SVGPathElement, unknown, null, undefined>;
    linePathHalo?: d3.Selection<SVGPathElement, unknown, null, undefined>;
    tooltipFocus?: d3.Selection<SVGGElement, unknown, null, undefined>;
  }>({});

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Effect to handle responsive resizing of the chart
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver(entries => {
        if (entries && entries.length > 0 && entries[0].contentRect.width > 0) {
            const { width, height } = entries[0].contentRect;
            setDimensions({ width, height });
        }
    });
    resizeObserver.observe(containerRef.current);
    return () => {
        if (containerRef.current) {
            // eslint-disable-next-line react-hooks/exhaustive-deps
            resizeObserver.unobserve(containerRef.current);
        }
    };
  }, []);

  const themeColors = useMemo(() => ({
    y1: "#000000", text: "#64748b", // black, slate-500
  }), []);
  
  // Effect for one-time setup
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !tooltipRef.current) return;
    
    const margin = { top: 50, right: 75, bottom: 50, left: 75 };
    const svg = d3.select(svgRef.current);

    const defs = svg.append('defs');
    const filter = defs.append('filter')
        .attr('id', 'line-glow')
        .attr('x', '-50%').attr('y', '-50%')
        .attr('width', '200%').attr('height', '200%');
    filter.append('feGaussianBlur').attr('in', 'SourceAlpha').attr('stdDeviation', 3.5).attr('result', 'blur');
    filter.append('feFlood').attr('class', 'glow-color').attr('flood-opacity', 0.8).attr('result', 'flood');
    filter.append('feComposite').attr('in', 'flood').attr('in2', 'blur').attr('operator', 'in').attr('result', 'color-blur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'color-blur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    const grid = g.append('g').attr('class', 'grid');
    const yearSeparators = g.append('g').attr('class', 'year-separators').attr('pointer-events', 'none');
    const xAxis = g.append('g').attr('class', 'x-axis');
    const y1Axis = g.append('g').attr('class', 'y1-axis');
    const y2Axis = g.append('g').attr('class', 'y2-axis');
    
    g.append('g').attr('class', 'bars-group');
    const linePathHalo = g.append('path').attr('class', 'line-path-halo').attr('fill', 'none').attr('stroke-width', 5);
    const linePath = g.append('path').attr('class', 'line-path').attr('fill', 'none').attr('stroke-width', 2.5);
    const legend = g.append('g').attr('class', 'legend');
    
    const tooltipFocus = g.append('g').style('display', 'none');
    tooltipFocus.append('line').attr('class', 'focus-line').attr('stroke-width', 1).attr('stroke-dasharray', '3,3');
    tooltipFocus.append('circle').attr('class', 'focus-circle-2').attr('r', 5);
    g.append('rect').attr('class', 'overlay').style('fill', 'none').style('pointer-events', 'all');

    chartElementsRef.current = { g, xAxis, y1Axis, y2Axis, grid, yearSeparators, linePath, linePathHalo, tooltipFocus };
  }, []);
  
  // Effect for updates
  useEffect(() => {
    if (!containerRef.current || !tooltipRef.current || data.length === 0 || !chartElementsRef.current.g || dimensions.width === 0) return;
    
    const { g, xAxis, y1Axis, y2Axis, grid, yearSeparators, linePath, linePathHalo, tooltipFocus } = chartElementsRef.current;
    
    const { width, height } = dimensions;
    const margin = { top: 50, right: 75, bottom: 50, left: 75 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.attr('width', width).attr('height', height);
    g.attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    const metricDetails = {
      grossTransactionValue: {
        label: 'Gross Transaction Value',
        color: "#ef4444", // red-500
        formatter: (d: d3.NumberValue) => d3.format(".2s")(d as number).replace(/G/, "B").replace(/M/, "M"),
        tooltipFormatter: (d?: number) => (d !== undefined ? d3.format("$,.2s")(d).replace(/G/, "B").replace(/M/, "M") : 'N/A'),
      },
      median_psf: {
        label: 'Median Price p.s.f.',
        color: "#ef4444", // red-500
        formatter: (d: d3.NumberValue) => d3.format("$,.0f")(d),
        tooltipFormatter: (d?: number) => (d !== undefined ? `${d3.format("$,.0f")(d)}/psf` : 'N/A'),
      },
      median_price_per_lease: {
        label: 'Median Price / Lease (Yr)',
        color: "#ef4444", // red-500
        formatter: (d: d3.NumberValue) => d3.format("$,.0f")(d),
        tooltipFormatter: (d?: number) => (d !== undefined ? `${d3.format("$,.0f")(d)}/yr` : 'N/A'),
      },
      millionDollarTransactionPercentage: {
        label: '% of > $1M Flats',
        color: "#ef4444", // red-500
        formatter: (d: d3.NumberValue) => `${d3.format(".1f")(d as number)}%`,
        tooltipFormatter: (d?: number) => (d !== undefined ? `${d.toFixed(2)}%` : 'N/A'),
      }
    };
    const currentMetricDetails = metricDetails[lineChartMetric];
    
    svg.select('.glow-color').attr('flood-color', currentMetricDetails.color);

    const valueAccessor = (d: LineChartDataPoint): number | undefined => {
      if (lineChartMetric === 'median_psf') return d.median_psf;
      if (lineChartMetric === 'median_price_per_lease') return d.median_price_per_lease;
      if (lineChartMetric === 'millionDollarTransactionPercentage') return d.millionDollarTransactionPercentage;
      return d.grossTransactionValue;
    };

    const x = d3.scaleBand().range([0, innerWidth]).domain(xDomain).padding(0.3);
    const y1 = d3.scaleLinear().domain(y1Domain).nice().range([innerHeight, 0]);
    const y2 = d3.scaleLinear().domain(y2Domain).nice().range([innerHeight, 0]);

    grid?.transition().duration(500).call(d3.axisLeft(y1).ticks(5).tickSize(-innerWidth).tickFormat(() => "")).call(s => s.select(".domain").remove()).selectAll("line").attr('stroke', 'currentColor').attr('stroke-opacity', 0.05).attr('stroke-dasharray', '0');

    const yearStartMonths = xDomain.filter(m => typeof m === 'string' && m.endsWith('-01')).slice(1);
    yearSeparators?.selectAll('line').data(yearStartMonths, (d:any) => d)
        .join('line').transition().duration(500)
        .attr('y1', 0).attr('y2', innerHeight)
        .attr('stroke', themeColors.text).attr('stroke-opacity', 0.3)
        .attr('stroke-dasharray', '3,3')
        .attr('x1', d => (x(d) ?? 0) - (x.paddingOuter() * x.step()))
        .attr('x2', d => (x(d) ?? 0) - (x.paddingOuter() * x.step()));

    const numMonths = xDomain.length;
    // If > 24 months, only show January ticks. Otherwise, show Jan and Jul.
    const tickValues = xDomain.filter(d => {
        if (typeof d !== 'string') return false;
        if (numMonths > 24) return d.endsWith('-01');
        return d.endsWith('-01') || d.endsWith('-07');
    });
    
    const xAxisGenerator = d3.axisBottom(x).tickValues(tickValues).tickFormat((d: string) => {
        const date = new Date(`${d}-01T12:00:00Z`);
        if (date.getMonth() === 0 || numMonths > 12) return d3.timeFormat('%b \'%y')(date);
        return d3.timeFormat('%b')(date);
    }).tickSizeOuter(0);

    xAxis?.attr('transform', `translate(0, ${innerHeight})`).transition().duration(500).call(xAxisGenerator)
      .call(s => s.select(".domain").remove())
      .call(g => g.selectAll(".tick text")
        .style("font-weight", "600")
        .style("font-size", "11px"));
    
    y1Axis?.transition().duration(500).call(d3.axisLeft(y1).ticks(5).tickFormat(d => d3.format(",.0f")(d))).call(s => s.select(".domain").remove())
      .selectAll('text').style('fill', themeColors.y1).style("font-family", "var(--font-mono)").style("font-size", "10px");
    y2Axis?.attr('transform', `translate(${innerWidth}, 0)`).transition().duration(500).call(d3.axisRight(y2).ticks(5).tickFormat(currentMetricDetails.formatter)).call(s => s.select(".domain").remove())
      .selectAll('text').style('fill', currentMetricDetails.color).style("font-family", "var(--font-mono)").style("font-size", "10px");

    g.select('.bars-group').selectAll('.bar')
      .data(data.filter(d => d.transactionCount !== undefined), (d:any) => d.month)
      .join(
        enter => enter.append('rect').attr('class', 'bar').attr('y', innerHeight).attr('height', 0),
        update => update,
        exit => exit.transition().duration(500).attr('y', innerHeight).attr('height', 0).remove()
      )
        .attr('x', d => x(d.month)!)
        .attr('width', x.bandwidth())
        .attr('fill', themeColors.y1)
        .attr('opacity', 0.6)
        .transition().duration(500)
        .attr('y', d => y1(d.transactionCount!))
        .attr('height', d => innerHeight - y1(d.transactionCount!));

    const lineGenerator = d3.line<LineChartDataPoint>()
      .x(d => (x(d.month) ?? 0) + x.bandwidth() / 2)
      .y(d => y2(valueAccessor(d)!))
      .defined(d => valueAccessor(d) !== undefined);

    linePathHalo?.datum(data)
      .attr('stroke', 'white')
      .transition().duration(500)
      .attr('d', lineGenerator);

    linePath?.datum(data)
      .style('filter', 'url(#line-glow)')
      .attr('stroke', currentMetricDetails.color)
      .transition().duration(500)
      .attr('d', lineGenerator);

    const legendData = [
        { label: 'Monthly Transactions', color: themeColors.y1, opacity: 0.6 },
        { label: currentMetricDetails.label, color: currentMetricDetails.color, opacity: 1 }
    ];
    const legendItems = g.select<SVGGElement>('.legend').selectAll('.legend-item').data(legendData);
    const joinedItems = legendItems.join(
      enter => {
        const item = enter.append('g').attr('class', 'legend-item');
        item.append('rect').attr('width', 12).attr('height', 12).attr('rx', 3);
        item.append('text').attr('x', 18).attr('y', 10).style('font-size', '12px').style('fill', 'currentColor');
        return item;
      }
    );
    joinedItems.select('rect')
      .attr('fill', d => d.color)
      .attr('opacity', d => d.opacity);
    joinedItems.select('text').text(d => d.label);
    
    let cumulativeWidth = 0;
    const legendPadding = 24;
    joinedItems.attr('transform', function() {
      const transform = `translate(${cumulativeWidth}, 0)`;
      const textNode = d3.select(this).select('text').node();
      if (textNode instanceof SVGGraphicsElement) {
          cumulativeWidth += textNode.getBBox().width + 18 + legendPadding;
      }
      return transform;
    });
    const totalLegendWidth = cumulativeWidth > 0 ? cumulativeWidth - legendPadding : 0;
    g.select<SVGGElement>('.legend').attr('transform', `translate(${(innerWidth - totalLegendWidth) / 2}, ${-margin.top + 15})`);


    const tooltip = d3.select(tooltipRef.current);
    tooltipFocus?.select('.focus-line').attr('y1', 0).attr('y2', innerHeight).attr('stroke', themeColors.text);
    tooltipFocus?.select('.focus-circle-2').style('fill', currentMetricDetails.color);

    const positionTooltip = (event: MouseEvent) => {
        const tooltipNode = tooltip.node() as HTMLElement;
        const containerNode = containerRef.current;
        if (!tooltipNode || !containerNode) return;
        const { width: tooltipWidth, height: tooltipHeight } = tooltipNode.getBoundingClientRect();
        const containerRect = containerNode.getBoundingClientRect();
        const offset = 15, margin = 10;
        let left = Math.max(margin, Math.min(event.clientX - containerRect.left - tooltipWidth / 2, containerRect.width - tooltipWidth - margin));
        let top = event.clientY - containerRect.top - tooltipHeight - offset;
        if (top < margin) top = event.clientY - containerRect.top + offset;
        tooltip.style('left', `${left}px`).style('top', `${top}px`);
    };

    g.select<SVGRectElement>('.overlay').attr('width', innerWidth).attr('height', innerHeight)
      .on('mouseover', () => { tooltipFocus?.style('display', null); tooltip.style('opacity', 1).style('display', 'block'); })
      .on('mouseout', () => { tooltipFocus?.style('display', 'none'); tooltip.style('opacity', 0).style('display', 'none'); })
      .on('mousemove', (event) => {
        const pointer = d3.pointer(event);
        const x0 = x.domain()[d3.leastIndex(x.domain(), d => Math.abs((x(d) ?? 0) + x.bandwidth()/2 - pointer[0]))!];
        const d = data.find(item => item.month === x0);
        if (!d || !tooltipFocus) return;

        const focusX = (x(d.month) ?? 0) + x.bandwidth() / 2;
        tooltipFocus.select('.focus-line').attr('transform', `translate(${focusX}, 0)`);
        
        const currentValue = valueAccessor(d);
        if (currentValue !== undefined) {
          tooltipFocus.select('.focus-circle-2').attr('transform', `translate(${focusX}, ${y2(currentValue)})`).style('display', null);
        } else {
          tooltipFocus.select('.focus-circle-2').style('display', 'none');
        }
        
        tooltip.html(`
          <div class="p-2 min-w-[180px]">
            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 pb-2 border-b border-slate-100">
              ${d3.timeFormat('%B %Y')(new Date(d.month))}
            </div>
            <div class="flex flex-col gap-2">
              <div class="flex justify-between items-center gap-4 whitespace-nowrap">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Transactions:</span>
                <span class="text-xs font-bold font-mono" style="color:${themeColors.y1}">${d3.format(",.0f")(d.transactionCount || 0)}</span>
              </div>
              <div class="flex justify-between items-center gap-4 whitespace-nowrap">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">${currentMetricDetails.label}:</span>
                <span class="text-xs font-bold font-mono" style="color:${currentMetricDetails.color}">${currentMetricDetails.tooltipFormatter(currentValue)}</span>
              </div>
            </div>
          </div>`
        );
        positionTooltip(event);
      });
  }, [data, xDomain, y1Domain, y2Domain, themeColors, lineChartMetric, dimensions]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg ref={svgRef} />
      <div
        ref={tooltipRef}
        className="absolute glass-tooltip pointer-events-none z-50"
        style={{ opacity: 0, display: 'none', transition: 'opacity 0.2s' }}
      />
    </div>
  );
});

export default LineChart;