// backend/services/wix-fulfillment.service.ts

export class WixFulfillmentService {
    private fulfillmentAPI: any;
    private ordersAPI: any;

    constructor() {
        this.initializeFulfillmentAPI();
    }

    private async initializeFulfillmentAPI() {
        try {
            const importStartTime = Date.now();

            const ecomModule = await import('@wix/ecom');

            this.fulfillmentAPI = ecomModule.orderFulfillments;
            this.ordersAPI = ecomModule.orders;

        } catch (error) {
            console.error(`❌ WixFulfillmentService.initializeFulfillmentAPI ERROR:`, {
                errorType: error?.constructor?.name,
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                fullError: error
            });
            throw new Error('Fulfillment API not available');
        }
    }

    /**
     * Create a new fulfillment for an order
     */
    async createFulfillment(orderId: string, fulfillmentData: {
        trackingNumber: string;
        shippingProvider: string;
        trackingUrl?: string;
        customCarrierName?: string;
    }) {

        if (!this.fulfillmentAPI || !this.ordersAPI) {
            await this.initializeFulfillmentAPI();
        }

        try {
            // First get the order to get line item IDs
            const orderStartTime = Date.now();
            const order = await this.ordersAPI.getOrder(orderId);

            if (!order) {
                throw new Error(`Order ${orderId} not found`);
            }

            if (!order.lineItems || order.lineItems.length === 0) {
                throw new Error(`Order ${orderId} has no line items to fulfill`);
            }

            // Prepare line items for fulfillment (fulfill all items)
            const lineItems = order.lineItems.map((item: any) => ({
                _id: item._id,
                quantity: item.quantity || 1
            }));

            // Map shipping provider to correct format
            const originalProvider = fulfillmentData.shippingProvider;
            const mappedProvider = this.mapShippingProvider(fulfillmentData.shippingProvider);

            // Build tracking info object
            const trackingInfoObj: any = {
                trackingNumber: fulfillmentData.trackingNumber,
                shippingProvider: fulfillmentData.customCarrierName || mappedProvider
            };

            // Add tracking link if provided
            if (fulfillmentData.trackingUrl) {
                trackingInfoObj.trackingLink = fulfillmentData.trackingUrl;
            }

            // Create fulfillment with proper structure
            const fulfillment = {
                lineItems: lineItems,
                trackingInfo: trackingInfoObj,
                status: 'Fulfilled'
            };

            const createMethod = this.fulfillmentAPI.createFulfillment;

            if (typeof createMethod !== 'function') {
                console.error(`❌ createFulfillment method not available. Type: ${typeof createMethod}`);
                throw new Error('createFulfillment method not available');
            }

            const fulfillmentStartTime = Date.now();

            const result = await createMethod(orderId, fulfillment);
            console.log(`✅ Fulfillment API response:`, JSON.stringify(result, null, 2));

            const returnValue = {
                success: true,
                method: 'createFulfillment',
                result,
                fulfillmentId: result.fulfillmentId
            };

// Debug log removed
            return returnValue;

        } catch (error) {
            console.error(`❌ WixFulfillmentService.createFulfillment ERROR:`, {
                errorType: error?.constructor?.name,
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                fullError: error
            });

            const returnValue = {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                method: 'createFulfillment'
            };

// Debug log removed
            return returnValue;
        }
    }

    /**
     * Update existing fulfillment tracking information
     */
    async updateFulfillment(orderId: string, fulfillmentId: string, trackingInfo: {
        trackingNumber: string;
        shippingProvider: string;
        trackingUrl?: string;
        customCarrierName?: string;
    }) {

        if (!this.fulfillmentAPI) {
            await this.initializeFulfillmentAPI();
        }

        try {
            const updateMethod = this.fulfillmentAPI.updateFulfillment;

            if (typeof updateMethod !== 'function') {
                console.error(`❌ updateFulfillment method not available. Type: ${typeof updateMethod}`);
                throw new Error('updateFulfillment method not available');
            }

            // Map shipping provider to correct format
            const mappedProvider = this.mapShippingProvider(trackingInfo.shippingProvider);

            // Build tracking info object
            const trackingInfoObj: any = {
                trackingNumber: trackingInfo.trackingNumber,
                shippingProvider: trackingInfo.customCarrierName || mappedProvider
            };

            // Add tracking link if provided
            if (trackingInfo.trackingUrl) {
                trackingInfoObj.trackingLink = trackingInfo.trackingUrl;
            }

            const identifiers = {
                orderId: orderId,
                fulfillmentId: fulfillmentId
            };

            const options = {
                fulfillment: {
                    trackingInfo: trackingInfoObj
                }
            };

            const updateStartTime = Date.now();

            const result = await updateMethod(identifiers, options);

            const returnValue = {
                success: true,
                method: 'updateFulfillment',
                result
            };

            return returnValue;

        } catch (error) {
            console.error(`❌ WixFulfillmentService.updateFulfillment ERROR:`, {
                errorType: error?.constructor?.name,
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                fullError: error
            });

            const returnValue = {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                method: 'updateFulfillment'
            };

            return returnValue;
        }
    }

    /**
     * Get fulfillments for an order
     */
    async getFulfillments(orderId: string) {
        if (!this.fulfillmentAPI) {
            await this.initializeFulfillmentAPI();
        }

        const methods = [
            'listFulfillmentsForSingleOrder',
            'listFulfillments',
            'getFulfillments',
            'queryFulfillments'
        ];

        for (const methodName of methods) {
            try {
                const method = this.fulfillmentAPI[methodName];

                if (typeof method === 'function') {
                    let result;

                    if (methodName === 'listFulfillmentsForSingleOrder') {
                        result = await method(orderId);
                    } else if (methodName === 'listFulfillments') {
                        result = await method({ orderId });
                    } else if (methodName === 'getFulfillments') {
                        result = await method(orderId);
                    } else if (methodName === 'queryFulfillments') {
                        result = await method({ filter: { orderId: { $eq: orderId } } });
                    }

                    if (result) {
                        return {
                            success: true,
                            fulfillments: this.extractFulfillments(result),
                            method: methodName,
                            rawResult: result
                        };
                    }
                }
            } catch (error) {
                console.warn(`Method ${methodName} failed:`, error);
                continue;
            }
        }

        return {
            success: false,
            error: 'Could not retrieve fulfillments using any available method',
            fulfillments: []
        };
    }

    /**
     * Extract fulfillments from different response structures
     */
    private extractFulfillments(result: any): any[] {
        if (result.orderWithFulfillments?.fulfillments) {
            return result.orderWithFulfillments.fulfillments;
        }

        if (result.fulfillments) {
            return result.fulfillments;
        }

        if (Array.isArray(result)) {
            return result;
        }

        return [];
    }

    /**
     * Map shipping provider names to Wix-compatible values
     */
    mapShippingProvider(provider: string): string {
        const mapping: Record<string, string> = {
            'dhl': 'dhl',
            'ups': 'ups',
            'fedex': 'fedex',
            'usps': 'usps',
            'royal-mail': 'royal-mail',
            'canada-post': 'canadaPost',
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

        return mapping[provider.toLowerCase()] || 'other';
    }
}