use soroban_sdk::contracttype;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Token,
    FeeBP,
    ReentrancyGuard,
}
