// backend/services/wix-orders.service.ts
import { mapWixOrder } from '../utils/order-mapper';

export class WixOrdersService {
    private orders: any;

    constructor() {
        this.initializeOrdersAPI();
    }

    private async initializeOrdersAPI() {
        try {
            const { orders } = await import('@wix/ecom');
            this.orders = orders;
        } catch (error) {
            console.error('Failed to initialize Wix Orders API:', error);
            throw new Error('Orders API not available');
        }
    }

    /**
     * Search orders with pagination and filtering
     */
    async searchOrders(options: {
        limit?: number;
        cursor?: string;
        filter?: any;
    } = {}) {
        if (!this.orders) {
            await this.initializeOrdersAPI();
        }

        const { limit = 1000, cursor, filter } = options;

        try {
            const searchParams = {
                search: {
                    filter: filter || {
                        status: { "$ne": "INITIALIZED" }
                    },
                    cursorPaging: {
                        limit,
                        cursor: cursor || undefined
                    }
                }
            };

            const result = await this.orders.searchOrders(searchParams);

            return {
                success: true,
                orders: result.orders?.map(mapWixOrder) || [],
                metadata: result.metadata || {},
                pagination: {
                    hasNext: result.metadata?.hasNext || false,
                    nextCursor: result.metadata?.cursors?.next || '',
                    prevCursor: result.metadata?.cursors?.prev || ''
                }
            };

        } catch (error) {
            console.error('Error searching orders:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                orders: [],
                metadata: {},
                pagination: { hasNext: false, nextCursor: '', prevCursor: '' }
            };
        }
    }

    /**
     * Get a single order by ID
     */
    async getOrder(orderId: string) {
        if (!this.orders) {
            await this.initializeOrdersAPI();
        }

        try {
            const order = await this.orders.getOrder(orderId);
            return {
                success: true,
                order: order ? mapWixOrder(order) : null
            };
        } catch (error) {
            console.error(`Error getting order ${orderId}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                order: null
            };
        }
    }

    /**
     * Get raw order data (unmapped) for fulfillment operations
     */
    async getRawOrder(orderId: string) {
        if (!this.orders) {
            await this.initializeOrdersAPI();
        }

        try {
            return await this.orders.getOrder(orderId);
        } catch (error) {
            console.error(`Error getting raw order ${orderId}:`, error);
            throw error;
        }
    }

    /**
     * Query orders with custom filters
     */
    async queryOrders(queryOptions: any) {
        if (!this.orders) {
            await this.initializeOrdersAPI();
        }

        try {
            const result = await this.orders.queryOrders(queryOptions);
            return {
                success: true,
                orders: result.items?.map(mapWixOrder) || [],
                totalCount: result.totalCount || 0,
                hasNext: result.hasNext || false
            };
        } catch (error) {
            console.error('Error querying orders:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                orders: [],
                totalCount: 0,
                hasNext: false
            };
        }
    }
}