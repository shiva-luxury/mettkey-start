/**
 * Server-side Buffer client (Buffer's current GraphQL API at https://api.buffer.com).
 *
 * Auth: the account API key from publish.buffer.com/settings/api, sent as
 * `Authorization: Bearer …`. Read from the BUFFER_API_KEY env var only — never sent to the browser.
 *
 * Operations used (names from Buffer's API reference):
 *   account { organizations }        → the org this key can post to
 *   channels(input: …)               → connected social channels (id, service, name)
 *   createPost(input: …)             → one scheduled post per channel
 *   posts(input: …)                  → queued posts, used for the queue view and de-duplication
 */

const ENDPOINT = 'https://api.buffer.com'

export type BufferChannel = {
  id: string
  name: string
  service: string
  displayName?: string | null
  isDisconnected?: boolean | null
}

export type BufferPost = {
  id: string
  text: string
  dueAt: string | null
  channelId: string
}

export type SchedulingType = 'automatic' | 'notification'

type GraphQLResponse<T> = { data?: T; errors?: { message: string }[] }

async function gql<T>(query: string): Promise<T> {
  const key = process.env.BUFFER_API_KEY
  if (!key) {
    throw new Error('BUFFER_API_KEY is not set. Add it in the Vercel project’s environment variables and redeploy.')
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query }),
    cache: 'no-store',
  })

  let json: GraphQLResponse<T> | null = null
  try {
    json = (await res.json()) as GraphQLResponse<T>
  } catch {
    // non-JSON body — handled below
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error('Buffer rejected the API key (unauthorized). Check BUFFER_API_KEY in Vercel.')
  }
  if (!res.ok) {
    throw new Error(`Buffer API returned HTTP ${res.status}.`)
  }
  if (json?.errors?.length) {
    throw new Error(`Buffer: ${json.errors.map((e) => e.message).join('; ')}`)
  }
  if (!json?.data) {
    throw new Error('Buffer returned an empty response.')
  }
  return json.data
}

/** The organization to post into. Uses BUFFER_ORGANIZATION_ID if set, otherwise the account's first organization. */
export async function getOrganizationId(): Promise<string> {
  const fromEnv = process.env.BUFFER_ORGANIZATION_ID
  if (fromEnv) return fromEnv

  const data = await gql<{ account: { organizations: { id: string; name?: string }[] } }>(
    `query { account { organizations { id name } } }`
  )
  const org = data.account.organizations[0]
  if (!org) throw new Error('No Buffer organization found for this API key.')
  return org.id
}

export async function getChannels(organizationId: string): Promise<BufferChannel[]> {
  const data = await gql<{ channels: BufferChannel[] }>(
    `query { channels(input: { organizationId: ${JSON.stringify(organizationId)} }) { id name service displayName isDisconnected } }`
  )
  return data.channels.filter((c) => !c.isDisconnected)
}

/**
 * Schedules one post on one channel at an exact time.
 *  - automatic:    Buffer publishes at dueAt.
 *  - notification: Buffer reminds you to finish and publish it yourself (used for carousels, whose slides must be attached in Buffer).
 */
export async function createScheduledPost(opts: {
  channelId: string
  text: string
  dueAt: Date
  schedulingType: SchedulingType
}): Promise<{ id: string; dueAt: string | null }> {
  const data = await gql<{
    createPost:
      | { post: { id: string; dueAt: string | null } }
      | { message: string }
  }>(
    `mutation {
      createPost(input: {
        text: ${JSON.stringify(opts.text)},
        channelId: ${JSON.stringify(opts.channelId)},
        schedulingType: ${opts.schedulingType},
        mode: customScheduled,
        dueAt: ${JSON.stringify(opts.dueAt.toISOString())},
        assets: [],
        needsApproval: false
      }) {
        ... on PostActionSuccess { post { id dueAt } }
        ... on MutationError { message }
      }
    }`
  )

  const result = data.createPost
  if ('message' in result) throw new Error(`Buffer refused the post: ${result.message}`)
  return result.post
}

/** Queued posts for the organization. Filtering to upcoming posts happens in code (see getUpcomingPosts). */
export async function getQueuedPosts(organizationId: string): Promise<BufferPost[]> {
  const data = await gql<{
    posts: { edges: { node: { id: string; text: string; dueAt: string | null; channelId: string } }[] }
  }>(
    `query {
      posts(first: 100, input: { organizationId: ${JSON.stringify(organizationId)}, sort: [] }) {
        edges { node { id text dueAt channelId } }
      }
    }`
  )
  return data.posts.edges.map((e) => e.node)
}

/** Only posts whose due time is still in the future — what the queue view and slot planner care about. */
export async function getUpcomingPosts(organizationId: string): Promise<BufferPost[]> {
  const now = Date.now()
  const all = await getQueuedPosts(organizationId)
  return all.filter((p) => p.dueAt && new Date(p.dueAt).getTime() > now)
}
