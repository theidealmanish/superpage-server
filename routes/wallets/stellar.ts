import express from 'express';
import {
	createAccount,
	fundTransaction,
	getAccountBalance,
	getAccountTransactions,
	getSupportedAssets,
	getWalletByUser,
} from '../../controllers/wallets/stellar';
import { isLoggedIn } from 'controllers/auth';

const router = express.Router();

router.post('/create-account', isLoggedIn, createAccount);
router.post('/transfer', isLoggedIn, fundTransaction);
router.get('/transactions', isLoggedIn, getAccountTransactions);
router.get('/get-assets', getSupportedAssets);
router.get('/get-account-balance', isLoggedIn, getAccountBalance);
router.get('/get-wallet', isLoggedIn, getWalletByUser);

export default router;
