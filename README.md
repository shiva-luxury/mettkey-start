# Mettkey Content Engine

Internal, no-login content-generation dashboard for Mettkey — a California mortgage
EDUCATION platform owned by Shiva T. Mettke (CA DRE #02251909, NMLS #2779492). Mettkey is
not a lender or broker.

This mirrors the structure of the sibling app `shiva-lead-engine` (deployed as
start.shivaluxury.com): Next.js 14 App Router, a single server-side Anthropic API route,
plain client components, no auth.

## Modules
| Tab | What it does |
|-----|---------------|
| **Blog** | Suggests a rotating list of CA mortgage topics (date-seeded, no external API), researches a topic with live web search, then writes an original 500-800 word SEO blog post with a matching curated image and a copy-ready entry for `mettkey-site`'s `BLOG_POSTS` array shape. Also has a read-only panel that lists posts already live on mettkey.com (via `/api/posts`), for reference. |
| **Social** | Generates Instagram captions, carousel slide copy, TikTok scripts, and LinkedIn posts on CA mortgage education topics. |
| **Newsletter** | Generates three newsletter types (weekly rate update, CA program announcement, general educational) as HTML ready to paste into Brevo. |

## Compliance
Every generation call routes through `/api/claude`, which carries a system prompt
instructing Claude to:
1. Never guarantee a rate, loan approval, or specific loan terms.
2. Always frame Mettkey as an educational resource, never a lender/broker/mortgage company.
3. Include the disclaimer "Educational purposes only. Mettkey is not a lender or broker.
   NMLS #2779492 | Shiva T. Mettke." in every generated piece.
4. Self-review its own output for language that could read as a rate guarantee or loan
   commitment.

The API response also includes a `complianceFlags: string[]` field — a keyword-scan safety
net independent of the model's self-review — which the UI surfaces prominently (an amber
warning box) above any generated content that trips it. Nothing is ever silently dropped.

## Stack
- **Framework**: Next.js 14 (App Router)
- **AI**: Anthropic Claude (model `claude-sonnet-5`) via a single server-side API route —
  the Anthropic SDK and API key are never used or exposed in client code
- **Styling**: Tailwind CSS
- **No auth**: by explicit choice of the app's owner — this is an internal tool with no
  login of any kind

## Local setup

```bash
npm install
cp .env.local.example .env.local
# Open .env.local and add your ANTHROPIC_API_KEY from console.anthropic.com
npm run dev
# → http://localhost:3000
```

`ANTHROPIC_API_KEY` is the only required environment variable. This can use the same key
as start.shivaluxury.com, but Vercel environment variables are per-project, so it must be
added separately to whatever Vercel project this app eventually becomes.

## Deploy
Not deployed yet. No Vercel project or DNS has been set up for this app — that's a
separate step for the owner to do after reviewing this locally.
