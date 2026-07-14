"use client";

// Seller trust profile (Trust Profile & Reviews). Read-only. Every metric is
// backend-derived (recompute_trust_profile) — this page never computes a score
// or level itself, it renders what the service returns.

import { useCallback, useEffect, useState } from "react";
import type { Dict } from "../../lib/i18n/dictionaries";
import { useDict } from "../i18n/LocaleProvider";
import { EmptyState, ErrorState, ProtocolState } from "../ui/ErrorState";
import { sellerErrorLabel } from "./labels";
import { getSellerTrust, SellerApiError, type SellerTrust } from "./seller-api";
import { SellerShell } from "./SellerShell";
import { useSellerSession } from "./useSellerSession";

function describeError(d: Dict, e: unknown): { code: string; message: string } {
  if (e instanceof SellerApiError) {
    return { code: e.code, message: sellerErrorLabel(d, e.code, e.message) };
  }
  return {
    code: "InternalError",
    message: sellerErrorLabel(d, "InternalError", ""),
  };
}

function Stars({ value }: { value: number }) {
  return (
    <span aria-hidden className="text-blood">
      {[1, 2, 3, 4, 5].map((n) => (n <= value ? "★" : "☆")).join("")}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="micro-label text-ash">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-bone">
        {value}
      </div>
    </div>
  );
}

export function SellerTrustPage() {
  const d = useDict();
  const t = d.seller.trust;
  const session = useSellerSession();
  const token = session.accessToken;

  const [trust, setTrust] = useState<SellerTrust | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(
    null,
  );

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      setTrust(await getSellerTrust(token));
      setError(null);
    } catch (e) {
      setError(describeError(d, e));
    }
  }, [token, d]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (session.loading) {
    return (
      <SellerShell active="trust">
        <div className="max-w-md">
          <ProtocolState surface="seller" label={d.seller.checkingSession} />
        </div>
      </SellerShell>
    );
  }

  if (!session.session) {
    return (
      <SellerShell active="trust">
        <EmptyState
          surface="seller"
          title={d.seller.needLogin.title}
          detail={t.needLoginDetail}
          action={{ label: d.seller.needLogin.cta, href: "/seller/login" }}
        />
      </SellerShell>
    );
  }

  const p = trust?.profile;
  return (
    <SellerShell
      active="trust"
      onSignOut={() => void session.signOut()}
      email={session.email}
    >
      <div className="engraved-b flex flex-wrap items-end justify-between gap-4 pb-5">
        <div>
          <h1 className="os-title text-bone">{t.heading}</h1>
          <p className="mt-3 max-w-[52ch] os-body text-mist/80">{t.subtitle}</p>
        </div>
        {p && (
          <div className="desk-stamp micro-label px-3 py-1.5 text-bone">
            {t.levels[p.level] ?? p.level}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-6 max-w-3xl">
          <ErrorState
            surface="seller"
            detail={error.message}
            action={
              error.code === "Forbidden" || error.code === "SellerNotReady"
                ? { label: t.signInAgain, href: "/seller/login" }
                : { label: t.reload, onClick: () => void refresh() }
            }
          />
        </div>
      )}

      {!trust && !error && (
        <div className="max-w-md pt-10">
          <ProtocolState surface="seller" label={t.loading} />
        </div>
      )}

      {p && (
        <div className="pt-10 pb-16">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label={t.trustScore} value={p.trustScore} />
            <Stat label={t.completed} value={String(p.completedOrders)} />
            <Stat label={t.refunded} value={String(p.refundedOrders)} />
            <Stat label={t.refundRate} value={`${p.refundRate}%`} />
            <Stat label={t.reviews} value={String(p.totalReviews)} />
            <Stat
              label={t.avgRating}
              value={p.totalReviews > 0 ? p.averageRating : "—"}
            />
          </div>

          <div className="mt-14">
            <div className="micro-label text-ash">{t.reviewsTitle}</div>
            {trust.reviews.length === 0 ? (
              <p className="mt-3 os-body text-mist/60">{t.noReviews}</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {trust.reviews.map((r, i) => (
                  <li key={i} className="max-w-2xl border border-hairline px-5 py-4">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-lg">
                        <Stars value={r.rating} />
                      </span>
                      <span className="micro-label text-ash">
                        {new Date(r.createdAt).toLocaleDateString("id-ID")}
                      </span>
                    </div>
                    {r.comment && (
                      <p className="os-body mt-2 max-w-[60ch] text-mist/80">
                        “{r.comment}”
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {trust.events.length > 0 && (
            <div className="mt-14">
              <div className="micro-label text-ash">{t.historyTitle}</div>
              <ul className="mt-4 max-w-2xl divide-y divide-hairline">
                {trust.events.map((e, i) => (
                  <li
                    key={i}
                    className="flex items-baseline justify-between gap-4 py-2.5"
                  >
                    <span className="os-body text-mist">
                      {t.events[e.eventType] ?? e.eventType}
                    </span>
                    <span className="flex items-baseline gap-4">
                      <span className="micro-label tabular-nums text-ash">
                        {Number(e.scoreDelta) >= 0 ? "+" : ""}
                        {e.scoreDelta}
                      </span>
                      <span className="micro-label text-ash">
                        {new Date(e.createdAt).toLocaleDateString("id-ID")}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </SellerShell>
  );
}
