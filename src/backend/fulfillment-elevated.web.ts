// src/backend/fulfillment-elevated.web.ts - FIXED for true partial fulfillment

import { webMethod, Permissions } from '@wix/web-methods';
import { auth } from '@wix/essentials';
import { orderFulfillments, orders } from '@wix/ecom';

// Safe utility functions for backend use
const safeGetItemQuantity = (item: any): number => {
    return item?.quantity || 1;
};

const safeGetFulfilledQuantity = (item: any): number => {
    return item?.fulfilledQuantity ||
        item?.fulfillmentDetails?.totalFulfilled ||
        item?.totalFulfilledQuantity ||
        0;
};

const safeGetRemainingQuantity = (item: any): number => {
    const total = safeGetItemQuantity(item);
    const fulfilled = safeGetFulfilledQuantity(item);
    return Math.max(0, total - fulfilled);
};

const safeGetItemId = (item: any): string => {
    return item?._id || item?.id || item?.lineItemId || '';
};

interface FulfillmentLineItem {
    id: string;
    quantity: number;
}

// FIXED: Enhanced smart fulfillment that properly handles partial fulfillment
export const smartFulfillOrderElevated = webMethod(
    Permissions.Anyone,
    async ({
        orderId,
        trackingNumber,
        shippingProvider,
        orderNumber,
        sendShippingEmail = true,
        lineItems = [],
        trackingUrl,
        customCarrierName
    }: {
        orderId: string;
        trackingNumber: string;
        shippingProvider: string;
        orderNumber: string;
        sendShippingEmail?: boolean;
        lineItems?: FulfillmentLineItem[];
        trackingUrl?: string;
        customCarrierName?: string;
    }, context?) => {
        // Enhanced CORS handling for production
        const requestHeaders = context?.request?.headers || {};
        const origin = requestHeaders['origin'] || requestHeaders['Origin'] || '*';
        
        const enhancedCorsHeaders = {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Max-Age': '86400',
            'Vary': 'Origin'
        };

        // Handle OPTIONS method for CORS preflight
        if (context?.request?.method === 'OPTIONS') {
            return {
                success: true,
                headers: enhancedCorsHeaders,
                statusCode: 200,
                message: 'CORS preflight successful'
            };
        }

        try {
            const fulfillmentsCheck = await getFulfillmentsElevated({ orderId, orderNumber });

            if (!fulfillmentsCheck.success) {
                throw new Error(`Failed to check existing fulfillments: ${fulfillmentsCheck.error}`);
            }

            if (fulfillmentsCheck.hasExistingFulfillments && fulfillmentsCheck.fulfillments.length > 0) {
                const existingFulfillment = fulfillmentsCheck.fulfillments[0];
                const fulfillmentId = existingFulfillment._id;

                if (!fulfillmentId) {
                    throw new Error(`Existing fulfillment found but missing ID for order ${orderNumber}`);
                }

                if (sendShippingEmail) {
                    const result = await updateFulfillmentElevated({
                        orderId,
                        fulfillmentId,
                        trackingNumber,
                        shippingProvider,
                        orderNumber,
                        sendShippingEmail,
                        trackingUrl,
                        customCarrierName
                    });
                    return { ...result, headers: enhancedCorsHeaders };
                } else {
                    const result = await updateFulfillmentRegular({
                        orderId,
                        fulfillmentId,
                        trackingNumber,
                        shippingProvider,
                        orderNumber,
                        sendShippingEmail,
                        trackingUrl,
                        customCarrierName
                    });
                    return { ...result, headers: enhancedCorsHeaders };
                }
            } else {
                if (sendShippingEmail) {
                    const result = await createFulfillmentElevated({
                        orderId,
                        trackingNumber,
                        shippingProvider,
                        orderNumber,
                        sendShippingEmail,
                        lineItems,
                        trackingUrl,
                        customCarrierName
                    });
                    return { ...result, headers: enhancedCorsHeaders };
                } else {
                    const result = await createFulfillmentRegular({
                        orderId,
                        trackingNumber,
                        shippingProvider,
                        orderNumber,
                        sendShippingEmail,
                        lineItems,
                        trackingUrl,
                        customCarrierName
                    });
                    return { ...result, headers: enhancedCorsHeaders };
                }
            }

        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);

            return {
                success: false,
                error: errorMsg,
                message: `Smart fulfillment failed for order ${orderNumber}: ${errorMsg}`,
                method: 'smartFulfillOrderElevated',
                headers: enhancedCorsHeaders
            };
        }
    }
);

// FIXED: Create fulfillment with REGULAR permissions and partial support
export const createFulfillmentRegular = webMethod(
    Permissions.Anyone,
    async ({
        orderId,
        trackingNumber,
        shippingProvider,
        orderNumber,
        sendShippingEmail = false,
        lineItems = [],
        trackingUrl,
        customCarrierName
    }: {
        orderId: string;
        trackingNumber: string;
        shippingProvider: string;
        orderNumber: string;
        sendShippingEmail?: boolean;
        lineItems?: FulfillmentLineItem[];
        trackingUrl?: string;
        customCarrierName?: string;
    }) => {
        const isPartialFulfillment = !!(lineItems && lineItems.length > 0);

        try {
            // Get order details with elevated permissions (read-only)
            const elevatedGetOrder = auth.elevate(orders.getOrder);
            const orderDetails = await elevatedGetOrder(orderId);

            if (!orderDetails) {
                throw new Error(`Order ${orderNumber} not found`);
            }

            if (!orderDetails.lineItems || orderDetails.lineItems.length === 0) {
                throw new Error(`Order ${orderNumber} has no line items to fulfill`);
            }

            // Enhanced carrier mapping
            const carrierMapping: Record<string, string> = {
                'dhl': 'dhl',
                'ups': 'ups',
                'fedex': 'fedex',
                'usps': 'usps',
                'canada-post': 'canadaPost',
                'royal-mail': 'royalMail',
                'australia-post': 'australiaPost',
                'deutsche-post': 'deutschePost',
                'la-poste': 'laPoste',
                'japan-post': 'japanPost',
                'china-post': 'chinaPost',
                'tnt': 'tnt',
                'aramex': 'aramex',
                'other': 'other',
                'custom': 'other'
            };

            const mappedCarrier = carrierMapping[shippingProvider.toLowerCase()] || 'other';

            // FIXED: Prepare line items based on fulfillment type
            let fulfillmentLineItems: Array<{ _id: string; quantity: number }>;

            if (isPartialFulfillment) {
                const orderItemMap = new Map();
                orderDetails.lineItems.forEach((item: any) => {
                    const itemId = safeGetItemId(item);
                    orderItemMap.set(itemId, item);
                });

                fulfillmentLineItems = lineItems
                    .filter(requestedItem => {
                        const orderItem = orderItemMap.get(requestedItem.id);
                        if (!orderItem) {
                            console.warn(`⚠️ REGULAR: Item ${requestedItem.id} not found in order ${orderNumber}`);
                            return false;
                        }

                        const remainingQuantity = safeGetRemainingQuantity(orderItem);
                        if (requestedItem.quantity > remainingQuantity) {
                            console.warn(`⚠️ REGULAR: Requested quantity ${requestedItem.quantity} exceeds remaining ${remainingQuantity} for item ${requestedItem.id}`);
                            return false;
                        }

                        return true;
                    })
                    .map(requestedItem => {
                        return {
                            _id: requestedItem.id,
                            quantity: requestedItem.quantity
                        };
                    });

                if (fulfillmentLineItems.length === 0) {
                    throw new Error(`No valid line items found for partial fulfillment of order ${orderNumber}`);
                }

            } else {
                fulfillmentLineItems = orderDetails.lineItems.map((item: any) => {
                    const itemId = safeGetItemId(item);
                    const remainingQuantity = safeGetRemainingQuantity(item);
                    const quantityToFulfill = remainingQuantity > 0 ? remainingQuantity : safeGetItemQuantity(item);

                    return {
                        _id: itemId,
                        quantity: quantityToFulfill
                    };
                }).filter(item => item._id); // Only include items with valid IDs
            }

            // Build tracking info object - FIXED
            const finalShippingProvider = customCarrierName || mappedCarrier;

            // Build the tracking info object properly
            const trackingInfo: any = {
                trackingNumber: trackingNumber,
                shippingProvider: finalShippingProvider
            };

            // Only add trackingLink if trackingUrl is provided and not empty
            if (trackingUrl && trackingUrl.trim()) {
                trackingInfo.trackingLink = trackingUrl.trim();
            }

            const fulfillmentData = {
                lineItems: fulfillmentLineItems,
                trackingInfo: trackingInfo,
                status: 'Fulfilled'
            };

            const fulfillmentResult = await orderFulfillments.createFulfillment(orderId, fulfillmentData);

            return {
                success: true,
                method: 'createFulfillmentRegular',
                fulfillmentId: fulfillmentResult.fulfillmentId,
                message: isPartialFulfillment
                    ? `Order ${orderNumber} partially fulfilled (${fulfillmentLineItems.length} items) with tracking: ${trackingNumber} (no email sent)`
                    : `Order ${orderNumber} fulfilled successfully with tracking: ${trackingNumber} (no email sent)`,
                emailSent: false,
                isPartialFulfillment,
                result: fulfillmentResult
            };

        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                error: errorMsg,
                message: `Failed to create fulfillment for order ${orderNumber}: ${errorMsg}`,
                method: 'createFulfillmentRegular'
            };
        }
    }
);

export const createFulfillmentElevated = webMethod(
    Permissions.Anyone,
    async ({
        orderId,
        trackingNumber,
        shippingProvider,
        orderNumber,
        sendShippingEmail = true,
        lineItems = [],
        trackingUrl,
        customCarrierName
    }: {
        orderId: string;
        trackingNumber: string;
        shippingProvider: string;
        orderNumber: string;
        sendShippingEmail?: boolean;
        lineItems?: FulfillmentLineItem[];
        trackingUrl?: string;
        customCarrierName?: string;
    }) => {
        const isPartialFulfillment = lineItems && lineItems.length > 0;

        try {
            // Get order details first with elevated permissions
            const elevatedGetOrder = auth.elevate(orders.getOrder);
            const orderDetails = await elevatedGetOrder(orderId);

            if (!orderDetails) {
                throw new Error(`Order ${orderNumber} not found`);
            }

            if (!orderDetails.lineItems || orderDetails.lineItems.length === 0) {
                throw new Error(`Order ${orderNumber} has no line items to fulfill`);
            }

            // Enhanced carrier mapping
            const carrierMapping: Record<string, string> = {
                'dhl': 'dhl',
                'ups': 'ups',
                'fedex': 'fedex',
                'usps': 'usps',
                'canada-post': 'canadaPost',
                'royal-mail': 'royalMail',
                'australia-post': 'australiaPost',
                'deutsche-post': 'deutschePost',
                'la-poste': 'laPoste',
                'japan-post': 'japanPost',
                'china-post': 'chinaPost',
                'tnt': 'tnt',
                'aramex': 'aramex',
                'other': 'other',
                'custom': 'other'  // Map custom to other
            };

            const mappedCarrier = carrierMapping[shippingProvider.toLowerCase()] || 'other';

            // Prepare line items for fulfillment
            let fulfillmentLineItems: Array<{ _id: string; quantity: number }> = [];

            if (isPartialFulfillment) {

                // Validate that the specified items exist in the order
                const orderItemMap = new Map();
                orderDetails.lineItems.forEach((item: any) => {
                    const itemId = safeGetItemId(item);
                    orderItemMap.set(itemId, item);
                });

                fulfillmentLineItems = lineItems
                    .filter(requestedItem => {
                        const orderItem = orderItemMap.get(requestedItem.id);
                        if (!orderItem) {
                            console.warn(`⚠️ ELEVATED: Item ${requestedItem.id} not found in order ${orderNumber}`);
                            return false;
                        }

                        const remainingQuantity = safeGetRemainingQuantity(orderItem);
                        if (requestedItem.quantity > remainingQuantity) {
                            console.warn(`⚠️ ELEVATED: Requested quantity ${requestedItem.quantity} exceeds remaining ${remainingQuantity} for item ${requestedItem.id}`);
                            return false;
                        }

                        return true;
                    })
                    .map(requestedItem => {
                        return {
                            _id: requestedItem.id,
                            quantity: requestedItem.quantity
                        };
                    });

                if (fulfillmentLineItems.length === 0) {
                    throw new Error(`No valid line items found for partial fulfillment of order ${orderNumber}`);
                }

            } else {

                // Process all line items with their remaining quantities
                fulfillmentLineItems = orderDetails.lineItems
                    .map((item: any) => {
                        const itemId = safeGetItemId(item);
                        const remainingQuantity = safeGetRemainingQuantity(item);
                        const quantityToFulfill = remainingQuantity > 0 ? remainingQuantity : safeGetItemQuantity(item);

                        return {
                            _id: itemId,
                            quantity: quantityToFulfill
                        };
                    })
                    .filter(item => item._id); // Only include items with valid IDs
            }

            // Build tracking info object - FIXED
            const finalShippingProvider = customCarrierName || mappedCarrier;

            // Build the tracking info object properly
            const trackingInfo: any = {
                trackingNumber: trackingNumber,
                shippingProvider: finalShippingProvider
            };

            // Only add trackingLink if trackingUrl is provided and not empty
            if (trackingUrl && trackingUrl.trim()) {
                trackingInfo.trackingLink = trackingUrl.trim();
            }

            const fulfillmentData = {
                lineItems: fulfillmentLineItems,
                trackingInfo: trackingInfo,
                status: 'Fulfilled'
            };

            const elevatedCreateFulfillment = auth.elevate(orderFulfillments.createFulfillment);
            const fulfillmentResult = await elevatedCreateFulfillment(orderId, fulfillmentData);

            return {
                success: true,
                method: 'createFulfillmentElevated',
                fulfillmentId: fulfillmentResult.fulfillmentId,
                message: isPartialFulfillment
                    ? `Order ${orderNumber} partially fulfilled (${fulfillmentLineItems.length} items) with tracking: ${trackingNumber}`
                    : `Order ${orderNumber} fulfilled successfully with tracking: ${trackingNumber}`,
                emailSent: true, // Elevated permissions always send emails
                isPartialFulfillment,
                result: fulfillmentResult
            };

        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);

            return {
                success: false,
                error: errorMsg,
                message: `Failed to create fulfillment for order ${orderNumber}: ${errorMsg}`,
                method: 'createFulfillmentElevated'
            };
        }
    }
);

export const updateFulfillmentRegular = webMethod(
    Permissions.Anyone,
    async ({
        orderId,
        fulfillmentId,
        trackingNumber,
        shippingProvider,
        orderNumber,
        sendShippingEmail = false,
        trackingUrl,
        customCarrierName
    }: {
        orderId: string;
        fulfillmentId: string;
        trackingNumber: string;
        shippingProvider: string;
        orderNumber: string;
        sendShippingEmail?: boolean;
        trackingUrl?: string;
        customCarrierName?: string;
    }) => {
        try {
            const elevatedGetOrder = auth.elevate(orders.getOrder);
            const orderDetails = await elevatedGetOrder(orderId);

            const carrierMapping: Record<string, string> = {
                'dhl': 'dhl', 'ups': 'ups', 'fedex': 'fedex', 'usps': 'usps',
                'canada-post': 'canadaPost', 'royal-mail': 'royalMail',
                'australia-post': 'australiaPost', 'deutsche-post': 'deutschePost',
                'la-poste': 'laPoste', 'japan-post': 'japanPost',
                'china-post': 'chinaPost', 'tnt': 'tnt', 'aramex': 'aramex', 'other': 'other'
            };

            const mappedCarrier = carrierMapping[shippingProvider.toLowerCase()] || 'other';
            const finalShippingProvider = customCarrierName || mappedCarrier;

            // Build tracking info object properly
            const trackingInfo: any = {
                trackingNumber: trackingNumber,
                shippingProvider: finalShippingProvider
            };

            // Only add trackingLink if trackingUrl is provided and not empty
            if (trackingUrl && trackingUrl.trim()) {
                trackingInfo.trackingLink = trackingUrl.trim();
            }

            const identifiers = { orderId: orderId, fulfillmentId: fulfillmentId };
            const options = {
                fulfillment: {
                    trackingInfo: trackingInfo
                }
            };

            const updateResult = await orderFulfillments.updateFulfillment(identifiers, options);

            return {
                success: true,
                method: 'updateFulfillmentRegular',
                message: `Tracking updated for order ${orderNumber}: ${trackingNumber} (no email sent)`,
                emailSent: false,
                result: updateResult
            };

        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);

            return {
                success: false,
                error: errorMsg,
                message: `Failed to update fulfillment for order ${orderNumber}: ${errorMsg}`,
                method: 'updateFulfillmentRegular'
            };
        }
    }
);

export const updateFulfillmentElevated = webMethod(
    Permissions.Anyone,
    async ({
        orderId,
        fulfillmentId,
        trackingNumber,
        shippingProvider,
        orderNumber,
        sendShippingEmail = true,
        trackingUrl,
        customCarrierName
    }: {
        orderId: string;
        fulfillmentId: string;
        trackingNumber: string;
        shippingProvider: string;
        orderNumber: string;
        sendShippingEmail?: boolean;
        trackingUrl?: string;
        customCarrierName?: string;
    }) => {

        try {
            const elevatedGetOrder = auth.elevate(orders.getOrder);
            const orderDetails = await elevatedGetOrder(orderId);

            const carrierMapping: Record<string, string> = {
                'dhl': 'dhl', 'ups': 'ups', 'fedex': 'fedex', 'usps': 'usps',
                'canada-post': 'canadaPost', 'royal-mail': 'royalMail',
                'australia-post': 'australiaPost', 'deutsche-post': 'deutschePost',
                'la-poste': 'laPoste', 'japan-post': 'japanPost',
                'china-post': 'chinaPost', 'tnt': 'tnt', 'aramex': 'aramex', 'other': 'other'
            };

            const mappedCarrier = carrierMapping[shippingProvider.toLowerCase()] || 'other';
            const finalShippingProvider = customCarrierName || mappedCarrier;

            // Build tracking info object properly
            const trackingInfo: any = {
                trackingNumber: trackingNumber,
                shippingProvider: finalShippingProvider
            };

            // Only add trackingLink if trackingUrl is provided and not empty
            if (trackingUrl && trackingUrl.trim()) {
                trackingInfo.trackingLink = trackingUrl.trim();
            }

            const identifiers = { orderId: orderId, fulfillmentId: fulfillmentId };
            const options = {
                fulfillment: {
                    trackingInfo: trackingInfo
                }
            };

            const elevatedUpdateFulfillment = auth.elevate(orderFulfillments.updateFulfillment);
            const updateResult = await elevatedUpdateFulfillment(identifiers, options);

            return {
                success: true,
                method: 'updateFulfillmentElevated',
                message: `Tracking updated for order ${orderNumber}: ${trackingNumber}`,
                emailSent: true,
                result: updateResult
            };

        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);

            return {
                success: false,
                error: errorMsg,
                message: `Failed to update fulfillment for order ${orderNumber}: ${errorMsg}`,
                method: 'updateFulfillmentElevated'
            };
        }
    }
);

export const getFulfillmentsElevated = webMethod(
    Permissions.Anyone,
    async ({
        orderId,
        orderNumber
    }: {
        orderId: string;
        orderNumber: string;
    }) => {

        try {
            const elevatedListFulfillments = auth.elevate(orderFulfillments.listFulfillmentsForSingleOrder);
            const existingFulfillments = await elevatedListFulfillments(orderId);

            const fulfillmentsArray = existingFulfillments?.orderWithFulfillments?.fulfillments || [];
            const hasExistingFulfillments = fulfillmentsArray.length > 0;

            return {
                success: true,
                method: 'getFulfillmentsElevated',
                hasExistingFulfillments,
                fulfillments: fulfillmentsArray,
                result: existingFulfillments
            };

        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                error: errorMsg,
                message: `Failed to get fulfillments for order ${orderNumber}: ${errorMsg}`,
                method: 'getFulfillmentsElevated',
                hasExistingFulfillments: false,
                fulfillments: []
            };
        }
    }
);