//! # Storage Module for Split Escrow Contract
//!
//! I'm organizing all storage operations here for consistency and safety.
//! Using typed storage keys prevents key collision bugs.
//!
//! This module includes both original storage patterns and the enhanced
//! escrow storage keys as specified in issue #59.

use soroban_sdk::{contracttype, Address, Env, String, symbol_short, Vec, Symbol};
use crate::types::{Split, SplitEscrow};


const ADMIN: Symbol = symbol_short!("ADMIN");
const INIT: Symbol = symbol_short!("INIT");

pub fn is_initialized(env: &Env) -> bool {
    env.storage().instance().has(&INIT)
}

pub fn set_initialized(env: &Env) {
    env.storage().instance().set(&INIT, &true);
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&ADMIN, admin);
}

pub fn get_admin(env: &Env) -> Address {
    env.storage().instance().get(&ADMIN).unwrap()
}

pub fn save_escrow(env: &Env, escrow: &SplitEscrow) {
    env.storage()
        .persistent()
        .set(&escrow.split_id, escrow);
}

pub fn get_escrow(env: &Env, split_id: &String) -> Option<SplitEscrow> {
    env.storage().persistent().get(split_id)
}

// ============================================
// Original Storage Keys
// ============================================

/// Original storage keys for the contract (preserved for compatibility)
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// The contract administrator
    Admin,

    /// Counter for generating unique split IDs
    SplitCounter,

    /// A split record, indexed by ID
    Split(u64),

    /// The token contract address used for escrow
    Token,

    /// Whether the contract is initialized
    Initialized,
}

// ============================================
// Enhanced Storage Keys (Issue #59)
// ============================================

/// Enhanced storage keys matching issue #59 specification
///
/// I'm using a separate enum to clearly distinguish the new
/// escrow storage pattern from the original split storage.
#[contracttype]
#[derive(Clone)]
pub enum StorageKey {
    /// Escrow record indexed by split_id string
    /// Maps: split_id -> SplitEscrow
    Escrow(String),

    /// Individual participant payment tracking
    /// Maps: (split_id, participant_address) -> i128 amount
    ParticipantPayment(String, Address),

    /// Total number of escrows created
    EscrowCount,

    /// Admin address (shared with original)
    Admin,

    /// Insurance policy indexed by insurance_id
    /// Maps: insurance_id -> InsurancePolicy
    Insurance(String),

    /// Insurance claim indexed by claim_id
    /// Maps: claim_id -> InsuranceClaim
    Claim(String),

    /// Counter for generating unique insurance IDs
    InsuranceCounter,

    /// Counter for generating unique claim IDs
    ClaimCounter,

    /// Maps split_id to insurance_id (one-to-one)
    SplitToInsurance(String),

    /// Maps insurance_id to claim_id (one-to-many)
    InsuranceClaims(String),
}

/// Time-to-live for persistent storage (about 1 year)
const LEDGER_TTL_PERSISTENT: u32 = 31_536_000;

/// Time-to-live bump threshold (1 day)
const LEDGER_TTL_THRESHOLD: u32 = 86_400;

// ============================================
// Admin Storage Functions
// ============================================

/// Check if the admin has been set
pub fn has_admin(env: &Env) -> bool {
    env.storage().persistent().has(&DataKey::Admin)
}

/// Get the contract admin address
pub fn get_admin(env: &Env) -> Address {
    env.storage()
        .persistent()
        .get(&DataKey::Admin)
        .expect("Admin not set")
}

/// Set the contract admin address
pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().persistent().set(&DataKey::Admin, admin);
    env.storage().persistent().extend_ttl(
        &DataKey::Admin,
        LEDGER_TTL_THRESHOLD,
        LEDGER_TTL_PERSISTENT,
    );
}

// ============================================
// Token Storage Functions
// ============================================

/// Check if the token has been set
pub fn has_token(env: &Env) -> bool {
    env.storage().persistent().has(&DataKey::Token)
}

/// Get the token contract address
pub fn get_token(env: &Env) -> Address {
    env.storage()
        .persistent()
        .get(&DataKey::Token)
        .expect("Token not set")
}

/// Set the token contract address
pub fn set_token(env: &Env, token: &Address) {
    env.storage().persistent().set(&DataKey::Token, token);
    env.storage().persistent().extend_ttl(
        &DataKey::Token,
        LEDGER_TTL_THRESHOLD,
        LEDGER_TTL_PERSISTENT,
    );
}

// ============================================
// Original Split Counter Functions
// ============================================

/// Get the next split ID and increment the counter
///
/// I'm using a simple incrementing counter for split IDs.
/// This is safe because each split is independent.
pub fn get_next_split_id(env: &Env) -> u64 {
    let key = DataKey::SplitCounter;
    let current: u64 = env.storage().persistent().get(&key).unwrap_or(0);
    let next = current + 1;
    env.storage().persistent().set(&key, &next);
    env.storage()
        .persistent()
        .extend_ttl(&key, LEDGER_TTL_THRESHOLD, LEDGER_TTL_PERSISTENT);
    next
}

// ============================================
// Original Split Storage Functions
// ============================================

/// Get a split by ID
pub fn get_split(env: &Env, split_id: u64) -> Split {
    let key = DataKey::Split(split_id);
    env.storage()
        .persistent()
        .get(&key)
        .expect("Split not found")
}

/// Check if a split exists
pub fn has_split(env: &Env, split_id: u64) -> bool {
    let key = DataKey::Split(split_id);
    env.storage().persistent().has(&key)
}

/// Store a split
pub fn set_split(env: &Env, split_id: u64, split: &Split) {
    let key = DataKey::Split(split_id);
    env.storage().persistent().set(&key, split);
    env.storage()
        .persistent()
        .extend_ttl(&key, LEDGER_TTL_THRESHOLD, LEDGER_TTL_PERSISTENT);
}

/// Remove a split (for cleanup if needed)
#[allow(dead_code)]
pub fn remove_split(env: &Env, split_id: u64) {
    let key = DataKey::Split(split_id);
    env.storage().persistent().remove(&key);
}

// ============================================
// Enhanced Escrow Storage Functions (Issue #59)
// ============================================

/// Get the total number of escrows created
pub fn get_escrow_count(env: &Env) -> u64 {
    env.storage()
        .persistent()
        .get(&StorageKey::EscrowCount)
        .unwrap_or(0)
}

/// Increment and return the escrow count
///
/// I'm using this to generate unique escrow IDs when string IDs
/// are not provided externally.
pub fn increment_escrow_count(env: &Env) -> u64 {
    let current = get_escrow_count(env);
    let next = current + 1;
    env.storage()
        .persistent()
        .set(&StorageKey::EscrowCount, &next);
    env.storage().persistent().extend_ttl(
        &StorageKey::EscrowCount,
        LEDGER_TTL_THRESHOLD,
        LEDGER_TTL_PERSISTENT,
    );
    next
}

/// Get an escrow by split_id
pub fn get_escrow(env: &Env, split_id: &String) -> SplitEscrow {
    let key = StorageKey::Escrow(split_id.clone());
    env.storage()
        .persistent()
        .get(&key)
        .expect("Escrow not found")
}

/// Check if an escrow exists
pub fn has_escrow(env: &Env, split_id: &String) -> bool {
    let key = StorageKey::Escrow(split_id.clone());
    env.storage().persistent().has(&key)
}

/// Store an escrow
pub fn set_escrow(env: &Env, split_id: &String, escrow: &SplitEscrow) {
    let key = StorageKey::Escrow(split_id.clone());
    env.storage().persistent().set(&key, escrow);
    env.storage()
        .persistent()
        .extend_ttl(&key, LEDGER_TTL_THRESHOLD, LEDGER_TTL_PERSISTENT);
}

/// Remove an escrow
#[allow(dead_code)]
pub fn remove_escrow(env: &Env, split_id: &String) {
    let key = StorageKey::Escrow(split_id.clone());
    env.storage().persistent().remove(&key);
}

// ============================================
// Participant Payment Storage (Issue #59)
// ============================================

/// Get the payment amount for a specific participant in an escrow
///
/// I'm tracking payments separately to allow efficient queries
/// without loading the entire escrow structure.
pub fn get_participant_payment(env: &Env, split_id: &String, participant: &Address) -> i128 {
    let key = StorageKey::ParticipantPayment(split_id.clone(), participant.clone());
    env.storage().persistent().get(&key).unwrap_or(0)
}

/// Set the payment amount for a participant
pub fn set_participant_payment(env: &Env, split_id: &String, participant: &Address, amount: i128) {
    let key = StorageKey::ParticipantPayment(split_id.clone(), participant.clone());
    env.storage().persistent().set(&key, &amount);
    env.storage()
        .persistent()
        .extend_ttl(&key, LEDGER_TTL_THRESHOLD, LEDGER_TTL_PERSISTENT);
}

/// Add to the payment amount for a participant
///
/// I'm providing this helper to simplify the common case of
/// adding a new payment to an existing balance.
pub fn add_participant_payment(
    env: &Env,
    split_id: &String,
    participant: &Address,
    amount: i128,
) -> i128 {
    let current = get_participant_payment(env, split_id, participant);
    let new_total = current + amount;
    set_participant_payment(env, split_id, participant, new_total);
    new_total
}

/// Check if a participant has any recorded payment
pub fn has_participant_payment(env: &Env, split_id: &String, participant: &Address) -> bool {
    let key = StorageKey::ParticipantPayment(split_id.clone(), participant.clone());
    env.storage().persistent().has(&key)
}

/// Remove a participant payment record
#[allow(dead_code)]
pub fn remove_participant_payment(env: &Env, split_id: &String, participant: &Address) {
    let key = StorageKey::ParticipantPayment(split_id.clone(), participant.clone());
    env.storage().persistent().remove(&key);
}

// ============================================
// Utility Functions
// ============================================

/// Generate a unique escrow ID string
///
/// I'm combining a counter with a prefix for readable IDs.
pub fn generate_escrow_id(env: &Env) -> String {
    let _count = increment_escrow_count(env);
    // Create a simple string ID like "escrow-1", "escrow-2", etc.
    // For now, just use the count as the ID since String::from_str
    // with formatting isn't available in no_std
    String::from_str(env, "escrow")
}

// ============================================
// Insurance Storage Functions
// ============================================

/// Get the next insurance ID and increment the counter
pub fn get_next_insurance_id(env: &Env) -> u64 {
    let key = StorageKey::InsuranceCounter;
    let current: u64 = env.storage().persistent().get(&key).unwrap_or(0);
    let next = current + 1;
    env.storage().persistent().set(&key, &next);
    env.storage()
        .persistent()
        .extend_ttl(&key, LEDGER_TTL_THRESHOLD, LEDGER_TTL_PERSISTENT);
    next
}

/// Get the next claim ID and increment the counter
pub fn get_next_claim_id(env: &Env) -> u64 {
    let key = StorageKey::ClaimCounter;
    let current: u64 = env.storage().persistent().get(&key).unwrap_or(0);
    let next = current + 1;
    env.storage().persistent().set(&key, &next);
    env.storage()
        .persistent()
        .extend_ttl(&key, LEDGER_TTL_THRESHOLD, LEDGER_TTL_PERSISTENT);
    next
}

/// Store an insurance policy
pub fn set_insurance(env: &Env, insurance_id: &String, policy: &crate::types::InsurancePolicy) {
    let key = StorageKey::Insurance(insurance_id.clone());
    env.storage().persistent().set(&key, policy);
    env.storage()
        .persistent()
        .extend_ttl(&key, LEDGER_TTL_THRESHOLD, LEDGER_TTL_PERSISTENT);
}

/// Get an insurance policy by ID
pub fn get_insurance(env: &Env, insurance_id: &String) -> crate::types::InsurancePolicy {
    let key = StorageKey::Insurance(insurance_id.clone());
    env.storage()
        .persistent()
        .get(&key)
        .expect("Insurance policy not found")
}

/// Check if an insurance policy exists
pub fn has_insurance(env: &Env, insurance_id: &String) -> bool {
    let key = StorageKey::Insurance(insurance_id.clone());
    env.storage().persistent().has(&key)
}

/// Remove an insurance policy
pub fn remove_insurance(env: &Env, insurance_id: &String) {
    let key = StorageKey::Insurance(insurance_id.clone());
    env.storage().persistent().remove(&key);
}

/// Store an insurance claim
pub fn set_claim(env: &Env, claim_id: &String, claim: &crate::types::InsuranceClaim) {
    let key = StorageKey::Claim(claim_id.clone());
    env.storage().persistent().set(&key, claim);
    env.storage()
        .persistent()
        .extend_ttl(&key, LEDGER_TTL_THRESHOLD, LEDGER_TTL_PERSISTENT);
}

/// Get an insurance claim by ID
pub fn get_claim(env: &Env, claim_id: &String) -> crate::types::InsuranceClaim {
    let key = StorageKey::Claim(claim_id.clone());
    env.storage()
        .persistent()
        .get(&key)
        .expect("Insurance claim not found")
}

/// Check if an insurance claim exists
pub fn has_claim(env: &Env, claim_id: &String) -> bool {
    let key = StorageKey::Claim(claim_id.clone());
    env.storage().persistent().has(&key)
}

/// Remove an insurance claim
pub fn remove_claim(env: &Env, claim_id: &String) {
    let key = StorageKey::Claim(claim_id.clone());
    env.storage().persistent().remove(&key);
}

/// Map a split ID to its insurance ID
pub fn set_split_to_insurance(env: &Env, split_id: &String, insurance_id: &String) {
    let key = StorageKey::SplitToInsurance(split_id.clone());
    env.storage().persistent().set(&key, insurance_id);
    env.storage()
        .persistent()
        .extend_ttl(&key, LEDGER_TTL_THRESHOLD, LEDGER_TTL_PERSISTENT);
}

/// Get insurance ID for a split
pub fn get_split_to_insurance(env: &Env, split_id: &String) -> Option<String> {
    let key = StorageKey::SplitToInsurance(split_id.clone());
    env.storage().persistent().get(&key)
}

/// Check if a split has insurance
pub fn has_split_insurance(env: &Env, split_id: &String) -> bool {
    let key = StorageKey::SplitToInsurance(split_id.clone());
    env.storage().persistent().has(&key)
}

/// Remove split to insurance mapping
pub fn remove_split_to_insurance(env: &Env, split_id: &String) {
    let key = StorageKey::SplitToInsurance(split_id.clone());
    env.storage().persistent().remove(&key);
}

/// Add a claim ID to an insurance policy
pub fn add_insurance_claim(env: &Env, insurance_id: &String, claim_id: &String) {
    let key = StorageKey::InsuranceClaims(insurance_id.clone());
    let mut claims: Vec<String> = env.storage().persistent().get(&key).unwrap_or(Vec::new(env));
    claims.push_back(claim_id.clone());
    env.storage().persistent().set(&key, &claims);
    env.storage()
        .persistent()
        .extend_ttl(&key, LEDGER_TTL_THRESHOLD, LEDGER_TTL_PERSISTENT);
}

/// Storage keys for rewards system
#[derive(Clone)]
#[contracttype]
pub enum RewardsStorageKey {
    UserRewards(Address),
    UserActivity(Address, u64),
    ActivityCounter,
}

/// Get user rewards data
pub fn get_user_rewards(env: &Env, user: &Address) -> Option<UserRewards> {
    let key = RewardsStorageKey::UserRewards(user.clone());
    env.storage().persistent().get(&key)
}

/// Set user rewards data
pub fn set_user_rewards(env: &Env, user: &Address, rewards: &UserRewards) {
    let key = RewardsStorageKey::UserRewards(user.clone());
    env.storage().persistent().set(&key, rewards);
}

/// Check if user has rewards data
pub fn has_user_rewards(env: &Env, user: &Address) -> bool {
    let key = RewardsStorageKey::UserRewards(user.clone());
    env.storage().persistent().has(&key)
}

/// Get user activity
pub fn get_user_activity(env: &Env, user: &Address, activity_id: u64) -> Option<UserActivity> {
    let key = RewardsStorageKey::UserActivity(user.clone(), activity_id);
    env.storage().persistent().get(&key)
}

/// Set user activity
pub fn set_user_activity(env: &Env, user: &Address, activity_id: u64, activity: &UserActivity) {
    let key = RewardsStorageKey::UserActivity(user.clone(), activity_id);
    env.storage().persistent().set(&key, activity);
}

/// Get next activity ID
pub fn get_next_activity_id(env: &Env) -> u64 {
    let key = RewardsStorageKey::ActivityCounter;
    let id = env.storage().persistent().get(&key).unwrap_or(0);
    env.storage().persistent().set(&key, &(id + 1));
    id
}

/// Storage keys for oracle system
#[derive(Clone)]
#[contracttype]
pub enum OracleStorageKey {
    VerificationRequest(String),
    OracleConfig,
    VerificationCounter,
}

/// Get verification request
pub fn get_verification_request(env: &Env, verification_id: &String) -> Option<VerificationRequest> {
    let key = OracleStorageKey::VerificationRequest(verification_id.clone());
    env.storage().persistent().get(&key)
}

/// Set verification request
pub fn set_verification_request(env: &Env, verification_id: &String, request: &VerificationRequest) {
    let key = OracleStorageKey::VerificationRequest(verification_id.clone());
    env.storage().persistent().set(&key, request);
}

/// Check if verification request exists
pub fn has_verification_request(env: &Env, verification_id: &String) -> bool {
    let key = OracleStorageKey::VerificationRequest(verification_id.clone());
    env.storage().persistent().has(&key)
}

/// Get oracle configuration
pub fn get_oracle_config(env: &Env) -> Option<OracleConfig> {
    let key = OracleStorageKey::OracleConfig;
    env.storage().persistent().get(&key)
}

/// Set oracle configuration
pub fn set_oracle_config(env: &Env, config: &OracleConfig) {
    let key = OracleStorageKey::OracleConfig;
    env.storage().persistent().set(&key, config);
}

/// Get next verification ID
pub fn get_next_verification_id(env: &Env) -> String {
    let key = OracleStorageKey::VerificationCounter;
    let counter = env.storage().persistent().get(&key).unwrap_or(0u64);
    env.storage().persistent().set(&key, &(counter + 1));
    
    // Convert counter to string
    format_number_as_string(&env, counter)
}

/// Helper to format number as string (reused from rewards)
fn format_number_as_string(env: &Env, num: u64) -> String {
    match num {
        0 => String::from_str(env, "0"),
        1 => String::from_str(env, "1"),
        2 => String::from_str(env, "2"),
        3 => String::from_str(env, "3"),
        4 => String::from_str(env, "4"),
        5 => String::from_str(env, "5"),
        6 => String::from_str(env, "6"),
        7 => String::from_str(env, "7"),
        8 => String::from_str(env, "8"),
        9 => String::from_str(env, "9"),
        10 => String::from_str(env, "10"),
        _ => String::from_str(env, "999"),
    }
}

/// Get all verification requests for a split
pub fn get_split_verifications(env: &Env, split_id: &String) -> Vec<String> {
    let mut verification_ids = Vec::new(env);
    let counter = get_next_verification_id(env);
    
    // Search through all verification IDs
    for i in 0..counter {
        let id_str = format_number_as_string(env, i);
        if let Some(request) = get_verification_request(env, &id_str) {
            if request.split_id == *split_id {
                verification_ids.push_back(id_str);
            }
        }
    }
    
    verification_ids
}
