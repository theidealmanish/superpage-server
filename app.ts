import express from 'express';
import { Request, Response } from 'express';
import connectDB from './utils/connectDB';
import globalError from './controllers/globalError';
import notFound from './controllers/notFound';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

dotenv.config();

// route imports
import authRoutes from './routes/auth';
import profileRoutes from './routes/profile';
import hederaRoutes from './routes/wallets/hedera';
import stellarRoutes from './routes/wallets/stellar';

// init app
const app = express();

// constants
const PORT = process.env.PORT || 8000;
const DB = process.env.DB || '';

// connect to database
connectDB(DB);

// middleware
app.use(
	cors({
		origin: [
			'http://localhost:3000',
			'chrome-extension://hfikebhkbbmbngalhmdlbgicambjpljg',
			'https://www.youtube.com',
			'https://youtube.com',
		],
		methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
		allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
		credentials: true,
		preflightContinue: false,
		optionsSuccessStatus: 204,
	})
);
app.use(morgan('dev'));
app.use(express.json());

// routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);

// wallets routes
app.use('/api/wallets/hedera', hederaRoutes);
app.use('/api/wallets/stellar', stellarRoutes);

// not found
app.use('*', notFound);

// global error handler
app.use(globalError);

app.get('/', (req: Request, res: Response) => {
	res.json({ message: 'Hello World' });
});

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});
