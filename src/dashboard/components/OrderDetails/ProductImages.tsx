// components/OrderDetails/ProductImages.tsx - ENHANCED with proper button logic and per-item fulfillment

import React, { useState, useEffect } from 'react';
import { Box, Text, Button, TextButton, Divider } from '@wix/design-system';
import { TrackingNumberModal } from '../TrackingNumberModal/TrackingNumberModal';
import { IMAGE_CONTAINER_STYLE, PLACEHOLDER_STYLE, IMAGE_STYLE } from '../../utils/constants';
import { processWixImageUrl } from '../../utils/image-processor';
import { orderTransactions } from '@wix/ecom';
import { settingsStore } from '../../stores/SettingsStore';
import { observer } from 'mobx-react-lite';
import type { Order, OrderFulfillmentCapabilities } from '../../types/Order';
import { LineItemFulfillmentStatus } from './LineItemFulfillmentStatus';
import { ItemTrackingDisplay } from './ItemTrackingDisplay';
import { getSiteIdFromContext } from '../../utils/get-siteId';
import { dashboard } from '@wix/dashboard';
import { pages } from '@wix/ecom/dashboard';

interface LineItemWithFulfillment {
    _id?: string;
    id?: string;
    productName?: { original: string };
    quantity: number;
    price?: { formattedAmount: string };
    image?: string;
    productOptions?: any;
    descriptionLines?: any;
    catalogReference?: any;
    physicalProperties?: {
        sku?: string;
        weight?: number;
    };
    fulfilledQuantity?: number;
    remainingQuantity?: number;
    fulfillmentStatus?: 'FULFILLED' | 'PARTIALLY_FULFILLED' | 'NOT_FULFILLED';
    fulfillmentDetails?: {
        lineItemFulfillment?: Array<{
            quantity: number;
            fulfillmentId: string;
            trackingNumber?: string;
            trackingUrl?: string;
            carrier?: string;
            fulfillmentDate?: string;
        }>;
        trackingInfo?: Array<{
            trackingNumber: string;
            trackingUrl?: string;
            carrier?: string;
            quantity: number;
        }>;
    };
}



interface ProductImagesProps {
    order: Order & {
        weightUnit?: string;
        rawOrder?: {
            lineItems?: LineItemWithFulfillment[];
            fulfillments?: any[];
            priceSummary?: {
                subtotal?: { formattedAmount: string };
                shipping?: { formattedAmount: string };
                tax?: { formattedAmount: string };
                discount?: {
                    amount: number;
                    formattedAmount: string;
                    currency?: string;
                };
                total?: { formattedAmount: string };
            };
            appliedDiscounts?: Array<{
                discountName?: string;
                name?: string;
                coupon?: {
                    name?: string;
                };
            }>;
            channelInfo?: {
                type?: string;
                externalOrderId?: string;
                externalOrderUrl?: string;
            };
            additionalFees?: Array<{
                _id?: string;
                name?: string;
                price?: {
                    formattedAmount: string;
                };
            }>;
            attributionSource?: string;
        };
    };
    onSaveTracking?: (trackingNumber: string, carrier: string, selectedItems?: Array<{ id: string, quantity: number }>, trackingUrl?: string, customCarrierName?: string) => Promise<void>;
    onEditItemTracking?: (itemId: string, fulfillmentId?: string) => void;
    onRefreshOrder?: () => Promise<void>;
    isProcessing?: boolean;
    fulfillmentCapabilities?: any; // Replace 'any' with the correct type if available
}

const ProductImages: React.FC<ProductImagesProps> = observer(({
    order,
    onSaveTracking,
    onEditItemTracking,
    onRefreshOrder,
    isProcessing = false,
    fulfillmentCapabilities
}) => {
    const [paymentMethod, setPaymentMethod] = useState<string>('');
    const [loadingPayment, setLoadingPayment] = useState<boolean>(false);
    const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isUpdateMode, setIsUpdateMode] = useState(false);
    const [selectedItemForEdit, setSelectedItemForEdit] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [hasAnyTrackingDisplayed, setHasAnyTrackingDisplayed] = useState(false);
    const [allItemsHaveTracking, setAllItemsHaveTracking] = useState(false);
    // Refresh order data when refresh trigger changes
    useEffect(() => {
        if (refreshTrigger > 0 && onRefreshOrder) {
            onRefreshOrder();
        }
    }, [refreshTrigger, onRefreshOrder]);

    // Reset tracking state when order changes
    useEffect(() => {
        setHasAnyTrackingDisplayed(false);
        setAllItemsHaveTracking(false);
    }, [order._id]);

    const handleSaveTracking = async (trackingNumber: string, carrier: string, selectedItems?: Array<{ id: string, quantity: number }>, trackingUrl?: string, customCarrierName?: string) => {
        try {
            console.log('Saving tracking:', {
                trackingNumber,
                carrier,
                orderId: order._id,
                isEdit: isEditMode,
                isUpdate: isUpdateMode,
                selectedItemForEdit,
                selectedItems,
                trackingUrl,
                customCarrierName,
                hasUpdateMetadata: !!(selectedItems as any)?.isUpdate
            });

            // Check if this is an update operation
            const isUpdateOperation = (selectedItems as any)?.isUpdate;
            const fulfillmentId = (selectedItems as any)?.fulfillmentId;

            if (isUpdateOperation && fulfillmentId) {

                // Call the update tracking backend method directly
                const { updatePerItemTracking } = await import('../../../backend/fulfillment-per-item.web');

                const updateResult = await updatePerItemTracking({
                    orderId: order._id,
                    fulfillmentId: fulfillmentId,
                    trackingNumber: trackingNumber,
                    shippingProvider: carrier,
                    orderNumber: order.number,
                    sendShippingEmail: true,
                    customCarrierName: customCarrierName
                });

                if (!updateResult.success) {
                    const errorMessage = 'error' in updateResult ? updateResult.error : 'Failed to update tracking';
                    throw new Error(errorMessage || 'Failed to update tracking');
                }

            } else {
                // Regular create flow
                if (onSaveTracking) {
                    const cleanSelectedItems = isUpdateOperation ? undefined : selectedItems;
                    await onSaveTracking(trackingNumber, carrier, cleanSelectedItems, trackingUrl, customCarrierName);
                }
            }

            // Force a refresh of the order data to get updated fulfillments
            setRefreshTrigger(prev => prev + 1);

            // Add a small delay to ensure backend has processed the fulfillment
            setTimeout(async () => {
                // Force another refresh to ensure we have the latest data
                setRefreshTrigger(prev => prev + 1);

                // If we have a refresh callback, call it to ensure the order status is updated
                if (onRefreshOrder) {
                    await onRefreshOrder();
                }
            }, 1000);

            // Close the modal and reset state
            setIsTrackingModalOpen(false);
            setIsEditMode(false);
            setIsUpdateMode(false);
            setSelectedItemForEdit(null);
        } catch (error) {
            console.error('Failed to save tracking:', error);
            // Error handling is done in the parent component
            throw error;
        }
    };

    const handleProductImageClick = (item: LineItemWithFulfillment) => {
        try {
            const productId = item.catalogReference?.catalogItemId ||
                item.catalogReference?.productId ||
                item._id;

            if (!productId) {
                console.error('Product ID not found for item:', item);
                return;
            }

            dashboard.navigate({
                pageId: '0845ada2-467f-4cab-ba40-2f07c812343d',
                relativeUrl: `/product/${productId}`
            });

        } catch (error) {
            console.error('Failed to navigate to product page:', error);
        }
    };

    const getExistingTrackingInfo = () => {
        const trackingInfo: Array<{
            trackingNumber: string,
            carrier?: string,
            quantity?: number,
            itemId?: string,
            itemName?: string
        }> = [];

        order.rawOrder?.lineItems?.forEach((item: any) => {
            const itemId = item._id || item.id || '';
            const itemName = typeof item.productName === 'object'
                ? item.productName.original
                : item.productName || 'Product';

            // Check trackingInfo array
            item.fulfillmentDetails?.trackingInfo?.forEach((tracking: any) => {
                if (tracking.trackingNumber) {
                    trackingInfo.push({
                        trackingNumber: tracking.trackingNumber,
                        carrier: tracking.carrier,
                        quantity: tracking.quantity,
                        itemId,
                        itemName
                    });
                }
            });

            // Check lineItemFulfillment array
            item.fulfillmentDetails?.lineItemFulfillment?.forEach((fulfillment: any) => {
                if (fulfillment.trackingNumber) {
                    trackingInfo.push({
                        trackingNumber: fulfillment.trackingNumber,
                        carrier: fulfillment.carrier,
                        quantity: fulfillment.quantity,
                        itemId,
                        itemName
                    });
                }
            });
        });

        return trackingInfo;
    };

    const handleAddTracking = () => {
        setIsEditMode(false);
        setIsUpdateMode(false);
        setSelectedItemForEdit(null);
        setIsTrackingModalOpen(true);
    };

    const handleEditTracking = () => {
        setIsEditMode(true);
        setIsUpdateMode(true);
        setSelectedItemForEdit(null);
        setIsTrackingModalOpen(true);
    };

    const handleEditIndividualTracking = (itemId: string) => {
        setIsEditMode(true);
        setIsUpdateMode(false);
        setSelectedItemForEdit(itemId);
        setIsTrackingModalOpen(true);
    };

    // Fetch payment method when order changes
    useEffect(() => {
        const fetchPaymentMethod = async () => {
            if (!order._id) return;

            try {
                setLoadingPayment(true);
                const response = await orderTransactions.listTransactionsForSingleOrder(order._id);
                const payments = response.orderTransactions?.payments || [];

                if (payments.length > 0) {
                    const firstPayment = payments[0];
                    let method = 'Unknown';

                    if (firstPayment.giftcardPaymentDetails) {
                        method = 'Gift Card';
                    } else if (firstPayment.regularPaymentDetails?.paymentMethod) {
                        method = firstPayment.regularPaymentDetails.paymentMethod;
                    }

                    setPaymentMethod(method);
                } else {
                    setPaymentMethod('No payment found');
                }
            } catch (error) {
                console.error('Error fetching payment method:', error);
                setPaymentMethod('Error loading payment method');
            } finally {
                setLoadingPayment(false);
            }
        };

        fetchPaymentMethod();
    }, [order._id]);

    const getDiscountDisplayText = (): string => {
        const appliedDiscounts = order.rawOrder?.appliedDiscounts || [];
        if (appliedDiscounts.length === 0) return 'Discount:';

        // Try to get coupon names first
        const couponNames = appliedDiscounts
            .filter((discount: any) => discount.coupon?.name)
            .map((discount: any) => discount.coupon?.name);

        if (couponNames.length > 0) {
            return `Coupon: ${[...new Set(couponNames)].join(', ')}`;
        }

        // Fall back to other discount properties
        const discountNames = appliedDiscounts
            .map((discount: any) => discount.discountName || discount.name || null)
            .filter((name: any): name is string => !!name && name !== 'Discount');

        if (discountNames.length > 0) {
            return `Discount: ${[...new Set(discountNames)].join(', ')}`;
        }

        return 'Discount:';
    };


    const formatPaymentMethod = (method: string): string => {
        switch (method) {
            case 'CreditCard': return 'Credit Card';
            case 'PayPal': return 'PayPal';
            case 'Cash': return 'Cash';
            case 'Offline': return 'Offline Payment';
            case 'InPerson': return 'In Person';
            case 'PointOfSale': return 'Point of Sale';
            default: return method || 'Unknown';
        }
    };

    const formatChannelType = (type?: string): string => {
        switch (type) {
            case 'AMAZON': return 'Amazon';
            case 'BACKOFFICE_MERCHANT': return 'Wix Backoffice';
            case 'CLASS_PASS': return 'ClassPass';
            case 'EBAY': return 'eBay';
            case 'ETSY': return 'Etsy';
            case 'FACEBOOK': return 'Facebook';
            case 'FAIRE_COM': return 'Faire';
            case 'GLOBAL_E': return 'Global-E';
            case 'OTHER_PLATFORM': return 'Other Platform';
            case 'POS': return 'Point of Sale';
            case 'TIKTOK': return 'TikTok';
            case 'WIX_APP_STORE': return 'Wix App Store';
            case 'WIX_INVOICES': return 'Wix Invoices';
            case 'WISH': return 'Wish';
            case 'WEB': return 'Web';
            case 'UNSPECIFIED':
            default: return 'Unspecified';
        }
    };

    if (!order.rawOrder?.lineItems?.length) {
        return (
            <Box gap="8px" direction="vertical">
                <Text size="small" className="section-title">Products</Text>
                <Text size="tiny" secondary>No products found</Text>
            </Box>
        );
    }

    return (
        <Box gap="8px" direction="vertical" align="space-between">
            <Box
                gap="8px"
                direction="horizontal"
                align="space-between"
                marginBottom="8px"
                style={{
                    borderRadius: '4px'
                }}
            >
                <Text size="small" className="section-title">Products:</Text>

                <Box direction="horizontal" gap="8px" align="right">
                    {/* Show Edit button only if any tracking is being displayed */}
                    {hasAnyTrackingDisplayed && (
                        <Button
                            size="tiny"
                            priority="secondary"
                            skin="standard"
                            onClick={handleEditTracking}
                        >
                            Edit Tracking No.
                        </Button>
                    )}

                    {/* Show Add button only if NOT all items have tracking */}
                    {!allItemsHaveTracking && (
                        <Button
                            size="tiny"
                            priority="primary"
                            onClick={handleAddTracking}
                        >
                            Add Tracking No.
                        </Button>
                    )}

                    {/* Hidden tracker component */}
                    <TrackingButtonController
                        order={order}
                        onTrackingFound={() => setHasAnyTrackingDisplayed(true)}
                        onAllItemsTracked={() => setAllItemsHaveTracking(true)}
                    />
                </Box>

                <TrackingNumberModal
                    isOpen={isTrackingModalOpen}
                    onClose={() => {
                        setIsTrackingModalOpen(false);
                        setIsEditMode(false);
                        setIsUpdateMode(false);
                        setSelectedItemForEdit(null);
                    }}
                    order={{
                        ...order,
                        items: order.rawOrder?.lineItems?.map((item: any) => ({
                            ...item,
                            name: typeof item.productName === 'object'
                                ? item.productName.original
                                : item.productName || 'Product',
                            quantity: item.quantity,
                            fulfilledQuantity: item.fulfilledQuantity || 0,
                            remainingQuantity: (item.quantity || 1) - (item.fulfilledQuantity || 0),
                            physicalProperties: {
                                sku: item.physicalProperties?.sku || item.catalogReference?.catalogItemId
                            }
                        })) || []
                    }}
                    onSave={handleSaveTracking}
                    editMode={isEditMode}
                    updateMode={isUpdateMode}
                    // isPartialOrder={fulfillmentStatus.isPartial}
                    existingTrackingInfo={isEditMode ? (() => {
                        const tracking = getExistingTrackingInfo()[0];
                        return tracking ? {
                            trackingNumber: tracking.trackingNumber,
                            carrier: tracking.carrier || 'Other'
                        } : undefined;
                    })() : undefined}
                />
            </Box>

            <Box direction="vertical" gap="16px" style={{ width: '100%' }}>
                {order.rawOrder.lineItems.map((item: any, index: any) => {
                    const itemImage = item.image ? processWixImageUrl(item.image) : '';
                    const itemName = item.productName?.original || `Item ${index + 1}`;
                    const itemPrice = item.price?.formattedAmount || '$0.00';
                    const itemQuantity = item.quantity || 1;
                    const fulfilledQuantity = item.fulfilledQuantity || 0;
                    const remainingQuantity = itemQuantity - fulfilledQuantity;

                    return (
                        <Box key={item._id || index} direction="vertical" gap="8px" width="100%">
                            <Box direction="horizontal" gap="12px" width="100%">

                                {/* Product Image - Enhanced with click functionality */}
                                {itemImage ? (
                                    <div
                                        style={IMAGE_CONTAINER_STYLE}
                                        onClick={() => handleProductImageClick(item)}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'scale(1.03)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'scale(1)';
                                        }}
                                        title="Edit product"
                                    >
                                        <img
                                            src={itemImage}
                                            alt={itemName}
                                            style={IMAGE_STYLE}
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                const altUrl = `https://static.wixstatic.com/media/${item.image?.replace('wix:image://v1/', '').split('#')[0]}`;
                                                if (target.src !== altUrl) {
                                                    target.src = altUrl;
                                                }
                                            }}
                                            loading="lazy"
                                        />
                                    </div>
                                ) : (
                                    <div
                                        style={PLACEHOLDER_STYLE}
                                        onClick={() => handleProductImageClick(item)}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'scale(1.05)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'scale(1)';
                                        }}
                                        title="Edit product"
                                    >
                                        <Text size="tiny" secondary>📦</Text>
                                    </div>
                                )}


                                {/* Product Details */}
                                <Box direction="vertical" gap="3px" style={{ flex: 1, minWidth: 0 }}>
                                    <Box direction="vertical" gap="4px" style={{ width: '100%' }}>
                                        <Box direction="horizontal" align="space-between" style={{ width: '100%' }}>
                                            <Text size="tiny" weight="normal">
                                                {itemName}
                                            </Text>
                                            <Text size="tiny" weight="normal" align="right">
                                                {itemPrice}
                                            </Text>
                                        </Box>

                                        {/* Per-Item Tracking Information */}
                                        <ItemTrackingDisplay
                                            orderId={order._id}
                                            itemId={item._id || item.id || ''}
                                            refreshTrigger={refreshTrigger}
                                        />

                                        {/* ENHANCED: Quantity with fulfillment info */}
                                        <Box direction="horizontal" gap="8px" align="left">
                                            <Text size="tiny">
                                                Qty: {itemQuantity}
                                            </Text>
                                            {fulfilledQuantity > 0 && (
                                                <Text size="tiny" secondary>
                                                    ({fulfilledQuantity} fulfilled, {remainingQuantity} remaining)
                                                </Text>
                                            )}
                                        </Box>

                                        <Box direction="horizontal" align="space-between" style={{ width: '100%' }}>
                                            {/* Product Options - Left Aligned */}
                                            <Box direction="vertical" gap="2px" marginTop="4px">
                                                {item.descriptionLines?.map((line: any, index: any) => {
                                                    if (line.lineType === 'COLOR') {
                                                        return (
                                                            <Text key={`${index}-color`} size="tiny" secondary>
                                                                {line.name?.original || 'Color'}: {line.color}
                                                            </Text>
                                                        );
                                                    } else if (line.lineType === 'PLAIN_TEXT' && line.plainText?.original) {
                                                        return (
                                                            <Text key={`${index}-plain`} size="tiny" secondary>
                                                                {line.name?.original || 'Option'}: {line.plainText.original}
                                                            </Text>
                                                        );
                                                    }
                                                    return null;
                                                }) || null}
                                            </Box>
                                        </Box>
                                    </Box>

                                    {/* ENHANCED: Fulfillment Status */}
                                    <Box direction="horizontal" gap="8px" align="center">
                                        {item.fulfillmentStatus && (
                                            <LineItemFulfillmentStatus
                                                item={{
                                                    fulfillmentStatus: item.fulfillmentStatus,
                                                    fulfilledQuantity: item.fulfilledQuantity,
                                                    remainingQuantity: remainingQuantity,
                                                    quantity: item.quantity,
                                                    fulfillmentDetails: item.fulfillmentDetails,
                                                    _id: item._id || item.id || ''
                                                }}
                                            />
                                        )}

                                        {/* Individual item edit button for items with tracking */}
                                        {item.fulfillmentDetails?.trackingInfo?.length > 0 && (
                                            <Button
                                                size="tiny"
                                                priority="secondary"
                                                onClick={() => handleEditIndividualTracking(item._id || item.id)}

                                                style={{ fontSize: '10px', padding: '2px 8px' }}
                                            >
                                                Edit Item Tracking
                                            </Button>
                                        )}
                                    </Box>

                                    {/* SKU */}
                                    {settingsStore.showSKU && (item.catalogReference?.catalogItemId || item.physicalProperties?.sku) && (
                                        <Text size="tiny" secondary>
                                            SKU: {item.physicalProperties?.sku || item.catalogReference?.catalogItemId}
                                        </Text>
                                    )}

                                    {/* Individual Weight - User-friendly version */}
                                    {settingsStore.showIndividualWeights && (
                                        <Text size="tiny" secondary>
                                            Weight: {
                                                item.physicalProperties?.weight !== undefined && item.physicalProperties?.weight > 0
                                                    ? `${item.physicalProperties.weight.toFixed(2)} ${order.weightUnit || 'kg'}`
                                                    : 'Not specified'
                                            }
                                        </Text>
                                    )}
                                </Box>
                            </Box>
                        </Box>
                    );
                })}
            </Box>

            {/* Summary Section - Rest of the component remains the same */}
            <Box paddingTop="16px" direction="vertical" gap="8px">
                {/* Total Weight */}
                {settingsStore.showTotalWeight && (
                    <Box direction="horizontal" align="space-between">
                        <Text size="tiny">Total weight:</Text>
                        <Text size="tiny">
                            {(order.rawOrder.lineItems.reduce((total: any, item: any) => {
                                const itemWeight = item.physicalProperties?.weight || 0;
                                const quantity = item.quantity || 1;
                                return total + (itemWeight * quantity);
                            }, 0) || 0).toFixed(2)} {order.weightUnit || 'kg'}
                        </Text>
                    </Box>
                )}

                <Box style={{ borderTop: '1px dashed #e0e0e0', margin: '8px 0' }} />

                {/* Price Breakdown */}
                <Box direction="horizontal" align="space-between">
                    <Text size="tiny" align="left">Items:</Text>
                    <Text size="tiny">{order.rawOrder?.priceSummary?.subtotal?.formattedAmount || '$0.00'}</Text>
                </Box>

                <Box direction="horizontal" align="space-between">
                    <Text size="tiny" align="left">Shipping:</Text>
                    <Text size="tiny">{order.rawOrder?.priceSummary?.shipping?.formattedAmount || '$0.00'}</Text>
                </Box>

                <Box direction="horizontal" align="space-between">
                    <Text size="tiny" align="left">Tax:</Text>
                    <Text size="tiny">{order.rawOrder?.priceSummary?.tax?.formattedAmount || '$0.00'}</Text>
                </Box>

                {/* Additional Fees */}
                {order.rawOrder?.additionalFees?.map((fee: any, index: any) => (
                    <Box key={fee._id || index} direction="horizontal" align="space-between">
                        <Text size="tiny" align="left">
                            {fee.name || 'Additional Fee'}:
                        </Text>
                        <Text size="tiny">
                            {fee.price?.formattedAmount || '$0.00'}
                        </Text>
                    </Box>
                ))}

                {/* Discount */}
                {order.rawOrder?.priceSummary?.discount?.amount &&
                    order.rawOrder.priceSummary.discount.amount > 0 && (
                        <Box direction="horizontal" align="space-between">
                            <Text size="tiny">
                                {getDiscountDisplayText()}
                            </Text>
                            <Text size="tiny">
                                -{order.rawOrder.priceSummary.discount.formattedAmount ||
                                    `${order.rawOrder.priceSummary.discount.amount} ${order.rawOrder.priceSummary.discount.currency || ''}`}
                            </Text>
                        </Box>
                    )}

                {/* Total */}
                <Box direction="horizontal" align="space-between" style={{ paddingTop: '8px' }}>
                    <Text size="tiny" align="left" weight="bold">Total:</Text>
                    <Text size="tiny" weight="bold">
                        {order.rawOrder?.priceSummary?.total?.formattedAmount || '$0.00'}
                    </Text>
                </Box>

                <Box style={{ borderTop: '1px dashed #e0e0e0', margin: '8px 0' }} />

                {/* Payment Method */}
                <Box direction="horizontal" align="space-between" style={{ paddingTop: '4px' }}>
                    <Text size="tiny" align="left">Payment Method:</Text>
                    <Text size="tiny">
                        {loadingPayment ? 'Loading...' : formatPaymentMethod(paymentMethod)}
                    </Text>
                </Box>

                {/* Channel Information */}
                {settingsStore.showChannelInfo && order.rawOrder?.channelInfo && (
                    <Box direction="horizontal" align="space-between" style={{ paddingTop: '4px' }}>
                        <Text size="tiny" align="left">Sales Channel:</Text>
                        <Box direction="vertical" align="right">
                            <Text size="tiny">
                                {formatChannelType(order.rawOrder.channelInfo.type)}
                                {order.rawOrder.channelInfo.externalOrderId && (
                                    <Text size="tiny" secondary> (ID: {order.rawOrder.channelInfo.externalOrderId})</Text>
                                )}
                            </Text>
                            {order.rawOrder.channelInfo.externalOrderUrl && (
                                <Text size="tiny">
                                    <a
                                        href={order.rawOrder.channelInfo.externalOrderUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: '#3899ec', textDecoration: 'none' }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        View on {formatChannelType(order.rawOrder.channelInfo.type)}
                                    </a>
                                </Text>
                            )}
                        </Box>
                    </Box>
                )}

                {/* Attribution Source */}
                {order.rawOrder?.attributionSource && order.rawOrder.attributionSource !== 'UNSPECIFIED' && (
                    <Box direction="horizontal" align="space-between" style={{ paddingTop: '4px' }}>
                        <Text size="tiny" align="left">Attribution Source:</Text>
                        <Text size="tiny" weight="bold">
                            {order.rawOrder.attributionSource === 'FACEBOOK_ADS' ? 'Facebook Ads' : order.rawOrder.attributionSource}
                        </Text>
                    </Box>
                )}
            </Box>
        </Box >
    );
});
// Enhanced component to check tracking status for both buttons
const TrackingButtonController: React.FC<{
    order: any;
    onTrackingFound: () => void;
    onAllItemsTracked: () => void;
}> = ({ order, onTrackingFound, onAllItemsTracked }) => {
    useEffect(() => {
        const checkTrackingStatus = async () => {
            try {
                const { orderFulfillments } = await import('@wix/ecom');
                const response = await orderFulfillments.listFulfillmentsForSingleOrder(order._id);
                const fulfillments = response.orderWithFulfillments?.fulfillments || [];

                // Check if any fulfillment has tracking
                const hasAnyTracking = fulfillments.some(fulfillment =>
                    fulfillment.trackingInfo?.trackingNumber
                );

                if (hasAnyTracking) {
                    onTrackingFound();
                }

                // Check if ALL QUANTITIES of ALL items have tracking
                const orderItems = order.rawOrder?.lineItems || [];
                if (orderItems.length > 0) {
                    const allQuantitiesTracked = orderItems.every((item: any) => {
                        const itemId = item._id || item.id;
                        const totalQuantity = item.quantity || 1;

                        // Calculate how many of this item have tracking
                        const trackedQuantity = fulfillments.reduce((total, fulfillment) => {
                            if (!fulfillment.trackingInfo?.trackingNumber) return total;

                            const fulfillmentLineItem = fulfillment.lineItems?.find((li: any) => {
                                const possibleIds = [li._id, li.id].filter(Boolean);
                                return possibleIds.includes(itemId);
                            });

                            if (fulfillmentLineItem) {
                                return total + (fulfillmentLineItem.quantity || 0);
                            }

                            return total;
                        }, 0);

                        // This item is fully tracked if tracked quantity >= total quantity
                        return trackedQuantity >= totalQuantity;
                    });

                    if (allQuantitiesTracked) {
                        onAllItemsTracked();
                    }
                }
            } catch (error) {
                console.error('Error checking tracking status:', error);
            }
        };

        checkTrackingStatus();
    }, [order._id, onTrackingFound, onAllItemsTracked]);

    return null; // This component renders nothing
};

export default ProductImages;