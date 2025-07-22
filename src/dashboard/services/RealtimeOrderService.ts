// services/RealtimeOrderService.ts
import { orders } from '@wix/ecom';
import type { Order, Customer, OrderItem } from '../types/Order';
import { settingsStore } from '../stores/SettingsStore';

export class RealtimeOrderService {
    private isPolling: boolean = false;
    private pollingInterval: any = null;
    private onNewOrderCallbacks: Array<(order: Order) => void> = [];
    private _initialLoad: boolean = true;

    /**
     * Check if the service is still in the initial load phase
     */
    public get isInitialLoad(): boolean {
        return this._initialLoad;
    }

    constructor() {
        // Start polling but don't process initial orders
        this.startPolling().then(() => {
            // After the first poll, mark that initial load is complete
            setTimeout(() => {
                this._initialLoad = false;
            }, 1000); // Give more time for initial orders to be processed
        });
    }

    onNewOrder(callback: (order: Order) => void) {
        this.onNewOrderCallbacks.push(callback);

        return () => {
            const index = this.onNewOrderCallbacks.indexOf(callback);
            if (index > -1) {
                this.onNewOrderCallbacks.splice(index, 1);
            }
        };
    }

    async startPolling(): Promise<boolean> {
        if (this.isPolling) {
            return true;
        }

        if (!settingsStore.automaticDetection) {
            return false;
        }

        this.isPolling = true;
        this.pollingInterval = setInterval(async () => {
            if (settingsStore.automaticDetection && !document.hidden) {
                await this.checkForNewOrders();
            }
        }, 60000);

        return true;
    }

    private async checkForNewOrders() {
        try {
            const response = await orders.searchOrders({
                sort: [{ fieldName: '_createdDate', order: 'DESC' }],
                cursorPaging: { limit: 5 }
            });

            if (!response.orders || response.orders.length === 0) {
                return;
            }

            // Initialize processed orders set if it doesn't exist
            if (typeof window !== 'undefined') {
                if (!window.__GLOBAL_PROCESSED_ORDERS) {
                    window.__GLOBAL_PROCESSED_ORDERS = new Set<string>();
                }
            }

            // Always mark all fetched orders as processed first
            response.orders.forEach((order: any) => {
                if (order._id && typeof window !== 'undefined') {
                    window.__GLOBAL_PROCESSED_ORDERS.add(order._id);
                }
            });

            // Skip processing orders during initial load - just return after marking them as processed
            if (this.isInitialLoad) {
                return;
            }

            // Only process truly new orders (orders that weren't in the processed set before this call)
            for (const rawOrder of response.orders) {
                const orderId = rawOrder._id!;

                // Check if this order was created very recently (within last 2 minutes)
                const orderDate = new Date(rawOrder._createdDate);
                const now = new Date();
                const timeDiff = now.getTime() - orderDate.getTime();
                const twoMinutesInMs = 2 * 60 * 1000;

                // Only notify for orders that are both new and recent
                if (timeDiff <= twoMinutesInMs) {
                    const transformedOrder = this.transformOrder(rawOrder);

                    this.onNewOrderCallbacks.forEach(callback => {
                        setTimeout(() => {
                            try {
                                callback(transformedOrder);
                            } catch {
                                // Silently handle callback errors
                            }
                        }, 0);
                    });
                }
            }

            this.cleanupOldProcessedOrders();

        } catch {
            // Silently handle polling errors
        }
    }

    private cleanupOldProcessedOrders() {
        if (typeof window !== 'undefined' && window.__GLOBAL_PROCESSED_ORDERS) {
            // Keep only last 1000 processed orders to prevent memory bloat
            const processedArray = Array.from(window.__GLOBAL_PROCESSED_ORDERS);
            if (processedArray.length > 1000) {
                window.__GLOBAL_PROCESSED_ORDERS = new Set(processedArray.slice(-1000));
            }
        }
    }

    private transformOrder(rawOrder: any): Order {
        const customer: Customer = {
            firstName: rawOrder.billingInfo?.contactDetails?.firstName ||
                rawOrder.recipientInfo?.contactDetails?.firstName || 'Unknown',
            lastName: rawOrder.billingInfo?.contactDetails?.lastName ||
                rawOrder.recipientInfo?.contactDetails?.lastName || 'Customer',
            email: rawOrder.billingInfo?.contactDetails?.email ||
                rawOrder.recipientInfo?.contactDetails?.email || '',
            phone: rawOrder.billingInfo?.contactDetails?.phone ||
                rawOrder.recipientInfo?.contactDetails?.phone || ''
        };

        const items: OrderItem[] = (rawOrder.lineItems || []).map((item: any) => ({
            name: item.name || 'Unknown Product',
            quantity: item.quantity || 1,
            price: item.price?.formattedAmount || '€0.00',
            weight: item.weight,
            sku: item.sku,
            productId: item.productId,
            variantId: item.variantId,
            image: item.imageUrl,
            _id: item._id
        }));

        // Map the fulfillment status correctly
        let fulfillmentStatus = rawOrder.fulfillmentStatus || rawOrder.status || 'NOT_FULFILLED';

        return {
            _id: rawOrder._id || `order-${Math.random().toString(36).substr(2, 9)}`,
            number: rawOrder.number || `ORDER-${rawOrder._id?.substr(0, 8) || 'UNKNOWN'}`,
            _createdDate: rawOrder._createdDate || new Date().toISOString(),
            customer,
            items,
            totalWeight: rawOrder.totalWeight || 0,
            total: rawOrder.priceSummary?.total?.formattedAmount || '€0.00',
            status: fulfillmentStatus,
            paymentStatus: rawOrder.paymentStatus || 'NOT_PAID',
            shippingInfo: {
                carrierId: rawOrder.shippingInfo?.carrierId || 'unknown',
                title: rawOrder.shippingInfo?.title || 'Standard Shipping',
                cost: rawOrder.shippingInfo?.cost?.formattedAmount || '€0.00'
            },
            weightUnit: rawOrder.weightUnit || 'kg',
            shippingAddress: rawOrder.shippingAddress,
            billingInfo: rawOrder.billingInfo,
            recipientInfo: rawOrder.recipientInfo,
            buyerNote: rawOrder.buyerNote,
            rawOrder,
            customFields: rawOrder.customFields,
            extendedFields: rawOrder.extendedFields
        };
    }



    public getStatus() {
        return {
            isListening: this.isPolling
        };
    }

    public stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        this.isPolling = false;
    }

    /**
 * Reset the initial load state
 * Only call this when you specifically want to re-initialize the service
 */
    public resetInitialLoad() {
        this._initialLoad = true;

        if (typeof window !== 'undefined' && window.__GLOBAL_PROCESSED_ORDERS) {
            window.__GLOBAL_PROCESSED_ORDERS.clear();
        }
    }

    public destroy() {
        this.stopPolling();
        this.onNewOrderCallbacks = [];
    }
}