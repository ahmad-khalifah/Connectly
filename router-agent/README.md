# Router agent (RouterOS)

Replaces the Mac controller for customer access. The router polls
`POST <backend>/api/router/agent/sync?format=lines` every 15 s (outbound HTTPS
only), applies paid access, ends plans on its own clock, and reports back.

| File | What it is |
|---|---|
| `cx-agent.rsc` | the poller (scheduler `cx-agent`, every 15 s) |
| `cx-sweep.rsc` | local expiry sweeper (scheduler `cx-sweep`, every 1 min, no network) |
| `cx-handback.rsc` | stops both and restores controller-style comments, to go back to the Mac |

## Facts checked on the L009 (RouterOS 7.21.5, 21 Nov 2026)
`:tonsec [:timestamp]` returns Unix nanoseconds; NTP is synchronized.

## NOT yet tested
Nothing in these scripts has run on a router yet. The backend side is tested
(`supabase/tests/router_agent.test.mjs`, `tests/router-agent.test.ts`, and a
full cycle on staging). Test order: staging token, dry run, then a real
additive test, then production. See the project plan in the chat.

## Install (per router)
1. Upload the three `.rsc` files to the router's Files.
2. Root certificates: the router must trust the backend's certificate
   (`check-certificate=yes-without-crl`). Import the CA bundle first.
3. Create the scripts from the files (policy `read,write,test`):
   `/system script add name=cx-agent policy=read,write,test source=[/file get cx-agent.rsc contents]`
   `/system script add name=cx-sweep policy=read,write,test source=[/file get cx-sweep.rsc contents]`
4. Create the config script yourself (it holds the router's token; never paste
   the token anywhere else):
   `/system script add name=cx-config policy=read,write,test source=":global cxUrl \"https://HOST/api/router/agent/sync\"; :global cxToken \"TOKEN\"; :global cxDry false"`
5. Schedulers, created disabled:
   `/system scheduler add name=cx-agent interval=15s policy=read,write,test disabled=yes on-event="/system script run cx-agent"`
   `/system scheduler add name=cx-sweep interval=1m policy=read,write,test disabled=yes on-event="/system script run cx-sweep"`
6. Enable: `/system scheduler enable cx-agent` (and `cx-sweep`).

## Kill switch
`/system scheduler disable cx-agent` stops polling at once. Customers already
on the router are unaffected. Leave `cx-sweep` on so plans still end.
Full hand-back to the Mac controller: run `cx-handback.rsc`, then set
`routers.agent_enabled = false` for that router.

## Protocol
Request: JSON `{results:[{job_id, ok, error, retryable, response}], status:{...}}`.
Reply (lines): `S|epoch|poll`, `P|job|grant|user|pass|profile|rate|shared|remaining|expires|limit_bytes|comment|mac`,
`R|job|grant|user|reason`, `D|job|session`.
Plan end time is stored in the user's comment: `connectly:<grant>:<unix seconds>`.
