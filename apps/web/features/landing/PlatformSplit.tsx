import { Reveal } from "./Reveal";

/* CHAPTER 06 — PLATFORM. Server component apart from one `Reveal` observer.

   Composition: hard asymmetric split. The code takes seven of twelve columns and
   is the largest object on the page; the prose is a 3-column footnote starting
   at column ten, small enough that it reads as annotation rather than argument.
   Nothing is centred and nothing is boxed.

   The code is a real excerpt of `contracts/escrow/src/lib.rs`, not a mock. It is
   here because it is the only place the second principle ("the buyer never marks
   paid") can be *shown* rather than asserted: the transfer happens before the
   status is written, and every branch above it is a refusal. */

const FUND_ORDER = `// contracts/escrow/src/lib.rs

pub fn fund_order(
    env: Env,
    order_id: BytesN<32>,
    buyer: Address,
    amount: i128,
) -> Result<(), Error> {
    buyer.require_auth();
    ensure_not_paused(&env)?;

    let mut order = read_order(&env, &order_id)?;

    if !matches!(order.status, EscrowStatus::Created) {
        return Err(Error::InvalidStatus);
    }
    if order.buyer != buyer {
        return Err(Error::NotAuthorized);
    }
    if order.amount != amount {
        return Err(Error::AmountMismatch);
    }

    // Move funds first; only mark Funded if the transfer succeeds.
    token::TokenClient::new(&env, &order.asset).transfer(
        &buyer,
        &env.current_contract_address(),
        &order.amount,
    );

    order.status = EscrowStatus::Funded;
    order.funded_at = Some(env.ledger().timestamp());
    write_order(&env, &order);
}`;

/* Every one of these is a branch the deployed contract actually takes. */
const REFUSALS = [
  "double release",
  "double refund",
  "unauthorized release",
  "unauthorized refund",
  "funding the wrong order",
  "funding the wrong amount",
  "release before funded",
  "refund after released",
] as const;

export function PlatformSplit() {
  return (
    <section id="platform" className="scroll-mt-16 py-28 md:py-40">
      <div>
        {/* No heading. The code block starts flush against the same spine the
            Proof rail hung from: the rule simply continues, and the reader is
            still walking down the same line. */}
        {/* A near-zero threshold, so the code has begun resolving out of blur while
            the Proof rail is still the thing on screen. The chapter does not start;
            it is already underway. */}
        <Reveal threshold={0.01} className="grid grid-cols-1 gap-14 md:grid-cols-12 md:gap-8">
          {/* `mat-glass`: the source is printed on a pane, not held in a panel.
              A sheen where the light enters, a scanline pitch under the
              threshold of being read as stripes, and a masked right edge so the
              surface never closes into a card. */}
          <div className="mat-glass md:col-span-7">
            <pre
              className="overflow-x-auto pl-8 font-mono-jb text-[11px] leading-[1.85] text-mist md:pl-12 md:text-[13px]"
              data-rv="blur"
            >
              <code>{FUND_ORDER}</code>
            </pre>
          </div>

          <aside className="md:col-span-3 md:col-start-10" data-rv="rise" style={{ transitionDelay: "200ms" }}>
            <p className="text-[13px] leading-relaxed text-ash md:text-[14px]">
              Escrow lives in a Soroban contract on Stellar. Trustip never marks a payment paid; it reads{" "}
              <span className="font-mono-jb text-mist">get_order</span> and matches buyer, amount, and status against
              the chain before any state changes.
            </p>
          </aside>
        </Reveal>

        {/* Dense refusal list. Two columns of plain monospace lines, no borders,
            no cells: the contract's negative space, printed. */}
        <Reveal className="mt-24 pl-8 md:mt-32 md:pl-12">
          <span className="micro-label font-mono-jb text-ash">The contract refuses</span>
          <ul className="mt-8 grid grid-cols-1 gap-x-16 gap-y-3 sm:grid-cols-2 lg:max-w-4xl">
            {REFUSALS.map((r, i) => (
              <li
                key={r}
                className="flex items-baseline gap-4"
                data-rv="rise"
                style={{ transitionDelay: `${i * 55}ms` }}
              >
                <span aria-hidden className="font-mono-jb text-[13px] text-blood">
                  ×
                </span>
                <span className="font-mono-jb text-[12px] leading-relaxed text-mist md:text-[13px]">{r}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
