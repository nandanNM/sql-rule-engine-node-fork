import { Response } from "express";

interface ApiSuccessResponse<T = unknown> {
  response: true;
  message: string;
  data?: T;
  token?: string;
}

interface ApiErrorResponse {
  response: false;
  error: string;
  error_code?: string;
  details?: unknown;
}

/**
 * Standardized success response
 */
export const ApiSuccess = <T = unknown>(
  res: Response,
  message: string,
  statusCode: number = 200,
  data?: T,
  token?: string,
): void => {
  const response: ApiSuccessResponse<T> = {
    response: true,
    message,
    ...(data !== undefined && { data }),
    ...(token && { token }),
  };
  res.status(statusCode).json(response);
};

export const ApiError = (
  res: Response,
  error: string,
  statusCode: number = 500,
  details?: unknown,
  errorCode?: string,
): void => {
  const response: ApiErrorResponse = {
    response: false,
    error,
    ...(errorCode !== undefined && { error_code: errorCode }),
    ...(details !== undefined && { details }),
  };
  res.status(statusCode).json(response);
};

export const ApiResponse = ApiSuccess;

/* Developer notes */
// Standard response format:
// response: { response: true, message: "...", data?: {...}, token?: "..." }
// Error: { response: false, error: "...", details?: {...} }
//
// This ensures frontend always knows if request succeeded by checking 'response' field
