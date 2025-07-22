// components/OrderDetails/OrderDetails.tsx - ENHANCED with per-item fulfillment

import React, { useState, useEffect, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { Card, Box, Text, Heading, Tabs, EmptyState, Divider, Loader } from '@wix/design-system';
import * as Icons from '@wix/wix-ui-icons-common';
import { useStores } from '../../hooks/useStores';
import { useOrderController } from '../../hooks/useOrderController';
import { settingsStore } from '../../stores/SettingsStore';
import { formatDate } from '../../utils/formatters';
import { CustomerInfo } from './CustomerInfo';
import ProductImages from './ProductImages';
import { ShippingAddress } from './ShippingAddress';
import { OrderActivity } from './OrderActivity';
import { StatusBadge } from '../shared/StatusBadge';
import { BillingAddress } from './BillingAddress';
import { ExtendedFields } from './ExtendedFields';
import { TrackingNumberDisplay } from './TrackingNumberDisplay';
import { dashboard } from '@wix/dashboard';
import { pages } from '@wix/ecom/dashboard';
import { orders } from '@wix/ecom';


import { OrderService } from '../../services/OrderService';

import {
    calculateOrderFulfillmentStatus,
    getOrderUnfulfilledItems,
    Order,
    type ItemFulfillment,
    type OrderFulfillmentCapabilities
} from '../../types/Order';

export const OrderDetails: React.FC = observer(() => {
    const { orderStore, uiStore } = useStores();
    const orderController = useOrderController();
    const { selectedOrder } = orderStore;
    const [activeTabId, setActiveTabId] = useState<string | number>(1);
    const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

    const [isProcessingFulfillment, setIsProcessingFulfillment] = useState(false);
    const [customerOrders, setCustomerOrders] = useState<any[]>([]);
    const [isLoadingOrders, setIsLoadingOrders] = useState(false);
    const [orderService] = useState(() => new OrderService());

    const fulfillmentCapabilities: OrderFulfillmentCapabilities | null = useMemo(() => {
        if (!selectedOrder) return null;

        const status = calculateOrderFulfillmentStatus(selectedOrder);
        const lineItems = selectedOrder.rawOrder?.lineItems || selectedOrder.lineItems || [];

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
            canAddTracking: hasUnfulfilledItems,
            canEditTracking: hasAnyTracking,
            canFulfillFully: hasUnfulfilledItems,
            canFulfillPartially: hasUnfulfilledItems,
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
    }, [selectedOrder, refreshTrigger]);

    useEffect(() => {
        if (selectedOrder) {
            setActiveTabId(1);
        }
    }, [selectedOrder?._id]);

    useEffect(() => {
        const fetchCustomerOrders = async () => {
            if (!selectedOrder || activeTabId !== 2) return;

            // Get customer email
            const customerEmail = selectedOrder.rawOrder?.buyerInfo?.email ||
                selectedOrder.customer?.email ||
                selectedOrder.buyerInfo?.email;

            console.log('🔍 Looking for customer orders with email:', customerEmail);

            if (!customerEmail) {
                console.warn('No customer email found');
                return;
            }

            setIsLoadingOrders(true);
            try {
                // Use proper Wix ecom API filtering with correct types
                const { orders } = await import('@wix/ecom');

                console.log('🚀 Using Wix API with proper email filter...');

                const searchOptions = {
                    filter: {
                        "buyerInfo.email": { "$eq": customerEmail }
                    },
                    sort: [{
                        fieldName: "_createdDate" as const,
                        order: "DESC" as const
                    }],
                    cursorPaging: {
                        limit: 50
                    }
                };

                const result = await orders.searchOrders(searchOptions);

                console.log('📊 Total orders found for email:', result.orders?.length || 0);

                if (result.orders && result.orders.length > 0) {
                    // Filter out the current order and transform the data
                    const filteredOrders = result.orders
                        .filter(order => order._id !== selectedOrder._id)
                        .map(order => ({
                            _id: order._id,
                            number: order.number,
                            _createdDate: order._createdDate,
                            total: order.priceSummary?.total?.formattedAmount || '€0.00',
                            status: order.fulfillmentStatus || 'NOT_FULFILLED',
                            paymentStatus: order.paymentStatus || 'UNPAID',
                            rawOrder: order
                        }))
                        .slice(0, 10); // Limit to 10 most recent

                    console.log('🎯 Found', filteredOrders.length, 'other orders for this customer');
                    console.log('📋 Orders:', filteredOrders.map(o => `#${o.number} (${o.total})`));

                    setCustomerOrders(filteredOrders);

                } else {
                    console.log('✅ This customer has no other orders');
                    setCustomerOrders([]);
                }

            } catch (apiError) {
                console.error('❌ Wix API failed:', apiError);

                // If the filter doesn't work, try without the filter and manual filtering
                console.log('🔄 Trying fallback: get all orders and filter manually...');
                try {
                    const { orders } = await import('@wix/ecom');

                    const fallbackResult = await orders.searchOrders({
                        sort: [{
                            fieldName: "_createdDate" as const,
                            order: "DESC" as const
                        }],
                        cursorPaging: {
                            limit: 100
                        }
                    });

                    if (fallbackResult.orders) {
                        const filteredOrders = fallbackResult.orders
                            .filter(order => {
                                return order._id !== selectedOrder._id &&
                                    order.buyerInfo?.email?.toLowerCase() === customerEmail.toLowerCase();
                            })
                            .map(order => ({
                                _id: order._id,
                                number: order.number,
                                _createdDate: order._createdDate,
                                total: order.priceSummary?.total?.formattedAmount || '€0.00',
                                status: order.fulfillmentStatus || 'NOT_FULFILLED',
                                paymentStatus: order.paymentStatus || 'UNPAID',
                                rawOrder: order
                            }))
                            .slice(0, 10);

                        console.log('🎯 Fallback found', filteredOrders.length, 'matching orders');
                        setCustomerOrders(filteredOrders);
                    } else {
                        setCustomerOrders([]);
                    }

                } catch (fallbackError) {
                    console.error('❌ Fallback also failed:', fallbackError);
                    setCustomerOrders([]);
                }
            } finally {
                setIsLoadingOrders(false);
            }
        };

        fetchCustomerOrders();
    }, [selectedOrder?._id, activeTabId, orderService]);

    const handleSaveTracking = async (
        trackingNumber: string,
        carrier: string,
        selectedItems?: Array<{ id: string, quantity: number }>,
        trackingUrl?: string,
        customCarrierName?: string
    ) => {
        if (!selectedOrder) return;

        setIsProcessingFulfillment(true);

        try {
            const result = await orderService.fulfillOrder({
                orderId: selectedOrder._id,
                trackingNumber,
                shippingProvider: carrier,
                orderNumber: selectedOrder.number,
                sendShippingEmail: true,
                selectedItems: selectedItems || [],
                lineItems: selectedItems || [],
                trackingUrl: trackingUrl,
                customCarrierName: customCarrierName
            });

            if (result.success) {
                // Show success message
                const isPartial = selectedItems && selectedItems.length > 0;
                const message = isPartial
                    ? `Order #${selectedOrder.number} partially fulfilled (${selectedItems.length} items)`
                    : `Order #${selectedOrder.number} fulfilled successfully`;

                const emailNote = result.emailInfo?.emailSentAutomatically
                    ? ' | Confirmation email sent'
                    : ' | No email sent';

                dashboard.showToast({
                    message: message + emailNote,
                    type: 'success'
                });

                // Use the immediate fulfillment result data
                const fulfillmentResult = (result as any).result;
                if (fulfillmentResult?.orderWithFulfillments) {

                    // Update the order with the new fulfillment data
                    const updatedOrder = {
                        ...selectedOrder,
                        rawOrder: {
                            ...selectedOrder.rawOrder,
                            ...fulfillmentResult.orderWithFulfillments,
                            // Ensure fulfillments array is properly set
                            fulfillments: fulfillmentResult.orderWithFulfillments.fulfillments || []
                        }
                    };

                    // Update the store immediately
                    orderStore.updateOrder(updatedOrder);
                    orderStore.selectOrder(updatedOrder);

                    // Also trigger a UI refresh
                    setRefreshTrigger(prev => prev + 1);
                } else {
                    console.warn('⚠️ No fulfillment data in result, doing fallback refresh');
                    // Fallback: try refreshing from API
                    setTimeout(async () => {
                        const refreshedOrder = await orderService.fetchSingleOrder(selectedOrder._id);
                        if (refreshedOrder.success && refreshedOrder.order) {
                            orderStore.updateOrder(refreshedOrder.order);
                            orderStore.selectOrder(refreshedOrder.order);
                        }
                    }, 2000);
                }

            } else {
                throw new Error(result.message || 'Fulfillment failed');
            }

        } catch (error) {
            console.error('❌ OrderDetails: Tracking save failed:', error);
            dashboard.showToast({
                message: `Failed to save tracking: ${error instanceof Error ? error.message : String(error)}`,
                type: 'error'
            });
        } finally {
            setIsProcessingFulfillment(false);
        }
    };

    const handleEditItemTracking = async (itemId: string, fulfillmentId?: string) => {
        if (!selectedOrder) return;

        // For now, we'll open the general tracking modal
        // You could implement item-specific edit logic here later
        // This method is called from the LineItemFulfillmentStatus component
    };

    // Quick fulfill all remaining items
    const handleFulfillAllRemaining = async () => {
        if (!selectedOrder || !fulfillmentCapabilities?.hasUnfulfilledItems) return;

        const unfulfilledItems = getOrderUnfulfilledItems(selectedOrder);

        if (unfulfilledItems.length === 0) {
            dashboard.showToast({
                message: 'No items available for fulfillment',
                type: 'warning'
            });
            return;
        }

        dashboard.showToast({
            message: `Ready to fulfill ${unfulfilledItems.length} remaining items. Please add tracking information.`,
            type: 'standard'
        });
    };

    const handleOrderLinkClick = () => {
        try {
            const order = orderStore.selectedOrder;

            if (!order) {
                console.warn('No order selected for navigation');
                return;
            }

            dashboard.navigate(
                pages.orderDetails({
                    id: order._id
                })
            );

        } catch (error) {
            console.error('Failed to navigate to order details:', error);
            alert(`Order #${selectedOrder?.number || 'unknown'} details are displayed in this panel.`);
        }
    };

    const tabItems = [
        { id: 1, title: 'Order Details' },
        { id: 2, title: 'Order History' }
    ];

    const renderOrderDetailsTab = () => (
        <Box gap="16px" direction="vertical" height="100%" width="100%" overflowY="auto">
            {!selectedOrder ? (
                <Card stretchVertically>
                    <Card.Content>
                        <Box height="100%" minHeight="600px" verticalAlign="middle" align="center">
                            <EmptyState
                                theme="section"
                                title={
                                    <Text weight="normal" size="medium">
                                        No Order Selected
                                    </Text>
                                }
                                subtitle="Click on any order to view and fulfill it"
                                image={<Icons.Package size="48px" style={{ color: '#ccc' }} />}
                            />
                        </Box>
                    </Card.Content>
                </Card>
            ) : (
                <>
                    {/* Main Order Information Card */}
                    <Card>
                        {/* Order Header */}
                        <Card.Header
                            title={
                                <Box direction="horizontal" align="left" gap="16px" style={{ alignItems: 'center' }}>
                                    <Heading
                                        size="medium"
                                        weight="bold"
                                        onClick={handleOrderLinkClick}
                                        style={{
                                            cursor: 'pointer',
                                            color: '#3b82f6',
                                            textDecoration: 'none',
                                            flex: 1
                                        }}
                                    >
                                        Order #{selectedOrder.number}
                                        <Icons.ExternalLink

                                            size="22px"
                                            style={{ padding: '0 0 0 12px', color: '#3b82f6', cursor: 'pointer', marginLeft: 'auto' }}
                                            onClick={handleOrderLinkClick}
                                        />
                                    </Heading>
                                </Box>
                            }
                            subtitle={
                                <Box direction="vertical" gap="8px">
                                    <Text size="small">{formatDate(selectedOrder._createdDate)}</Text>
                                    <Box direction="horizontal" gap="8px" align="left">
                                        <StatusBadge status={selectedOrder.paymentStatus} type="payment" />
                                        <StatusBadge status={selectedOrder.status} type="order" />
                                    </Box>
                                </Box>
                            }
                        />
                        <Card.Divider />

                        <Card.Content>
                            <Box gap="24px" direction="vertical">
                                {/* Customer Information */}
                                {/* <CustomerInfo order={selectedOrder} /> */}
                                <CustomerInfo order={selectedOrder} />

                                {/* Delivery Method Section - Only show if we have title or delivery time */}
                                {(selectedOrder.rawOrder?.shippingInfo?.title || selectedOrder.rawOrder?.shippingInfo?.logistics?.deliveryTime) && (
                                    <>
                                        <Card.Divider />
                                        <Box direction="vertical" gap="4px" align="left">
                                            <Text size="small" className="section-title">Delivery method</Text>
                                            {selectedOrder.rawOrder.shippingInfo.title && (
                                                <Text size="small">
                                                    {selectedOrder.rawOrder.shippingInfo.title}
                                                </Text>
                                            )}
                                            {selectedOrder.rawOrder.shippingInfo.logistics?.deliveryTime && (
                                                <Text size="small">
                                                    {selectedOrder.rawOrder.shippingInfo.logistics.deliveryTime}
                                                </Text>
                                            )}
                                        </Box>
                                    </>
                                )}

                                <Card.Divider />

                                {/* Addresses Section - Side by Side */}
                                <Box direction="horizontal" gap="16px">
                                    {/* Shipping Address */}
                                    <Box flex="1.2">
                                        <ShippingAddress order={selectedOrder} />
                                    </Box>

                                    {/* Billing Address */}
                                    <Box flex="1">
                                        <BillingAddress order={selectedOrder} />
                                    </Box>
                                </Box>

                                {/* Additional Info Section */}
                                <ExtendedFields order={selectedOrder} />

                                <Card.Divider />

                                {/* Product Images with per-item fulfillment */}
                                <ProductImages
                                    order={selectedOrder}
                                    onSaveTracking={handleSaveTracking}
                                    onEditItemTracking={handleEditItemTracking}
                                    onRefreshOrder={async () => {
                                        // Refresh the selected order from the backend
                                        if (selectedOrder?._id) {
                                            await orderController.selectOrderById(selectedOrder._id);
                                        }
                                    }}
                                    isProcessing={isProcessingFulfillment}
                                    fulfillmentCapabilities={fulfillmentCapabilities}
                                />
                            </Box>
                        </Card.Content>
                    </Card>

                    {/* Enhanced Fulfillment Status Card */}
                    {fulfillmentCapabilities && (fulfillmentCapabilities.hasFulfilledItems || fulfillmentCapabilities.isPartiallyFulfilled) && (
                        <Card>
                            <Card.Content>
                                <Box gap="12px" direction="vertical">
                                    <Text size="medium" weight="bold">Fulfillment Status</Text>

                                    <Box
                                        padding="12px"
                                        style={{
                                            backgroundColor: fulfillmentCapabilities.isFullyFulfilled ? '#e8f5e8' : '#fff3e0',
                                            borderRadius: '6px',
                                            border: `1px solid ${fulfillmentCapabilities.isFullyFulfilled ? '#c8e6c9' : '#ffcc80'}`
                                        }}
                                    >
                                        <Box direction="horizontal" align="space-between">
                                            <Box direction="vertical" gap="4px">
                                                <Text size="small" weight="bold">
                                                    {fulfillmentCapabilities.fulfillmentSummary.fulfilledItems}/{fulfillmentCapabilities.fulfillmentSummary.totalItems} items fulfilled
                                                </Text>
                                                {fulfillmentCapabilities.isPartiallyFulfilled && (
                                                    <Text size="tiny" secondary>
                                                        {fulfillmentCapabilities.fulfillmentSummary.remainingItems} items remaining to fulfill
                                                    </Text>
                                                )}
                                                {fulfillmentCapabilities.isFullyFulfilled && (
                                                    <Text size="tiny" secondary style={{ color: '#4caf50' }}>
                                                        Order fully fulfilled
                                                    </Text>
                                                )}
                                            </Box>

                                            {/* Quick Action Buttons */}
                                            {fulfillmentCapabilities.hasUnfulfilledItems && (
                                                <Box direction="horizontal" gap="8px">
                                                    <button
                                                        onClick={handleFulfillAllRemaining}
                                                        disabled={isProcessingFulfillment}
                                                        style={{
                                                            padding: '6px 12px',
                                                            fontSize: '12px',
                                                            backgroundColor: '#2196f3',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            cursor: isProcessingFulfillment ? 'not-allowed' : 'pointer',
                                                            opacity: isProcessingFulfillment ? 0.6 : 1
                                                        }}
                                                    >
                                                        Fulfill Remaining ({fulfillmentCapabilities.fulfillmentSummary.remainingItems})
                                                    </button>
                                                </Box>
                                            )}
                                        </Box>
                                    </Box>
                                </Box>
                            </Card.Content>
                        </Card>
                    )}

                    {/* Buyer Note Card (if exists) */}
                    {selectedOrder.rawOrder?.buyerNote && (
                        <Card>
                            <Card.Content>
                                <Box gap="8px" direction="vertical">
                                    <Text size="small" className="section-title">Buyer Note:</Text>
                                    <Text
                                        size="small"
                                        onClick={() => orderController.copyToClipboard(selectedOrder.rawOrder.buyerNote, 'Buyer Note')}
                                        style={{
                                            cursor: settingsStore.clickToCopyEnabled ? 'pointer' : 'default',
                                            color: settingsStore.clickToCopyEnabled ? 'inherit' : 'var(--text-color, #2B2B2B)'
                                        }}
                                        className={settingsStore.clickToCopyEnabled ? 'clickable-info' : ''}
                                    >
                                        {selectedOrder.rawOrder.buyerNote}
                                    </Text>
                                </Box>
                            </Card.Content>
                        </Card>
                    )}

                    {/* Order Activity Card */}
                    <Card>
                        <Card.Content>
                            <OrderActivity order={selectedOrder} />
                        </Card.Content>
                    </Card>
                </>
            )}
        </Box>
    );

    return (
        <Box width="100%" height="100%" direction="vertical">
            {/* Tabs Navigation */}
            <Box marginBottom="16px">
                <Tabs
                    items={tabItems}
                    type="compactSide"
                    activeId={activeTabId}
                    onClick={(tab) => setActiveTabId(tab.id as number)}
                />
            </Box>

            {/* Tab Content */}
            <Box width="100%" height="100%" maxHeight="calc(100vh - 216px)" overflowY="auto">
                {activeTabId === 1 && (
                    <Box width="100%">
                        {renderOrderDetailsTab()}
                    </Box>
                )}

                {activeTabId === 2 && (
                    <Box direction="vertical" width="100%" gap="16px" minHeight="calc(100vh - 216px)" backgroundColor="white" borderRadius="8px">
                        {/* Order History */}
                        <Card>

                            <Card.Content>
                                {/* <CustomerInfo order={selectedOrder} /> */}
                                <CustomerInfo order={selectedOrder as Order} />
                                <Box paddingTop="24px" align="left">
                                    <Divider />
                                </Box>


                                {isLoadingOrders ? (
                                    <Box paddingTop="24px" align="left" direction="horizontal" gap="8px" style={{ alignItems: 'center' }}>
                                        <Loader size="tiny" />
                                        <Text size="small">Loading Order History...</Text>
                                    </Box>
                                ) : customerOrders.length === 0 ? (
                                    <Box padding="24px" align="center" direction="vertical" gap="8px">
                                        <Icons.Order size="26px" style={{ color: '#ccc' }} />
                                        <Text size="medium">First-time Customer</Text>
                                        <Text size="small" secondary>
                                            This is the customer's first order.
                                        </Text>
                                    </Box>
                                ) : (
                                    <Box direction="vertical" gap="0">
                                        {customerOrders.map((order, index) => (
                                            <div
                                                key={order._id}
                                                style={{
                                                    borderBottom: index < customerOrders.length - 1 ? '1px solid #e5e7eb' : 'none',
                                                    cursor: 'pointer',
                                                    padding: '16px 0'
                                                }}
                                                onClick={() => {
                                                    try {
                                                        dashboard.navigate(
                                                            pages.orderDetails({
                                                                id: order._id
                                                            })
                                                        );
                                                    } catch (error) {
                                                        console.error('Navigation failed:', error);
                                                        window.location.href = `/orders/${order._id}`;
                                                    }
                                                }}
                                            >
                                                <Box direction="horizontal" align="space-between" verticalAlign="middle">
                                                    <Box direction="vertical" gap="4px">
                                                        <Box direction="horizontal" gap="8px" align="center">
                                                            <Text size="small" weight="normal">#{order.number}</Text>
                                                            <StatusBadge status={order.paymentStatus} type="payment" />
                                                            <StatusBadge status={order.status} type="order" />
                                                        </Box>
                                                        <Text size="tiny" secondary>{formatDate(order._createdDate)}</Text>
                                                    </Box>
                                                    <Box direction="horizontal" gap="12px" align="center">
                                                        <Text size="small" >{order.total}</Text>
                                                        <Icons.ChevronRight size="20px" style={{ color: '#333' }} />
                                                    </Box>
                                                </Box>
                                            </div>
                                        ))}
                                    </Box>
                                )}
                            </Card.Content>
                        </Card>
                    </Box>
                )}
            </Box>
        </Box>
    );
});