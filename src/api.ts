import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { DERRICK_BASE_URL, ENV_DIR, ENV_FILE, HTTP_TIMEOUT } from './config.js';

// -- API key management ------------------------------------------------------

let cachedApiKey: string | null = null;

export function loadApiKey(): string {
  if (cachedApiKey !== null) return cachedApiKey;

  if (existsSync(ENV_FILE)) {
    const content = readFileSync(ENV_FILE, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...rest] = trimmed.split('=');
        if (key.trim() === 'DERRICK_API_KEY') {
          cachedApiKey = rest.join('=').trim();
          return cachedApiKey;
        }
      }
    }
  }

  cachedApiKey = process.env.DERRICK_API_KEY ?? '';
  return cachedApiKey;
}

export function saveApiKey(key: string): void {
  mkdirSync(ENV_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(ENV_FILE, `DERRICK_API_KEY=${key}\n`, { mode: 0o600 });
  cachedApiKey = key;
}

/**
 * Resolves the API key for a tool call.
 * Priority: OAuth token (remote/HTTP mode) > locally stored key (stdio mode).
 */
export function resolveApiKey(extra?: {
  authInfo?: { extra?: Record<string, unknown> };
}): string {
  const oauthKey = extra?.authInfo?.extra?.apiKey;
  if (typeof oauthKey === 'string' && oauthKey) return oauthKey;
  return loadApiKey();
}

// -- HTTP helper -------------------------------------------------------------

export interface ApiResponse {
  status: number;
  body: Record<string, any>;
}

export async function callApi(
  method: 'GET' | 'POST',
  endpoint: string,
  options: {
    jsonBody?: Record<string, any>;
    needsAuth?: boolean;
    apiKeyOverride?: string;
  } = {},
): Promise<ApiResponse> {
  const { jsonBody, needsAuth = true, apiKeyOverride } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (needsAuth) {
    const apiKey = apiKeyOverride ?? loadApiKey();
    if (!apiKey) {
      return {
        status: 401,
        body: { success: false, error: 'No API key configured.' },
      };
    }
    headers['X-API-Key'] = apiKey;
  }

  const url = `${DERRICK_BASE_URL}/${endpoint.replace(/^\//, '')}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify(jsonBody) : undefined,
      signal: controller.signal,
    });

    let body: Record<string, any>;
    try {
      body = (await res.json()) as Record<string, any>;
    } catch {
      const text = await res.text();
      body = {
        success: false,
        error: `Non-JSON response: ${text.slice(0, 300)}`,
      };
    }

    return { status: res.status, body };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        status: 0,
        body: {
          success: false,
          error: `Request timed out after ${HTTP_TIMEOUT / 1000}s.`,
        },
      };
    }
    return {
      status: 0,
      body: { success: false, error: `Network error: ${err.message}` },
    };
  } finally {
    clearTimeout(timeout);
  }
}
