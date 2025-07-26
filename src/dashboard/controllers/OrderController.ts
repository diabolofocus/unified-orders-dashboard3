// controllers/OrderController.ts - COMPLETE with Simple Real-time Features
import { AnalyticsService } from '../services/AnalyticsService';
import { AdvancedSearchService, type SearchFilters, type SearchResult } from '../services/AdvancedSearchService';
import { RealtimeOrderService } from '../services/RealtimeOrderService';
import { dashboard } from '@wix/dashboard';
import type { OrderStore } from '../stores/OrderStore';
import type { UIStore } from '../stores/UIStore';
import type { OrderService } from '../services/OrderService';
import type { Order, FulfillOrderParams } from '../types/Order';
import { getSiteIdFromContext } from '../utils/get-siteId';
import { mapWixOrder } from '../../backend/utils/order-mapper';
import { settingsStore } from '../stores/SettingsStore';
import { SoundService } from '../services/SoundService';



// Add this at the top of OrderController.ts after the imports
declare global {
    interface Window {
        __GLOBAL_SOUNDS_PLAYED?: Set<string>;
        __GLOBAL_PROCESSED_ORDERS?: Set<string>;
    }
}

export class OrderController {
    private advancedSearchService: AdvancedSearchService;
    private realtimeService: RealtimeOrderService;
    private searchTimeout: number | null = null;
    private currentSearchQuery: string = '';
    private lastSearchResult: SearchResult | null = null;

    private realtimeInitialized: boolean = false;

    private isFilterMode: boolean = false;
    private currentStatusFilter: string | null = null;
    private currentFilterType: 'fulfillment' | 'payment' | null = null;

    private isInitialized = false;
    private processedOrders = new Set<string>();


    constructor(
        private orderStore: OrderStore,
        private uiStore: UIStore,
        private orderService: OrderService
    ) {
        this.advancedSearchService = new AdvancedSearchService();
        this.realtimeService = new RealtimeOrderService();

        // Initialize real-time updates only once
        if (!this.isInitialized) {
            this.initializeRealtimeUpdates();
            this.isInitialized = true;
        }

        // Reset the initial load state when the controller is created
        // This ensures we don't show notifications for existing orders
        this.realtimeService.resetInitialLoad();
    }

    // === SIMPLIFIED REAL-TIME METHODS ===

    /**
     * AUTO-START: Initialize real-time updates automatically
     */
    private async initializeRealtimeUpdates() {
        if (this.realtimeInitialized) {
            return;
        }

        this.realtimeInitialized = true;

        this.realtimeService.onNewOrder((newOrder: Order) => {
            // Check if this is the initial load
            this.handleNewOrder(newOrder, this.realtimeService.isInitialLoad);
        });

        // Service auto-starts polling in constructor
    }

    /**
     * Handle new order
     */
    private soundService = new SoundService();
    private soundInitialized = false;

    private async initializeSound() {
        if (!this.soundInitialized && settingsStore.soundAlert) {
            this.soundInitialized = await this.soundService.initialize();
        }
        return this.soundInitialized;
    }

    private async handleNewOrder(newOrder: Order, isInitialLoad: boolean = false) {
        // Skip if this is a duplicate order
        if (this.processedOrders.has(newOrder._id)) {
            return;
        }

        try {
            // Mark as processed first to prevent duplicates
            this.processedOrders.add(newOrder._id);

            // Skip if order already exists in store
            if (this.orderStore.getOrderById(newOrder._id)) {
                return;
            }

            // Add to store
            this.orderStore.addNewOrder(newOrder);

            // Skip sound and toast for initial load orders
            if (!isInitialLoad) {
                // Show toast notification for new orders
                this.showToast(`New order #${newOrder.number} received!`, 'success');

                // Play sound if enabled
                if (settingsStore.soundAlert) {
                    try {
                        // Try to enable audio (may fail if no user interaction has occurred)
                        const audioEnabled = await this.soundService.enableAudio();
                        if (!audioEnabled) {
                            console.debug('Audio not enabled, skipping sound notification');
                            return;
                        }

                        // Initialize and play the sound
                        const soundInitialized = await this.initializeSound();
                        if (soundInitialized) {
                            await this.soundService.play();
                        } else {
                            console.warn('Sound initialization failed, skipping sound notification');
                        }
                    } catch (error) {
                        console.error('Error playing sound for new order:', error);
                    }
                }
            }

            // Auto-select if no order is currently selected
            if (!this.orderStore.selectedOrder) {
                this.orderStore.selectOrder(newOrder);
            }
        } catch (error) {
            console.error('Error handling new order:', error);
        }
    }

    /**
     * Test the notification system
     * @deprecated Use the testNotifications method from OrderControllerContext instead
     */
    async testNotifications(): Promise<void> {
        try {
            // First ensure audio is enabled (handles user interaction requirement)
            const audioEnabled = await this.soundService.enableAudio();
            if (!audioEnabled) {
                console.warn('Audio could not be enabled. User interaction may be required.');
                return;
            }

            // Then initialize and play the sound
            const soundInitialized = await this.initializeSound();
            if (soundInitialized) {
                await this.soundService.play();
            } else {
                console.warn('Sound initialization failed');
            }
        } catch (error) {
            console.error('Failed to play test notification:', error);
        }
    }

    /**
     * Configure notification settings
     * @param settings Notification settings
     */
    /**
     * Update notification settings
     * @param settings Notification settings to update
     */
    updateNotificationSettings(settings: { soundEnabled?: boolean }): void {
        if (settings.soundEnabled !== undefined) {
            settingsStore.setSoundAlert(settings.soundEnabled);
        }
    }

    /**
     * Get real-time service status
     * @returns Current status of the real-time service
     */
    getRealtimeStatus() {
        return this.realtimeService.getStatus();
    }

    // === SEARCH METHODS ===

    /**
     * Enhanced search method - replaces the old updateSearchQuery
     */
    async performAdvancedSearch(query: string, statusFilter?: string[]): Promise<void> {
        const trimmedQuery = query.trim();
        this.currentSearchQuery = trimmedQuery;

        // Clear previous search timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        // If query is empty, reset to show all orders
        if (!trimmedQuery) {
            this.orderStore.setSearchQuery('');
            this.orderStore.setSearchResults(null);
            this.lastSearchResult = null;
            return;
        }

        // Set immediate feedback
        this.orderStore.setSearchQuery(trimmedQuery);
        this.uiStore.setSearching(true);

        try {
            const filters: SearchFilters = {
                query: this.currentSearchQuery,
                limit: settingsStore.initialOrderLimit
            };

            const searchResult = await this.advancedSearchService.performAdvancedSearch(
                trimmedQuery,
                this.orderStore.orders, // Pass currently loaded orders
                filters
            );

            // Only update if this is still the current search
            if (this.currentSearchQuery === trimmedQuery) {
                this.lastSearchResult = searchResult;
                this.orderStore.setSearchResults(searchResult);
            }

        } catch (error) {
            // Fallback to basic search on loaded orders
            this.performBasicSearch(trimmedQuery);

            this.showToast('Search completed with basic results', 'warning');
        } finally {
            this.uiStore.setSearching(false);
        }
    }

    /**
     * Main search method that replaces updateSearchQuery - debounced search for real-time search as user types
     */
    updateSearchQuery(query: string, statusFilter?: string[]): void {
        // Cancel previous timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        // Set immediate UI feedback
        this.orderStore.setSearchQuery(query);

        // If query is empty, reset immediately
        if (!query.trim()) {
            this.orderStore.setSearchResults(null);
            this.lastSearchResult = null;
            return;
        }

        // Debounce the actual search
        this.searchTimeout = setTimeout(() => {
            this.performAdvancedSearch(query, statusFilter);
        }, 300) as any; // 300ms delay for debouncing
    }

    /**
     * Fallback basic search through loaded orders only
     */
    private performBasicSearch(query: string): void {
        if (!query.trim()) {
            this.orderStore.setSearchResults(null);
            return;
        }

        const searchTerm = query.toLowerCase();
        const filteredOrders = this.orderStore.orders.filter(order => {
            const recipientContact = order.rawOrder?.recipientInfo?.contactDetails;
            const billingContact = order.rawOrder?.billingInfo?.contactDetails;

            const firstName = recipientContact?.firstName || billingContact?.firstName || order.customer.firstName || '';
            const lastName = recipientContact?.lastName || billingContact?.lastName || order.customer.lastName || '';
            const email = recipientContact?.email || billingContact?.email || order.customer.email || '';
            const phone = recipientContact?.phone || billingContact?.phone || order.customer.phone || '';
            const company = recipientContact?.company || billingContact?.company || order.customer.company || '';

            return (
                order.number.toLowerCase().includes(searchTerm) ||
                firstName.toLowerCase().includes(searchTerm) ||
                lastName.toLowerCase().includes(searchTerm) ||
                email.toLowerCase().includes(searchTerm) ||
                phone.toLowerCase().includes(searchTerm) ||
                company.toLowerCase().includes(searchTerm)
            );
        });

        // Create a basic search result
        const basicResult: SearchResult = {
            orders: filteredOrders,
            fromCache: filteredOrders,
            fromApi: [],
            hasMore: false,
            totalFound: filteredOrders.length,
            searchTime: 0
        };

        this.orderStore.setSearchResults(basicResult);
        this.lastSearchResult = basicResult;
    }

    /**
     * Load more search results if available
     */
    async loadMoreSearchResults(): Promise<void> {
        if (!this.lastSearchResult?.hasMore || !this.lastSearchResult.nextCursor) {
            return;
        }

        if (!this.currentSearchQuery.trim()) {
            return;
        }

        try {
            this.uiStore.setLoadingMore(true);

            const filters: SearchFilters = {
                query: this.currentSearchQuery,
                limit: 100
            };

            const { orders } = await import('@wix/ecom');
            const searchFilters: SearchFilters = {
                query: this.currentSearchQuery,
                limit: 100
            };

            // FIX: Add await here since buildApiFilters is now async
            const apiFilters = await this.advancedSearchService.buildApiFilters(this.currentSearchQuery, searchFilters);

            const searchParams = {
                filter: apiFilters,
                cursorPaging: {
                    limit: settingsStore.initialOrderLimit,
                    cursor: this.lastSearchResult.nextCursor
                },
                sort: [{ fieldName: '_createdDate' as const, order: 'DESC' as const }]
            };

            const result = await orders.searchOrders(searchParams);

            if (result.orders && result.orders.length > 0) {
                // Map and merge new results with proper type assertion
                const newOrders: Order[] = result.orders.map((rawOrder: any) => mapWixOrder(rawOrder));

                // Update search results
                const updatedResult: SearchResult = {
                    ...this.lastSearchResult,
                    orders: [...this.lastSearchResult.orders, ...newOrders],
                    fromApi: [...this.lastSearchResult.fromApi, ...newOrders],
                    hasMore: result.metadata?.hasNext || false,
                    nextCursor: result.metadata?.cursors?.next || undefined,
                    totalFound: this.lastSearchResult.totalFound + newOrders.length
                };

                this.lastSearchResult = updatedResult;
                this.orderStore.setSearchResults(updatedResult);
            }

        } catch (error) {
            this.showToast('Failed to load more results', 'error');
        } finally {
            this.uiStore.setLoadingMore(false);
        }
    }

    /**
  * Perform fulfillment status-based filtering on full dataset
  */
    async performFulfillmentStatusFilter(statusFilter: string): Promise<void> {
        this.isFilterMode = true;
        this.currentStatusFilter = statusFilter;
        this.currentFilterType = 'fulfillment';


        try {
            const apiFilters = this.buildFulfillmentStatusApiFilters(statusFilter);

            const { orders } = await import('@wix/ecom');

            const searchParams = {
                filter: apiFilters,
                cursorPaging: {
                    limit: settingsStore.initialOrderLimit
                },
                sort: [{ fieldName: '_createdDate' as const, order: 'DESC' as const }]
            };

            const result = await orders.searchOrders(searchParams);

            if (result.orders) {
                const filteredOrders = result.orders.map(mapWixOrder);

                // Update the main orders array with filtered results
                this.orderStore.setOrders(filteredOrders);
                this.orderStore.setHasMoreOrders(result.metadata?.hasNext || false);
                this.orderStore.setNextCursor(result.metadata?.cursors?.next || '');
            }

        } catch (error) {
            this.showToast('Failed to apply fulfillment status filter', 'error');
            throw error;
        }
    }

    /**
     * Perform payment status-based filtering on full dataset
     */
    async performPaymentStatusFilter(statusFilter: string): Promise<void> {
        this.isFilterMode = true;
        this.currentStatusFilter = statusFilter;
        this.currentFilterType = 'payment';

        try {
            const apiFilters = this.buildPaymentStatusApiFilters(statusFilter);

            const { orders } = await import('@wix/ecom');

            const searchParams = {
                filter: apiFilters,
                cursorPaging: {
                    limit: settingsStore.initialOrderLimit
                },
                sort: [{ fieldName: '_createdDate' as const, order: 'DESC' as const }]
            };

            const result = await orders.searchOrders(searchParams);

            if (result.orders) {
                const filteredOrders = result.orders.map(mapWixOrder);

                // Update the main orders array with filtered results
                this.orderStore.setOrders(filteredOrders);
                this.orderStore.setHasMoreOrders(result.metadata?.hasNext || false);
                this.orderStore.setNextCursor(result.metadata?.cursors?.next || '');
            }

        } catch (error) {
            this.showToast('Failed to apply payment status filter', 'error');
            throw error;
        }
    }

    /**
     * Clear status filter and reload original orders
     */
    clearStatusFilter(): void {
        this.isFilterMode = false;
        this.currentStatusFilter = null;
        this.currentFilterType = null;
        this.loadOrders();
    }

    /**
     * Build API filters for fulfillment status filtering
     */
    private buildFulfillmentStatusApiFilters(statusFilter: string): Record<string, any> {
        const baseFilter = {
            status: { $ne: "INITIALIZED" },
            archived: { $ne: true }
        };

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
    }

    /**
     * Build API filters for payment status filtering
     */
    private buildPaymentStatusApiFilters(statusFilter: string): Record<string, any> {
        const baseFilter = {
            status: { $ne: "INITIALIZED" },
            archived: { $ne: true }
        };

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

    /**
     * Clear search and return to all orders
     */
    clearSearch(): void {
        this.currentSearchQuery = '';
        this.lastSearchResult = null;
        this.orderStore.setSearchQuery('');
        this.orderStore.setSearchResults(null);
        this.advancedSearchService.clearCache();

        // Cancel any pending search
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = null;
        }
    }

    /**
     * Get current search statistics for UI display
     */
    getSearchStats(): {
        isSearching: boolean;
        hasResults: boolean;
        totalFound: number;
        fromCache: number;
        fromApi: number;
        searchTime: number;
        hasMore: boolean;
    } | null {
        if (!this.lastSearchResult) {
            return null;
        }

        return {
            isSearching: this.uiStore.searching || false,
            hasResults: this.lastSearchResult.totalFound > 0,
            totalFound: this.lastSearchResult.totalFound,
            fromCache: this.lastSearchResult.fromCache.length,
            fromApi: this.lastSearchResult.fromApi.length,
            searchTime: this.lastSearchResult.searchTime,
            hasMore: this.lastSearchResult.hasMore
        };
    }

    // === ORDER MANAGEMENT METHODS ===

    /**
     * Load initial orders with chunked loading
     */
    async loadOrders() {
        const isDev = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1');

        try {
            this.uiStore.setLoading(true);
            this.orderStore.setConnectionStatus('connecting');
            this.orderStore.setLoadingStatus('Loading orders...');

            // Clear any existing search when loading fresh orders
            this.clearSearch();

            // Load initial orders with progress updates (configurable limit)
            const result = await this.orderService.fetchOrdersChunked(settingsStore.initialOrderLimit, (orders, totalLoaded, hasMore) => {                // Update orders immediately with each batch
                this.orderStore.setOrders(orders);
                this.orderStore.setLoadingStatus(`Loading orders... (${totalLoaded})`);

                // Set connected after first batch so UI is responsive
                if (totalLoaded >= 100) {
                    this.orderStore.setConnectionStatus('connected');
                    this.uiStore.setLoading(false);
                }
            });

            if (result.success) {
                this.orderStore.setOrders(result.orders);
                this.orderStore.setHasMoreOrders(result.hasMore);
                this.orderStore.setNextCursor(result.nextCursor || '');
                this.orderStore.setConnectionStatus('connected');
                this.orderStore.setLoadingStatus('');
                this.autoSelectOldestUnfulfilled();
            } else {
                this.handleLoadError(new Error(result.error || 'Failed to load orders'));
            }

        } catch (error) {
            this.orderStore.setLoadingStatus('');
            this.handleLoadError(error);
        } finally {
            this.uiStore.setLoading(false);
        }
    }

    /**
     * Load more orders (pagination) - supports both regular and filtered modes
     */
    async loadMoreOrders() {
        if (!this.orderStore.hasMoreOrders || this.orderStore.isLoadingMore) {
            return;
        }

        const isDev = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1');

        try {
            this.orderStore.setIsLoadingMore(true);
            // this.orderStore.setLoadingStatus('Loading more orders...');

            if (this.isFilterMode && this.currentStatusFilter && this.currentFilterType) {

                const { orders } = await import('@wix/ecom');

                // Use the appropriate filter method based on type
                let apiFilters: Record<string, any>;
                if (this.currentFilterType === 'fulfillment') {
                    apiFilters = this.buildFulfillmentStatusApiFilters(this.currentStatusFilter);
                } else {
                    apiFilters = this.buildPaymentStatusApiFilters(this.currentStatusFilter);
                }

                const searchParams = {
                    filter: apiFilters,
                    cursorPaging: {
                        limit: settingsStore.initialOrderLimit,
                        cursor: this.orderStore.nextCursor
                    },
                    sort: [{ fieldName: '_createdDate' as const, order: 'DESC' as const }]
                };

                const result = await orders.searchOrders(searchParams);

                if (result.orders && result.orders.length > 0) {
                    const newOrders = result.orders.map(mapWixOrder);
                    this.orderStore.appendOrders(newOrders);
                    this.orderStore.setHasMoreOrders(result.metadata?.hasNext || false);
                    this.orderStore.setNextCursor(result.metadata?.cursors?.next || '');
                } else {
                    this.orderStore.setHasMoreOrders(false);
                }

            } else {
                // Regular load more using OrderService
                const result = await this.orderService.fetchMoreOrders(this.orderStore.nextCursor, settingsStore.initialOrderLimit);

                if (result.success) {
                    this.orderStore.appendOrders(result.orders);
                    this.orderStore.setHasMoreOrders(result.hasMore);
                    this.orderStore.setNextCursor(result.nextCursor || '');
                } else {
                    this.orderStore.setHasMoreOrders(false);
                }
            }

        } catch (error) {
            this.orderStore.setHasMoreOrders(false);
            // Don't show toast for load more errors to avoid spam
        } finally {
            this.orderStore.setIsLoadingMore(false);
            this.orderStore.setLoadingStatus('');
        }
    }

    /**
     * Refresh orders
     */
    async refreshOrders() {
        const isDev = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1');

        this.uiStore.setRefreshing(true);
        this.clearSelection();
        this.clearSearch(); // Clear search on refresh

        try {
            const result = await this.orderService.fetchOrders({
                limit: 50,
                cursor: undefined
            });

            if (result.success && result.orders && result.orders.length > 0) {
                this.orderStore.setOrders(result.orders);

                // Use actual pagination data instead of hardcoding
                this.orderStore.setPagination({
                    hasNext: result.pagination?.hasNext || false,
                    nextCursor: result.pagination?.nextCursor || '',
                    prevCursor: result.pagination?.prevCursor || ''
                });

                this.orderStore.setConnectionStatus('connected');

                this.showToast(`Orders refreshed successfully.`, 'success');
                this.autoSelectOldestUnfulfilled();

            } else {
                this.handleNoOrdersFound(result.message);
            }

        } catch (error) {
            this.handleRefreshError(error);
        } finally {
            this.uiStore.setRefreshing(false);
        }
    }

    /**
     * Select an order
     */
    selectOrder(order: Order | null) {
        // Clear any existing selection first to prevent stuck state
        if (order && this.orderStore.selectedOrder?._id !== order._id) {
            // this.orderStore.selectOrder(null);
            // Small delay to allow UI to clear
            setTimeout(() => {
                this.orderStore.selectOrder(order);
                this.uiStore.resetForm();

                // Pre-populate if order has existing tracking info
                if ((order as any).trackingNumber) {
                    this.uiStore.setTrackingNumber((order as any).trackingNumber);
                }
                if ((order as any).shippingCarrier) {
                    this.uiStore.setSelectedCarrier((order as any).shippingCarrier);
                }
            }, 50);
        } else {
            this.orderStore.selectOrder(order);
            this.uiStore.resetForm();

            if (order) {
                // Pre-populate if order has existing tracking info
                if ((order as any).trackingNumber) {
                    this.uiStore.setTrackingNumber((order as any).trackingNumber);
                }
                if ((order as any).shippingCarrier) {
                    this.uiStore.setSelectedCarrier((order as any).shippingCarrier);
                }
            }
        }
    }

    /**
     * Clear order selection
     */
    /**
 * Clear order selection
 */
    clearSelection() {
        this.orderStore.selectOrder(null);
        this.uiStore.resetForm();
        // Clear any pending timeouts that might cause re-selection
        this.clearPendingSelections();
    }

    /**
     * Clear any pending selection timeouts
     */
    private clearPendingSelections() {
        // You can add timeout clearing logic here if needed
    }

    /**
     * Fulfill an order with real-time feedback
     */
    async fulfillOrder(params?: FulfillOrderParams & { sendShippingEmail?: boolean }): Promise<void> {
        // Use params if provided, otherwise use store state
        let fulfillmentParams: FulfillOrderParams & { sendShippingEmail?: boolean };

        if (params) {
            fulfillmentParams = params;
        } else {
            const { selectedOrder } = this.orderStore;
            const { trackingNumber, selectedCarrier } = this.uiStore;

            if (!trackingNumber || !selectedCarrier || !selectedOrder) {
                this.showToast('Please enter tracking number and select carrier', 'error');
                return;
            }

            fulfillmentParams = {
                orderId: selectedOrder._id,
                trackingNumber,
                shippingProvider: selectedCarrier,
                orderNumber: selectedOrder.number,
                sendShippingEmail: true // Default to true for backward compatibility
            };
        }
        this.uiStore.setSubmitting(true);

        try {
            // Call the service with properly typed parameters
            const result = await this.orderService.fulfillOrder({
                orderId: fulfillmentParams.orderId,
                trackingNumber: fulfillmentParams.trackingNumber,
                shippingProvider: fulfillmentParams.shippingProvider,
                orderNumber: fulfillmentParams.orderNumber,
                sendShippingEmail: fulfillmentParams.sendShippingEmail ?? true
            });

            if (result.success) {
                // Update order status immediately for instant feedback
                this.orderStore.updateOrderStatus(fulfillmentParams.orderId, 'FULFILLED');

                // Show success notification with email info
                let message = `Order #${fulfillmentParams.orderNumber} fulfilled successfully!`;


                if (result.emailInfo) {
                    if (result.emailInfo.emailSentAutomatically) {
                        message += ' | Confirmation email sent to customer';
                    } else {
                        message += ' | No email sent to customer';
                    }
                }
                this.showToast(message, 'success');

                // Refresh the selected order to get latest data
                if (this.orderStore.selectedOrder?._id === fulfillmentParams.orderId) {
                    // Temporarily clear selection to prevent stuck state
                    const currentOrderId = this.orderStore.selectedOrder._id;
                    this.orderStore.selectOrder(null);

                    // Add a small delay to allow UI to update
                    setTimeout(async () => {
                        await this.selectOrderById(currentOrderId);
                    }, 100);
                }

            } else {
                throw new Error(result.error || 'Fulfillment failed');
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.showToast(`Failed to fulfill order: ${errorMessage}`, 'error');
        } finally {
            this.uiStore.resetForm();
            this.uiStore.setSubmitting(false);
        }
    }

    /**
     * Select an order by ID and refresh its data
     */
    async selectOrderById(orderId: string): Promise<void> {
        try {
            console.log('🔄 Refreshing order data for:', orderId);

            // Clear any existing selection first to prevent stuck state
            this.orderStore.selectOrder(null);

            const result = await this.orderService.fetchSingleOrder(orderId);
            if (result.success && result.order) {
                console.log('✅ Fresh order data received:', {
                    orderId: result.order._id,
                    fulfillments: result.order.rawOrder?.fulfillments?.length || 0,
                    status: result.order.status
                });

                // Update the order in the store
                this.orderStore.updateOrder(result.order);

                // Re-select the refreshed order
                this.orderStore.selectOrder(result.order);
            } else {
                console.warn('❌ Failed to refresh order:', result.error);
                // Don't leave the order selected if refresh failed
                this.orderStore.selectOrder(null);
            }
        } catch (error) {
            console.error('❌ Error refreshing order:', error);
            // Don't leave the order selected if refresh failed
            this.orderStore.selectOrder(null);
        }
    }

    /**
    * Get the order service instance (for external controllers)
    */
    getOrderService(): OrderService {
        return this.orderService;
    }

    // === ANALYTICS METHODS ===

    /**
     * Load analytics for a specific period
     */
    async loadAnalyticsForPeriod(period: 'today' | 'yesterday' | '7days' | '30days' | 'thisweek' | 'thismonth' | '365days' | 'thisyear' = '30days') {
        try {
            this.orderStore.setAnalyticsLoading(true);
            this.orderStore.setAnalyticsError(null);

            const analyticsService = new AnalyticsService();
            const siteId = getSiteIdFromContext();

            if (!siteId) {
                throw new Error('Site ID not found - using fallback');
            }

            // Get analytics with comparison data
            const result = await analyticsService.getAnalyticsWithComparison(period);

            if (result.success) {
                // Store the analytics data with comparison
                this.orderStore.setAnalyticsData({
                    TOTAL_SALES: { total: result.data?.totalSales || 0 },
                    TOTAL_ORDERS: { total: result.data?.totalOrders || 0 },
                    TOTAL_SESSIONS: { total: result.data?.totalSessions || 0 }
                });

                this.orderStore.setFormattedAnalytics({
                    totalSales: result.data?.totalSales || 0,
                    totalOrders: result.data?.totalOrders || 0,
                    totalSessions: result.data?.totalSessions || 0,
                    totalUniqueVisitors: result.data?.totalUniqueVisitors || 0,
                    todayUniqueVisitors: result.data?.todayUniqueVisitors || 0,
                    yesterdayUniqueVisitors: result.data?.yesterdayUniqueVisitors || 0,
                    averageOrderValue: result.data?.averageOrderValue || 0,
                    currency: result.data?.currency || '',
                    salesChange: result.data?.salesChange || 0,
                    ordersChange: result.data?.ordersChange || 0,
                    sessionsChange: result.data?.sessionsChange || 0,
                    uniqueVisitorsChange: result.data?.uniqueVisitorsChange || 0,
                    aovChange: result.data?.aovChange || 0,
                    period: period
                });

            } else {
                throw new Error(result.error || 'Analytics API failed');
            }

        } catch (error: any) {
            this.orderStore.setAnalyticsError(error.message);

            // Fallback to order-based analytics with comparison
            this.calculateAnalyticsFromOrdersWithComparison(period);

        } finally {
            this.orderStore.setAnalyticsLoading(false);
        }
    }

    /**
     * Enhanced fallback method with comparison
     */
    private calculateAnalyticsFromOrdersWithComparison(period: string) {
        const { current, previous } = this.getOrderDateRanges(period);

        // Get orders for current period
        const currentOrders = this.orderStore.orders.filter(order => {
            const orderDate = new Date(order._createdDate);
            return orderDate >= current.start && orderDate <= current.end;
        });

        // Get orders for previous period
        const previousOrders = this.orderStore.orders.filter(order => {
            const orderDate = new Date(order._createdDate);
            return orderDate >= previous.start && orderDate <= previous.end;
        });

        // Calculate metrics
        const currentMetrics = this.calculateOrderMetrics(currentOrders);
        const previousMetrics = this.calculateOrderMetrics(previousOrders);

        // Calculate percentage changes
        const calculateChange = (current: number, previous: number): number => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return Math.round(((current - previous) / previous) * 100);
        };

        // Store fallback analytics with comparison
        this.orderStore.setFormattedAnalytics({
            totalSales: currentMetrics.totalSales,
            totalOrders: currentMetrics.totalOrders,
            totalSessions: 0, // Not available from orders
            totalUniqueVisitors: 0, // Not available from orders
            todayUniqueVisitors: 0, // Not available from orders
            yesterdayUniqueVisitors: 0, // Not available from orders
            averageOrderValue: currentMetrics.averageOrderValue,
            currency: currentMetrics.currency,
            salesChange: calculateChange(currentMetrics.totalSales, previousMetrics.totalSales),
            ordersChange: calculateChange(currentMetrics.totalOrders, previousMetrics.totalOrders),
            sessionsChange: 0,
            uniqueVisitorsChange: 0, // Not available from orders
            aovChange: calculateChange(currentMetrics.averageOrderValue, previousMetrics.averageOrderValue),
            period: period
        });
    }

    /**
     * Helper method to calculate metrics from orders
     */
    private calculateOrderMetrics(orders: any[]) {
        let totalSales = 0;
        let currency = '€';

        orders.forEach(order => {
            const parsedPrice = this.parsePrice(order.total);
            totalSales += parsedPrice;
            const orderCurrency = this.extractCurrency(order.total);
            if (orderCurrency !== '€') {
                currency = orderCurrency;
            }
        });

        const totalOrders = orders.length;
        const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

        return {
            totalSales,
            totalOrders,
            averageOrderValue,
            currency
        };
    }

    /**
     * Helper method to get date ranges for order comparison
     */
    private getOrderDateRanges(period: string) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        switch (period) {
            case 'today':
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                return {
                    current: { start: today, end: today },
                    previous: { start: yesterday, end: yesterday }
                };

            case 'yesterday':
                const yesterdayStart = new Date(today);
                yesterdayStart.setDate(yesterdayStart.getDate() - 1);
                const dayBefore = new Date(today);
                dayBefore.setDate(dayBefore.getDate() - 2);
                return {
                    current: { start: yesterdayStart, end: yesterdayStart },
                    previous: { start: dayBefore, end: dayBefore }
                };

            case '7days':
                const sevenDaysAgo = new Date(today);
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                const fourteenDaysAgo = new Date(today);
                fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
                return {
                    current: { start: sevenDaysAgo, end: today },
                    previous: { start: fourteenDaysAgo, end: sevenDaysAgo }
                };

            case '30days':
            default:
                const thirtyDaysAgo = new Date(today);
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const sixtyDaysAgo = new Date(today);
                sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
                return {
                    current: { start: thirtyDaysAgo, end: today },
                    previous: { start: sixtyDaysAgo, end: thirtyDaysAgo }
                };
        }
    }

    // === UTILITY METHODS ===

    /**
     * Helper methods for price parsing
     */
    private parsePrice(priceString: string): number {
        if (!priceString || typeof priceString !== 'string') return 0;

        let cleanPrice = priceString.replace(/[^\d,.-]/g, '');

        if (cleanPrice.includes(',') && cleanPrice.includes('.')) {
            const lastComma = cleanPrice.lastIndexOf(',');
            const lastDot = cleanPrice.lastIndexOf('.');

            if (lastComma > lastDot) {
                cleanPrice = cleanPrice.replace(/\./g, '').replace(',', '.');
            } else {
                cleanPrice = cleanPrice.replace(/,/g, '');
            }
        } else if (cleanPrice.includes(',') && !cleanPrice.includes('.')) {
            const parts = cleanPrice.split(',');
            if (parts.length === 2 && parts[1].length <= 2) {
                cleanPrice = cleanPrice.replace(',', '.');
            } else {
                cleanPrice = cleanPrice.replace(/,/g, '');
            }
        }

        const parsed = parseFloat(cleanPrice);
        return isNaN(parsed) ? 0 : parsed;
    }

    private extractCurrency(priceString: string): string {
        if (!priceString) return '€';

        const currencyMatch = priceString.match(/[€$£¥₹₽¢]/);
        if (currencyMatch) return currencyMatch[0];

        const codeMatch = priceString.match(/[A-Z]{3}/);
        if (codeMatch) return codeMatch[0];

        return '€';
    }

    /**
     * Copy text to clipboard
     * @param text - The text to copy
     * @param label - The label to show in the success message (if showToast is true)
     * @param showToast - Whether to show a success/error toast (default: true)
     * @returns Promise that resolves when the operation is complete
     */
    async copyToClipboard(text: string, label: string, showToast = true) {
        // Check if click-to-copy is enabled in settings
        if (!settingsStore.clickToCopyEnabled) {
            return; // Skip copying if disabled in settings
        }

        try {
            await navigator.clipboard.writeText(text);
            if (showToast) {
                this.showToast(`${label} copied to clipboard`, 'success');
            }
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            if (showToast) {
                this.showToast('Failed to copy to clipboard', 'error');
            }
        }
    }

    /**
     * Auto-select oldest unfulfilled order
     */
    private autoSelectOldestUnfulfilled() {
        const oldestUnfulfilled = this.orderStore.oldestUnfulfilledOrder;
        if (oldestUnfulfilled && !this.orderStore.selectedOrder) {
            this.selectOrder(oldestUnfulfilled);
        }
    }

    /**
     * Handle no orders found scenario
     */
    private handleNoOrdersFound(message?: string) {
        this.orderStore.setConnectionStatus('disconnected');
    }

    /**
     * Handle order loading errors
     */
    private handleLoadError(error: unknown) {
        this.orderStore.setConnectionStatus('error');
    }

    /**
     * Handle refresh errors
     * @param error Optional error object for logging
     */
    private handleRefreshError(error?: unknown) {
        this.orderStore.setConnectionStatus('error');
    }

    /**
     * Show a toast notification
     * @param message The message to display
     * @param type The type of notification (success, error, warning)
     */
    private showToast(message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
        try {
            dashboard.showToast({
                message,
                type,
            });
        } catch {
            // Silently handle toast errors
        }
    }

    /**
     * Cleanup when component unmounts
     */
    destroy(): void {
        // Reset the initial load state when the controller is destroyed
        // This ensures that when navigating back to the page, we don't show old notifications
        this.realtimeService.resetInitialLoad();

        // Cleanup any other resources if needed
        this.realtimeService.destroy();

        // Clear timeouts
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        // Clear search state
        this.clearSearch();
    }
}