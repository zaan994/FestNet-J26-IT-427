import { useEffect, useState } from "react";

import { Badge } from "@/components/common/Badges";
import { CommandFeedback, Notice } from "@/components/common/States";
import { usePermissions } from "@/hooks/useAuth";
import { useCommand } from "@/hooks/useCommand";
import { useEventContext } from "@/hooks/useEventContext";
import { useEventPublic } from "@/hooks/useEventData";
import { useRealtimeValue } from "@/hooks/useRealtimeValue";
import type { EventRole, EventStatus } from "@/types";
import { paths } from "@shared/paths";

function CreateEvent() {
  const cmd = useCommand<{ eventId: string }>("createEvent");
  const { setSelectedEventId } = useEventContext();
  const [name, setName] = useState("");
  const [venue, setVenue] = useState("");
  const [demo, setDemo] = useState(false);
  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-bold">Create event</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="eyebrow">Name</span>
          <input className="input mt-1" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="eyebrow">Venue</span>
          <input className="input mt-1" maxLength={120} value={venue} onChange={(e) => setVenue(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} /> DEMO ONLY event
        </label>
        <button
          type="button"
          className="btn-primary"
          disabled={!name.trim() || cmd.pending}
          onClick={() =>
            void cmd.run({ name: name.trim(), demo, ...(venue.trim() ? { venue: venue.trim() } : {}) }).then((r) => {
              if (r) {
                setName("");
                setSelectedEventId(r.eventId);
              }
            })
          }
        >
          Create
        </button>
      </div>
      <p className="text-xs text-muted">You become the event operator of the new event.</p>
      <CommandFeedback pending={cmd.pending} error={cmd.error} success={cmd.result ? `Event ${cmd.result.eventId} created` : null} />
    </section>
  );
}

function StaffManager({ eventId }: { eventId: string }) {
  const staff = useRealtimeValue<Record<string, EventRole>>(paths.eventStaff(eventId));
  const cmd = useCommand("setEventStaff");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<EventRole>("medicalResponder");
  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-bold">Event staff</h2>
      <ul className="divide-y divide-line text-sm">
        {Object.entries(staff.data ?? {}).map(([uid, r]) => (
          <li key={uid} className="flex items-center gap-3 py-2">
            <span className="font-mono text-xs">{uid}</span>
            <Badge tone={r === "eventOperator" ? "brand" : "normal"}>{r}</Badge>
            <button
              type="button"
              className="btn-ghost btn-sm ml-auto"
              disabled={cmd.pending}
              onClick={() => window.confirm("Remove this person's role for this event?") && void cmd.run({ eventId, targetUid: uid, role: "none" })}
            >
              Remove
            </button>
          </li>
        ))}
        {!Object.keys(staff.data ?? {}).length && <li className="py-2 text-muted">No staff.</li>}
      </ul>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="eyebrow">Staff e-mail</span>
          <input className="input mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value.trim())} />
        </label>
        <label className="text-sm">
          <span className="eyebrow">Role</span>
          <select className="input mt-1" value={role} onChange={(e) => setRole(e.target.value as EventRole)}>
            <option value="medicalResponder">Medical responder</option>
            <option value="eventOperator">Event operator</option>
          </select>
        </label>
        <button type="button" className="btn-primary" disabled={!email || cmd.pending} onClick={() => void cmd.run({ eventId, email, role }).then((r) => r && setEmail(""))}>
          Grant role
        </button>
      </div>
      <p className="text-xs text-muted">The person must have signed in once (dashboard or app) so their account exists.</p>
      <CommandFeedback pending={cmd.pending} error={cmd.error} success={cmd.result ? "Staff updated" : null} />
    </section>
  );
}

function EventDetails({ eventId }: { eventId: string }) {
  const { selectedEvent } = useEventContext();
  const { isDeviceAdmin } = usePermissions();
  const pub = useEventPublic(eventId);
  const cmd = useCommand("updateEvent");
  const [status, setStatus] = useState<EventStatus>(selectedEvent?.status ?? "planned");
  const [helpPoints, setHelpPoints] = useState("");
  const [safety, setSafety] = useState("");
  const [contact, setContact] = useState("");
  const [privacyContact, setPrivacyContact] = useState("");
  const [retention, setRetention] = useState("");

  useEffect(() => setStatus(selectedEvent?.status ?? "planned"), [selectedEvent?.status]);
  useEffect(() => {
    const p = pub.data;
    setHelpPoints(Object.values(p?.helpPoints ?? {}).map((h) => [h.name, h.description ?? "", h.zone ?? ""].join(" | ")).join("\n"));
    setSafety((p?.safetyInfo ?? []).join("\n"));
    setContact(p?.contact ?? "");
    setPrivacyContact(p?.privacyContact ?? "");
    setRetention(p?.dataRetention ?? "");
  }, [pub.data]);

  const save = () => {
    const hp = helpPoints
      .split("\n")
      .map((l) => l.split("|").map((s) => s.trim()))
      .filter(([n]) => n)
      .map(([name, description, zone]) => ({ name, ...(description ? { description } : {}), ...(zone ? { zone } : {}) }));
    void cmd.run({
      eventId,
      status,
      helpPoints: hp,
      safetyInfo: safety.split("\n").map((s) => s.trim()).filter(Boolean),
      ...(contact.trim() ? { contact: contact.trim() } : {}),
      ...(privacyContact.trim() ? { privacyContact: privacyContact.trim() } : {}),
      ...(retention.trim() ? { dataRetention: retention.trim() } : {}),
    });
  };

  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-bold">Event status &amp; attendee information</h2>
      <p className="text-sm text-muted">Everything below except the status is shown to attendees in the app (eventsPublic). Never put health data here.</p>
      <label className="block max-w-xs text-sm">
        <span className="eyebrow">Status</span>
        <select className="input mt-1" value={status} onChange={(e) => setStatus(e.target.value as EventStatus)}>
          <option value="planned">Planned</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
        </select>
        {selectedEvent?.status === "closed" && !isDeviceAdmin && <span className="text-xs text-muted">Only a device administrator can reopen a closed event.</span>}
      </label>
      <label className="block text-sm">
        <span className="eyebrow">Help points — one per line: name | description | zone</span>
        <textarea className="input mt-1 h-24 font-mono text-xs" value={helpPoints} onChange={(e) => setHelpPoints(e.target.value)} />
      </label>
      <label className="block text-sm">
        <span className="eyebrow">Safety information — one item per line</span>
        <textarea className="input mt-1 h-24" value={safety} onChange={(e) => setSafety(e.target.value)} />
      </label>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm">
          <span className="eyebrow">Emergency contact</span>
          <input className="input mt-1" maxLength={300} value={contact} onChange={(e) => setContact(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="eyebrow">Privacy contact</span>
          <input className="input mt-1" maxLength={300} value={privacyContact} onChange={(e) => setPrivacyContact(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="eyebrow">Data retention statement</span>
          <input className="input mt-1" maxLength={300} value={retention} onChange={(e) => setRetention(e.target.value)} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary" disabled={cmd.pending} onClick={save}>
          Save
        </button>
        <CommandFeedback pending={cmd.pending} error={cmd.error} success={cmd.result ? "Saved" : null} />
      </div>
    </section>
  );
}

export function EventSettingsPanel({ eventId }: { eventId: string | null }) {
  const { isDeviceAdmin, isOperator } = usePermissions(eventId);
  return (
    <div className="space-y-5">
      {isDeviceAdmin && <CreateEvent />}
      {eventId && (isOperator || isDeviceAdmin) ? (
        <>
          <EventDetails eventId={eventId} />
          <StaffManager eventId={eventId} />
        </>
      ) : (
        !isDeviceAdmin && <Notice>Event settings are managed by event operators and device administrators.</Notice>
      )}
    </div>
  );
}
