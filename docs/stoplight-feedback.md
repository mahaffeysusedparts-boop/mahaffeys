# Stoplight output feedback

The authenticated `/api/stoplight/status` endpoint reads the configured relay device, not the last saved command. Intake desks poll every three seconds; Server Admin polls every five seconds. Reading status never sends ON/OFF commands. Manual changes are reflected on the next successful poll. Concurrent reads share a request and reads are serialized with software commands to avoid observing a partially applied software switch.

Supported device snapshots (channels in settings are one-based):

- Tasmota: `GET /cm?cmnd=Status%200`, `StatusSTS.POWER<n>` (`ON` / `OFF`).
- Shelly Gen 1: `GET /status`, `relays[n-1].ison` (boolean).
- Shelly Gen 2 / Plus: `GET /rpc/Shelly.GetStatus`, `switch:<n-1>.output` (boolean).

Both configured channels must be reported. Missing, invalid or unavailable feedback displays UNKNOWN, not the last requested color or OFF. Both ON displays a conflict warning rather than a proceed instruction. Desk commands do not optimistically illuminate a light. Supported relays are read back after commands, and disagreement with the requested state fails the command. HTTP success alone is not confirmation. Existing server-side Basic authentication is used; device configurations requiring a different authentication protocol must have a matching integration before feedback can work.

Custom HTTP command templates have no defined response/status protocol, so their output remains UNKNOWN. Do not put command URLs into a status integration: reading status must never switch the lamps. Add a device-specific read-only integration once its model and status API are known.

## Manual switch and physical limitations

Readback confirms the **relay-reported output**, not electrical contact health, supply voltage or whether a bulb is actually lit. The manual switch must change the relay's output in its firmware (not only a detached input or a lamp bypass circuit) for that change to appear here. A switch wired around relay contacts, stuck contacts, lost lamp power or a failed bulb requires separate correctly rated output sensing/feedback hardware. Have a qualified installer verify wiring and interlocking; software polling cannot guarantee electrical safety or eliminate races with a physical switch.

After deploying, with the lane clear and an operator present, compare each manual red/green/off position to the desk and Server Admin readouts, including both-output and communication-loss behavior. The automated tests use synthetic device responses and do not verify live hardware or wiring.
