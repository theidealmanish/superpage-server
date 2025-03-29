import express from 'express';
import {
	createHederaAccount,
	transactionInHedera,
} from '../../controllers/wallets/hedera';
import { isLoggedIn } from 'controllers/auth';

const router = express.Router();

router.post('/create-wallet', isLoggedIn, createHederaAccount);
router.post('/transfer', isLoggedIn, transactionInHedera);

export default router;
