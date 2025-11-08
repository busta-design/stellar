import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Operation,
  Transaction,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { AccountBalance } from "../interfaces/account";
import { IAccountBalanceResponse } from "../interfaces/balance";
import { IKeypair } from "../interfaces/kaypair";
import {
  HORIZON_NETWORK_PASSPHRASE,
  HORIZON_URL,
  STELLAR_FRIENDBOT_URL,
  STELLAR_NETWORK,
} from "../utils/contansts";

export class StellarService {
  private network: string;
  private horizonUrl: string;
  private server: Horizon.Server;
  private friendBotUrl: string;
  private networkPassphrase: string;

  constructor() {
    this.network = STELLAR_NETWORK as string;
    this.horizonUrl = HORIZON_URL as string;
    this.friendBotUrl = STELLAR_FRIENDBOT_URL as string;
    this.networkPassphrase = HORIZON_NETWORK_PASSPHRASE as string;

    this.server = new Horizon.Server(this.horizonUrl, {
      allowHttp: true,
    });
  }

  private async getAccount(address: string): Promise<Horizon.AccountResponse> {
    try {
      return await this.server.loadAccount(address);
    } catch (error) {
      console.log(error);
      throw new Error("Account not found");
    }
  }

  async getAccountBalance(publicKey: string): Promise<AccountBalance[]> {
    const account = await this.getAccount(publicKey);

    return account.balances.map((b) => ({
      assetCode:
        b.asset_type === "native"
          ? "XLM"
          : (b as IAccountBalanceResponse).asset_code,

      amount: b.balance,
    }));
  }

  createAccount(): IKeypair {
    const pair = Keypair.random();
    return {
      publicKey: pair.publicKey(),
      secretKey: pair.secret(),
    };
  }

  async fundAccount(publicKey: string): Promise<boolean> {
    try {
      if (this.network !== "testnet") {
        throw new Error("Friendbot is only available on testnet");
      }

      const response = await fetch(`${this.friendBotUrl}?addr=${publicKey}`);

      if (!response.ok) {
        return false;
      }

      return true;
    } catch (error: unknown) {
      throw new Error(
        `Error when funding account with Friendbot: ${error as string}`
      );
    }
  }

  private async loadAccount(address: string): Promise<Horizon.AccountResponse> {
    try {
      return await this.server.loadAccount(address);
    } catch (error) {
      console.error(error);
      throw new Error("Account not found");
    }
  }

  private transactionBuilder(sourceAccount: Horizon.AccountResponse) {
    return new TransactionBuilder(sourceAccount, {
      networkPassphrase: this.networkPassphrase,
      fee: BASE_FEE,
    });
  }

  private createPaymentOperation(
    amount: string,
    asset: Asset,
    destination: string
  ): xdr.Operation<Operation> {
    return Operation.payment({
      amount,
      asset,
      destination,
    });
  }

  async payment(
    senderPubKey: string,
    senderSecret: string,
    receiverPubKey: string,
    amount: string
  ): Promise<Horizon.HorizonApi.SubmitTransactionResponse> {
    const sourceAccount = await this.loadAccount(senderPubKey);
    const sourceKeypair = Keypair.fromSecret(senderSecret);

    const transactionBuilder = this.transactionBuilder(sourceAccount);
    const paymentOperation = this.createPaymentOperation(
      amount,
      Asset.native(),
      receiverPubKey
    );

    const transaction = transactionBuilder
      .addOperation(paymentOperation)
      .setTimeout(180)
      .build();

    transaction.sign(sourceKeypair);

    return await this.submitTransaction(transaction);
  }

  private async submitTransaction(
    transaction: Transaction
  ): Promise<Horizon.HorizonApi.SubmitTransactionResponse> {
    try {
      return await this.server.submitTransaction(transaction);
    } catch (error) {
      console.error(error);
      if (error.response?.data?.extras?.result_codes) {
        console.error(
          "❌ Error en la transacción:",
          error.response.data.extras.result_codes
        );
      } else {
        console.error("❌ Error general:", error);
      }
    }
  }
}

export const stellarService = new StellarService();
