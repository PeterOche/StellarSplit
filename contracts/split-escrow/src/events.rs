//! # Events Module for Split Escrow Contract
//!
//! I'm defining all contract events here for off-chain tracking and indexing.
//! These events are crucial for the backend to sync with on-chain state.

use soroban_sdk::{symbol_short, Address, Env, String};
use soroban_sdk::contractevent;

/// Emit when the contract is initialized
///
/// I'm emitting this once during contract setup so indexers
/// know when the contract became operational.
pub fn emit_initialized(env: &Env, admin: &Address) {
    env.events()
        .publish((symbol_short!("init"),), (admin.clone(),));
}

/// Emit when a new split is created
///
/// I'm including the key details so the backend can create
/// a corresponding record without querying the contract.
pub fn emit_split_created(env: &Env, split_id: u64, creator: &Address, total_amount: i128) {
    env.events().publish(
        (symbol_short!("created"),),
        (split_id, creator.clone(), total_amount),
    );
}

/// Emit when a deposit is received
///
/// I'm emitting this for each deposit so the backend can
/// track partial payments and update participant status.
pub fn emit_deposit_received(env: &Env, split_id: u64, participant: &Address, amount: i128) {
    env.events().publish(
        (symbol_short!("deposit"),),
        (split_id, participant.clone(), amount),
    );
}

/// Emit when funds are released to the creator
///
/// I'm including the total amount released for reconciliation
/// with the backend's payment records.
pub fn emit_funds_released(
    env: &Env,
    split_id: u64,
    recipient: &Address,
    amount: i128,
    timestamp: u64,
) {
    env.events().publish(
        (symbol_short!("released"),),
        (split_id, recipient.clone(), amount, timestamp),
    );
}

/// Emit when escrow is completed (fully funded)
pub fn emit_escrow_completed(env: &Env, split_id: u64, total_amount: i128) {
    env.events()
        .publish((symbol_short!("completed"),), (split_id, total_amount));
}

/// Emit when a split is cancelled
///
/// I'm emitting this so the backend can trigger refund processing
/// for any participants who have already deposited.
pub fn emit_split_cancelled(env: &Env, split_id: u64) {
    env.events()
        .publish((symbol_short!("cancel"),), (split_id,));
}

/// Emit when a refund is processed
///
/// I'm tracking each refund individually for audit purposes.
#[allow(dead_code)]
pub fn emit_refund_processed(env: &Env, split_id: u64, participant: &Address, amount: i128) {
    env.events().publish(
        (symbol_short!("refund"),),
        (split_id, participant.clone(), amount),
    );
}

// ============================================
// Insurance Events
// ============================================

/// Emit when an insurance policy is purchased
pub fn emit_insurance_purchased(
    env: &Env,
    insurance_id: &String,
    split_id: &String,
    policy_holder: &Address,
    premium: i128,
    coverage_amount: i128,
) {
    env.events().publish(
        (symbol_short!("ins_purchased"),),
        (
            insurance_id.clone(),
            split_id.clone(),
            policy_holder.clone(),
            premium,
            coverage_amount,
        ),
    );
}

/// Emit when an insurance claim is filed
pub fn emit_claim_filed(
    env: &Env,
    claim_id: &String,
    insurance_id: &String,
    claimant: &Address,
    claim_amount: i128,
) {
    env.events().publish(
        (symbol_short!("claim_filed"),),
        (
            claim_id.clone(),
            insurance_id.clone(),
            claimant.clone(),
            claim_amount,
        ),
    );
}

/// Emit when an insurance claim is processed
pub fn emit_claim_processed(
    env: &Env,
    claim_id: &String,
    insurance_id: &String,
    approved: bool,
    payout_amount: i128,
) {
    env.events().publish(
        (symbol_short!("claim_processed"),),
        (
            claim_id.clone(),
            insurance_id.clone(),
            approved,
            payout_amount,
        ),
    );
}

/// Emit when an insurance payout is made
pub fn emit_payout_made(
    env: &Env,
    claim_id: &String,
    recipient: &Address,
    amount: i128,
) {
    env.events().publish(
        (symbol_short!("payout_made"),),
        (claim_id.clone(), recipient.clone(), amount),
    );
}

#[contractevent]
pub fn escrow_created(split_id: String, creator: Address, total_amount: i128);

#[contractevent]
pub fn payment_received(split_id: String, participant: Address, amount: i128);
