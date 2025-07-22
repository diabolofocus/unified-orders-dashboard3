// utils/clipboard.ts

/**
 * Copy text to clipboard with fallback support
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
    if (!text) {
        console.warn('No text provided to copy to clipboard');
        return false;
    }

    try {
        // Modern Clipboard API (preferred method)
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }

        // Fallback for older browsers or non-secure contexts
        return await fallbackCopyToClipboard(text);

    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        return false;
    }
};

/**
 * Fallback clipboard method for older browsers
 */
const fallbackCopyToClipboard = async (text: string): Promise<boolean> => {
    try {
        // Create temporary textarea element
        const textArea = document.createElement('textarea');
        textArea.value = text;

        // Make it invisible but accessible
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        textArea.style.opacity = '0';
        textArea.setAttribute('readonly', '');

        // Add to DOM
        document.body.appendChild(textArea);

        // Select and copy
        textArea.focus();
        textArea.select();
        textArea.setSelectionRange(0, 99999); // For mobile devices

        const result = document.execCommand('copy');

        // Clean up
        document.body.removeChild(textArea);

        return result;

    } catch (error) {
        console.error('Fallback clipboard copy failed:', error);
        return false;
    }
};

/**
 * Read text from clipboard (if supported)
 */
export const readFromClipboard = async (): Promise<string | null> => {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            return await navigator.clipboard.readText();
        }

        console.warn('Clipboard read not supported in this context');
        return null;

    } catch (error) {
        console.error('Failed to read from clipboard:', error);
        return null;
    }
};

/**
 * Check if clipboard operations are supported
 */
export const isClipboardSupported = (): boolean => {
    return !!(navigator.clipboard || document.execCommand);
};

/**
 * Copy multiple items to clipboard (formatted)
 */
export const copyFormattedData = async (data: Record<string, string>, format: 'json' | 'csv' | 'lines' = 'lines'): Promise<boolean> => {
    let formattedText: string;

    switch (format) {
        case 'json':
            formattedText = JSON.stringify(data, null, 2);
            break;

        case 'csv':
            const entries = Object.entries(data);
            const headers = entries.map(([key]) => key).join(',');
            const values = entries.map(([, value]) => `"${value}"`).join(',');
            formattedText = `${headers}\n${values}`;
            break;

        case 'lines':
        default:
            formattedText = Object.entries(data)
                .map(([key, value]) => `${key}: ${value}`)
                .join('\n');
            break;
    }

    return await copyToClipboard(formattedText);
};

/**
 * Copy order information to clipboard
 */
export const copyOrderInfo = async (order: {
    number: string;
    customer: { firstName: string; lastName: string; email: string };
    total: string;
}): Promise<boolean> => {
    const orderData = {
        'Order Number': order.number,
        'Customer': `${order.customer.firstName} ${order.customer.lastName}`,
        'Email': order.customer.email,
        'Total': order.total
    };

    return await copyFormattedData(orderData);
};

/**
 * Copy shipping address to clipboard
 */
export const copyShippingAddress = async (address: {
    streetAddress?: { name: string; number: string; apt?: string };
    addressLine1?: string;
    addressLine2?: string;
    city: string;
    postalCode: string;
    country: string;
}): Promise<boolean> => {
    const addressLines: string[] = [];

    // Add street address
    if (address.streetAddress?.name || address.streetAddress?.number) {
        const street = `${address.streetAddress.name || ''} ${address.streetAddress.number || ''}`.trim();
        if (street) addressLines.push(street);

        if (address.streetAddress.apt) {
            addressLines.push(address.streetAddress.apt);
        }
    } else if (address.addressLine1) {
        addressLines.push(address.addressLine1);
        if (address.addressLine2) {
            addressLines.push(address.addressLine2);
        }
    }

    // Add city, postal code, country
    const cityLine = `${address.postalCode} ${address.city}`.trim();
    if (cityLine) addressLines.push(cityLine);

    if (address.country) addressLines.push(address.country);

    return await copyToClipboard(addressLines.join('\n'));
};