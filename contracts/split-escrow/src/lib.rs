//! # Split Escrow Contract
//!
//! I designed this contract to handle bill splitting escrow on the Stellar network.
//! It manages the lifecycle of splits from creation through fund release or cancellation.
//!
//! ## Core Functionality
//! - Create splits with multiple participants
//! - Accept deposits from participants
//! - Release funds when split is complete
//! - Cancel and refund if needed

#![no_std]

use soroban_sdk::{contracttype, symbol_short, Address, Env, String, Vec, token};
use soroban_sdk::token::TokenClient;
use std::string::ToString;

mod events;
mod storage;
mod types;

#[cfg(test)]
mod test;

pub use events::*;
pub use storage::*;
pub use types::*;

/// The main Split Escrow contract
///
/// I'm keeping the initial implementation minimal - just the structure and
/// placeholder methods. The actual business logic will be implemented in
/// subsequent issues as we build out the escrow functionality.
#[contract]
pub struct SplitEscrowContract;

#[contractimpl]
impl SplitEscrowContract {
    /// Initialize the contract with an admin address
    ///
    /// I'm making this the first function to call after deployment.
    /// It sets up the contract administrator who can manage global settings.
    pub fn initialize(env: Env, admin: Address, token: Address) {
        // Ensure the contract hasn't been initialized already
        if storage::has_admin(&env) {
            panic!("Contract already initialized");
        }

        // Verify the admin is authorizing this call
        admin.require_auth();

        // Store the admin address
        storage::set_admin(&env, &admin);

        // Store the token address
        storage::set_token(&env, &token);

        // Emit initialization event
        events::emit_initialized(&env, &admin);
    }

    /// Create a new split with the specified participants and amounts
    ///
    /// I'm designing this to be called by the split creator who will also
    /// be responsible for distributing funds once everyone has paid.
    pub fn create_split(
        env: Env,
        creator: Address,
        description: String,
        total_amount: i128,
        participant_addresses: Vec<Address>,
        participant_shares: Vec<i128>,
    ) -> u64 {
        // Verify the creator is authorizing this call
        creator.require_auth();

        // Validate inputs
        if participant_addresses.len() != participant_shares.len() {
            panic!("Participant addresses and shares must have the same length");
        }

        if participant_addresses.is_empty() {
            panic!("At least one participant is required");
        }

        // Validate shares sum to total
        let mut shares_sum: i128 = 0;
        for i in 0..participant_shares.len() {
            shares_sum += participant_shares.get(i).unwrap();
        }
        if shares_sum != total_amount {
            panic!("Participant shares must sum to total amount");
        }

        // Get the next split ID
        let split_id = storage::get_next_split_id(&env);

        // Create participant entries
        let mut participants = Vec::new(&env);
        for i in 0..participant_addresses.len() {
            let participant = Participant {
                address: participant_addresses.get(i).unwrap(),
                share_amount: participant_shares.get(i).unwrap(),
                amount_paid: 0,
                has_paid: false,
            };
            participants.push_back(participant);
        }

        // Create the split
        let split = Split {
            id: split_id,
            creator: creator.clone(),
            description,
            total_amount,
            amount_collected: 0,
            amount_released: 0,
            participants,
            status: SplitStatus::Pending,
            created_at: env.ledger().timestamp(),
        };

        // Store the split
        storage::set_split(&env, split_id, &split);

        // Emit creation event
        events::emit_split_created(&env, split_id, &creator, total_amount);

        split_id
    }

    /// Deposit funds into a split
    ///
    /// I'm allowing partial deposits so participants can pay incrementally.
    pub fn deposit(env: Env, split_id: u64, participant: Address, amount: i128) {
        // Verify the participant is authorizing this call
        participant.require_auth();

        // Get the split
        let mut split = storage::get_split(&env, split_id);

        if amount <= 0 {
            panic!("Deposit amount must be positive");
        }

        // Verify the split is still accepting deposits
        if split.status != SplitStatus::Pending && split.status != SplitStatus::Active {
            panic!("Split is not accepting deposits");
        }

        // Find the participant in the split
        let mut found = false;
        let mut updated_participants = Vec::new(&env);

        for i in 0..split.participants.len() {
            let mut p = split.participants.get(i).unwrap();
            if p.address == participant {
                found = true;
                let remaining = p.share_amount - p.amount_paid;
                if amount > remaining {
                    panic!("Deposit exceeds remaining amount owed");
                }

                p.amount_paid += amount;
                p.has_paid = p.amount_paid >= p.share_amount;
            }
            updated_participants.push_back(p);
        }

        if !found {
            panic!("Participant not found in split");
        }

        // Transfer tokens from participant to escrow contract
        let token_address = storage::get_token(&env);
        let token_client = token::Client::new(&env, &token_address);
        let contract_address = env.current_contract_address();
        token_client.transfer(&participant, &contract_address, &amount);

        // Update split state
        split.participants = updated_participants;
        split.amount_collected += amount;

        // Check if split is now fully funded
        if split.status == SplitStatus::Pending {
            split.status = SplitStatus::Active;
        }

        // Save the updated split
        storage::set_split(&env, split_id, &split);

        // Emit deposit event
        events::emit_deposit_received(&env, split_id, &participant, amount);

        // Auto-release funds if fully funded
        if Self::is_fully_funded_internal(&split) {
            let _ = Self::release_funds_internal(&env, split_id, split);
        }
    }

    /// Release funds from a completed split to the creator
    ///
    /// I'm restricting this to completed splits only for safety.
    pub fn release_funds(env: Env, split_id: u64) -> Result<(), Error> {
        if !storage::has_split(&env, split_id) {
            return Err(Error::SplitNotFound);
        }

        let split = storage::get_split(&env, split_id);
        Self::release_funds_internal(&env, split_id, split).map(|_| ())
    }

    /// Release available funds to the creator for partial payments
    pub fn release_partial(env: Env, split_id: u64) -> Result<i128, Error> {
        if !storage::has_split(&env, split_id) {
            return Err(Error::SplitNotFound);
        }

        let mut split = storage::get_split(&env, split_id);

        if split.status == SplitStatus::Cancelled {
            return Err(Error::SplitCancelled);
        }

        if split.status == SplitStatus::Released {
            return Err(Error::SplitReleased);
        }

        if Self::is_fully_funded_internal(&split) {
            return Err(Error::SplitFullyFunded);
        }

        let available = split.amount_collected - split.amount_released;
        if available <= 0 {
            return Err(Error::NoFundsAvailable);
        }

        let token_address = storage::get_token(&env);
        let token_client = token::Client::new(&env, &token_address);
        let contract_address = env.current_contract_address();
        token_client.transfer(&contract_address, &split.creator, &available);

        split.amount_released += available;
        storage::set_split(&env, split_id, &split);

        events::emit_funds_released(
            &env,
            split_id,
            &split.creator,
            available,
            env.ledger().timestamp(),
        );

        Ok(available)
    }

    /// Check if a split is fully funded
    pub fn is_fully_funded(env: Env, split_id: u64) -> Result<bool, Error> {
        if !storage::has_split(&env, split_id) {
            return Err(Error::SplitNotFound);
        }

        let split = storage::get_split(&env, split_id);
        Ok(Self::is_fully_funded_internal(&split))
    }

    /// Cancel a split and mark for refunds
    ///
    /// I'm allowing only the creator to cancel, and only if not fully completed.
    pub fn cancel_split(env: Env, split_id: u64) {
        let mut split = storage::get_split(&env, split_id);

        // Only the creator can cancel
        split.creator.require_auth();

        // Can't cancel a completed split that's been released
        if split.status == SplitStatus::Released {
            panic!("Cannot cancel a released split");
        }

        // Mark as cancelled
        split.status = SplitStatus::Cancelled;
        storage::set_split(&env, split_id, &split);

        // Emit cancellation event
        events::emit_split_cancelled(&env, split_id);
    }

    /// Get split details by ID
    pub fn get_split(env: Env, split_id: u64) -> Split {
        storage::get_split(&env, split_id)
    }

    /// Get the contract admin
    pub fn get_admin(env: Env) -> Address {
        storage::get_admin(&env)
    }

    /// Get the token contract address
    pub fn get_token(env: Env) -> Address {
        storage::get_token(&env)
    }

    // ============================================
    // Insurance Query Functions
    // ============================================

    /// Get insurance policy by ID
    pub fn get_insurance(env: Env, insurance_id: String) -> types::InsurancePolicy {
        storage::get_insurance(&env, &insurance_id)
    }

    /// Get insurance claim by ID
    pub fn get_claim(env: Env, claim_id: String) -> types::InsuranceClaim {
        storage::get_claim(&env, &claim_id)
    }

    /// Get all claims for an insurance policy
    pub fn get_insurance_claims(env: Env, insurance_id: String) -> Vec<String> {
        storage::get_insurance_claims(&env, &insurance_id)
    }

    /// Check if a split has insurance
    pub fn has_split_insurance(env: Env, split_id: String) -> bool {
        storage::has_split_insurance(&env, &split_id)
    }

    /// Get insurance ID for a split
    pub fn get_split_insurance(env: Env, split_id: u64) -> Option<String> {
        storage::get_split_to_insurance(&env, &split_id.to_string())
    }

    /// Track user split usage for rewards calculation
    ///
    /// This function records user activities that contribute to rewards.
    pub fn track_split_usage(
        env: Env,
        user: Address,
    ) -> Result<(), Error> {
        // Get caller's address (require_auth for the caller)
        let caller = env.current_contract_address();
        caller.require_auth();

        // Get or create user rewards data
        let mut rewards = if let Some(existing_rewards) = storage::get_user_rewards(&env, &user) {
            existing_rewards
        } else {
            types::UserRewards {
                user: user.clone(),
                total_splits_created: 0,
                total_splits_participated: 0,
                total_amount_transacted: 0,
                rewards_earned: 0,
                rewards_claimed: 0,
                last_activity: env.ledger().timestamp(),
                status: types::RewardsStatus::Active,
            }
        };

        // Create activity record
        let activity_id = storage::get_next_activity_id(&env);
        let activity = types::UserActivity {
            user: user.clone(),
            activity_type: types::ActivityType::SplitParticipated,
            split_id: 0, // This would be set based on context
            amount: 0, // This would be set based on context
            timestamp: env.ledger().timestamp(),
        };

        // Store activity
        storage::set_user_activity(&env, &user, activity_id, &activity);

        // Update rewards data
        rewards.total_splits_participated += 1;
        rewards.last_activity = env.ledger().timestamp();
        
        // Store updated rewards
        storage::set_user_rewards(&env, &user, &rewards);

        // Emit activity tracked event
        events::emit_activity_tracked(&env, &user, "split_participated", 0, 0);

        Ok(())
    }

    /// Calculate rewards for a user
    ///
    /// This function calculates the total rewards earned by a user based on their activity.
    pub fn calculate_rewards(
        env: Env,
        user: Address,
    ) -> i128 {
        // Get user rewards data
        let rewards = storage::get_user_rewards(&env, &user)
            .unwrap_or(types::UserRewards {
                user: user.clone(),
                total_splits_created: 0,
                total_splits_participated: 0,
                total_amount_transacted: 0,
                rewards_earned: 0,
                rewards_claimed: 0,
                last_activity: env.ledger().timestamp(),
                status: types::RewardsStatus::Active,
            });

        // Calculate rewards based on activity
        // Base rewards: 10 tokens per split created
        let creation_rewards = rewards.total_splits_created as i128 * 10;
        
        // Participation rewards: 5 tokens per split participated
        let participation_rewards = rewards.total_splits_participated as i128 * 5;
        
        // Volume rewards: 0.1% of total amount transacted
        let volume_rewards = rewards.total_amount_transacted / 1000;
        
        // Total rewards
        let total_rewards = creation_rewards + participation_rewards + volume_rewards;
        
        // Update rewards earned
        let mut updated_rewards = rewards;
        updated_rewards.rewards_earned = total_rewards;
        storage::set_user_rewards(&env, &user, &updated_rewards);

        // Calculate available rewards (earned - claimed)
        let available_rewards = total_rewards - rewards.rewards_claimed;

        // Emit rewards calculated event
        events::emit_rewards_calculated(&env, &user, total_rewards, available_rewards);

        total_rewards
    }

    /// Claim rewards for a user
    ///
    /// This function allows users to claim their earned rewards.
    pub fn claim_rewards(
        env: Env,
        user: Address,
    ) -> Result<i128, Error> {
        // Get caller's address (require_auth for the caller)
        let caller = env.current_contract_address();
        caller.require_auth();

        // Ensure caller is claiming their own rewards
        if caller != user {
            return Err(Error::UserNotFound);
        }

        // Get user rewards data
        let mut rewards = storage::get_user_rewards(&env, &user)
            .ok_or(Error::UserNotFound)?;

        // Check if user is eligible for rewards
        if rewards.status != types::RewardsStatus::Active {
            return Err(Error::RewardsAlreadyClaimed);
        }

        // Calculate available rewards
        let available_rewards = rewards.rewards_earned - rewards.rewards_claimed;
        
        if available_rewards <= 0 {
            return Err(Error::InsufficientRewards);
        }

        // Update claimed rewards
        rewards.rewards_claimed += available_rewards;
        rewards.last_activity = env.ledger().timestamp();
        
        // Store updated rewards
        storage::set_user_rewards(&env, &user, &rewards);

        // Note: In a real implementation, you would transfer tokens here
        // For now, we'll just emit the event

        // Emit rewards claimed event
        events::emit_rewards_claimed(&env, &user, available_rewards);

        Ok(available_rewards)
    }

    /// Submit verification for a split
    ///
    /// This function allows users to submit verification requests with evidence.
    pub fn submit_verification(
        env: Env,
        split_id: String,
        receipt_hash: String,
    ) -> Result<String, Error> {
        // Get caller's address (require_auth for the caller)
        let caller = env.current_contract_address();
        caller.require_auth();

        // Check if split exists
        let split_id_num = {
            let mut result = 0u64;
            let chars = split_id.clone();
            for i in 0..chars.len() {
                let char_val = chars.get(i).unwrap();
                match char_val {
                    '0' => result = result * 10 + 0,
                    '1' => result = result * 10 + 1,
                    '2' => result = result * 10 + 2,
                    '3' => result = result * 10 + 3,
                    '4' => result = result * 10 + 4,
                    '5' => result = result * 10 + 5,
                    '6' => result = result * 10 + 6,
                    '7' => result = result * 10 + 7,
                    '8' => result = result * 10 + 8,
                    '9' => result = result * 10 + 9,
                    _ => {} // Skip non-digit characters
                }
            }
            result
        };

        if !storage::has_split(&env, split_id_num) {
            return Err(Error::SplitNotFound);
        }

        // Check if verification already exists
        if storage::has_verification_request(&env, &split_id) {
            return Err(Error::VerificationAlreadyExists);
        }

        // Generate verification ID
        let verification_id = storage::get_next_verification_id(&env);

        // Create verification request
        let request = types::VerificationRequest {
            verification_id: verification_id.clone(),
            split_id: split_id.clone(),
            requester: caller,
            receipt_hash: receipt_hash.clone(),
            evidence_url: None,
            submitted_at: env.ledger().timestamp(),
            status: types::VerificationStatus::Pending,
            verified_by: None,
            verified_at: None,
            rejection_reason: None,
        };

        // Store verification request
        storage::set_verification_request(&env, &verification_id, &request);

        // Emit verification submitted event
        events::emit_verification_submitted(&env, &verification_id, &split_id, &caller);

        Ok(verification_id)
    }

    /// Verify a split
    ///
    /// This function allows authorized oracles to verify split legitimacy.
    pub fn verify_split(
        env: Env,
        verification_id: String,
        verified: bool,
    ) -> Result<(), Error> {
        // Get caller's address (require_auth for the caller)
        let caller = env.current_contract_address();
        caller.require_auth();

        // Get verification request
        let mut request = storage::get_verification_request(&env, &verification_id)
            .ok_or(Error::VerificationNotFound)?;

        // Check if caller is authorized oracle
        let oracle_config = storage::get_oracle_config(&env)
            .ok_or(Error::OracleNotAuthorized)?;
        
        if !oracle_config.oracle_addresses.contains(&caller) {
            return Err(Error::OracleNotAuthorized);
        }

        // Check if verification is still pending
        if request.status != types::VerificationStatus::Pending {
            return Err(Error::InvalidVerificationStatus);
        }

        // Update verification request
        request.status = if verified {
            types::VerificationStatus::Verified
        } else {
            types::VerificationStatus::Rejected
        };
        request.verified_by = Some(caller);
        request.verified_at = Some(env.ledger().timestamp());

        if !verified {
            request.rejection_reason = Some(String::from_str(&env, "Evidence insufficient"));
        }

        // Store updated request
        storage::set_verification_request(&env, &verification_id, &request);

        // Emit verification completed event
        events::emit_verification_completed(&env, &verification_id, verified, &caller);

        Ok(())
    }

    /// Get verification status for a split
    ///
    /// This function returns the current verification status of a split.
    pub fn get_verification_status(
        env: Env,
        split_id: String,
    ) -> types::VerificationStatus {
        // Get all verification requests for this split
        let verification_ids = storage::get_split_verifications(&env, &split_id);

        // Find the most recent verification
        let mut latest_status = types::VerificationStatus::Pending;
        let mut latest_timestamp = 0u64;

        for verification_id in verification_ids.iter() {
            if let Some(request) = storage::get_verification_request(&env, verification_id) {
                match request.status {
                    types::VerificationStatus::Verified => {
                        if request.verified_at.unwrap_or(0) > latest_timestamp {
                            latest_timestamp = request.verified_at.unwrap();
                            latest_status = types::VerificationStatus::Verified;
                        }
                    },
                    types::VerificationStatus::Rejected => {
                        if request.verified_at.unwrap_or(0) > latest_timestamp {
                            latest_timestamp = request.verified_at.unwrap();
                            latest_status = types::VerificationStatus::Rejected;
                        }
                    },
                    _ => {}
                }
            }
        }

        latest_status
    }
}
