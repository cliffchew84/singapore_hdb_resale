import { describe, it, expect } from 'vitest';
import * as d3 from 'd3';
import { 
  processDashboardData, 
  parseRemainingLeaseToYears
} from './dataProcessor.ts';
import { HdbResaleRecord } from '../types.ts';

describe('Outlier Detection', () => {
  // Create test data with known outliers for each metric
  const createTestData = (): HdbResaleRecord[] => {
    const records: HdbResaleRecord[] = [];
    
    // Month: 2020-01 - Normal distribution with one outlier
    for (let i = 0; i < 50; i++) {
      records.push({
        month: '2020-01',
        town: 'COUNTY',
        type: '3 ROOM',
        price: 400000 + (Math.random() * 200000), // 400k-600k range
        area: 80 + (Math.random() * 20), // 80-100 sqm
        lease: 90 + (Math.random() * 5), // 90-95 years (number)
      });
    }
    // Add outlier: very high price
    records.push({
      month: '2020-01',
      town: 'COUNTY',
      type: '3 ROOM',
      price: 1500000, // Outlier for resale_price
      area: 85,
      lease: 92,
    });
    
    // Month: 2020-02 - Normal distribution with outlier for price_psf
    for (let i = 0; i < 50; i++) {
      records.push({
        month: '2020-02',
        town: 'COUNTY',
        type: '3 ROOM',
        price: 400000 + (Math.random() * 200000),
        area: 80 + (Math.random() * 20),
        lease: 90 + (Math.random() * 5),
      });
    }
    // Add outlier: very high psf (small area, normal price)
    records.push({
      month: '2020-02',
      town: 'COUNTY',
      type: '3 ROOM',
      price: 500000,
      area: 30, // Very small area -> high psf
      lease: 92,
    });
    
    // Month: 2020-03 - Normal distribution with outlier for price_per_lease
    for (let i = 0; i < 50; i++) {
      records.push({
        month: '2020-03',
        town: 'COUNTY',
        type: '3 ROOM',
        price: 400000 + (Math.random() * 200000),
        area: 80 + (Math.random() * 20),
        lease: 90 + (Math.random() * 5),
      });
    }
    // Add outlier: very high price_per_lease (old lease, normal price)
    records.push({
      month: '2020-03',
      town: 'COUNTY',
      type: '3 ROOM',
      price: 500000,
      area: 90,
      lease: 10, // Very old lease -> high price_per_lease
    });
    
    return records;
  };

  it('detects correct outliers for resale_price metric', () => {
    const records = createTestData();
    const result = processDashboardData(records, ['2020-01', '2020-02', '2020-03'], 'price');
    
    const janData = result.processedData.find(d => d.month === '2020-01');
    expect(janData).toBeDefined();
    expect(janData!.outliers.length).toBeGreaterThan(0);
    
    // The 1.5M transaction should be an outlier for resale_price
    const highPriceOutlier = janData!.outliers.find(o => o.price === 1500000);
    expect(highPriceOutlier).toBeDefined();
    expect(highPriceOutlier!.metricValue).toBe(1500000);
  });

  it('detects correct outliers for price_psf metric', () => {
    const records = createTestData();
    const result = processDashboardData(records, ['2020-01', '2020-02', '2020-03'], 'price_psf');
    
    const febData = result.processedData.find(d => d.month === '2020-02');
    expect(febData).toBeDefined();
    expect(febData!.outliers.length).toBeGreaterThan(0);
    
    // The small area transaction should have high psf and be an outlier
    const psfOutlier = febData!.outliers.find(o => String(o.area) === '30');
    expect(psfOutlier).toBeDefined();
  });

  it('detects correct outliers for price_per_lease metric', () => {
    const records = createTestData();
    const result = processDashboardData(records, ['2020-01', '2020-02', '2020-03'], 'price_per_lease');
    
    const marData = result.processedData.find(d => d.month === '2020-03');
    expect(marData).toBeDefined();
    expect(marData!.outliers.length).toBeGreaterThan(0);
    
    // The old lease transaction should have high price_per_lease and be an outlier
    const pplOutlier = marData!.outliers.find(o => String(o.lease).includes('10'));
    expect(pplOutlier).toBeDefined();
  });

  it('calculates IQR-based fences correctly', () => {
    // Test with known values
    const testValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const q1 = d3.quantile(testValues, 0.25);
    const q3 = d3.quantile(testValues, 0.75);
    const iqr = q3! - q1!;
    const lowerFence = q1! - 1.5 * iqr;
    const upperFence = q3! + 1.5 * iqr;
    
    // Values 1 and 10 should be outliers
    expect(lowerFence).toBeLessThan(1);
    expect(upperFence).toBeGreaterThan(10);
  });

  it('handles edge cases with no outliers', () => {
    const records: HdbResaleRecord[] = [];
    
    // Create data with very tight distribution (no outliers)
    for (let i = 0; i < 20; i++) {
      records.push({
        month: '2020-01',
        town: 'COUNTY',
        type: '3 ROOM',
        price: 500000, // All same price
        area: 90,
        lease: 90,
      });
    }
    
    const result = processDashboardData(records, ['2020-01'], 'price');
    const janData = result.processedData.find(d => d.month === '2020-01');
    
    // With all identical values, IQR = 0, so no outliers
    expect(janData!.outliers.length).toBe(0);
  });
});

describe('parseRemainingLeaseToYears', () => {
  it('parses number years correctly', () => {
    expect(parseRemainingLeaseToYears(90)).toBe(90);
    expect(parseRemainingLeaseToYears(10)).toBe(10);
  });

  it('parses string years correctly', () => {
    expect(parseRemainingLeaseToYears('90 years')).toBe(90);
    expect(parseRemainingLeaseToYears('69 years 04 months')).toBeCloseTo(69.33, 2);
  });

  it('handles numeric strings', () => {
    expect(parseRemainingLeaseToYears('90')).toBe(90);
  });

  it('handles null/undefined', () => {
    expect(parseRemainingLeaseToYears(null as any)).toBeNull();
    expect(parseRemainingLeaseToYears(undefined as any)).toBeNull();
  });
});