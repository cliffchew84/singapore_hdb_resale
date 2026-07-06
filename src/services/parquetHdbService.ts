import * as duckdb from '@duckdb/duckdb-wasm';
import type { HdbResaleRecord, HdbFilter } from '../types';
import { FLAT_TYPE_MAP } from '../data/constants.ts';

// Use the environment variable for the parquet URL
const PARQUET_URL = import.meta.env.VITE_PARQUET_URL;

if (!PARQUET_URL) {
  console.error('VITE_PARQUET_URL is not defined in environment variables');
}

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;
let initPromise: Promise<{ db: duckdb.AsyncDuckDB, conn: duckdb.AsyncDuckDBConnection }> | null = null;

/** 
 * Initializes DuckDB-Wasm. 
 */
async function initDb() {
  if (db && conn) return { db, conn };
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log('🦆 Initializing DuckDB-Wasm...');
      const bundle = {
        mainModule: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/dist/duckdb-mvp.wasm',
        mainWorker: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/dist/duckdb-browser-mvp.worker.js',
        pthreadWorker: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/dist/duckdb-browser-mvp.worker.js',
      };

      console.log('📦 Loading Worker via Blob Proxy to bypass CORS...');
      const response = await fetch(bundle.mainWorker);
      const workerCode = await response.text();
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);

      const worker = new Worker(workerUrl);
      const logger = new duckdb.ConsoleLogger();
      db = new duckdb.AsyncDuckDB(logger, worker);
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      conn = await db.connect();
      
      console.log('✅ DuckDB-Wasm initialized successfully.');
      return { db: db!, conn: conn! };
    } catch (error) {
      console.error('❌ Failed to initialize DuckDB-Wasm:', error);
      initPromise = null; 
      throw error;
    }
  })();

  return initPromise;
}

function buildWhereClause(f: HdbFilter): string {
  const parts: string[] = [];

  if (f.startMonth) parts.push(`strftime(month, '%Y-%m') >= '${f.startMonth}'`);
  if (f.endMonth)   parts.push(`strftime(month, '%Y-%m') <= '${f.endMonth}'`);
  
  if (f.selectedTowns && f.selectedTowns.length > 0) {
    const towns = f.selectedTowns.map(t => `'${t}'`).join(',');
    parts.push(`town IN (${towns})`);
  }
  
  if (f.selectedFlatTypes && f.selectedFlatTypes.length > 0) {
    const types = f.selectedFlatTypes
      .map(t => FLAT_TYPE_MAP[t] || t)
      .map(t => `'${t.toUpperCase()}'`)
      .join(',');
    parts.push(`UPPER(type) IN (${types})`);
  }
  
  if (f.selectedLeaseRange && f.selectedLeaseRange[0] !== undefined) {
    parts.push(`lease >= ${f.selectedLeaseRange[0] * 12}`);
  }
  
  if (f.selectedLeaseRange && f.selectedLeaseRange[1] !== undefined) {
    parts.push(`lease <= ${f.selectedLeaseRange[1] * 12}`);
  }

  return parts.length ? `WHERE ${parts.join(' AND ')}` : '';
}

/**
 * Diagnostic function to fetch all unique flat types present in the dataset.
 * Use this to verify the correct mapping values.
 */
export async function getUniqueFlatTypes(): Promise<string[]> {
  const { conn } = await initDb();
  if (!conn) throw new Error('DuckDB connection could not be established');
  
  try {
    await conn.query(`CREATE OR REPLACE VIEW hdb_raw AS SELECT * FROM read_parquet('${PARQUET_URL}');`);
    const result = await conn.query(`SELECT DISTINCT type FROM hdb_raw ORDER BY type`);
    return result.toArray().map(row => (row as { type: string }).type);
  } catch (error) {
    console.error('Error fetching unique flat types:', error);
    return [];
  }
}

/**
 * Primary query function.
 */
export async function queryHdb(filter: HdbFilter): Promise<HdbResaleRecord[]> {
  const { conn } = await initDb();
  if (!conn) throw new Error('DuckDB connection could not be established');

  try {
    await conn.query(`CREATE OR REPLACE VIEW hdb_raw AS SELECT * FROM read_parquet('${PARQUET_URL}');`);

    const where = buildWhereClause(filter);
    
    const sql = `
      SELECT 
        strftime(month, '%Y-%m') as month, 
        * EXCLUDE (month)
      FROM (
        SELECT * FROM hdb_raw ${where}
      )
    `;
    
    const result = await conn.query(sql);
    return result.toArray().map(row => JSON.parse(JSON.stringify(row)) as HdbResaleRecord);
  } catch (error) {
    console.error('DuckDB Query Execution Error:', error);
    throw error;
  }
}
