# FestNet privacy & data-protection notes (C1)

Prototype design decisions — to be reviewed with the supervisors / ethics committee before any
real-world use.

## Data minimisation
* Participants are pseudonymous (`P-XXXXXXXX`); no names, phone numbers or ID numbers are stored.
  App accounts store only a display name and e-mail in `users/{uid}`.
* QR codes contain opaque identifiers only (`FESTNET-DEVICE:`, `FESTNET-PARTICIPANT:`,
  `FESTNET-CLAIM:` one-time code) — never health data or personal details.
* Claim codes are stored only as SHA-256 hashes, expire after 15 minutes, are single-use and are
  revoked when re-issued or when the band is returned.

## Access
* Health data is readable only by staff of the event the band is assigned to and by the linked
  attendee. Device administrators manage hardware and **cannot** read health data.
* Derived history is keyed by assignment, so data from different wearers or events never mixes.
* Every privileged action and every emergency status change is audited (backend-written only).

## Research use
* Only participants with recorded research consent are exported.
* Exports use per-export pseudonyms (R001…), relative time and derived metrics; they contain no
  device IDs, account IDs or GPS.

## Retention (defaults in code)
* Raw signal chunks: 5 minutes. Derived history: 30 days. Configure the public statement per event
  (Event & Devices → Event settings → Data retention).

## Not done yet (known gaps)
* No automated deletion of participants / assignments / emergencies after an event.
* No data-subject access/export tool for attendees.
* No formal DPIA or ethics approval recorded in the repository.
