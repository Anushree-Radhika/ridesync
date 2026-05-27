import { Response } from 'express';
import { ApiResponse } from '../types';

export const sendSuccess = <T>(
    res: Response,
    message: string,
    data?: T,
    statusCode = 200
): void => {
    res.status(statusCode).json({
        success: true,
        message,
        data,
    } as ApiResponse<T>);
};

export const sendError = (
    res: Response,
    message: string,
    statusCode = 500,
    error?: string
): void => {
    res.status(statusCode).json({
        success: false,
        message,
        error,
    } as ApiResponse);
};