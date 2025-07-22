// utils/formatters.ts
export const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

export const formatCurrency = (amount: string | number): string => {
    if (typeof amount === 'string') {
        if (amount.includes('$') || amount.includes('€')) return amount;
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount)) return amount;
        return `$${numAmount.toFixed(2)}`;
    }
    return `$${amount.toFixed(2)}`;
};

export const formatWeight = (weight: number, unit: string = 'KG'): string => {
    if (weight === 0) return '0';
    return `${weight.toFixed(2)} ${unit}`;
};

export const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
};