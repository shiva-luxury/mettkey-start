export type TopicCategory =
  | 'Rates'
  | 'First-Time Buyers'
  | 'Investors'
  | 'Self-Employed'
  | 'Refinancing'
  | 'CA Programs'

export type Topic = { title: string; category: TopicCategory }

/**
 * ~30 high-traffic California mortgage search topics, covering rates, first-time buyers,
 * investors, self-employed borrowers, refinancing, and CA-specific programs. No external
 * trends API — this list is hardcoded and rotated deterministically by date (see
 * getTodaysTopics below), so "today's suggestions" change day to day with no database.
 */
export const TOPICS: Topic[] = [
  { title: 'CA mortgage rates today', category: 'Rates' },
  { title: 'Why did mortgage rates go up this week in California', category: 'Rates' },
  { title: '30-year vs 15-year fixed mortgage California', category: 'Rates' },
  { title: 'How mortgage rates are determined', category: 'Rates' },
  { title: 'Rate lock explained for California homebuyers', category: 'Rates' },
  { title: 'ARM vs fixed rate mortgage in California', category: 'Rates' },
  { title: 'How to read a loan estimate', category: 'Rates' },
  { title: 'First time home buyer California 2026', category: 'First-Time Buyers' },
  { title: 'How much down payment do you need in California', category: 'First-Time Buyers' },
  { title: 'What credit score do you need to buy a house in California', category: 'First-Time Buyers' },
  { title: 'First time home buyer mistakes to avoid in California', category: 'First-Time Buyers' },
  { title: 'How to get pre-approved for a mortgage in California', category: 'First-Time Buyers' },
  { title: 'FHA loan limits California 2026', category: 'First-Time Buyers' },
  { title: 'Down payment assistance programs California', category: 'First-Time Buyers' },
  { title: 'DSCR loan California', category: 'Investors' },
  { title: 'How DSCR loans work for California rental property', category: 'Investors' },
  { title: 'Cash out refinance California investment property', category: 'Investors' },
  { title: 'Fix and flip financing California', category: 'Investors' },
  { title: 'Bridge loans for California real estate investors', category: 'Investors' },
  { title: 'How many rental properties can you finance in California', category: 'Investors' },
  { title: 'Bank statement loan self employed California', category: 'Self-Employed' },
  { title: 'How to qualify for a mortgage self employed California', category: 'Self-Employed' },
  { title: 'Non-QM loans explained for California borrowers', category: 'Self-Employed' },
  { title: '1099 income mortgage qualification California', category: 'Self-Employed' },
  { title: 'Profit and loss statement loan California', category: 'Self-Employed' },
  { title: 'Cash out refinance California', category: 'Refinancing' },
  { title: 'When does it make sense to refinance in California', category: 'Refinancing' },
  { title: 'Rate and term refinance vs cash out California', category: 'Refinancing' },
  { title: 'How much does refinancing cost in California', category: 'Refinancing' },
  { title: 'HELOC vs cash out refinance California', category: 'Refinancing' },
  { title: 'CalHFA 2026 programs', category: 'CA Programs' },
  { title: 'CalHFA MyHome Assistance Program explained', category: 'CA Programs' },
  { title: 'Jumbo loan Los Angeles', category: 'CA Programs' },
  { title: 'VA loan California', category: 'CA Programs' },
  { title: 'USDA loans in California — where do they apply', category: 'CA Programs' },
  { title: 'California conforming loan limits 2026', category: 'CA Programs' },
]

/** Simple deterministic string hash (djb2), used to seed the daily topic rotation. */
function hashString(input: string): number {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i)
  }
  return Math.abs(hash >>> 0)
}

/**
 * Deterministically picks `count` topics for a given date (YYYY-MM-DD), so the
 * "today's suggestions" list rotates day to day without needing a database or API.
 * Same date always produces the same topics; different dates produce different picks.
 */
export function getTodaysTopics(count = 6, date: Date = new Date()): Topic[] {
  const dateKey = date.toISOString().slice(0, 10) // YYYY-MM-DD
  const startIndex = hashString(dateKey) % TOPICS.length
  const picks: Topic[] = []
  const seen = new Set<number>()
  let offset = 0
  // Walk the list starting at the hashed index, stepping by a date-derived stride so the
  // picks aren't always sequential, until we have `count` unique topics.
  const stride = (hashString(dateKey + 'stride') % (TOPICS.length - 1)) + 1
  while (picks.length < count && seen.size < TOPICS.length) {
    const idx = (startIndex + offset * stride) % TOPICS.length
    if (!seen.has(idx)) {
      seen.add(idx)
      picks.push(TOPICS[idx])
    }
    offset++
  }
  return picks
}
