// backend/fulfillment-enhanced.web.ts - FIXED with safe property access

import { webMethod, Permissions } from '@wix/web-methods';
import { auth } from '@wix/essentials';
import { orderFulfillments, orders } from '@wix/ecom';

interface LineItemInput {
    id: string;
    quantity: number;
}

interface FulfillmentParams {
    orderId: string;
    trackingNumber: string;
    shippingProvider: string;
    orderNumber: string;
    sendShippingEmail?: boolean;
    lineItems?: LineItemInput[];
}

// FIXED: Safe utility functions for backend use
const safeGetItemQuantity = (item: any): number => {
    return item?.quantity || 1;
};

const safeGetFulfilledQuantity = (item: any): number => {
    // Try multiple possible properties for fulfilled quantity
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

// Enhanced smart fulfillment with better partial support
export const enhancedSmartFulfillment = webMethod(
    Permissions.Admin,
    async (params: FulfillmentParams) => {

        try {
            const orderResult = await getOrderWithFulfillments(params.orderId);

            if (!orderResult.success) {
                throw new Error(`Failed to get order details: ${orderResult.error}`);
            }

            const { order, existingFulfillments } = orderResult;

            if (existingFulfillments.length > 0) {
                const fulfillmentId = existingFulfillments[0]._id;

                if (!fulfillmentId) {
                    throw new Error(`Existing fulfillment found but has no valid ID for order ${params.orderNumber}`);
                }

                return await updateExistingFulfillment({
                    orderId: params.orderId,
                    fulfillmentId: fulfillmentId,
                    trackingNumber: params.trackingNumber,
                    shippingProvider: params.shippingProvider,
                    orderNumber: params.orderNumber,
                    sendShippingEmail: params.sendShippingEmail
                });
            } else {
                return await createNewFulfillment({
                    orderId: params.orderId,
                    order,
                    trackingNumber: params.trackingNumber,
                    shippingProvider: params.shippingProvider,
                    orderNumber: params.orderNumber,
                    sendShippingEmail: params.sendShippingEmail,
                    lineItems: params.lineItems
                });
            }

        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);

            return {
                success: false,
                error: errorMsg,
                message: `Smart fulfillment failed for order ${params.orderNumber}: ${errorMsg}`,
                method: 'enhancedSmartFulfillment'
            };
        }
    }
);

// Get order with its fulfillments
const getOrderWithFulfillments = async (orderId: string) => {
    try {
        // Get order details with elevated permissions
        const elevatedGetOrder = auth.elevate(orders.getOrder);
        const order = await elevatedGetOrder(orderId);

        if (!order) {
            throw new Error(`Order not found: ${orderId}`);
        }

        // Get existing fulfillments
        const elevatedListFulfillments = auth.elevate(orderFulfillments.listFulfillmentsForSingleOrder);
        const fulfillmentsResponse = await elevatedListFulfillments(orderId);

        const existingFulfillments = fulfillmentsResponse?.orderWithFulfillments?.fulfillments || [];

        return {
            success: true,
            order,
            existingFulfillments
        };

    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        return {
            success: false,
            error: errorMsg,
            order: null,
            existingFulfillments: []
        };
    }
};

// Create new fulfillment with partial support
const createNewFulfillment = async (params: {
    orderId: string;
    order: any;
    trackingNumber: string;
    shippingProvider: string;
    orderNumber: string;
    sendShippingEmail?: boolean;
    lineItems?: LineItemInput[];
}) => {
    try {
        const { order, lineItems } = params;

        if (!order.lineItems || order.lineItems.length === 0) {
            throw new Error(`Order ${params.orderNumber} has no line items to fulfill`);
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
            'other': 'other'
        };

        const mappedCarrier = carrierMapping[params.shippingProvider.toLowerCase()] || 'other';

        let fulfillmentLineItems: Array<{ _id: string; quantity: number }>;

        if (lineItems && lineItems.length > 0) {
            const orderItemIds = order.lineItems.map((item: any) => safeGetItemId(item));

            fulfillmentLineItems = lineItems
                .filter(item => {
                    const exists = orderItemIds.includes(item.id);
                    return exists && item.quantity > 0;
                })
                .map(item => ({
                    _id: item.id,
                    quantity: item.quantity
                }));

            if (fulfillmentLineItems.length === 0) {
                throw new Error(`No valid line items found for partial fulfillment of order ${params.orderNumber}`);
            }

        } else {
            fulfillmentLineItems = order.lineItems.map((item: any) => {
                const itemId = safeGetItemId(item);
                const remainingQuantity = safeGetRemainingQuantity(item);

                return {
                    _id: itemId,
                    quantity: remainingQuantity > 0 ? remainingQuantity : safeGetItemQuantity(item)
                };
            }).filter((item: any) => item._id);
        }

        if (fulfillmentLineItems.length === 0) {
            throw new Error(`No valid line items found for fulfillment of order ${params.orderNumber}`);
        }

        const fulfillmentData = {
            lineItems: fulfillmentLineItems,
            trackingInfo: {
                trackingNumber: params.trackingNumber,
                shippingProvider: mappedCarrier
            },
            status: 'Fulfilled'
        };

        let fulfillmentResult;
        if (params.sendShippingEmail) {
            const elevatedCreateFulfillment = auth.elevate(orderFulfillments.createFulfillment);
            fulfillmentResult = await elevatedCreateFulfillment(params.orderId, fulfillmentData);
        } else {
            fulfillmentResult = await orderFulfillments.createFulfillment(params.orderId, fulfillmentData);
        }

        const isPartialFulfillment = lineItems && lineItems.length > 0 && lineItems.length < order.lineItems.length;

        return {
            success: true,
            method: 'createNewFulfillment',
            fulfillmentId: fulfillmentResult.fulfillmentId,
            message: isPartialFulfillment
                ? `Order ${params.orderNumber} partially fulfilled (${fulfillmentLineItems.length}/${order.lineItems.length} items) with tracking: ${params.trackingNumber}`
                : `Order ${params.orderNumber} fulfilled successfully with tracking: ${params.trackingNumber}`,
            emailSent: !!params.sendShippingEmail,
            isPartialFulfillment,
            result: fulfillmentResult
        };

    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        return {
            success: false,
            error: errorMsg,
            message: `Failed to create fulfillment for order ${params.orderNumber}: ${errorMsg}`,
            method: 'createNewFulfillment'
        };
    }
};

const updateExistingFulfillment = async (params: {
    orderId: string;
    fulfillmentId: string;
    trackingNumber: string;
    shippingProvider: string;
    orderNumber: string;
    sendShippingEmail?: boolean;
}) => {

    try {
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
            'other': 'other'
        };

        const mappedCarrier = carrierMapping[params.shippingProvider.toLowerCase()] || 'other';

        const identifiers = {
            orderId: params.orderId,
            fulfillmentId: params.fulfillmentId
        };

        const options = {
            fulfillment: {
                trackingInfo: {
                    trackingNumber: params.trackingNumber,
                    shippingProvider: mappedCarrier
                }
            }
        };

        let updateResult;
        if (params.sendShippingEmail) {
            const elevatedUpdateFulfillment = auth.elevate(orderFulfillments.updateFulfillment);
            updateResult = await elevatedUpdateFulfillment(identifiers, options);
        } else {
            updateResult = await orderFulfillments.updateFulfillment(identifiers, options);
        }

        return {
            success: true,
            method: 'updateExistingFulfillment',
            message: `Tracking updated for order ${params.orderNumber}: ${params.trackingNumber}`,
            emailSent: !!params.sendShippingEmail,
            isTrackingUpdate: true,
            result: updateResult
        };

    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        return {
            success: false,
            error: errorMsg,
            message: `Failed to update fulfillment for order ${params.orderNumber}: ${errorMsg}`,
            method: 'updateExistingFulfillment'
        };
    }
};

export const validateLineItems = webMethod(
    Permissions.Admin,
    async ({
        orderId,
        lineItems
    }: {
        orderId: string;
        lineItems: LineItemInput[];
    }) => {
        try {
            const elevatedGetOrder = auth.elevate(orders.getOrder);
            const order = await elevatedGetOrder(orderId);

            if (!order || !order.lineItems) {
                return {
                    success: false,
                    error: 'Order not found or has no line items'
                };
            }

            const orderItemIds = order.lineItems?.map((item: any) => safeGetItemId(item));

            const validation = lineItems.map(inputItem => {
                const orderItem = order.lineItems?.find((item: any) => safeGetItemId(item) === inputItem.id);

                if (!orderItem) {
                    return {
                        id: inputItem.id,
                        exists: false,
                        requestedQuantity: inputItem.quantity,
                        availableQuantity: 0,
                        fulfilledQuantity: 0,
                        remainingQuantity: 0,
                        canFulfill: false
                    };
                }

                const totalQuantity = safeGetItemQuantity(orderItem);
                const fulfilledQuantity = safeGetFulfilledQuantity(orderItem);
                const remainingQuantity = safeGetRemainingQuantity(orderItem);

                return {
                    id: inputItem.id,
                    exists: true,
                    requestedQuantity: inputItem.quantity,
                    availableQuantity: totalQuantity,
                    fulfilledQuantity: fulfilledQuantity,
                    remainingQuantity: remainingQuantity,
                    canFulfill: inputItem.quantity <= remainingQuantity
                };
            });

            const validItems = validation.filter(item => item.canFulfill);
            const invalidItems = validation.filter(item => !item.canFulfill);

            return {
                success: true,
                validation,
                validItems,
                invalidItems,
                canProceed: invalidItems.length === 0,
                summary: {
                    totalRequested: lineItems.length,
                    validCount: validItems.length,
                    invalidCount: invalidItems.length
                }
            };

        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                error: errorMsg
            };
        }
    }
);

export const debugLineItems = webMethod(
    Permissions.Admin,
    async ({ orderId }: { orderId: string }) => {
        try {
            const elevatedGetOrder = auth.elevate(orders.getOrder);
            const order = await elevatedGetOrder(orderId);

            if (!order) {
                return {
                    success: false,
                    error: 'Order not found'
                };
            }

            const lineItemsAnalysis = (order.lineItems || []).map((item: any, index: number) => {
                const itemId = safeGetItemId(item);
                const totalQuantity = safeGetItemQuantity(item);
                const fulfilledQuantity = safeGetFulfilledQuantity(item);
                const remainingQuantity = safeGetRemainingQuantity(item);

                return {
                    index,
                    itemId,
                    totalQuantity,
                    fulfilledQuantity,
                    remainingQuantity,
                    canFulfill: remainingQuantity > 0,
                    rawItem: {
                        _id: item._id,
                        id: item.id,
                        quantity: item.quantity,
                        fulfilledQuantity: item.fulfilledQuantity,
                        productName: item.productName,
                        availableProperties: Object.keys(item)
                    }
                };
            });

            return {
                success: true,
                orderNumber: order.number,
                totalLineItems: order.lineItems?.length || 0,
                lineItemsAnalysis,
                fulfillableItems: lineItemsAnalysis.filter(item => item.canFulfill).length
            };

        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                error: errorMsg
            };
        }
    }
);