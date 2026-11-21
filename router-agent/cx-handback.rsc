# Hands the router back to the Mac controller: stops both schedulers and
# rewrites user comments from connectly:<grant>:<expires> to the
# connectly:<grant> form the controller expects. Run it BEFORE setting the
# router's agent_enabled flag to false.
/system scheduler disable [find where name="cx-agent" or name="cx-sweep"]
:foreach u in=[/ip hotspot user find where comment~"^connectly:"] do={
  :local c [/ip hotspot user get $u comment]
  :local p [:find $c ":" 10]
  :if ([:typeof $p] = "num") do={ /ip hotspot user set $u comment=[:pick $c 0 $p] }
}
:log info "cx: handed back to the controller"
