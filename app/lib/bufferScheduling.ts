/**
 * Turns approved content into Buffer jobs, routes each job to the right channel, spaces
 * jobs across optimal slots, and creates them in Buffer.
 *
 * Routing rules:
 *   social caption (Instagram / LinkedIn / Facebook) → the matching connected channel
 *   carousel                                          → Instagram AND LinkedIn, notification-type
 *                                                       (Buffer reminds you to attach the slides)
 *   video script                                      → NOT sent to Buffer. Buffer's API can't
 *                                                       attach a video file, so it goes to the
 *                                                       TikTok post package / HeyGen / CapCut flow.
 *   blog post                                         → NOT sent to Buffer (publishes via GitHub).
 *
 * Every job gets its own slot, so the same content never goes out to two platforms at once.
 */

import type { DailyBatch, DraftsIndexEntry, SocialPlatform } from './drafts'
import { getDraftsIndex, getDraftBatch } from './drafts'
import { getOrganizationId, getChannels, getUpcomingPosts, createScheduledPost, type BufferChannel, type SchedulingType } from './buffer'
import { nextPostingSlots, formatPT } from './bufferSlots'

export type ScheduleJob = {
  key: string // piece identifier, for the UI
  platform: SocialPlatform
  text: string
  schedulingType: SchedulingType
  sourceLabel: string // e.g. "2026-11-01 social caption"
}

export type ScheduleResult = {
  key: string
  platform: string
  status: 'scheduled' | 'skipped' | 'failed'
  when?: string // formatted Pacific time
  message?: string
}

const SERVICE_FOR: Record<SocialPlatform, string> = {
  Instagram: 'instagram',
  LinkedIn: 'linkedin',
  Facebook: 'facebook',
}

/** Caption text exactly as it will be posted: caption, then hashtags. */
function socialText(caption: string, hashtags: string[]): string {
  return hashtags.length ? `${caption}\n\n${hashtags.join(' ')}` : caption
}

/** Jobs contributed by one batch's approved pieces (social captions and carousels only). */
export function jobsFromBatch(batch: DailyBatch): ScheduleJob[] {
  const jobs: ScheduleJob[] = []

  batch.socials.forEach((s, i) => {
    if (s.status !== 'approved') return
    jobs.push({
      key: `${batch.date}:social:${i}`,
      platform: s.data.platform,
      text: socialText(s.data.caption, s.data.hashtags),
      schedulingType: 'automatic',
      sourceLabel: `${batch.date} ${s.data.platform} caption`,
    })
  })

  if (batch.carousel.status === 'approved') {
    const carouselText = socialText(batch.carousel.data.caption, [])
    for (const platform of ['Instagram', 'LinkedIn'] as SocialPlatform[]) {
      jobs.push({
        key: `${batch.date}:carousel:${platform}`,
        platform,
        text: carouselText,
        schedulingType: 'notification',
        sourceLabel: `${batch.date} carousel (${platform})`,
      })
    }
  }

  return jobs
}

/** Finds the connected Buffer channel for each platform, or throws a clear message. */
function channelMap(channels: BufferChannel[]): Map<SocialPlatform, BufferChannel> {
  const map = new Map<SocialPlatform, BufferChannel>()
  for (const platform of Object.keys(SERVICE_FOR) as SocialPlatform[]) {
    const match = channels.find((c) => c.service?.toLowerCase() === SERVICE_FOR[platform])
    if (match) map.set(platform, match)
  }
  return map
}

/**
 * Plans (and, unless dryRun, creates) Buffer posts for the given jobs.
 * Skips any job whose exact text is already queued in Buffer, so re-running is safe.
 */
export async function scheduleJobs(jobs: ScheduleJob[], dryRun: boolean): Promise<ScheduleResult[]> {
  const orgId = await getOrganizationId()
  const channels = await getChannels(orgId)
  const channelFor = channelMap(channels)
  const upcoming = await getUpcomingPosts(orgId)

  const queuedTexts = new Set(upcoming.map((p) => p.text.trim()))
  const taken = new Set<number>(
    upcoming.filter((p) => p.dueAt).map((p) => new Date(p.dueAt as string).getTime())
  )

  const results: ScheduleResult[] = []
  const pending = jobs.filter((j) => {
    if (queuedTexts.has(j.text.trim())) {
      results.push({ key: j.key, platform: j.platform, status: 'skipped', message: 'Already queued in Buffer.' })
      return false
    }
    if (!channelFor.has(j.platform)) {
      results.push({ key: j.key, platform: j.platform, status: 'failed', message: `No connected ${j.platform} channel in Buffer.` })
      return false
    }
    return true
  })

  const slots = nextPostingSlots(pending.length, taken)

  for (let i = 0; i < pending.length; i++) {
    const job = pending[i]
    const channel = channelFor.get(job.platform)!
    const slot = slots[i]
    if (!slot) {
      results.push({ key: job.key, platform: job.platform, status: 'failed', message: 'No free posting slot found in the next 8 weeks.' })
      continue
    }

    if (dryRun) {
      results.push({ key: job.key, platform: job.platform, status: 'scheduled', when: formatPT(slot), message: job.sourceLabel })
      continue
    }

    try {
      await createScheduledPost({ channelId: channel.id, text: job.text, dueAt: slot, schedulingType: job.schedulingType })
      results.push({ key: job.key, platform: job.platform, status: 'scheduled', when: formatPT(slot) })
    } catch (err) {
      results.push({
        key: job.key,
        platform: job.platform,
        status: 'failed',
        message: err instanceof Error ? err.message : 'Buffer rejected this post.',
      })
    }
  }

  return results
}

/** Every batch from the last `days` days, oldest first. */
export async function batchesFromLastDays(days: number): Promise<DailyBatch[]> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const index: DraftsIndexEntry[] = await getDraftsIndex()
  const dates = index.map((e) => e.date).filter((d) => d >= cutoff).sort()
  const batches: DailyBatch[] = []
  for (const date of dates) {
    const batch = await getDraftBatch(date)
    if (batch) batches.push(batch)
  }
  return batches
}
