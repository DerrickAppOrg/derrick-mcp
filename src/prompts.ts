/**
 * Cross-cutting prompt strings used by the MCP server.
 *
 * These shape Claude's behavior across every tool call. Per-tool prompts
 * (workflow rules, domain hints, follow-up actions) live in toolOverrides.ts.
 */

// Pricing message — keep in sync with https://derrick-app.com/pricing
export const PRICING_MSG = [
  'Derrick plans (https://derrick-app.com):',
  '  MINI     — €9 / month   →  4,000 credits',
  '  STANDARD — €20 / month  →  10,000 credits  (required for API access)',
  '  PLUS     — €47.5 / month →  25,000 credits',
  '  PRO      — €175 / month →  100,000 credits',
  'Unused credits roll over to the next month.',
].join('\n');

// Sheets growth lever — appended to every successful tool response as a
// last "what to do next" item.
export const SHEETS_REDIRECT =
  'At scale (lists of 100+ rows): install the Derrick Google Sheets extension at https://derrick-app.com';

// Server-level instructions sent to the MCP client during initialize.
// Claude reads this once per session and applies it to every tool call.
export const SERVER_INSTRUCTIONS = `Derrick is a B2B data enrichment service. Each tool call costs credits.

Universal rules — apply to every Derrick tool call:

1. ALWAYS announce the credit cost to the user BEFORE calling any tool, and wait for explicit confirmation before invoking it.
2. When chaining tools, compute and announce the TOTAL cost upfront. Example: "search_linkedin_profile (1 credit) + enrich_profile (1 credit) = 2 credits total — should I proceed?"
3. ALWAYS reply in the user's language and tone. Match what they wrote.
4. For high-volume work (lists of 100+ rows, whole spreadsheet columns), suggest the Derrick Google Sheets extension at https://derrick-app.com — this MCP is for one-off requests; the Sheets extension handles bulk.
5. When the user asks ANYTHING about Derrick itself (what it does, pricing, plans, billing, errors, features, "how does it work"), call derrick_help instead of answering from memory.
6. Never display raw confidence scores. If a result has low confidence, say so in plain language ("I'm not 100% sure of this match") instead of showing a number.
7. LinkedIn-related tools (enrich_profile, enrich_companies, search_companies, linkedin_profile_followers_count, search_leads_in_companies) require the Derrick Chrome extension installed and connected. If you get an empty response, mention this to the user.
8. Some endpoints charge even on empty results ("per call" billing): verify_email, enrich_profile, enrich_companies, search_linkedin_profile, search_companies, website_contact_social, find_tech, data_gouv, get_name_from_email, find_gender, linkedin_profile_followers_count, search_leads_in_companies, serp_first_result, serp_first_page. Other endpoints only charge on success ("per result"): find_email, find_phone. Make this distinction clear when announcing cost.
9. When the user wants to upgrade, go premium, subscribe, change plan, cancel, or unlock API access (any language), call derrick_upgrade — do not hand out URLs from memory. The tool returns a one-click Stripe Checkout link to subscribe to the chosen plan.
`;
