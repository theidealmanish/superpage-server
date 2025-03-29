// wallet information of the users
import mongoose from 'mongoose';

interface WalletOptions {
	transactionId: string;
	accountId: string;
	accountPrivateKey: string;
	accountPublicKey: string;
}

interface Wallet extends mongoose.Document {
	user: mongoose.Schema.Types.ObjectId;
	hedera: WalletOptions;
	stellar: WalletOptions;
}

const walletSchema = new mongoose.Schema<Wallet>({
	user: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
	hedera: {
		transactionId: String,
		accountId: String,
		accountPrivateKey: String,
		accountPublicKey: String,
	},
	stellar: {
		transactionId: String,
		accountId: String,
		accountPrivateKey: String,
		accountPublicKey: String,
	},
});

const Wallet = mongoose.model<Wallet>('Wallet', walletSchema);
export default Wallet;
