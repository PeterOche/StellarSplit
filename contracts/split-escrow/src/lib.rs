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

use soroban_sdk::{contract, contractimpl, token, Address, Env, String, Vec};

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
}

impl SplitEscrowContract {
    fn is_fully_funded_internal(split: &Split) -> bool {
        let mut total_paid: i128 = 0;
        for i in 0..split.participants.len() {
            total_paid += split.participants.get(i).unwrap().amount_paid;
        }
        total_paid >= split.total_amount
    }

    fn release_funds_internal(env: &Env, split_id: u64, mut split: Split) -> Result<i128, Error> {
        if split.status == SplitStatus::Cancelled {
            return Err(Error::SplitCancelled);
        }

        if split.status == SplitStatus::Released {
            return Err(Error::SplitReleased);
        }

        if !Self::is_fully_funded_internal(&split) {
            return Err(Error::SplitNotFunded);
        }

        let available = split.amount_collected - split.amount_released;
        if available <= 0 {
            return Err(Error::NoFundsAvailable);
        }

        if split.status != SplitStatus::Completed {
            split.status = SplitStatus::Completed;
            events::emit_escrow_completed(env, split_id, split.total_amount);
        }

        let token_address = storage::get_token(env);
        let token_client = token::Client::new(env, &token_address);
        let contract_address = env.current_contract_address();
        token_client.transfer(&contract_address, &split.creator, &available);

        split.amount_released += available;
        split.status = SplitStatus::Released;
        storage::set_split(env, split_id, &split);

        events::emit_funds_released(
            env,
            split_id,
            &split.creator,
            available,
            env.ledger().timestamp(),
        );

        Ok(available)
    }
}
