import { z } from "zod";

// ============================================
// Validation Result Type
// ============================================
export type ValidationResult<T> = { success: true; data: T } | { success: false; error: string };

export const validateSchema = <T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errorMessages = result.error.issues
      .map((err: z.ZodIssue) => `${err.path.join(".")}: ${err.message}`)
      .join(", ");
    return { success: false, error: errorMessages };
  }
  return { success: true, data: result.data };
};

// ============================================
// API Validation Schemas
// ============================================

// Schema names validation
const schemaNameSchema = z.enum(["ecommerce", "banking", "social", "inventory", "analytics"], {
  error: "schema_name must be one of: ecommerce, banking, social, inventory, analytics",
});

// Normalize endpoint schema
export const normalizeSchema = z.object({
  sql: z.string().min(1, "SQL query is required").max(5000, "SQL query cannot exceed 5000 characters"),
});

// Fingerprint endpoint schema
export const fingerprintSchema = z.object({
  sql: z.string().min(1, "SQL query is required").max(5000, "SQL query cannot exceed 5000 characters"),
  schema_name: schemaNameSchema,
  problem_id: z.string().optional(),
});

// Rules endpoint schema
export const rulesSchema = z.object({
  sql: z.string().min(1, "SQL query is required").max(5000, "SQL query cannot exceed 5000 characters"),
});

// Evaluate endpoint schema
export const evaluateSchema = z.object({
  sql: z.string().min(1, "SQL query is required").max(5000, "SQL query cannot exceed 5000 characters"),
  schema_name: schemaNameSchema,
  problem_id: z.string().min(1, "Problem ID is required").max(100, "Problem ID cannot exceed 100 characters"),
});

// Problem ID param schema
export const problemIdParamSchema = z.object({
  problemId: z.string().min(1, "Problem ID is required").max(100, "Problem ID cannot exceed 100 characters"),
});

// Final Submit body schema
export const finalSubmitSchema = z.object({
  finalQuery: z.string().min(1, "Final SQL query is required").max(5000, "SQL query cannot exceed 5000 characters"),
  explanationText: z.string().max(2000, "Explanation cannot exceed 2000 characters").optional().default(""),
  edgeCaseText: z.string().max(2000, "Edge case text cannot exceed 2000 characters").optional().default(""),
});

// Session Question ID param schema
export const sessionQuestionIdParamSchema = z.object({
  sessionQuestionId: z.string().min(1, "Session Question ID is required").max(100),
});


export type NormalizeInput = z.infer<typeof normalizeSchema>;
export type FingerprintInput = z.infer<typeof fingerprintSchema>;
export type RulesInput = z.infer<typeof rulesSchema>;
export type EvaluateInput = z.infer<typeof evaluateSchema>;
export type ProblemIdParamInput = z.infer<typeof problemIdParamSchema>;
export type FinalSubmitInput = z.infer<typeof finalSubmitSchema>;
export type SessionQuestionIdParamInput = z.infer<typeof sessionQuestionIdParamSchema>;
