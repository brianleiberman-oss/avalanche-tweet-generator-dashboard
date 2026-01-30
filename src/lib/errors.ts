/**
 * Error Handling Utilities
 *
 * Use specific error codes instead of generic messages.
 * This makes debugging easier and allows for proper error handling.
 */

import { ErrorCode, AppError, Result } from "../types";

/**
 * Create a standardized error object
 */
export function createError(
  code: ErrorCode,
  message: string,
  details?: unknown
): AppError {
  return { code, message, details };
}

/**
 * Create a success result
 */
export function success<T>(data: T): Result<T> {
  return { success: true, data };
}

/**
 * Create a failure result
 */
export function failure<T>(error: AppError): Result<T> {
  return { success: false, error };
}

/**
 * Create a failure result from an error code
 */
export function fail<T>(
  code: ErrorCode,
  message: string,
  details?: unknown
): Result<T> {
  return failure(createError(code, message, details));
}

/**
 * Log error with consistent format
 */
export function logError(context: string, error: AppError): void {
  console.error(`[${context}] Error ${error.code}: ${error.message}`);
  if (error.details) {
    console.error(`  Details:`, error.details);
  }
}

/**
 * Wrap async function with error handling
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  context: string
): Promise<Result<T>> {
  try {
    const data = await fn();
    return success(data);
  } catch (error) {
    const appError = createError(
      ErrorCode.UNKNOWN_ERROR,
      error instanceof Error ? error.message : "Unknown error",
      error
    );
    logError(context, appError);
    return failure(appError);
  }
}

/**
 * Check if result is successful (type guard)
 */
export function isSuccess<T>(result: Result<T>): result is { success: true; data: T } {
  return result.success === true;
}

/**
 * Check if result is failure (type guard)
 */
export function isFailure<T>(result: Result<T>): result is { success: false; error: AppError } {
  return result.success === false;
}

/**
 * Unwrap result or throw
 */
export function unwrap<T>(result: Result<T>): T {
  if (isSuccess(result)) {
    return result.data;
  }
  throw new Error(`${result.error.code}: ${result.error.message}`);
}

/**
 * Unwrap result or return default
 */
export function unwrapOr<T>(result: Result<T>, defaultValue: T): T {
  if (isSuccess(result)) {
    return result.data;
  }
  return defaultValue;
}
