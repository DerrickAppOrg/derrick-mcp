/**
 * Per-tool prompt overrides for dynamically-registered Derrick actions.
 *
 * The dynamic tool registrar (tools.ts) builds a tool description from the
 * Derrick API metadata at /docs/actions. That metadata only contains the
 * action's title, description, cost, and input schema — it has no notion of
 * workflow guidance, domain constraints, or follow-up suggestions.
 *
 * This file is where that prompt-engineering layer lives. Each entry:
 *   - `prompt`     — appended to the auto-generated description. Use it to
 *                    encode workflow rules ("call X before this"), domain
 *                    rules ("French companies only"), and cost-confirmation
 *                    requirements specific to this tool.
 *   - `nextActions` — bulleted list shown after every successful response,
 *                     suggesting natural follow-ups so the conversation
 *                     chains forward. The Sheets growth nudge is appended
 *                     automatically (see format.ts), so don't repeat it.
 *
 * Universal rules ("always announce cost", "reply in user's language",
 * "never show raw confidence scores", etc.) live in prompts.ts as
 * SERVER_INSTRUCTIONS — don't repeat them here.
 *
 * Add a new entry whenever the Derrick API exposes a new action that needs
 * special handling. Tools without an entry still work — they just use the
 * auto-generated description with no follow-ups.
 */

export interface ToolOverride {
  prompt?: string;
  nextActions?: string[];
}

export const TOOL_OVERRIDES: Record<string, ToolOverride> = {
  // -- Lead / email ---------------------------------------------------------

  find_email: {
    prompt: [
      'Charged ONLY on success (5 credits per email found).',
      'If the LinkedIn company URL is unknown, suggest chaining:',
      '  search_companies (1 credit) + find_email (5 credits) = 6 credits total.',
      'Always announce the total before calling and wait for confirmation.',
    ].join('\n'),
    nextActions: [
      'Verify the email (verify_email — 1 credit)',
      'Find their phone number (find_phone — 150 credits, requires confirmation)',
      'Enrich their LinkedIn profile (enrich_profile — 1 credit)',
    ],
  },

  verify_email: {
    prompt:
      'Returns a certainty level: ultra_sure, sure, risky, invalid, not_found. Charged 1 credit per call EVEN IF not_found.',
    nextActions: [
      'Enrich the LinkedIn profile of this person (enrich_profile — 1 credit)',
      'Find their phone (find_phone — 150 credits, requires confirmation)',
    ],
  },

  find_phone: {
    prompt: [
      'HIGH COST: 150 credits per phone found. Charged ONLY on success.',
      'ALWAYS announce the cost in bold before calling and wait for explicit confirmation.',
      'If the user only has a name, mention chaining:',
      '  search_linkedin_profile (1) + find_phone (150) = 151 credits total.',
    ].join('\n'),
    nextActions: [
      'Find their professional email (find_email — 5 credits)',
      'Enrich their LinkedIn profile (enrich_profile — 1 credit)',
    ],
  },

  // -- LinkedIn / lead ------------------------------------------------------

  search_linkedin_profile: {
    prompt: [
      'ENTRY POINT when you only have the name — use this BEFORE enrich_profile.',
      'The "confidence" field is hidden from the response by the formatter — never ask for it.',
      'If you suspect a low-confidence match, say so in plain language.',
      'When chaining with enrich_profile, announce total (1 + 1 = 2 credits) and wait for confirmation.',
    ].join('\n'),
    nextActions: [
      'Enrich this profile for +15 attributes (enrich_profile — 1 credit)',
      'Find their professional email (find_email — 5 credits)',
      'Find their phone (find_phone — 150 credits, requires confirmation)',
    ],
  },

  enrich_profile: {
    prompt: [
      'Adds +15 attributes (name, headline, company, location, summary, education, etc.).',
      'Requires the Derrick Chrome extension installed and connected — empty responses usually mean the extension is not connected.',
      'If the user only has a name, suggest:',
      '  search_linkedin_profile (1) + enrich_profile (1) = 2 credits total.',
    ].join('\n'),
    nextActions: [
      'Find their email (find_email — 5 credits)',
      'Find their phone (find_phone — 150 credits, requires confirmation)',
      'Enrich their company (enrich_companies — 1 credit)',
    ],
  },

  linkedin_profile_followers_count: {
    prompt:
      'Returns followers, connections count, and creator/verified status. Useful for qualifying influencers or checking notoriety. Requires the Derrick Chrome extension.',
    nextActions: [
      'Enrich the full profile (enrich_profile — 1 credit)',
      'Find their email (find_email — 5 credits)',
    ],
  },

  // -- LinkedIn / company ---------------------------------------------------

  search_companies: {
    prompt: [
      'ENTRY POINT for company workflows — use this BEFORE enrich_companies.',
      'Also produces the linkedinCompanyURL needed by find_email.',
      'The "confidence" field is hidden by the formatter — never ask for it.',
      'When chaining with enrich_companies, announce total (1 + 1 = 2 credits).',
    ].join('\n'),
    nextActions: [
      'Enrich this company for +15 attributes (enrich_companies — 1 credit)',
      'Find leads inside (search_leads_in_companies — 1 credit per lead)',
      'Scrape contacts from their website (website_contact_social — 2 credits)',
    ],
  },

  enrich_companies: {
    prompt: [
      'Adds +15 LinkedIn attributes (name, description, industry, size, location, website, followers, specialties, etc.).',
      'Requires a full LinkedIn URL — if you only have the name, use search_companies first (+1 credit).',
      'Requires the Derrick Chrome extension.',
    ].join('\n'),
    nextActions: [
      'Find leads in this company (search_leads_in_companies — 1 credit per lead)',
      'Scrape their website contacts (website_contact_social — 2 credits)',
      'Detect their tech stack (find_tech — 2 credits)',
    ],
  },

  search_leads_in_companies: {
    prompt: [
      'Cross a target company\'s LinkedIn URL with Sales Navigator criteria. Ideal for ABM.',
      'Requires the Derrick Chrome extension AND a Sales Navigator subscription.',
      'Cost is VARIABLE: 1 credit per lead returned. Tell the user the cost depends on result count and wait for confirmation.',
    ].join('\n'),
    nextActions: [
      'Enrich the leads found (enrich_profile — 1 credit each)',
      'Find their emails (find_email — 5 credits each)',
    ],
  },

  // -- Company / web --------------------------------------------------------

  website_contact_social: {
    prompt: [
      'Scrapes public emails, phone, and social media links from a website.',
      'Emails are usually GENERIC (contact@, hello@) — for a specific person\'s email use find_email.',
      'Charged 2 credits even if no contacts are found.',
    ].join('\n'),
    nextActions: [
      'Detect their tech stack (find_tech — 2 credits)',
      'Enrich the company via LinkedIn (search_companies — 1 credit)',
      'Find a specific person\'s email (find_email — 5 credits)',
    ],
  },

  find_tech: {
    prompt:
      'Detects CMS, framework, analytics, CDN, hosting. Useful for qualifying prospects by stack. Charged 2 credits even if no tech is detected.',
    nextActions: [
      'Scrape the contacts of this site (website_contact_social — 2 credits)',
      'Enrich the company via LinkedIn (search_companies — 1 credit)',
    ],
  },

  // -- French companies (SIRET/SIREN) --------------------------------------

  data_gouv: {
    prompt: [
      'FRENCH COMPANIES ONLY. Do NOT call this for non-French companies.',
      'Accepts SIRET (14 digits) or SIREN (9 digits).',
      'Returns 30+ legal fields: name, address, NAF code, revenue, net result, directors, etc.',
    ].join('\n'),
    nextActions: [
      'Enrich via LinkedIn for fresher data (search_companies — 1 credit)',
      'Scrape their website contacts (website_contact_social — 2 credits)',
      'Find leads in this company (search_leads_in_companies — 1 credit per lead)',
    ],
  },

  // -- Cleanup / parsing ---------------------------------------------------

  get_name_from_email: {
    prompt:
      'Extracts firstname, lastname, and domain from an email address. Useful for cleanup and parsing.',
    nextActions: [
      'Find their LinkedIn profile (search_linkedin_profile — 1 credit)',
      'Verify the email (verify_email — 1 credit)',
    ],
  },

  find_gender: {
    prompt:
      'Strips special characters from a full name and returns firstname, lastname, and gender.',
    nextActions: [
      'Find their LinkedIn profile (search_linkedin_profile — 1 credit)',
    ],
  },

  // -- Google SERP ---------------------------------------------------------

  serp_first_result: {
    prompt:
      'Returns the first organic Google result for a query. Useful for finding a person\'s website, LinkedIn, etc.',
    nextActions: [
      'Get the full first page of results (serp_first_page — 3 credits)',
      'Scrape contacts from the result URL (website_contact_social — 2 credits)',
    ],
  },

  serp_first_page: {
    prompt:
      'Returns the 10 organic Google results from the first page. More expensive than serp_first_result — use only when multiple sources are needed.',
    nextActions: [
      'Pick a result and scrape its contacts (website_contact_social — 2 credits)',
      'Detect the tech stack of a result (find_tech — 2 credits)',
    ],
  },
};
