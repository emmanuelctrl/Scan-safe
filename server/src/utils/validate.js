// Helper that runs a Zod schema against request data and converts any
// validation failure into a clean 400 ApiError.
import ApiError from './ApiError.js';

export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    throw ApiError.badRequest('Validation failed', details);
  }
  return result.data;
}
