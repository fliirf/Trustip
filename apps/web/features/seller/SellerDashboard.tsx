"use client";

// Seller dashboard shell: backend-backed onboarding checklist + entry to the
// link surface.
//
// PHASE 14 — OPERATIONS DESK grammar. The checklist is an inspection list, not
// a bordered table: ruled rows, a stamped verdict per line, nothing boxed.

import Link from "next/link";
import { useEffect, useState } from "react";
import { EscrowCore } from "../escrow/EscrowCore";
import { useDict } from "../i18n/LocaleProvider";
import { EmptyState, ErrorState, ProtocolState } from "../ui/ErrorState";
import { InspectionList } from "./InspectionList";
import { SellerShell } from "./SellerShell";
import { STEP_KEYS, sellerErrorLabel } from "./labels";
import {
  getOnboarding,
  SellerApiError,
  type SellerOnboardingStatus,
} from "./seller-api";
import { useSellerSession } from "./useSellerSession";

export function SellerDashboard() {
  const d = useDict();
  const t = d.seller.dashboard;
  const session = useSellerSession();
  const [status, setStatus] = useState<SellerOnboardingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session.accessToken) return;
    getOnboarding(session.accessToken).then(setStatus, (e) =>
      setError(
        e instanceof SellerApiError
          ? sellerErrorLabel(d, e.code, e.message)
          : sellerErrorLabel(d, "InternalError", ""),
      ),
    );
  }, [session.accessToken]);

  if (session.loading) {
    return (
      <SellerShell active="dashboard">
        <div className="max-w-md">
          <ProtocolState surface="seller" label={d.seller.checkingSession} />
        </div>
      </SellerShell>
    );
  }

  if (!session.session) {
    return (
      <SellerShell active="dashboard">
        <EmptyState
          surface="seller"
          title={d.seller.needLogin.title}
          detail={t.needLoginDetail}
          action={{ label: d.seller.needLogin.cta, href: "/seller/login" }}
        />
      </SellerShell>
    );
  }

  const wallets = status?.wallets ?? [];
  const done = {
    profile: status?.profile !== null && status !== null,
    connect: wallets.length > 0,
    register: wallets.length > 0,
    verify: wallets.some((w) => w.verifiedAt !== null),
    primary: wallets.some((w) => w.isPrimary && w.verifiedAt !== null),
  };

  return (
    <SellerShell
      active="dashboard"
      onSignOut={() => void session.signOut()}
      email={session.email}
    >
      <div className="engraved-b flex flex-wrap items-end justify-between gap-4 pb-5">
        <div>
          <h1 className="os-title text-bone">
            {status?.profile?.storeName ?? t.storeNameFallback}
          </h1>
          <p className="os-body mt-3 max-w-[52ch] text-mist/80">
            {status?.checkoutReady ? t.readySubtitle : t.notReadySubtitle}
          </p>
        </div>
        <div className="micro-label text-ash tabular-nums">
          {Object.values(done).filter(Boolean).length} / {STEP_KEYS.length} {t.stepsSuffix}
        </div>
      </div>

      {error && (
        <div className="mt-6 max-w-3xl">
          <ErrorState surface="seller" detail={error} />
        </div>
      )}

      <div className="grid gap-12 pt-10 pb-16 lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-20">
        <div className="min-w-0 max-w-lg">
          <div className="micro-label text-ash">{t.checklistLabel}</div>
          <div className="mt-5">
            <InspectionList done={done} />
          </div>

          {!status?.checkoutReady && (
            <Link
              href="/seller/onboarding"
              className="mat-illuminated os-press mt-8 inline-block px-5 py-2.5 text-sm font-semibold tracking-tight text-void hover:text-bone"
            >
              {t.continueOnboarding}
            </Link>
          )}

          <div className="mt-14">
            <div className="micro-label text-ash">{t.linksHeading}</div>
            <p className="os-body mt-3 max-w-[46ch] text-mist/70">{t.linksBody}</p>
            <Link
              href="/seller/links"
              className="desk-stamp os-press micro-label mt-5 inline-block px-4 py-2 text-bone hover:text-blood"
            >
              {t.manageLinks}
            </Link>
          </div>
        </div>

        {/* The seal, read from the desk. Same artifact as everywhere else; the
            decorative `EscrowMark` it replaces was a second, near-identical
            drawing of the same object.

            Always `dormant`. There is no escrow on this page — a finished
            checklist means the store CAN receive protected funds, not that it
            holds any. Lighting the lock here would be the artifact running ahead
            of backend truth, which is the one thing it must never do. */}
        <aside className="hidden justify-center lg:flex">
          <EscrowCore state="dormant" context="seal" className="h-44 w-44" />
        </aside>
      </div>
    </SellerShell>
  );
}
