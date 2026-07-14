"use client";

// Buyer review of a completed order (Trust Profile & Reviews). Possession of
// (slug, orderNo) authorizes it — the same discipline as filing a refund.
// Never moves money: it records a rating and recomputes the seller's derived
// trust profile. One review per order; once submitted it renders read-only.

import { useState } from "react";
import { useDict } from "../i18n/LocaleProvider";
import { StatusApiError, submitReview } from "./status-api";

const RATINGS = [1, 2, 3, 4, 5] as const;

/** Row of ★ up to `value`, ☆ beyond — read-only display. */
function Stars({ value }: { value: number }) {
  return (
    <span aria-hidden className="text-blood">
      {RATINGS.map((n) => (n <= value ? "★" : "☆")).join("")}
    </span>
  );
}

export function ReviewForm({
  slug,
  orderNo,
  review,
  canReview,
  onSubmitted,
}: {
  slug: string;
  orderNo: string;
  review: { rating: number; comment: string | null; createdAt: string } | null;
  canReview: boolean;
  onSubmitted: () => void;
}) {
  const d = useDict().status.review;
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already reviewed → show it read-only.
  if (review) {
    return (
      <div className="mt-6 max-w-md border border-hairline px-5 py-4">
        <div className="micro-label text-ash">{d.submittedTitle}</div>
        <p className="mt-2 text-lg" aria-label={d.ratingValue(review.rating)}>
          <Stars value={review.rating} />
        </p>
        {review.comment && (
          <p className="os-body mt-2 max-w-[52ch] text-mist/80">
            “{review.comment}”
          </p>
        )}
      </div>
    );
  }

  if (!canReview) return null;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await submitReview(slug, orderNo, {
        rating,
        comment: comment.trim() || undefined,
      });
      onSubmitted();
    } catch (e) {
      const code = e instanceof StatusApiError ? e.code : "default";
      setError(d.error[code] ?? d.error.default);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-6 max-w-md">
      <div className="micro-label text-ash">{d.title}</div>
      <p className="os-body mt-3 max-w-[52ch] text-mist/80">{d.intro}</p>

      <div className="micro-label mt-6 block text-ash">{d.ratingLabel}</div>
      <div className="mt-2 flex gap-2" role="radiogroup" aria-label={d.ratingLabel}>
        {RATINGS.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={d.ratingValue(n)}
            disabled={submitting}
            onClick={() => setRating(n)}
            className={`os-press text-2xl leading-none ${
              n <= rating ? "text-blood" : "text-bone/25"
            }`}
          >
            {n <= rating ? "★" : "☆"}
          </button>
        ))}
      </div>

      <label className="micro-label mt-5 block text-ash" htmlFor="review-comment">
        {d.commentLabel}
      </label>
      <textarea
        id="review-comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={d.commentPlaceholder}
        maxLength={500}
        rows={4}
        disabled={submitting}
        className="os-body mt-2 w-full border border-hairline bg-void px-3 py-2.5 text-mist placeholder:text-bone/25"
      />

      {error && <p className="os-body mt-4 text-blood">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="mat-illuminated os-press mt-6 px-6 py-3 text-sm font-semibold disabled:opacity-50"
      >
        {submitting ? d.submitting : d.submit}
      </button>
    </div>
  );
}
