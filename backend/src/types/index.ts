import { Request } from 'express';

export interface AuthUser {
    id: string;
    email: string;
    role: 'RIDER' | 'DRIVER' | 'ADMIN';
}

export interface AuthRequest extends Request {
    user?: AuthUser;
}

export interface ApiResponse<T = any> {
    success: boolean;
    message: string;
    data?: T;
    error?: string;
}

export interface Location {
    lat: number;
    lng: number;
    address: string;
}