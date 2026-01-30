//! # Unit Tests for Split Escrow Contract
//!
//! I'm testing all the core functionality to ensure the contract
//! behaves correctly under various scenarios.

#![cfg(test)]

extern crate std;

use super::*;
use soroban_sdk::{
    symbol_short, testutils::Address as _, testutils::Events as _, token, Address, Env, String,
    Symbol, TryIntoVal, Vec,
};
use std::panic::{catch_unwind, AssertUnwindSafe};

/// Helper to create a test environment and contract client
fn setup_test() -> (
    Env,
    Address,
    Address,
    SplitEscrowContractClient<'static>,
    token::Client<'static>,
    token::StellarAssetClient<'static>,
) {
    let env = Env::default();
    env.mock_all_auths();

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin.clone());
    let token_client = token::Client::new(&env, &token_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let contract_id = env.register_contract(None, SplitEscrowContract);
    let client = SplitEscrowContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    (
        env,
        admin,
        token_id,
        client,
        token_client,
        token_admin_client,
    )
}

/// Helper to initialize the contract
fn initialize_contract(client: &SplitEscrowContractClient, admin: &Address, token: &Address) {
    client.initialize(admin, token);
}

// ============================================
// Initialization Tests
// ============================================

#[test]
fn test_initialize() {
    let (_env, admin, token_id, client, _token_client, _token_admin_client) = setup_test();

    initialize_contract(&client, &admin, &token_id);

    let stored_admin = client.get_admin();
    assert_eq!(stored_admin, admin);
}

#[test]
#[should_panic(expected = "Contract already initialized")]
fn test_double_initialize_fails() {
    let (_env, admin, token_id, client, _token_client, _token_admin_client) = setup_test();

    initialize_contract(&client, &admin, &token_id);
    // Second initialization should fail
    initialize_contract(&client, &admin, &token_id);
}

// ============================================
// Split Creation Tests
// ============================================

#[test]
fn test_create_split() {
    let (env, admin, token_id, client, _token_client, _token_admin_client) = setup_test();
    initialize_contract(&client, &admin, &token_id);

    let creator = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);

    let description = String::from_str(&env, "Dinner at Joe's");
    let total_amount: i128 = 100_0000000; // 100 with 7 decimals

    let mut addresses = Vec::new(&env);
    addresses.push_back(participant1.clone());
    addresses.push_back(participant2.clone());

    let mut shares = Vec::new(&env);
    shares.push_back(50_0000000i128);
    shares.push_back(50_0000000i128);

    let split_id = client.create_split(&creator, &description, &total_amount, &addresses, &shares);

    assert_eq!(split_id, 1);

    let split = client.get_split(&split_id);
    assert_eq!(split.id, 1);
    assert_eq!(split.creator, creator);
    assert_eq!(split.total_amount, total_amount);
    assert_eq!(split.status, SplitStatus::Pending);
    assert_eq!(split.participants.len(), 2);
}

#[test]
#[should_panic(expected = "Participant shares must sum to total amount")]
fn test_create_split_invalid_shares() {
    let (env, admin, token_id, client, _token_client, _token_admin_client) = setup_test();
    initialize_contract(&client, &admin, &token_id);

    let creator = Address::generate(&env);
    let participant = Address::generate(&env);

    let description = String::from_str(&env, "Bad split");
    let total_amount: i128 = 100_0000000;

    let mut addresses = Vec::new(&env);
    addresses.push_back(participant);

    // Share doesn't match total
    let mut shares = Vec::new(&env);
    shares.push_back(50_0000000i128);

    client.create_split(&creator, &description, &total_amount, &addresses, &shares);
}

#[test]
#[should_panic(expected = "At least one participant is required")]
fn test_create_split_no_participants() {
    let (env, admin, token_id, client, _token_client, _token_admin_client) = setup_test();
    initialize_contract(&client, &admin, &token_id);

    let creator = Address::generate(&env);
    let description = String::from_str(&env, "Empty split");

    let addresses: Vec<Address> = Vec::new(&env);
    let shares: Vec<i128> = Vec::new(&env);

    client.create_split(&creator, &description, &0, &addresses, &shares);
}

// ============================================
// Deposit Tests
// ============================================

#[test]
fn test_deposit() {
    let (env, admin, token_id, client, token_client, token_admin_client) = setup_test();
    initialize_contract(&client, &admin, &token_id);

    let creator = Address::generate(&env);
    let participant = Address::generate(&env);

    let description = String::from_str(&env, "Test split");
    let total_amount: i128 = 100_0000000;

    let mut addresses = Vec::new(&env);
    addresses.push_back(participant.clone());

    let mut shares = Vec::new(&env);
    shares.push_back(100_0000000i128);

    let split_id = client.create_split(&creator, &description, &total_amount, &addresses, &shares);

    token_admin_client.mint(&participant, &100_0000000i128);

    // Make a deposit
    client.deposit(&split_id, &participant, &50_0000000);

    let split = client.get_split(&split_id);
    assert_eq!(split.status, SplitStatus::Active);
    assert_eq!(split.amount_collected, 50_0000000);

    // Complete the deposit
    client.deposit(&split_id, &participant, &50_0000000);

    let split = client.get_split(&split_id);
    assert_eq!(split.status, SplitStatus::Released);
    assert_eq!(split.amount_collected, 100_0000000);
    assert_eq!(split.amount_released, 100_0000000);

    let creator_balance = token_client.balance(&creator);
    assert_eq!(creator_balance, 100_0000000);
}

#[test]
fn test_deposit_exceeds_share() {
    let (env, admin, token_id, client, _token_client, token_admin_client) = setup_test();
    initialize_contract(&client, &admin, &token_id);

    let creator = Address::generate(&env);
    let participant = Address::generate(&env);

    let description = String::from_str(&env, "Test split");

    let mut addresses = Vec::new(&env);
    addresses.push_back(participant.clone());

    let mut shares = Vec::new(&env);
    shares.push_back(100_0000000i128);

    let split_id = client.create_split(&creator, &description, &100_0000000, &addresses, &shares);

    token_admin_client.mint(&participant, &200_0000000i128);

    // Try to overpay
    let result = catch_unwind(AssertUnwindSafe(|| {
        client.deposit(&split_id, &participant, &150_0000000)
    }));
    assert!(result.is_err());
}

// ============================================
// Cancel Tests
// ============================================

#[test]
fn test_cancel_split() {
    let (env, admin, token_id, client, _token_client, _token_admin_client) = setup_test();
    initialize_contract(&client, &admin, &token_id);

    let creator = Address::generate(&env);
    let participant = Address::generate(&env);

    let description = String::from_str(&env, "Test split");

    let mut addresses = Vec::new(&env);
    addresses.push_back(participant);

    let mut shares = Vec::new(&env);
    shares.push_back(100_0000000i128);

    let split_id = client.create_split(&creator, &description, &100_0000000, &addresses, &shares);

    client.cancel_split(&split_id);

    let split = client.get_split(&split_id);
    assert_eq!(split.status, SplitStatus::Cancelled);
}

// ============================================
// Release Tests
// ============================================

#[test]
fn test_release_funds() {
    let (env, admin, token_id, client, token_client, token_admin_client) = setup_test();
    initialize_contract(&client, &admin, &token_id);

    let creator = Address::generate(&env);
    let participant = Address::generate(&env);

    let description = String::from_str(&env, "Test split");

    let mut addresses = Vec::new(&env);
    addresses.push_back(participant.clone());

    let mut shares = Vec::new(&env);
    shares.push_back(100_0000000i128);

    let split_id = client.create_split(&creator, &description, &100_0000000, &addresses, &shares);

    // Complete the split (auto-release should occur)
    token_admin_client.mint(&participant, &100_0000000i128);
    client.deposit(&split_id, &participant, &100_0000000);

    let split = client.get_split(&split_id);
    assert_eq!(split.status, SplitStatus::Released);

    let creator_balance = token_client.balance(&creator);
    assert_eq!(creator_balance, 100_0000000);

    // Manual release should be blocked after auto-release
    let result = catch_unwind(AssertUnwindSafe(|| client.release_funds(&split_id)));
    assert!(result.is_err());
}

#[test]
fn test_release_incomplete_split() {
    let (env, admin, token_id, client, _token_client, _token_admin_client) = setup_test();
    initialize_contract(&client, &admin, &token_id);

    let creator = Address::generate(&env);
    let participant = Address::generate(&env);

    let description = String::from_str(&env, "Test split");

    let mut addresses = Vec::new(&env);
    addresses.push_back(participant);

    let mut shares = Vec::new(&env);
    shares.push_back(100_0000000i128);

    let split_id = client.create_split(&creator, &description, &100_0000000, &addresses, &shares);

    // Try to release without completing deposits
    let result = catch_unwind(AssertUnwindSafe(|| client.release_funds(&split_id)));
    assert!(result.is_err());
}

// ============================================
// Partial Release and Funding Checks
// ============================================

#[test]
fn test_is_fully_funded() {
    let (env, admin, token_id, client, _token_client, token_admin_client) = setup_test();
    initialize_contract(&client, &admin, &token_id);

    let creator = Address::generate(&env);
    let participant = Address::generate(&env);

    let description = String::from_str(&env, "Funding check");

    let mut addresses = Vec::new(&env);
    addresses.push_back(participant.clone());

    let mut shares = Vec::new(&env);
    shares.push_back(100_0000000i128);

    let split_id = client.create_split(&creator, &description, &100_0000000, &addresses, &shares);

    token_admin_client.mint(&participant, &50_0000000i128);
    client.deposit(&split_id, &participant, &50_0000000);

    let funded = client.is_fully_funded(&split_id);
    assert!(!funded);

    token_admin_client.mint(&participant, &50_0000000i128);
    client.deposit(&split_id, &participant, &50_0000000);

    let funded = client.is_fully_funded(&split_id);
    assert!(funded);
}

#[test]
fn test_release_partial() {
    let (env, admin, token_id, client, token_client, token_admin_client) = setup_test();
    initialize_contract(&client, &admin, &token_id);

    let creator = Address::generate(&env);
    let participant = Address::generate(&env);

    let description = String::from_str(&env, "Partial release");

    let mut addresses = Vec::new(&env);
    addresses.push_back(participant.clone());

    let mut shares = Vec::new(&env);
    shares.push_back(100_0000000i128);

    let split_id = client.create_split(&creator, &description, &100_0000000, &addresses, &shares);

    token_admin_client.mint(&participant, &60_0000000i128);
    client.deposit(&split_id, &participant, &60_0000000);

    let released = client.release_partial(&split_id);
    assert_eq!(released, 60_0000000);

    let split = client.get_split(&split_id);
    assert_eq!(split.status, SplitStatus::Active);
    assert_eq!(split.amount_released, 60_0000000);

    let creator_balance = token_client.balance(&creator);
    assert_eq!(creator_balance, 60_0000000);

    token_admin_client.mint(&participant, &40_0000000i128);
    client.deposit(&split_id, &participant, &40_0000000);

    let split = client.get_split(&split_id);
    assert_eq!(split.status, SplitStatus::Released);
    assert_eq!(split.amount_released, 100_0000000);
}

// ============================================
// Event Emission Tests
// ============================================

#[test]
fn test_events_emitted_on_auto_release() {
    let (env, admin, token_id, client, _token_client, token_admin_client) = setup_test();
    initialize_contract(&client, &admin, &token_id);

    let creator = Address::generate(&env);
    let participant = Address::generate(&env);

    let description = String::from_str(&env, "Event check");

    let mut addresses = Vec::new(&env);
    addresses.push_back(participant.clone());

    let mut shares = Vec::new(&env);
    shares.push_back(100_0000000i128);

    let split_id = client.create_split(&creator, &description, &100_0000000, &addresses, &shares);

    token_admin_client.mint(&participant, &100_0000000i128);
    client.deposit(&split_id, &participant, &100_0000000);

    let events = env.events().all();
    let mut has_completed = false;
    let mut has_released = false;

    for i in 0..events.len() {
        let event = events.get(i).unwrap();
        let topics = &event.1;
        let data = &event.2;

        let topic: Symbol = topics.get(0).unwrap().try_into_val(&env).unwrap();
        if topic == symbol_short!("completed") {
            let payload: (u64, i128) = data.try_into_val(&env).unwrap();
            assert_eq!(payload.0, split_id);
            assert_eq!(payload.1, 100_0000000);
            has_completed = true;
        }
        if topic == symbol_short!("released") {
            let payload: (u64, Address, i128, u64) = data.try_into_val(&env).unwrap();
            assert_eq!(payload.0, split_id);
            assert_eq!(payload.1, creator);
            assert_eq!(payload.2, 100_0000000);
            has_released = true;
        }
    }

    assert!(has_completed);
    assert!(has_released);
}

// ============================================
// Enhanced Escrow Data Structure Tests (Issue #59)
// ============================================

#[test]
fn test_escrow_status_values() {
    // I'm verifying that all EscrowStatus variants are distinct and usable
    let active = EscrowStatus::Active;
    let completed = EscrowStatus::Completed;
    let cancelled = EscrowStatus::Cancelled;
    let expired = EscrowStatus::Expired;

    assert_eq!(active, EscrowStatus::Active);
    assert_ne!(active, completed);
    assert_ne!(completed, cancelled);
    assert_ne!(cancelled, expired);
}

#[test]
fn test_escrow_participant_creation() {
    let env = Env::default();
    let address = Address::generate(&env);

    let participant = EscrowParticipant::new(address.clone(), 100_0000000);

    assert_eq!(participant.address, address);
    assert_eq!(participant.amount_owed, 100_0000000);
    assert_eq!(participant.amount_paid, 0);
    assert!(participant.paid_at.is_none());
}

#[test]
fn test_escrow_participant_validation() {
    let env = Env::default();
    let address = Address::generate(&env);

    // Valid participant
    let valid = EscrowParticipant {
        address: address.clone(),
        amount_owed: 100,
        amount_paid: 50,
        paid_at: None,
    };
    assert!(valid.validate().is_ok());

    // Overpaid participant (invalid)
    let overpaid = EscrowParticipant {
        address: address.clone(),
        amount_owed: 100,
        amount_paid: 150,
        paid_at: None,
    };
    assert!(overpaid.validate().is_err());

    // Negative amount (invalid)
    let negative = EscrowParticipant {
        address: address.clone(),
        amount_owed: -100,
        amount_paid: 0,
        paid_at: None,
    };
    assert!(negative.validate().is_err());
}

#[test]
fn test_escrow_participant_helpers() {
    let env = Env::default();
    let address = Address::generate(&env);

    let participant = EscrowParticipant {
        address: address.clone(),
        amount_owed: 100,
        amount_paid: 60,
        paid_at: None,
    };

    assert!(!participant.has_fully_paid());
    assert_eq!(participant.remaining_owed(), 40);

    let fully_paid = EscrowParticipant {
        address: address.clone(),
        amount_owed: 100,
        amount_paid: 100,
        paid_at: Some(12345),
    };

    assert!(fully_paid.has_fully_paid());
    assert_eq!(fully_paid.remaining_owed(), 0);
}

#[test]
fn test_split_escrow_creation() {
    let env = Env::default();
    let creator = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);

    let mut participants = Vec::new(&env);
    participants.push_back(EscrowParticipant::new(participant1, 50_0000000));
    participants.push_back(EscrowParticipant::new(participant2, 50_0000000));

    let escrow = create_escrow(
        &env,
        String::from_str(&env, "escrow-001"),
        creator.clone(),
        String::from_str(&env, "Team dinner"),
        100_0000000,
        participants,
        1735689600, // Some future timestamp
    );

    assert_eq!(escrow.total_amount, 100_0000000);
    assert_eq!(escrow.amount_collected, 0);
    assert_eq!(escrow.status, EscrowStatus::Active);
    assert_eq!(escrow.creator, creator);
    assert_eq!(escrow.participants.len(), 2);
}

#[test]
fn test_split_escrow_validation() {
    let env = Env::default();
    let creator = Address::generate(&env);
    let participant = Address::generate(&env);

    let mut participants = Vec::new(&env);
    participants.push_back(EscrowParticipant {
        address: participant,
        amount_owed: 100,
        amount_paid: 50,
        paid_at: None,
    });

    // Valid escrow
    let valid = SplitEscrow {
        split_id: String::from_str(&env, "test-1"),
        creator: creator.clone(),
        description: String::from_str(&env, "Test"),
        total_amount: 100,
        amount_collected: 50,
        participants: participants.clone(),
        status: EscrowStatus::Active,
        deadline: 99999999,
        created_at: 1000,
    };
    assert!(valid.validate().is_ok());

    // Collected exceeds total (invalid)
    let over_collected = SplitEscrow {
        split_id: String::from_str(&env, "test-2"),
        creator: creator.clone(),
        description: String::from_str(&env, "Test"),
        total_amount: 100,
        amount_collected: 150,
        participants: participants.clone(),
        status: EscrowStatus::Active,
        deadline: 99999999,
        created_at: 1000,
    };
    assert!(over_collected.validate().is_err());
}

#[test]
fn test_split_escrow_expiry() {
    let env = Env::default();
    let creator = Address::generate(&env);

    let participants = Vec::new(&env);

    let escrow = SplitEscrow {
        split_id: String::from_str(&env, "test"),
        creator,
        description: String::from_str(&env, "Test"),
        total_amount: 100,
        amount_collected: 0,
        participants,
        status: EscrowStatus::Active,
        deadline: 1000,
        created_at: 500,
    };

    // Before deadline
    assert!(!escrow.is_expired(999));
    assert!(!escrow.is_expired(1000));

    // After deadline
    assert!(escrow.is_expired(1001));
    assert!(escrow.is_expired(2000));
}

#[test]
fn test_split_escrow_funding_helpers() {
    let env = Env::default();
    let creator = Address::generate(&env);
    let participants = Vec::new(&env);

    let partially_funded = SplitEscrow {
        split_id: String::from_str(&env, "test"),
        creator: creator.clone(),
        description: String::from_str(&env, "Test"),
        total_amount: 100,
        amount_collected: 60,
        participants: participants.clone(),
        status: EscrowStatus::Active,
        deadline: 99999999,
        created_at: 1000,
    };

    assert!(!partially_funded.is_fully_funded());
    assert_eq!(partially_funded.remaining_amount(), 40);

    let fully_funded = SplitEscrow {
        split_id: String::from_str(&env, "test"),
        creator,
        description: String::from_str(&env, "Test"),
        total_amount: 100,
        amount_collected: 100,
        participants,
        status: EscrowStatus::Completed,
        deadline: 99999999,
        created_at: 1000,
    };

    assert!(fully_funded.is_fully_funded());
    assert_eq!(fully_funded.remaining_amount(), 0);
}

// ============================================
// Enhanced Storage Tests (Issue #59)
// ============================================

#[test]
fn test_escrow_count_storage() {
    let env = Env::default();
    let contract_id = env.register_contract(None, SplitEscrowContract);

    env.as_contract(&contract_id, || {
        // Initial count should be 0
        let initial = storage::get_escrow_count(&env);
        assert_eq!(initial, 0);

        // Increment should return new value
        let first = storage::increment_escrow_count(&env);
        assert_eq!(first, 1);

        let second = storage::increment_escrow_count(&env);
        assert_eq!(second, 2);

        // Get should return current value
        let current = storage::get_escrow_count(&env);
        assert_eq!(current, 2);
    });
}

#[test]
fn test_escrow_storage() {
    let env = Env::default();
    let contract_id = env.register_contract(None, SplitEscrowContract);
    let creator = Address::generate(&env);
    let split_id = String::from_str(&env, "test-escrow-1");

    let participants = Vec::new(&env);
    let escrow = create_escrow(
        &env,
        split_id.clone(),
        creator.clone(),
        String::from_str(&env, "Test escrow"),
        1000,
        participants,
        99999999,
    );

    env.as_contract(&contract_id, || {
        // Initially should not exist
        assert!(!storage::has_escrow(&env, &split_id));

        // Store and retrieve
        storage::set_escrow(&env, &split_id, &escrow);
        assert!(storage::has_escrow(&env, &split_id));

        let retrieved = storage::get_escrow(&env, &split_id);
        assert_eq!(retrieved.total_amount, 1000);
        assert_eq!(retrieved.creator, creator);
    });
}

#[test]
fn test_participant_payment_storage() {
    let env = Env::default();
    let contract_id = env.register_contract(None, SplitEscrowContract);
    let split_id = String::from_str(&env, "test-split");
    let participant = Address::generate(&env);

    env.as_contract(&contract_id, || {
        // Initial payment should be 0
        let initial = storage::get_participant_payment(&env, &split_id, &participant);
        assert_eq!(initial, 0);

        // Set payment
        storage::set_participant_payment(&env, &split_id, &participant, 500);
        let after_set = storage::get_participant_payment(&env, &split_id, &participant);
        assert_eq!(after_set, 500);

        // Add to payment
        let new_total = storage::add_participant_payment(&env, &split_id, &participant, 300);
        assert_eq!(new_total, 800);

        let final_amount = storage::get_participant_payment(&env, &split_id, &participant);
        assert_eq!(final_amount, 800);
    });
}

#[test]
fn test_has_participant_payment() {
    let env = Env::default();
    let contract_id = env.register_contract(None, SplitEscrowContract);
    let split_id = String::from_str(&env, "test-split");
    let participant = Address::generate(&env);

    env.as_contract(&contract_id, || {
        // Initially should not exist (returns false because no explicit entry)
        assert!(!storage::has_participant_payment(
            &env,
            &split_id,
            &participant
        ));

        // After setting, should exist
        storage::set_participant_payment(&env, &split_id, &participant, 100);
        assert!(storage::has_participant_payment(
            &env,
            &split_id,
            &participant
        ));
    });
}
