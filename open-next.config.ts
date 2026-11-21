// Build settings for running the Next.js app on Cloudflare Workers (free plan)
// through the OpenNext adapter. See docs/cloudflare.md.
//
// The app has no ISR or on-demand revalidation, so pre-rendered pages are read
// from the Worker's static assets: no R2 bucket or KV namespace is needed, and
// static asset requests do not count against the free plan's daily quota.
import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache';

export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
