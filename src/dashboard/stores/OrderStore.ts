// stores/OrderStore.ts - UPDATED with Search Support
import { makeAutoObservable } from 'mobx';
import type { Order, OrderStatus, ConnectionStatus } from '../types/Order';
import type { SearchResult } from '../services/AdvancedSearchService';

interface FormattedAnalytics {
    totalSales: number;
    totalOrders: number;
    totalSessions: number;
    totalUniqueVisitors: number;
    todayUniqueVisitors: number;
    yesterdayUniqueVisitors: number;
    averageOrderValue: number;
    currency: string;
    salesChange: number;
    ordersChange: number;
    sessionsChange: number;
    uniqueVisitorsChange: number;
    aovChange: number;
    period: string;
}

export class OrderStore {
    // Analytics properties
    analyticsData: any = null;
    analyticsLoading: boolean = false;
    analyticsError: string | null = null;
    formattedAnalytics: FormattedAnalytics | null = null;
    selectedAnalyticsPeriod: string = '30days';

    // Order management properties
    hasMoreOrders: boolean = false;
    nextCursor: string = '';
    isLoadingMore: boolean = false;
    loadingStatus: string = '';
    orders: Order[] = [];
    selectedOrder: Order | null = null;
    connectionStatus: ConnectionStatus = 'disconnected';
    searchQuery: string = '';

    // NEW: Search-related properties
    searchResults: SearchResult | null = null;
    isSearching: boolean = false;

    pagination = {
        hasNext: false,
        nextCursor: '',
        prevCursor: '',
        totalCount: 0
    };

    constructor() {
        // This automatically makes everything observable and actions
        makeAutoObservable(this);

        // Load customer counts cache from localStorage
        this.loadCustomerCountsFromStorage();
    }

    // Analytics methods
    setAnalyticsData(data: any) {
        this.analyticsData = data;
    }

    setAnalyticsLoading(loading: boolean) {
        this.analyticsLoading = loading;
    }

    setAnalyticsError(error: string | null) {
        this.analyticsError = error;
    }

    setFormattedAnalytics(analytics: FormattedAnalytics | null) {
        this.formattedAnalytics = analytics;
    }

    setSelectedAnalyticsPeriod(period: string) {
        this.selectedAnalyticsPeriod = period;
    }

    // Order management methods
    setHasMoreOrders(hasMore: boolean) {
        this.hasMoreOrders = hasMore;
    }

    setNextCursor(cursor: string) {
        this.nextCursor = cursor;
    }

    setIsLoadingMore(loading: boolean) {
        this.isLoadingMore = loading;
    }

    setLoadingStatus(status: string) {
        this.loadingStatus = status;
    }

    clearOrders() {
        this.orders = [];
        this.selectedOrder = null;
        this.searchResults = null;
    }

    selectOrder(order: Order | null) {
        this.selectedOrder = order;

        // Clear any pending UI states when selecting a different order
        if (order && this.selectedOrder?._id !== order._id) {
            // Reset any loading states or cached data that might cause sticking
            this.clearTransientState();
        }
    }

    private clearTransientState() {
        // Add any transient state clearing logic here
        // This helps prevent the UI from getting stuck on previous order data
    }

    updateOrderStatus(orderId: string, status: OrderStatus) {
        const orderIndex = this.orders.findIndex(o => o._id === orderId);
        if (orderIndex !== -1) {
            this.orders[orderIndex] = {
                ...this.orders[orderIndex],
                status
            };
        }

        // Also update in search results if they exist
        if (this.searchResults) {
            const searchOrderIndex = this.searchResults.orders.findIndex(o => o._id === orderId);
            if (searchOrderIndex !== -1) {
                this.searchResults.orders[searchOrderIndex] = {
                    ...this.searchResults.orders[searchOrderIndex],
                    status
                };
            }
        }

        if (this.selectedOrder?._id === orderId) {
            this.selectedOrder = {
                ...this.selectedOrder,
                status
            };
        }
    }

    updateOrder(updatedOrder: Order) {
        const orderId = updatedOrder._id;
        const orderIndex = this.orders.findIndex(o => o._id === orderId);

        if (orderIndex !== -1) {
            this.orders[orderIndex] = {
                ...this.orders[orderIndex],
                ...updatedOrder
            };
        }

        // Also update in search results if they exist
        if (this.searchResults) {
            const searchOrderIndex = this.searchResults.orders.findIndex(o => o._id === orderId);
            if (searchOrderIndex !== -1) {
                this.searchResults.orders[searchOrderIndex] = {
                    ...this.searchResults.orders[searchOrderIndex],
                    ...updatedOrder
                };
            }
        }


        if (this.selectedOrder?._id === orderId) {
            this.selectedOrder = {
                ...this.selectedOrder,
                ...updatedOrder
            };
        }
    }

    addNewOrder(order: Order) {
        // Check if order already exists to prevent duplicates
        const orderExists = this.orders.some(o => o._id === order._id);
        if (orderExists) return;

        // Add to the beginning of the array (most recent first)
        this.orders.unshift(order);

        // If we have more than 100 orders, remove the oldest one
        if (this.orders.length > 100) {
            this.orders.pop();
        }

        // If we have a search active, update search results too
        if (this.searchQuery) {
            this.searchOrders(this.searchQuery);
        }
    }

    /**
 * Handle new order placement - only recalculate for the specific customer
 */
    handleNewOrder(order: Order): void {
        // Add the order to our local list
        this.addNewOrder(order);

        // Invalidate cache only for this customer so their count gets recalculated
        const customerEmail = this.getCustomerEmail(order);
        if (customerEmail) {
            this.invalidateCustomerCache(customerEmail);
            console.log(`🔄 New order detected, will recalculate badges for ${customerEmail}`);
        }
    }

    setOrders(orders: Order[]) {
        // Simple duplicate removal - keep first occurrence
        const seen = new Set();
        const uniqueOrders = orders.filter(order => {
            if (seen.has(order._id)) {
                return false;
            }
            seen.add(order._id);
            return true;
        });

        this.orders = uniqueOrders;
    }

    appendOrders(newOrders: Order[]) {
        // Get existing IDs
        const existingIds = new Set(this.orders.map(order => order._id));

        // Filter out orders that already exist
        const uniqueNewOrders = newOrders.filter(order => !existingIds.has(order._id));

        if (uniqueNewOrders.length > 0) {
            this.orders = [...this.orders, ...uniqueNewOrders];
        }
    }

    removeOrder(orderId: string) {
        this.orders = this.orders.filter(o => o._id !== orderId);

        // Also remove from search results if they exist
        if (this.searchResults) {
            this.searchResults.orders = this.searchResults.orders.filter(o => o._id !== orderId);
            this.searchResults.totalFound = this.searchResults.orders.length;
        }

        if (this.selectedOrder?._id === orderId) {
            this.selectedOrder = null;
        }
    }

    setSearchQuery(query: string) {
        this.searchQuery = query;
    }

    clearSearch() {
        this.searchQuery = '';
        this.searchResults = null;
        this.isSearching = false;
    }

    setSearchResults(results: SearchResult | null) {
        this.searchResults = results;
    }

    setIsSearching(searching: boolean) {
        this.isSearching = searching;
    }

    setConnectionStatus(status: ConnectionStatus) {
        this.connectionStatus = status;
    }

    setPagination(pagination: {
        hasNext: boolean;
        nextCursor: string;
        prevCursor: string;
        totalCount?: number;
    }) {
        this.pagination = {
            hasNext: pagination.hasNext,
            nextCursor: pagination.nextCursor,
            prevCursor: pagination.prevCursor,
            totalCount: pagination.totalCount || 0
        };
    }

    // Helper method to get orders for the selected analytics period
    getOrdersForSelectedPeriod(): Order[] {
        const period = this.selectedAnalyticsPeriod;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        let startDate: Date;

        switch (period) {
            case 'today':
                startDate = today;
                break;
            case 'yesterday':
                startDate = new Date(today);
                startDate.setDate(startDate.getDate() - 1);
                break;
            case '7days':
                startDate = new Date(today);
                startDate.setDate(startDate.getDate() - 7);
                break;
            case '30days':
                startDate = new Date(today);
                startDate.setDate(startDate.getDate() - 30);
                break;
            case 'thisweek':
                // FIXED: Monday-based weeks (Monday = start, Sunday = end)
                startDate = new Date(today);
                const dayOfWeek = startDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
                const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday=6 days back, others=dayOfWeek-1
                startDate.setDate(startDate.getDate() - daysFromMonday);
                break;
            case 'thismonth':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case '365days':
                startDate = new Date(today);
                startDate.setDate(startDate.getDate() - 365);
                break;
            case 'thisyear':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            default:
                startDate = new Date(today);
                startDate.setDate(startDate.getDate() - 30);
        }

        startDate.setHours(0, 0, 0, 0);

        return this.orders.filter(order => {
            const orderDate = new Date(order._createdDate);
            return orderDate >= startDate;
        });
    }

    // Helper method to get period label for display
    getPeriodLabel(): string {
        const labels: { [key: string]: string } = {
            'today': 'today',
            'yesterday': 'yesterday',
            '7days': '7 days',
            '30days': '30 days',
            'thisweek': 'this week',
            'thismonth': 'this month',
            '365days': '365 days',
            'thisyear': 'this year'
        };
        return labels[this.selectedAnalyticsPeriod] || '30 days';
    }

    // Computed properties
    get ordersCount() {
        return this.orders.length;
    }

    // UPDATED: filteredOrders now considers search results
    get filteredOrders() {
        // If we have search results, return those instead of filtering the main orders
        if (this.searchResults && this.searchQuery.trim()) {
            return this.searchResults.orders;
        }

        // Legacy filtering for when not using advanced search
        if (!this.searchQuery.trim()) {
            return this.orders;
        }

        const term = this.searchQuery.toLowerCase();
        return this.orders.filter(order => {
            const recipientContact = order.rawOrder?.recipientInfo?.contactDetails;
            const billingContact = order.rawOrder?.billingInfo?.contactDetails;

            const firstName = recipientContact?.firstName || billingContact?.firstName || order.customer.firstName || '';
            const lastName = recipientContact?.lastName || billingContact?.lastName || order.customer.lastName || '';
            const email = recipientContact?.email || billingContact?.email || order.customer.email || '';
            const phone = recipientContact?.phone || billingContact?.phone || order.customer.phone || '';
            const company = recipientContact?.company || billingContact?.company || order.customer.company || '';

            return (
                order.number.toLowerCase().includes(term) ||
                firstName.toLowerCase().includes(term) ||
                lastName.toLowerCase().includes(term) ||
                email.toLowerCase().includes(term) ||
                phone.toLowerCase().includes(term) ||
                company.toLowerCase().includes(term)
            );
        });
    }

    // NEW: Computed properties for search
    get hasActiveSearch(): boolean {
        return this.searchQuery.trim() !== '';
    }

    get searchResultsCount(): number {
        return this.searchResults?.totalFound || 0;
    }

    get isDisplayingSearchResults(): boolean {
        return this.hasActiveSearch && this.searchResults !== null;
    }

    get searchHasMore(): boolean {
        return this.searchResults?.hasMore || false;
    }

    get searchStats() {
        if (!this.searchResults) return null;

        return {
            totalFound: this.searchResults.totalFound,
            fromCache: this.searchResults.fromCache.length,
            fromApi: this.searchResults.fromApi.length,
            searchTime: this.searchResults.searchTime,
            hasMore: this.searchResults.hasMore
        };
    }

    get fulfilledOrders() {
        const ordersToCheck = this.isDisplayingSearchResults ? this.searchResults!.orders : this.orders;
        return ordersToCheck.filter(order => order.status === 'FULFILLED');
    }

    get pendingOrders() {
        const ordersToCheck = this.isDisplayingSearchResults ? this.searchResults!.orders : this.orders;
        return ordersToCheck.filter(order => order.status === 'NOT_FULFILLED');
    }

    get partiallyFulfilledOrders() {
        const ordersToCheck = this.isDisplayingSearchResults ? this.searchResults!.orders : this.orders;
        return ordersToCheck.filter(order => order.status === 'PARTIALLY_FULFILLED');
    }

    get canceledOrders() {
        const ordersToCheck = this.isDisplayingSearchResults ? this.searchResults!.orders : this.orders;
        return ordersToCheck.filter(order => order.status === 'CANCELED');
    }

    get hasSelectedOrder() {
        return this.selectedOrder !== null;
    }

    get isConnected() {
        return this.connectionStatus === 'connected';
    }

    get oldestUnfulfilledOrder() {
        const ordersToCheck = this.isDisplayingSearchResults ? this.searchResults!.orders : this.orders;
        const unfulfilledOrders = ordersToCheck.filter(order =>
            order.status === 'NOT_FULFILLED' || order.status === 'PARTIALLY_FULFILLED'
        );

        if (unfulfilledOrders.length === 0) return null;

        return unfulfilledOrders.sort((a, b) =>
            new Date(a._createdDate).getTime() - new Date(b._createdDate).getTime()
        )[0];
    }

    get unfulfilledOrdersCount() {
        const ordersToCheck = this.isDisplayingSearchResults ? this.searchResults!.orders : this.orders;
        return ordersToCheck.filter(order =>
            order.status === 'NOT_FULFILLED' || order.status === 'PARTIALLY_FULFILLED'
        ).length;
    }

    get last30DaysAnalytics() {
        const last30DaysOrders = this.getLast30DaysOrders();
        const salesMetrics = this.calculateSalesMetrics(last30DaysOrders);
        const fulfillmentStats = this.getFulfillmentStats(last30DaysOrders);

        return {
            ...salesMetrics,
            ...fulfillmentStats,
            dateRange: {
                start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                end: new Date()
            }
        };
    }

    // REPLACE WITH:
    get selectedPeriodAnalytics() {
        const selectedPeriodOrders = this.getOrdersForSelectedPeriod();
        const salesMetrics = this.calculateSalesMetrics(selectedPeriodOrders);
        const fulfillmentStats = this.getFulfillmentStats(selectedPeriodOrders);

        return {
            ...salesMetrics,
            ...fulfillmentStats,
            period: this.selectedAnalyticsPeriod,
            periodLabel: this.getPeriodLabel()
        };
    }

    // Enhanced customer order count cache with timestamps and API calls
    private customerOrderCounts: Map<string, { count: number; timestamp: number; calculating: boolean }> = new Map();
    private readonly CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days cache (weekly reset)
    private readonly CACHE_STORAGE_KEY = 'wix_customer_order_counts_cache';
    /**
     * Get customer order count using Wix API with smart caching
     * This gives the TRUE total order count for proper badge calculation
     */

    async getCustomerOrderCount(customerEmail: string): Promise<number> {
        if (!customerEmail) return 0;

        const now = Date.now();
        const cached = this.customerOrderCounts.get(customerEmail);

        // Return cached value if it's fresh and not currently calculating
        if (cached && !cached.calculating && (now - cached.timestamp) < this.CACHE_DURATION) {
            console.log(`🚀 Using cached count for ${customerEmail}: ${cached.count} orders`);
            return cached.count;
        }

        // If already calculating, return cached count or 0
        if (cached?.calculating) {
            return cached.count || 0;
        }

        // Mark as calculating to prevent duplicate requests
        this.customerOrderCounts.set(customerEmail, {
            count: cached?.count || 0,
            timestamp: now,
            calculating: true
        });

        try {
            console.log(`🔍 Fetching total order count for ${customerEmail}...`);

            const { orders } = await import('@wix/ecom');

            // Since queryOrders doesn't exist, we'll use searchOrders with pagination
            let totalCount = 0;
            let hasMore: boolean = true;
            let cursor: string | undefined = undefined;

            // We'll paginate through orders and filter manually
            while (hasMore && totalCount < 1000) { // Safety limit
                try {
                    const response = await orders.searchOrders({
                        cursorPaging: {
                            limit: 100,
                            ...(cursor ? { cursor } : {})
                        }
                    });

                    const pageOrders = response.orders || [];

                    // Count orders that match this customer email manually
                    const matchingOrders = pageOrders.filter((order: any) => {
                        // Check multiple possible email locations
                        const recipientEmail = order.recipientInfo?.contactDetails?.email;
                        const billingEmail = order.billingInfo?.contactDetails?.email;
                        const buyerEmail = order.buyerInfo?.email;

                        return [recipientEmail, billingEmail, buyerEmail].some((email: string | undefined) =>
                            email && email.toLowerCase() === customerEmail.toLowerCase()
                        );
                    });

                    totalCount += matchingOrders.length;

                    console.log(`📊 Found ${matchingOrders.length} matching orders in this page (total so far: ${totalCount})`);

                    // Fix the boolean and string type issues
                    hasMore = Boolean(response.metadata?.hasNext) && pageOrders.length > 0;
                    cursor = response.metadata?.cursors?.next || undefined;

                    // If we get less than requested, we're likely done
                    if (pageOrders.length < 100) {
                        hasMore = false;
                    }

                    // Small delay to avoid overwhelming the API
                    if (hasMore) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }

                } catch (pageError) {
                    console.error('Error in pagination:', pageError);
                    break;
                }
            }

            // Cache the result
            this.customerOrderCounts.set(customerEmail, {
                count: totalCount,
                timestamp: now,
                calculating: false
            });

            // Save to localStorage for persistence
            this.saveCustomerCountsToStorage();

            console.log(`✅ Total orders for ${customerEmail}: ${totalCount}`);
            return totalCount;

        } catch (error) {
            console.error(`❌ Error fetching orders for ${customerEmail}:`, error);

            // Keep old cached value if available, otherwise return 0
            const fallbackCount = cached?.count || 0;
            this.customerOrderCounts.set(customerEmail, {
                count: fallbackCount,
                timestamp: now,
                calculating: false
            });

            return fallbackCount;
        }
    }

    /**
     * Get customer order count from cache only (for immediate UI updates)
     */
    getCachedCustomerOrderCount(customerEmail: string): number {
        const cached = this.customerOrderCounts.get(customerEmail);
        return cached?.count || 0;
    }

    /**
     * Load customer counts cache from localStorage
     */
    private loadCustomerCountsFromStorage(): void {
        try {
            const storedData = localStorage.getItem(this.CACHE_STORAGE_KEY);
            if (!storedData) return;

            const parsed = JSON.parse(storedData);
            const now = Date.now();

            // Filter out expired entries (older than 7 days)
            const validEntries = Object.entries(parsed).filter(([email, data]: [string, any]) => {
                return data && (now - data.timestamp) < this.CACHE_DURATION;
            });

            // Restore valid entries to the cache
            this.customerOrderCounts.clear();
            validEntries.forEach(([email, data]: [string, any]) => {
                this.customerOrderCounts.set(email, {
                    count: data.count,
                    timestamp: data.timestamp,
                    calculating: false // Reset calculating flag on load
                });
            });

            console.log(`📱 Loaded ${validEntries.length} customer counts from localStorage cache`);

            // Clean up expired entries from localStorage
            if (validEntries.length !== Object.keys(parsed).length) {
                this.saveCustomerCountsToStorage();
                console.log(`🧹 Cleaned up expired cache entries`);
            }
        } catch (error) {
            console.error('❌ Error loading customer counts from localStorage:', error);
            // Clear corrupted cache
            localStorage.removeItem(this.CACHE_STORAGE_KEY);
        }
    }

    /**
     * Save customer counts cache to localStorage
     */
    private saveCustomerCountsToStorage(): void {
        try {
            const cacheObject: Record<string, any> = {};

            this.customerOrderCounts.forEach((data, email) => {
                // Only save completed calculations (not currently calculating)
                if (!data.calculating) {
                    cacheObject[email] = {
                        count: data.count,
                        timestamp: data.timestamp
                    };
                }
            });

            localStorage.setItem(this.CACHE_STORAGE_KEY, JSON.stringify(cacheObject));
            console.log(`💾 Saved ${Object.keys(cacheObject).length} customer counts to localStorage`);
        } catch (error) {
            console.error('❌ Error saving customer counts to localStorage:', error);
        }
    }

    /**
     * Clear customer counts cache from both memory and localStorage
     */
    clearCustomerOrderCountCache(): void {
        this.customerOrderCounts.clear();
        localStorage.removeItem(this.CACHE_STORAGE_KEY);
        console.log('🗑️ Cleared customer order count cache from memory and localStorage');
    }

    /**
 * Pre-calculate order counts for visible customers (batch processing)
 */
    async preCalculateCustomerCounts(customerEmails: string[]): Promise<void> {
        console.log(`🚀 Pre-calculating order counts for ${customerEmails.length} customers...`);

        // Process customers one by one with delays to avoid API rate limits
        for (let i = 0; i < customerEmails.length; i++) {
            const email = customerEmails[i];

            try {
                await this.getCustomerOrderCount(email);

                // Add delay between requests to be API-friendly
                if (i < customerEmails.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            } catch (error) {
                console.error(`Error pre-calculating for ${email}:`, error);
            }
        }

        console.log(`✅ Finished pre-calculating order counts`);
    }

    /**
     * Invalidate cache for specific customer (when they place a new order)
     */
    invalidateCustomerCache(customerEmail: string): void {
        if (customerEmail) {
            this.customerOrderCounts.delete(customerEmail);
            console.log(`🗑️ Invalidated cache for ${customerEmail}`);
        }
    }


    private getCustomerEmail(order: Order): string | null {
        const recipientContact = order.rawOrder?.recipientInfo?.contactDetails;
        const billingContact = order.rawOrder?.billingInfo?.contactDetails;

        return recipientContact?.email ||
            billingContact?.email ||
            order.customer.email ||
            null;
    }

    private parseOrderTotal(totalString: string): number {
        // Extract numeric value from formatted total (e.g., "€25.50" -> 25.50 or "161,00 €" -> 161.00)
        const match = totalString.match(/[\d,\.]+/);
        if (match) {
            let numberStr = match[0];

            // Handle European format where comma is decimal separator
            // If there's a comma but no dot, or comma comes after dot, it's likely decimal separator
            if (numberStr.includes(',') && (!numberStr.includes('.') || numberStr.lastIndexOf(',') > numberStr.lastIndexOf('.'))) {
                // Replace comma with dot for decimal separator
                numberStr = numberStr.replace(/\./g, '').replace(',', '.');
            } else {
                // Handle US format where comma is thousands separator
                numberStr = numberStr.replace(/,/g, '');
            }

            return parseFloat(numberStr);
        }
        return 0;
    }


    // Helper methods
    getLast30DaysOrders(): Order[] {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const ordersToCheck = this.isDisplayingSearchResults ? this.searchResults!.orders : this.orders;
        return ordersToCheck.filter(order => {
            const orderDate = new Date(order._createdDate);
            return orderDate >= thirtyDaysAgo;
        });
    }

    getOrdersByDateRange(startDate: Date, endDate: Date): Order[] {
        const ordersToCheck = this.isDisplayingSearchResults ? this.searchResults!.orders : this.orders;
        return ordersToCheck.filter(order => {
            const orderDate = new Date(order._createdDate);
            return orderDate >= startDate && orderDate <= endDate;
        });
    }

    calculateSalesMetrics(orders: Order[] = this.orders) {
        let totalSales = 0;
        let currency = 'EUR';

        orders.forEach(order => {
            const priceMatch = order.total.match(/[\d,]+\.?\d*/);
            if (priceMatch) {
                const numericValue = parseFloat(priceMatch[0].replace(',', ''));
                if (!isNaN(numericValue)) {
                    totalSales += numericValue;
                }
            }

            const currencyMatch = order.total.match(/[€$£¥]/);
            if (currencyMatch) {
                currency = currencyMatch[0];
            }
        });

        return {
            totalSales,
            averageOrderValue: orders.length > 0 ? totalSales / orders.length : 0,
            currency,
            orderCount: orders.length
        };
    }

    getFulfillmentStats(orders: Order[] = this.orders) {
        const fulfilled = orders.filter(order => order.status === 'FULFILLED').length;
        const pending = orders.filter(order =>
            order.status === 'NOT_FULFILLED' || order.status === 'PARTIALLY_FULFILLED'
        ).length;
        const cancelled = orders.filter(order => order.status === 'CANCELED').length;

        return {
            fulfilled,
            pending,
            cancelled,
            total: orders.length,
            fulfillmentRate: orders.length > 0 ? (fulfilled / orders.length) * 100 : 0
        };
    }

    getOrderById(orderId: string): Order | undefined {
        // Check search results first if we're in search mode
        if (this.isDisplayingSearchResults) {
            const searchOrder = this.searchResults!.orders.find(order => order._id === orderId);
            if (searchOrder) return searchOrder;
        }

        return this.orders.find(order => order._id === orderId);
    }

    getOrderByNumber(orderNumber: string): Order | undefined {
        // Check search results first if we're in search mode
        if (this.isDisplayingSearchResults) {
            const searchOrder = this.searchResults!.orders.find(order => order.number === orderNumber);
            if (searchOrder) return searchOrder;
        }

        return this.orders.find(order => order.number === orderNumber);
    }

    searchOrders(searchTerm: string): Order[] {
        if (!searchTerm.trim()) {
            return this.orders;
        }

        const term = searchTerm.toLowerCase();
        const ordersToSearch = this.isDisplayingSearchResults ? this.searchResults!.orders : this.orders;

        return ordersToSearch.filter(order =>
            order.number.toLowerCase().includes(term) ||
            order.customer.firstName.toLowerCase().includes(term) ||
            order.customer.lastName.toLowerCase().includes(term) ||
            order.customer.email.toLowerCase().includes(term) ||
            order.customer.phone?.toLowerCase().includes(term) ||
            (order.items || []).some(item =>
                item.name.toLowerCase().includes(term) ||
                item.sku?.toLowerCase().includes(term)
            )
        );
    }

    getOrdersByStatus(status: OrderStatus): Order[] {
        const ordersToCheck = this.isDisplayingSearchResults ? this.searchResults!.orders : this.orders;
        return ordersToCheck.filter(order => order.status === status);
    }

    getOrderStats() {
        const ordersToCheck = this.isDisplayingSearchResults ? this.searchResults!.orders : this.orders;

        return {
            total: ordersToCheck.length,
            fulfilled: this.fulfilledOrders.length,
            pending: this.pendingOrders.length,
            partiallyFulfilled: this.partiallyFulfilledOrders.length,
            canceled: this.canceledOrders.length,
            totalValue: ordersToCheck.reduce((sum, order) => {
                const value = parseFloat(order.total.replace(/[^0-9.-]+/g, ''));
                return sum + (isNaN(value) ? 0 : value);
            }, 0)
        };
    }

    selectMultipleOrders(orderIds: string[]) {
        console.log('Bulk selection not implemented yet:', orderIds);
    }

    bulkUpdateStatus(orderIds: string[], status: OrderStatus) {
        orderIds.forEach(orderId => {
            this.updateOrderStatus(orderId, status);
        });
    }

    logCurrentState() {
        console.log('OrderStore State:', {
            ordersCount: this.ordersCount,
            selectedOrder: this.selectedOrder?.number || 'none',
            connectionStatus: this.connectionStatus,
            searchQuery: this.searchQuery,
            filteredCount: this.filteredOrders.length,
            pagination: this.pagination,
            stats: this.getOrderStats(),
            search: {
                hasActiveSearch: this.hasActiveSearch,
                isDisplayingSearchResults: this.isDisplayingSearchResults,
                searchResultsCount: this.searchResultsCount,
                isSearching: this.isSearching,
                searchStats: this.searchStats
            },
            analytics: {
                loading: this.analyticsLoading,
                error: this.analyticsError,
                hasData: !!this.analyticsData,
                hasFormattedData: !!this.formattedAnalytics,
                selectedPeriod: this.selectedAnalyticsPeriod,
                periodLabel: this.getPeriodLabel()
            }
        });
    }
}