import { z } from 'zod';

export const productSchema = z.object({
    name: z.string().min(2, "Product name must be at least 2 characters"),
    description: z.string().optional(),
    price: z.coerce.number().min(0, "Price must be a positive number"),
    cost_price: z.coerce.number().min(0, "Cost price must be a positive number").optional().default(0),
    stock: z.coerce.number().int().min(0, "Stock must be a non-negative integer"),
    sku: z.string().optional(), // Scan code / Barcode
    category: z.string().min(1, "Category is required"),
    image_url: z.string().url().optional().or(z.literal('')),
});
