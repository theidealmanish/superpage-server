import Profile from '../models/profile';
import User from '../models/user';
import { NextFunction, Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import AppError from '../utils/AppError';
import { RequestWithAuth } from 'types/request';

// Create a new profile
export const createProfile = catchAsync(
	async (req: RequestWithAuth, res: Response, next: NextFunction) => {
		const userId = req.auth.id;
		const { bio, country, socials } = req.body;

		// Check if user exists
		const user = await User.findById(userId);
		if (!user) {
			return next(new AppError('User not found', 404));
		}

		// Check if profile already exists for this user
		const existingProfile = await Profile.findOne({ user: userId });
		if (existingProfile) {
			return next(new AppError('Profile already exists for this user', 400));
		}

		const newProfile = await Profile.create({
			user: userId,
			bio,
			country,
			socials,
		});

		res.status(201).json({
			status: 'success',
			message: 'Profile created successfully',
			data: newProfile,
		});
	}
);

// // Get profile by user ID
// const getProfileByUserId = catchAsync(
// 	async (req: Request, res: Response, next: NextFunction) => {
// 		const userId = req.params.userId;
// 		console.log('userId', userId);
// 		const profile = await Profile.findOne({ user: userId }).populate(
// 			'user',
// 			'name username'
// 		);

// 		if (!profile) {
// 			return next(new AppError('Profile not found', 404));
// 		}

// 		res.status(200).json({
// 			status: 'success',
// 			data: profile,
// 		});
// 	}
// );

// Get profile by username
export const getProfileByUsername = catchAsync(
	async (req: Request, res: Response, next: NextFunction) => {
		const username = req.params.username;

		const user = await User.findOne({ username });

		if (!user) {
			return next(new AppError('User not found', 404));
		}

		const userId = user?._id;
		const profile = await Profile.findOne({ user: userId }).populate(
			'user',
			'name username walletAddress createdAt'
		);

		if (!profile) {
			return next(new AppError('Profile not found', 404));
		}

		res.status(200).json({
			status: 'success',
			data: profile,
		});
	}
);

// Get current user's profile
const getMyProfile = catchAsync(
	async (req: RequestWithAuth, res: Response, next: NextFunction) => {
		// Assuming req.user is set from authentication middleware
		const userId = req.auth.id;

		if (!userId) {
			return next(
				new AppError('You must be logged in to access your profile', 401)
			);
		}

		const profile = await Profile.findOne({ user: userId }).populate(
			'user',
			'name username email'
		);

		if (!profile) {
			return next(
				new AppError('Profile not found. Please create one first.', 404)
			);
		}

		res.status(200).json({
			status: 'success',
			data: profile,
		});
	}
);

// Update profile
export const updateProfile = catchAsync(
	async (req: RequestWithAuth, res: Response, next: NextFunction) => {
		// Assuming req.user is set from authentication middleware
		const userId = req.auth.id;

		if (!userId) {
			return next(
				new AppError('You must be logged in to update your profile', 401)
			);
		}

		const { bio, country, socials } = req.body;

		// Find profile by user ID
		const profile = await Profile.findOne({ user: userId });

		if (!profile) {
			return next(
				new AppError('Profile not found. Please create one first.', 404)
			);
		}

		// Update profile fields
		const updatedProfile = await Profile.findOneAndUpdate(
			{ user: userId },
			{
				bio: bio || profile.bio,
				country: country || profile.country,
				socials: {
					twitter: socials?.twitter || profile.socials?.twitter || '',
					facebook: socials?.facebook || profile.socials?.facebook || '',
					linkedin: socials?.linkedin || profile.socials?.linkedin || '',
					github: socials?.github || profile.socials?.github || '',
				},
			},
			{ new: true, runValidators: true }
		);

		res.status(200).json({
			status: 'success',
			message: 'Profile updated successfully',
			data: updatedProfile,
		});
	}
);

// Delete profile
export const deleteProfile = catchAsync(
	async (req: RequestWithAuth, res: Response, next: NextFunction) => {
		// Assuming req.user is set from authentication middleware
		const userId = req.auth.id;

		if (!userId) {
			return next(
				new AppError('You must be logged in to delete your profile', 401)
			);
		}

		const profile = await Profile.findOneAndDelete({ user: userId });

		if (!profile) {
			return next(new AppError('Profile not found', 404));
		}

		res.status(200).json({
			status: 'success',
			message: 'Profile deleted successfully',
			data: null,
		});
	}
);

// Update only social links
export const updateSocialLinks = catchAsync(
	async (req: RequestWithAuth, res: Response, next: NextFunction) => {
		// Assuming req.user is set from authentication middleware
		const userId = req.auth.id;

		if (!userId) {
			return next(
				new AppError('You must be logged in to update social links', 401)
			);
		}

		const { twitter, facebook, linkedin, github } = req.body;

		const profile = await Profile.findOne({ user: userId });

		if (!profile) {
			return next(
				new AppError('Profile not found. Please create one first.', 404)
			);
		}

		// Update only the social fields
		const updatedProfile = await Profile.findOneAndUpdate(
			{ user: userId },
			{
				socials: {
					twitter: twitter || profile.socials?.twitter || '',
					facebook: facebook || profile.socials?.facebook || '',
					linkedin: linkedin || profile.socials?.linkedin || '',
					github: github || profile.socials?.github || '',
				},
			},
			{ new: true, runValidators: true }
		);

		res.status(200).json({
			status: 'success',
			message: 'Social links updated successfully',
			data: updatedProfile,
		});
	}
);

// Search profiles by country
export const searchProfilesByCountry = catchAsync(
	async (req: Request, res: Response, next: NextFunction) => {
		const { country } = req.query;

		if (!country) {
			return next(new AppError('Country parameter is required', 400));
		}

		const profiles = await Profile.find({
			country: { $regex: country as string, $options: 'i' },
		}).populate('user', 'name username');

		res.status(200).json({
			status: 'success',
			results: profiles.length,
			data: profiles,
		});
	}
);
