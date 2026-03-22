import { HdbResaleRecord } from '../types.ts';

export const fetchHistoricalData = async (year: string): Promise<HdbResaleRecord[]> => {
  try {
    const response = await fetch(`/api/getHistoricalData?year=${year}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch historical data');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching historical data:', error);
    throw error;
  }
};
