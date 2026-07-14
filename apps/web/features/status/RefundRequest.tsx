"use client";

// Buyer refund request (REFUND-1). Filing never moves money: it freezes the
// release until an admin reviews it, and an approved refund can only return
// to the funding wallet (contract-enforced). Inline expanding panel — no
// wallet interaction needed, so no dialog ceremony.

import { useState } from "react";
import { useDict } from "../i18n/LocaleProvider";
import { requestRefund, StatusApiError } from "./status-api";

const REASON_CODES = [
  "not_received",
  "wrong_item",
  "damaged",
  "fake",
  "seller_unresponsive",
  "other",
] as const;

export function RefundRequest({
  slug,
  orderNo,
  onSubmitted,
}: {
  slug: string;
  orderNo: string;
  onSubmitted: () => void;
}) {
  const d = useDict().status.refund;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("not_received");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await requestRefund(slug, orderNo, {
        reasonCode: reason,
        description: description.trim() || undefined,
      });
      setOpen(false);
      onSubmitted();
    } catch (e) {
      const code = e instanceof StatusApiError ? e.code : "default";
      setError(d.error[code] ?? d.error.default);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="micro-label os-press mt-6 inline-block text-ash underline underline-offset-4 hover:text-mist"
      >
        {d.helpCta}
      </button>
    );
  }

  return (
    <div className="mt-6 max-w-md">
      <div className="micro-label text-ash">{d.dialogEyebrow}</div>
      <p className="os-body mt-3 max-w-[52ch] text-mist/80">{d.intro}</p>

      <label className="micro-label mt-6 block text-ash" htmlFor="refund-reason">
        {d.reasonLabel}
      </label>
      <select
        id="refund-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={submitting}
        className="os-body mt-2 w-full border border-hairline bg-void px-3 py-2.5 text-mist"
      >
        {REASON_CODES.map((code) => (
          <option key={code} value={code}>
            {d.reasons[code] ?? code}
          </option>
        ))}
      </select>

      <label
        className="micro-label mt-5 block text-ash"
        htmlFor="refund-description"
      >
        {d.descriptionLabel}
      </label>
      <textarea
        id="refund-description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={d.descriptionPlaceholder}
        maxLength={2000}
        rows={4}
        disabled={submitting}
        className="os-body mt-2 w-full border border-hairline bg-void px-3 py-2.5 text-mist placeholder:text-bone/25"
      />

      {error && <p className="os-body mt-4 text-blood">{error}</p>}

      <div className="mt-6 flex items-center gap-6">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="mat-illuminated os-press px-6 py-3 text-sm font-semibold disabled:opacity-50"
        >
          {submitting ? d.submitting : d.submit}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={submitting}
          className="micro-label os-press text-ash hover:text-mist"
        >
          {d.cancel}
        </button>
      </div>
    </div>
  );
}

/** Read-only refund state banner, rendered strictly from backend state. */
export function RefundBanner({
  status,
}: {
  status: string;
}) {
  const d = useDict().status.refund;
  const [title, body] =
    status === "approved"
      ? [d.approvedTitle, d.approvedBody]
      : status === "rejected"
        ? [d.rejectedTitle, d.rejectedBody]
        : status === "completed"
          ? [d.completedTitle, d.completedBody]
          : [d.openTitle, d.openBody];
  return (
    <div className="mt-6 max-w-md border border-hairline px-5 py-4">
      <div className="micro-label text-blood">{title}</div>
      <p className="os-body mt-2 max-w-[52ch] text-mist/80">{body}</p>
    </div>
  );
}
