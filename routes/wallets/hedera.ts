import express from 'express';
import {
	createAccount,
	fundTransaction,
} from '../../controllers/wallets/hedera';
import { isLoggedIn } from 'controllers/auth';

const router = express.Router();

router.post('/create-account', isLoggedIn, createAccount);
router.post('/transfer', isLoggedIn, fundTransaction);

export default router;
