// services/RealtimeOrderService.ts
import { orders } from '@wix/ecom';
import type { Order, Customer, OrderItem } from '../types/Order';
import { settingsStore } from '../stores/SettingsStore';

export class RealtimeOrderService {
    private isPolling: boolean = false;
    private pollingInterval: any = null;
    private onNewOrderCallbacks: Array<(order: Order) => void> = [];
    private _initialLoad: boolean = true;
    private visibilityChangeHandler: (() => void) | null = null;
    private lastFetchTime: number = 0;
    private readonly MIN_FETCH_INTERVAL = 30000; // Minimum 30 seconds between fetches

    /**
     * Check if the service is still in the initial load phase
     */
    public get isInitialLoad(): boolean {
        return this._initialLoad;
    }

    constructor() {
        console.log('🔄 RealtimeOrderService: Constructor started, checking settings...');
        console.log('🔄 RealtimeOrderService: Settings store automaticDetection:', settingsStore.automaticDetection);
        
        // Setup visibility change detection
        this.setupVisibilityHandling();
        
        // Wait a bit for settings to initialize, then start polling
        setTimeout(() => {
            console.log('🔄 RealtimeOrderService: Starting delayed initialization...');
            console.log('🔄 RealtimeOrderService: Settings after delay:', {
                automaticDetection: settingsStore.automaticDetection,
                soundAlert: settingsStore.soundAlert
            });
            
            this.startPolling().then(() => {
                console.log('🔄 RealtimeOrderService: Polling started successfully');
                // After the first poll, mark that initial load is complete
                setTimeout(() => {
                    this._initialLoad = false;
                    console.log('🔄 RealtimeOrderService: Initial load completed, ready for notifications');
                }, 3000); // Give more time for initial orders to be processed
            });
        }, 1000); // Wait 1 second for settings to initialize
        
        console.log('🔄 RealtimeOrderService: Constructor completed, polling will start in 1 second...');
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

        this.isPolling = true;
        this.pollingInterval = setInterval(async () => {
            console.log('⏰ RealtimeOrderService: Polling interval triggered', {
                automaticDetection: settingsStore.automaticDetection,
                documentHidden: document.hidden,
                timeSinceLastFetch: Date.now() - this.lastFetchTime
            });
            
            // Always check the setting inside the interval - this allows for dynamic start/stop
            if (settingsStore.automaticDetection && !document.hidden) {
                // Throttle requests to prevent excessive API calls
                const now = Date.now();
                if (now - this.lastFetchTime >= this.MIN_FETCH_INTERVAL) {
                    console.log('⏰ RealtimeOrderService: Conditions met, calling checkForNewOrders...');
                    this.lastFetchTime = now;
                    await this.checkForNewOrders();
                } else {
                    console.log('⏰ RealtimeOrderService: Throttled - too soon since last fetch');
                }
            } else {
                console.log('⏰ RealtimeOrderService: Skipped - automaticDetection disabled or document hidden');
            }
        }, 60000);

        console.log('🔄 RealtimeOrderService: Polling started (60s intervals)');
        return true;
    }

    private async checkForNewOrders() {
        try {
            console.log('🔍 RealtimeOrderService: Checking for new orders...', {
                automaticDetection: settingsStore.automaticDetection,
                isInitialLoad: this.isInitialLoad,
                processedOrdersCount: typeof window !== 'undefined' ? window.__GLOBAL_PROCESSED_ORDERS?.size : 0
            });

            const response = await orders.searchOrders({
                sort: [{ fieldName: '_createdDate', order: 'DESC' }],
                cursorPaging: { limit: 5 }
            });

            if (!response.orders || response.orders.length === 0) {
                console.log('🔍 RealtimeOrderService: No orders found');
                return;
            }

            console.log(`🔍 RealtimeOrderService: Found ${response.orders.length} orders`);

            // Initialize processed orders set if it doesn't exist
            if (typeof window !== 'undefined') {
                if (!window.__GLOBAL_PROCESSED_ORDERS) {
                    window.__GLOBAL_PROCESSED_ORDERS = new Set<string>();
                }
            }

            // Always mark all fetched orders as processed first
            response.orders.forEach((order: any) => {
                if (order._id && typeof window !== 'undefined') {
                    window.__GLOBAL_PROCESSED_ORDERS?.add(order._id);
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
                const orderDate = new Date(rawOrder._createdDate!);
                const now = new Date();
                const timeDiff = now.getTime() - orderDate.getTime();
                const twoMinutesInMs = 2 * 60 * 1000;

                // Only notify for orders that are both new and recent
                if (timeDiff <= twoMinutesInMs) {
                    const transformedOrder = this.transformOrder(rawOrder);

                    console.log('🆕 RealtimeOrderService: Processing new order', {
                        orderId: transformedOrder._id,
                        orderNumber: transformedOrder.number,
                        isInitialLoad: this.isInitialLoad,
                        callbacksCount: this.onNewOrderCallbacks.length
                    });

                    this.onNewOrderCallbacks.forEach(callback => {
                        setTimeout(() => {
                            try {
                                callback(transformedOrder);
                            } catch (error) {
                                console.error('RealtimeOrderService: Callback error:', error);
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
            isListening: this.isPolling,
            automaticDetection: settingsStore.automaticDetection,
            isInitialLoad: this.isInitialLoad,
            processedOrdersCount: typeof window !== 'undefined' ? window.__GLOBAL_PROCESSED_ORDERS?.size : 0,
            callbacksRegistered: this.onNewOrderCallbacks.length
        };
    }

    /**
     * Force restart polling - useful when settings change
     */
    public forceRestart() {
        console.log('🔄 RealtimeOrderService: Force restarting...');
        this.stopPolling();
        this.startPolling();
    }

    /**
     * Manual check for new orders (for testing/debugging)
     */
    public async manualCheck() {
        console.log('🔍 RealtimeOrderService: Manual check triggered');
        await this.checkForNewOrders();
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

    private setupVisibilityHandling(): void {
        if (typeof document !== 'undefined') {
            this.visibilityChangeHandler = () => {
                if (document.hidden) {
                    // Pause polling when tab is hidden
                    if (this.isPolling) {
                        this.stopPolling();
                        // Store that we were polling so we can resume
                        (this as any)._wasPollingSuspended = true;
                    }
                } else {
                    // Resume polling when tab becomes visible
                    if ((this as any)._wasPollingSuspended && settingsStore.automaticDetection) {
                        this.startPolling();
                        (this as any)._wasPollingSuspended = false;
                    }
                }
            };
            
            document.addEventListener('visibilitychange', this.visibilityChangeHandler);
        }
    }

    public destroy() {
        this.stopPolling();
        this.onNewOrderCallbacks = [];
        
        // Clean up event listeners
        if (this.visibilityChangeHandler && typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
            this.visibilityChangeHandler = null;
        }
    }
}