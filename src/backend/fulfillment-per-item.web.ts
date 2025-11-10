import { webMethod, Permissions } from '@wix/web-methods';
import { auth } from '@wix/essentials';
import { orderFulfillments, orders } from '@wix/ecom';

// Helper function to handle CORS preflight requests
const handleCorsPreflightIfNeeded = (context?: any) => {
    if (context?.request?.method === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: {
                'Access-Control-Allow-Origin': context?.request?.headers?.origin || '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-wix-consistent, x-wix-client-artifact-id, x-wix-linguist',
                'Access-Control-Max-Age': '86400'
            },
            body: ''
        };
    }
    return null;
};

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

interface ItemFulfillment {
    id: string;
    quantity: number;
}

interface PerItemFulfillmentParams {
    orderId: string;
    trackingNumber: string;
    shippingProvider: string;
    orderNumber: string;
    sendShippingEmail?: boolean;
    selectedItems: ItemFulfillment[];
    editMode?: boolean;
    existingFulfillmentId?: string;
    trackingUrl?: string;
    customCarrierName?: string;
}

/**
 * Create fulfillment for specific items
 */
export const createPerItemFulfillment = webMethod(
    Permissions.Admin,
    async (params: PerItemFulfillmentParams, context?: any) => {
        const preflightResponse = handleCorsPreflightIfNeeded(context);
        if (preflightResponse) return preflightResponse;

        try {
            // Get order details with elevated permissions
            const elevatedGetOrder = auth.elevate(orders.getOrder);
            const orderDetails = await elevatedGetOrder(params.orderId);

            if (!orderDetails || !orderDetails.lineItems?.length) {
                throw new Error(`Order ${params.orderNumber} not found or has no line items`);
            }

            // Enhanced carrier mapping
            // Enhanced carrier mapping
            const carrierMapping: Record<string, string> = {
                'dhl': 'dhl',
                'ups': 'ups',
                'fedex': 'fedex',
                'usps': 'usps',
                'canada-post': 'canadaPost',
                'royal-mail': 'royalMail',
                'custom': 'custom',
                'other': 'other'
            };

            const mappedCarrier = carrierMapping[params.shippingProvider.toLowerCase()] || 'other';

            // Validate and prepare line items for fulfillment
            const orderItemMap = new Map();
            orderDetails.lineItems.forEach((item: any) => {
                const itemId = safeGetItemId(item);
                orderItemMap.set(itemId, item);
            });

            const fulfillmentLineItems: Array<{ _id: string; quantity: number }> = [];
            const invalidItems: string[] = [];

            for (const selectedItem of params.selectedItems) {
                const orderItem = orderItemMap.get(selectedItem.id);

                if (!orderItem) {
                    invalidItems.push(`Item ${selectedItem.id} not found in order`);
                    continue;
                }

                const remainingQuantity = safeGetRemainingQuantity(orderItem);

                if (selectedItem.quantity > remainingQuantity) {
                    invalidItems.push(`Item ${selectedItem.id}: requested ${selectedItem.quantity} but only ${remainingQuantity} remaining`);
                    continue;
                }

                fulfillmentLineItems.push({
                    _id: selectedItem.id,
                    quantity: selectedItem.quantity
                });
            }

            if (invalidItems.length > 0) {
                throw new Error(`Invalid items: ${invalidItems.join(', ')}`);
            }

            if (fulfillmentLineItems.length === 0) {
                throw new Error(`No valid items to fulfill`);
            }

            // Generate standard carrier tracking URLs
            const trackingUrls: Record<string, string> = {
                'fedex': `https://www.fedex.com/apps/fedextrack/?action=track&trackingnumber=${encodeURIComponent(params.trackingNumber)}`,
                'ups': `https://www.ups.com/track?track=yes&trackNums=${encodeURIComponent(params.trackingNumber)}`,
                'usps': `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(params.trackingNumber)}`,
                'dhl': `https://www.logistics.dhl/global-en/home/tracking/tracking-parcel.html?submit=1&tracking-id=${encodeURIComponent(params.trackingNumber)}`,
                'canadaPost': `https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor=${encodeURIComponent(params.trackingNumber)}`,
                'royalMail': `https://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(params.trackingNumber)}`
            };

            // Determine the tracking URL
            let trackingUrl = params.trackingUrl || '';
            if (!trackingUrl && mappedCarrier !== 'other' && mappedCarrier !== 'custom') {
                trackingUrl = trackingUrls[mappedCarrier] || '';
            }

            // For custom carriers or when a custom URL is provided, use the custom URL directly
            if ((mappedCarrier === 'custom' || mappedCarrier === 'other') && !trackingUrl) {
                trackingUrl = params.trackingUrl || '';
            }

            // Determine the display carrier name
            // Determine the display carrier name
            let displayCarrier = mappedCarrier;
            if (mappedCarrier === 'custom' && params.customCarrierName) {
                displayCarrier = params.customCarrierName;
            } else if (mappedCarrier === 'other' && params.customCarrierName) {
                displayCarrier = params.customCarrierName;
            } else if (trackingUrls[mappedCarrier]) {
                // Use the formatted carrier name for known carriers
                displayCarrier = mappedCarrier.charAt(0).toUpperCase() + mappedCarrier.slice(1);
            }

            const trackingInfo: any = {
                trackingNumber: params.trackingNumber,
                shippingProvider: displayCarrier
            };

            // Always include tracking URL if available, whether it's custom or standard
            if (trackingUrl) {
                trackingInfo.trackingLink = trackingUrl;
            }

            const fulfillmentData = {
                lineItems: fulfillmentLineItems,
                trackingInfo,
                status: 'Fulfilled'
            };

            let fulfillmentResult;
            if (params.sendShippingEmail) {
                const elevatedCreateFulfillment = auth.elevate(orderFulfillments.createFulfillment);
                fulfillmentResult = await elevatedCreateFulfillment(params.orderId, fulfillmentData);
            } else {
                fulfillmentResult = await orderFulfillments.createFulfillment(params.orderId, fulfillmentData);
            }

            const isPartialFulfillment = fulfillmentLineItems.length < orderDetails.lineItems.length;

            return {
                success: true,
                method: 'createPerItemFulfillment',
                fulfillmentId: fulfillmentResult.fulfillmentId,
                message: isPartialFulfillment
                    ? `Order ${params.orderNumber} partially fulfilled (${fulfillmentLineItems.length} items)`
                    : `Order ${params.orderNumber} fulfilled successfully`,
                emailSent: !!params.sendShippingEmail,
                isPartialFulfillment,
                result: fulfillmentResult
            };

        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`❌ PER-ITEM: createPerItemFulfillment failed:`, error);

            return {
                success: false,
                error: errorMsg,
                message: `Failed to create per-item fulfillment for order ${params.orderNumber}: ${errorMsg}`,
                method: 'createPerItemFulfillment'
            };
        }
    }
);

/**
 * 🔥 NEW: Update tracking for specific items
 */
export const updatePerItemTracking = webMethod(
    Permissions.Admin,
    async ({
        orderId,
        fulfillmentId,
        trackingNumber,
        shippingProvider,
        orderNumber,
        sendShippingEmail = false,
        itemId,
        customCarrierName
    }: {
        orderId: string;
        fulfillmentId?: string;
        trackingNumber: string;
        shippingProvider: string;
        orderNumber: string;
        sendShippingEmail?: boolean;
        itemId?: string;
        customCarrierName?: string;
    }, context?: any) => {
        const preflightResponse = handleCorsPreflightIfNeeded(context);
        if (preflightResponse) return preflightResponse;

        try {
            const carrierMapping: Record<string, string> = {
                'dhl': 'dhl',
                'ups': 'ups',
                'fedex': 'fedex',
                'usps': 'usps',
                'canada-post': 'canadaPost',
                'royal-mail': 'royalMail',
                'other': 'other'
            };

            const mappedCarrier = carrierMapping[shippingProvider.toLowerCase()] || 'other';

            if (fulfillmentId) {
                // Update existing fulfillment
                const identifiers = {
                    orderId: orderId,
                    fulfillmentId: fulfillmentId
                };

                // Use custom carrier name if provided and carrier is 'custom' or 'other'
                const displayCarrier = (mappedCarrier === 'custom' || mappedCarrier === 'other') && shippingProvider !== mappedCarrier
                    ? shippingProvider // Use the original provider name which should be the custom name
                    : mappedCarrier;

                const options = {
                    fulfillment: {
                        trackingInfo: {
                            trackingNumber: trackingNumber,
                            shippingProvider: displayCarrier
                        }
                    }
                };

                let updateResult;
                if (sendShippingEmail) {
                    const elevatedUpdateFulfillment = auth.elevate(orderFulfillments.updateFulfillment);
                    updateResult = await elevatedUpdateFulfillment(identifiers, options);
                } else {
                    updateResult = await orderFulfillments.updateFulfillment(identifiers, options);
                }

                return {
                    success: true,
                    method: 'updatePerItemTracking',
                    message: `Tracking updated for order ${orderNumber}: ${trackingNumber}`,
                    emailSent: !!sendShippingEmail,
                    result: updateResult
                };
            } else {
                // Create new fulfillment for specific item
                const fulfillmentParams: any = {
                    orderId,
                    trackingNumber,
                    shippingProvider,
                    orderNumber,
                    sendShippingEmail,
                    selectedItems: itemId ? [{ id: itemId, quantity: 1 }] : []
                };

                // Only add customCarrierName if it exists
                if (customCarrierName) {
                    fulfillmentParams.customCarrierName = customCarrierName;
                }

                return await createPerItemFulfillment(fulfillmentParams);
            }

        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`❌ PER-ITEM: updatePerItemTracking failed:`, error);

            return {
                success: false,
                error: errorMsg,
                message: `Failed to update per-item tracking for order ${orderNumber}: ${errorMsg}`,
                method: 'updatePerItemTracking'
            };
        }
    }
);

/**
 * Get detailed fulfillment information
 */
export const getOrderFulfillmentDetails = webMethod(
    Permissions.Admin,
    async ({
        orderId,
        orderNumber
    }: {
        orderId: string;
        orderNumber: string;
    }, context?: any) => {
        const preflightResponse = handleCorsPreflightIfNeeded(context);
        if (preflightResponse) return preflightResponse;

        try {
            // Get order details
            const elevatedGetOrder = auth.elevate(orders.getOrder);
            const orderDetails = await elevatedGetOrder(orderId);

            if (!orderDetails) {
                throw new Error(`Order ${orderNumber} not found`);
            }

            // Get fulfillments
            const elevatedListFulfillments = auth.elevate(orderFulfillments.listFulfillmentsForSingleOrder);
            const fulfillmentsResponse = await elevatedListFulfillments(orderId);

            const fulfillments = fulfillmentsResponse?.orderWithFulfillments?.fulfillments || [];

            // Process line items with fulfillment details
            const lineItemsWithFulfillment = orderDetails.lineItems?.map((item: any) => {
                const itemId = safeGetItemId(item);
                const totalQuantity = safeGetItemQuantity(item);
                const fulfilledQuantity = safeGetFulfilledQuantity(item);
                const remainingQuantity = safeGetRemainingQuantity(item);

                return {
                    ...item,
                    itemId,
                    totalQuantity,
                    fulfilledQuantity,
                    remainingQuantity,
                    fulfillmentStatus: fulfilledQuantity >= totalQuantity ? 'FULFILLED' :
                        fulfilledQuantity > 0 ? 'PARTIALLY_FULFILLED' : 'NOT_FULFILLED',
                    canBeFulfilled: remainingQuantity > 0
                };
            }) || [];

            // Calculate overall order fulfillment status
            const totalItems = lineItemsWithFulfillment.reduce((sum, item) => sum + item.totalQuantity, 0);
            const totalFulfilled = lineItemsWithFulfillment.reduce((sum, item) => sum + item.fulfilledQuantity, 0);

            const overallStatus = totalFulfilled >= totalItems ? 'FULFILLED' :
                totalFulfilled > 0 ? 'PARTIALLY_FULFILLED' : 'NOT_FULFILLED';

            return {
                success: true,
                method: 'getOrderFulfillmentDetails',
                orderDetails: {
                    orderId,
                    orderNumber,
                    overallFulfillmentStatus: overallStatus,
                    totalItems,
                    totalFulfilled,
                    totalRemaining: totalItems - totalFulfilled,
                    lineItems: lineItemsWithFulfillment,
                    fulfillments: fulfillments
                }
            };

        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`❌ PER-ITEM: getOrderFulfillmentDetails failed:`, error);

            return {
                success: false,
                error: errorMsg,
                message: `Failed to get fulfillment details for order ${orderNumber}: ${errorMsg}`,
                method: 'getOrderFulfillmentDetails'
            };
        }
    }
);

/**
 * Validate items before fulfillment
 */
export const validateItemsForFulfillment = webMethod(
    Permissions.Admin,
    async ({
        orderId,
        selectedItems
    }: {
        orderId: string;
        selectedItems: ItemFulfillment[];
    }, context?: any) => {
        const preflightResponse = handleCorsPreflightIfNeeded(context);
        if (preflightResponse) return preflightResponse;

        try {
            const elevatedGetOrder = auth.elevate(orders.getOrder);
            const orderDetails = await elevatedGetOrder(orderId);

            if (!orderDetails || !orderDetails.lineItems) {
                return {
                    success: false,
                    error: 'Order not found or has no line items'
                };
            }

            const orderItemMap = new Map();
            orderDetails.lineItems.forEach((item: any) => {
                const itemId = safeGetItemId(item);
                orderItemMap.set(itemId, item);
            });

            const validation = selectedItems.map(selectedItem => {
                const orderItem = orderItemMap.get(selectedItem.id);

                if (!orderItem) {
                    return {
                        itemId: selectedItem.id,
                        valid: false,
                        error: 'Item not found in order',
                        requestedQuantity: selectedItem.quantity,
                        availableQuantity: 0,
                        fulfilledQuantity: 0,
                        remainingQuantity: 0,
                        canFulfillMoreOfSameItem: false
                    };
                }

                const totalQuantity = safeGetItemQuantity(orderItem);
                const fulfilledQuantity = safeGetFulfilledQuantity(orderItem);
                const remainingQuantity = safeGetRemainingQuantity(orderItem);
                const canFulfillMoreOfSameItem = remainingQuantity > 0;

                // Allow fulfilling more of the same item even if some quantities already have tracking
                const isValidRequest = selectedItem.quantity <= remainingQuantity && selectedItem.quantity > 0;

                return {
                    itemId: selectedItem.id,
                    valid: isValidRequest,
                    error: !isValidRequest ?
                        (selectedItem.quantity > remainingQuantity ?
                            `Requested ${selectedItem.quantity} but only ${remainingQuantity} remaining` :
                            selectedItem.quantity <= 0 ?
                                'Quantity must be greater than 0' :
                                'Invalid quantity') : null,
                    requestedQuantity: selectedItem.quantity,
                    availableQuantity: totalQuantity,
                    fulfilledQuantity: fulfilledQuantity,
                    remainingQuantity: remainingQuantity,
                    canFulfillMoreOfSameItem
                };
            });

            const validItems = validation.filter(item => item.valid);
            const invalidItems = validation.filter(item => !item.valid);

            return {
                success: true,
                validation,
                validItems,
                invalidItems,
                canProceed: invalidItems.length === 0,
                summary: {
                    totalRequested: selectedItems.length,
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