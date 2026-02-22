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

/// Emit when user activity is tracked for rewards
///
/// This event is emitted whenever a user performs an action
/// that contributes to their rewards calculation.
pub fn emit_activity_tracked(env: &Env, user: &Address, activity_type: &str, split_id: u64, amount: i128) {
    env.events()
        .publish(
            (symbol_short!("activity_tracked"),),
            (user.clone(), activity_type, split_id, amount)
        );
}

/// Emit when rewards are calculated for a user
///
/// This event shows the total rewards earned by a user.
pub fn emit_rewards_calculated(env: &Env, user: &Address, total_rewards: i128, available_rewards: i128) {
    env.events()
        .publish(
            (symbol_short!("rewards_calculated"),),
            (user.clone(), total_rewards, available_rewards)
        );
}

/// Emit when rewards are claimed by a user
///
/// This event is emitted when a user successfully claims their rewards.
pub fn emit_rewards_claimed(env: &Env, user: &Address, amount_claimed: i128) {
    env.events()
        .publish(
            (symbol_short!("rewards_claimed"),),
            (user.clone(), amount_claimed)
        );
}

/// Emit when verification is submitted for a split
///
/// This event is emitted when someone submits evidence for split verification.
pub fn emit_verification_submitted(env: &Env, verification_id: &String, split_id: &String, requester: &Address) {
    env.events()
        .publish(
            (symbol_short!("verification_submitted"),),
            (verification_id.clone(), split_id.clone(), requester.clone())
        );
}

/// Emit when verification is completed
///
/// This event is emitted when an oracle processes a verification request.
pub fn emit_verification_completed(env: &Env, verification_id: &String, verified: bool, verifier: &Address) {
    env.events()
        .publish(
            (symbol_short!("verification_completed"),),
            (verification_id.clone(), verified, verifier.clone())
        );
}

/// Emit when verification status changes
///
/// This event tracks status changes in verification requests.
pub fn emit_verification_status_changed(env: &Env, verification_id: &String, old_status: &str, new_status: &str) {
    env.events()
        .publish(
            (symbol_short!("verification_status_changed"),),
            (verification_id.clone(), old_status, new_status)
        );
}

#[contractevent]
pub fn escrow_created(split_id: String, creator: Address, total_amount: i128);

#[contractevent]
pub fn payment_received(split_id: String, participant: Address, amount: i128);
