"use client";

// Buyer refund request (REFUND-1). Filing never moves money: it freezes the
// release until an admin reviews it, and an approved refund can only return
// to the funding wallet (contract-enforced). Inline expanding panel — no
// wallet interaction needed, so no dialog ceremony.

import { useRef, useState } from "react";
import { useDict } from "../i18n/LocaleProvider";
import {
  requestRefund,
  StatusApiError,
  uploadRefundEvidence,
} from "./status-api";

const REASON_CODES = [
  "not_received",
  "wrong_item",
  "damaged",
  "fake",
  "seller_unresponsive",
  "other",
] as const;

const EVIDENCE_TYPES = [
  "item_photo",
  "unboxing_video",
  "chat_screenshot",
  "shipping_receipt",
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
          className="mat-illuminated os-press px-6 py-3 text-sm font-semibold text-[#f5f2ec] hover:text-[#ff3a12] focus-visible:text-[#ff3a12] disabled:opacity-50"
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

/** Buyer attaches evidence to an OPEN refund. Possession-authorized like the
 * request itself; files go to a private bucket via the backend. Session-local
 * feedback only — the admin is the one who reads the evidence. */
export function RefundEvidence({
  slug,
  orderNo,
}: {
  slug: string;
  orderNo: string;
}) {
  const d = useDict().status.refund.evidence;
  const [file, setFile] = useState<File | null>(null);
  const [evidenceType, setEvidenceType] = useState<string>("item_photo");
  const [uploading, setUploading] = useState(false);
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mirrors the server's MAX_EVIDENCE_BYTES — reject oversized files before
  // uploading megabytes that the backend will refuse anyway.
  const MAX_BYTES = 10 * 1024 * 1024;

  async function submit() {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError(d.error.InvalidInput ?? d.error.default);
      return;
    }
    setUploading(true);
    setError(null);
    setDone(false);
    try {
      await uploadRefundEvidence(slug, orderNo, file, evidenceType);
      setCount((c) => c + 1);
      setDone(true);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      const code = e instanceof StatusApiError ? e.code : "default";
      setError(d.error[code] ?? d.error.default);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-6 max-w-md">
      <div className="micro-label text-ash">{d.title}</div>
      <p className="os-body mt-3 max-w-[52ch] text-mist/80">{d.intro}</p>

      <label
        className="micro-label mt-5 block text-ash"
        htmlFor="evidence-type"
      >
        {d.typeLabel}
      </label>
      <select
        id="evidence-type"
        value={evidenceType}
        onChange={(e) => setEvidenceType(e.target.value)}
        disabled={uploading}
        className="os-body mt-2 w-full border border-hairline bg-void px-3 py-2.5 text-mist"
      >
        {EVIDENCE_TYPES.map((t) => (
          <option key={t} value={t}>
            {d.types[t] ?? t}
          </option>
        ))}
      </select>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,application/pdf"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setDone(false);
          setError(null);
        }}
        disabled={uploading}
        aria-label={d.chooseFile}
        className="os-body mt-4 block w-full text-mist/80 file:mr-4 file:border file:border-hairline file:bg-void file:px-4 file:py-2 file:text-sm file:text-bone"
      />

      {error && <p className="os-body mt-4 text-blood">{error}</p>}
      {done && !error && (
        <p className="os-body mt-4 text-mist/80">
          {d.uploaded}
          {count > 0 && <span className="text-ash"> · {d.attached(count)}</span>}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={uploading || !file}
        className="mat-illuminated os-press mt-6 px-6 py-3 text-sm font-semibold text-[#f5f2ec] hover:text-[#ff3a12] focus-visible:text-[#ff3a12] disabled:opacity-50"
      >
        {uploading ? d.uploading : d.upload}
      </button>
    </div>
  );
}

/** Refund statuses where the buyer can still add evidence (pre-decision). */
export function canAttachEvidence(refundStatus: string): boolean {
  return ["submitted", "under_review", "seller_response_needed"].includes(
    refundStatus,
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
  // Completed = the money came back; a resting state, not an alert. Blood is
  // reserved for states that still need the buyer's attention.
  const tone = status === "completed" ? "text-bone" : "text-blood";
  return (
    <div className="mt-6 max-w-md border border-hairline px-5 py-4">
      <div className={`micro-label ${tone}`}>{title}</div>
      <p className="os-body mt-2 max-w-[52ch] text-mist/80">{body}</p>
    </div>
  );
}
