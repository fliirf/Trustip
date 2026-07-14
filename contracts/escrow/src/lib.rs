#![no_std]
//! Trustip v1.1 — Soroban USDC escrow contract.
//!
//! Holds buyer USDC in escrow until the Trustip operator (admin) releases it to
//! the payout recipient, refunds it to the buyer, or the order is cancelled
//! before funding. The contract is intentionally small: it owns value
//! protection only (lock / release / refund / cancel / pause) and keeps all
//! social-commerce business logic off-chain (Security & Risk Spec v1.1 §7).
//!
//! State machine:
//!   Created --fund_order--> Funded --release_to_recipient--> Released
//!   Created --cancel_order-> Cancelled
//!   Funded  --refund_to_buyer-> Refunded
//!
//! Authorization model:
//!   * `admin` is the configured Trustip operator and the sole release/refund
//!     authority.
//!   * Deployment initializes state atomically through `__constructor`.
//!   * `create_order` requires the stored admin's authorization.
//!   * `fund_order` requires the buyer's authorization.
//!   * `cancel_order` is allowed by the admin or the order's buyer.
//!   * `pause`/`unpause` are admin-only.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, Address, BytesN, Env, Symbol,
};

const LEDGERS_PER_DAY: u32 = 17_280;
const TTL_THRESHOLD: u32 = 7 * LEDGERS_PER_DAY;
const TTL_EXTEND_TO: u32 = 30 * LEDGERS_PER_DAY;

#[derive(Clone)]
#[contracttype]
pub enum EscrowStatus {
    Created,
    Funded,
    Released,
    Refunded,
    Cancelled,
}

#[derive(Clone)]
#[contracttype]
pub struct EscrowOrder {
    pub order_id: BytesN<32>,
    pub buyer: Address,
    pub seller: Address,
    pub payout_recipient: Address,
    pub amount: i128,
    pub asset: Address,
    pub status: EscrowStatus,
    pub created_at: u64,
    pub funded_at: Option<u64>,
    pub released_at: Option<u64>,
    pub refunded_at: Option<u64>,
    pub expires_at: u64,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Paused,
    UsdcToken,
    Order(BytesN<32>),
    PendingAdmin,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAuthorized = 3,
    OrderAlreadyExists = 4,
    OrderNotFound = 5,
    InvalidAmount = 6,
    InvalidParties = 7,
    InvalidStatus = 8,
    Paused = 9,
    Expired = 10,
    AmountMismatch = 11,
    NoPendingAdmin = 12,
    InvalidExpiration = 13,
}

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    /// Configure admin and USDC atomically during deployment. Requiring the
    /// deploy identity to be the initial admin proves control of the address.
    pub fn __constructor(env: Env, admin: Address, usdc_token: Address) {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::UsdcToken, &usdc_token);
        env.storage().instance().set(&DataKey::Paused, &false);
        bump_instance_ttl(&env);
    }

    /// Retained for ABI compatibility. New deployments are initialized by the
    /// constructor, so a later initialize call can never mutate configuration.
    pub fn initialize(env: Env, admin: Address, usdc_token: Address) -> Result<(), Error> {
        let _ = (admin, usdc_token);
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        Err(Error::NotInitialized)
    }

    /// Create an escrow record before funding. Admin-authorized; rejects
    /// duplicate `order_id`. Blocked while paused.
    pub fn create_order(
        env: Env,
        order_id: BytesN<32>,
        buyer: Address,
        seller: Address,
        payout_recipient: Address,
        amount: i128,
        expires_at: u64,
    ) -> Result<(), Error> {
        let admin = read_admin(&env)?;
        admin.require_auth();
        ensure_not_paused(&env)?;

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if buyer == seller {
            return Err(Error::InvalidParties);
        }
        let created_at = env.ledger().timestamp();
        if expires_at <= created_at {
            return Err(Error::InvalidExpiration);
        }
        if env
            .storage()
            .persistent()
            .has(&DataKey::Order(order_id.clone()))
        {
            return Err(Error::OrderAlreadyExists);
        }

        let asset = read_usdc_token(&env)?;
        let order = EscrowOrder {
            order_id: order_id.clone(),
            buyer: buyer.clone(),
            seller: seller.clone(),
            payout_recipient: payout_recipient.clone(),
            amount,
            asset,
            status: EscrowStatus::Created,
            created_at,
            funded_at: None,
            released_at: None,
            refunded_at: None,
            expires_at,
        };
        write_order(&env, &order);

        env.events().publish(
            (event_topic(&env, "escrow_created"), order_id),
            (buyer, seller, payout_recipient, amount),
        );
        Ok(())
    }

    /// Lock the buyer's USDC into the contract. Buyer-authorized. `amount` is
    /// the amount the buyer expects to pay and must equal the stored amount.
    /// Blocked while paused.
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
        if env.ledger().timestamp() >= order.expires_at {
            return Err(Error::Expired);
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

        env.events().publish(
            (event_topic(&env, "escrow_funded"), order_id),
            (buyer, order.amount),
        );
        Ok(())
    }

    /// Release escrowed USDC to the stored payout recipient. Admin-only.
    /// Requires `Funded` status; blocked while paused.
    pub fn release_to_recipient(
        env: Env,
        order_id: BytesN<32>,
        caller: Address,
    ) -> Result<(), Error> {
        caller.require_auth();
        require_admin(&env, &caller)?;
        ensure_not_paused(&env)?;

        let mut order = read_order(&env, &order_id)?;
        if !matches!(order.status, EscrowStatus::Funded) {
            return Err(Error::InvalidStatus);
        }

        token::TokenClient::new(&env, &order.asset).transfer(
            &env.current_contract_address(),
            &order.payout_recipient,
            &order.amount,
        );

        order.status = EscrowStatus::Released;
        order.released_at = Some(env.ledger().timestamp());
        write_order(&env, &order);

        env.events().publish(
            (event_topic(&env, "escrow_released"), order_id),
            (order.payout_recipient.clone(), order.amount),
        );
        Ok(())
    }

    /// Refund escrowed USDC to the buyer after an approved refund decision.
    /// Admin-only. Requires `Funded` status. Permitted while paused so the
    /// operator can resolve incidents during an emergency pause.
    pub fn refund_to_buyer(env: Env, order_id: BytesN<32>, admin: Address) -> Result<(), Error> {
        admin.require_auth();
        require_admin(&env, &admin)?;

        let mut order = read_order(&env, &order_id)?;
        if !matches!(order.status, EscrowStatus::Funded) {
            return Err(Error::InvalidStatus);
        }

        token::TokenClient::new(&env, &order.asset).transfer(
            &env.current_contract_address(),
            &order.buyer,
            &order.amount,
        );

        order.status = EscrowStatus::Refunded;
        order.refunded_at = Some(env.ledger().timestamp());
        write_order(&env, &order);

        env.events().publish(
            (event_topic(&env, "escrow_refunded"), order_id),
            (order.buyer.clone(), order.amount),
        );
        Ok(())
    }

    /// Cancel an unfunded order. Allowed by the admin or the order's buyer.
    /// Requires `Created` status; blocked while paused.
    pub fn cancel_order(env: Env, order_id: BytesN<32>, caller: Address) -> Result<(), Error> {
        caller.require_auth();
        ensure_not_paused(&env)?;

        let mut order = read_order(&env, &order_id)?;
        if !matches!(order.status, EscrowStatus::Created) {
            return Err(Error::InvalidStatus);
        }
        let admin = read_admin(&env)?;
        if caller != admin && caller != order.buyer {
            return Err(Error::NotAuthorized);
        }

        order.status = EscrowStatus::Cancelled;
        write_order(&env, &order);

        env.events()
            .publish((event_topic(&env, "escrow_cancelled"), order_id), ());
        Ok(())
    }

    /// Emergency pause — blocks create/fund/release/cancel. Admin-only.
    pub fn pause_contract(env: Env, admin: Address) -> Result<(), Error> {
        admin.require_auth();
        require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::Paused, &true);
        env.events()
            .publish((event_topic(&env, "contract_paused"),), admin);
        Ok(())
    }

    /// Resume contract operation after a pause. Admin-only.
    pub fn unpause_contract(env: Env, admin: Address) -> Result<(), Error> {
        admin.require_auth();
        require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::Paused, &false);
        env.events()
            .publish((event_topic(&env, "contract_unpaused"),), admin);
        Ok(())
    }

    /// Begin a two-step admin handover. The current admin remains authoritative
    /// until the proposed address explicitly accepts.
    pub fn propose_admin(env: Env, admin: Address, new_admin: Address) -> Result<(), Error> {
        admin.require_auth();
        require_admin(&env, &admin)?;
        if admin == new_admin {
            return Err(Error::InvalidParties);
        }

        env.storage()
            .instance()
            .set(&DataKey::PendingAdmin, &new_admin);
        bump_instance_ttl(&env);
        env.events().publish(
            (event_topic(&env, "admin_rotation_proposed"),),
            (admin, new_admin),
        );
        Ok(())
    }

    /// Complete an admin handover. Only the currently proposed address can
    /// accept, preventing a typo from immediately locking out the old admin.
    pub fn accept_admin(env: Env, new_admin: Address) -> Result<(), Error> {
        new_admin.require_auth();
        let pending: Address = env
            .storage()
            .instance()
            .get(&DataKey::PendingAdmin)
            .ok_or(Error::NoPendingAdmin)?;
        if new_admin != pending {
            return Err(Error::NotAuthorized);
        }

        let previous_admin = read_admin(&env)?;
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        env.storage().instance().remove(&DataKey::PendingAdmin);
        bump_instance_ttl(&env);
        env.events().publish(
            (event_topic(&env, "admin_rotated"),),
            (previous_admin, new_admin),
        );
        Ok(())
    }

    /// Read the current on-chain administrator.
    pub fn get_admin(env: Env) -> Result<Address, Error> {
        read_admin(&env)
    }

    /// Read the configured USDC Stellar Asset Contract address.
    pub fn get_usdc_token(env: Env) -> Result<Address, Error> {
        read_usdc_token(&env)
    }

    /// Read the stored escrow order state.
    pub fn get_order(env: Env, order_id: BytesN<32>) -> Result<EscrowOrder, Error> {
        bump_instance_ttl(&env);
        read_order(&env, &order_id)
    }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

fn event_topic(env: &Env, name: &str) -> Symbol {
    Symbol::new(env, name)
}

fn bump_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn read_admin(env: &Env) -> Result<Address, Error> {
    let admin = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(Error::NotInitialized)?;
    bump_instance_ttl(env);
    Ok(admin)
}

fn read_usdc_token(env: &Env) -> Result<Address, Error> {
    let token = env
        .storage()
        .instance()
        .get(&DataKey::UsdcToken)
        .ok_or(Error::NotInitialized)?;
    bump_instance_ttl(env);
    Ok(token)
}

fn require_admin(env: &Env, who: &Address) -> Result<(), Error> {
    let admin = read_admin(env)?;
    if *who != admin {
        return Err(Error::NotAuthorized);
    }
    Ok(())
}

fn ensure_not_paused(env: &Env) -> Result<(), Error> {
    let paused: bool = env
        .storage()
        .instance()
        .get(&DataKey::Paused)
        .ok_or(Error::NotInitialized)?;
    bump_instance_ttl(env);
    if paused {
        return Err(Error::Paused);
    }
    Ok(())
}

fn read_order(env: &Env, order_id: &BytesN<32>) -> Result<EscrowOrder, Error> {
    let key = DataKey::Order(order_id.clone());
    let order = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(Error::OrderNotFound)?;
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    Ok(order)
}

fn write_order(env: &Env, order: &EscrowOrder) {
    let key = DataKey::Order(order.order_id.clone());
    env.storage().persistent().set(&key, order);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

#[cfg(test)]
mod test;
