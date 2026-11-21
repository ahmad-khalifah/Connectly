# Connectly expiry sweeper, version 1. Run by the scheduler "cx-sweep" every
# minute. Works entirely on the router, with no network: ends every customer's
# plan on time even if the backend is unreachable. The plan's end time is the
# last part of each user's comment: connectly:<grant>:<unix seconds>.
#
# Guards: it only acts when NTP says the clock is right, and never on a
# clock before 2023, so a router that has just booted can never end plans early.

:local now ([:tonsec [:timestamp]] / 1000000000)
:if ($now < 1700000000) do={ :return 0 }
:if ([/system ntp client get status] != "synchronized") do={ :return 0 }

:foreach u in=[/ip hotspot user find where comment~"^connectly:"] do={
  :local c [/ip hotspot user get $u comment]
  :local p [:find $c ":" 10]
  :if ([:typeof $p] = "num") do={
    :local exp [:tonum [:pick $c ($p + 1) [:len $c]]]
    :if ([:typeof $exp] = "num") do={
      :if ($exp > 1700000000 && $exp <= $now) do={
        :local nm [/ip hotspot user get $u name]
        :foreach a in=[/ip hotspot active find where user=$nm] do={ /ip hotspot active remove $a }
        /ip hotspot user remove $u
        :log info ("cx-sweep: plan ended, removed " . $nm)
      }
    }
  }
}
