use soroban_sdk::{contracttype, Address};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,                    // admin address
    Token,                    // token address
    Car(Address),             // car associated to owner
    Rental(Address, Address), // renter-owner
}
