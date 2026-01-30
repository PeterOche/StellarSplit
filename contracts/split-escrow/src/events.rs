//! # Events Module for Split Escrow Contract
//!
//! I'm defining all contract events here for off-chain tracking and indexing.
//! These events are crucial for the backend to sync with on-chain state.

use soroban_sdk::{symbol_short, Address, Env};

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
