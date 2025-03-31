import * as StellarSdk from '@stellar/stellar-sdk';
import { Request, Response, NextFunction } from 'express';
import catchAsync from '../../utils/catchAsync';
import AppError from '../../utils/AppError';
import { RequestWithAuth } from 'types/request';
import axios from 'axios';
import Wallet from 'models/wallet';
import Profile from 'models/profile';

// Configure Stellar SDK (using testnet for development)
const server = new StellarSdk.Horizon.Server(
	'https://horizon-testnet.stellar.org'
);

export const createAccount = catchAsync(
	async (req: RequestWithAuth, res: Response, next: NextFunction) => {
		const userId = req.auth.id;
		const pair = StellarSdk.Keypair.random();
		// Fund the account using friendbot (testnet only)
		axios
			.get(`https://friendbot.stellar.org?addr=${pair.publicKey()}`)
			.then((response) => {
				console.log(response.data);
			})
			.catch((error) => {
				console.error(
					'Friendbot error:',
					error.response?.data || error.message
				);
				throw new Error('Failed to fund account with Friendbot');
			});

		// check if the wallet already exists
		const existingWallet = await Wallet.findOne({ userId });

		if (existingWallet && existingWallet.stellar) {
			return next(AppError.badRequest('Account already exists'));
		}

		if (existingWallet) {
			existingWallet.stellar = {
				accountPublicKey: pair.publicKey(),
				accountPrivateKey: pair.secret(),
				accountId: pair.publicKey(),
				transactionId: 'null',
			};
			await existingWallet.save();
			return res.status(200).json({
				status: 'success',
				message: 'Stellar account updated successfully',
				data: {
					wallet: existingWallet,
				},
			});
		}

		// Create a new wallet
		// Store the account in the database
		const wallet = await Wallet.create({
			user: userId,
			stellar: {
				accountPublicKey: pair.publicKey(),
				accountPrivateKey: pair.secret(),
				accountId: pair.publicKey(),
				transactionId: 'null',
			},
		});

		if (!pair) {
			return next(AppError.badRequest('Failed to create account'));
		}

		res.status(201).json({
			status: 'success',
			message: 'Stellar account created successfully',
			data: {
				publicKey: pair.publicKey(),
				secretKey: pair.secret(),
			},
			wallet: wallet,
		});
	}
);

export const getAccountBalance = catchAsync(
	async (req: RequestWithAuth, res: Response, next: NextFunction) => {
		const userId = req.auth.id;
		const wallet = await Wallet.findOne({ user: userId });

		if (!wallet || !wallet.stellar) {
			return next(AppError.notFound('Wallet not found'));
		}

		try {
			const account = await server.loadAccount(wallet.stellar.accountPublicKey);
			const balances = account.balances.map((balance: any) => ({
				asset: balance.asset_type === 'native' ? 'XLM' : balance.asset_code,
				balance: balance.balance,
			}));

			res.status(200).json({
				status: 'success',
				data: balances,
			});
		} catch (error) {
			console.error('Error getting balance:', error);
			return next(new AppError('Failed to get account balance', 500));
		}
	}
);

export const fundTransaction = catchAsync(
	async (req: RequestWithAuth, res: Response, next: NextFunction) => {
		const userId = req.auth.id;
		const { to, amount, message, platform } = req.body;

		const wallet = await Wallet.findOne({ user: userId });
		if (!wallet || !wallet.stellar) {
			return next(AppError.notFound('Wallet not found'));
		}

		// If you need to find by another platform dynamically:
		let searchQuery = {};
		if (platform === 'youtube') {
			searchQuery = { 'socials.youtube': to };
		} else if (platform === 'twitter') {
			searchQuery = { 'socials.twitter': to };
		} else if (platform === 'facebook') {
			searchQuery = { 'socials.facebook': to };
		} else if (platform === 'linkedin') {
			searchQuery = { 'socials.linkedin': to };
		} else if (platform === 'github') {
			searchQuery = { 'socials.github': to };
		}

		const profile = await Profile.findOne(searchQuery).populate('user');
		if (!profile) {
			return next(AppError.notFound('Profile not found'));
		}

		// check for the profile wallet from the userId
		console.log(profile.user._id.toString());
		const profileWallet = await Wallet.findOne({
			user: profile.user._id.toString(),
		});
		console.log({ profileWallet });
		if (!profileWallet || !profileWallet.stellar) {
			return next(AppError.notFound('Profile wallet not found'));
		}
		const toWallet = profileWallet.stellar.accountPublicKey;

		const fromSecret = wallet.stellar.accountPrivateKey;
		const fromPublic = wallet.stellar.accountPublicKey;

		const sourceKeypair = StellarSdk.Keypair.fromSecret(fromSecret);
		const sourceAccount = await server.loadAccount(fromPublic);

		// Determine the asset type (native XLM or custom asset)
		let asset = StellarSdk.Asset.native();

		const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
			fee: StellarSdk.BASE_FEE,
			networkPassphrase: StellarSdk.Networks.TESTNET,
		})
			.addOperation(
				StellarSdk.Operation.payment({
					destination: toWallet,
					asset: asset,
					amount: amount.toString(),
				})
			)
			.setTimeout(180)
			.addMemo(
				StellarSdk.Memo.text(
					message || `Payment from ${fromPublic} to ${toWallet}`
				)
			)
			.build();

		transaction.sign(sourceKeypair);
		const result = await server.submitTransaction(transaction);
		res.status(200).json({
			status: 'success',
			message: 'Transaction successful',
			data: {
				transactionHash: result.hash,
			},
		});
	}
);

export const getAccountTransactions = catchAsync(
	async (req: RequestWithAuth, res: Response, next: NextFunction) => {
		const userId = req.auth.id;

		// get wallet
		const wallet = await Wallet.findOne({ user: userId });
		if (!wallet || !wallet.stellar) {
			return next(AppError.notFound('Wallet not found'));
		}

		const publicKey = wallet.stellar.accountPublicKey;

		if (!publicKey) {
			return next(new AppError('Public key is required', 400));
		}

		try {
			const transactions = await server
				.transactions()
				.forAccount(publicKey)
				.order('desc')
				.limit(10)
				.call();

			const transactionDetails = await Promise.all(
				transactions.records.map(async (tx) => {
					const operations = await tx.operations();
					return operations.records.map((op: any) => ({
						id: tx.id,
						type: op.type,
						amount: op.amount,
						asset: op.asset_type === 'native' ? 'XLM' : op.asset_code,
						timestamp: tx.created_at,
						from: op.from || tx.source_account,
						to: op.to,
					}));
				})
			);

			res.status(200).json({
				status: 'success',
				results: transactionDetails.flat().length,
				data: transactionDetails.flat(),
			});
		} catch (error) {
			console.error('Error fetching transactions:', error);
			return next(new AppError('Failed to fetch transaction history', 500));
		}
	}
);

export const getWalletByUser = catchAsync(
	async (req: RequestWithAuth, res: Response, next: NextFunction) => {
		const userId = req.auth.id;

		const wallet = await Wallet.findOne({ user: userId }).select(
			'stellar.accountId'
		);
		if (!wallet) {
			return next(AppError.notFound('Wallet not found'));
		}

		res.status(200).json({
			status: 'success',
			data: wallet,
		});
	}
);

export const getSupportedAssets = catchAsync(
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const assets = await server.assets().call();
			const formattedAssets = assets.records.map((asset) => ({
				code: asset.asset_code || 'XLM',
				issuer: asset.asset_issuer,
				type: asset.asset_type,
			}));

			res.status(200).json({
				status: 'success',
				results: formattedAssets.length,
				data: formattedAssets,
			});
		} catch (error) {
			console.error('Error fetching assets:', error);
			return next(new AppError('Failed to fetch supported assets', 500));
		}
	}
);
