import type { TopicCategory } from './topics'

/**
 * Curated Unsplash direct image URLs — no Unsplash API key/call involved. IDs reused from
 * the ones already in production on mettkey.com's static site, plus a few well-known
 * house/finance/California stock photo IDs, for a reasonable variety per category.
 */
type CuratedImage = { id: string; alt: string; categories: TopicCategory[] }

const CURATED_IMAGES: CuratedImage[] = [
  { id: 'photo-1560518883-ce09059eeffa', alt: 'Modern California home exterior', categories: ['First-Time Buyers', 'CA Programs'] },
  { id: 'photo-1600596542815-ffad4c1539a9', alt: 'Bright modern living room', categories: ['First-Time Buyers', 'Refinancing'] },
  { id: 'photo-1570129477492-45c003edd2be', alt: 'Suburban house with palm trees', categories: ['CA Programs', 'First-Time Buyers'] },
  { id: 'photo-1600047509807-ba8f99d2cdde', alt: 'Modern kitchen interior', categories: ['Refinancing', 'Self-Employed'] },
  { id: 'photo-1600585154340-be6161a56a0c', alt: 'Contemporary house exterior', categories: ['Investors', 'CA Programs'] },
  { id: 'photo-1600585154526-990dced4db0d', alt: 'Living room with natural light', categories: ['First-Time Buyers'] },
  { id: 'photo-1613490493576-7fde63acd811', alt: 'Modern apartment building', categories: ['Investors', 'Refinancing'] },
  { id: 'photo-1554224155-6726b3ff858f', alt: 'Home office desk setup', categories: ['Self-Employed'] },
  { id: 'photo-1556909114-f6e7ad7d3136', alt: 'Person reviewing documents at desk', categories: ['Self-Employed', 'Rates'] },
  { id: 'photo-1558618666-fcd25c85cd64', alt: 'Calculator and financial paperwork', categories: ['Rates', 'Refinancing'] },
  { id: 'photo-1560472354-b33ff0c44a43', alt: 'Handshake over a desk', categories: ['Investors', 'CA Programs'] },
  { id: 'photo-1560472355-536de3962603', alt: 'Financial charts and graphs', categories: ['Rates'] },
  { id: 'photo-1486325212027-8081e485255e', alt: 'California hillside neighborhood', categories: ['CA Programs', 'Investors'] },
  { id: 'photo-1450101499163-c8848c66ca85', alt: 'Los Angeles skyline at dusk', categories: ['CA Programs', 'Rates'] },
  { id: 'photo-1521791136064-7986c2920216', alt: 'Modern home with pool', categories: ['Investors', 'CA Programs'] },
  { id: 'photo-1543286386-713bdd548da4', alt: 'Cozy living room interior', categories: ['First-Time Buyers', 'Refinancing'] },
]

export function getImageUrl(id: string, width = 1200): string {
  return `https://images.unsplash.com/${id}?w=${width}&q=80&auto=format&fit=crop`
}

/** Deterministically pick an Unsplash image that matches the post category. */
export function pickImageForCategory(category: TopicCategory, seed = ''): CuratedImage {
  const matches = CURATED_IMAGES.filter((img) => img.categories.includes(category))
  const pool = matches.length > 0 ? matches : CURATED_IMAGES
  let hash = 5381
  const key = category + seed
  for (let i = 0; i < key.length; i++) hash = (hash * 33) ^ key.charCodeAt(i)
  const idx = Math.abs(hash >>> 0) % pool.length
  return pool[idx]
}
