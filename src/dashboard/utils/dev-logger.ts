// utils/dev-logger.ts - Development-only logging utility

const isDevelopment = () => {
    return process.env.NODE_ENV !== 'production' && 
           (window.location.hostname.includes('localhost') || 
            window.location.hostname.includes('127.0.0.1'));
};

/**
 * Log messages only in development environment
 */
export const devLog = {
    info: (message: string, ...args: any[]) => {
        if (isDevelopment()) {
            console.log(`ℹ️ [DEV] ${message}`, ...args);
        }
    },
    
    debug: (message: string, ...args: any[]) => {
        if (isDevelopment()) {
            console.debug(`🔍 [DEBUG] ${message}`, ...args);
        }
    },
    
    warn: (message: string, ...args: any[]) => {
        if (isDevelopment()) {
            console.warn(`⚠️ [DEV-WARN] ${message}`, ...args);
        }
    },
    
    // Always log errors, but add DEV prefix in development
    error: (message: string, ...args: any[]) => {
        const prefix = isDevelopment() ? '❌ [DEV-ERROR]' : '❌ [ERROR]';
        console.error(`${prefix} ${message}`, ...args);
    }
};

/**
 * Performance timing helper for development
 */
export const devTiming = {
    start: (label: string): number => {
        if (isDevelopment()) {
            console.time(`⏱️ [TIMING] ${label}`);
        }
        return Date.now();
    },
    
    end: (label: string, startTime?: number) => {
        if (isDevelopment()) {
            if (startTime) {
                const duration = Date.now() - startTime;
                console.log(`⏱️ [TIMING] ${label}: ${duration}ms`);
            } else {
                console.timeEnd(`⏱️ [TIMING] ${label}`);
            }
        }
    }
};