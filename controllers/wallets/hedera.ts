import {
	AccountId,
	PrivateKey,
	Client,
	AccountCreateTransaction,
	Hbar,
	TransferTransaction,
} from '@hashgraph/sdk';
import catchAsync from '../../utils/catchAsync';
import { configDotenv } from 'dotenv';
import { Request, Response, NextFunction } from 'express';
import AppError from 'utils/AppError';
import Wallet from 'models/wallet';
import { RequestWithAuth } from 'types/request';
configDotenv();

// setup client
const client = Client.forTestnet();

export const createHederaAccount = catchAsync(
	async (req: RequestWithAuth, res: Response, next: NextFunction) => {
		// Operator account ID and private key from string value
		const OPERATOR_ACCOUNT_ID = AccountId.fromString(
			process.env.HEDERA_OPERATOR_ID || ''
		);
		const OPERATOR_PRIVATE_KEY = PrivateKey.fromStringECDSA(
			process.env.HEDERA_OPERATOR_KEY || ''
		);

		console.log('OPERATOR_ACCOUNT_ID', OPERATOR_ACCOUNT_ID);
		console.log('OPERATOR_PRIVATE_KEY', OPERATOR_PRIVATE_KEY);

		//Set the operator with the account ID and private key
		client.setOperator(OPERATOR_ACCOUNT_ID, OPERATOR_PRIVATE_KEY);

		// Generate a new key for the account
		const accountPrivateKey = PrivateKey.generateECDSA();
		const accountPublicKey = accountPrivateKey.publicKey;

		console.log(req.auth.id);

		const txCreateAccount = new AccountCreateTransaction()
			.setAlias(accountPublicKey.toEvmAddress()) //Do NOT set an alias if you need to update/rotate keys
			.setKey(accountPublicKey)
			.setInitialBalance(new Hbar(10));

		//Sign the transaction with the client operator private key and submit to a Hedera network
		const txCreateAccountResponse = await txCreateAccount.execute(client);

		//Request the receipt of the transaction
		const receiptCreateAccountTx =
			await txCreateAccountResponse.getReceipt(client);

		if (!receiptCreateAccountTx) {
			throw new Error(
				`Account creation failed. Transaction ID: ${txCreateAccountResponse.transactionId}`
			);
		}

		//Get the transaction consensus status
		const statusCreateAccountTx = receiptCreateAccountTx.status;

		//Get the Account ID o
		const accountId = receiptCreateAccountTx.accountId;

		//Get the Transaction ID
		const txIdAccountCreated = txCreateAccountResponse.transactionId.toString();
		if (!accountId) {
			return next(AppError.badRequest('Account Creation failed'));
		}

		// save the wallet
		const wallet = await Wallet.findOne({ user: req.auth.id });
		if (wallet) {
			return next(AppError.badRequest('Wallet already exists'));
		}

		const newWallet = await Wallet.create({
			user: req.auth.id,
			hedera: {
				transactionId: txIdAccountCreated,
				accountId: accountId.toString(),
				accountPrivateKey: accountPrivateKey.toString(),
				accountPublicKey: accountPublicKey.toString(),
			},
		});

		client.close();
		return res.status(200).json({
			status: 'success',
			message: 'Hedera account created successfully',
			receiptStatus: statusCreateAccountTx.toString(),
			transactionId: txIdAccountCreated,
			hashscanUrl: `https://hashscan.io/testnet/tx/${txIdAccountCreated}`,
			accountId: accountId!.toString(),
			privateKey: accountPrivateKey.toString(),
			publicKey: accountPublicKey.toString(),
			wallet: newWallet,
		});
	}
);

export const transactionInHedera = catchAsync(
	async (req: RequestWithAuth, res: Response, next: NextFunction) => {
		const { to, amount } = req.body;
		const id = req.auth.id;
		// get the user account
		const fromWallet = await Wallet.findOne({ user: id });

		if (!fromWallet) {
			return next(AppError.badRequest('Wallet not found'));
		}

		if (!fromWallet.hedera.accountId) {
			return next(AppError.badRequest('Hedera account not found'));
		}

		// Your account ID and private key from string value
		const fromAccountId = AccountId.fromString(fromWallet.hedera.accountId);
		const fromAccountPKey = PrivateKey.fromStringECDSA(
			fromWallet.hedera.accountPrivateKey
		);

		client.setOperator(fromAccountId, fromAccountPKey);
		const toAccountId = AccountId.fromString(to);

		if (!toAccountId) {
			return next(AppError.badRequest('To account not found'));
		}

		const transaction = new TransferTransaction()
			.addHbarTransfer(fromAccountId, -amount)
			.addHbarTransfer(toAccountId, amount);
		const txResponse = await transaction.execute(client);
		const receipt = await txResponse.getReceipt(client);

		return res.status(200).json({
			status: 'success',
			message: 'Transaction successful',
			transactionId: txResponse.transactionId.toString(),
			hashscanUrl: `https://hashscan.io/testnet/tx/${txResponse.transactionId.toString()}`,
		});
	}
);
