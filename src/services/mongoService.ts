// src/services/mongoService.ts

export const fetchHistoricalData = async (collectionName: string, year?: string) => {
  try {
    let url = `/api/getHistoricalData?collection=${collectionName}`;
    if (year) {
      url += `&year=${year}`;
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch data');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching historical data:', error);
    throw error;
  }
};
