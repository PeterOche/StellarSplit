use soroban_sdk::{symbol_short, Address, Env, String, Symbol};

pub fn emit_initialized(env: &Env, admin: &Address) {
    env.events().publish(
        (Symbol::new(env, "flash_loan"), symbol_short!("init")),
        admin.clone()
    );
}

pub fn emit_loan_created(env: &Env, loan_id: &String, borrower: &Address, amount: i128) {
    env.events().publish(
        (Symbol::new(env, "flash_loan"), symbol_short!("create")),
        (loan_id.clone(), borrower.clone(), amount)
    );
}

pub fn emit_loan_repaid(env: &Env, loan_id: &String, amount: i128, fee: i128) {
    env.events().publish(
        (Symbol::new(env, "flash_loan"), symbol_short!("repay")),
        (loan_id.clone(), amount, fee)
    );
}

pub fn emit_fee_collected(env: &Env, amount: i128) {
    env.events().publish(
        (Symbol::new(env, "flash_loan"), symbol_short!("fee")),
        amount
    );
}
