import { z } from "zod";

export const loginSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase().trim()),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const registerSchema = loginSchema.extend({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(80, "Name must be 80 characters or fewer.")
    .optional()
    .or(z.literal("")),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
