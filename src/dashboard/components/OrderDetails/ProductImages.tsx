// components/OrderDetails/ProductImages.tsx - ENHANCED with proper button logic and per-item fulfillment

import React, { useState, useEffect } from 'react';
import { Box, Text, Button, TextButton, Divider, Tooltip } from '@wix/design-system';
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
    const { hasAnyTrackingDisplayed, allItemsHaveTracking, showEditButton, showAddButton, itemTrackingInfo } = useTrackingStatus(order);
    const [isMounted, setIsMounted] = useState(true);

    // Cleanup on unmount to prevent memory leaks
    useEffect(() => {
        return () => {
            setIsMounted(false);
        };
    }, []);

    // Refresh order data when refresh trigger changes
    useEffect(() => {
        if (refreshTrigger > 0 && onRefreshOrder && isMounted) {
            console.log('🔄 REFRESH - Triggering order refresh, trigger:', refreshTrigger);
            onRefreshOrder();
        }
    }, [refreshTrigger, onRefreshOrder, isMounted]);

    const handleSaveTracking = async (trackingNumber: string, carrier: string, selectedItems?: Array<{ id: string, quantity: number }>, trackingUrl?: string, customCarrierName?: string) => {
        try {
            console.log('🚀 SAVE TRACKING - Received parameters:', {
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
            
            // CRITICAL DEBUG: Check what path this is taking
            console.log('🚀 SAVE TRACKING - Mode check:', {
                isEditMode,
                isUpdateMode,
                willDoFiltering: !isEditMode && !isUpdateMode,
                hasSelectedItems: !!selectedItems,
                selectedItemsLength: selectedItems?.length || 0
            });

            // Debug: Show current item fulfillment states
            console.log('🚀 SAVE TRACKING - Current order items fulfillment:', 
                order.rawOrder?.lineItems?.map((item: any, index: number) => ({
                    index,
                    id: item._id || item.id,
                    name: item.productName?.original || `Item ${index + 1}`,
                    totalQuantity: item.quantity || 1,
                    fulfilledQuantity: item.fulfilledQuantity || 0,
                    remainingQuantity: (item.quantity || 1) - (item.fulfilledQuantity || 0),
                    hasTracking: !!(item.fulfillmentDetails?.trackingInfo?.length > 0 ||
                        item.fulfillmentDetails?.lineItemFulfillment?.some((f: any) => f.trackingNumber))
                }))
            );

            // FAILSAFE: Always filter items in ADD mode, regardless of how they're formatted
            let processedSelectedItems = selectedItems;
            if (!isEditMode && !isUpdateMode && selectedItems && selectedItems.length > 0) {
                console.log('🚀 SAVE TRACKING - FAILSAFE: Running mandatory filtering for ADD mode');
                console.log('🚀 SAVE TRACKING - FAILSAFE: Input items:', selectedItems);
                console.log('🚀 SAVE TRACKING - FAILSAFE: Current itemTrackingInfo map:', Array.from(itemTrackingInfo.entries()));
                
                processedSelectedItems = selectedItems.filter(selectedItem => {
                    const orderItem = order.rawOrder?.lineItems?.find((item: any) => 
                        (item._id || item.id) === selectedItem.id
                    );
                    
                    if (!orderItem) {
                        console.log(`🚀 FAILSAFE: Item ${selectedItem.id} not found in order, EXCLUDING`);
                        return false;
                    }
                    
                    const fulfilledQuantity = orderItem.fulfilledQuantity || 0;
                    const totalQuantity = orderItem.quantity || 1;
                    const remainingQuantity = totalQuantity - fulfilledQuantity;
                    
                    // Get real-time tracking information directly from order data instead of map
                    let hasTracking = false;
                    try {
                        // Check if item has tracking by looking at fulfillment details
                        hasTracking = !!(
                            orderItem.fulfillmentDetails?.trackingInfo?.length > 0 ||
                            orderItem.fulfillmentDetails?.lineItemFulfillment?.some((f: any) => f.trackingNumber)
                        );
                        
                        console.log(`🚀 FAILSAFE: Real-time tracking check for ${selectedItem.id}:`, {
                            fromMap: itemTrackingInfo.get(selectedItem.id) || false,
                            fromRealTime: hasTracking,
                            fulfillmentDetails: orderItem.fulfillmentDetails
                        });
                    } catch (error) {
                        console.log(`🚀 FAILSAFE: Error checking real-time tracking for ${selectedItem.id}, falling back to map:`, error);
                        hasTracking = itemTrackingInfo.get(selectedItem.id) || false;
                    }
                    
                    const shouldInclude = remainingQuantity > 0 && !hasTracking;
                    
                    console.log(`🚀 FAILSAFE: Item ${selectedItem.id} (${orderItem.productName?.original}):`, {
                        totalQuantity,
                        fulfilledQuantity,
                        remainingQuantity,
                        hasTracking: hasTracking ? '✅ HAS TRACKING (from API)' : '❌ NO TRACKING',
                        shouldInclude: shouldInclude ? '✅ INCLUDE' : '❌ EXCLUDE (has tracking or no remaining quantity)'
                    });
                    
                    return shouldInclude;
                });
                
                console.log('🚀 FAILSAFE: Filtered result:', {
                    originalCount: selectedItems.length,
                    filteredCount: processedSelectedItems.length,
                    filteredItems: processedSelectedItems
                });
                
                // If all items were filtered out, show warning and abort
                if (processedSelectedItems.length === 0) {
                    console.log('🚀 FAILSAFE: All items filtered out, aborting operation');
                    setIsTrackingModalOpen(false);
                    setIsEditMode(false);
                    setIsUpdateMode(false);
                    setSelectedItemForEdit(null);
                    
                    dashboard.showToast({
                        message: 'Cannot add tracking: All selected items already have tracking or are fully fulfilled.',
                        type: 'warning'
                    });
                    return;
                }
            }

            // Check if this is an update operation
            const isUpdateOperation = (processedSelectedItems as any)?.isUpdate;
            const fulfillmentId = (processedSelectedItems as any)?.fulfillmentId;

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
                    // Use the already processed items from the failsafe above
                    const finalSelectedItems = isUpdateOperation ? undefined : processedSelectedItems;
                    
                    console.log('🚀 SAVE TRACKING - Final items to process:', finalSelectedItems);
                    
                    await onSaveTracking(trackingNumber, carrier, finalSelectedItems, trackingUrl, customCarrierName);
                }
            }

            // Only update state if component is still mounted
            if (isMounted) {
                console.log('🚀 SAVE TRACKING - Success! Triggering refreshes...');
                
                // Force a refresh of the order data to get updated fulfillments
                setRefreshTrigger(prev => {
                    console.log('🔄 REFRESH - First refresh trigger:', prev + 1);
                    return prev + 1;
                });

                // Close the modal and reset state immediately
                setIsTrackingModalOpen(false);
                setIsEditMode(false);
                setIsUpdateMode(false);
                setSelectedItemForEdit(null);

                // Add a small delay to ensure backend has processed the fulfillment
                setTimeout(async () => {
                    if (!isMounted) return; // Check again before async operations
                    
                    console.log('🔄 REFRESH - Delayed refresh starting...');
                    
                    // Force another refresh to ensure we have the latest data
                    setRefreshTrigger(prev => {
                        console.log('🔄 REFRESH - Second refresh trigger:', prev + 1);
                        return prev + 1;
                    });

                    // If we have a refresh callback, call it to ensure the order status is updated
                    if (onRefreshOrder) {
                        console.log('🔄 REFRESH - Calling onRefreshOrder callback');
                        await onRefreshOrder();
                    }
                }, 1000);
            }
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
        console.log('🔘 ADD TRACKING clicked - Setting modal state:', {
            isEditMode: false,
            isUpdateMode: false,
            selectedItemForEdit: null
        });
        setIsEditMode(false);
        setIsUpdateMode(false);
        setSelectedItemForEdit(null);
        setIsTrackingModalOpen(true);
    };

    const handleEditTracking = () => {
        console.log('🔘 EDIT TRACKING clicked - Setting modal state:', {
            isEditMode: true,
            isUpdateMode: true,
            selectedItemForEdit: null
        });
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
                    {/* Debug logging for button visibility */}
                    {(() => {
                        const debugInfo = {
                            orderId: order._id,
                            hasAnyTrackingDisplayed,
                            allItemsHaveTracking,
                            showEditButton,
                            showAddButton,
                            renderingEditButton: showEditButton,
                            renderingAddButton: showAddButton
                        };
                        console.log('🔘 BUTTON DEBUG:', debugInfo);
                        console.log('🔘 BUTTON DEBUG - Details:', JSON.stringify(debugInfo, null, 2));
                        return null;
                    })()}

                    {/* Show Edit button based on new logic */}
                    {showEditButton && (
                        <Button
                            size="tiny"
                            priority="secondary"
                            skin="standard"
                            onClick={handleEditTracking}
                        >
                            Edit Tracking No.
                        </Button>
                    )}

                    {/* Show Add button based on new logic */}
                    {showAddButton && (
                        <Button
                            size="tiny"
                            priority="primary"
                            onClick={handleAddTracking}
                        >
                            Add Tracking No.
                        </Button>
                    )}

                </Box>

                <TrackingNumberModal
                    isOpen={isTrackingModalOpen}
                    onClose={() => {
                        console.log('🔘 MODAL CLOSED - Resetting state');
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
                    editMode={(() => {
                        console.log('🔘 MODAL PROPS - editMode:', isEditMode);
                        return isEditMode;
                    })()}
                    updateMode={(() => {
                        console.log('🔘 MODAL PROPS - updateMode:', isUpdateMode);
                        return isUpdateMode;
                    })()}
                    isPartialOrder={(() => {
                        // Calculate if this is a partial order with mixed fulfillment states
                        const orderItems = order.rawOrder?.lineItems || [];
                        
                        let hasUnfulfilledItems = false;
                        let hasFulfilledItems = false;
                        
                        orderItems.forEach((item: any) => {
                            const itemId = item._id || item.id;
                            const fulfilledQuantity = item.fulfilledQuantity || 0;
                            const totalQuantity = item.quantity || 1;
                            const remainingQuantity = totalQuantity - fulfilledQuantity;
                            
                            // Use API-based tracking information
                            const hasTracking = itemTrackingInfo.get(itemId) || false;
                            
                            if (remainingQuantity > 0 && !hasTracking) {
                                hasUnfulfilledItems = true;
                            }
                            
                            if (fulfilledQuantity > 0 || hasTracking) {
                                hasFulfilledItems = true;
                            }
                        });
                        
                        const isPartialOrder = hasUnfulfilledItems && hasFulfilledItems;
                        const debugData = {
                            hasUnfulfilledItems,
                            hasFulfilledItems,
                            isPartialOrder,
                            orderStatus: order.status,
                            itemTrackingMap: Array.from(itemTrackingInfo.entries()),
                            itemDetails: orderItems.map((item: any, index: number) => {
                                const itemId = item._id || item.id;
                                return {
                                    index,
                                    name: item.productName?.original,
                                    totalQuantity: item.quantity || 1,
                                    fulfilledQuantity: item.fulfilledQuantity || 0,
                                    hasTracking: itemTrackingInfo.get(itemId) || false
                                };
                            })
                        };
                        console.log('🔘 MODAL PROPS - isPartialOrder (API-BASED):', debugData);
                        console.log('🔘 MODAL PROPS - isPartialOrder Details:', JSON.stringify(debugData, null, 2));
                        return isPartialOrder;
                    })()}
                    existingTrackingInfo={(() => {
                        const shouldGetExisting = isEditMode && isUpdateMode;
                        console.log('🔘 MODAL PROPS - existingTrackingInfo check:', {
                            isEditMode,
                            isUpdateMode,
                            shouldGetExisting
                        });
                        
                        if (shouldGetExisting) {
                            const tracking = getExistingTrackingInfo()[0];
                            const result = tracking ? {
                                trackingNumber: tracking.trackingNumber,
                                carrier: tracking.carrier || 'Other'
                            } : undefined;
                            console.log('🔘 MODAL PROPS - existingTrackingInfo result:', result);
                            return result;
                        }
                        return undefined;
                    })()}
                />
            </Box>

            <Box direction="vertical" gap="16px" style={{ width: '100%' }}>
                {order.rawOrder.lineItems.map((item: any, index: any) => {
                    const itemImage = item.image ? processWixImageUrl(item.image) : '';
                    const itemName = item.productName?.original || `Item ${index + 1}`;
                    const itemQuantity = item.quantity || 1;
                    // Calculate total price (price × quantity)
                    const unitPrice = parseFloat(item.price?.formattedAmount?.replace(/[^0-9.,]/g, '').replace(',', '.') || '0');
                    const totalPrice = (unitPrice * itemQuantity).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    });
                    const currencySymbol = item.price?.formattedAmount?.replace(/[0-9.,\s]/g, '') || '';
                    const formattedUnitPrice = unitPrice.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    });
                    const itemPrice = item.price?.formattedAmount ? 
                        `${totalPrice} ${currencySymbol}`.trim() : 
                        '0.00';
                    const itemPriceDisplay = `${totalPrice} ${currencySymbol}`.trim();
                    const tooltipContent = `${formattedUnitPrice} ${currencySymbol} × ${itemQuantity} = ${itemPriceDisplay}`;
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
                                            {itemQuantity > 1 ? (
                                                <Tooltip content={tooltipContent} placement="top">
                                                    <Text size="tiny" weight="normal" align="right" style={{ cursor: 'help' }}>
                                                        {itemPriceDisplay}
                                                    </Text>
                                                </Tooltip>
                                            ) : (
                                                <Text size="tiny" weight="normal" align="right">
                                                    {itemPriceDisplay}
                                                </Text>
                                            )}
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
// Enhanced tracking status checker - restored API-based approach for accuracy
const useTrackingStatus = (order: any) => {
    const [hasAnyTrackingDisplayed, setHasAnyTrackingDisplayed] = useState(false);
    const [allItemsHaveTracking, setAllItemsHaveTracking] = useState(false);
    const [showAddButton, setShowAddButton] = useState(false);
    const [showEditButton, setShowEditButton] = useState(false);
    const [itemTrackingInfo, setItemTrackingInfo] = useState<Map<string, boolean>>(new Map());

    useEffect(() => {
        const checkTrackingStatus = async () => {
            try {
                console.log('🔍 TRACKING DEBUG - Starting check for order:', order._id, 'Status:', order.status);
                
                const { orderFulfillments } = await import('@wix/ecom');
                const response = await orderFulfillments.listFulfillmentsForSingleOrder(order._id);
                const fulfillments = response.orderWithFulfillments?.fulfillments || [];
                const orderItems = order.rawOrder?.lineItems || [];

                console.log('🔍 TRACKING DEBUG - API Response:', {
                    fulfillmentsCount: fulfillments.length,
                    orderItemsCount: orderItems.length
                });

                if (fulfillments.length > 0) {
                    console.log('🔍 TRACKING DEBUG - Fulfillments:', fulfillments.map((f, i) => ({
                        index: i,
                        trackingNumber: f.trackingInfo?.trackingNumber,
                        lineItemsCount: f.lineItems?.length || 0
                    })));
                }

                // Check if any fulfillment has tracking
                const hasAnyTrackingFromAPI = fulfillments.some(fulfillment =>
                    fulfillment.trackingInfo?.trackingNumber
                );

                // ENHANCED: Also check order status as a fallback indicator
                // If order is PARTIALLY_FULFILLED, it means some items have tracking even if API doesn't reflect it yet
                const orderStatusIndicatesTracking = order.status === 'PARTIALLY_FULFILLED' || order.status === 'FULFILLED';
                const hasAnyTracking = hasAnyTrackingFromAPI || orderStatusIndicatesTracking;

                console.log('🔍 TRACKING DEBUG - Has any tracking:', {
                    fromAPI: hasAnyTrackingFromAPI,
                    fromOrderStatus: orderStatusIndicatesTracking,
                    orderStatus: order.status,
                    final: hasAnyTracking
                });

                // Build tracking info map for all items
                const trackingMap = new Map<string, boolean>();
                let allQuantitiesTracked = false;
                let itemsWithTracking = 0;
                let itemsWithoutTracking = 0;

                // ENHANCED: Check if we have fulfillments but no items are being matched
                // This indicates an ID matching issue, so we'll use a fallback strategy
                let totalApiTrackedItems = 0;
                fulfillments.forEach(fulfillment => {
                    if (fulfillment.trackingInfo?.trackingNumber) {
                        fulfillment.lineItems?.forEach((li: any) => {
                            totalApiTrackedItems += (li.quantity || 1);
                        });
                    }
                });

                console.log(`🔍 TRACKING DEBUG - API Summary:`, {
                    fulfillmentsWithTracking: fulfillments.filter(f => f.trackingInfo?.trackingNumber).length,
                    totalApiTrackedItems,
                    orderItemsCount: orderItems.length
                });

                if (orderItems.length > 0) {
                    // Always process all items, whether they have tracking or not
                    allQuantitiesTracked = orderItems.every((item: any, index: number) => {
                        const itemId = item._id || item.id;
                        const itemName = item.productName?.original || `Item ${index + 1}`;
                        const totalQuantity = item.quantity || 1;
                        const fulfilledQuantity = item.fulfilledQuantity || 0;

                        console.log(`🔍 TRACKING DEBUG - Checking item ${index + 1} (${itemName}):`, {
                            itemId,
                            totalQuantity,
                            fulfilledQuantity
                        });

                        // Calculate how many of this item have tracking from API
                        const trackedQuantityFromAPI = fulfillments.reduce((total, fulfillment) => {
                            if (!fulfillment.trackingInfo?.trackingNumber) return total;

                            console.log(`🔍 TRACKING DEBUG - Checking fulfillment for item ${index + 1}:`, {
                                fulfillmentId: fulfillment._id,
                                trackingNumber: fulfillment.trackingInfo.trackingNumber,
                                fulfillmentLineItems: fulfillment.lineItems?.map((li: any) => ({
                                    id: li._id || li.id || li.lineItemId,
                                    quantity: li.quantity
                                }))
                            });

                            const fulfillmentLineItem = fulfillment.lineItems?.find((li: any) => {
                                const possibleIds = [li._id, li.id, li.lineItemId].filter(Boolean);
                                console.log(`🔍 TRACKING DEBUG - Comparing item ${index + 1} IDs:`, {
                                    orderItemId: itemId,
                                    fulfillmentLineItemIds: possibleIds,
                                    matches: possibleIds.includes(itemId)
                                });
                                return possibleIds.includes(itemId);
                            });

                            if (fulfillmentLineItem) {
                                console.log(`🔍 TRACKING DEBUG - ✅ Item ${index + 1} found in fulfillment:`, {
                                    trackingNumber: fulfillment.trackingInfo.trackingNumber,
                                    quantity: fulfillmentLineItem.quantity
                                });
                                return total + (fulfillmentLineItem.quantity || 0);
                            } else {
                                console.log(`🔍 TRACKING DEBUG - ❌ Item ${index + 1} NOT found in this fulfillment`);
                            }

                            return total;
                        }, 0);

                        // ENHANCED: If API shows no tracking but order status indicates tracking,
                        // we need a more robust fallback since fulfilledQuantity might be stale
                        let trackedQuantity = trackedQuantityFromAPI;
                        
                        if (trackedQuantityFromAPI === 0 && orderStatusIndicatesTracking) {
                            // Strategy 1: Use fulfilledQuantity if available
                            if (fulfilledQuantity > 0) {
                                trackedQuantity = fulfilledQuantity;
                                console.log(`🔍 TRACKING DEBUG - Strategy 1: Using fulfilled quantity (${fulfilledQuantity}) as tracked quantity for item ${index + 1}`);
                            } 
                            // Strategy 2: If ALL items show 0 fulfilled but order is PARTIALLY_FULFILLED,
                            // assume at least one item per fulfillment has tracking (data freshness issue)
                            else if (index === 0 && orderStatusIndicatesTracking) {
                                // For now, let's see if any fulfillment exists and assume first item might have tracking
                                trackedQuantity = fulfillments.length > 0 ? 1 : 0;
                                console.log(`🔍 TRACKING DEBUG - Strategy 2: Assuming item ${index + 1} has tracking due to fulfillments existence and order status`);
                            }
                        }

                        const hasItemTracking = trackedQuantity > 0;
                        trackingMap.set(itemId, hasItemTracking);

                        console.log(`🔍 TRACKING DEBUG - Item ${index + 1} quantities:`, {
                            totalQuantity,
                            fulfilledQuantity,
                            trackedQuantityFromAPI,
                            trackedQuantity,
                            hasItemTracking,
                            isFullyTracked: trackedQuantity >= totalQuantity
                        });

                        // Track items with/without tracking for button logic
                        if (hasItemTracking) {
                            itemsWithTracking++;
                        }
                        
                        // Count items without tracking based on actual quantities
                        if (trackedQuantity < totalQuantity) {
                            // This item has unfulfilled quantities, so it can potentially get more tracking
                            itemsWithoutTracking++;
                        }

                        // This item is fully tracked if tracked quantity >= total quantity
                        return trackedQuantity >= totalQuantity;
                    });
                    
                    // For partially fulfilled orders, we should be able to add tracking to unfulfilled items
                    const isPartiallyFulfilled = order.status === 'PARTIALLY_FULFILLED';
                    const hasUnfulfilledItems = orderItems.some((item: any) => {
                        const totalQuantity = item.quantity;
                        const fulfilledQuantity = item.fulfillmentDetails?.fulfilledQuantity || 0;
                        return fulfilledQuantity < totalQuantity;
                    });
                    
                    // If order is partially fulfilled and has unfulfilled items, ensure Add button is available
                    if (isPartiallyFulfilled && hasUnfulfilledItems && itemsWithoutTracking === 0) {
                        console.log(`🔍 TRACKING DEBUG - PARTIAL ORDER: Order has unfulfilled items but counter shows 0. Adjusting to 1.`);
                        itemsWithoutTracking = 1;
                    }
                    
                    // ENHANCED: Fallback for when API has tracking but item matching failed
                    // This happens due to ID mismatch or stale order data
                    if (totalApiTrackedItems > 0 && itemsWithTracking === 0) {
                        console.log(`🔍 TRACKING DEBUG - FALLBACK: API shows ${totalApiTrackedItems} tracked items but matching failed. Using fallback strategy.`);
                        
                        // Strategy: Assume the first N items have tracking where N = number of fulfillments with tracking
                        const fulfillmentsWithTrackingCount = fulfillments.filter(f => f.trackingInfo?.trackingNumber).length;
                        
                        for (let i = 0; i < Math.min(fulfillmentsWithTrackingCount, orderItems.length); i++) {
                            const item = orderItems[i];
                            const itemId = item._id || item.id;
                            console.log(`🔍 TRACKING DEBUG - FALLBACK: Assuming item ${i + 1} has tracking`);
                            
                            trackingMap.set(itemId, true);
                            itemsWithTracking++;
                            // Don't reduce itemsWithoutTracking here as we already adjusted it above
                        }
                    }
                    
                    // Only set allQuantitiesTracked to true if we have tracking AND all items are tracked
                    allQuantitiesTracked = allQuantitiesTracked && hasAnyTracking;
                }

                // Store the tracking map for use in other parts of the component
                setItemTrackingInfo(trackingMap);

                // Determine button visibility based on the requirements:
                // - Only products with tracking → only "Edit Tracking" button
                // - Only products without tracking → only "Add Tracking" button  
                // - Mixed products → both buttons
                
                const shouldShowEditButton = itemsWithTracking > 0; // Has at least one item with tracking
                const shouldShowAddButton = itemsWithoutTracking > 0; // Has at least one item without full tracking
                
                const finalStatus = {
                    hasAnyTracking,
                    allQuantitiesTracked,
                    itemsWithTracking,
                    itemsWithoutTracking,
                    shouldShowEditButton,
                    shouldShowAddButton
                };
                console.log('🔍 TRACKING DEBUG - Final status:', finalStatus);
                console.log('🔍 TRACKING DEBUG - Final status Details:', JSON.stringify(finalStatus, null, 2));

                setHasAnyTrackingDisplayed(hasAnyTracking);
                setAllItemsHaveTracking(allQuantitiesTracked && hasAnyTracking);
                setShowEditButton(shouldShowEditButton);
                setShowAddButton(shouldShowAddButton);

            } catch (error) {
                console.error('🔍 TRACKING DEBUG - API Error, falling back to local data:', error);
                
                // FALLBACK: Use local order data when API fails (CORS issues in dev)
                const orderItems = order.rawOrder?.lineItems || [];
                const trackingMap = new Map<string, boolean>();
                let itemsWithTracking = 0;
                let itemsWithoutTracking = 0;
                
                // Start with no tracking assumed, let item analysis determine actual state
                let hasAnyTracking = false;
                
                console.log('🔍 TRACKING DEBUG - FALLBACK: Processing local order data, orderStatus:', order.status);
                
                orderItems.forEach((item: any, index: number) => {
                    const itemId = item._id || item.id;
                    const totalQuantity = item.quantity || 1;
                    const fulfilledQuantity = item.fulfilledQuantity || 0;
                    const remainingQuantity = totalQuantity - fulfilledQuantity;
                    
                    // Check if this item has any tracking in local data OR assume fulfilled items have tracking based on order status
                    const hasItemTrackingFromLocal = !!(
                        item.fulfillmentDetails?.trackingInfo?.length > 0 ||
                        item.fulfillmentDetails?.lineItemFulfillment?.some((f: any) => f.trackingNumber)
                    );
                    
                    // Only consider item has tracking if there's actual tracking data in local storage
                    const hasItemTracking = hasItemTrackingFromLocal;
                    
                    trackingMap.set(itemId, hasItemTracking);
                    
                    console.log(`🔍 FALLBACK - Item ${index + 1} (${item.productName?.original}):`, {
                        totalQuantity,
                        fulfilledQuantity,
                        remainingQuantity,
                        hasItemTrackingFromLocal,
                        hasItemTracking,
                        fulfillmentDetails: item.fulfillmentDetails
                    });
                    
                    if (hasItemTracking) {
                        hasAnyTracking = true;
                        itemsWithTracking++;
                    }
                    
                    // Count items that can receive tracking (have remaining quantity and no tracking)
                    if (remainingQuantity > 0 && !hasItemTracking) {
                        itemsWithoutTracking++;
                    }
                });
                
                // For partially fulfilled orders, ensure Add button is available if there are unfulfilled items
                const isPartiallyFulfilled = order.status === 'PARTIALLY_FULFILLED';
                const hasUnfulfilledItems = orderItems.some((item: any) => {
                    const totalQuantity = item.quantity || 1;
                    const fulfilledQuantity = item.fulfilledQuantity || 0;
                    return fulfilledQuantity < totalQuantity;
                });
                
                if (isPartiallyFulfilled && hasUnfulfilledItems && itemsWithoutTracking === 0) {
                    console.log(`🔍 FALLBACK - PARTIAL ORDER: Order has unfulfilled items but counter shows 0. Adjusting to 1.`);
                    itemsWithoutTracking = 1;
                }
                
                const shouldShowEditButton = itemsWithTracking > 0;
                const shouldShowAddButton = itemsWithoutTracking > 0;
                
                console.log('🔍 TRACKING DEBUG - FALLBACK Final status:', {
                    hasAnyTracking,
                    itemsWithTracking,
                    itemsWithoutTracking,
                    shouldShowEditButton,
                    shouldShowAddButton
                });
                
                setItemTrackingInfo(trackingMap);
                setHasAnyTrackingDisplayed(hasAnyTracking);
                setAllItemsHaveTracking(itemsWithTracking > 0 && itemsWithoutTracking === 0);
                setShowEditButton(shouldShowEditButton);
                setShowAddButton(shouldShowAddButton);
            }
        };

        // Only check if we have a valid order ID
        if (order._id) {
            checkTrackingStatus();
        } else {
            setHasAnyTrackingDisplayed(false);
            setAllItemsHaveTracking(false);
            setShowEditButton(false);
            setShowAddButton(false);
        }
    }, [order._id]);

    return { hasAnyTrackingDisplayed, allItemsHaveTracking, showEditButton, showAddButton, itemTrackingInfo };
};

export default ProductImages;