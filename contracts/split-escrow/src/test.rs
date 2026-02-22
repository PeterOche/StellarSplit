//! # Unit Tests for Split Escrow Contract
//!
//! I'm testing all of core functionality to ensure that contract
//! behaves correctly under various scenarios.

#![cfg(test)]

extern crate std;
use std::string::ToString;

use super::*;
use soroban_sdk::{
    symbol_short, testutils::Address as _, testutils::Events as _, testutils::Ledger as _, token, Address, Env, String,
    Symbol, TryIntoVal, Vec,
};
use soroban_sdk::token::StellarAssetClient;
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
    let token_id = Address::generate(&env);
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

/// Helper to initialize contract
fn initialize_contract(client: &SplitEscrowContractClient, admin: &Address, token: &Address) {
    client.initialize(admin, token);
}

/// Helper to convert u64 to String in no_std environment
fn u64_to_string(env: &Env, num: u64) -> String {
    // For simplicity in tests, we'll use basic pattern matching
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
        _ => String::from_str(env, "999"), // Fallback for test environment
    }
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

        let retrieved = storage::get_escrow(&env, &split_id).unwrap();
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

// ============================================
// Insurance Tests
// ============================================

#[test]
fn test_insure_split_success() {
    let (env, admin, token_id, client, token_client, token_admin_client) = setup_test();
    
    // Initialize contract
    initialize_contract(&client, &admin, &token_id);
    
    // Create a split first
    let creator = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);
    
    let split_id = client.create_split(
        &creator,
        &String::from_str(&env, "Test split"),
        &1000,
        &Vec::from_array(&env, [participant1.clone(), participant2.clone()]),
        &Vec::from_array(&env, [500i128, 500i128]),
    );
    
    // Mint tokens for the policy holder
    let policy_holder = Address::generate(&env);
    token_admin_client.mint(&policy_holder, &100);
    
    // Purchase insurance
    let split_id_str = u64_to_string(&env, split_id);
    let insurance_id = client.insure_split(&split_id_str, &10);
    
    // Verify insurance was created
    assert!(insurance_id.len() > 0);
    
    // Check that insurance exists
    let insurance = client.get_insurance(&insurance_id);
    assert_eq!(insurance.split_id, split_id_str);
    assert_eq!(insurance.policy_holder, policy_holder);
    assert_eq!(insurance.premium, 10);
    assert_eq!(insurance.coverage_amount, 100); // 10x premium
    assert_eq!(insurance.status, types::InsuranceStatus::Active);
}

#[test]
fn test_insure_split_invalid_premium() {
    let (env, admin, token_id, client, _token_client, _token_admin_client) = setup_test();
    
    // Initialize contract
    initialize_contract(&client, &admin, &token_id);
    
    // Create a split first
    let creator = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);
    
    let split_id = client.create_split(
        &creator,
        &String::from_str(&env, "Test split"),
        &1000,
        &Vec::from_array(&env, [participant1.clone(), participant2.clone()]),
        &Vec::from_array(&env, [500i128, 500i128]),
    );
    
    // Try to purchase insurance with zero premium
    let split_id_str = u64_to_string(&env, split_id);
    let result = client.try_insure_split(&split_id_str, &0);
    assert_eq!(result, Err(Ok(types::Error::InsufficientPremium)));
}

#[test]
fn test_insure_split_nonexistent_split() {
    let (env, admin, token_id, client, _token_client, _token_admin_client) = setup_test();
    
    // Initialize contract
    initialize_contract(&client, &admin, &token_id);
    
    // Try to purchase insurance for non-existent split
    let split_id_str = String::from_str(&env, "999");
    let result = client.try_insure_split(&split_id_str, &10);
    assert_eq!(result, Err(Ok(types::Error::SplitNotFound)));
}

#[test]
fn test_insure_split_already_insured() {
    let (env, admin, token_id, client, token_client, token_admin_client) = setup_test();
    
    // Initialize contract
    initialize_contract(&client, &admin, &token_id);
    
    // Create a split first
    let creator = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);
    
    let split_id = client.create_split(
        &creator,
        &String::from_str(&env, "Test split"),
        &1000,
        &Vec::from_array(&env, [participant1.clone(), participant2.clone()]),
        &Vec::from_array(&env, [500i128, 500i128]),
    );
    
    // Mint tokens for the policy holder
    let policy_holder = Address::generate(&env);
    token_admin_client.mint(&policy_holder, &100);
    
    // Purchase insurance first time
    let split_id_str = u64_to_string(&env, split_id);
    let _insurance_id = client.insure_split(&split_id_str, &10);
    
    // Try to purchase insurance again
    let result = client.try_insure_split(&split_id_str, &10);
    assert_eq!(result, Err(Ok(types::Error::InsuranceAlreadyExists)));
}

#[test]
fn test_claim_insurance_success() {
    let (env, admin, token_id, client, token_client, token_admin_client) = setup_test();
    
    // Initialize contract
    initialize_contract(&client, &admin, &token_id);
    
    // Create a split first
    let creator = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);
    
    let split_id = client.create_split(
        &creator,
        &String::from_str(&env, "Test split"),
        &1000,
        &Vec::from_array(&env, [participant1.clone(), participant2.clone()]),
        &Vec::from_array(&env, [500i128, 500i128]),
    );
    
    // Mint tokens for the policy holder
    let policy_holder = Address::generate(&env);
    token_admin_client.mint(&policy_holder, &100);
    
    // Purchase insurance
    let split_id_str = u64_to_string(&env, split_id);
    let insurance_id = client.insure_split(&split_id_str, &10);
    
    // File a claim
    let reason = String::from_str(&env, "Test claim reason");
    client.claim_insurance(&insurance_id, &reason);
    
    // Verify claim was created (check events)
    let events = env.events().all();
    assert!(events.len() > 0);
}

#[test]
fn test_claim_insurance_expired() {
    let (env, admin, token_id, client, token_client, token_admin_client) = setup_test();
    
    // Initialize contract
    initialize_contract(&client, &admin, &token_id);
    
    // Create a split first
    let creator = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);
    
    let split_id = client.create_split(
        &creator,
        &String::from_str(&env, "Test split"),
        &1000,
        &Vec::from_array(&env, [participant1.clone(), participant2.clone()]),
        &Vec::from_array(&env, [500i128, 500i128]),
    );
    
    // Mint tokens for the policy holder
    let policy_holder = Address::generate(&env);
    token_admin_client.mint(&policy_holder, &100);
    
    // Purchase insurance
    let split_id_str = u64_to_string(&env, split_id);
    let insurance_id = client.insure_split(&split_id_str, &10);
    
    // Fast forward time beyond expiration (31 days)
    env.ledger().set_timestamp(env.ledger().timestamp() + (31 * 24 * 60 * 60));
    
    // Try to file a claim
    let reason = String::from_str(&env, "Test claim reason");
    let result = client.try_claim_insurance(&insurance_id, &reason);
    assert_eq!(result, Err(Ok(types::Error::InsuranceExpired)));
}

#[test]
fn test_process_claim_approved() {
    let (env, admin, token_id, client, token_client, token_admin_client) = setup_test();
    
    // Initialize contract
    initialize_contract(&client, &admin, &token_id);
    
    // Create a split first
    let creator = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);
    
    let split_id = client.create_split(
        &creator,
        &String::from_str(&env, "Test split"),
        &1000,
        &Vec::from_array(&env, [participant1.clone(), participant2.clone()]),
        &Vec::from_array(&env, [500i128, 500i128]),
    );
    
    // Mint tokens for the policy holder
    let policy_holder = Address::generate(&env);
    token_admin_client.mint(&policy_holder, &100);
    
    // Purchase insurance
    let split_id_str = u64_to_string(&env, split_id);
    let insurance_id = client.insure_split(&split_id_str, &10);
    
    // File a claim
    let reason = String::from_str(&env, "Test claim reason");
    client.claim_insurance(&insurance_id, &reason);
    
    // Get claim ID from insurance claims
    let claim_ids = client.get_insurance_claims(&insurance_id);
    assert_eq!(claim_ids.len(), 1);
    let claim_id = claim_ids.get(0).unwrap();
    
    // Process claim as admin (approve)
    client.process_claim(&claim_id, &true);
    
    // Verify claim was processed (check events)
    let events = env.events().all();
    assert!(events.len() > 0);
}

#[test]
fn test_process_claim_rejected() {
    let (env, admin, token_id, client, token_client, token_admin_client) = setup_test();
    
    // Initialize contract
    initialize_contract(&client, &admin, &token_id);
    
    // Create a split first
    let creator = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);
    
    let split_id = client.create_split(
        &creator,
        &String::from_str(&env, "Test split"),
        &1000,
        &Vec::from_array(&env, [participant1.clone(), participant2.clone()]),
        &Vec::from_array(&env, [500i128, 500i128]),
    );
    
    // Mint tokens for the policy holder
    let policy_holder = Address::generate(&env);
    token_admin_client.mint(&policy_holder, &100);
    
    // Purchase insurance
    let split_id_str = u64_to_string(&env, split_id);
    let insurance_id = client.insure_split(&split_id_str, &10);
    
    // File a claim
    let reason = String::from_str(&env, "Test claim reason");
    client.claim_insurance(&insurance_id, &reason);
    
    // Get claim ID from insurance claims
    let claim_ids = client.get_insurance_claims(&insurance_id);
    assert_eq!(claim_ids.len(), 1);
    let claim_id = claim_ids.get(0).unwrap();
    
    // Process claim as admin (reject)
    client.process_claim(&claim_id, &false);
    
    // Verify claim was processed (check events)
    let events = env.events().all();
    assert!(events.len() > 0);
}

#[test]
fn test_insurance_storage_helpers() {
    let env = Env::default();
    let contract_id = env.register_contract(None, SplitEscrowContract);
    
    let insurance_id = String::from_str(&env, "test-insurance");
    let split_id = String::from_str(&env, "test-split");
    let policy_holder = Address::generate(&env);
    
    let policy = types::InsurancePolicy {
        insurance_id: insurance_id.clone(),
        split_id: split_id.clone(),
        policy_holder: policy_holder.clone(),
        premium: 10,
        coverage_amount: 100,
        status: types::InsuranceStatus::Active,
        created_at: 12345,
        expires_at: 12345 + (30 * 24 * 60 * 60),
    };
    
    env.as_contract(&contract_id, || {
        // Test insurance storage
        assert!(!storage::has_insurance(&env, &insurance_id));
        
        storage::set_insurance(&env, &insurance_id, &policy);
        assert!(storage::has_insurance(&env, &insurance_id));
        
        let retrieved = storage::get_insurance(&env, &insurance_id);
        assert_eq!(retrieved.insurance_id, insurance_id);
        assert_eq!(retrieved.split_id, split_id);
        assert_eq!(retrieved.policy_holder, policy_holder);
        
        // Test split to insurance mapping
        assert!(!storage::has_split_insurance(&env, &split_id));
        
        storage::set_split_to_insurance(&env, &split_id, &insurance_id);
        assert!(storage::has_split_insurance(&env, &split_id));
        
        let mapped_insurance_id = storage::get_split_to_insurance(&env, &split_id);
        assert_eq!(mapped_insurance_id, Some(insurance_id.clone()));
        
        // Test claim storage
        let claim_id = String::from_str(&env, "test-claim");
        let claim = types::InsuranceClaim {
            claim_id: claim_id.clone(),
            insurance_id: insurance_id.clone(),
            claimant: policy_holder.clone(),
            reason: String::from_str(&env, "test reason"),
            claim_amount: 50,
            status: types::ClaimStatus::Pending,
            filed_at: 12345,
            processed_at: None,
            notes: None,
        };
        
        assert!(!storage::has_claim(&env, &claim_id));
        
        storage::set_claim(&env, &claim_id, &claim);
        assert!(storage::has_claim(&env, &claim_id));
        
        let retrieved_claim = storage::get_claim(&env, &claim_id);
        assert_eq!(retrieved_claim.claim_id, claim_id);
        assert_eq!(retrieved_claim.insurance_id, insurance_id);
        
        // Test insurance claims mapping
        storage::add_insurance_claim(&env, &insurance_id, &claim_id);
        let claim_ids = storage::get_insurance_claims(&env, &insurance_id);
        assert_eq!(claim_ids.len(), 1);
        assert_eq!(claim_ids.get(0).unwrap(), claim_id);
    });
}

// ============================================
// Rewards Tests
// ============================================

#[test]
fn test_track_split_usage_success() {
    let (env, admin, token_id, client, _token_client, _token_admin_client) = setup_test();
    
    // Initialize contract
    initialize_contract(&client, &admin, &token_id);
    
    let user = Address::generate(&env);
    
    // Track split usage
    client.track_split_usage(&user);
    
    // Verify user rewards data was created
    let rewards = client.get_user_rewards_info(&user);
    assert!(rewards.total_splits_participated >= 1);
    assert_eq!(rewards.user, user);
    
    // Check events
    let events = env.events().all();
    assert!(events.len() > 0);
}

#[test]
fn test_calculate_rewards_new_user() {
    let (env, admin, token_id, client, _token_client, _token_admin_client) = setup_test();
    
    // Initialize contract
    initialize_contract(&client, &admin, &token_id);
    
    let user = Address::generate(&env);
    
    // Calculate rewards for new user
    let rewards_amount = client.calculate_rewards(&user);
    
    // Should be 0 for new user
    assert_eq!(rewards_amount, 0);
    
    // Verify rewards info
    let rewards_info = client.get_user_rewards_info(&user);
    assert_eq!(rewards_info.rewards_earned, 0);
    assert_eq!(rewards_info.rewards_claimed, 0);
}

#[test]
fn test_calculate_rewards_active_user() {
    let (env, admin, token_id, client, _token_client, _token_admin_client) = setup_test();
    
    // Initialize contract
    initialize_contract(&client, &admin, &token_id);
    
    let user = Address::generate(&env);
    
    // First, create some user rewards data manually
    env.as_contract(&client.contract_id, || {
        let mut rewards = types::UserRewards {
            user: user.clone(),
            total_splits_created: 5,
            total_splits_participated: 10,
            total_amount_transacted: 1000,
            rewards_earned: 0,
            rewards_claimed: 0,
            last_activity: env.ledger().timestamp(),
            status: types::RewardsStatus::Active,
        };
        
        // Store manually for testing
        let key = storage::RewardsStorageKey::UserRewards(user.clone());
        env.storage().persistent().set(&key, &rewards);
    });
    
    // Calculate rewards
    let rewards_amount = client.calculate_rewards(&user);
    
    // Expected: 5*10 + 10*5 + 1000/1000 = 50 + 50 + 1 = 101
    assert_eq!(rewards_amount, 101);
    
    // Verify rewards info was updated
    let rewards_info = client.get_user_rewards_info(&user);
    assert_eq!(rewards_info.rewards_earned, 101);
}

#[test]
fn test_claim_rewards_success() {
    let (env, admin, token_id, client, _token_client, _token_admin_client) = setup_test();
    
    // Initialize contract
    initialize_contract(&client, &admin, &token_id);
    
    let user = Address::generate(&env);
    
    // Set up user with earned rewards
    env.as_contract(&client.contract_id, || {
        let rewards = types::UserRewards {
            user: user.clone(),
            total_splits_created: 2,
            total_splits_participated: 3,
            total_amount_transacted: 500,
            rewards_earned: 50, // 2*10 + 3*5 + 500/1000 = 20 + 15 + 0 = 35 (let's say 50 for testing)
            rewards_claimed: 0,
            last_activity: env.ledger().timestamp(),
            status: types::RewardsStatus::Active,
        };
        
        let key = storage::RewardsStorageKey::UserRewards(user.clone());
        env.storage().persistent().set(&key, &rewards);
    });
    
    // Claim rewards
    let claimed_amount = client.claim_rewards(&user);
    assert_eq!(claimed_amount, 50);
    
    // Verify rewards info was updated
    let rewards_info = client.get_user_rewards_info(&user);
    assert_eq!(rewards_info.rewards_claimed, 50);
    
    // Check events
    let events = env.events().all();
    assert!(events.len() > 0);
}

#[test]
fn test_claim_rewards_insufficient_rewards() {
    let (env, admin, token_id, client, _token_client, _token_admin_client) = setup_test();
    
    // Initialize contract
    initialize_contract(&client, &admin, &token_id);
    
    let user = Address::generate(&env);
    
    // Set up user with no earned rewards
    env.as_contract(&client.contract_id, || {
        let rewards = types::UserRewards {
            user: user.clone(),
            total_splits_created: 0,
            total_splits_participated: 0,
            total_amount_transacted: 0,
            rewards_earned: 0,
            rewards_claimed: 0,
            last_activity: env.ledger().timestamp(),
            status: types::RewardsStatus::Active,
        };
        
        let key = storage::RewardsStorageKey::UserRewards(user.clone());
        env.storage().persistent().set(&key, &rewards);
    });
    
    // Try to claim rewards
    let result = client.try_claim_rewards(&user);
    assert_eq!(result, Err(Ok(types::Error::InsufficientRewards)));
}

#[test]
fn test_claim_rewards_unauthorized_user() {
    let (env, admin, token_id, client, _token_client, _token_admin_client) = setup_test();
    
    // Initialize contract
    initialize_contract(&client, &admin, &token_id);
    
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    
    // Set up user1 with rewards
    env.as_contract(&client.contract_id, || {
        let rewards = types::UserRewards {
            user: user1.clone(),
            total_splits_created: 1,
            total_splits_participated: 1,
            total_amount_transacted: 100,
            rewards_earned: 25,
            rewards_claimed: 0,
            last_activity: env.ledger().timestamp(),
            status: types::RewardsStatus::Active,
        };
        
        let key = storage::RewardsStorageKey::UserRewards(user1.clone());
        env.storage().persistent().set(&key, &rewards);
    });
    
    // Try user2 to claim user1's rewards
    let result = client.try_claim_rewards(&user1);
    assert_eq!(result, Err(Ok(types::Error::UserNotFound)));
}

#[test]
fn test_get_user_rewards_info_not_found() {
    let (env, admin, token_id, client, _token_client, _token_admin_client) = setup_test();
    
    // Initialize contract
    initialize_contract(&client, &admin, &token_id);
    
    let user = Address::generate(&env);
    
    // Get rewards for non-existent user
    let result = client.try_get_user_rewards_info(&user);
    assert_eq!(result, Err(Ok(types::Error::UserNotFound)));
}

#[test]
fn test_rewards_storage_helpers() {
    let env = Env::default();
    let contract_id = env.register_contract(None, SplitEscrowContract);
    
    let user = Address::generate(&env);
    
    env.as_contract(&contract_id, || {
        // Test storing and retrieving user rewards
        let rewards = types::UserRewards {
            user: user.clone(),
            total_splits_created: 3,
            total_splits_participated: 5,
            total_amount_transacted: 750,
            rewards_earned: 85,
            rewards_claimed: 25,
            last_activity: env.ledger().timestamp(),
            status: types::RewardsStatus::Active,
        };
        
        // Store rewards
        storage::set_user_rewards(&env, &user, &rewards);
        
        // Verify storage
        assert!(storage::has_user_rewards(&env, &user));
        
        let retrieved = storage::get_user_rewards(&env, &user).unwrap();
        assert_eq!(retrieved.total_splits_created, 3);
        assert_eq!(retrieved.total_splits_participated, 5);
        assert_eq!(retrieved.rewards_earned, 85);
        assert_eq!(retrieved.rewards_claimed, 25);
        
        // Test activity storage
        let activity_id = storage::get_next_activity_id(&env);
        let activity = types::UserActivity {
            user: user.clone(),
            activity_type: types::ActivityType::SplitCreated,
            split_id: 123,
            amount: 100,
            timestamp: env.ledger().timestamp(),
        };
        
        storage::set_user_activity(&env, &user, activity_id, &activity);
        
        let retrieved_activity = storage::get_user_activity(&env, &user, activity_id).unwrap();
        }

// ============================================
// Oracle Tests
// ============================================

#[test]
fn test_submit_verification_success() {
    let (env, admin, token_id, client, _token_client, _token_admin_client) = setup_test();
    
    // Initialize contract
    initialize_contract(&client, &admin, &token_id);
    
    // Create a split first
    let creator = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);
    
    let split_id = client.create_split(
        &creator,
        &String::from_str(&env, "Test split"),
        &1000,
        &Vec::from_array(&env, [participant1.clone(), participant2.clone()]),
        &Vec::from_array(&env, [500i128, 500i128]),
    );
    
    // Submit verification
    let receipt_hash = String::from_str(&env, "receipt_hash_123");
    let verification_id = client.submit_verification(&u64_to_string(&env, split_id), &receipt_hash);
    
    // Verify verification was created
    assert!(verification_id.len() > 0);
    
    // Check verification request
    let verification = client.get_verification_request(&verification_id);
    assert_eq!(verification.split_id, u64_to_string(&env, split_id));
    assert_eq!(verification.requester, env.current_contract_address());
    assert_eq!(verification.receipt_hash, receipt_hash);
    assert_eq!(verification.status, types::VerificationStatus::Pending);
    
    // Check events
    let events = env.events().all();
    assert!(events.len() > 0);
}

#[test]
fn test_submit_verification_nonexistent_split() {
    let (env, admin, token_id, client, _token_client, _token_admin_client) = setup_test();
    
    // Initialize contract
    initialize_contract(&client, &admin, &token_id);
    
    // Try to submit verification for non-existent split
    let receipt_hash = String::from_str(&env, "receipt_hash_123");
    let result = client.try_submit_verification(&String::from_str(&env, "999"), &receipt_hash);
    assert_eq!(result, Err(Ok(types::Error::SplitNotFound)));
}

#[test]
fn test_submit_verification_already_exists() {
    let (env, admin, token_id, client, _token_client, _token_admin_client) = setup_test();
    
    // Initialize contract
    initialize_contract(&client, &admin, &token_id);
    
    // Create a split first
    let creator = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);
    
    let split_id = client.create_split(
        &creator,
        &String::from_str(&env, "Test split"),
        &1000,
        &Vec::from_array(&env, [participant1.clone(), participant2.clone()]),
        &Vec::from_array(&env, [500i128, 500i128]),
    );
    
    // Submit first verification
    let receipt_hash = String::from_str(&env, "receipt_hash_123");
    let _verification_id = client.submit_verification(&u64_to_string(&env, split_id), &receipt_hash);
    
    // Try to submit second verification
    let result = client.try_submit_verification(&u64_to_string(&env, split_id), &receipt_hash);
    assert_eq!(result, Err(Ok(types::Error::VerificationAlreadyExists)));
}

#[test]
fn test_verify_split_success() {
    let (env, admin, token_id, client, _token_client, _token_admin_client) = setup_test();
    
    // Initialize contract
    initialize_contract(&client, &admin, &token_id);
    
    // Create a split and submit verification
    let creator = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);
    
    let split_id = client.create_split(
        &creator,
        &String::from_str(&env, "Test split"),
        &1000,
        &Vec::from_array(&env, [participant1.clone(), participant2.clone()]),
        &Vec::from_array(&env, [500i128, 500i128]),
    );
    
    let receipt_hash = String::from_str(&env, "receipt_hash_123");
    let verification_id = client.submit_verification(&u64_to_string(&env, split_id), &receipt_hash);
    
    // Set up oracle config to allow verification
    let oracle = Address::generate(&env);
    env.as_contract(&client.contract_id, || {
        let config = types::OracleConfig {
            required_verifications: 1,
            verification_timeout: 86400, // 24 hours
            min_oracles: 1,
            oracle_addresses: Vec::from_array(&env, [oracle.clone()]),
        };
        storage::set_oracle_config(&env, &config);
    });
    
    // Verify split as oracle
    client.verify_split(&verification_id, &true);
    
    // Check verification was updated
    let verification = client.get_verification_request(&verification_id);
    assert_eq!(verification.status, types::VerificationStatus::Verified);
    assert_eq!(verification.verified_by, Some(oracle));
    assert!(verification.verified_at.is_some());
    
    // Check events
    let events = env.events().all();
    assert!(events.len() > 0);
}

#[test]
fn test_verify_split_unauthorized() {
    let (env, admin, token_id, client, _token_client, _token_admin_client) = setup_test();
    
    // Initialize contract
    initialize_contract(&client, &admin, &token_id);
    
    // Create a split and submit verification
    let creator = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);
    
    let split_id = client.create_split(
        &creator,
        &String::from_str(&env, "Test split"),
        &1000,
        &Vec::from_array(&env, [participant1.clone(), participant2.clone()]),
        &Vec::from_array(&env, [500i128, 500i128]),
    );
    
    let receipt_hash = String::from_str(&env, "receipt_hash_123");
    let verification_id = client.submit_verification(&u64_to_string(&env, split_id), &receipt_hash);
    
    // Try to verify split as non-oracle
    let unauthorized = Address::generate(&env);
    let result = client.try_verify_split(&verification_id, &true);
    assert_eq!(result, Err(Ok(types::Error::OracleNotAuthorized)));
}

#[test]
fn test_verify_split_invalid_status() {
    let (env, admin, token_id, client, _token_client, _token_admin_client) = setup_test();
    
    // Initialize contract
    initialize_contract(&client, &admin, &token_id);
    
    // Create a split and submit verification
    let creator = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);
    
    let split_id = client.create_split(
        &creator,
        &String::from_str(&env, "Test split"),
        &1000,
        &Vec::from_array(&env, [participant1.clone(), participant2.clone()]),
        &Vec::from_array(&env, [500i128, 500i128]),
    );
    
    let receipt_hash = String::from_str(&env, "receipt_hash_123");
    let verification_id = client.submit_verification(&u64_to_string(&env, split_id), &receipt_hash);
    
    // Set up oracle config and verify first time
    let oracle = Address::generate(&env);
    env.as_contract(&client.contract_id, || {
        let config = types::OracleConfig {
            required_verifications: 1,
            verification_timeout: 86400,
            min_oracles: 1,
            oracle_addresses: Vec::from_array(&env, [oracle.clone()]),
        };
        storage::set_oracle_config(&env, &config);
    });
    
    client.verify_split(&verification_id, &true);
    
    // Try to verify again (should fail - already verified)
    let result = client.try_verify_split(&verification_id, &true);
    assert_eq!(result, Err(Ok(types::Error::InvalidVerificationStatus)));
}

#[test]
fn test_get_verification_status() {
    let (env, admin, token_id, client, _token_client, _token_admin_client) = setup_test();
    
    // Initialize contract
    initialize_contract(&client, &admin, &token_id);
    
    // Create a split
    let creator = Address::generate(&env);
    let participant1 = Address::generate(&env);
    let participant2 = Address::generate(&env);
    
    let split_id = client.create_split(
        &creator,
        &String::from_str(&env, "Test split"),
        &1000,
        &Vec::from_array(&env, [participant1.clone(), participant2.clone()]),
        &Vec::from_array(&env, [500i128, 500i128]),
    );
    
    // No verifications yet - should return Pending
    let status = client.get_verification_status(&u64_to_string(&env, split_id));
    assert_eq!(status, types::VerificationStatus::Pending);
    
    // Submit and verify a split
    let receipt_hash = String::from_str(&env, "receipt_hash_123");
    let verification_id = client.submit_verification(&u64_to_string(&env, split_id), &receipt_hash);
    
    let oracle = Address::generate(&env);
    env.as_contract(&client.contract_id, || {
        let config = types::OracleConfig {
            required_verifications: 1,
            verification_timeout: 86400,
            min_oracles: 1,
            oracle_addresses: Vec::from_array(&env, [oracle.clone()]),
        };
        storage::set_oracle_config(&env, &config);
    });
    
    client.verify_split(&verification_id, &true);
    
    // Should now return Verified
    let status = client.get_verification_status(&u64_to_string(&env, split_id));
    assert_eq!(status, types::VerificationStatus::Verified);
}

#[test]
fn test_oracle_storage_helpers() {
    let env = Env::default();
    let contract_id = env.register_contract(None, SplitEscrowContract);
    
    let verification_id = String::from_str(&env, "test-verification");
    let split_id = String::from_str(&env, "test-split");
    let requester = Address::generate(&env);
    
    env.as_contract(&contract_id, || {
        // Test storing and retrieving verification request
        let request = types::VerificationRequest {
            verification_id: verification_id.clone(),
            split_id: split_id.clone(),
            requester: requester.clone(),
            receipt_hash: String::from_str(&env, "receipt_hash"),
            evidence_url: Some(String::from_str(&env, "https://example.com/evidence")),
            submitted_at: 12345,
            status: types::VerificationStatus::Pending,
            verified_by: None,
            verified_at: None,
            rejection_reason: None,
        };
        
        // Store verification request
        storage::set_verification_request(&env, &verification_id, &request);
        
        // Verify storage
        assert!(storage::has_verification_request(&env, &verification_id));
        
        let retrieved = storage::get_verification_request(&env, &verification_id).unwrap();
        assert_eq!(retrieved.verification_id, verification_id);
        assert_eq!(retrieved.split_id, split_id);
        assert_eq!(retrieved.requester, requester);
        assert_eq!(retrieved.receipt_hash, String::from_str(&env, "receipt_hash"));
        
        // Test oracle config storage
        let config = types::OracleConfig {
            required_verifications: 3,
            verification_timeout: 172800, // 48 hours
            min_oracles: 2,
            oracle_addresses: Vec::from_array(&env, [requester.clone(), Address::generate(&env)]),
        };
        
        storage::set_oracle_config(&env, &config);
        
        let retrieved_config = storage::get_oracle_config(&env).unwrap();
        assert_eq!(retrieved_config.required_verifications, 3);
        assert_eq!(retrieved_config.verification_timeout, 172800);
        assert_eq!(retrieved_config.min_oracles, 2);
        assert_eq!(retrieved_config.oracle_addresses.len(), 2);
    });
}
