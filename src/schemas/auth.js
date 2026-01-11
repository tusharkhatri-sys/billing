import { z } from 'zod';

// Login Schema
export const loginSchema = z.object({
    email: z.string().email({ message: "Invalid email address" }),
    password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

// Register Schema
export const registerSchema = z.object({
    businessName: z.string().min(2, { message: "Business Name is required" }),
    ownerName: z.string().min(2, { message: "Your Name is required" }),
    email: z.string().email({ message: "Invalid email address" }),
    phone: z.string().regex(/^[0-9]{10}$/, { message: "Phone number must be 10 digits" }),
    password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

// OTP Schema
export const otpSchema = z.object({
    email: z.string().email({ message: "Invalid email address" }),
    otp: z.string().min(6, { message: "OTP must be at least 6 digits" }).max(8, { message: "OTP must be at most 8 digits" }),
});

// Reset Password Schema
export const resetPasswordSchema = z.object({
    password: z.string().min(6, { message: "New password must be at least 6 characters" }),
    confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});
