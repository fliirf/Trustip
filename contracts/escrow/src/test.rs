#![cfg(test)]

use super::{Error, EscrowContract, EscrowContractClient, EscrowStatus};
use soroban_sdk::testutils::{Address as _, AuthorizedFunction, Events as _, Ledger as _};
use soroban_sdk::token::{StellarAssetClient, TokenClient};
use soroban_sdk::{Address, BytesN, Env, Symbol, TryIntoVal};

const AMOUNT: i128 = 1_000;
const EXPIRES_AT: u64 = 100_000;

struct Setup {
    env: Env,
    contract_id: Address,
    admin: Address,
    buyer: Address,
    seller: Address,
    recipient: Address,
    token: Address,
}

impl Setup {
    fn client(&self) -> EscrowContractClient<'_> {
        EscrowContractClient::new(&self.env, &self.contract_id)
    }

    fn token(&self) -> TokenClient<'_> {
        TokenClient::new(&self.env, &self.token)
    }

    fn mint(&self, to: &Address, amount: i128) {
        StellarAssetClient::new(&self.env, &self.token).mint(to, &amount);
    }
}

/// Build an env with a registered SAC token and an *initialized* escrow contract.
fn setup() -> Setup {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let recipient = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(token_admin);
    let token = sac.address();

    let contract_id = env.register_contract(None, EscrowContract);
    let s = Setup {
        env,
        contract_id,
        admin,
        buyer,
        seller,
        recipient,
        token,
    };
    s.client().initialize(&s.admin, &s.token);
    s
}

fn oid(env: &Env, n: u8) -> BytesN<32> {
    BytesN::from_array(env, &[n; 32])
}

/// Create a `Created` order with the standard parties/amount.
fn create_default(s: &Setup, id: &BytesN<32>) {
    s.client()
        .create_order(id, &s.buyer, &s.seller, &s.recipient, &AMOUNT, &EXPIRES_AT);
}

// --------------------------------------------------------------------------
// initialize
// --------------------------------------------------------------------------
#[test]
fn initialize_succeeds() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = env
        .register_stellar_asset_contract_v2(token_admin)
        .address();
    let contract_id = env.register_contract(None, EscrowContract);
    let client = EscrowContractClient::new(&env, &contract_id);

    // Succeeds and enables admin-authorized actions (proven via create_order).
    client.initialize(&admin, &token);
    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let recipient = Address::generate(&env);
    client.create_order(
        &oid(&env, 1),
        &buyer,
        &seller,
        &recipient,
        &AMOUNT,
        &EXPIRES_AT,
    );
    assert!(matches!(
        client.get_order(&oid(&env, 1)).status,
        EscrowStatus::Created
    ));
}

#[test]
fn double_initialize_fails() {
    let s = setup();
    assert_eq!(
        s.client().try_initialize(&s.admin, &s.token),
        Err(Ok(Error::AlreadyInitialized))
    );
}

// --------------------------------------------------------------------------
// create_order
// --------------------------------------------------------------------------
#[test]
fn create_order_succeeds() {
    let s = setup();
    create_default(&s, &oid(&s.env, 1));
    let order = s.client().get_order(&oid(&s.env, 1));
    assert_eq!(order.amount, AMOUNT);
    assert_eq!(order.buyer, s.buyer);
    assert_eq!(order.payout_recipient, s.recipient);
    assert!(matches!(order.status, EscrowStatus::Created));
}

#[test]
fn duplicate_order_fails() {
    let s = setup();
    let id = oid(&s.env, 1);
    create_default(&s, &id);
    assert_eq!(
        s.client()
            .try_create_order(&id, &s.buyer, &s.seller, &s.recipient, &AMOUNT, &EXPIRES_AT),
        Err(Ok(Error::OrderAlreadyExists))
    );
}

#[test]
fn create_order_zero_amount_fails() {
    let s = setup();
    assert_eq!(
        s.client().try_create_order(
            &oid(&s.env, 1),
            &s.buyer,
            &s.seller,
            &s.recipient,
            &0,
            &EXPIRES_AT
        ),
        Err(Ok(Error::InvalidAmount))
    );
}

#[test]
fn create_order_same_buyer_seller_fails() {
    let s = setup();
    assert_eq!(
        s.client().try_create_order(
            &oid(&s.env, 1),
            &s.buyer,
            &s.buyer,
            &s.recipient,
            &AMOUNT,
            &EXPIRES_AT
        ),
        Err(Ok(Error::InvalidParties))
    );
}

// --------------------------------------------------------------------------
// fund_order
// --------------------------------------------------------------------------
#[test]
fn fund_order_succeeds() {
    let s = setup();
    let id = oid(&s.env, 1);
    create_default(&s, &id);
    s.mint(&s.buyer, AMOUNT);

    s.client().fund_order(&id, &s.buyer, &AMOUNT);

    assert!(matches!(
        s.client().get_order(&id).status,
        EscrowStatus::Funded
    ));
    assert_eq!(s.token().balance(&s.buyer), 0);
    assert_eq!(s.token().balance(&s.contract_id), AMOUNT);
}

#[test]
fn fund_wrong_amount_fails() {
    let s = setup();
    let id = oid(&s.env, 1);
    create_default(&s, &id);
    s.mint(&s.buyer, AMOUNT);
    assert_eq!(
        s.client().try_fund_order(&id, &s.buyer, &(AMOUNT - 1)),
        Err(Ok(Error::AmountMismatch))
    );
}

#[test]
fn fund_nonexistent_order_fails() {
    let s = setup();
    assert_eq!(
        s.client()
            .try_fund_order(&oid(&s.env, 9), &s.buyer, &AMOUNT),
        Err(Ok(Error::OrderNotFound))
    );
}

#[test]
fn double_fund_fails() {
    let s = setup();
    let id = oid(&s.env, 1);
    create_default(&s, &id);
    s.mint(&s.buyer, AMOUNT * 2);
    s.client().fund_order(&id, &s.buyer, &AMOUNT);
    assert_eq!(
        s.client().try_fund_order(&id, &s.buyer, &AMOUNT),
        Err(Ok(Error::InvalidStatus))
    );
}

// --------------------------------------------------------------------------
// release_to_recipient
// --------------------------------------------------------------------------
#[test]
fn release_succeeds() {
    let s = setup();
    let id = oid(&s.env, 1);
    create_default(&s, &id);
    s.mint(&s.buyer, AMOUNT);
    s.client().fund_order(&id, &s.buyer, &AMOUNT);

    s.client().release_to_recipient(&id, &s.admin);

    assert!(matches!(
        s.client().get_order(&id).status,
        EscrowStatus::Released
    ));
    assert_eq!(s.token().balance(&s.recipient), AMOUNT);
    assert_eq!(s.token().balance(&s.contract_id), 0);
}

#[test]
fn release_before_funded_fails() {
    let s = setup();
    let id = oid(&s.env, 1);
    create_default(&s, &id);
    assert_eq!(
        s.client().try_release_to_recipient(&id, &s.admin),
        Err(Ok(Error::InvalidStatus))
    );
}

#[test]
fn double_release_fails() {
    let s = setup();
    let id = oid(&s.env, 1);
    create_default(&s, &id);
    s.mint(&s.buyer, AMOUNT);
    s.client().fund_order(&id, &s.buyer, &AMOUNT);
    s.client().release_to_recipient(&id, &s.admin);
    assert_eq!(
        s.client().try_release_to_recipient(&id, &s.admin),
        Err(Ok(Error::InvalidStatus))
    );
}

#[test]
fn unauthorized_release_fails() {
    let s = setup();
    let id = oid(&s.env, 1);
    create_default(&s, &id);
    s.mint(&s.buyer, AMOUNT);
    s.client().fund_order(&id, &s.buyer, &AMOUNT);
    // seller is not the admin/release authority.
    assert_eq!(
        s.client().try_release_to_recipient(&id, &s.seller),
        Err(Ok(Error::NotAuthorized))
    );
}

// --------------------------------------------------------------------------
// refund_to_buyer
// --------------------------------------------------------------------------
#[test]
fn refund_succeeds() {
    let s = setup();
    let id = oid(&s.env, 1);
    create_default(&s, &id);
    s.mint(&s.buyer, AMOUNT);
    s.client().fund_order(&id, &s.buyer, &AMOUNT);

    s.client().refund_to_buyer(&id, &s.admin);

    assert!(matches!(
        s.client().get_order(&id).status,
        EscrowStatus::Refunded
    ));
    assert_eq!(s.token().balance(&s.buyer), AMOUNT);
    assert_eq!(s.token().balance(&s.contract_id), 0);
}

#[test]
fn refund_before_funded_fails() {
    let s = setup();
    let id = oid(&s.env, 1);
    create_default(&s, &id);
    assert_eq!(
        s.client().try_refund_to_buyer(&id, &s.admin),
        Err(Ok(Error::InvalidStatus))
    );
}

#[test]
fn double_refund_fails() {
    let s = setup();
    let id = oid(&s.env, 1);
    create_default(&s, &id);
    s.mint(&s.buyer, AMOUNT);
    s.client().fund_order(&id, &s.buyer, &AMOUNT);
    s.client().refund_to_buyer(&id, &s.admin);
    assert_eq!(
        s.client().try_refund_to_buyer(&id, &s.admin),
        Err(Ok(Error::InvalidStatus))
    );
}

#[test]
fn unauthorized_refund_fails() {
    let s = setup();
    let id = oid(&s.env, 1);
    create_default(&s, &id);
    s.mint(&s.buyer, AMOUNT);
    s.client().fund_order(&id, &s.buyer, &AMOUNT);
    assert_eq!(
        s.client().try_refund_to_buyer(&id, &s.buyer),
        Err(Ok(Error::NotAuthorized))
    );
}

#[test]
fn release_after_refund_fails() {
    let s = setup();
    let id = oid(&s.env, 1);
    create_default(&s, &id);
    s.mint(&s.buyer, AMOUNT);
    s.client().fund_order(&id, &s.buyer, &AMOUNT);
    s.client().refund_to_buyer(&id, &s.admin);
    assert_eq!(
        s.client().try_release_to_recipient(&id, &s.admin),
        Err(Ok(Error::InvalidStatus))
    );
}

// --------------------------------------------------------------------------
// cancel_order
// --------------------------------------------------------------------------
#[test]
fn cancel_before_funded_succeeds() {
    let s = setup();
    let id = oid(&s.env, 1);
    create_default(&s, &id);
    s.client().cancel_order(&id, &s.buyer);
    assert!(matches!(
        s.client().get_order(&id).status,
        EscrowStatus::Cancelled
    ));
}

#[test]
fn cancel_after_funded_fails() {
    let s = setup();
    let id = oid(&s.env, 1);
    create_default(&s, &id);
    s.mint(&s.buyer, AMOUNT);
    s.client().fund_order(&id, &s.buyer, &AMOUNT);
    assert_eq!(
        s.client().try_cancel_order(&id, &s.buyer),
        Err(Ok(Error::InvalidStatus))
    );
}

// --------------------------------------------------------------------------
// pause / unpause
// --------------------------------------------------------------------------
#[test]
fn pause_blocks_protected_actions() {
    let s = setup();
    let created = oid(&s.env, 1);
    let funded = oid(&s.env, 2);
    create_default(&s, &created);
    create_default(&s, &funded);
    s.mint(&s.buyer, AMOUNT);
    s.client().fund_order(&funded, &s.buyer, &AMOUNT);

    s.client().pause_contract(&s.admin);

    // create / fund / release / cancel are blocked while paused.
    assert_eq!(
        s.client().try_create_order(
            &oid(&s.env, 3),
            &s.buyer,
            &s.seller,
            &s.recipient,
            &AMOUNT,
            &EXPIRES_AT
        ),
        Err(Ok(Error::Paused))
    );
    assert_eq!(
        s.client().try_fund_order(&created, &s.buyer, &AMOUNT),
        Err(Ok(Error::Paused))
    );
    assert_eq!(
        s.client().try_release_to_recipient(&funded, &s.admin),
        Err(Ok(Error::Paused))
    );
    assert_eq!(
        s.client().try_cancel_order(&created, &s.buyer),
        Err(Ok(Error::Paused))
    );

    // Refund remains available during pause (admin emergency path).
    s.client().refund_to_buyer(&funded, &s.admin);
    assert_eq!(s.token().balance(&s.buyer), AMOUNT);
}

#[test]
fn unpause_restores_actions() {
    let s = setup();
    s.client().pause_contract(&s.admin);
    s.client().unpause_contract(&s.admin);

    let id = oid(&s.env, 1);
    create_default(&s, &id);
    s.mint(&s.buyer, AMOUNT);
    s.client().fund_order(&id, &s.buyer, &AMOUNT);
    s.client().release_to_recipient(&id, &s.admin);
    assert!(matches!(
        s.client().get_order(&id).status,
        EscrowStatus::Released
    ));
    assert_eq!(s.token().balance(&s.recipient), AMOUNT);
}

#[test]
fn pause_unpause_admin_only() {
    let s = setup();
    assert_eq!(
        s.client().try_pause_contract(&s.buyer),
        Err(Ok(Error::NotAuthorized))
    );
}

// ==========================================================================
// Phase 2.6 — auth enforcement, expiry, NotInitialized, events
// ==========================================================================

/// Assert that `expected_addr` was required to authorize a contract call to
/// `expected_fn` during the most recent invocation. Proves `require_auth` is
/// actually invoked with the expected address (not merely an equality check).
fn assert_authorized(env: &Env, expected_addr: &Address, expected_fn: &str) {
    let auths = env.auths();
    let found = auths.iter().any(|(addr, invocation)| {
        addr == expected_addr
            && matches!(
                &invocation.function,
                AuthorizedFunction::Contract((_contract, fname, _args))
                    if *fname == Symbol::new(env, expected_fn)
            )
    });
    assert!(
        found,
        "expected address to authorize `{}`; recorded auths: {:?}",
        expected_fn, auths
    );
}

// --------------------------------------------------------------------------
// Auth enforcement — positive: the expected signer's require_auth is invoked
// --------------------------------------------------------------------------
#[test]
fn create_order_requires_admin_auth() {
    let s = setup();
    create_default(&s, &oid(&s.env, 1));
    assert_authorized(&s.env, &s.admin, "create_order");
}

#[test]
fn fund_order_requires_buyer_auth() {
    let s = setup();
    let id = oid(&s.env, 1);
    create_default(&s, &id);
    s.mint(&s.buyer, AMOUNT);
    s.client().fund_order(&id, &s.buyer, &AMOUNT);
    assert_authorized(&s.env, &s.buyer, "fund_order");
}

#[test]
fn release_requires_admin_auth() {
    let s = setup();
    let id = oid(&s.env, 1);
    create_default(&s, &id);
    s.mint(&s.buyer, AMOUNT);
    s.client().fund_order(&id, &s.buyer, &AMOUNT);
    s.client().release_to_recipient(&id, &s.admin);
    assert_authorized(&s.env, &s.admin, "release_to_recipient");
}

#[test]
fn refund_requires_admin_auth() {
    let s = setup();
    let id = oid(&s.env, 1);
    create_default(&s, &id);
    s.mint(&s.buyer, AMOUNT);
    s.client().fund_order(&id, &s.buyer, &AMOUNT);
    s.client().refund_to_buyer(&id, &s.admin);
    assert_authorized(&s.env, &s.admin, "refund_to_buyer");
}

#[test]
fn pause_requires_admin_auth() {
    let s = setup();
    s.client().pause_contract(&s.admin);
    assert_authorized(&s.env, &s.admin, "pause_contract");
}

#[test]
fn unpause_requires_admin_auth() {
    let s = setup();
    s.client().pause_contract(&s.admin);
    s.client().unpause_contract(&s.admin);
    assert_authorized(&s.env, &s.admin, "unpause_contract");
}

// --------------------------------------------------------------------------
// Auth enforcement — negative: without the required signature the call fails.
// `mock_auths(&[])` provides no authorizations, so `require_auth` must reject.
// --------------------------------------------------------------------------
#[test]
fn create_order_rejected_without_signature() {
    let s = setup();
    s.env.mock_auths(&[]);
    let res = s.client().try_create_order(
        &oid(&s.env, 1),
        &s.buyer,
        &s.seller,
        &s.recipient,
        &AMOUNT,
        &EXPIRES_AT,
    );
    assert!(
        res.is_err(),
        "create_order must require the admin signature"
    );
}

#[test]
fn fund_order_rejected_without_signature() {
    let s = setup();
    let id = oid(&s.env, 1);
    create_default(&s, &id);
    s.mint(&s.buyer, AMOUNT);
    s.env.mock_auths(&[]);
    let res = s.client().try_fund_order(&id, &s.buyer, &AMOUNT);
    assert!(res.is_err(), "fund_order must require the buyer signature");
}

#[test]
fn release_rejected_without_signature() {
    let s = setup();
    let id = oid(&s.env, 1);
    create_default(&s, &id);
    s.mint(&s.buyer, AMOUNT);
    s.client().fund_order(&id, &s.buyer, &AMOUNT);
    s.env.mock_auths(&[]);
    let res = s.client().try_release_to_recipient(&id, &s.admin);
    assert!(res.is_err(), "release must require the admin signature");
}

// --------------------------------------------------------------------------
// Expiration
// --------------------------------------------------------------------------
#[test]
fn fund_after_expiry_fails() {
    let s = setup();
    let id = oid(&s.env, 1);
    create_default(&s, &id); // expires_at = EXPIRES_AT
    s.mint(&s.buyer, AMOUNT);
    s.env.ledger().with_mut(|li| li.timestamp = EXPIRES_AT + 1);
    assert_eq!(
        s.client().try_fund_order(&id, &s.buyer, &AMOUNT),
        Err(Ok(Error::Expired))
    );
}

// --------------------------------------------------------------------------
// Wrong buyer (authorized, but not the stored buyer)
// --------------------------------------------------------------------------
#[test]
fn fund_with_wrong_buyer_fails() {
    let s = setup();
    let id = oid(&s.env, 1);
    create_default(&s, &id); // stored buyer = s.buyer
    let other = Address::generate(&s.env);
    s.mint(&other, AMOUNT);
    // mock_all_auths (from setup) authorizes `other`, but the contract rejects
    // because the stored buyer differs.
    assert_eq!(
        s.client().try_fund_order(&id, &other, &AMOUNT),
        Err(Ok(Error::NotAuthorized))
    );
}

// --------------------------------------------------------------------------
// NotInitialized — methods that read admin before acting
// --------------------------------------------------------------------------
fn uninitialized() -> (Env, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, EscrowContract);
    (env, contract_id)
}

#[test]
fn create_order_before_initialize_fails() {
    let (env, contract_id) = uninitialized();
    let client = EscrowContractClient::new(&env, &contract_id);
    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let recipient = Address::generate(&env);
    assert_eq!(
        client.try_create_order(
            &oid(&env, 1),
            &buyer,
            &seller,
            &recipient,
            &AMOUNT,
            &EXPIRES_AT
        ),
        Err(Ok(Error::NotInitialized))
    );
}

#[test]
fn pause_before_initialize_fails() {
    let (env, contract_id) = uninitialized();
    let client = EscrowContractClient::new(&env, &contract_id);
    let someone = Address::generate(&env);
    assert_eq!(
        client.try_pause_contract(&someone),
        Err(Ok(Error::NotInitialized))
    );
}

// --------------------------------------------------------------------------
// Cancel coverage
// --------------------------------------------------------------------------
#[test]
fn admin_cancel_before_funded_succeeds() {
    let s = setup();
    let id = oid(&s.env, 1);
    create_default(&s, &id);
    s.client().cancel_order(&id, &s.admin);
    assert!(matches!(
        s.client().get_order(&id).status,
        EscrowStatus::Cancelled
    ));
}

#[test]
fn unauthorized_cancel_fails() {
    let s = setup();
    let id = oid(&s.env, 1);
    create_default(&s, &id);
    let third_party = Address::generate(&s.env);
    assert_eq!(
        s.client().try_cancel_order(&id, &third_party),
        Err(Ok(Error::NotAuthorized))
    );
}

// --------------------------------------------------------------------------
// get_order on an unknown id
// --------------------------------------------------------------------------
#[test]
fn get_unknown_order_fails() {
    let s = setup();
    // EscrowOrder has no Debug/PartialEq, so match the error rather than assert_eq!.
    assert!(matches!(
        s.client().try_get_order(&oid(&s.env, 42)),
        Err(Ok(Error::OrderNotFound))
    ));
}

// --------------------------------------------------------------------------
// Event assertions — names stay `escrow_*`, with order_id topic + payload.
// --------------------------------------------------------------------------
#[test]
fn escrow_funded_event_is_emitted() {
    let s = setup();
    let id = oid(&s.env, 1);
    create_default(&s, &id);
    s.mint(&s.buyer, AMOUNT);
    s.client().fund_order(&id, &s.buyer, &AMOUNT);

    let all = s.env.events().all();
    let (cid, topics, data) = all.get(all.len() - 1).unwrap();
    assert_eq!(cid, s.contract_id);

    let name: Symbol = topics.get(0).unwrap().try_into_val(&s.env).unwrap();
    assert_eq!(name, Symbol::new(&s.env, "escrow_funded"));
    let topic_order_id: BytesN<32> = topics.get(1).unwrap().try_into_val(&s.env).unwrap();
    assert_eq!(topic_order_id, id);

    let (ev_buyer, ev_amount): (Address, i128) = data.try_into_val(&s.env).unwrap();
    assert_eq!(ev_buyer, s.buyer);
    assert_eq!(ev_amount, AMOUNT);
}

#[test]
fn escrow_released_event_is_emitted() {
    let s = setup();
    let id = oid(&s.env, 1);
    create_default(&s, &id);
    s.mint(&s.buyer, AMOUNT);
    s.client().fund_order(&id, &s.buyer, &AMOUNT);
    s.client().release_to_recipient(&id, &s.admin);

    let all = s.env.events().all();
    let (cid, topics, data) = all.get(all.len() - 1).unwrap();
    assert_eq!(cid, s.contract_id);

    let name: Symbol = topics.get(0).unwrap().try_into_val(&s.env).unwrap();
    assert_eq!(name, Symbol::new(&s.env, "escrow_released"));
    let topic_order_id: BytesN<32> = topics.get(1).unwrap().try_into_val(&s.env).unwrap();
    assert_eq!(topic_order_id, id);

    let (ev_recipient, ev_amount): (Address, i128) = data.try_into_val(&s.env).unwrap();
    assert_eq!(ev_recipient, s.recipient);
    assert_eq!(ev_amount, AMOUNT);
}
