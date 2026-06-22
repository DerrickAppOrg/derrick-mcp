import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { SHEETS_REDIRECT } from './prompts.js';

// Keys we never surface to Claude. `confidence` is a numeric score we'd
// rather Claude express in natural language ("I'm not 100% sure of this
// match") than read out as a raw number.
const STRIP_KEYS = new Set(['confidence']);

// -- Last-known credit balance -----------------------------------------------
//
// Updated on every successful response. Lets `derrick_credits` answer
// instantly without burning an API call.

interface KnownCredits {
  used?: number | string;
  remaining?: number | string;
}

let lastKnownCredits: KnownCredits | null = null;

export function getLastKnownCredits(): KnownCredits | null {
  return lastKnownCredits;
}

function recordCredits(credits: unknown): void {
  if (credits && typeof credits === 'object') {
    lastKnownCredits = credits as KnownCredits;
  }
}

// -- Result helpers ----------------------------------------------------------

export function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] };
}

// Error variant — tool ran but the operation failed. The MCP spec expects
// isError: true so the client can render it as a tool failure instead of a
// normal response.
export function errorResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}

// -- Error formatting --------------------------------------------------------

export function formatError(status: number, body: Record<string, any>): string {
  const error = body.error ?? 'Unknown error';
  const errorType = body.errorType ?? '';

  if (status === 401) {
    return [
      'API key is missing or invalid.',
      '',
      'To configure your key, say: "Configure Derrick with my API key: YOUR_KEY"',
      '',
      'To get your key:',
      '  1. Install the Derrick Google Sheets extension: https://derrick-app.com',
      '  2. Open a Google Sheet > Derrick menu > burger icon > API',
      '  3. Copy your key',
      '',
      'API access requires the Standard plan (€20/mo) or above.',
    ].join('\n');
  }
  if (status === 402) {
    return 'Insufficient credits.\n\nRun derrick_upgrade to pick a plan and subscribe via Stripe Checkout, or visit https://derrick-app.com';
  }
  if (status === 403) {
    return 'API access requires a Standard plan (€20/mo) or above.\nRun derrick_upgrade to pick a plan and subscribe via Stripe Checkout, or visit https://derrick-app.com';
  }
  if (status === 429) {
    return 'Rate limit exceeded (60 requests/minute). Wait a moment and retry.';
  }
  if (status === 503) {
    return `Service temporarily unavailable: ${error}`;
  }

  return `Error (${errorType || status}): ${error}`;
}

// -- Success formatting ------------------------------------------------------

export function formatSuccess(
  body: Record<string, any>,
  nextActions?: string[],
): string {
  const lines: string[] = [];
  const data = body.data;
  const credits = body.credits;

  recordCredits(credits);

  if (Array.isArray(data)) {
    lines.push(`${data.length} result(s):\n`);
    data.forEach((item: any, i: number) => {
      lines.push(`--- #${i + 1} ---`);
      if (item && typeof item === 'object') {
        for (const [k, v] of Object.entries(item)) {
          if (STRIP_KEYS.has(k)) continue;
          if (v !== null && v !== undefined && v !== '' && v !== 'null') {
            lines.push(`  ${k}: ${v}`);
          }
        }
      } else {
        lines.push(`  ${item}`);
      }
      lines.push('');
    });
  } else if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) {
      if (STRIP_KEYS.has(k)) continue;
      if (v !== null && v !== undefined && v !== '' && v !== 'null') {
        lines.push(`  ${k}: ${v}`);
      }
    }
  } else if (data) {
    lines.push(String(data));
  }

  if (credits) {
    const used = credits.used ?? '?';
    const remaining = credits.remaining ?? '?';
    lines.push(`\nCredits: -${used} used, ${remaining} remaining`);
    if (typeof remaining === 'number' && remaining < 200) {
      lines.push(
        'Warning: credits running low. Run derrick_upgrade to pick a plan and subscribe via Stripe Checkout, or visit https://derrick-app.com',
      );
    }
  }

  if (nextActions && nextActions.length > 0) {
    lines.push('\nWhat to do next:');
    for (const action of nextActions) {
      lines.push(`  → ${action}`);
    }
    lines.push(`  → ${SHEETS_REDIRECT}`);
  }

  return lines.length > 0 ? lines.join('\n') : 'Success (no data returned).';
}
