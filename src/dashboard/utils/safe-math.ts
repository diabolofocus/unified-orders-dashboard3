// utils/safe-math.ts - Safe math operations to prevent NaN and invalid dimensions

/**
 * Safely parse a numeric value, returning 0 for invalid values
 */
export const safeParseFloat = (value: any): number => {
    if (typeof value === 'number') {
        return isNaN(value) ? 0 : Math.max(0, value);
    }
    
    if (typeof value === 'string') {
        const parsed = parseFloat(value.replace(/[^0-9.-]+/g, ''));
        return isNaN(parsed) ? 0 : Math.max(0, parsed);
    }
    
    return 0;
};

/**
 * Safely parse an integer value, returning 0 for invalid values
 */
export const safeParseInt = (value: any): number => {
    if (typeof value === 'number') {
        return isNaN(value) ? 0 : Math.max(0, Math.floor(value));
    }
    
    if (typeof value === 'string') {
        const parsed = parseInt(value.replace(/[^0-9-]+/g, ''), 10);
        return isNaN(parsed) ? 0 : Math.max(0, parsed);
    }
    
    return 0;
};

/**
 * Safely calculate percentage, avoiding division by zero and NaN
 */
export const safePercentage = (value: number, total: number): number => {
    const safeValue = safeParseFloat(value);
    const safeTotal = safeParseFloat(total);
    
    if (safeTotal === 0) return 0;
    return Math.max(0, Math.min(100, (safeValue / safeTotal) * 100));
};

/**
 * Safely calculate percentage change, avoiding division by zero and NaN
 */
export const safePercentageChange = (current: number, previous: number): number => {
    const safeCurrent = safeParseFloat(current);
    const safePrevious = safeParseFloat(previous);
    
    if (safePrevious === 0) {
        return safeCurrent > 0 ? 100 : 0;
    }
    
    const change = ((safeCurrent - safePrevious) / safePrevious) * 100;
    return isNaN(change) ? 0 : Math.round(change);
};

/**
 * Safely get valid dimensions for SVG elements
 */
export const safeDimensions = (width: any, height: any): { width: number; height: number } => {
    const safeWidth = Math.max(1, safeParseFloat(width));
    const safeHeight = Math.max(1, safeParseFloat(height));
    
    return {
        width: safeWidth,
        height: safeHeight
    };
};

/**
 * Safely calculate average, avoiding division by zero
 */
export const safeAverage = (total: number, count: number): number => {
    const safeTotal = safeParseFloat(total);
    const safeCount = safeParseFloat(count);
    
    if (safeCount === 0) return 0;
    return safeTotal / safeCount;
};

/**
 * Ensure a numeric value is finite and not NaN
 */
export const ensureFinite = (value: any, fallback: number = 0): number => {
    const num = Number(value);
    return isFinite(num) ? num : fallback;
};

/**
 * Ensure a value is a positive number for dimensions
 */
export const ensurePositive = (value: any, fallback: number = 1): number => {
    const num = ensureFinite(value, fallback);
    return Math.max(fallback, num);
};