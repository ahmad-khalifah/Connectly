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

## Test status
Tested on the VIRTUAL router (CHR 7.25.1) against STAGING, 22 Nov 2026:
heartbeat, provision (profile, user, comment with expiry), report back,
expiry through the backend revoke, expiry through `cx-sweep` with the agent
switched off (about a minute after the plan ends, the sweeper runs once a
minute), and the backend catching up afterwards. Device auto-login was only
tested as "device not seen" (no real client on the lab router).

Tested on the PHYSICAL L009 against STAGING, 22 Nov 2026: connectivity, dry run,
real additive provision, report back, backend revoke at expiry, offline expiry
by `cx-sweep` with the agent off, and automatic login of a real phone.

PRODUCTION, 22 Nov 2026 (L009 `cx-l009-01`, router "Garki Market main"): migration
applied, Worker deployed, agent enabled, Mac controller stopped. One real paid
purchase was provisioned by the agent within about a minute, the phone had
internet, and the plan was removed and marked `expired` by the agent about
4 seconds after its end time. NOT yet tested on production: the backend being
unreachable (offline expiry was tested on this router against staging only).

Install note: `RouterOS` logs the full text of a changed script, token included.
Install files must be imported without searching the log for `cx-config`; after
an install, clear the log buffer
(`/system logging action set memory memory-lines=1`, then back to `1000`) and
`/file remove` the install file.

RouterOS facts that shaped the scripts: scheduler runs do not share global
variables (results are sent in the same run); empty strings vanish from
arrays (empty fields travel as `-`); there is no `:toupper`.

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
