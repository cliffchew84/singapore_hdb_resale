import { HdbResaleRecord } from '../types.ts';

export const fetchHistoricalData = async (year: string): Promise<HdbResaleRecord[]> => {
  try {
    const response = await fetch(`/api/getHistoricalData?year=${encodeURIComponent(year)}`);

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        message = errorData.error || message;
      } catch {
        // non-JSON response body — keep the HTTP status message
      }
      throw new Error(message);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching historical data:', error);
    throw error;
  }
};
