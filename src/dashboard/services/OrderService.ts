// services/OrderService.ts - ENHANCED: Integrated with per-item fulfillment

import type { OrdersResponse, FulfillOrderParams, FulfillmentResponse, Order, OrderStatus, PaymentStatus } from '../types/Order';
import { settingsStore } from '../stores/SettingsStore';
import {
    smartFulfillOrderElevated
} from '../../backend/fulfillment-elevated.web';

// 🔥 EXISTING: Direct imports from your backend methods
import {
    testOrdersConnection,
    getSingleOrder,
    fulfillOrderInWix
} from '../../backend/orders-api.web';

// 🔥 NEW: Add imports for per-item fulfillment methods
import {
    createPerItemFulfillment,
    updatePerItemTracking,
    getOrderFulfillmentDetails,
    validateItemsForFulfillment
} from '../../backend/fulfillment-per-item.web';

interface ExtendedFulfillOrderParams extends FulfillOrderParams {
    sendShippingEmail?: boolean;
    lineItems?: Array<{ id: string; quantity: number }>;
    selectedItems?: Array<{ id: string; quantity: number }>; // NEW: For per-item fulfillment
    editMode?: boolean; // NEW: For editing existing fulfillment
    existingFulfillmentId?: string; // NEW: For updating specific fulfillment
    trackingUrl?: string; // NEW: For custom tracking URLs
    customCarrierName?: string; // NEW: For custom carrier names
}

interface ItemFulfillment {
    id: string;
    quantity: number;
}

export class OrderService {
    createFulfillment(arg0: { lineItems: { id: string; quantity: number; }[]; trackingInfo: { trackingNumber: string; shippingProvider: string; trackingLink: string; }; notifyByEmail: boolean; orderId: string; }) {
        throw new Error('Method not implemented.');
    }
    private orderCache: { orders: Order[]; timestamp: number; hasMore: boolean; nextCursor: string } | null = null;
    private readonly CACHE_DURATION = 2 * 60 * 1000; // 2 minutes for progressive loading

    // ===== EXISTING METHODS (kept as-is) =====

    async queryOrders({
        filter,
        sort = { _createdDate: -1 },
        limit = 10,
        cursor
    }: {
        filter: Record<string, any>;
        sort?: Record<string, 1 | -1>;
        limit?: number;
        cursor?: string;
    }): Promise<Order[]> {
        try {
            // Using the existing fetchOrdersChunked method with the provided filters
            const orders: Order[] = [];
            let hasMore = true;
            let currentCursor = cursor;

            while (orders.length < limit && hasMore) {
                const result = await this.fetchOrdersChunked(limit);

                if (result?.success) {
                    orders.push(...result.orders);
                    hasMore = result.hasMore || false;

                    if (result.nextCursor) {
                        currentCursor = result.nextCursor;
                    } else {
                        hasMore = false;
                    }
                } else {
                    hasMore = false;
                }

                if (orders.length >= limit) {
                    break;
                }
            }

            // Apply filters in-memory if not already applied in the API
            let filteredOrders = orders;
            if (filter) {
                filteredOrders = orders.filter(order => {
                    return Object.entries(filter).every(([key, value]) => {
                        if (key === 'buyerInfo.id') {
                            return order.buyerInfo?.id === value;
                        }
                        if (key === '_id' && typeof value === 'object' && value.$ne) {
                            return order._id !== value.$ne;
                        }
                        // Add more filter conditions as needed
                        return true;
                    });
                });
            }

            // Apply sorting
            filteredOrders.sort((a, b) => {
                for (const [key, direction] of Object.entries(sort)) {
                    const aValue = this.getNestedValue(a, key);
                    const bValue = this.getNestedValue(b, key);

                    if (aValue < bValue) return -1 * direction;
                    if (aValue > bValue) return 1 * direction;
                }
                return 0;
            });

            return filteredOrders.slice(0, limit);
        } catch (error) {
            console.error('Error querying orders:', error);
            throw error;
        }
    }

    private getNestedValue(obj: any, path: string) {
        return path.split('.').reduce((o, p) => o?.[p], obj);
    }

    async fetchOrdersChunked(
        initialLimit: number = 100,
        onProgress?: (orders: Order[], totalLoaded: number, hasMore: boolean) => void,
    ): Promise<{ success: boolean; orders: Order[]; totalCount: number; hasMore: boolean; nextCursor?: string; error?: string }> {
        const isProd = !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1');
        let allOrders: Order[] = [];
        let cursor = '';
        let totalFetched = 0;
        const batchSize = 100;

        try {
            while (totalFetched < initialLimit) {
                const result = await testOrdersConnection({
                    limit: Math.min(batchSize, initialLimit - totalFetched),
                    cursor: cursor
                });

                if (result.success && result.orders) {
                    const transformedOrders = result.orders.map(this.transformOrderFromBackend);
                    allOrders = [...allOrders, ...transformedOrders];
                    totalFetched += transformedOrders.length;

                    const hasMore = result.pagination?.hasNext || false;
                    cursor = result.pagination?.nextCursor || '';

                    if (onProgress) {
                        onProgress(allOrders, totalFetched, hasMore);
                    }

                    if (!hasMore || totalFetched >= initialLimit) {
                        return {
                            success: true,
                            orders: allOrders,
                            totalCount: totalFetched,
                            hasMore: hasMore && totalFetched >= initialLimit,
                            nextCursor: cursor
                        };
                    }

                    await new Promise(resolve => setTimeout(resolve, 50));
                } else {
                    throw new Error(result.error || 'Failed to fetch orders batch');
                }
            }

            return {
                success: true,
                orders: allOrders,
                totalCount: totalFetched,
                hasMore: !!cursor,
                nextCursor: cursor
            };

        } catch (error: any) {
            return {
                success: false,
                orders: allOrders,
                totalCount: allOrders.length,
                hasMore: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    async fetchMoreOrders(
        cursor: string,
        limit: number = 100
    ): Promise<{ success: boolean; orders: Order[]; hasMore: boolean; nextCursor?: string; error?: string }> {
        let allOrders: Order[] = [];
        let currentCursor = cursor;
        let totalFetched = 0;
        const batchSize = 100;

        try {
            while (totalFetched < limit && currentCursor) {
                const result = await testOrdersConnection({
                    limit: Math.min(batchSize, limit - totalFetched),
                    cursor: currentCursor
                });

                if (result.success && result.orders) {
                    const transformedOrders = result.orders.map(this.transformOrderFromBackend);
                    allOrders = [...allOrders, ...transformedOrders];
                    totalFetched += transformedOrders.length;

                    const hasMore = result.pagination?.hasNext || false;
                    currentCursor = result.pagination?.nextCursor || '';

                    if (!hasMore || totalFetched >= limit) {
                        break;
                    }

                    await new Promise(resolve => setTimeout(resolve, 50));
                } else {
                    throw new Error(result.error || 'Failed to fetch more orders');
                }
            }

            return {
                success: true,
                orders: allOrders,
                hasMore: !!currentCursor,
                nextCursor: currentCursor
            };

        } catch (error: any) {
            return {
                success: false,
                orders: [],
                hasMore: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    async fetchOrders({ limit = 50, cursor = '' }): Promise<OrdersResponse> {
        const maxRetries = 3;
        let lastError: any;
        const isProd = !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1');

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🚀 [${isProd ? 'PROD' : 'DEV'}] Frontend: Fetch orders attempt ${attempt}/${maxRetries}`);

                const result = await testOrdersConnection({ limit, cursor });

                console.log(`📊 [${isProd ? 'PROD' : 'DEV'}] Frontend: Orders fetch attempt ${attempt} result:`, {
                    success: result.success,
                    orderCount: result.orders?.length || 0,
                    method: result.method,
                    hasOrders: !!result.orders,
                    hasPagination: !!result.pagination,
                    errorPresent: !!result.error
                });

                const transformedResult: OrdersResponse = {
                    success: result.success,
                    method: result.method,
                    orders: result.orders ? result.orders.map(this.transformOrderFromBackend) : [],
                    orderCount: result.orderCount || 0,
                    pagination: result.pagination ? {
                        hasNext: result.pagination.hasNext || false,
                        nextCursor: result.pagination.nextCursor || '',
                        prevCursor: result.pagination.prevCursor || ''
                    } : {
                        hasNext: false,
                        nextCursor: '',
                        prevCursor: ''
                    },
                    message: result.message || 'Success',
                    error: result.error,
                    ecomError: result.ecomError
                };

                return transformedResult;

            } catch (currentError: any) {
                lastError = currentError;
                if (attempt < maxRetries) {
                    const waitTime = Math.pow(2, attempt) * 1000;
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }

        return {
            success: false,
            message: `Failed to fetch orders after ${maxRetries} attempts: ${lastError}`,
            error: lastError,
            orders: [],
            orderCount: 0,
            pagination: {
                hasNext: false,
                nextCursor: '',
                prevCursor: ''
            }
        };
    }

    async fetchSingleOrder(orderId: string): Promise<{ success: boolean; order?: Order; error?: string }> {
        try {
            const result = await getSingleOrder(orderId);

            if (result.success && result.order) {
                return {
                    success: true,
                    order: this.transformOrderFromBackend(result.order)
                };
            } else {
                return {
                    success: false,
                    error: result.error || 'Order not found'
                };
            }

        } catch (error: any) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    // ===== ENHANCED FULFILLMENT METHODS =====

    /**
     * 🔥 ENHANCED: Fulfill order with per-item support
     */
    async fulfillOrder(params: ExtendedFulfillOrderParams): Promise<FulfillmentResponse> {
        const isProd = !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1');

        console.log('🚀 OrderService.fulfillOrder called with params:', {
            orderId: params.orderId,
            orderNumber: params.orderNumber,
            trackingNumber: params.trackingNumber,
            carrier: params.shippingProvider,
            hasSelectedItems: !!(params.selectedItems?.length || params.lineItems?.length),
            selectedItemsCount: (params.selectedItems?.length || params.lineItems?.length || 0),
            editMode: params.editMode,
            sendShippingEmail: params.sendShippingEmail,
            trackingUrl: params.trackingUrl,
            customCarrierName: params.customCarrierName
        });

        try {
            const startTime = Date.now();

            const selectedItems = params.selectedItems || params.lineItems || [];

            if (selectedItems.length > 0) {
                console.log('📦 Using per-item fulfillment method');

                let trackingUrl = params.trackingUrl || '';
                if (!trackingUrl && params.shippingProvider === 'other') {
                    trackingUrl = params.trackingUrl || '';
                }

                const customCarrierName = params.customCarrierName;

                const result = await createPerItemFulfillment({
                    orderId: params.orderId,
                    trackingNumber: params.trackingNumber,
                    shippingProvider: params.shippingProvider,
                    orderNumber: params.orderNumber,
                    sendShippingEmail: params.sendShippingEmail || false,
                    selectedItems: selectedItems,
                    editMode: params.editMode,
                    existingFulfillmentId: params.existingFulfillmentId,
                    trackingUrl: trackingUrl,
                    customCarrierName: customCarrierName
                });

                const duration = Date.now() - startTime;
                console.log(`✅ Per-item fulfillment completed in ${duration}ms:`, result);

                if (result.success) {
                    return {
                        success: true,
                        method: 'createPerItemFulfillment',
                        message: result.message || `Per-item fulfillment completed for order ${params.orderNumber}`,
                        fulfillmentId: result.fulfillmentId,
                        emailInfo: {
                            emailSentAutomatically: result.emailSent || false,
                            customerEmail: 'Available in order details',
                            emailRequested: params.sendShippingEmail || false,
                            note: result.emailSent ? 'Email sent automatically by Wix' : 'No email sent'
                        }
                    };
                } else {
                    throw new Error(result.error || 'Per-item fulfillment failed');
                }
            } else {
                console.log('📦 Using traditional full order fulfillment method');

                let trackingUrl = params.trackingUrl || '';
                const customCarrierName = params.customCarrierName;

                const result = await smartFulfillOrderElevated({
                    orderId: params.orderId,
                    trackingNumber: params.trackingNumber,
                    shippingProvider: params.shippingProvider,
                    orderNumber: params.orderNumber,
                    sendShippingEmail: params.sendShippingEmail || false,
                    lineItems: [],
                    trackingUrl: trackingUrl,
                    customCarrierName: customCarrierName
                });

                const duration = Date.now() - startTime;
                console.log(`✅ Traditional fulfillment completed in ${duration}ms:`, result);

                // Transform the response to match expected format - SAFER VERSION
                if (result.success) {
                    const baseResponse: FulfillmentResponse = {
                        success: true,
                        method: result.method || 'smartFulfillOrderElevated',
                        message: result.message || `Order ${params.orderNumber} fulfilled successfully`,
                        emailInfo: {
                            emailSentAutomatically: result.emailSent || false,
                            customerEmail: 'Available in order details',
                            emailRequested: params.sendShippingEmail || false,
                            note: result.emailSent ? 'Shipping confirmation sent automatically by Wix (if email settings are enabled for third party apps)' : 'No email sent'
                        }
                    };

                    // ✅ Safely add optional properties if they exist
                    if ('fulfillmentId' in result && result.fulfillmentId) {
                        (baseResponse as any).fulfillmentId = result.fulfillmentId;
                    }

                    if ('emailSent' in result) {
                        (baseResponse as any).emailSent = result.emailSent;
                    }

                    if ('isPartialFulfillment' in result) {
                        (baseResponse as any).isPartialFulfillment = result.isPartialFulfillment;
                    }

                    if ('result' in result) {
                        (baseResponse as any).result = result.result;
                    }

                    // Add additional properties for compatibility
                    (baseResponse as any).isPerItemFulfillment = false;
                    (baseResponse as any).isTrackingUpdate = false;

                    return baseResponse;
                } else {
                    throw new Error(result.error || 'Smart fulfillment failed');
                }
            }

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error('❌ OrderService.fulfillOrder failed:', error);

            return {
                success: false,
                message: `Failed to fulfill order: ${errorMsg}`,
                error: errorMsg,
                emailInfo: {
                    emailRequested: params.sendShippingEmail || false,
                    emailSentAutomatically: false,
                    note: 'Email not sent due to fulfillment failure'
                }
            };
        }
    }

    /**
     * 🔥 NEW: Update tracking for specific items
     */
    async updateItemTracking(params: {
        orderId: string;
        orderNumber: string;
        itemId?: string;
        fulfillmentId?: string;
        trackingNumber: string;
        shippingProvider: string;
        sendShippingEmail?: boolean;
    }): Promise<FulfillmentResponse> {
        try {
            console.log('🔄 Updating item tracking:', {
                orderId: params.orderId,
                orderNumber: params.orderNumber,
                itemId: params.itemId,
                fulfillmentId: params.fulfillmentId,
                trackingNumber: params.trackingNumber,
                shippingProvider: params.shippingProvider
            });

            // Call the backend to update the tracking information
            const result = await updatePerItemTracking({
                orderId: params.orderId,
                orderNumber: params.orderNumber,
                itemId: params.itemId,
                fulfillmentId: params.fulfillmentId,
                trackingNumber: params.trackingNumber,
                shippingProvider: params.shippingProvider,
                sendShippingEmail: params.sendShippingEmail ?? true
            });

            if (!result.success) {
                const errorMessage = 'message' in result ? result.message : 'Failed to update tracking';
                throw new Error(errorMessage);
            }

            // Get the updated order details to ensure we have the latest fulfillment status
            const orderDetails = await this.getOrderFulfillmentDetails(params.orderId, params.orderNumber);

            if (!orderDetails.success) {
                console.warn('⚠️ Could not fetch updated order details after tracking update');
                return {
                    success: true,
                    method: 'updatePerItemTracking',
                    message: `Tracking information updated for order #${params.orderNumber}`
                };
            }

            // If we have order details, include the status in the message
            const status = orderDetails.orderDetails?.overallFulfillmentStatus;
            const statusMessage = status ? ` Order status is now: ${status}.` : '';

            return {
                success: true,
                method: 'updatePerItemTracking',
                message: `Tracking information updated for order #${params.orderNumber}.${statusMessage}`
            };
        } catch (error) {
            console.error('❌ Update item tracking failed:', error);
            return {
                success: false,
                method: 'updatePerItemTracking',
                error: error instanceof Error ? error.message : String(error),
                message: `Failed to update tracking for order ${params.orderNumber}`
            };
        }
    }

    /**
     * 🔥 NEW: Get detailed fulfillment information for an order
     */
    async getOrderFulfillmentDetails(orderId: string, orderNumber: string): Promise<{
        success: boolean;
        orderDetails?: any;
        error?: string;
    }> {
        console.log('📋 OrderService.getOrderFulfillmentDetails called');

        try {
            const result = await getOrderFulfillmentDetails({
                orderId,
                orderNumber
            });

            return result;

        } catch (error) {
            console.error('❌ Get order fulfillment details failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * 🔥 NEW: Validate items before fulfillment
     */
    async validateItemsForFulfillment(orderId: string, selectedItems: ItemFulfillment[]): Promise<{
        success: boolean;
        validation?: any[];
        canProceed?: boolean;
        error?: string;
    }> {
        console.log('✅ OrderService.validateItemsForFulfillment called');

        try {
            const result = await validateItemsForFulfillment({
                orderId,
                selectedItems
            });

            return result;

        } catch (error) {
            console.error('❌ Validate items for fulfillment failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    // Add this method to your OrderService class

    /**
     * Bulk mark orders as fulfilled
     */
    async bulkMarkOrdersAsFulfilled(params: {
        orderIds: string[];
        trackingNumber?: string;
        shippingProvider?: string;
        sendShippingEmail?: boolean;
    }): Promise<{
        success: boolean;
        successCount: number;
        failureCount: number;
        results: Array<{
            orderId: string;
            success: boolean;
            error?: string;
            fulfillmentId?: string;
        }>;
        message: string;
    }> {
        console.log('🚀 OrderService.bulkMarkOrdersAsFulfilled called with:', {
            orderCount: params.orderIds.length,
            hasTracking: !!params.trackingNumber,
            carrier: params.shippingProvider
        });

        try {
            const { orderFulfillments, orders } = await import('@wix/ecom');

            // First, get all orders to extract their line items
            const ordersData = await Promise.all(
                params.orderIds.map(async (orderId) => {
                    try {
                        const order = await orders.getOrder(orderId);
                        return {
                            orderId,
                            order,
                            success: true
                        };
                    } catch (error) {
                        console.error(`Failed to get order ${orderId}:`, error);
                        return {
                            orderId,
                            order: null,
                            success: false,
                            error: error instanceof Error ? error.message : String(error)
                        };
                    }
                })
            );

            // Filter out failed order retrievals
            const validOrders = ordersData.filter(item => item.success && item.order);
            const failedOrders = ordersData.filter(item => !item.success);

            if (validOrders.length === 0) {
                return {
                    success: false,
                    successCount: 0,
                    failureCount: params.orderIds.length,
                    results: failedOrders.map(item => ({
                        orderId: item.orderId,
                        success: false,
                        error: item.error || 'Failed to retrieve order',
                        fulfillmentId: undefined
                    })),
                    message: 'No orders could be processed'
                };
            }

            // Prepare bulk fulfillment data
            const ordersWithFulfillments = validOrders.map(({ orderId, order }) => {
                // Get all unfulfilled line items
                const lineItems = (order?.lineItems || [])
                    .filter(item => {
                        const totalQty = item.quantity || 1;
                        const fulfilledQty = (item as any).fulfilledQuantity || 0;
                        return fulfilledQty < totalQty; // Only unfulfilled items
                    })
                    .map(item => ({
                        _id: item._id,
                        quantity: (item.quantity || 1) - ((item as any).fulfilledQuantity || 0) // Remaining quantity
                    }));

                const fulfillment: any = {
                    lineItems,
                    status: 'Fulfilled'
                };

                if (params.trackingNumber && params.shippingProvider) {
                    const shippingProvider = this.mapShippingProvider(params.shippingProvider);

                    fulfillment.trackingInfo = {
                        trackingNumber: params.trackingNumber,
                        shippingProvider: shippingProvider
                    };
                }

                return {
                    orderId,
                    fulfillments: [fulfillment]
                };
            }).filter(orderFulfillment =>
                // Only include orders that have items to fulfill
                orderFulfillment.fulfillments[0].lineItems.length > 0
            );

            if (ordersWithFulfillments.length === 0) {
                return {
                    success: false,
                    successCount: 0,
                    failureCount: params.orderIds.length,
                    results: params.orderIds.map(orderId => ({
                        orderId,
                        success: false,
                        error: 'No unfulfilled items found',
                        fulfillmentId: undefined
                    })),
                    message: 'No orders have unfulfilled items to process'
                };
            }

            console.log('📦 Prepared bulk fulfillment data:', {
                orderCount: ordersWithFulfillments.length,
                totalLineItems: ordersWithFulfillments.reduce((total, order) =>
                    total + order.fulfillments[0].lineItems.length, 0
                )
            });

            // Execute bulk fulfillment
            const bulkResult = await orderFulfillments.bulkCreateFulfillments(ordersWithFulfillments);

            console.log('✅ Bulk fulfillment API response:', {
                totalSuccesses: bulkResult.bulkActionMetadata?.totalSuccesses || 0,
                totalFailures: bulkResult.bulkActionMetadata?.totalFailures || 0,
                resultsCount: bulkResult.results?.length || 0
            });

            // Process results
            const results = (bulkResult.results || []).map(result => ({
                orderId: result.itemMetadata?._id || '',
                success: result.itemMetadata?.success || false,
                error: result.itemMetadata?.success ? undefined : 'Fulfillment failed',
                fulfillmentId: result.ordersWithFulfillments?.fulfillments?.[0]?._id || undefined
            }));

            // Add failed order retrievals to results
            failedOrders.forEach(failedOrder => {
                results.push({
                    orderId: failedOrder.orderId,
                    success: false,
                    error: failedOrder.error || 'Failed to retrieve order',
                    fulfillmentId: undefined
                });
            });

            const successCount = results.filter(r => r.success).length;
            const failureCount = results.filter(r => !r.success).length;

            return {
                success: successCount > 0,
                successCount,
                failureCount,
                results,
                message: `Bulk fulfillment completed: ${successCount} succeeded, ${failureCount} failed`
            };

        } catch (error) {
            console.error('❌ OrderService.bulkMarkOrdersAsFulfilled failed:', error);

            return {
                success: false,
                successCount: 0,
                failureCount: params.orderIds.length,
                results: params.orderIds.map(orderId => ({
                    orderId,
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    fulfillmentId: undefined
                })),
                message: `Bulk fulfillment failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Map shipping provider names to Wix-compatible values
     * Returns custom carrier name if provider is 'custom' or 'other', otherwise maps to standard provider
     */
    private mapShippingProvider(provider: string, customName?: string): string {
        if (provider === 'other') {
            return customName || 'Other';
        }

        const mapping: Record<string, string> = {
            'dhl': 'dhl',
            'ups': 'ups',
            'fedex': 'fedex',
            'usps': 'usps',
            'royal-mail': 'royal-mail',
            'canada-post': 'canadaPost',
            'canadapost': 'canadaPost'
        };

        return mapping[provider.toLowerCase()] || provider.toLowerCase();
    }

    // ===== EXISTING TRANSFORMATION METHODS (enhanced) =====

    private transformOrderFromBackend = (backendOrder: any): Order => {
        const isProd = !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1');

        // Enhanced status handling
        let finalStatus: OrderStatus;

        const orderStatus = backendOrder.rawOrder?.status || backendOrder.status;
        if (orderStatus === 'CANCELED' || orderStatus === 'CANCELLED') {
            finalStatus = 'CANCELED';
        } else {
            const fulfillmentStatus = backendOrder.rawOrder?.fulfillmentStatus ||
                backendOrder.fulfillmentStatus ||
                'NOT_FULFILLED';
            finalStatus = this.normalizeOrderStatus(fulfillmentStatus);
        }

        // 🔥 ENHANCED: Process line items with improved fulfillment details
        const items = (backendOrder.items || []).map((item: any) => {
            const lineItemId = item._id || item.id;
            const fulfilledQuantity = item.fulfilledQuantity || 0;
            const quantity = item.quantity || 0;
            const remainingQuantity = Math.max(0, quantity - fulfilledQuantity);

            // Determine line item fulfillment status
            let fulfillmentStatus: 'FULFILLED' | 'PARTIALLY_FULFILLED' | 'NOT_FULFILLED' = 'NOT_FULFILLED';
            if (fulfilledQuantity > 0) {
                fulfillmentStatus = fulfilledQuantity >= quantity ? 'FULFILLED' : 'PARTIALLY_FULFILLED';
            }

            // 🔥 ENHANCED: Process fulfillment details with better tracking info
            const fulfillments = backendOrder.rawOrder?.fulfillments || [];
            const lineItemFulfillments: any[] = [];
            const trackingInfos: any[] = [];

            // Track unique tracking numbers and their quantities
            const trackingMap = new Map<string, {
                quantity: number;
                trackingUrl?: string;
                carrier?: string;
                fulfillmentId?: string;
                fulfillmentDate?: string;
            }>();

            fulfillments.forEach((fulfillment: any) => {
                const lineItem = fulfillment.lineItems?.find((li: any) =>
                    (li.lineItemId === lineItemId) || (li._id === lineItemId)
                );

                if (lineItem) {
                    // Add to line item fulfillments
                    lineItemFulfillments.push({
                        quantity: lineItem.quantity,
                        fulfillmentId: fulfillment._id,
                        trackingNumber: fulfillment.trackingInfo?.trackingNumber,
                        trackingUrl: fulfillment.trackingInfo?.trackingLink,
                        carrier: fulfillment.trackingInfo?.shippingProvider,
                        fulfillmentDate: fulfillment._createdDate
                    });

                    // Track unique tracking numbers
                    const trackingNumber = fulfillment.trackingInfo?.trackingNumber;
                    if (trackingNumber) {
                        const existing = trackingMap.get(trackingNumber) || { quantity: 0 };
                        trackingMap.set(trackingNumber, {
                            quantity: existing.quantity + lineItem.quantity,
                            trackingUrl: fulfillment.trackingInfo?.trackingLink,
                            carrier: fulfillment.trackingInfo?.shippingProvider,
                            fulfillmentId: fulfillment._id,
                            fulfillmentDate: fulfillment._createdDate
                        });
                    }
                }
            });

            // Convert tracking map to array
            trackingMap.forEach((value, trackingNumber) => {
                trackingInfos.push({
                    trackingNumber,
                    trackingUrl: value.trackingUrl,
                    carrier: value.carrier,
                    quantity: value.quantity,
                    fulfillmentId: value.fulfillmentId,
                    fulfillmentDate: value.fulfillmentDate
                });
            });

            return {
                ...item,
                fulfilledQuantity,
                remainingQuantity,
                fulfillmentStatus,
                fulfillmentDetails: {
                    lineItemFulfillment: lineItemFulfillments.length > 0 ? lineItemFulfillments : undefined,
                    trackingInfo: trackingInfos.length > 0 ? trackingInfos : undefined,
                    totalFulfilled: fulfilledQuantity // 🔥 NEW: Add total fulfilled for easier access
                }
            };
        });

        return {
            _id: backendOrder._id,
            number: backendOrder.number,
            _createdDate: backendOrder._createdDate,
            customer: {
                firstName: backendOrder.customer?.firstName || '',
                lastName: backendOrder.customer?.lastName || '',
                email: backendOrder.customer?.email || '',
                phone: backendOrder.customer?.phone || '',
                company: backendOrder.customer?.company || ''
            },
            items,
            lineItems: items, // 🔥 NEW: Also populate lineItems for consistency
            totalWeight: backendOrder.totalWeight || 0,
            total: backendOrder.total,
            status: finalStatus,
            paymentStatus: this.normalizePaymentStatus(backendOrder.paymentStatus),
            shippingInfo: backendOrder.shippingInfo || {
                carrierId: '',
                title: '',
                cost: '$0.00'
            },
            weightUnit: backendOrder.weightUnit || 'KG',
            shippingAddress: backendOrder.shippingAddress || null,
            billingInfo: backendOrder.billingInfo,
            recipientInfo: backendOrder.recipientInfo,
            rawOrder: backendOrder.rawOrder || backendOrder,
            buyerNote: backendOrder.buyerNote || '',
            // 🔥 NEW: Add fulfillment status to main order
            fulfillmentStatus: this.calculateOverallFulfillmentStatus(items)
        };
    }

    /**
     * 🔥 NEW: Calculate overall fulfillment status from items
     */
    private calculateOverallFulfillmentStatus(items: any[]): string {
        if (!items || items.length === 0) return 'NOT_FULFILLED';

        const totalItems = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
        const fulfilledItems = items.reduce((sum, item) => sum + (item.fulfilledQuantity || 0), 0);

        if (fulfilledItems >= totalItems && totalItems > 0) return 'FULFILLED';
        if (fulfilledItems > 0) return 'PARTIALLY_FULFILLED';
        return 'NOT_FULFILLED';
    }

    private normalizeOrderStatus = (status: any): OrderStatus => {
        if (!status) return 'NOT_FULFILLED';

        const statusString = String(status).toUpperCase().trim();

        switch (statusString) {
            case 'NOT_FULFILLED':
            case 'UNFULFILLED':
            case 'PENDING':
                return 'NOT_FULFILLED';
            case 'PARTIALLY_FULFILLED':
            case 'PARTIAL':
                return 'PARTIALLY_FULFILLED';
            case 'FULFILLED':
            case 'COMPLETE':
            case 'COMPLETED':
            case 'SHIPPED':
                return 'FULFILLED';
            case 'CANCELED':
            case 'CANCELLED':
                return 'CANCELED';
            default:
                console.warn(`🚨 Unknown order status: "${statusString}" - defaulting to NOT_FULFILLED`);
                return 'NOT_FULFILLED';
        }
    }

    private normalizePaymentStatus = (paymentStatus: any): PaymentStatus => {
        if (!paymentStatus) return 'UNPAID'; // Default to UNPAID instead of UNKNOWN

        const statusString = String(paymentStatus).toUpperCase().trim();

        switch (statusString) {
            case 'PAID':
            case 'FULLY_PAID':
                return 'PAID';
            case 'PARTIALLY_PAID':
            case 'PARTIAL':
                return 'PARTIALLY_PAID';
            case 'UNPAID':
            case 'NOT_PAID':
                return 'UNPAID';
            case 'PENDING':
            case 'PENDING_PAYMENT':
                return 'PENDING';
            case 'AUTHORIZED':
                return 'AUTHORIZED';
            case 'DECLINED':
            case 'FAILED':
                return 'DECLINED';
            case 'CANCELED':
            case 'CANCELLED':
                return 'CANCELED';
            case 'FULLY_REFUNDED':
            case 'REFUNDED':
                return 'FULLY_REFUNDED';
            case 'PARTIALLY_REFUNDED':
            case 'PARTIAL_REFUND':
                return 'PARTIALLY_REFUNDED';
            case 'PENDING_REFUND':
                return 'PENDING_REFUND';
            default:
                console.warn(`🚨 Unknown payment status: "${statusString}" - defaulting to UNPAID`);
                return 'UNPAID'; // Default to UNPAID instead of UNKNOWN
        }
    }
}