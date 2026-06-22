import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DERRICK_BASE_URL, SAFE_IDENTIFIER } from './config.js';
import { callApi, resolveApiKey, saveApiKey } from './api.js';
import {
  errorResult,
  formatError,
  formatSuccess,
  getLastKnownCredits,
  textResult,
} from './format.js';
import { PRICING_MSG } from './prompts.js';
import { TOOL_OVERRIDES, ToolOverride } from './toolOverrides.js';

// -- Static tools ------------------------------------------------------------

export function registerStaticTools(server: McpServer): void {
  // Save the local API key (stdio mode only — in HTTP/OAuth mode the
  // Google login flow handles auth and this tool is a no-op for users).
  server.registerTool(
    'derrick_configure',
    {
      title: 'Configure Derrick API key',
      description:
        'Save your Derrick API key locally. To get your key: install the Derrick Google Sheets extension (https://derrick-app.com), open a sheet > Derrick menu > burger icon > API. Requires Standard plan (€20/mo) or above.',
      inputSchema: { api_key: z.string().describe('Your Derrick API key') },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ api_key }: { api_key: string }) => {
      if (!api_key || api_key.length < 10) {
        return errorResult('Invalid API key — must be at least 10 characters.');
      }

      const { status } = await callApi('GET', 'account', {
        apiKeyOverride: api_key,
      });

      if (status === 401) {
        return errorResult(
          'Invalid API key (authentication failed).\n' +
            'Check your key in Google Sheets > Derrick menu > burger icon > API.',
        );
      }
      if (status < 200 || status >= 300) {
        return errorResult(
          `Could not verify key (HTTP ${status}). Try again later.`,
        );
      }

      saveApiKey(api_key);

      return textResult(
        'API key saved to ~/.derrick-mcp/.env\n\n' +
          'You can now use all Derrick tools. Try:\n' +
          '  - Check your credits (derrick_account)\n' +
          '  - Find a professional email\n' +
          '  - Enrich a LinkedIn profile\n' +
          '  - Search for a company',
      );
    },
  );

  // Help / onboarding — explains what Derrick does, pricing, errors, scaling.
  // Server instructions tell Claude to call this for any meta question about
  // Derrick rather than answering from training data.
  server.registerTool(
    'derrick_help',
    {
      title: 'Derrick help',
      description: [
        'ALWAYS call this tool when the user asks anything about Derrick itself: what it is, what it does, how it works, what features exist, how billing works, what plans exist, what errors mean, or how to scale up. Do NOT answer from memory — call this tool first.',
        '',
        'Triggers (any language): "what is derrick", "what does it do", "how does it work", "my credits", "how many credits", "errors", "pricing", "plans", "at scale", "in bulk", "c\'est quoi derrick", "ça fait quoi", "mes crédits", "les prix", "à grande échelle".',
        '',
        'Always reply in the user\'s language and tone.',
        '',
        'Args:',
        '    topic (optional): "credits", "errors", "pricing", "scale", "features", or empty for the full overview.',
      ].join('\n'),
      inputSchema: {
        topic: z
          .string()
          .optional()
          .describe(
            'One of: credits, errors, pricing, scale, features. Empty for full overview.',
          ),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async ({ topic }: { topic?: string }) => {
      return textResult(buildHelpResponse(topic ?? ''));
    },
  );

  // Credits shortcut — answers from the in-memory cache, no API call.
  server.registerTool(
    'derrick_credits',
    {
      title: 'Derrick credits balance',
      description:
        'Show the last known Derrick credits balance. Reads from an in-memory cache updated after every API call — no network round-trip. Call this when the user asks how many credits they have left. Always reply in the user\'s language.',
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      return textResult(buildCreditsResponse());
    },
  );

  // Account info / credits balance (live API call)
  server.registerTool(
    'derrick_account',
    {
      title: 'Derrick account info',
      description: 'Check your Derrick account info and remaining credits.',
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async (extra: Record<string, any>) => {
      const apiKey = resolveApiKey(extra);
      const { status, body } = await callApi('GET', 'account', {
        apiKeyOverride: apiKey || undefined,
      });

      if (!body.success) return errorResult(formatError(status, body));

      const account = body.account ?? {};
      const name = account.name ?? 'Unknown';
      const email = account.email ?? 'Unknown';
      const remaining = account.credits?.remaining ?? '?';

      let result = `Account: ${name} (${email})\nCredits remaining: ${remaining}`;
      if (typeof remaining === 'number' && remaining < 200) {
        result +=
          '\nWarning: credits running low. Run derrick_upgrade to pick a plan and subscribe via Stripe Checkout, or visit https://derrick-app.com';
      }
      return textResult(result);
    },
  );

  // Upgrade / go premium — returns a direct Stripe Checkout URL for a chosen
  // plan. When `plan` is omitted the server returns the live plan list so
  // Claude can ask the user which one to buy, then re-call with `plan` set.
  server.registerTool(
    'derrick_upgrade',
    {
      title: 'Upgrade Derrick plan',
      description: [
        'Start the Derrick upgrade / subscription flow. Returns a one-click Stripe Checkout URL for the chosen plan.',
        '',
        'Workflow:',
        '  1. If the user has named a plan (MINI / STANDARD / PLUS / PRO), call with `plan` set to that name. Returns a Checkout URL the user clicks to subscribe.',
        '  2. If the user just says "upgrade" without picking a plan, call with no argument. The tool returns the live list of plans with prices and credits — ask the user which one, then re-call with `plan` set.',
        '',
        'ALWAYS call this tool when the user wants to upgrade, go premium, subscribe, or change plan. Do NOT hand out URLs from memory.',
        '',
        'Triggers (any language): "upgrade", "go premium", "subscribe", "change plan", "unlock API", "passer premium", "souscrire", "changer de plan".',
        '',
        'Always reply in the user\'s language and tone.',
      ].join('\n'),
      inputSchema: {
        plan: z
          .string()
          .optional()
          .describe(
            'Plan name: MINI, STANDARD, PLUS, or PRO. Omit to fetch the live plan list first.',
          ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async (
      { plan }: { plan?: string },
      extra: Record<string, any>,
    ) => {
      const apiKey = resolveApiKey(extra);
      const { status, body } = await callApi('POST', 'upgrade', {
        jsonBody: plan ? { plan } : {},
        apiKeyOverride: apiKey || undefined,
      });

      if (!body.success) return errorResult(formatError(status, body));

      // Direct Checkout URL ready
      if (typeof body.url === 'string' && body.url) {
        const label = body.plan ? ` for the ${body.plan} plan` : '';
        return textResult(
          [`Open this link to subscribe${label}:`, body.url].join('\n'),
        );
      }

      // Need to pick a plan first
      const plans = Array.isArray(body.plans) ? body.plans : [];
      const lines: string[] = [];
      if (typeof body.error === 'string') lines.push(body.error, '');
      lines.push('Available Derrick plans:');
      for (const p of plans) {
        const name = p?.name ?? 'Unknown';
        const price = p?.priceEuros != null ? `€${p.priceEuros}/month` : '';
        const credits = p?.creditsPerMonth
          ? `${p.creditsPerMonth} credits/mo`
          : '';
        lines.push(
          `  - ${[name, price, credits].filter(Boolean).join(' - ')}`,
        );
      }
      lines.push('');
      lines.push(
        'Ask the user which plan they want, then call derrick_upgrade again with `plan` set (e.g. plan: "STANDARD").',
      );
      return textResult(lines.join('\n'));
    },
  );
}

// -- derrick_help / derrick_credits content builders ------------------------

function buildCreditsResponse(): string {
  const credits = getLastKnownCredits();
  const remaining = credits?.remaining;

  if (remaining === undefined || remaining === null) {
    return [
      'No API call has been made in this session yet — balance unknown.',
      'Run any Derrick tool and the balance will be shown automatically.',
      '',
      PRICING_MSG,
    ].join('\n');
  }

  const lines = [`Current balance: ${remaining} credits remaining.`];
  if (typeof remaining === 'number' && remaining < 200) {
    lines.push('');
    lines.push(
      'Warning: credits running low. Run derrick_upgrade to pick a plan and subscribe via Stripe Checkout, or visit https://derrick-app.com',
    );
    lines.push('');
    lines.push(PRICING_MSG);
  }
  return lines.join('\n');
}

function buildHelpResponse(topic: string): string {
  const t = topic.toLowerCase().trim();

  if (['credits', 'crédits', 'credit', 'solde', 'balance'].includes(t)) {
    return buildCreditsResponse();
  }

  if (['errors', 'erreurs', 'error', 'erreur'].includes(t)) {
    return [
      'Derrick errors — when do you get charged?',
      '',
      '| Error              | Cause                                 | Charged? |',
      '|--------------------|---------------------------------------|----------|',
      '| 401 AUTH           | API key invalid                       | No       |',
      '| 402 NO CREDITS     | Out of credits                        | No       |',
      '| 429 RATE LIMIT     | 60 req/min exceeded                   | No       |',
      '| Empty response     | Chrome extension not connected        | No       |',
      '| not_found result   | No match found                        | Yes (per-call endpoints) |',
      '| Successful result  | Result returned                       | Yes      |',
      '',
      'Per-success billing (charged ONLY if a result is returned):',
      '  find_email (5 credits), find_phone (150 credits)',
      '',
      'Per-call billing (charged even if empty):',
      '  verify_email, enrich_profile, enrich_companies, search_linkedin_profile,',
      '  search_companies, website_contact_social, find_tech, data_gouv,',
      '  get_name_from_email, find_gender, linkedin_profile_followers_count,',
      '  search_leads_in_companies, serp_first_result, serp_first_page',
    ].join('\n');
  }

  if (['pricing', 'plans', 'prix', 'plan', 'price'].includes(t)) {
    return `${PRICING_MSG}\n\nTo change your plan now, call derrick_upgrade.`;
  }

  if (['scale', 'volume', 'sheets', 'bulk', 'google sheets', 'échelle'].includes(t)) {
    return [
      'Derrick at scale — Google Sheets',
      '',
      'This MCP is great for one-off requests from Claude. For full lists',
      '(100, 1,000, 10,000 rows), the Google Sheets extension is much more powerful:',
      '',
      '  - Enrich entire columns in one click',
      '  - All Derrick features (including any not yet exposed in this MCP)',
      '  - Results land directly in your spreadsheet, exportable to CSV',
      '  - Automatic rate-limit and retry handling',
      '',
      'Install: https://derrick-app.com → install the Google Sheets extension',
    ].join('\n');
  }

  // Default: full overview
  return [
    'Derrick MCP — what you can do',
    '',
    'People',
    '  - Find a LinkedIn profile from a name (search_linkedin_profile — 1 credit, per call)',
    '  - Enrich a LinkedIn profile with +15 attributes (enrich_profile — 1 credit, per call)',
    '  - Find a professional email (find_email — 5 credits, per success)',
    '  - Verify an email (verify_email — 1 credit, per call)',
    '  - Find a phone from a LinkedIn URL (find_phone — 150 credits, per success)',
    '  - Followers & connections count (linkedin_profile_followers_count — 1 credit, per call)',
    '  - Get name from email (get_name_from_email — 1 credit, per call)',
    '  - Find gender from a name (find_gender — 1 credit, per call)',
    '',
    'Companies',
    '  - Find a company\'s LinkedIn URL from its name (search_companies — 1 credit, per call)',
    '  - Enrich a company with +15 attributes (enrich_companies — 1 credit, per call)',
    '  - Find leads inside a target company via Sales Navigator (search_leads_in_companies — 1 credit per lead)',
    '  - Scrape contacts from a website (website_contact_social — 2 credits, per call)',
    '  - Detect a website\'s tech stack (find_tech — 2 credits, per call)',
    '  - SIRET/SIREN enrichment for French companies (data_gouv — 1 credit, per call)',
    '',
    'Google',
    '  - First organic Google result for a query (serp_first_result — 2 credits, per call)',
    '  - First page of Google results, 10 items (serp_first_page — 3 credits, per call)',
    '',
    PRICING_MSG,
    'To change your plan now, call derrick_upgrade.',
    '',
    'Important',
    '  - I always confirm the cost with you before each call.',
    '  - "Per-call" endpoints charge even if no result is returned.',
    '  - LinkedIn endpoints require the Derrick Chrome extension installed and connected.',
    '',
    'At scale → Google Sheets',
    'This MCP is in beta. For lists of 100+ rows, the Google Sheets extension',
    'is much more powerful: https://derrick-app.com',
  ].join('\n');
}

// -- Dynamic tools (from /docs/actions metadata) -----------------------------

interface ActionInput {
  key: string;
  type: string;
  description: string;
  required: boolean;
  placeholder: string;
  options?: Array<{ label: string; value: string }>;
}

interface ActionMetadata {
  actionName: string;
  apiSlug: string | null;
  title: string;
  description: string;
  category: string | null;
  creditsPerRun: number;
  inputs: ActionInput[];
}

function buildToolDescription(
  action: ActionMetadata,
  override: ToolOverride | undefined,
): string {
  const parts: string[] = [];

  if (action.title) parts.push(action.title);
  if (action.description && action.description !== action.title) {
    parts.push(action.description);
  }
  parts.push(`Cost: ${action.creditsPerRun} credit(s) per call.`);
  if (action.category) parts.push(`Category: ${action.category}`);

  if (override?.prompt) {
    parts.push(`\n${override.prompt}`);
  }

  if (action.inputs.length > 0) {
    parts.push('\nArgs:');
    for (const inp of action.inputs) {
      const opt = inp.required ? '' : ' (optional)';
      const hint = inp.description || inp.placeholder;
      let line = `    ${inp.key}${opt}: ${hint}`;
      if (inp.type === 'select' && inp.options?.length) {
        line += ` Options: ${inp.options.map((o) => o.value).join(', ')}`;
      }
      parts.push(line);
    }
  }

  return parts.join('\n');
}

export async function registerDynamicTools(server: McpServer): Promise<void> {
  console.error('Fetching Derrick action metadata...');

  let actions: ActionMetadata[];
  try {
    const res = await fetch(`${DERRICK_BASE_URL}/docs/actions`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { actions: ActionMetadata[] };
    actions = data.actions;
  } catch (err: any) {
    console.error(`Warning: could not fetch Derrick actions: ${err.message}`);
    console.error(
      'Only static tools (derrick_configure, derrick_account) are available.',
    );
    return;
  }

  let registered = 0;
  let skipped = 0;
  const seenToolNames = new Set<string>();

  for (const action of actions) {
    const apiSlug = action.apiSlug;
    if (!apiSlug) continue;

    const toolName = `derrick_${apiSlug}`;

    if (!SAFE_IDENTIFIER.test(toolName)) {
      console.error(`Warning: skipping action ${apiSlug} — unsafe tool name`);
      skipped++;
      continue;
    }

    if (seenToolNames.has(toolName)) {
      console.error(
        `Warning: skipping action ${apiSlug} — tool ${toolName} already registered (duplicate apiSlug)`,
      );
      skipped++;
      continue;
    }

    const hasUnsafeParam = action.inputs.some(
      (inp) => inp.key && !SAFE_IDENTIFIER.test(inp.key),
    );
    if (hasUnsafeParam) {
      console.error(
        `Warning: skipping action ${apiSlug} — unsafe parameter name`,
      );
      skipped++;
      continue;
    }

    const override = TOOL_OVERRIDES[apiSlug];
    const description = buildToolDescription(action, override);

    const shape: Record<string, any> = {};
    for (const inp of action.inputs) {
      if (!inp.key) continue;
      let schema = z
        .string()
        .describe(inp.description || inp.placeholder || inp.key);
      if (!inp.required) {
        schema = schema.optional() as any;
      }
      shape[inp.key] = schema;
    }

    const slug = apiSlug;
    const title = action.title || apiSlug;
    try {
      server.registerTool(
        toolName,
        {
          title,
          description,
          inputSchema: shape,
          annotations: {
            readOnlyHint: true,
            openWorldHint: true,
          },
        },
        async (
          args: Record<string, any>,
          extra: Record<string, any>,
        ) => {
          const apiKey = resolveApiKey(extra);
          const payload: Record<string, any> = {};
          for (const [k, v] of Object.entries(args)) {
            if (v !== undefined && v !== null && v !== '') {
              payload[k] = v;
            }
          }

          // Keepalive: emit a logging notification every 25s while the upstream
          // call is in flight. Each notification is a real SSE event on the open
          // /mcp stream, which resets Heroku's 55s idle timer. Without this, slow
          // tools (find_email, find_phone) get killed by Heroku before completing.
          const tick = setInterval(() => {
            extra.sendNotification
              ?.({
                method: 'notifications/message',
                params: {
                  level: 'info',
                  data: `Still working on ${slug}…`,
                },
              })
              .catch(() => {});
          }, 25_000);

          try {
            const { status, body } = await callApi('POST', slug, {
              jsonBody: { data: payload },
              apiKeyOverride: apiKey || undefined,
            });

            if (!body.success) return errorResult(formatError(status, body));
            return textResult(formatSuccess(body, override?.nextActions));
          } finally {
            clearInterval(tick);
          }
        },
      );
      seenToolNames.add(toolName);
      registered++;
    } catch (err: any) {
      console.error(
        `Warning: failed to register tool ${toolName}: ${err?.message ?? err}`,
      );
      skipped++;
    }
  }

  console.error(
    `Registered ${registered} dynamic tool(s)${skipped ? `, skipped ${skipped}` : ''}.`,
  );
}
