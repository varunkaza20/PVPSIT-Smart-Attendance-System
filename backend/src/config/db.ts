import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pvpsit-attendance' /* local dev default, no credentials */;
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected successfully to:', mongoURI);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};
