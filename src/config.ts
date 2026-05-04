import { join } from 'path';
import { homedir } from 'os';

export const DERRICK_BASE_URL =
  process.env.DERRICK_API_URL ||
  `${process.env.BASE_URL || 'https://app1.derrick-app.com'}/api/v1`;

export const ENV_DIR = join(homedir(), '.derrick-mcp');
export const ENV_FILE = join(ENV_DIR, '.env');

export const HTTP_TIMEOUT = 300_000;

// Strict pattern for identifiers used in tool names. Tools whose slug or
// param names don't match are skipped during dynamic registration.
export const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;
