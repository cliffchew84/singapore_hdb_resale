import { HdbResaleRecord } from '../types.ts';

/**
 * Fetches HDB resale data for a specific month.
 * @param month The month to fetch data for (format: YYYY-MM)
 * @returns A promise that resolves to an array of fetched records.
 */
export const fetchHdbDataByMonth = async (month: string): Promise<HdbResaleRecord[]> => {
    const response = await fetch(`/api/getHdbData?month=${month}`);
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ 
            error: 'Unknown Error', 
            message: `Server responded with status: ${response.status}` 
        }));
        
        // Throw a structured error that includes the API message
        const error = new Error(errorData.message || errorData.error);
        (error as any).details = errorData.details;
        (error as any).type = errorData.error;
        throw error;
    }
    
    const data: HdbResaleRecord[] = await response.json();
    return data;
};