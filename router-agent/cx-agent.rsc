# Connectly router agent, version 1.
# Run by the scheduler "cx-agent" every 15 s. Asks the backend for paid access
# to add or end, applies it to the hotspot, and reports what happened.
# Outbound HTTPS only. If the backend is unreachable it does nothing: every
# customer already on the router stays online, and cx-sweep keeps ending
# plans on time on its own.

/system script run cx-config
:global cxUrl
:global cxToken
:global cxDry
:global cxPending
:global cxPendingN
:global cxBusyAt
:global cxTick

:if ([:typeof $cxUrl] != "str" || [:typeof $cxToken] != "str" || [:len $cxToken] < 20) do={
  :log warning "cx-agent: not configured (cx-config)"
  :return 0
}
:if ([:typeof $cxPending] != "str") do={ :set cxPending "" }
:if ([:typeof $cxPendingN] != "num") do={ :set cxPendingN 0 }
:if ([:typeof $cxTick] != "num") do={ :set cxTick 0 }

:local now ([:tonsec [:timestamp]] / 1000000000)

# One run at a time. A run that died leaves its mark for at most 2 minutes.
:if ([:typeof $cxBusyAt] = "num") do={
  :if (($now - $cxBusyAt) < 120 && ($now - $cxBusyAt) >= 0) do={ :return 0 }
}
:set cxBusyAt $now
:set cxTick ($cxTick + 1)

# ---- helpers ------------------------------------------------------------
:local split do={
  :local out [:toarray ""]
  :local rest $s
  :local p [:find $rest $d]
  :while ([:typeof $p] = "num") do={
    :set out ($out, [:pick $rest 0 $p])
    :set rest [:pick $rest ($p + [:len $d]) [:len $rest]]
    :set p [:find $rest $d]
  }
  :set out ($out, $rest)
  :return $out
}

:local report do={
  :global cxPending
  :global cxPendingN
  :local item ("{\"job_id\":\"" . $id . "\",\"ok\":" . $ok . ",\"error\":\"" . $err . "\",\"retryable\":" . $retry . ",\"response\":" . $resp . "}")
  :if ($cxPendingN > 0) do={ :set cxPending ($cxPending . ",") }
  :set cxPending ($cxPending . $item)
  :set cxPendingN ($cxPendingN + 1)
}

:do {
  # ---- build the request ------------------------------------------------
  :local ver [/system resource get version]
  :local sp [:find $ver " "]
  :if ([:typeof $sp] = "num") do={ :set ver [:pick $ver 0 $sp] }
  :local upSec ([:tonsec [/system resource get uptime]] / 1000000000)
  :local cpu [/system resource get cpu-load]
  :local memT [/system resource get total-memory]
  :local memF [/system resource get free-memory]
  :local mem (($memT - $memF) * 100 / $memT)

  # Active sessions for the dashboard, once a minute. Left out when there are
  # too many to send whole (the backend would think the rest had ended).
  :local sessions ""
  :if (($cxTick % 4) = 1) do={
    :local act [/ip hotspot active find]
    :if ([:len $act] <= 190) do={
      :local items ""
      :foreach a in=$act do={
        :local su [/ip hotspot active get $a user]
        :local sm [/ip hotspot active get $a mac-address]
        :local si [/ip hotspot active get $a address]
        :local st ([:tonsec [/ip hotspot active get $a uptime]] / 1000000000)
        :local sbi [/ip hotspot active get $a bytes-in]
        :local sbo [/ip hotspot active get $a bytes-out]
        :if ([:len $items] > 0) do={ :set items ($items . ",") }
        :set items ($items . "{\"id\":\"" . $a . "\",\"user\":\"" . $su . "\",\"mac\":\"" . $sm . "\",\"ip\":\"" . $si . "\",\"uptime\":" . $st . ",\"bytes_in\":" . $sbi . ",\"bytes_out\":" . $sbo . "}")
      }
      :set sessions (",\"sessions\":[" . $items . "]")
    }
  }

  :local body ("{\"results\":[" . $cxPending . "],\"status\":{\"version\":\"" . $ver . "\",\"agent_version\":\"1\",\"uptime_seconds\":" . $upSec . ",\"cpu\":" . $cpu . ",\"memory\":" . $mem . ",\"router_epoch\":" . $now . $sessions . "}}")

  # ---- ask the backend ----------------------------------------------------
  :local resp ""
  :local got false
  :do {
    :local r [/tool fetch url=($cxUrl . "?format=lines") http-method=post \
      http-header-field=("Authorization: Bearer " . $cxToken . ",Content-Type: application/json") \
      http-data=$body output=user as-value check-certificate=yes-without-crl]
    :set resp ($r->"data")
    :set got true
  } on-error={
    :log warning "cx-agent: could not reach the backend (will retry)"
  }

  :if ($got = true) do={
    # The backend has our results: do not send them twice.
    :set cxPending ""
    :set cxPendingN 0

    :foreach line in=[$split s=$resp d="\n"] do={
      :if ([:len $line] > 2) do={
        :local t [:pick $line 0 1]
        :local f [$split s=$line d="|"]

        # S|server_epoch|poll_after_seconds
        :if ($t = "S") do={
          :local want [:tonum ($f->2)]
          :if ([:typeof $want] = "num" && $want >= 5 && $want <= 300) do={
            :local cur [:tonsec [/system scheduler get cx-agent interval]]
            :if (($cur / 1000000000) != $want) do={
              :do { /system scheduler set cx-agent interval=($want . "s") } on-error={}
            }
          }
        }

        # P|job|grant|user|pass|profile|rate|shared|remaining|expires|limit_bytes|comment|mac
        :if ($t = "P") do={
          :local jid ($f->1)
          :local usr ($f->3)
          :local pw ($f->4)
          :local pname ($f->5)
          :local rate ($f->6)
          :local shared ($f->7)
          :local rem ($f->8)
          :local exp ($f->9)
          :local lb ($f->10)
          :local base ($f->11)
          :local mac ($f->12)
          :local cm ($base . ":" . $exp)
          :local step "start"
          :local good false
          :local auto "none"
          :if ($cxDry = true) do={
            :log info ("cx-agent DRY RUN: would add " . $usr . " " . $pname . " " . $rem . "s")
            [$report id=$jid ok=false err="dry run" retry=false resp="{}"]
          } else={
            :do {
              :set step "profile"
              :local pid [/ip hotspot user profile find where name=$pname]
              :if ([:len $pid] = 0) do={
                /ip hotspot user profile add name=$pname rate-limit=$rate shared-users=$shared
              } else={
                /ip hotspot user profile set $pid rate-limit=$rate shared-users=$shared
              }
              :set step "user"
              :local uid [/ip hotspot user find where name=$usr]
              :local lu ($rem . "s")
              :if ([:len $uid] = 0) do={
                :set uid [/ip hotspot user add name=$usr password=$pw profile=$pname limit-uptime=$lu comment=$cm]
              } else={
                :local ec [/ip hotspot user get $uid comment]
                :local bl [:len $base]
                :if ([:len $ec] > 0 && ([:len $ec] < $bl || [:pick $ec 0 $bl] != $base)) do={
                  :error "user exists for something else"
                }
                /ip hotspot user set $uid password=$pw profile=$pname limit-uptime=$lu comment=$cm
              }
              :if ([:len $lb] > 0) do={ /ip hotspot user set $uid limit-bytes-total=$lb }
              :set good true
            } on-error={
              :log warning ("cx-agent: provision failed at " . $step)
            }
            :if ($good = true) do={
              # Log the paying device in, best effort: the code is already
              # on the router, so a miss here never fails the job.
              :do {
                :set step "login"
                :if ([:len $mac] > 0) do={
                  :local mu [:toupper $mac]
                  :if ([:len [/ip hotspot active find where mac-address=$mu]] > 0) do={
                    :set auto "already_online"
                  } else={
                    :local h [/ip hotspot host find where mac-address=$mu]
                    :if ([:len $h] = 0) do={
                      :set auto "device_not_seen"
                    } else={
                      :local hip [/ip hotspot host get ($h->0) address]
                      /ip hotspot active login user=$usr password=$pw mac-address=$mu ip=$hip
                      :set auto "logged_in"
                    }
                  }
                } else={ :set auto "no_device" }
              } on-error={ :set auto "failed" }
              [$report id=$jid ok=true err="" retry=true resp=("{\"username\":\"" . $usr . "\",\"auto_login\":{\"status\":\"" . $auto . "\"}}")]
              :log info ("cx-agent: provisioned " . $usr . " login=" . $auto)
            } else={
              [$report id=$jid ok=false err=("failed at " . $step) retry=true resp="{}"]
            }
          }
        }

        # R|job|grant|user|reason
        :if ($t = "R") do={
          :local jid ($f->1)
          :local base ("connectly:" . ($f->2))
          :local usr ($f->3)
          :local good false
          :local removed false
          :local nsess 0
          :if ($cxDry = true) do={
            :log info ("cx-agent DRY RUN: would remove " . $usr)
            [$report id=$jid ok=false err="dry run" retry=false resp="{}"]
          } else={
            :do {
              :if ([:len $usr] > 0) do={
                :foreach a in=[/ip hotspot active find where user=$usr] do={
                  /ip hotspot active remove $a
                  :set nsess ($nsess + 1)
                }
                :local uid [/ip hotspot user find where name=$usr]
                :if ([:len $uid] > 0) do={
                  :local ec [/ip hotspot user get $uid comment]
                  :local bl [:len $base]
                  :if ([:len $ec] = 0 || ([:len $ec] >= $bl && [:pick $ec 0 $bl] = $base)) do={
                    /ip hotspot user remove $uid
                    :set removed true
                  }
                }
              }
              :set good true
            } on-error={ :log warning "cx-agent: revoke failed" }
            :if ($good = true) do={
              [$report id=$jid ok=true err="" retry=true resp=("{\"removed_user\":" . $removed . ",\"removed_sessions\":" . $nsess . "}")]
              :log info ("cx-agent: ended " . $usr)
            } else={
              [$report id=$jid ok=false err="revoke failed" retry=true resp="{}"]
            }
          }
        }

        # D|job|router_session_id
        :if ($t = "D") do={
          :local jid ($f->1)
          :local sid ($f->2)
          :local good false
          :do {
            :foreach a in=[/ip hotspot active find where .id=$sid] do={ /ip hotspot active remove $a }
            :set good true
          } on-error={}
          :if ($good = true) do={
            [$report id=$jid ok=true err="" retry=true resp="{}"]
          } else={
            [$report id=$jid ok=false err="disconnect failed" retry=true resp="{}"]
          }
        }
      }
    }
  }
} on-error={
  :log error "cx-agent: unexpected error"
}
:set cxBusyAt
