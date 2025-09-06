// components/OrderDetails/OrderDetails.tsx - ENHANCED with per-item fulfillment

import React, { useState, useEffect, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { Card, Box, Text, Heading, Tabs, EmptyState, Divider, Loader, Button, IconButton, Tooltip } from '@wix/design-system';
import * as Icons from '@wix/wix-ui-icons-common';
import { useStores } from '../../hooks/useStores';
import { settingsStore } from '../../stores/SettingsStore';
import { useOrderController } from '../../hooks/useOrderController';
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
    OrderStatus,
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

    // Auto-select oldest unfulfilled order if none selected but orders exist
    useEffect(() => {
        if (!selectedOrder && orderStore.orders.length > 0) {
            // Find the oldest unfulfilled order
            const unfulfilledOrders = orderStore.orders.filter(order => 
                order.status === 'NOT_FULFILLED' || order.status === 'PARTIALLY_FULFILLED'
            );
            
            if (unfulfilledOrders.length > 0) {
                // Sort by creation date (oldest first)
                const oldestUnfulfilled = unfulfilledOrders.sort((a, b) => 
                    new Date(a._createdDate).getTime() - new Date(b._createdDate).getTime()
                )[0];
                orderController.selectOrder(oldestUnfulfilled);
            } else {
                // If no unfulfilled orders, fall back to most recent order
                const mostRecentOrder = orderStore.orders[0];
                orderController.selectOrder(mostRecentOrder);
            }
        }
    }, [selectedOrder, orderStore.orders.length, orderController]);

    useEffect(() => {
        const fetchCustomerOrders = async () => {
            if (!selectedOrder || activeTabId !== 2) return;

            // Get customer email
            const customerEmail = selectedOrder.rawOrder?.buyerInfo?.email ||
                selectedOrder.customer?.email ||
                selectedOrder.buyerInfo?.email;

// Debug log removed

            if (!customerEmail) {
                console.warn('No customer email found');
                return;
            }

            setIsLoadingOrders(true);
            try {
                // Use proper Wix ecom API filtering with correct types
                const { orders } = await import('@wix/ecom');

// Debug log removed

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

// Debug log removed

                if (result.orders && result.orders.length > 0) {
                    // Include ALL orders (including the current one) and sort by date
                    const allOrders = result.orders
                        .map(order => ({
                            _id: order._id,
                            number: order.number,
                            _createdDate: order._createdDate,
                            total: order.priceSummary?.total?.formattedAmount || '€0.00',
                            status: order.fulfillmentStatus || 'NOT_FULFILLED',
                            paymentStatus: order.paymentStatus || 'UNPAID',
                            rawOrder: order,
                        }))
                        .sort((a, b) => {
                            const dateA = a._createdDate ? new Date(a._createdDate).getTime() : 0;
                            const dateB = b._createdDate ? new Date(b._createdDate).getTime() : 0;
                            return dateB - dateA; // Sort by newest first
                        });
// Debug log removed
                    console.log('📋 Orders:', allOrders.map(o => `#${o.number} (${o.total})`));

                    setCustomerOrders(allOrders);

                } else {
// Debug log removed
                    setCustomerOrders([]);
                }

            } catch (apiError) {
                console.error('❌ Wix API failed:', apiError);

                // If the filter doesn't work, try without the filter and manual filtering
// Debug log removed
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

// Debug log removed
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

                    // Wait a moment for Wix backend to process the fulfillment
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    
                    // Transform the order with fulfillment data through OrderService to ensure proper status calculation
                    const transformedOrder = await orderService.fetchSingleOrder(selectedOrder._id);
                    
                    if (transformedOrder.success && transformedOrder.order) {
                        // Update the store with the freshly transformed order
                        orderStore.updateOrder(transformedOrder.order);
                        orderStore.selectOrder(transformedOrder.order);
                    } else {
                        // Fallback: manual update with status recalculation
                        const updatedOrder = {
                            ...selectedOrder,
                            rawOrder: {
                                ...selectedOrder.rawOrder,
                                ...fulfillmentResult.orderWithFulfillments,
                                // Ensure fulfillments array is properly set
                                fulfillments: fulfillmentResult.orderWithFulfillments.fulfillments || []
                            }
                        };

                        // Recalculate status based on fulfillment data
                        const lineItems = updatedOrder.rawOrder?.lineItems || [];
                        let totalQuantity = 0;
                        let fulfilledQuantity = 0;
                        
                        lineItems.forEach((item: any) => {
                            const quantity = item.quantity || 1;
                            const fulfilled = item.fulfilledQuantity || 0;
                            totalQuantity += quantity;
                            fulfilledQuantity += fulfilled;
                        });
                        
                        // Determine correct status
                        let newStatus = 'NOT_FULFILLED';
                        if (fulfilledQuantity >= totalQuantity && totalQuantity > 0) {
                            newStatus = 'FULFILLED';
                        } else if (fulfilledQuantity > 0) {
                            newStatus = 'PARTIALLY_FULFILLED';
                        }
                        
                        const finalOrder = {
                            ...updatedOrder,
                            status: newStatus as OrderStatus
                        };

                        // Update the store with corrected status
                        orderStore.updateOrder(finalOrder);
                        orderStore.selectOrder(finalOrder);
                    }

                    // Also trigger a UI refresh
                    setRefreshTrigger(prev => prev + 1);
                } else {
                    // Fallback: try refreshing from API to ensure status is updated
                    setTimeout(async () => {
                        const refreshedOrder = await orderService.fetchSingleOrder(selectedOrder._id);
                        if (refreshedOrder.success && refreshedOrder.order) {
                            orderStore.updateOrder(refreshedOrder.order);
                            orderStore.selectOrder(refreshedOrder.order);
                            setRefreshTrigger(prev => prev + 1);
                        }
                    }, 2500);
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
        <Box gap="16px" direction="vertical" minHeight="calc(100vh - 216px)" width="100%" overflowY="auto" borderRadius="8px">
            {(!selectedOrder && orderStore.orders.length === 0) ? (
                <Card stretchVertically>
                    <Card.Content>
                        <Box height="100%" verticalAlign="middle" align="center" borderRadius="8px">
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
            ) : selectedOrder ? (
                <>
                    {/* Main Order Information Card */}
                    <Card>
                        <Card.Header
                            title={
                                <Heading
                                    size="medium"

                                    weight="bold"
                                    onClick={handleOrderLinkClick}
                                    style={{
                                        cursor: 'pointer',
                                        color: '#3b82f6',
                                        textDecoration: 'none',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                    }}
                                >
                                    <Box gap="8px" direction="horizontal">
                                        Order #{selectedOrder?.number}

                                        <Tooltip content="View Order" placement="top">
                                            <Icons.ExternalLinkSmall
                                                size="18px"
                                                style={{ color: '#3b82f6', cursor: 'pointer' }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOrderLinkClick();
                                                }}
                                            />
                                        </Tooltip>
                                    </Box>
                                </Heading>
                            }
                            suffix={
                                <Tooltip content="Edit Order" placement="top">
                                    <IconButton
                                        size="small"
                                        priority="secondary"
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (selectedOrder?._id) {
                                                try {
                                                    await dashboard.navigate(
                                                        pages.editOrder({
                                                            orderId: selectedOrder._id
                                                        })
                                                    );
                                                } catch (error) {
                                                    console.error('Failed to navigate to edit order:', error);
                                                    // Fallback to URL-based navigation if SDK navigation fails
                                                    const siteId = new URLSearchParams(window.location.search).get('instance');
                                                    if (siteId) {
                                                        window.open(`https://manage.wix.com/dashboard/${siteId}/ecom-platform/order-details/${selectedOrder._id}`, '_blank');
                                                    }
                                                }
                                            }
                                        }}
                                    >
                                        <Icons.Compose size="16px" />
                                    </IconButton>
                                </Tooltip>
                            }
                            subtitle={
                                <Box direction="vertical" gap="8px">
                                    <Text size="small">{formatDate(selectedOrder?._createdDate || '', settingsStore.showTimeInDates)}</Text>
                                    <Box direction="horizontal" gap="8px" align="left">
                                        <StatusBadge status={selectedOrder?.paymentStatus || 'NOT_FULFILLED'} type="payment" />
                                        <StatusBadge status={selectedOrder?.status || 'NOT_FULFILLED'} type="order" />
                                    </Box>
                                </Box>
                            }
                        />
                        <Card.Divider />

                        <Card.Content>
                            <Box gap="24px" direction="vertical" borderRadius="8px">
                                {/* Customer Information */}
                                {/* <CustomerInfo order={selectedOrder} /> */}
                                <CustomerInfo order={selectedOrder} />

                                {/* Delivery Method Section - Only show if we have title or delivery time */}
                                {(selectedOrder?.rawOrder?.shippingInfo?.title || selectedOrder?.rawOrder?.shippingInfo?.logistics?.deliveryTime) && (
                                    <>
                                        <Card.Divider />
                                        <Box direction="vertical" gap="4px" align="left">
                                            <Text size="small" className="section-title">Delivery method</Text>
                                            {selectedOrder?.rawOrder?.shippingInfo?.title && (
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


                    {/* Order Activity Card */}
                    <Card>
                        <Card.Content>
                            <OrderActivity order={selectedOrder} />
                        </Card.Content>
                    </Card>
                </>
            ) : null}
        </Box>
    );

    return (
        <Box width="100%" height="100%" direction="vertical" borderRadius="8px">
            {/* Tabs Navigation */}
            <Box marginBottom="16px">
                <Tabs
                    items={tabItems}
                    type="compactSide"
                    activeId={activeTabId}
                    onClick={(tab) => setActiveTabId(tab.id as number)}
                />
                {/* Hide scrollbar for Chrome, Safari and Opera */}
                <style>
                    {`
                        ::-webkit-scrollbar {
                            display: none;
                        }
                    `}
                </style>
            </Box>

            {/* Tab Content */}
            <Box width="100%" height="100%" maxHeight="calc(100vh - 216px)" overflowY="auto" borderRadius="8px" style={{
                scrollbarWidth: 'none',  /* Firefox */
                msOverflowStyle: 'none',  /* IE and Edge */
            }}>
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
                                    <Box paddingTop="24px" align="left" direction="horizontal" borderRadius="8px" gap="8px" style={{ alignItems: 'center' }}>
                                        <Loader size="tiny" />
                                        <Text size="small">Loading Order History...</Text>
                                    </Box>
                                ) : !isLoadingOrders && (
                                    <Box paddingTop="16px" direction="vertical" borderRadius="8px" gap="8px" paddingBottom="24px">
                                        <Text size="medium" weight="normal">
                                            Order History ({customerOrders.length} order{customerOrders.length !== 1 ? 's' : ''})
                                        </Text>
                                        <Text size="small" secondary>
                                            Total Spent: {(() => {
                                                const total = customerOrders.reduce((sum, order) => {
                                                    const orderTotal = parseFloat(order.total.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
                                                    return sum + orderTotal;
                                                }, 0);
                                                return `€${total.toFixed(2)}`;
                                            })()}
                                        </Text>
                                    </Box>
                                )}

                                {!isLoadingOrders && customerOrders.length === 0 ? (
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
                                                    <Box direction="vertical" gap="8px" align="left">
                                                        <Box direction="horizontal" gap="8px" align="left">
                                                            <Text size="small" weight="normal">#{order.number}</Text>
                                                            <StatusBadge status={order.paymentStatus} type="payment" />
                                                            <StatusBadge status={order.status} type="order" />
                                                        </Box>
                                                        <Text size="tiny" secondary>{formatDate(order._createdDate, settingsStore.showTimeInDates)}</Text>
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