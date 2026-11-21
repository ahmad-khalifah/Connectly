// Same handler the Cloudflare Worker answers (lib/http/router-agent.ts), for
// local development under `next dev`.
export { handleAgentSync as POST } from '@/lib/http/router-agent';
