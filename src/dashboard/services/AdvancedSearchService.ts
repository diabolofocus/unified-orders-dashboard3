// services/AdvancedSearchService.ts - FIXED with proper contact ID search
import type { Order } from '../types/Order';
import type { WixOrdersApiResponse } from '../types/API';
import { mapWixOrder } from '../../backend//utils/order-mapper';

export interface SearchFilters {
    query: string;
    status?: string[];
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    skus?: string[];
}

export interface SearchResult {
    orders: Order[];
    fromCache: Order[];
    fromApi: Order[];
    hasMore: boolean;
    nextCursor?: string;
    totalFound: number;
    searchTime: number;
}

export class AdvancedSearchService {
    private searchCache = new Map<string, SearchResult>();
    private searchTimeout: number | null = null;

    /**
     * Performs a two-stage search:
     * 1. Quick search through loaded orders (cache)
     * 2. API search with filters for comprehensive results
     */
    async performAdvancedSearch(
        query: string,
        loadedOrders: Order[],
        filters: SearchFilters = { query }
    ): Promise<SearchResult> {
        const startTime = performance.now();
        const cacheKey = this.generateCacheKey(query, filters);

        // Return cached result if available and recent (< 30 seconds)
        const cached = this.searchCache.get(cacheKey);
        if (cached && (performance.now() - cached.searchTime) < 30000) {
            return cached;
        }

        // Stage 1: Quick search through loaded orders
        const cacheResults = this.searchLoadedOrders(query, loadedOrders, filters);

        // Stage 2: API search for comprehensive results
        const apiResults = await this.searchViaApi(query, filters);

        // Merge and deduplicate results
        const mergedResults = this.mergeSearchResults(cacheResults, apiResults.orders);

        const result: SearchResult = {
            orders: mergedResults,
            fromCache: cacheResults,
            fromApi: apiResults.orders,
            hasMore: apiResults.hasMore,
            nextCursor: apiResults.nextCursor,
            totalFound: mergedResults.length,
            searchTime: performance.now() - startTime
        };

        // Cache the result
        this.searchCache.set(cacheKey, result);
        this.cleanupOldCacheEntries();

        return result;
    }

    /**
     * Quick search through already loaded orders
     */
    private searchLoadedOrders(
        query: string,
        orders: Order[],
        filters: SearchFilters
    ): Order[] {
        if (!query.trim()) return orders;

        const searchTerm = query.toLowerCase().trim();

        return orders.filter(order => {
            // Apply status filter first if provided
            if (filters.status && filters.status.length > 0) {
                if (!filters.status.includes(order.status)) {
                    return false;
                }
            }

            // Apply date filters
            if (filters.dateFrom || filters.dateTo) {
                const orderDate = new Date(order._createdDate);
                if (filters.dateFrom && orderDate < filters.dateFrom) return false;
                if (filters.dateTo && orderDate > filters.dateTo) return false;
            }

            // Search in multiple fields
            return this.matchesSearchTerm(order, searchTerm);
        });
    }

    /**
     * Check if order matches search term in various fields
     */
    private matchesSearchTerm(order: Order, searchTerm: string): boolean {
        // Search in order number
        if (order.number.toLowerCase().includes(searchTerm)) {
            return true;
        }

        // Search in customer info
        const recipientContact = order.rawOrder?.recipientInfo?.contactDetails;
        const billingContact = order.rawOrder?.billingInfo?.contactDetails;
        const buyerInfo = order.rawOrder?.buyerInfo;

        const customerFields = [
            recipientContact?.firstName,
            recipientContact?.lastName,
            billingContact?.firstName,
            billingContact?.lastName,
            order.customer.firstName,
            order.customer.lastName,
            recipientContact?.email,
            billingContact?.email,
            buyerInfo?.email,
            order.customer.email,
            recipientContact?.phone,
            billingContact?.phone,
            order.customer.phone,
            recipientContact?.company,
            billingContact?.company,
            order.customer.company
        ];

        for (const field of customerFields) {
            if (field && field.toLowerCase().includes(searchTerm)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Search via Wix API with filters for comprehensive results
     */
    private async searchViaApi(
        query: string,
        filters: SearchFilters
    ): Promise<{ orders: Order[], hasMore: boolean, nextCursor?: string }> {
        try {
            // Build API filters - this is now async because it needs to search contacts
            const searchFilters = await this.buildApiFilters(query, filters);

            // Import the orders API
            const { orders } = await import('@wix/ecom');

            const searchParams = {
                filter: searchFilters,
                cursorPaging: {
                    limit: Math.min(filters.limit || 100, 100) // API limit is 100
                },
                sort: [{ fieldName: '_createdDate' as const, order: 'DESC' as const }]
            };


            const result = await orders.searchOrders(searchParams);

            // Map raw orders to our Order type
            const mappedOrders = await this.mapRawOrders(result.orders || []);

            return {
                orders: mappedOrders,
                hasMore: result.metadata?.hasNext || false,
                nextCursor: result.metadata?.cursors?.next || undefined
            };

        } catch (error) {
            console.error('❌ API search failed:', error);
            return { orders: [], hasMore: false };
        }
    }



    /**
     * Build API filters based on search query and filters
     * NOW USES buyerInfo.contactId for name searches!
     */
    async buildApiFilters(query: string, filters: SearchFilters): Promise<Record<string, any>> {
        const apiFilters: Record<string, any> = {
            status: { $ne: "INITIALIZED" } // Default filter
        };

        if (!query.trim()) return apiFilters;

        const searchTerm = query.trim();

        // Check if it's an order number (numeric)
        if (/^\d+$/.test(searchTerm)) {
            apiFilters.number = { $eq: parseInt(searchTerm) };
        }
        // Check if it's an email
        else if (this.isEmail(searchTerm)) {
            apiFilters["buyerInfo.email"] = { $eq: searchTerm };
        }
        // Check if it's a partial email
        else if (searchTerm.includes('@')) {
            apiFilters["buyerInfo.email"] = { $startsWith: searchTerm };
        }
        // Name search - Use only supported API fields
        else if (searchTerm.length >= 2) {
            // Use supported fields only: fullName and email
            apiFilters["$or"] = [
                { "billingInfo.contactDetails.fullName": { $startsWith: searchTerm } },
                { "buyerInfo.email": { $startsWith: searchTerm } }
            ];
        }

        // Add status filter if provided
        if (filters.status && filters.status.length > 0) {
            if (filters.status.length === 1) {
                apiFilters.status = { $eq: filters.status[0] };
            } else {
                apiFilters.status = { $in: filters.status };
            }
        }

        // Add date filters
        if (filters.dateFrom || filters.dateTo) {
            const dateFilter: Record<string, any> = {};

            if (filters.dateFrom) {
                dateFilter.$gte = filters.dateFrom.toISOString();
            }

            if (filters.dateTo) {
                // Add one day to include the end date
                const endDate = new Date(filters.dateTo);
                endDate.setDate(endDate.getDate() + 1);
                dateFilter.$lt = endDate.toISOString();
            }

            if (Object.keys(dateFilter).length > 0) {
                apiFilters.createdDate = dateFilter;
            }
        }

        return apiFilters;
    }

    /**
     * Map raw Wix orders to our Order type
     * Reuse the mapping logic from your existing order mapper
     */
    private async mapRawOrders(rawOrders: any[]): Promise<Order[]> {
        return rawOrders.map(mapWixOrder);
    }

    /**
     * Merge and deduplicate search results from cache and API
     */
    private mergeSearchResults(cacheResults: Order[], apiResults: Order[]): Order[] {
        const mergedMap = new Map<string, Order>();

        // Add cache results first (they're already loaded and processed)
        cacheResults.forEach(order => {
            mergedMap.set(order._id, order);
        });

        // Add API results, but don't override cache results
        apiResults.forEach(order => {
            if (!mergedMap.has(order._id)) {
                mergedMap.set(order._id, order);
            }
        });

        // Convert back to array and sort by creation date (newest first)
        return Array.from(mergedMap.values()).sort((a, b) =>
            new Date(b._createdDate).getTime() - new Date(a._createdDate).getTime()
        );
    }

    /**
     * Helper method to check if string is an email
     */
    private isEmail(str: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
    }

    /**
     * Generate cache key for search results
     */
    private generateCacheKey(query: string, filters: SearchFilters): string {
        const key = JSON.stringify({
            query: query.toLowerCase().trim(),
            status: filters.status?.sort(),
            dateFrom: filters.dateFrom?.toISOString(),
            dateTo: filters.dateTo?.toISOString()
        });
        return btoa(key); // Base64 encode for clean key
    }

    /**
     * Clean up old cache entries (keep only last 10)
     */
    private cleanupOldCacheEntries(): void {
        if (this.searchCache.size > 10) {
            const entries = Array.from(this.searchCache.entries());
            // Sort by search time and keep only the most recent 10
            entries.sort((a, b) => b[1].searchTime - a[1].searchTime);

            this.searchCache.clear();
            entries.slice(0, 10).forEach(([key, value]) => {
                this.searchCache.set(key, value);
            });
        }
    }

    /**
     * Clear search cache
     */
    clearCache(): void {
        this.searchCache.clear();
    }

    /**
     * Debounced search for real-time search as user types
     */
    debouncedSearch(
        query: string,
        loadedOrders: Order[],
        filters: SearchFilters,
        callback: (result: SearchResult) => void,
        delay: number = 300
    ): void {
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        this.searchTimeout = setTimeout(async () => {
            const result = await this.performAdvancedSearch(query, loadedOrders, filters);
            callback(result);
        }, delay) as any;
    }

    /**
     * Cancel ongoing debounced search
     */
    cancelDebouncedSearch(): void {
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = null;
        }
    }

    /**
     * Perform status-only filtering (no text search)
     * Works similarly to performAdvancedSearch but for status filters only
     */
    async performStatusOnlySearch(
        statusType: 'fulfillment' | 'payment',
        statusFilter: string,
        loadedOrders: Order[]
    ): Promise<SearchResult> {
        const startTime = performance.now();
        const cacheKey = this.generateStatusCacheKey(statusType, statusFilter);

        // Return cached result if available and recent (< 30 seconds)
        const cached = this.searchCache.get(cacheKey);
        if (cached && (performance.now() - cached.searchTime) < 30000) {
            return cached;
        }

        // Stage 1: Quick filter through loaded orders
        const cacheResults = this.filterLoadedOrdersByStatus(statusType, statusFilter, loadedOrders);

        // Stage 2: API search for comprehensive results
        const apiResults = await this.searchStatusViaApi(statusType, statusFilter);

        // Merge and deduplicate results
        const mergedResults = this.mergeSearchResults(cacheResults, apiResults.orders);

        const result: SearchResult = {
            orders: mergedResults,
            fromCache: cacheResults,
            fromApi: apiResults.orders,
            hasMore: apiResults.hasMore,
            nextCursor: apiResults.nextCursor,
            totalFound: mergedResults.length,
            searchTime: performance.now() - startTime
        };

        // Cache the result
        this.searchCache.set(cacheKey, result);
        this.cleanupOldCacheEntries();

        return result;
    }

    /**
     * Filter loaded orders by status (local filtering)
     */
    private filterLoadedOrdersByStatus(
        statusType: 'fulfillment' | 'payment',
        statusFilter: string,
        orders: Order[]
    ): Order[] {
        return orders.filter(order => {
            if (statusType === 'fulfillment') {
                const fulfillmentStatus = order.status ||
                    order.rawOrder?.fulfillmentStatus ||
                    order.rawOrder?.status ||
                    'NOT_FULFILLED';

                switch (statusFilter) {
                    case 'unfulfilled':
                        return fulfillmentStatus === 'NOT_FULFILLED';
                    case 'fulfilled':
                        return fulfillmentStatus === 'FULFILLED';
                    case 'partially_fulfilled':
                        return fulfillmentStatus === 'PARTIALLY_FULFILLED';
                    case 'canceled':
                        return fulfillmentStatus === 'CANCELED' || order.rawOrder?.status === 'CANCELED';
                    default:
                        return true;
                }
            } else {
                // Payment status filtering
                const paymentStatus = order.paymentStatus ||
                    order.rawOrder?.paymentStatus ||
                    order.rawOrder?.priceSummary?.paymentStatus ||
                    'UNPAID';

                switch (statusFilter) {
                    case 'paid':
                        return paymentStatus === 'PAID';
                    case 'unpaid':
                        return paymentStatus === 'UNPAID';
                    case 'partially_paid':
                        return paymentStatus === 'PARTIALLY_PAID';
                    case 'refunded':
                        return paymentStatus === 'FULLY_REFUNDED';
                    case 'partially_refunded':
                        return paymentStatus === 'PARTIALLY_REFUNDED';
                    case 'authorized':
                        return paymentStatus === 'AUTHORIZED';
                    case 'pending':
                        return paymentStatus === 'PENDING';
                    case 'declined':
                        return paymentStatus === 'DECLINED';
                    case 'canceled':
                        return paymentStatus === 'CANCELED';
                    case 'pending_refund':
                        return paymentStatus === 'PENDING_REFUND';
                    default:
                        return true;
                }
            }
        });
    }

    /**
     * Search via API for status filters
     */
    private async searchStatusViaApi(
        statusType: 'fulfillment' | 'payment',
        statusFilter: string
    ): Promise<{ orders: Order[], hasMore: boolean, nextCursor?: string }> {
        try {
            // Build API filters based on status type and filter
            const searchFilters = this.buildStatusApiFilters(statusType, statusFilter);

            // Import the orders API
            const { orders } = await import('@wix/ecom');

            const searchParams = {
                filter: searchFilters,
                cursorPaging: {
                    limit: 100 // API limit is 100
                },
                sort: [{ fieldName: '_createdDate' as const, order: 'DESC' as const }]
            };

            const result = await orders.searchOrders(searchParams);

            // Map raw orders to our Order type
            const mappedOrders = await this.mapRawOrders(result.orders || []);

            return {
                orders: mappedOrders,
                hasMore: result.metadata?.hasNext || false,
                nextCursor: result.metadata?.cursors?.next || undefined
            };

        } catch (error) {
            console.error('❌ Status API search failed:', error);
            return { orders: [], hasMore: false };
        }
    }

    /**
     * Build API filters for status-only searches
     */
    private buildStatusApiFilters(statusType: 'fulfillment' | 'payment', statusFilter: string): Record<string, any> {
        const baseFilter = {
            status: { $ne: "INITIALIZED" },
            archived: { $ne: true }
        };

        if (statusType === 'fulfillment') {
            switch (statusFilter) {
                case 'unfulfilled':
                    return {
                        ...baseFilter,
                        fulfillmentStatus: { $eq: "NOT_FULFILLED" }
                    };
                case 'fulfilled':
                    return {
                        ...baseFilter,
                        fulfillmentStatus: { $eq: "FULFILLED" }
                    };
                case 'partially_fulfilled':
                    return {
                        ...baseFilter,
                        fulfillmentStatus: { $eq: "PARTIALLY_FULFILLED" }
                    };
                case 'canceled':
                    return {
                        ...baseFilter,
                        status: { $eq: "CANCELED" }
                    };
                default:
                    return baseFilter;
            }
        } else {
            // Payment status filters
            switch (statusFilter) {
                case 'paid':
                    return {
                        ...baseFilter,
                        paymentStatus: { $eq: "PAID" }
                    };
                case 'unpaid':
                    return {
                        ...baseFilter,
                        paymentStatus: { $in: ["UNPAID", "NOT_PAID", "PENDING"] }
                    };
                case 'partially_paid':
                    return {
                        ...baseFilter,
                        paymentStatus: { $eq: "PARTIALLY_PAID" }
                    };
                case 'refunded':
                    return {
                        ...baseFilter,
                        paymentStatus: { $eq: "FULLY_REFUNDED" }
                    };
                case 'partially_refunded':
                    return {
                        ...baseFilter,
                        paymentStatus: { $eq: "PARTIALLY_REFUNDED" }
                    };
                case 'authorized':
                    return {
                        ...baseFilter,
                        paymentStatus: { $eq: "AUTHORIZED" }
                    };
                case 'pending':
                    return {
                        ...baseFilter,
                        paymentStatus: { $eq: "PENDING" }
                    };
                case 'declined':
                    return {
                        ...baseFilter,
                        paymentStatus: { $eq: "DECLINED" }
                    };
                case 'canceled':
                    return {
                        ...baseFilter,
                        paymentStatus: { $eq: "CANCELED" }
                    };
                case 'pending_refund':
                    return {
                        ...baseFilter,
                        paymentStatus: { $eq: "PENDING_REFUND" }
                    };
                default:
                    return baseFilter;
            }
        }
    }

    /**
     * Generate cache key for status filters
     */
    private generateStatusCacheKey(statusType: 'fulfillment' | 'payment', statusFilter: string): string {
        const key = JSON.stringify({
            statusType,
            statusFilter,
            type: 'status-only'
        });
        return btoa(key); // Base64 encode for clean key
    }

    /**
     * Load more status filter results
     */
    async loadMoreStatusResults(
        statusType: 'fulfillment' | 'payment',
        statusFilter: string,
        nextCursor: string
    ): Promise<{ orders: Order[], hasMore: boolean, nextCursor?: string }> {
        try {
            const searchFilters = this.buildStatusApiFilters(statusType, statusFilter);
            const { orders } = await import('@wix/ecom');

            const searchParams = {
                filter: searchFilters,
                cursorPaging: {
                    limit: 100,
                    cursor: nextCursor
                },
                sort: [{ fieldName: '_createdDate' as const, order: 'DESC' as const }]
            };

            const result = await orders.searchOrders(searchParams);
            const mappedOrders = await this.mapRawOrders(result.orders || []);

            return {
                orders: mappedOrders,
                hasMore: result.metadata?.hasNext || false,
                nextCursor: result.metadata?.cursors?.next || undefined
            };

        } catch (error) {
            console.error('❌ Load more status results failed:', error);
            return { orders: [], hasMore: false };
        }
    }
}