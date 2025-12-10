import { Asset, Aurora, Keypair, Operation, BASE_FEE, TransactionBuilder, Claimant, xdr } from "diamnet-sdk";
import 'dotenv/config';
import logger from './logger';

const DIAMNET_SECRET_KEY = process.env.DIAMNET_SECRET_KEY;

interface ClaimableBalanceResult {
  success: boolean;
  balanceId: string;
  transactionHash: string;
}

/**
 * Creates a claimable balance for the specified destination address
 * @param destinationPublicKey - The public key of the destination account
 * @param amount - The amount to lock in the claimable balance (default: "5")
 * @returns The transaction result
 */
export async function createClaimableBalance(destinationPublicKey: string, amount: string = "5"): Promise<ClaimableBalanceResult> {
  if (!DIAMNET_SECRET_KEY) {
    throw new Error("DIAMNET_SECRET_KEY environment variable is not set");
  }

  const server = new Aurora.Server("https://diamtestnet.diamcircle.io/");
  const sourceKeypair = Keypair.fromSecret(DIAMNET_SECRET_KEY);

  try {
    const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());

    const claimant = new Claimant(
      destinationPublicKey,
      Claimant.predicateUnconditional()
    );

    const claimableBalanceOp = Operation.createClaimableBalance({
      asset: Asset.native(), // Asset type (DIAM in this case)
      amount: amount, // Amount to lock in the claimable balance
      claimants: [claimant], // Add the claimant to the claimable balance
    });

    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: "Diamante Testnet 2024",
    })
      .addOperation(claimableBalanceOp)
      .setTimeout(30)
      .build();

    transaction.sign(sourceKeypair);

    const result = await server.submitTransaction(transaction);
    logger.info("Transaction successful:", { hash: result.hash });
    
    let txResult = xdr.TransactionResult.fromXDR(
      result.result_xdr,
      "base64"
    );
    let results = txResult.result().results();
    
    let operationResult = results[0].value().createClaimableBalanceResult();
    let balanceId = operationResult.balanceId().toXDR("hex");
    
    return {
      success: true,
      balanceId: balanceId,
      transactionHash: result.hash
    };
  } catch (error: any) {
    logger.error("Transaction submission error:", error);
    throw error;
  }
}
