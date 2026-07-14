export const MARKETING_CONSENT_POLICY_VERSION = "email-marketing-v1-2026-07";

export type CommunicationRecordType = "order" | "reservation";

export type CommunicationEventType =
  | "order.received"
  | "order.confirmed"
  | "order.ready"
  | "order.out_for_delivery"
  | "order.delivered"
  | "order.cancelled"
  | "order.refunded"
  | "order.payment_failed"
  | "reservation.request_received"
  | "reservation.confirmed"
  | "reservation.rescheduled"
  | "reservation.reminder"
  | "reservation.declined"
  | "reservation.cancelled";

type QueueRecordCommunicationInput = {
  recordType: CommunicationRecordType;
  recordId: string;
  eventType: CommunicationEventType;
};

/**
 * Browser snapshot writes are not a trusted communications boundary. Keep the
 * call sites explicit for migration, but queue only from authenticated/server-
 * owned order and reservation commands. Provider-verified payment actions
 * already use the internal outbox entry point directly.
 */
export async function queueRecordCommunication(input: QueueRecordCommunicationInput) {
  const recordId = String(input.recordId || "").trim();
  return {
    ok: false,
    skipped: true,
    reason: recordId ? "trusted_server_command_required" : "record_id_missing"
  } as const;
}
