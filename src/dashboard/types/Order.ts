// types/Order.ts - ENHANCED with per-item fulfillment support

export interface CustomField {
    title: string;
    translatedTitle?: string;
    value: any;
}

export interface ExtendedFields {
    namespaces?: Record<string, Record<string, any>>;
}

export interface FullAddressContactDetails {
    company?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
}

export interface BillingInfo {
    address?: Address;
    contactDetails?: FullAddressContactDetails;
    vatId?: VatId;
    paymentMethod?: string;
    paymentProviderTransactionId?: string;
    externalTransactionId?: string;
}

export interface VatId {
    type?: string;
    number?: string;
}

// ===== ENHANCED FULFILLMENT TYPES =====

export interface ItemFulfillment {
    id: string;
    quantity: number;
}

export interface PerItemTrackingInfo {
    trackingNumber: string;
    trackingUrl?: string;
    carrier?: string;
    quantity: number;
    fulfillmentId?: string;
    fulfillmentDate?: string;
    itemId?: string;
    itemName?: string;
}

export interface EnhancedFulfillmentDetails {
    // Individual fulfillments for this line item
    lineItemFulfillment?: Array<{
        quantity: number;
        fulfillmentId: string;
        trackingNumber?: string;
        trackingUrl?: string;
        carrier?: string;
        fulfillmentDate?: string;
    }>;
    // Aggregated tracking info for display
    trackingInfo?: PerItemTrackingInfo[];
    // Total fulfilled across all fulfillments for this item
    totalFulfilled?: number;
}

export interface FulfillmentResponse {
    success: boolean;
    method?: string;
    message?: string;
    error?: string;
    fulfillmentId?: string;
    emailSent?: boolean;
    isPartialFulfillment?: boolean;
    isPerItemFulfillment?: boolean;
    isTrackingUpdate?: boolean;
    result?: any;
    trackingNumber?: string;
    orderFulfillmentStatus?: OrderStatus;
    fulfilledItems?: Array<{
        itemId: string;
        quantity: number;
    }>;
    orderWithFulfillments?: {
        orderId: string;
        fulfillments: Array<{
            _id: string;
            _createdDate: string;
            lineItems: Array<{
                _id: string;
                quantity: number;
            }>;
            trackingInfo?: {
                trackingNumber: string;
                shippingProvider: string;
                trackingLink?: string;
            };
            status?: string;
            completed?: boolean;
        }>;
    };
    emailInfo?: {
        emailRequested?: boolean;
        emailSentAutomatically?: boolean;
        customerEmail?: string;
        note?: string;
    };
}

export interface FulfillOrderParams {
    orderId: string;
    trackingNumber: string;
    shippingProvider: string;
    orderNumber: string;
    trackingUrl?: string;
    sendShippingEmail?: boolean;
    selectedItems?: ItemFulfillment[];
    editMode?: boolean;
    existingFulfillmentId?: string;
}

// ===== ORDER STATUS TYPES =====

export type OrderStatus = 'NOT_FULFILLED' | 'PARTIALLY_FULFILLED' | 'FULFILLED' | 'CANCELED';
export type PaymentStatus =
    | 'PAID'
    | 'UNPAID'
    | 'PARTIALLY_PAID'
    | 'PENDING'
    | 'AUTHORIZED'
    | 'DECLINED'
    | 'CANCELED'
    | 'FULLY_REFUNDED'
    | 'PARTIALLY_REFUNDED'
    | 'PENDING_REFUND';
export type FulfillmentStatus = 'NOT_FULFILLED' | 'PARTIALLY_FULFILLED' | 'FULFILLED';

// ===== CUSTOMER AND ADDRESS TYPES =====

export interface Customer {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    company?: string;
}

export interface ShippingAddress {
    firstName?: string;
    lastName?: string;
    company?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    subdivision?: string;
    subdivisionFullname?: string;
    country?: string;
    countryFullname?: string;
    postalCode?: string;
    phone?: string;
    streetAddress?: {
        name?: string;
        number?: string;
        apt?: string;
    };
}

export interface Address {
    firstName?: string;
    lastName?: string;
    company?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    subdivision?: string;
    subdivisionFullname?: string;
    country?: string;
    countryFullname?: string;
    postalCode?: string;
    phone?: string;
    streetAddress?: {
        name?: string;
        number?: string;
        apt?: string;
    };
}

export interface RecipientInfo {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    contactDetails?: {
        firstName?: string;
        lastName?: string;
        phone?: string;
        email?: string;
        company?: string;
        address?: Address;
    };
}

// ===== ENHANCED LINE ITEM TYPES =====

export interface OrderItem {
    name: string;
    quantity: number;
    price: string;
    weight?: number;
    sku?: string;
    productId?: string;
    variantId?: string;
    image?: string;
    _id?: string;
    id?: string;

    // Product name variations
    productName?: string | { original?: string; translated?: string };

    // ENHANCED: Fulfillment tracking with per-item support
    fulfilledQuantity?: number;
    remainingQuantity?: number;
    fulfillmentStatus?: FulfillmentStatus;
    fulfillmentDetails?: EnhancedFulfillmentDetails;

    // Additional Wix-specific properties
    catalogReference?: {
        catalogItemId?: string;
        appId?: string;
        options?: Record<string, any>;
    };

    // Physical properties
    physicalProperties?: {
        weight?: number;
        sku?: string;
        dimensions?: {
            height?: number;
            width?: number;
            length?: number;
        };
    };

    // Price details
    priceData?: {
        price?: number;
        currency?: string;
        formattedPrice?: string;
    };
}

export interface OrderLineItem {
    _id: string;
    id?: string;
    quantity: number;

    // ENHANCED: Fulfillment information with per-item support
    fulfilledQuantity?: number;
    remainingQuantity?: number;
    fulfillmentStatus?: FulfillmentStatus;
    fulfillmentDetails?: EnhancedFulfillmentDetails;

    // Product information
    productName?: string | { original?: string; translated?: string };
    name?: string;

    // Catalog reference
    catalogReference?: {
        catalogItemId?: string;
        appId?: string;
        options?: Record<string, any>;
    };

    // Price information
    price?: {
        amount?: number;
        currency?: string;
        formattedAmount?: string;
    };

    // Physical properties
    physicalProperties?: {
        weight?: number;
        sku?: string;
    };

    // Image
    image?: string;

    // Description lines for product options
    descriptionLines?: Array<{
        name?: { original: string };
        plainText?: { original: string };
        color?: string;
        lineType?: string;
    }>;

    // Additional properties
    lineItemType?: string;
    productType?: string;
    brand?: string;
    ribbon?: string;

    // Custom fields
    customTextFields?: Array<{
        title: string;
        value: string;
    }>;
}

// ===== SHIPPING AND ORDER INFO =====

export interface ShippingInfo {
    carrierId: string;
    title: string;
    cost: string;
}

// ===== MAIN ORDER INTERFACE =====

export interface Order {
    _id: string;
    number: string;
    _createdDate: string;
    customer: Customer;

    // ENHANCED: Made items optional since lineItems is the primary source
    items?: OrderItem[];

    // ENHANCED: Updated lineItems to use enhanced interface
    lineItems?: OrderLineItem[];

    totalWeight: number;
    total: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    shippingInfo: ShippingInfo;
    weightUnit: string;
    shippingAddress?: Address;
    billingInfo?: BillingInfo;
    recipientInfo?: RecipientInfo;
    buyerNote?: string;
    rawOrder?: any; // Keep for backward compatibility
    customFields?: CustomField[];
    extendedFields?: ExtendedFields;

    // ENHANCED: Additional Wix-specific properties
    fulfillmentStatus?: string;
    archived?: boolean;
    read?: boolean;
    priceSummary?: {
        subtotal?: {
            amount?: number;
            currency?: string;
            formattedAmount?: string;
        };
        shipping?: {
            amount?: number;
            currency?: string;
            formattedAmount?: string;
        };
        tax?: {
            amount?: number;
            currency?: string;
            formattedAmount?: string;
        };
        discount?: {
            amount?: number;
            currency?: string;
            formattedAmount?: string;
        };
        total?: {
            amount?: number;
            currency?: string;
            formattedAmount?: string;
        };
    };

    // Buyer information
    buyerInfo?: {
        id?: string;
        identityType?: string;
        email?: string;
        phone?: string;
        firstName?: string;
        lastName?: string;
    };

    // Channel information
    channelInfo?: {
        type?: string;
        externalOrderId?: string;
        externalOrderUrl?: string;
    };

    // Timestamps
    _updatedDate?: string;
    dateCreated?: string;
    lastUpdated?: string;
}

// ===== UTILITY TYPES =====

export type SafeOrderItem = OrderItem | OrderLineItem;

export interface OrdersResponse {
    success: boolean;
    method?: string;
    orders: Order[];
    orderCount: number;
    pagination: {
        hasNext: boolean;
        nextCursor: string;
        prevCursor: string;
    };
    message?: string;
    error?: string;
    ecomError?: string;
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

export interface BackendOrdersResponse {
    success: boolean;
    method?: string;
    orders?: any[];
    orderCount?: number;
    pagination?: {
        hasNext: boolean;
        nextCursor: string;
        prevCursor: string;
    };
    message?: string;
    error?: string;
    ecomError?: string;
}

export interface BackendSingleOrderResponse {
    success: boolean;
    order?: any;
    error?: string;
}

export interface QueryOrdersResponse {
    success: boolean;
    orders: Order[];
    totalCount: number;
    hasNext: boolean;
    error?: string;
}

// ===== ENHANCED FULFILLMENT CAPABILITY TYPES =====

export interface OrderFulfillmentCapabilities {
    canAddTracking: boolean;
    canEditTracking: boolean;
    canFulfillFully: boolean;
    canFulfillPartially: boolean;
    hasUnfulfilledItems: boolean;
    hasFulfilledItems: boolean;
    isFullyFulfilled: boolean;
    isPartiallyFulfilled: boolean;
    fulfillmentSummary: {
        totalItems: number;
        fulfilledItems: number;
        remainingItems: number;
    };
}

export interface UnfulfilledItem {
    id: string;
    name: string;
    quantity: number;
    fulfilledQuantity: number;
    remainingQuantity: number;
    sku?: string;
    image?: string;
    trackingInfo?: PerItemTrackingInfo[];
}

export interface FulfillmentValidationResult {
    isValid: boolean;
    errors: string[];
    validItems: ItemFulfillment[];
    invalidItems: Array<{
        item: ItemFulfillment;
        error: string;
    }>;
}

// ===== UTILITY FUNCTIONS FOR SAFE PROPERTY ACCESS =====

export const getItemId = (item: SafeOrderItem): string | undefined => {
    return item._id || item.id;
};

export const getItemName = (item: SafeOrderItem): string => {
    if (typeof item.productName === 'string') {
        return item.productName;
    }
    if (typeof item.productName === 'object' && item.productName?.original) {
        return item.productName.original;
    }
    if ('name' in item && item.name) {
        return item.name;
    }
    return 'Unknown Product';
};

export const getItemQuantity = (item: SafeOrderItem): number => {
    return item.quantity || 1;
};

export const getFulfilledQuantity = (item: SafeOrderItem): number => {
    if ('fulfilledQuantity' in item && typeof item.fulfilledQuantity === 'number') {
        return item.fulfilledQuantity;
    }

    // Check fulfillment details if available
    if ('fulfillmentDetails' in item && item.fulfillmentDetails?.lineItemFulfillment) {
        return item.fulfillmentDetails.lineItemFulfillment.reduce(
            (total, fulfillment) => total + (fulfillment.quantity || 0),
            0
        );
    }

    // Check total fulfilled from enhanced fulfillment details
    if ('fulfillmentDetails' in item && item.fulfillmentDetails?.totalFulfilled) {
        return item.fulfillmentDetails.totalFulfilled;
    }

    return 0;
};

export const getRemainingQuantity = (item: SafeOrderItem): number => {
    if ('remainingQuantity' in item && typeof item.remainingQuantity === 'number') {
        return item.remainingQuantity;
    }

    const total = getItemQuantity(item);
    const fulfilled = getFulfilledQuantity(item);
    return Math.max(0, total - fulfilled);
};

export const canItemBeFulfilled = (item: SafeOrderItem): boolean => {
    return getRemainingQuantity(item) > 0;
};

export const getItemFulfillmentStatus = (item: SafeOrderItem): FulfillmentStatus => {
    if ('fulfillmentStatus' in item && item.fulfillmentStatus) {
        return item.fulfillmentStatus;
    }

    const total = getItemQuantity(item);
    const fulfilled = getFulfilledQuantity(item);

    if (fulfilled >= total) return 'FULFILLED';
    if (fulfilled > 0) return 'PARTIALLY_FULFILLED';
    return 'NOT_FULFILLED';
};

export const getItemTrackingInfo = (item: SafeOrderItem): PerItemTrackingInfo[] => {
    if ('fulfillmentDetails' in item && item.fulfillmentDetails?.trackingInfo) {
        return item.fulfillmentDetails.trackingInfo;
    }

    if ('fulfillmentDetails' in item && item.fulfillmentDetails?.lineItemFulfillment) {
        return item.fulfillmentDetails.lineItemFulfillment
            .filter(fulfillment => fulfillment.trackingNumber)
            .map(fulfillment => ({
                trackingNumber: fulfillment.trackingNumber!,
                trackingUrl: fulfillment.trackingUrl,
                carrier: fulfillment.carrier,
                quantity: fulfillment.quantity,
                fulfillmentId: fulfillment.fulfillmentId,
                fulfillmentDate: fulfillment.fulfillmentDate
            }));
    }

    return [];
};

export const hasItemTracking = (item: SafeOrderItem): boolean => {
    return getItemTrackingInfo(item).length > 0;
};

// ===== TYPE GUARDS =====

export const isOrderLineItem = (item: SafeOrderItem): item is OrderLineItem => {
    return '_id' in item || 'catalogReference' in item;
};

export const isOrderItem = (item: SafeOrderItem): item is OrderItem => {
    return 'name' in item;
};

export const hasEnhancedFulfillmentDetails = (item: SafeOrderItem): item is OrderLineItem & { fulfillmentDetails: EnhancedFulfillmentDetails } => {
    return 'fulfillmentDetails' in item && !!item.fulfillmentDetails;
};

// ===== ORDER FULFILLMENT UTILITY FUNCTIONS =====

export const calculateOrderFulfillmentStatus = (order: Order): {
    status: OrderStatus;
    totalItems: number;
    fulfilledItems: number;
    remainingItems: number;
    hasTracking: boolean;
} => {
    const lineItems = order.rawOrder?.lineItems || order.lineItems || [];

    let totalItems = 0;
    let fulfilledItems = 0;
    let hasTracking = false;

    lineItems.forEach((item: SafeOrderItem) => {
        const quantity = getItemQuantity(item);
        const fulfilled = getFulfilledQuantity(item);

        totalItems += quantity;
        fulfilledItems += fulfilled;

        if (hasItemTracking(item)) {
            hasTracking = true;
        }
    });

    const remainingItems = totalItems - fulfilledItems;

    let status: OrderStatus;
    if (fulfilledItems >= totalItems && totalItems > 0) {
        status = 'FULFILLED';
    } else if (fulfilledItems > 0) {
        status = 'PARTIALLY_FULFILLED';
    } else {
        status = 'NOT_FULFILLED';
    }

    return {
        status,
        totalItems,
        fulfilledItems,
        remainingItems,
        hasTracking
    };
};

export const getOrderUnfulfilledItems = (order: Order): UnfulfilledItem[] => {
    const lineItems = order.rawOrder?.lineItems || order.lineItems || [];

    return lineItems
        .filter((item: SafeOrderItem) => canItemBeFulfilled(item))
        .map((item: SafeOrderItem) => ({
            id: getItemId(item) || '',
            name: getItemName(item),
            quantity: getItemQuantity(item),
            fulfilledQuantity: getFulfilledQuantity(item),
            remainingQuantity: getRemainingQuantity(item),
            sku: item.physicalProperties?.sku || item.catalogReference?.catalogItemId,
            image: item.image,
            trackingInfo: getItemTrackingInfo(item)
        }));
};