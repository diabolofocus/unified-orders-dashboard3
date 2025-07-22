//src/dashboard/components/TrackingNumberModal/TrackingNumberModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, Button, Dropdown, Input, FormField, IconButton, Checkbox, Tooltip, Heading, TextButton, NumberInput, Loader, ListItemAction, listItemSelectBuilder, Badge } from '@wix/design-system';
import * as Icons from '@wix/wix-ui-icons-common';
import { rootStore } from '../../stores/RootStore';
import { SHIPPING_CARRIERS } from '../../utils/constants';
import { observer } from 'mobx-react-lite';
import { settingsStore } from '../../stores/SettingsStore';
import { processWixImageUrl } from '../../utils/image-processor';
import type { Order, OrderLineItem, OrderItem } from '../../types/Order';
import { dashboard } from '@wix/dashboard';

type LineItem = OrderLineItem & {
    name?: string;
    quantity: number;
    physicalProperties?: {
        sku?: string;
    };
    image?: string;
    media?: {
        mainMedia?: {
            image?: string | { url: string };
            thumbnail?: { url: string };
        };
        items?: Array<{
            image?: {
                url: string;
                thumbnailUrl?: string;
            };
        }>;
    };
    product?: {
        image?: string;
        media?: {
            mainMedia?: {
                image?: string | { url: string };
            };
            items?: Array<{
                image?: {
                    url: string;
                };
            }>;
        };
    };
    options?: Array<{
        name: string;
        option: string;
        value: string;
    }>;
    productOptions?: Array<{
        name: string;
        option: string;
        value: string;
    }>;
    descriptionLines?: Array<{
        name?: { original: string };
        plainText?: { original: string };
        color?: string;
        lineType?: string;
    }>;
};

interface TrackingNumberModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: Omit<Order, 'items'> & {
        items?: LineItem[];
        number: string;
        buyerInfo?: {
            email?: string;
        };
    };
    onSave: (trackingNumber: string, carrier: string, selectedItems?: Array<{ id: string, quantity: number }>, trackingUrl?: string, customCarrierName?: string) => Promise<void>;
    editMode?: boolean;
    updateMode?: boolean;
    isPartialOrder?: boolean;
    existingTrackingInfo?: {
        trackingNumber: string;
        carrier: string;
    };
}

export const TrackingNumberModal: React.FC<TrackingNumberModalProps> = observer(({
    isOpen,
    onClose,
    order,
    onSave,
    editMode,
    updateMode = false,
    isPartialOrder = false,
    existingTrackingInfo
}) => {
    const { uiStore } = rootStore;
    const [trackingNumber, setTrackingNumber] = useState('');
    const [carrier, setCarrier] = useState(settingsStore.defaultShippingCarrier || '');
    const [trackingUrl, setTrackingUrl] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [showAddCarrier, setShowAddCarrier] = useState(false);
    const [newCarrierName, setNewCarrierName] = useState('');
    const [newCarrierUrl, setNewCarrierUrl] = useState('');
    const [urlValidationError, setUrlValidationError] = useState('');
    const [applyToAllItems, setApplyToAllItems] = useState(true);
    const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
    const [selectedItemsState, setSelectedItemsState] = useState<Record<string, boolean>>({});
    const [isTrackingUrlFocused, setIsTrackingUrlFocused] = useState(false);
    const [selectedTrackingNumber, setSelectedTrackingNumber] = useState<string | null>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    // Auto-expand product list for partial orders or when in update mode
    useEffect(() => {
        if (isOpen && (isPartialOrder || updateMode)) {
            setApplyToAllItems(false);
        } else if (isOpen && !isPartialOrder && !updateMode) {
            setApplyToAllItems(true);
        }
    }, [isOpen, isPartialOrder, updateMode]);

    // State to store fresh fulfillment data
    const [fulfillmentsData, setFulfillmentsData] = useState<any[]>([]);
    const [fulfillmentsLoaded, setFulfillmentsLoaded] = useState(false);

    // Fetch fresh fulfillment data when modal opens - same as ItemTrackingDisplay
    useEffect(() => {
        if (!isOpen || !order._id) {
            setFulfillmentsData([]);
            setFulfillmentsLoaded(false);
            return;
        }

        const fetchFulfillments = async () => {
            try {
                const { orderFulfillments } = await import('@wix/ecom');
                const response = await orderFulfillments.listFulfillmentsForSingleOrder(order._id);
                const fulfillments = response.orderWithFulfillments?.fulfillments || [];

                console.log('🔄 Fresh fulfillments loaded:', {
                    orderId: order._id,
                    fulfillmentsCount: fulfillments.length,
                    fulfillmentsWithTracking: fulfillments.filter(f => f.trackingInfo?.trackingNumber).length
                });

                setFulfillmentsData(fulfillments);
                setFulfillmentsLoaded(true);
            } catch (error) {
                console.error('Error fetching fulfillments:', error);
                setFulfillmentsData([]);
                setFulfillmentsLoaded(true);
            }
        };

        fetchFulfillments();
    }, [isOpen, order._id]);

    // Function to get existing tracking for an item - uses FRESH fulfillment data
    const getExistingTracking = (itemId: string) => {
        const trackingData: any[] = [];

        try {
            fulfillmentsData.forEach((fulfillment) => {
                if (!fulfillment.trackingInfo?.trackingNumber) return;

                // Check if this fulfillment contains our specific item
                const itemLineItem = fulfillment.lineItems?.find((li: any) => {
                    // Try different possible property names that might exist
                    const lineItemId = li.lineItemId || li.id || li._id;
                    return lineItemId === itemId || li._id === itemId;
                });

                if (itemLineItem) {
                    trackingData.push({
                        trackingNumber: fulfillment.trackingInfo.trackingNumber,
                        trackingUrl: fulfillment.trackingInfo.trackingLink,
                        carrier: fulfillment.trackingInfo.shippingProvider,
                        quantity: itemLineItem.quantity || 1,
                        fulfillmentDate: typeof fulfillment._createdDate === 'string'
                            ? fulfillment._createdDate
                            : new Date(fulfillment._createdDate).toISOString()
                    });
                }
            });

            return trackingData;
        } catch (error) {
            console.error('Error getting existing tracking:', error);
            return [];
        }
    };

    // Initialize quantities and selected state when order changes
    useEffect(() => {
        if (order?.items && fulfillmentsLoaded) {
            const initialQuantities: Record<string, number> = {};
            const initialSelected: Record<string, boolean> = {};

            order.items.forEach((item, index) => {
                const itemId = item._id || item.id || `item-${index}`;
                const existingTracking = getExistingTracking(itemId);
                const actualFulfilledQuantity = existingTracking.reduce((total, tracking) => total + tracking.quantity, 0);
                const totalQuantity = item.quantity || 1;
                const remainingQuantity = Math.max(0, totalQuantity - actualFulfilledQuantity);

                // Set initial quantities based on fresh data
                initialQuantities[`${index}`] = remainingQuantity > 0 ? remainingQuantity : totalQuantity;

                // For split items, set quantities for fulfilled and unfulfilled portions
                if (actualFulfilledQuantity > 0 && remainingQuantity > 0) {
                    initialQuantities[`${index}-fulfilled`] = actualFulfilledQuantity;
                    initialQuantities[`${index}-unfulfilled`] = remainingQuantity;
                }

                initialSelected[index.toString()] = false; // Unselected by default when applyToAllItems is false
            });

            setItemQuantities(initialQuantities);
            setSelectedItemsState(initialSelected);
        }
    }, [order, fulfillmentsLoaded]);


    // Initialize carrier from settings and handle edit mode
    useEffect(() => {
        if (editMode && existingTrackingInfo) {
            // In edit mode, use the existing tracking info
            setTrackingNumber(existingTrackingInfo.trackingNumber);
            setCarrier(existingTrackingInfo.carrier);
        } else {
            // In new mode, use the default carrier from settings
            setTrackingNumber('');
            const defaultCarrier = settingsStore.defaultShippingCarrier || SHIPPING_CARRIERS[0]?.id || '';
            setCarrier(defaultCarrier);
        }
    }, [editMode, existingTrackingInfo]);

    // Auto-select tracking number in edit mode
    useEffect(() => {
        if (updateMode && fulfillmentsLoaded && order.items && !selectedTrackingNumber) {
            // Get all unique tracking numbers
            const trackingNumbers = new Set<string>();
            order.items.forEach((item, index) => {
                const itemId = item._id || item.id || `item-${index}`;
                const existingTracking = getExistingTracking(itemId);
                existingTracking.forEach(tracking => {
                    trackingNumbers.add(tracking.trackingNumber);
                });
            });

            const trackingArray = Array.from(trackingNumbers);

            // If there's only one tracking number, auto-select it
            if (trackingArray.length === 1) {
                setSelectedTrackingNumber(trackingArray[0]);
            }
            // If there's an existing tracking info, try to match it
            else if (existingTrackingInfo?.trackingNumber && trackingArray.includes(existingTrackingInfo.trackingNumber)) {
                setSelectedTrackingNumber(existingTrackingInfo.trackingNumber);
            }
        }
    }, [updateMode, fulfillmentsLoaded, order.items, selectedTrackingNumber, existingTrackingInfo]);

    // Reset selected tracking number when modal closes
    useEffect(() => {
        if (!isOpen) {
            setSelectedTrackingNumber(null);
        }
    }, [isOpen]);

    // Auto-select tracking number in edit mode
    useEffect(() => {
        if (updateMode && fulfillmentsLoaded && order.items && !selectedTrackingNumber) {
            // Get all unique tracking numbers
            const trackingNumbers = new Set<string>();
            order.items.forEach((item, index) => {
                const itemId = item._id || item.id || `item-${index}`;
                const existingTracking = getExistingTracking(itemId);
                existingTracking.forEach(tracking => {
                    trackingNumbers.add(tracking.trackingNumber);
                });
            });

            const trackingArray = Array.from(trackingNumbers);

            // If there's only one tracking number, auto-select it
            if (trackingArray.length === 1) {
                setSelectedTrackingNumber(trackingArray[0]);
            }
            // If there's an existing tracking info, try to match it
            else if (existingTrackingInfo?.trackingNumber && trackingArray.includes(existingTrackingInfo.trackingNumber)) {
                setSelectedTrackingNumber(existingTrackingInfo.trackingNumber);
            }
        }
    }, [updateMode, fulfillmentsLoaded, order.items, selectedTrackingNumber, existingTrackingInfo]);

    // Reset selected tracking number when modal closes
    useEffect(() => {
        if (!isOpen) {
            setSelectedTrackingNumber(null);
        }
    }, [isOpen]);

    const handleQuantityChange = (index: string | number, value: number) => {
        // Block changes for split items ONLY in edit mode or for fulfilled items
        if (typeof index === 'string' && index.includes('-')) {
            const [, status] = index.split('-');
            // Allow changes for unfulfilled items in add mode
            if (updateMode || status === 'fulfilled') {
                return;
            }
        }

        const numIndex = typeof index === 'number' ? index :
            (typeof index === 'string' && index.includes('-') ? parseInt(index.split('-')[0]) : parseInt(index.toString()));
        const item = order?.items?.[numIndex];
        if (!item) return;

        // Calculate max quantity based on mode and item status
        let maxQuantity: number;

        if (updateMode) {
            // Edit mode: max is the quantity that was actually fulfilled with existing tracking
            const itemId = item._id || item.id || `item-${numIndex}`;
            const existingTracking = getExistingTracking(itemId);
            maxQuantity = existingTracking.reduce((total, tracking) => total + tracking.quantity, 0) || 1;
        } else {
            // Add mode: max is the remaining unfulfilled quantity
            if (typeof index === 'string' && index.includes('-')) {
                // For split unfulfilled items, calculate remaining quantity
                const itemId = item._id || item.id || `item-${numIndex}`;
                const existingTracking = getExistingTracking(itemId);
                const actualFulfilledQuantity = existingTracking.reduce((total, tracking) => total + tracking.quantity, 0);
                const totalQuantity = item.quantity || 1;
                maxQuantity = Math.max(1, totalQuantity - actualFulfilledQuantity);
            } else {
                // For regular items
                const totalQuantity = item.quantity || 1;
                const fulfilledQuantity = item.fulfilledQuantity || 0;
                maxQuantity = Math.max(1, totalQuantity - fulfilledQuantity);
            }
        }

        setItemQuantities(prev => ({
            ...prev,
            [index]: Math.max(1, Math.min(maxQuantity, value))
        }));
    };

    // FIXED: Add handler for individual item selection
    const handleItemSelectionChange = (index: string | number, checked: boolean) => {
        setSelectedItemsState(prev => ({
            ...prev,
            [index.toString()]: checked
        }));
    };

    const handleSelectAllItems = (checked: boolean) => {
        setApplyToAllItems(checked);

        // Only update individual selections when not saving
        if (order?.items && !isSaving) {
            const newSelectedState: Record<string, boolean> = {};
            order.items.forEach((item, index) => {
                const itemId = item._id || item.id || `item-${index}`;
                const trackingDisplayed = getExistingTracking(itemId).length > 0;
                const fulfilledQuantity = item.fulfilledQuantity || 0;
                const totalQuantity = item.quantity || 1;
                const remainingQuantity = totalQuantity - fulfilledQuantity;
                const isFullyFulfilled = fulfilledQuantity >= totalQuantity;

                let isItemEnabled = false;
                if (updateMode) {
                    isItemEnabled = trackingDisplayed;
                } else {
                    isItemEnabled = !isFullyFulfilled && remainingQuantity > 0;
                }

                // Only select enabled items when "select all" is checked
                newSelectedState[index.toString()] = checked && isItemEnabled;
            });
            setSelectedItemsState(newSelectedState);
        }
    };

    const getProductImageUrl = (item: LineItem): { url: string | null; originalUrl: string | null; debug: any } => {
        if (!item) return { url: null, originalUrl: null, debug: { error: 'No item provided' } };

        // Helper function to safely get URL from string | { url: string }
        const getUrl = (url: string | { url: string } | undefined): string | null => {
            if (!url) return null;
            const urlStr = typeof url === 'string' ? url : url.url;
            return urlStr || null;
        };

        // Debug info to track what we're finding
        const debugInfo = {
            item: {
                image: item.image,
                media: item.media,
                product: item.product,
                hasMedia: !!item.media,
                hasProduct: !!item.product,
                hasMainMedia: !!item.media?.mainMedia,
                hasProductMedia: !!item.product?.media
            }
        };

        // Try to get image from different possible locations in the item
        const possiblePaths = [
            () => ({ url: item.image, source: 'item.image' }),
            () => ({ url: getUrl(item.media?.mainMedia?.image), source: 'item.media.mainMedia.image' }),
            () => ({ url: item.media?.items?.[0]?.image?.url, source: 'item.media.items[0].image.url' }),
            () => ({ url: getUrl(item.product?.media?.mainMedia?.image), source: 'item.product.media.mainMedia.image' }),
            () => ({ url: item.media?.mainMedia?.thumbnail?.url, source: 'item.media.mainMedia.thumbnail.url' }),
            () => ({ url: item.media?.items?.[0]?.image?.thumbnailUrl, source: 'item.media.items[0].image.thumbnailUrl' }),
            () => ({ url: item.product?.media?.items?.[0]?.image?.url, source: 'item.product.media.items[0].image.url' }),
            () => ({ url: item.product?.image, source: 'item.product.image' }),
            () => ({ url: getUrl(item.product?.media?.mainMedia?.image), source: 'item.product.media.mainMedia.image (duplicate)' })
        ];

        // Find the first valid URL
        for (const getUrlData of possiblePaths) {
            try {
                const urlData = getUrlData();
                const url = urlData?.url;
                if (url) {
                    const urlStr = String(url).trim();
                    if (urlStr) {
                        // Store the original URL for fallback
                        const originalUrl = urlStr;

                        // Use the same image processing as in ProductImages
                        let processedUrl = urlStr;

                        if (urlStr.startsWith('wix:image://')) {
                            processedUrl = processWixImageUrl(urlStr);
                        } else if (urlStr.startsWith('http://') || urlStr.startsWith('https://') || urlStr.startsWith('data:')) {
                            processedUrl = urlStr;
                        } else if (urlStr.startsWith('//')) {
                            processedUrl = window.location.protocol + urlStr;
                        } else if (urlStr.startsWith('/')) {
                            processedUrl = window.location.origin + urlStr;
                        } else {
                            // For any other case, try to process it as a Wix image URL
                            processedUrl = processWixImageUrl(urlStr);
                        }

                        return {
                            url: processedUrl,
                            originalUrl,
                            debug: {
                                ...debugInfo,
                                source: urlData.source,
                                originalUrl,
                                processedUrl
                            }
                        };
                    }
                }
            } catch (e) {
                console.warn('Error processing image URL:', e);
            }
        }
        return { url: null, originalUrl: null, debug: debugInfo };
    };

    const renderProductOptions = (item: LineItem) => {

        if (item.descriptionLines?.length > 0) {
            return item.descriptionLines?.map((line: any, idx: number) => {
                const optionValue = line.plainText?.original || line.color || '';

                return (
                    <Text key={`desc-${idx}`} size="tiny" secondary>
                        {line.name?.original || 'Option'}: {optionValue}
                    </Text>
                );
            });
        }

        // Fall back to productOptions if descriptionLines is empty
        const options = item.productOptions || item.options || [];
        return options.map((opt: any, idx: number) => (
            <Text key={`opt-${idx}`} size="tiny" secondary>
                {opt.name || opt.option}: {opt.value}
            </Text>
        ));
    };

    const getProductItemLabel = (item: LineItem & { _trackingStatus?: 'fulfilled' | 'unfulfilled' }, index: number | string) => {

        const imageData = getProductImageUrl(item);
        const { url: imageUrl, originalUrl } = imageData;
        const quantity = itemQuantities[index] ?? item.quantity ?? 1;

        return (
            <Box direction="horizontal" gap="12px" align="center" width="100%">
                {/* Product Image */}
                <Box width="80px" height="60px" borderRadius="4px" overflow="scroll" flexShrink={0} style={{ alignItems: 'center' }}>
                    {imageUrl ? (
                        <img
                            src={imageUrl}
                            alt={item.name || `Product ${typeof index === 'number' ? index + 1 : index}`}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                backgroundColor: '#f5f5f5',
                                display: 'block'
                            }}
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (originalUrl && originalUrl.includes('wix:image://')) {
                                    const altUrl = `https://static.wixstatic.com/media/${originalUrl.replace('wix:image://v1/', '').split('#')[0]}`;
                                    if (target.src !== altUrl) {
                                        target.src = altUrl;
                                        return;
                                    }
                                }

                                if (originalUrl && !originalUrl.includes('wix:image://')) {
                                    const altUrl = `https://static.wixstatic.com/media/${originalUrl.replace(/^.*\//, '').split('#')[0]}`;
                                    if (target.src !== altUrl) {
                                        target.src = altUrl;
                                        return;
                                    }
                                }

                                target.style.display = 'none';
                                const placeholder = target.parentElement?.querySelector('.image-placeholder') as HTMLElement;
                                if (placeholder) {
                                    placeholder.style.display = 'flex';
                                }
                            }}
                        />
                    ) : null}

                    <div
                        className="image-placeholder"
                        style={{
                            width: '100%',
                            height: '100%',
                            display: imageUrl ? 'none' : 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#f5f5f5',
                            color: '#999',
                            fontSize: '10px',
                            textAlign: 'center'
                        }}
                    >
                        No image
                    </div>
                </Box>

                {/* Product Name and Options */}
                <Box direction="vertical" flex="1" gap="6px">
                    <Box direction="horizontal" gap="6px" align="left" style={{ alignItems: 'center' }}>
                        <Text size="small">
                            {item.name || (typeof item.productName === 'string' ? item.productName : item.productName?.original) || `Product ${index}`}
                        </Text>
                        {item._trackingStatus === 'fulfilled' && (
                            <Badge skin="success" type="transparent" size="tiny">
                                Fulfilled
                            </Badge>
                        )}
                        {item._trackingStatus === 'unfulfilled' && (
                            <Badge skin="danger" type="transparent" size="tiny">
                                Unfulfilled
                            </Badge>
                        )}
                        {/* Show quantity indicator in Edit mode */}
                        {updateMode && item.quantity && (
                            <Text size="tiny" secondary style={{ marginLeft: '8px' }}>
                                ×{item.quantity}
                            </Text>
                        )}
                    </Box>

                    {/* Product Options */}
                    <Box direction="vertical" gap="2px">
                        {renderProductOptions(item)}
                    </Box>
                    {/* Existing Tracking - Only show for items that actually have tracking */}
                    {(() => {
                        try {
                            const baseIndex = typeof index === 'string' && index.includes('-')
                                ? index.split('-')[0]
                                : index;
                            const itemId = item._id || item.id || `item-${baseIndex}`;
                            const existingTracking = getExistingTracking(itemId);

                            // Only show tracking info if:
                            // 1. Item has tracking status 'fulfilled' (items that actually have tracking)
                            // 2. NOT for unfulfilled items, even in edit mode
                            const shouldShowTracking = item._trackingStatus === 'fulfilled';

                            if (existingTracking.length > 0 && shouldShowTracking) {
                                return (
                                    <Box direction="vertical" gap="4px" marginTop="8px">
                                        <Text size="tiny" secondary>
                                            Current Tracking: {existingTracking[0].trackingNumber}
                                            {existingTracking[0].carrier && ` (${existingTracking[0].carrier})`}
                                        </Text>
                                    </Box>
                                );
                            }
                            return null;
                        } catch (error) {
                            console.warn('Error getting tracking:', error);
                            return null;
                        }
                    })()}
                </Box>

                {/* Quantity Section - Show for split items and unfulfilled items in add mode */}
                {(() => {
                    const numIndex = typeof index === 'number' ? index :
                        (typeof index === 'string' && index.includes('-') ? parseInt(index.split('-')[0]) : parseInt(index.toString()));
                    const baseItem = order?.items?.[numIndex];
                    if (!baseItem) return null;

                    // Calculate display quantities based on mode and item status
                    let maxQuantity: number;
                    let displayMax: number;
                    let currentQty: number;
                    let shouldShow = false;

                    if (updateMode) {
                        // Edit mode: show quantities that were fulfilled with existing tracking (read-only)
                        if (item._trackingStatus === 'fulfilled') {
                            const itemId = baseItem._id || baseItem.id || `item-${numIndex}`;
                            const existingTracking = getExistingTracking(itemId);
                            maxQuantity = existingTracking.reduce((total, tracking) => total + tracking.quantity, 0) || 1;
                            displayMax = maxQuantity;
                            currentQty = maxQuantity;
                            shouldShow = true; // Always show in edit mode for fulfilled items
                        }
                    } else {
                        // Add mode: show remaining unfulfilled quantities (editable)
                        if (item._trackingStatus === 'unfulfilled' || (!item._trackingStatus && typeof index === 'number')) {
                            const itemId = baseItem._id || baseItem.id || `item-${numIndex}`;
                            const existingTracking = getExistingTracking(itemId);
                            const actualFulfilledQuantity = existingTracking.reduce((total, tracking) => total + tracking.quantity, 0);
                            const totalQuantity = baseItem.quantity || 1;
                            maxQuantity = Math.max(1, totalQuantity - actualFulfilledQuantity);
                            displayMax = maxQuantity;
                            currentQty = itemQuantities[index] ?? maxQuantity;
                            shouldShow = maxQuantity > 0; // Show if there are items to fulfill
                        }
                    }

                    if (!shouldShow) return null;

                    return (
                        <Box direction="horizontal" gap="4px" align="center" style={{ alignItems: 'center' }}>
                            <div
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                style={{ width: '60px' }}
                            >
                                <NumberInput
                                    size="small"
                                    min={1}
                                    max={maxQuantity}
                                    value={currentQty}
                                    onChange={updateMode ? undefined : (value) => handleQuantityChange(index, value || 1)}
                                    disabled={updateMode || isSaving}
                                    readOnly={updateMode}
                                />
                            </div>
                            <Text size="small" secondary color="#666" style={{ marginLeft: '4px' }}>
                                / {displayMax}
                                {/* {updateMode ? 'fulfilled' : 'remaining'} */}
                            </Text>
                        </Box>
                    );
                })()}
            </Box>
        );
    };

    const renderProductList = () => {
        if (!order.items?.length) {
            return <Text>No products in this order</Text>;
        }

        return (
            <Box direction="vertical" gap="12px" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {/* Mode indicator */}
                {/* <Box padding="8px" style={{
                    backgroundColor: '#f0f8ff',
                    borderRadius: '4px',
                    border: '1px solid #b3d9ff'
                }}>
                    <Text size="tiny" weight="normal">
                        {updateMode
                            ? 'Edit tracking for items that have already been fulfilled'
                            : 'Add tracking for unfulfilled items'
                        }
                    </Text>
                </Box> */}

                {/* Show loading state while fetching fulfillments */}
                {!fulfillmentsLoaded && (
                    <Box padding="16px" align="center">
                        <Text size="small">Loading fulfillment data...</Text>
                    </Box>
                )}

                {/* Individual Product Items - Split partially fulfilled items */}
                {fulfillmentsLoaded && order.items.flatMap((item, originalIndex) => {
                    const itemId = item._id || item.id || `item-${originalIndex}`;
                    const existingTracking = getExistingTracking(itemId);
                    const hasTracking = existingTracking.length > 0;

                    // In edit mode with multiple tracking numbers, filter by selected tracking number
                    if (updateMode && selectedTrackingNumber) {
                        const hasSelectedTracking = existingTracking.some(t => t.trackingNumber === selectedTrackingNumber);
                        if (!hasSelectedTracking) {
                            return []; // Skip this item if it doesn't have the selected tracking number
                        }

                        // Filter tracking info to only show the selected tracking number
                        const filteredTracking = existingTracking.filter(t => t.trackingNumber === selectedTrackingNumber);
                        // Update the existingTracking for this item to only include the selected tracking
                        existingTracking.length = 0;
                        existingTracking.push(...filteredTracking);
                    }

                    // Calculate fulfilled quantity from FRESH fulfillment data instead of stale order data
                    const actualFulfilledQuantity = existingTracking.reduce((total, tracking) => total + tracking.quantity, 0);
                    const totalQuantity = item.quantity || 1;
                    const remainingQuantity = Math.max(0, totalQuantity - actualFulfilledQuantity);
                    const isFullyFulfilled = actualFulfilledQuantity >= totalQuantity;
                    const isPartiallyFulfilled = actualFulfilledQuantity > 0 && actualFulfilledQuantity < totalQuantity;

                    const itemEntries = [];

                    // For partially fulfilled items, create separate entries
                    if (isPartiallyFulfilled) {
                        // Entry 1: Fulfilled items (for edit mode)
                        if (actualFulfilledQuantity > 0) {
                            const fulfilledIndex = `${originalIndex}-fulfilled`;
                            const isItemEnabled = updateMode;

                            const isSelected = isItemEnabled && (selectedItemsState[fulfilledIndex.toString()] !== false);

                            itemEntries.push(
                                <Box key={fulfilledIndex} direction="vertical" gap="4px">
                                    <Checkbox
                                        checked={isSelected}
                                        onChange={({ target: { checked } }) => handleItemSelectionChange(fulfilledIndex, checked)}
                                        selectionArea="hover"
                                        dataHook={`item-checkbox-${fulfilledIndex}`}
                                        disabled={isSaving || !isItemEnabled}
                                    >
                                        <Box style={{
                                            opacity: isItemEnabled ? 1 : 0.5,
                                            filter: isItemEnabled ? 'none' : 'grayscale(50%)'
                                        }}>
                                            {getProductItemLabel({
                                                ...item,
                                                quantity: actualFulfilledQuantity, // Use calculated fulfilled quantity
                                                _trackingStatus: 'fulfilled'
                                            }, fulfilledIndex)}
                                        </Box>
                                    </Checkbox>
                                </Box>
                            );
                        }

                        // Entry 2: Unfulfilled items (for add mode)
                        if (remainingQuantity > 0) {
                            const unfulfilledIndex = `${originalIndex}-unfulfilled`;
                            const isItemEnabled = !updateMode; // Only enabled in add mode
                            const isSelected = isItemEnabled && (selectedItemsState[unfulfilledIndex.toString()] !== false);

                            itemEntries.push(
                                <Box key={unfulfilledIndex} direction="vertical" gap="4px">
                                    <Checkbox
                                        checked={isSelected}
                                        onChange={({ target: { checked } }) => handleItemSelectionChange(unfulfilledIndex, checked)}
                                        selectionArea="hover"
                                        dataHook={`item-checkbox-${unfulfilledIndex}`}
                                        disabled={isSaving || !isItemEnabled}
                                    >
                                        <Box style={{
                                            opacity: isItemEnabled ? 1 : 0.5,
                                            filter: isItemEnabled ? 'none' : 'grayscale(50%)'
                                        }}>
                                            {getProductItemLabel({
                                                ...item,
                                                quantity: remainingQuantity,
                                                _trackingStatus: 'unfulfilled'
                                            }, unfulfilledIndex)}
                                        </Box>
                                    </Checkbox>
                                </Box>
                            );
                        }
                    } else {
                        // For fully fulfilled or fully unfulfilled items, show as single entry
                        const isItemEnabled = updateMode ? (hasTracking || isFullyFulfilled || (item.fulfilledQuantity! > 0 && !hasTracking)) : (!hasTracking && remainingQuantity > 0);
                        const isSelected = isItemEnabled && (selectedItemsState[originalIndex.toString()] !== false);

                        // Determine tracking status for badge display
                        const trackingStatus = isFullyFulfilled ? 'fulfilled' : 'unfulfilled';

                        itemEntries.push(
                            <Box key={originalIndex} direction="vertical" gap="4px">
                                <Checkbox
                                    checked={isSelected}
                                    onChange={({ target: { checked } }) => handleItemSelectionChange(originalIndex, checked)}
                                    selectionArea="hover"
                                    dataHook={`item-checkbox-${originalIndex}`}
                                    disabled={isSaving || !isItemEnabled}
                                >
                                    <Box style={{
                                        opacity: isItemEnabled ? 1 : 0.5,
                                        filter: isItemEnabled ? 'none' : 'grayscale(50%)'
                                    }}>
                                        {getProductItemLabel({
                                            ...item,
                                            _trackingStatus: trackingStatus
                                        }, originalIndex)}
                                    </Box>
                                </Checkbox>
                            </Box>
                        );
                    }

                    return itemEntries;
                })}
            </Box>
        );
    };

    // Handle click outside to close modal
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        }

        // Add event listener when modal is open
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        // Clean up event listener
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    // Set default carrier and generate tracking URL when carrier or tracking number changes
    useEffect(() => {
        if (SHIPPING_CARRIERS.length > 0 && !carrier) {
            setCarrier(SHIPPING_CARRIERS[0].id);
        }

        if (trackingNumber && carrier) {
            const url = generateTrackingUrl(carrier, trackingNumber);
            setTrackingUrl(url);
        } else {
            setTrackingUrl('');
        }
    }, [trackingNumber, carrier]);

    const generateTrackingUrl = (carrierId: string, trackingNum: string): string => {
        const customCarrier = settingsStore.customCarriers?.find(c => c.id === carrierId);
        if (customCarrier) {
            return customCarrier.trackingUrl.replace('{tracking}', trackingNum);
        }

        const trackingUrls: Record<string, string> = {
            'fedex': `https://www.fedex.com/apps/fedextrack/?action=track&trackingnumber=${trackingNum}`,
            'ups': `https://www.ups.com/track?track=yes&trackNums=${trackingNum}`,
            'usps': `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNum}`,
            'dhl': `https://www.logistics.dhl/global-en/home/tracking.html?tracking-id=${trackingNum}`,
            'canadaPost': `https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor=${trackingNum}`
        };

        return trackingUrls[carrierId] || '';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!trackingNumber || !carrier) return;

        // Calculate selected items based on the actual state
        let selectedItems: Array<{ id: string, quantity: number }> | undefined;

        // Check if we're in single tracking update mode
        const isSingleTrackingUpdateMode = updateMode && fulfillmentsLoaded && (() => {
            if (!order.items) return false;
            const trackingNumbers = new Set<string>();
            order.items.forEach((item, index) => {
                const itemId = item._id || item.id || `item-${index}`;
                const existingTracking = getExistingTracking(itemId);
                existingTracking.forEach(tracking => {
                    trackingNumbers.add(tracking.trackingNumber);
                });
            });
            return trackingNumbers.size === 1;
        })();

        // NEW: Handle specific tracking number selection
        if (updateMode && selectedTrackingNumber) {
            console.log('Submitting for SPECIFIC tracking number:', selectedTrackingNumber);

            // Find all items that have this specific tracking number
            const itemsWithSelectedTracking: Array<{ id: string, quantity: number }> = [];

            order.items?.forEach((item, index) => {
                const itemId = item._id || item.id || `item-${index}`;
                const existingTracking = getExistingTracking(itemId);

                existingTracking.forEach(tracking => {
                    if (tracking.trackingNumber === selectedTrackingNumber) {
                        itemsWithSelectedTracking.push({
                            id: itemId,
                            quantity: tracking.quantity
                        });
                    }
                });
            });

            if (itemsWithSelectedTracking.length === 0) {
                console.warn('No items found for selected tracking number:', selectedTrackingNumber);
                return;
            }

            selectedItems = itemsWithSelectedTracking;
            console.log('Submitting with items for tracking', selectedTrackingNumber, ':', selectedItems);
        } else if (applyToAllItems || isSingleTrackingUpdateMode) {
            // Apply to all items - don't send selectedItems (undefined means all)
            selectedItems = undefined;
            console.log('Submitting with ALL items (full fulfillment)');
        } else {
            // Apply only to selected items
            const selectedItemsData: Array<{ id: string, quantity: number }> = [];

            Object.keys(selectedItemsState).forEach(indexKey => {
                if (selectedItemsState[indexKey]) {
                    if (indexKey.includes('-')) {
                        // Handle split items (fulfilled/unfulfilled) - USE FRESH DATA
                        const [originalIndex, status] = indexKey.split('-');
                        const originalIndexNum = parseInt(originalIndex);
                        const item = order?.items?.[originalIndexNum];

                        if (item) {
                            const itemId = item._id || item.id || `item-${originalIndexNum}`;
                            let quantity;

                            if (status === 'fulfilled') {
                                // For fulfilled items in edit mode, use actual fulfilled quantity from fresh data
                                const existingTracking = getExistingTracking(itemId);
                                quantity = existingTracking.reduce((total, tracking) => total + tracking.quantity, 0);
                            } else if (status === 'unfulfilled') {
                                // For unfulfilled items, use the quantity from NumberInput (which is correctly calculated)
                                quantity = itemQuantities[indexKey] ?? 1;
                            } else {
                                quantity = itemQuantities[indexKey] ?? 1;
                            }

                            if (quantity > 0) {
                                selectedItemsData.push({
                                    id: itemId,
                                    quantity: quantity
                                });
                            }
                        }
                    } else {
                        // Handle normal items - use NumberInput value or calculate remaining
                        const index = parseInt(indexKey);
                        const item = order?.items?.[index];
                        if (item) {
                            const itemId = item._id || item.id || `item-${index}`;

                            // Use NumberInput value if available, otherwise calculate remaining quantity
                            let quantity = itemQuantities[indexKey];

                            if (quantity === undefined) {
                                if (updateMode) {
                                    // Edit mode: use actual fulfilled quantity from fresh data
                                    const existingTracking = getExistingTracking(itemId);
                                    quantity = existingTracking.reduce((total, tracking) => total + tracking.quantity, 0);
                                } else {
                                    // Add mode: calculate remaining quantity using fresh data
                                    const existingTracking = getExistingTracking(itemId);
                                    const actualFulfilledQuantity = existingTracking.reduce((total, tracking) => total + tracking.quantity, 0);
                                    const totalQuantity = item.quantity || 1;
                                    quantity = Math.max(1, totalQuantity - actualFulfilledQuantity);
                                }
                            }

                            if (quantity > 0) {
                                selectedItemsData.push({
                                    id: itemId,
                                    quantity: quantity
                                });
                            }
                        }
                    }
                }
            });

            if (selectedItemsData.length === 0) {
                console.warn('No items selected for partial fulfillment');
                return;
            }

            selectedItems = selectedItemsData;
            console.log('Submitting with SELECTED items (partial fulfillment):', selectedItems);
        }

        setIsSaving(true);
        try {
            // ✅ SIMPLIFIED: Handle custom carriers vs standard carriers
            let customCarrierName: string | undefined;
            let carrierToSend = carrier;

            // Check if it's a dynamic custom carrier
            const customCarrier = settingsStore.customCarriers?.find(c => c.id === carrier);
            if (customCarrier) {
                // For dynamic custom carriers, send the actual name and use 'other' as the carrier type
                customCarrierName = customCarrier.value;
                carrierToSend = 'other'; // Backend expects 'other' for custom carriers
            }
            // ✅ No more hardcoded 'custom' handling needed

            // NEW: Check if we're updating an existing tracking number
            if (updateMode && selectedTrackingNumber) {
                console.log('🔄 UPDATING existing tracking number:', selectedTrackingNumber);

                // Find the fulfillment ID for the selected tracking number
                let fulfillmentIdToUpdate: string | undefined;

                fulfillmentsData.forEach((fulfillment) => {
                    if (fulfillment.trackingInfo?.trackingNumber === selectedTrackingNumber) {
                        fulfillmentIdToUpdate = fulfillment._id;
                    }
                });

                if (!fulfillmentIdToUpdate) {
                    throw new Error(`Could not find fulfillment for tracking number: ${selectedTrackingNumber}`);
                }

                console.log('🔄 Found fulfillment ID to update:', fulfillmentIdToUpdate);

                // Use the existing onSave but pass a special selectedItems array with fulfillment ID
                const updateParams = selectedItems || [];
                // Add fulfillment ID as metadata
                (updateParams as any).fulfillmentId = fulfillmentIdToUpdate;
                (updateParams as any).isUpdate = true;

                await onSave(trackingNumber, carrierToSend, updateParams, trackingUrl, customCarrierName);
            } else {
                // Regular create flow
                await onSave(trackingNumber, carrierToSend, selectedItems, trackingUrl, customCarrierName);
            }

            setTrackingNumber('');
            setCarrier('');
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    const navigateToSettings = (e: React.MouseEvent) => {
        e.preventDefault();
        try {
            dashboard.navigate({
                pageId: '58613115-8f7e-40f4-bf0c-89a59a0aeb94',
                relativeUrl: '/settings'
            });
        } catch (error) {
            console.error('Failed to navigate to settings:', error);
            dashboard.showToast({
                message: 'Settings page temporarily unavailable',
                type: 'warning'
            });
        }
    };

    if (!isOpen) return null;

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // Check if we're in single tracking update mode
    const isSingleTrackingUpdateMode = updateMode && fulfillmentsLoaded && (() => {
        if (!order.items) return false;
        const trackingNumbers = new Set<string>();
        order.items.forEach((item, index) => {
            const itemId = item._id || item.id || `item-${index}`;
            const existingTracking = getExistingTracking(itemId);
            existingTracking.forEach(tracking => {
                trackingNumbers.add(tracking.trackingNumber);
            });
        });
        return trackingNumbers.size === 1;
    })();

    const hasValidSelection = applyToAllItems || selectedTrackingNumber || Object.values(selectedItemsState).some(Boolean) || isSingleTrackingUpdateMode;
    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 30, 60, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 999999
            }}
            onClick={handleOverlayClick}
        >
            <div
                ref={modalRef}
                style={{
                    position: 'relative',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    width: '90%',
                    maxWidth: '600px',
                    maxHeight: '82vh',
                    overflow: 'visible',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                    display: 'flex',
                    flexDirection: 'column'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header with title and close button */}
                <div style={{
                    padding: '24px 24px 16px',
                    borderBottom: '1px solid #e5e7eb',
                    position: 'sticky',
                    borderRadius: '8px 8px 0 0',
                    top: 0,
                    backgroundColor: 'white',
                    zIndex: 10
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        position: 'relative',
                        paddingRight: '40px',
                        width: '100%'
                    }}>
                        <div>
                            <Heading appearance="H3">
                                {updateMode ? 'Edit Tracking Number' : 'Add Tracking Number'}
                            </Heading>
                            <Text size="small" secondary style={{ marginLeft: '8px', display: 'block' }}>
                                Order #{order.number} {(() => {
                                    if (!order.items || !fulfillmentsLoaded) return '';

                                    if (updateMode) {
                                        // Count items with tracking using fresh data
                                        const itemsWithTracking = order.items.reduce((total, item, index) => {
                                            const itemId = item._id || item.id || `item-${index}`;
                                            const existingTracking = getExistingTracking(itemId);
                                            return total + existingTracking.reduce((sum, tracking) => sum + tracking.quantity, 0);
                                        }, 0);
                                        return `(${itemsWithTracking} fulfilled items)`;
                                    } else {
                                        // Count remaining items using fresh fulfillment data
                                        const remainingItems = order.items.reduce((total, item, index) => {
                                            const itemId = item._id || item.id || `item-${index}`;
                                            const existingTracking = getExistingTracking(itemId);
                                            const actualFulfilledQty = existingTracking.reduce((sum, tracking) => sum + tracking.quantity, 0);
                                            const totalQty = item.quantity || 1;
                                            return total + Math.max(0, totalQty - actualFulfilledQty);
                                        }, 0);
                                        return `(${remainingItems} items remaining)`;
                                    }
                                })()}
                            </Text>
                        </div>
                        <IconButton
                            size="medium"
                            skin="dark"
                            priority="tertiary"
                            onClick={onClose}
                        >
                            <Icons.X />
                        </IconButton>
                    </div>
                </div>

                {/* Modal content */}
                <div style={{ flex: 1, overflow: 'visible', padding: '0', display: 'flex', flexDirection: 'column', maxHeight: 'calc(90vh - 120px)' }}>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        {/* Top section - Fixed height, allows dropdown overflow */}
                        <div style={{ padding: '24px 24px 0 24px', overflow: 'visible', flexShrink: 0 }}>
                            <Box direction="vertical" gap="16px" padding="0" width="100%">
                                {/* Customer Email */}
                                {order.buyerInfo?.email && (
                                    <Box direction="vertical" gap="8px" marginBottom="16px">
                                        <Text size="small" secondary>Customer: {order.buyerInfo.email}</Text>
                                    </Box>
                                )}


                                {/* Tracking Info Form */}
                                <Box direction="vertical" gap="16px" marginTop="0px" width="100%">
                                    <Box direction="horizontal" gap="16px" align="center">
                                        {/* Carrier Dropdown */}
                                        <Box flex="1">
                                            <FormField label="Shipping carrier" labelSize="small"
                                                dataHook="shipping-carrier-dropdown">
                                                <Dropdown
                                                    aria-label="Shipping carrier selection"
                                                    aria-required="true"
                                                    placeholder="Select shipping carrier"
                                                    selectedId={carrier}
                                                    valueParser={(option) => option.label || option.value}
                                                    onSelect={(option) => {
                                                        if (option) {
                                                            setTimeout(() => {
                                                                setCarrier(String(option.id));
                                                            }, 100);
                                                        }
                                                    }}

                                                    options={[
                                                        // Standard carriers (no delete button)
                                                        ...SHIPPING_CARRIERS,
                                                        // Custom carriers with delete button
                                                        ...(settingsStore.customCarriers || []).map(customCarrier =>
                                                            listItemSelectBuilder({
                                                                id: customCarrier.id,
                                                                title: customCarrier.value,
                                                                label: customCarrier.value,
                                                                suffix: (
                                                                    <IconButton
                                                                        size="tiny"
                                                                        priority="secondary"
                                                                        skin="destructive"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            e.preventDefault();
                                                                            settingsStore.removeCustomCarrier(customCarrier.id);
                                                                            // Reset carrier if the deleted one was selected
                                                                            if (carrier === customCarrier.id) {
                                                                                setCarrier(settingsStore.defaultShippingCarrier || SHIPPING_CARRIERS[0]?.id || '');
                                                                            }

                                                                        }}
                                                                    >
                                                                        <Icons.Delete size="12px" />
                                                                    </IconButton>
                                                                )
                                                            })
                                                        )
                                                    ]}
                                                    fixedFooter={
                                                        !showAddCarrier ? (
                                                            // Show "Add shipping carrier" button
                                                            <Box padding="12px 16px" borderTop="1px solid #e5e7eb">
                                                                <TextButton
                                                                    skin="standard"
                                                                    size="medium"
                                                                    prefixIcon={<Icons.Add />}
                                                                    onClick={() => setShowAddCarrier(true)}
                                                                >
                                                                    Add shipping carrier
                                                                </TextButton>
                                                            </Box>
                                                        ) : (
                                                            // Show add custom carrier form
                                                            <Box
                                                                direction="vertical"
                                                                height="226px"
                                                                gap="12px"
                                                                paddingTop="24px"
                                                                padding="16px"
                                                                backgroundColor="#white"
                                                                border="1px solid #e5e7eb"
                                                                borderRadius="0 0 8px 8px"
                                                            >
                                                                <FormField label="Carrier Name" labelSize="small">
                                                                    <Input
                                                                        value={newCarrierName}
                                                                        onChange={(e) => setNewCarrierName(e.target.value)}
                                                                        placeholder="Custom Carrier"
                                                                        size="small"
                                                                    />
                                                                </FormField>
                                                                <FormField label="Tracking URL Template" labelSize="small">
                                                                    <Input
                                                                        value={newCarrierUrl}
                                                                        onChange={(e) => {
                                                                            setNewCarrierUrl(e.target.value);
                                                                            // Clear any existing error when user starts typing again
                                                                            if (urlValidationError) {
                                                                                setUrlValidationError('');
                                                                            }
                                                                        }}
                                                                        placeholder="https://track.com/?nr={tracking}"
                                                                        size="small"
                                                                        status={urlValidationError ? "error" : undefined}
                                                                    />
                                                                    <Text size="tiny" secondary style={{ marginTop: '4px' }}>
                                                                        Use {'{tracking}'} as placeholder for tracking number
                                                                    </Text>
                                                                    {urlValidationError && (
                                                                        <Text size="tiny" skin="error" style={{ marginTop: '4px' }}>
                                                                            {urlValidationError}
                                                                        </Text>
                                                                    )}
                                                                </FormField>
                                                                <div style={{
                                                                    position: 'sticky',
                                                                    bottom: 0,
                                                                    backgroundColor: 'white',
                                                                    padding: '12px 0 0 0',
                                                                    borderTop: '1px solid #e5e7eb',
                                                                    borderRadius: '0 0 8px 8px',
                                                                    zIndex: 10
                                                                }}>
                                                                    <Box direction="horizontal" gap="8px" align="right">
                                                                        <Button
                                                                            size="small"
                                                                            priority="secondary"
                                                                            onClick={() => {
                                                                                setShowAddCarrier(false);
                                                                                setNewCarrierName('');
                                                                                setNewCarrierUrl('');
                                                                                setUrlValidationError('');
                                                                            }}
                                                                        >
                                                                            Cancel
                                                                        </Button>
                                                                        <Button
                                                                            size="small"
                                                                            priority="primary"
                                                                            disabled={!newCarrierName.trim() || !newCarrierUrl.trim()}
                                                                            onClick={() => {
                                                                                if (newCarrierName.trim() && newCarrierUrl.trim()) {
                                                                                    // Validate URL when trying to submit
                                                                                    const url = newCarrierUrl.trim();
                                                                                    let error = '';

                                                                                    if (!url.startsWith('https://')) {
                                                                                        error = 'URL must start with "https://"';
                                                                                    } else if (!url.includes('{tracking}')) {
                                                                                        error = 'URL must contain "{tracking}" placeholder';
                                                                                    }

                                                                                    if (error) {
                                                                                        setUrlValidationError(error);
                                                                                        return; // Don't proceed if validation fails
                                                                                    }

                                                                                    const newCarrier = {
                                                                                        id: `custom_${Date.now()}`,
                                                                                        value: newCarrierName.trim(),
                                                                                        trackingUrl: url
                                                                                    };
                                                                                    settingsStore.addCustomCarrier(newCarrier);
                                                                                    setCarrier(newCarrier.id);
                                                                                    setNewCarrierName('');
                                                                                    setNewCarrierUrl('');
                                                                                    setUrlValidationError('');
                                                                                    setShowAddCarrier(false);
                                                                                }
                                                                            }}
                                                                        >
                                                                            Add Carrier
                                                                        </Button>

                                                                    </Box>
                                                                </div>
                                                            </Box>
                                                        )
                                                    }
                                                    size="medium"
                                                />
                                            </FormField>
                                        </Box>

                                        {/* Tracking Number */}
                                        <Box flex="1">
                                            <FormField label="Tracking Number" labelSize="small">
                                                <Input
                                                    value={trackingNumber}
                                                    onChange={(e) => setTrackingNumber(e.target.value)}
                                                    placeholder="e.g., AA1234567"
                                                    required
                                                    disabled={isSaving}
                                                />
                                            </FormField>
                                        </Box>
                                    </Box>

                                    {/* Tracking URL - Only show when there's a tracking number */}
                                    {trackingNumber && (
                                        <FormField label="Tracking URL" labelSize="small">
                                            <Box direction="vertical" gap="4px">
                                                <Box direction="horizontal" gap="18px" align="center" style={{ alignItems: 'center' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <Input
                                                            value={trackingUrl}
                                                            readOnly
                                                            disabled={!trackingNumber}
                                                            onFocus={() => setIsTrackingUrlFocused(true)}
                                                            onBlur={() => setIsTrackingUrlFocused(false)}
                                                        />
                                                    </div>
                                                    {trackingUrl && (
                                                        <TextButton
                                                            as="a"
                                                            href={trackingUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            size="medium"
                                                            underline="always"
                                                        >
                                                            Open
                                                        </TextButton>
                                                    )}
                                                </Box>
                                                {isTrackingUrlFocused && (
                                                    <Text size="tiny" secondary>
                                                        Custom tracking links can be set in the {' '}
                                                        <a
                                                            href="#"
                                                            onClick={navigateToSettings}
                                                            style={{ color: '#2B7CD3', textDecoration: 'none', cursor: 'pointer' }}
                                                            onMouseDown={(e) => e.preventDefault()}
                                                        >
                                                            settings
                                                        </a>
                                                    </Text>
                                                )}
                                            </Box>
                                        </FormField>
                                    )}
                                </Box>

                                {/* Apply to all checkbox and products list */}
                                <Box direction="vertical" gap="16px" marginTop="8px">
                                    {/* Send shipping confirmation email checkbox */}
                                    <div>
                                        <Box direction="horizontal" gap="12px" align="left">
                                            <Box verticalAlign="middle">
                                                <Checkbox
                                                    checked={true}
                                                    disabled={true}
                                                    dataHook="send-email-checkbox"
                                                />
                                            </Box>
                                            <Box verticalAlign="middle" direction="horizontal" gap="8px">
                                                <Text size="medium" skin="disabled"> Shipping confirmation email sent automatically by Wix</Text>
                                            </Box>
                                        </Box>
                                    </div>

                                    {/* Apply to all checkbox - Only show when there are multiple filtered items AND not in single tracking update mode */}
                                    {order.items && !updateMode && (() => {
                                        const filteredItems = order.items.filter((item, index) => {
                                            const itemId = item._id || item.id || `item-${index}`;
                                            const hasExistingTracking = getExistingTracking(itemId).length > 0;
                                            const fulfilledQuantity = item.fulfilledQuantity || 0;
                                            const remainingQuantity = (item.quantity || 1) - fulfilledQuantity;

                                            return updateMode ? (hasExistingTracking || fulfilledQuantity > 0) : remainingQuantity > 0;
                                        });

                                        const hasMultipleItems = filteredItems.length > 1;
                                        const hasItemWithMultipleQuantity = filteredItems.some(item => (item.quantity || 1) > 1);

                                        return hasMultipleItems || hasItemWithMultipleQuantity;
                                    })() && (
                                            <div
                                                onClick={() => !isSaving && setApplyToAllItems(!applyToAllItems)}
                                                style={{ cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.6 : 1 }}
                                            >
                                                <Box direction="horizontal" gap="12px" align="left">
                                                    <Box verticalAlign="middle">
                                                        <Checkbox
                                                            checked={applyToAllItems}
                                                            onChange={({ target: { checked } }) => handleSelectAllItems(checked)}
                                                            dataHook="apply-to-all-checkbox"
                                                            disabled={isSaving}
                                                        />
                                                    </Box>
                                                    <Box verticalAlign="middle" direction="horizontal" gap="8px">
                                                        <Text size="medium">Apply to all remaining self-fulfilled items in this order</Text>
                                                        <Tooltip content="Tick this box to apply this tracking number to all items that you're fulfilling in this order.">
                                                            <div
                                                                onClick={(e: React.MouseEvent) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                }}
                                                            >
                                                                <Box
                                                                    verticalAlign="middle"
                                                                    style={{ color: '#2B7CD3' }}
                                                                >
                                                                    <Icons.InfoCircle size="24px" />
                                                                </Box>
                                                            </div>
                                                        </Tooltip>
                                                    </Box>
                                                </Box>
                                            </div>
                                        )}

                                    {/* Tracking Number Selector - Only show in Edit mode when multiple tracking numbers exist */}
                                    {updateMode && (() => {
                                        if (!order.items || !fulfillmentsLoaded) return null;

                                        // Get all unique tracking numbers from the order
                                        const trackingNumbers = new Map<string, {
                                            trackingNumber: string;
                                            carrier: string;
                                            itemCount: number;
                                            items: Array<{ itemId: string; quantity: number; itemName: string }>
                                        }>();

                                        order.items.forEach((item, index) => {
                                            const itemId = item._id || item.id || `item-${index}`;
                                            const existingTracking = getExistingTracking(itemId);

                                            existingTracking.forEach(tracking => {
                                                const key = tracking.trackingNumber;
                                                if (!trackingNumbers.has(key)) {
                                                    trackingNumbers.set(key, {
                                                        trackingNumber: tracking.trackingNumber,
                                                        carrier: tracking.carrier || '',
                                                        itemCount: tracking.quantity,
                                                        items: [{
                                                            itemId,
                                                            quantity: tracking.quantity,
                                                            itemName: item.name || (typeof item.productName === 'string' ? item.productName : item.productName?.original) || `Product ${index + 1}`
                                                        }]
                                                    });
                                                } else {
                                                    const existing = trackingNumbers.get(key)!;
                                                    existing.itemCount += tracking.quantity;
                                                    existing.items.push({
                                                        itemId,
                                                        quantity: tracking.quantity,
                                                        itemName: item.name || (typeof item.productName === 'string' ? item.productName : item.productName?.original) || `Product ${index + 1}`
                                                    });
                                                }
                                            });
                                        });

                                        const trackingArray = Array.from(trackingNumbers.values());

                                        // Only show selector if there are multiple tracking numbers
                                        if (trackingArray.length <= 1) return null;

                                        return (
                                            <Box
                                                direction="vertical"
                                                gap="12px"
                                                padding="12px"
                                                borderRadius="6px"
                                                border="1px solid #d9e5fc"
                                                backgroundColor="#ffffff"
                                                maxHeight="300px"
                                                overflow="auto"
                                            >
                                                <Text size="small">
                                                    Select a tracking number to edit:
                                                </Text>
                                                <Box direction="vertical" gap="8px">
                                                    {trackingArray.map((tracking, index) => (
                                                        <div
                                                            key={tracking.trackingNumber}
                                                            onClick={() => setSelectedTrackingNumber(tracking.trackingNumber)}
                                                            style={{
                                                                backgroundColor: selectedTrackingNumber === tracking.trackingNumber ? '#d9e5fa' : 'white',
                                                                borderRadius: '6px',
                                                                border: selectedTrackingNumber === tracking.trackingNumber ? '1px solid #2e60de' : '1px solid #e1e5e9',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s ease'
                                                            }}
                                                        >
                                                            <Box direction="horizontal" gap="12px" align="center" padding="12px">
                                                                <Box width="40px" height="40px" style={{
                                                                    backgroundColor: '#f5f5f5',
                                                                    borderRadius: '4px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}>
                                                                    <Icons.Package />
                                                                </Box>
                                                                <Box direction="vertical" flex="1" gap="2px">
                                                                    <Text size="medium" weight="normal">
                                                                        #{tracking.trackingNumber}
                                                                    </Text>
                                                                    <Text size="small" secondary>
                                                                        {tracking.itemCount} item{tracking.itemCount !== 1 ? 's' : ''} • {tracking.carrier || 'Unknown carrier'}
                                                                    </Text>
                                                                    <Text size="tiny" secondary>
                                                                        {tracking.items.map(item => `${item.itemName} (×${item.quantity})`).join(', ')}
                                                                    </Text>
                                                                </Box>
                                                                {selectedTrackingNumber === tracking.trackingNumber && (
                                                                    <Icons.Check style={{ color: '#2e60de' }} />
                                                                )}
                                                            </Box>
                                                        </div>
                                                    ))}
                                                </Box>
                                            </Box>
                                        );
                                    })()}

                                    {!applyToAllItems && (() => {
                                        // Check if tracking selector box is being shown
                                        const shouldShowTrackingSelector = updateMode && order.items && fulfillmentsLoaded && (() => {
                                            const trackingNumbers = new Map<string, any>();
                                            order.items.forEach((item, index) => {
                                                const itemId = item._id || item.id || `item-${index}`;
                                                const existingTracking = getExistingTracking(itemId);
                                                existingTracking.forEach(tracking => {
                                                    trackingNumbers.set(tracking.trackingNumber, true);
                                                });
                                            });
                                            return Array.from(trackingNumbers.keys()).length > 1;
                                        })();

                                        // Hide product list if tracking selector is shown OR if a tracking number is selected
                                        const shouldHideProductList = shouldShowTrackingSelector || selectedTrackingNumber;

                                        return !shouldHideProductList;
                                    })() && (
                                            <Box
                                                direction="vertical"
                                                gap="12px"
                                                padding="12px"
                                                borderRadius="6px"
                                                border="1px solid #d9e5fc"
                                                backgroundColor="#ffffff"
                                                maxHeight="300px"
                                                overflow="auto"
                                            >
                                                {renderProductList()}
                                            </Box>
                                        )}

                                </Box>

                                {/* Action Buttons */}
                                <Box direction="horizontal" gap="12px" marginTop="12px" marginBottom="24px" align="right">
                                    <Button
                                        priority="secondary"
                                        size="small"
                                        onClick={onClose}
                                        disabled={isSaving}
                                        skin="standard"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={!trackingNumber || !carrier || !hasValidSelection || isSaving}
                                        skin="standard"
                                        priority="primary"
                                        size="small"
                                        suffixIcon={isSaving ? (
                                            <Box marginLeft="8px">
                                                <Loader size="tiny" />
                                            </Box>
                                        ) : undefined}
                                    >
                                        {isSaving ? 'Saving' : (updateMode ? 'Update Tracking' : 'Save Tracking')}
                                    </Button>
                                </Box>
                            </Box>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
});

export default TrackingNumberModal;