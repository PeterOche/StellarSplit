#![cfg(test)]

use crate::{FlashLoanContract, FlashLoanContractClient};
use soroban_sdk::{testutils::Address as _, Address, Env, String, symbol_short, Bytes};
use soroban_sdk::token::{Client as TokenClient, StellarAssetClient as TokenAdminClient};

mod receiver {
    use soroban_sdk::{contract, contractimpl, Address, Env, String, symbol_short, Bytes, token};

    #[contract]
    pub struct ReceiverContract;

    #[contractimpl]
    impl ReceiverContract {
        pub fn on_loan(env: Env, _loan_id: String, amount: i128, fee: i128, _data: Bytes) {
            let token_address = env.storage().instance().get::<_, Address>(&symbol_short!("tok_addr")).unwrap();
            let token_client = token::Client::new(&env, &token_address);
            let flash_loan_address = env.storage().instance().get::<_, Address>(&symbol_short!("fl_addr")).unwrap();
            
            // Transfer principal + fee back to the flash loan contract
            token_client.transfer(&env.current_contract_address(), &flash_loan_address, &(amount + fee));
        }

        pub fn set_flash_loan(env: Env, addr: Address, token: Address) {
            env.storage().instance().set(&symbol_short!("fl_addr"), &addr);
            env.storage().instance().set(&symbol_short!("tok_addr"), &token);
        }
    }
}

mod failing_receiver {
    use soroban_sdk::{contract, contractimpl, Address, Env, String, symbol_short, Bytes, token};

    #[contract]
    pub struct FailingReceiverContract;

    #[contractimpl]
    impl FailingReceiverContract {
        pub fn on_loan(env: Env, _loan_id: String, amount: i128, _fee: i128, _data: Bytes) {
            let token_address = env.storage().instance().get::<_, Address>(&symbol_short!("tok_addr")).unwrap();
            let token_client = token::Client::new(&env, &token_address);
            let flash_loan_address = env.storage().instance().get::<_, Address>(&symbol_short!("fl_addr")).unwrap();
            // Repay only the principal
            token_client.transfer(&env.current_contract_address(), &flash_loan_address, &amount);
        }
        pub fn set_flash_loan(env: Env, addr: Address, token: Address) {
            env.storage().instance().set(&symbol_short!("fl_addr"), &addr);
            env.storage().instance().set(&symbol_short!("tok_addr"), &token);
        }
    }
}

use receiver::{ReceiverContract, ReceiverContractClient};
use failing_receiver::{FailingReceiverContract, FailingReceiverContractClient};

#[test]
fn test_flash_loan_success() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    
    // Deploy token
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = token_id.address();
    let token_client = TokenClient::new(&env, &token_address);
    let token_admin_client = TokenAdminClient::new(&env, &token_address);

    // Deploy Flash Loan Contract
    let flash_loan_id = env.register_contract(None, FlashLoanContract);
    let flash_loan_client = FlashLoanContractClient::new(&env, &flash_loan_id);
    flash_loan_client.initialize(&admin, &token_address, &50u32); // 0.5% fee

    // Deploy Receiver
    let receiver_id = env.register_contract(None, ReceiverContract);
    let receiver_client = ReceiverContractClient::new(&env, &receiver_id);
    receiver_client.set_flash_loan(&flash_loan_id, &token_address);

    // Mint tokens to Flash Loan contract
    token_admin_client.mint(&flash_loan_id, &1000000);
    // Mint tokens to Receiver for fees
    token_admin_client.mint(&receiver_id, &10000);

    // Perform flash loan
    let loan_amount = 100000;
    flash_loan_client.flash_loan(&receiver_id, &loan_amount, &Bytes::new(&env));

    // Verify balances
    assert_eq!(token_client.balance(&flash_loan_id), 1000500);
}

#[test]
fn test_flash_loan_insufficient_repayment() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    
    // Deploy token
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = token_id.address();
    let token_admin_client = TokenAdminClient::new(&env, &token_address);

    // Deploy Flash Loan Contract
    let flash_loan_id = env.register_contract(None, FlashLoanContract);
    let flash_loan_client = FlashLoanContractClient::new(&env, &flash_loan_id);
    flash_loan_client.initialize(&admin, &token_address, &50u32);

    // Deploy Failing Receiver
    let receiver_id = env.register_contract(None, FailingReceiverContract);
    let receiver_client = FailingReceiverContractClient::new(&env, &receiver_id);
    receiver_client.set_flash_loan(&flash_loan_id, &token_address);

    token_admin_client.mint(&flash_loan_id, &1000000);

    // This should fail because fee is not paid
    let result = flash_loan_client.try_flash_loan(&receiver_id, &100000, &Bytes::new(&env));
    
    assert!(result.is_err());
}
