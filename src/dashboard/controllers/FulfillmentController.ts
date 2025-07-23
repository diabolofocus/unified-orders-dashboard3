// controllers/FulfillmentController.ts - ENHANCED with per-item fulfillment

import { dashboard } from '@wix/dashboard';
import type { OrderStore } from '../stores/OrderStore';
import type { UIStore } from '../stores/UIStore';
import type { OrderService } from '../services/OrderService';
import type { Order, FulfillOrderParams } from '../types/Order';

interface ItemFulfillment {
    id: string;
    quantity: number;
}

interface PerItemFulfillmentParams {
    orderId: string;
    orderNumber: string;
    trackingNumber: string;
    shippingProvider: string;
    selectedItems: ItemFulfillment[];
    sendShippingEmail?: boolean;
    editMode?: boolean;
    existingFulfillmentId?: string;
}

export class FulfillmentController {
    constructor(
        private orderStore: OrderStore,
        private uiStore: UIStore,
        private orderService: OrderService
    ) { }

    /**
     * Enhanced fulfill order method with per-item support
     */
    async fulfillOrder(params?: PerItemFulfillmentParams): Promise<void> {
        console.log('🚀 FulfillmentController.fulfillOrder called', params ? 'with params' : 'using store state');

        let fulfillmentParams: PerItemFulfillmentParams;

        if (params) {
            // Use provided parameters
            fulfillmentParams = params;
        } else {
            // Use store state (backward compatibility)
            const { selectedOrder } = this.orderStore;
            const { trackingNumber, selectedCarrier } = this.uiStore;

            if (!this.validateStoreState(selectedOrder, trackingNumber, selectedCarrier)) {
                return;
            }

            fulfillmentParams = {
                orderId: selectedOrder!._id,
                orderNumber: selectedOrder!.number,
                trackingNumber,
                shippingProvider: selectedCarrier,
                selectedItems: [], // Empty means full fulfillment
                sendShippingEmail: true
            };
        }

        this.uiStore.setSubmitting(true);

        try {
            console.log('📦 Processing fulfillment:', {
                orderNumber: fulfillmentParams.orderNumber,
                hasSelectedItems: fulfillmentParams.selectedItems.length > 0,
                itemCount: fulfillmentParams.selectedItems.length,
                editMode: fulfillmentParams.editMode
            });

            // Call the enhanced order service
            const result = await this.orderService.fulfillOrder({
                orderId: fulfillmentParams.orderId,
                orderNumber: fulfillmentParams.orderNumber,
                trackingNumber: fulfillmentParams.trackingNumber,
                shippingProvider: fulfillmentParams.shippingProvider,
                selectedItems: fulfillmentParams.selectedItems,
                sendShippingEmail: fulfillmentParams.sendShippingEmail,
                editMode: fulfillmentParams.editMode,
                existingFulfillmentId: fulfillmentParams.existingFulfillmentId
            });

            if (!result.success) {
                throw new Error(result.message || 'Failed to fulfill order');
            }

            // Update order status in store based on fulfillment type
            if (fulfillmentParams.selectedItems.length > 0) {
                // Partial fulfillment - need to determine actual status
                await this.updateOrderStatusAfterPartialFulfillment(fulfillmentParams.orderId);
            } else {
                // Full fulfillment
                this.orderStore.updateOrderStatus(fulfillmentParams.orderId, 'FULFILLED');
            }

            // Show success message
            const message = this.getFulfillmentSuccessMessage(
                fulfillmentParams.orderNumber,
                fulfillmentParams.trackingNumber,
                result.emailInfo?.emailSentAutomatically || false,
                fulfillmentParams.selectedItems.length > 0
            );
            this.showToast(message, 'success');

            // Clear form
            this.clearForm();

            // Refresh the selected order if it matches
            if (this.orderStore.selectedOrder?._id === fulfillmentParams.orderId) {
                await this.refreshSelectedOrder(fulfillmentParams.orderId);
            }

        } catch (error) {
            this.handleFulfillmentError(error);
        } finally {
            this.uiStore.setSubmitting(false);
        }
    }

    /**
     * Update tracking for specific items
     */
    async updateItemTracking(params: {
        orderId: string;
        orderNumber: string;
        itemId?: string;
        fulfillmentId?: string;
        trackingNumber: string;
        shippingProvider: string;
        sendShippingEmail?: boolean;
    }): Promise<void> {
        console.log('🔄 FulfillmentController.updateItemTracking called');

        this.uiStore.setSubmitting(true);

        try {
            const result = await this.orderService.updateItemTracking(params);

            if (result.success) {
                this.showToast(
                    `Tracking updated for order #${params.orderNumber}: ${params.trackingNumber}`,
                    'success'
                );

                // Refresh the selected order
                if (this.orderStore.selectedOrder?._id === params.orderId) {
                    await this.refreshSelectedOrder(params.orderId);
                }
            } else {
                throw new Error(result.message || 'Failed to update item tracking');
            }

        } catch (error) {
            this.handleFulfillmentError(error);
        } finally {
            this.uiStore.setSubmitting(false);
        }
    }

    /**
     * Get fulfillment capabilities for an order
     */
    getOrderFulfillmentCapabilities(order: Order): {
        canAddTracking: boolean;
        canEditTracking: boolean;
        canFulfillFully: boolean;
        canFulfillPartially: boolean;
        hasUnfulfilledItems: boolean;
        hasFulfilledItems: boolean;
        isFullyFulfilled: boolean;
        isPartiallyFulfilled: boolean;
        fulfillmentSummary: {
            totalItems: number;
            fulfilledItems: number;
            remainingItems: number;
        };
    } {
        const lineItems = order.rawOrder?.lineItems || [];

        if (lineItems.length === 0) {
            return {
                canAddTracking: false,
                canEditTracking: false,
                canFulfillFully: false,
                canFulfillPartially: false,
                hasUnfulfilledItems: false,
                hasFulfilledItems: false,
                isFullyFulfilled: false,
                isPartiallyFulfilled: false,
                fulfillmentSummary: { totalItems: 0, fulfilledItems: 0, remainingItems: 0 }
            };
        }

        let totalItems = 0;
        let fulfilledItems = 0;
        let hasAnyTracking = false;

        lineItems.forEach((item: any) => {
            const quantity = item.quantity || 1;
            const fulfilled = item.fulfilledQuantity || 0;

            totalItems += quantity;
            fulfilledItems += fulfilled;

            // Check if this item has any tracking
            if (item.fulfillmentDetails?.trackingInfo?.length > 0 ||
                item.fulfillmentDetails?.lineItemFulfillment?.some((f: any) => f.trackingNumber)) {
                hasAnyTracking = true;
            }
        });

        const remainingItems = totalItems - fulfilledItems;
        const isFullyFulfilled = fulfilledItems >= totalItems && totalItems > 0;
        const isPartiallyFulfilled = fulfilledItems > 0 && fulfilledItems < totalItems;
        const hasUnfulfilledItems = remainingItems > 0;
        const hasFulfilledItems = fulfilledItems > 0;

        return {
            canAddTracking: hasUnfulfilledItems, // Can add tracking if there are unfulfilled items
            canEditTracking: hasAnyTracking, // Can edit if there's existing tracking
            canFulfillFully: hasUnfulfilledItems, // Can fulfill fully if not all items are fulfilled
            canFulfillPartially: hasUnfulfilledItems, // Can fulfill partially if there are unfulfilled items
            hasUnfulfilledItems,
            hasFulfilledItems,
            isFullyFulfilled,
            isPartiallyFulfilled,
            fulfillmentSummary: {
                totalItems,
                fulfilledItems,
                remainingItems
            }
        };
    }

    /**
     * Get unfulfilled items for an order
     */
    getUnfulfilledItems(order: Order): Array<{
        id: string;
        name: string;
        quantity: number;
        fulfilledQuantity: number;
        remainingQuantity: number;
        sku?: string;
    }> {
        const lineItems = order.rawOrder?.lineItems || [];

        return lineItems
            .filter((item: any) => {
                const total = item.quantity || 1;
                const fulfilled = item.fulfilledQuantity || 0;
                return fulfilled < total;
            })
            .map((item: any) => ({
                id: item._id || item.id || '',
                name: typeof item.productName === 'object'
                    ? item.productName.original
                    : item.productName || 'Product',
                quantity: item.quantity || 1,
                fulfilledQuantity: item.fulfilledQuantity || 0,
                remainingQuantity: (item.quantity || 1) - (item.fulfilledQuantity || 0),
                sku: item.physicalProperties?.sku || item.catalogReference?.catalogItemId
            }));
    }

    /**
     * Validate items for fulfillment
     */
    async validateItemsForFulfillment(orderId: string, selectedItems: ItemFulfillment[]): Promise<{
        isValid: boolean;
        errors: string[];
        validItems: ItemFulfillment[];
        invalidItems: Array<{ item: ItemFulfillment; error: string }>;
    }> {
        console.log('✅ FulfillmentController.validateItemsForFulfillment called');

        try {
            const result = await this.orderService.validateItemsForFulfillment(orderId, selectedItems);

            if (result.success && result.validation) {
                const errors: string[] = [];
                const validItems: ItemFulfillment[] = [];
                const invalidItems: Array<{ item: ItemFulfillment; error: string }> = [];

                result.validation.forEach((validation: any) => {
                    const item = selectedItems.find(item => item.id === validation.itemId);
                    if (item) {
                        if (validation.valid) {
                            validItems.push(item);
                        } else {
                            const error = validation.error || 'Item validation failed';
                            errors.push(`${validation.itemId}: ${error}`);
                            invalidItems.push({ item, error });
                        }
                    }
                });

                return {
                    isValid: errors.length === 0,
                    errors,
                    validItems,
                    invalidItems
                };
            } else {
                throw new Error(result.error || 'Validation failed');
            }

        } catch (error) {
            console.error('❌ Validation failed:', error);
            return {
                isValid: false,
                errors: [error instanceof Error ? error.message : String(error)],
                validItems: [],
                invalidItems: selectedItems.map(item => ({
                    item,
                    error: 'Validation service unavailable'
                }))
            };
        }
    }

    // Add this method to your FulfillmentController class

    /**
     * Bulk mark multiple orders as fulfilled
     */
    async bulkMarkOrdersAsFulfilled(params: {
        orderIds: string[];
        trackingNumber?: string;
        shippingProvider?: string;
        sendShippingEmail?: boolean;
    }): Promise<void> {
        console.log('🚀 FulfillmentController.bulkMarkOrdersAsFulfilled called with:', {
            orderCount: params.orderIds.length,
            hasTracking: !!params.trackingNumber,
            carrier: params.shippingProvider
        });

        if (params.orderIds.length === 0) {
            this.showToast('No orders selected for fulfillment', 'error');
            return;
        }

        this.uiStore.setSubmitting(true);

        try {
            // Call the bulk fulfillment service
            const result = await this.orderService.bulkMarkOrdersAsFulfilled({
                orderIds: params.orderIds,
                trackingNumber: params.trackingNumber,
                shippingProvider: params.shippingProvider,
                sendShippingEmail: params.sendShippingEmail ?? true
            });

            console.log('📦 Bulk fulfillment result:', {
                success: result.success,
                successCount: result.successCount,
                failureCount: result.failureCount
            });

            if (result.success) {
                // Update order statuses in store for successful fulfillments
                result.results.forEach(orderResult => {
                    if (orderResult.success) {
                        this.orderStore.updateOrderStatus(orderResult.orderId, 'FULFILLED');
                    }
                });

                // Show success message
                let message = `Successfully fulfilled ${result.successCount} order${result.successCount !== 1 ? 's' : ''}`;

                if (result.failureCount > 0) {
                    message += `, ${result.failureCount} failed`;
                }

                if (params.trackingNumber) {
                    message += ` with tracking: ${params.trackingNumber}`;
                }

                this.showToast(message, 'success');

                // Log any failures for debugging
                const failures = result.results.filter(r => !r.success);
                if (failures.length > 0) {
                    console.warn('❌ Some orders failed to fulfill:', failures);

                    // Show detailed error for first few failures
                    const firstFewErrors = failures.slice(0, 3).map(f =>
                        `Order ${f.orderId}: ${f.error || 'Unknown error'}`
                    ).join(', ');

                    if (failures.length <= 3) {
                        this.showToast(`Errors: ${firstFewErrors}`, 'warning');
                    } else {
                        this.showToast(`Errors in ${failures.length} orders. Check console for details.`, 'warning');
                    }
                }

            } else {
                throw new Error(result.message || 'Bulk fulfillment failed');
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('❌ Bulk fulfillment error:', error);
            this.showToast(`Bulk fulfillment failed: ${errorMessage}`, 'error');
        } finally {
            this.uiStore.setSubmitting(false);
        }
    }

    /**
     * Bulk mark orders as fulfilled with optional tracking modal
     */
    async bulkMarkOrdersAsFulfilledWithModal(orderIds: string[]): Promise<void> {
        // For now, just mark as fulfilled without tracking
        // You can extend this to show a modal for tracking info if needed
        await this.bulkMarkOrdersAsFulfilled({
            orderIds,
            sendShippingEmail: true
        });
    }

    /**
     * Set tracking information in the form
     */
    setTrackingInfo(trackingNumber: string, carrier: string): void {
        this.uiStore.setTrackingNumber(trackingNumber);
        this.uiStore.setSelectedCarrier(carrier);
    }

    /**
     * Clear the fulfillment form
     */
    clearForm(): void {
        this.uiStore.resetForm();
    }

    /**
     * Check if order can be fulfilled (backward compatibility)
     */
    canFulfillOrder(order: Order): boolean {
        const capabilities = this.getOrderFulfillmentCapabilities(order);
        return capabilities.canFulfillFully || capabilities.canFulfillPartially;
    }

    /**
     * Check if order tracking can be updated (backward compatibility)
     */
    canUpdateTracking(order: Order): boolean {
        const capabilities = this.getOrderFulfillmentCapabilities(order);
        return capabilities.canEditTracking;
    }

    // ===== PRIVATE HELPER METHODS =====

    /**
     * Update order status after partial fulfillment
     */
    private async updateOrderStatusAfterPartialFulfillment(orderId: string): Promise<void> {
        try {
            // Get updated fulfillment details
            const orderNumber = this.orderStore.selectedOrder?.number || '';
            const details = await this.orderService.getOrderFulfillmentDetails(orderId, orderNumber);

            if (details.success && details.orderDetails) {
                const status = details.orderDetails.overallFulfillmentStatus;
                this.orderStore.updateOrderStatus(orderId, status);
            }
        } catch (error) {
            console.warn('Failed to update order status after partial fulfillment:', error);
        }
    }

    /**
     * Refresh the selected order with latest data
     */
    private async refreshSelectedOrder(orderId: string): Promise<void> {
        try {
            const result = await this.orderService.fetchSingleOrder(orderId);
            if (result.success && result.order) {
                this.orderStore.updateOrder(result.order);
                // Refresh the selected order with latest data
                if (this.orderStore.selectedOrder?._id === orderId) {
                    // Temporarily clear selection to prevent stuck state
                    const currentOrderId = this.orderStore.selectedOrder._id;
                    this.orderStore.selectOrder(null);

                    // Add a small delay to allow UI to update
                    setTimeout(async () => {
                        await this.refreshSelectedOrder(currentOrderId);
                        const refreshedOrder = this.orderStore.getOrderById(currentOrderId);
                        if (refreshedOrder) {
                            this.orderStore.selectOrder(refreshedOrder);
                        }
                    }, 100);
                } else {
                    await this.refreshSelectedOrder(orderId);
                }
            }
        } catch (error) {
            console.warn('Failed to refresh selected order:', error);
        }
    }

    /**
     * Validate store state for fulfillment
     */
    private validateStoreState(
        order: Order | null,
        trackingNumber: string,
        carrier: string
    ): boolean {
        if (!order) {
            this.showToast('No order selected', 'error');
            return false;
        }

        if (!trackingNumber?.trim()) {
            this.showToast('Please enter a tracking number', 'error');
            return false;
        }

        if (!carrier) {
            this.showToast('Please select a shipping carrier', 'error');
            return false;
        }

        return true;
    }

    /**
     * Generate fulfillment success message
     */
    private getFulfillmentSuccessMessage(
        orderNumber: string,
        trackingNumber: string,
        emailSent: boolean,
        isPartial: boolean
    ): string {
        const baseMessage = isPartial
            ? `Order #${orderNumber} partially fulfilled with tracking: ${trackingNumber}`
            : `Order #${orderNumber} fulfilled with tracking: ${trackingNumber}`;

        const emailNote = emailSent
            ? ' | Confirmation email sent to customer'
            : ' | No email sent to customer';

        return baseMessage + emailNote;
    }

    /**
     * Handle fulfillment errors
     */
    private handleFulfillmentError(error: unknown): void {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ Fulfillment error:', error);
        this.showToast(`Fulfillment failed: ${errorMessage}`, 'error');
    }

    /**
     * Show toast notification
     */
    private showToast(message: string, type: 'success' | 'error' | 'warning'): void {
        try {
            dashboard.showToast({ message, type });
        } catch (error) {
            console.warn('Failed to show toast:', error);
        }
    }
}