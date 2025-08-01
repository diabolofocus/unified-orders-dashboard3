// components/OrdersTable/OrdersTableWithTabs.tsx
import React, { useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Tabs, Text, Table, TableToolbar, Heading, Tag, Button, Tooltip, Loader, Search, IconButton } from '@wix/design-system';
import type { Order } from '../../types/Order';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { settingsStore } from '../../stores/SettingsStore';
import * as Icons from '@wix/wix-ui-icons-common';
import { useStores } from '../../hooks/useStores';
import { OrdersTable } from './OrdersTable';
import { processWixImageUrl } from '../../utils/image-processor';
import { dashboard } from '@wix/dashboard';

// Helper function to extract image URL from item
const extractImageUrl = (item: any, raw = false): string => {
    if (!item) return '';

    // Try to get image from different possible locations
    const imageUrl = item.image || (item.imageInfo && item.imageInfo.imageUrl) || '';

    // If raw is true, return the original URL
    if (raw) {
        return imageUrl;
    }

    // Otherwise process the URL if it's a Wix image
    return processWixImageUrl(imageUrl);
};

interface PreparationItem {
    id: string;
    productId?: string;
    productName: string;
    productOptions: string; // Serialized options for grouping
    imageUrl: string;
    rawImageUrl: string; // Store original image URL for fallback
    totalQuantity: number;
    orders: Array<{
        orderNumber: string;
        orderId: string;
        quantity: number;
        customerName: string;
        orderTimestamp: number; // For sorting
        originalQuantity?: number; // Track original quantity for reference
        fulfilledQuantity?: number; // Track how much was already fulfilled
    }>;
    optionsDisplay: any; // For display purposes
    mostRecentOrderDate: number; // For sorting by most recent order
    descriptionLines?: Array<{
        lineType?: string;
        name?: { original: string };
        color?: string;
        plainText?: { original: string };
    }>;
}

export const OrdersTableWithTabs: React.FC = observer(() => {
    const { orderStore } = useStores();
    const [activeTabId, setActiveTabId] = useState<string | number>(1);
    const isMounted = useRef(true);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    const tabItems = [
        { id: 1, title: 'Order List' },
        { id: 2, title: 'Packing List' }
    ];

    const getProductOptionsKey = (item: any): string => {
        if (!item || !item.descriptionLines) {
            return '';
        }

        try {
            const optionsMap: Record<string, string> = {};

            item.descriptionLines.forEach((line: any) => {
                if (line.lineType === 'COLOR') {
                    optionsMap[line.name?.original || 'Color'] = line.color || '';
                } else if (line.lineType === 'PLAIN_TEXT' && line.plainText?.original) {
                    optionsMap[line.name?.original || 'Option'] = line.plainText.original;
                }
            });

            // Sort keys for consistent grouping
            const sortedOptions = Object.keys(optionsMap)
                .sort()
                .reduce((obj: Record<string, any>, key) => {
                    obj[key] = optionsMap[key];
                    return obj;
                }, {});

            return JSON.stringify(sortedOptions);
        } catch (error) {
            console.error('Error processing product options:', error);
            return '';
        }
    };

    // Cache to store fulfillment data to avoid repeated API calls
    const fulfillmentCache = new Map<string, any>();

    // Function to get fulfillment data for an order (with caching)
    const getOrderFulfillmentData = async (orderId: string) => {
        if (fulfillmentCache.has(orderId)) {
            return fulfillmentCache.get(orderId);
        }

        try {
            const { orderFulfillments } = await import('@wix/ecom');
            const response = await orderFulfillments.listFulfillmentsForSingleOrder(orderId);
            const fulfillments = response.orderWithFulfillments?.fulfillments || [];

            // Cache the result
            fulfillmentCache.set(orderId, fulfillments);
            return fulfillments;
        } catch (error) {
            console.error(`Error fetching fulfillment data for order ${orderId}:`, error);
            // Cache empty result to avoid repeated failed calls
            fulfillmentCache.set(orderId, []);
            return [];
        }
    };

    // Function to check if an item has any tracking info using CACHED fulfillment data
    const hasItemTracking = async (itemId: string, orderId: string): Promise<boolean> => {
        try {
            const fulfillments = await getOrderFulfillmentData(orderId);

            // Check if this specific item has tracking in any fulfillment
            return fulfillments.some((fulfillment: any) => {
                if (!fulfillment.trackingInfo?.trackingNumber) return false;

                // Check if this fulfillment contains our specific item
                const itemLineItem = fulfillment.lineItems?.find((li: any) => {
                    const lineItemId = li.lineItemId || li.id || li._id;
                    return lineItemId === itemId || li._id === itemId;
                });

                return !!itemLineItem;
            });
        } catch (error) {
            console.error('Error checking item tracking:', error);
            return false;
        }
    };

    // Function to get fulfilled quantity using CACHED fulfillment data
    const getActualFulfilledQuantity = async (itemId: string, orderId: string): Promise<number> => {
        try {
            const fulfillments = await getOrderFulfillmentData(orderId);

            let totalFulfilled = 0;

            fulfillments.forEach((fulfillment: any) => {
                const itemLineItem = fulfillment.lineItems?.find((li: any) => {
                    const lineItemId = li.lineItemId || li.id || li._id;
                    return lineItemId === itemId || li._id === itemId;
                });

                if (itemLineItem) {
                    totalFulfilled += itemLineItem.quantity || 0;
                }
            });

            return totalFulfilled;
        } catch (error) {
            console.error('Error getting fulfilled quantity:', error);
            return 0;
        }
    };

    // Function to handle order tag clicks
    const handleOrderTagClick = async (orderId: string) => {
        try {
            console.log('🔍 Order tag clicked, fetching order:', orderId);

            // Find the order in the current store first
            let orderToSelect = orderStore.orders.find(order => order._id === orderId);

            if (!orderToSelect) {
                // If not found in store, fetch it from the API
                console.log('📡 Order not found in store, fetching from API...');

                const { orders: ordersApi } = await import('@wix/ecom');
                const response = await ordersApi.getOrder(orderId);

                if (response && response._id) {
                    // Convert the API response to our Order format with proper type handling
                    orderToSelect = {
                        _id: response._id || '',
                        number: response.number || '',
                        _createdDate: response._createdDate ?
                            (typeof response._createdDate === 'string' ? response._createdDate : response._createdDate.toISOString())
                            : new Date().toISOString(),
                        status: (response.fulfillmentStatus as any) || 'NOT_FULFILLED',
                        paymentStatus: (response.paymentStatus as any) || 'UNPAID',
                        customer: {
                            email: response.buyerInfo?.email || '',
                            firstName: (response.buyerInfo as any)?.firstName || '',
                            lastName: (response.buyerInfo as any)?.lastName || '',
                            phone: (response.buyerInfo as any)?.phone || ''
                        },
                        rawOrder: response as any,
                        total: response.priceSummary?.total?.formattedAmount || '€0.00',
                        buyerInfo: {
                            identityType: (response.buyerInfo as any)?.identityType,
                            email: response.buyerInfo?.email || undefined,
                            phone: (response.buyerInfo as any)?.phone || undefined,
                            firstName: (response.buyerInfo as any)?.firstName || undefined,
                            lastName: (response.buyerInfo as any)?.lastName || undefined
                        },
                        // Convert lineItems with proper type handling
                        lineItems: (response.lineItems || []).map((item: any) => ({
                            _id: item._id || item.id || '',
                            name: item.productName?.original || item.productName || 'Unknown Product',
                            quantity: item.quantity || 1,
                            price: item.price?.amount || '0',
                            sku: item.physicalProperties?.sku || '',
                            image: item.image || '',
                            productId: item.catalogReference?.catalogItemId || '',
                            options: item.options || [],
                            weight: item.physicalProperties?.weight || 0
                        })),
                        // Add missing required properties with safe defaults
                        totalWeight: 0,
                        shippingInfo: {
                            carrierId: '',
                            title: response.shippingInfo?.title || '',
                            logistics: response.shippingInfo?.logistics,
                            cost: (response.shippingInfo?.cost as any)?.formattedAmount ||
                                (response.shippingInfo?.cost as any)?.amount ||
                                '€0.00'
                        },
                        weightUnit: 'kg'
                    } as Order; // Type assertion to ensure it matches Order type

                    // Add it to the store
                    orderStore.addOrder(orderToSelect);
                    console.log('✅ Order fetched and added to store');
                } else {
                    throw new Error('Order not found');
                }
            }

            // Make sure orderToSelect is defined before using it
            if (orderToSelect) {
                // Select the order in the store
                orderStore.selectOrder(orderToSelect);

                // Switch to the Order List tab (tab id 1)
                setActiveTabId(1);

            } else {
                throw new Error('Unable to load order');
            }

        } catch (error) {
            console.error('❌ Error handling order tag click:', error);
            dashboard.showToast({
                message: 'Failed to load order details',
                type: 'error'
            });
        }
    };
    const getPreparationItems = async (): Promise<PreparationItem[]> => {
        if (!isMounted.current) return [];

        // Clear fulfillment cache for fresh data
        fulfillmentCache.clear();

        try {
            console.log('🔍 Fetching ALL unfulfilled and partially fulfilled orders from API...');

            // Make a direct API call to get ALL unfulfilled and partially fulfilled orders
            const { orders } = await import('@wix/ecom');

            // Helper function to fetch ALL orders with pagination
            // Make a direct API call to get ALL unfulfilled and partially fulfilled orders
            const { orders: ordersApi } = await import('@wix/ecom');

            // Helper function to fetch ALL orders with pagination
            const fetchAllOrdersWithStatus = async (fulfillmentStatus: "NOT_FULFILLED" | "PARTIALLY_FULFILLED") => {
                const allOrders: any[] = [];
                let paginationCursor: string | undefined = undefined;
                let hasMore = true;

                while (hasMore) {
                    try {
                        const response = await ordersApi.searchOrders({
                            filter: {
                                fulfillmentStatus: { $eq: fulfillmentStatus as any },
                                status: { $ne: "INITIALIZED" },
                                archived: { $ne: true }
                            },
                            cursorPaging: {
                                limit: 100, // Maximum allowed limit
                                cursor: paginationCursor || undefined
                            },
                            sort: [{ fieldName: '_createdDate' as const, order: 'DESC' as const }]
                        });

                        const fetchedOrders = response.orders || [];
                        allOrders.push(...fetchedOrders);

                        console.log(`📦 Fetched ${fetchedOrders.length} orders with status ${fulfillmentStatus}, total so far: ${allOrders.length}`);

                        // Check if there are more pages
                        hasMore = response.metadata?.hasNext || false;
                        paginationCursor = response.metadata?.cursors?.next || undefined;

                        // Safety check to prevent infinite loops
                        if (allOrders.length > 2000) {
                            console.warn('⚠️ Stopping pagination at 2000 orders for safety');
                            break;
                        }

                    } catch (error) {
                        console.error(`❌ Error fetching ${fulfillmentStatus} orders:`, error);
                        break;
                    }
                }

                return allOrders;
            };

            console.log('🔍 Fetching unfulfilled orders...');
            const unfulfilledOrdersFromApi = await fetchAllOrdersWithStatus("NOT_FULFILLED");

            console.log('🔍 Fetching partially fulfilled orders...');
            const partiallyFulfilledOrdersFromApi = await fetchAllOrdersWithStatus("PARTIALLY_FULFILLED");

            // Combine and deduplicate orders
            const allUnfulfilledOrders = [...unfulfilledOrdersFromApi, ...partiallyFulfilledOrdersFromApi];

            // Remove duplicates by order ID
            const uniqueUnfulfilledOrders = allUnfulfilledOrders.filter((order, index, self) =>
                index === self.findIndex(o => o._id === order._id)
            );

            console.log(`📦 Found ${uniqueUnfulfilledOrders.length} total unfulfilled/partially fulfilled orders from API (${unfulfilledOrdersFromApi.length} unfulfilled + ${partiallyFulfilledOrdersFromApi.length} partially fulfilled)`);

            const productMap = new Map<string, PreparationItem>();

            // Process orders sequentially to properly check fulfillment status
            const processedProductMap = new Map<string, PreparationItem>();

            for (const order of uniqueUnfulfilledOrders) {                // Handle both API response format and local order format
                const items = (order as any).lineItems || [];
                const orderNumber = order.number || '';
                const orderId = order._id || '';
                const createdDate = order._createdDate;

                // Safe date handling
                let orderTimestamp: number;
                try {
                    if (typeof createdDate === 'string') {
                        orderTimestamp = new Date(createdDate).getTime();
                    } else if (createdDate instanceof Date) {
                        orderTimestamp = createdDate.getTime();
                    } else {
                        orderTimestamp = Date.now(); // fallback to current time
                    }
                } catch (error) {
                    console.warn('Invalid date for order:', orderNumber);
                    orderTimestamp = Date.now();
                }

                for (const item of items) {
                    const productName = (typeof item.productName === 'object' && item.productName?.original)
                        ? item.productName.original
                        : (typeof item.productName === 'string' ? item.productName : 'Unknown Product');
                    const totalQuantity = item.quantity || 1;
                    const itemId = item._id || item.id || '';

                    // Skip if we don't have a valid item ID or order ID
                    if (!itemId || !orderId) {
                        console.warn('Skipping item due to missing ID:', { itemId, orderId, productName });
                        continue;
                    }

                    // Get LIVE fulfillment data for this item
                    const actualFulfilledQuantity = await getActualFulfilledQuantity(itemId, orderId);
                    const remainingQty = Math.max(0, totalQuantity - actualFulfilledQuantity);
                    const hasTracking = await hasItemTracking(itemId, orderId);

                    console.log(`🔍 Debug ${productName}:`, {
                        itemId,
                        orderId,
                        totalQuantity,
                        actualFulfilledQuantity,
                        remainingQty,
                        hasTracking
                    });

                    // Skip items that are fully fulfilled
                    if (remainingQty <= 0) {
                        console.log(`⏭️ Skipping fully fulfilled item: ${productName} - ` +
                            `Fulfilled: ${actualFulfilledQuantity}/${totalQuantity}`);
                        continue;
                    }

                    console.log(`📦 Including item: ${productName} - ` +
                        `Remaining: ${remainingQty}/${totalQuantity}, ` +
                        `Has tracking: ${hasTracking}`);

                    // Get customer name - handle both API and local order formats
                    const recipientContact = (order as any).recipientInfo?.contactDetails;
                    const billingContact = (order as any).billingInfo?.contactDetails;
                    const buyerInfo = (order as any).buyerInfo;

                    const firstName = recipientContact?.firstName || billingContact?.firstName || buyerInfo?.firstName || '';
                    const lastName = recipientContact?.lastName || billingContact?.lastName || buyerInfo?.lastName || '';
                    const customerName = `${firstName} ${lastName}`.trim() || 'Unknown Customer';

                    const optionsKey = getProductOptionsKey(item);
                    const mapKey = `${item.catalogReference?.catalogItemId || 'unknown'}-${optionsKey}`;

                    if (processedProductMap.has(mapKey)) {
                        // Add to existing product
                        const existing = processedProductMap.get(mapKey)!;
                        existing.totalQuantity += remainingQty;
                        existing.orders.push({
                            orderNumber,
                            orderId,
                            quantity: remainingQty,
                            customerName,
                            orderTimestamp,
                            originalQuantity: totalQuantity,
                            fulfilledQuantity: actualFulfilledQuantity
                        });
                        // Update most recent order date if this order is newer
                        if (orderTimestamp > existing.mostRecentOrderDate) {
                            existing.mostRecentOrderDate = orderTimestamp;
                        }
                    } else {
                        // Create new product entry
                        processedProductMap.set(mapKey, {
                            id: mapKey,
                            productId: item.catalogReference?.catalogItemId,
                            productName,
                            productOptions: optionsKey,
                            imageUrl: extractImageUrl(item),
                            rawImageUrl: extractImageUrl(item, true),
                            totalQuantity: remainingQty,
                            orders: [{
                                orderNumber,
                                orderId,
                                quantity: remainingQty,
                                customerName,
                                orderTimestamp,
                                originalQuantity: totalQuantity,
                                fulfilledQuantity: actualFulfilledQuantity
                            }],
                            optionsDisplay: optionsKey ? JSON.parse(optionsKey) : {},
                            descriptionLines: item.descriptionLines || [],
                            mostRecentOrderDate: orderTimestamp
                        });
                    }
                }
            }

            // Convert map to array and sort by most recent order date
            const result = Array.from(processedProductMap.values()).sort((a, b) =>
                b.mostRecentOrderDate - a.mostRecentOrderDate
            );
            return result;

        } catch (error) {
            console.error('❌ Error in getPreparationItems:', error);

            // Fallback to using local orders if API call fails
            console.log('🔄 Falling back to local orders...');
            try {
                const localUnfulfilledOrders = orderStore.orders.filter(order => {
                    return order.status === 'NOT_FULFILLED' || order.status === 'PARTIALLY_FULFILLED';
                });

                console.log(`📦 Fallback: Found ${localUnfulfilledOrders.length} unfulfilled orders from local store`);

                // Process local orders the same way but without the async fulfillment checks
                const productMap = new Map<string, PreparationItem>();

                localUnfulfilledOrders.forEach(order => {
                    const items = order.rawOrder?.lineItems || [];
                    const orderTimestamp = order._createdDate ? new Date(order._createdDate).getTime() : Date.now();

                    items.forEach((item: any) => {
                        const productName = item.productName?.original || 'Unknown Product';
                        const totalQuantity = item.quantity || 1;
                        const fulfilledQuantity = item.fulfilledQuantity || 0;
                        const remainingQty = Math.max(0, totalQuantity - fulfilledQuantity);

                        if (remainingQty <= 0) return;

                        const recipientContact = order.rawOrder?.recipientInfo?.contactDetails;
                        const billingContact = order.rawOrder?.billingInfo?.contactDetails;
                        const customerName = `${recipientContact?.firstName || billingContact?.firstName || ''} ${recipientContact?.lastName || billingContact?.lastName || ''}`.trim() || 'Unknown Customer';

                        const optionsKey = getProductOptionsKey(item);
                        const mapKey = `${item.catalogReference?.catalogItemId || 'unknown'}-${optionsKey}`;

                        if (productMap.has(mapKey)) {
                            const existing = productMap.get(mapKey)!;
                            existing.totalQuantity += remainingQty;
                            existing.orders.push({
                                orderNumber: order.number || '',
                                orderId: order._id || '',
                                quantity: remainingQty,
                                customerName,
                                orderTimestamp,
                                originalQuantity: totalQuantity,
                                fulfilledQuantity: fulfilledQuantity
                            });
                            if (orderTimestamp > existing.mostRecentOrderDate) {
                                existing.mostRecentOrderDate = orderTimestamp;
                            }
                        } else {
                            productMap.set(mapKey, {
                                id: mapKey,
                                productId: item.catalogReference?.catalogItemId,
                                productName,
                                productOptions: optionsKey,
                                imageUrl: extractImageUrl(item),
                                rawImageUrl: extractImageUrl(item, true),
                                totalQuantity: remainingQty,
                                orders: [{
                                    orderNumber: order.number || '',
                                    orderId: order._id || '',
                                    quantity: remainingQty,
                                    customerName,
                                    orderTimestamp,
                                    originalQuantity: totalQuantity,
                                    fulfilledQuantity: fulfilledQuantity
                                }],
                                optionsDisplay: optionsKey ? JSON.parse(optionsKey) : {},
                                descriptionLines: item.descriptionLines || [],
                                mostRecentOrderDate: orderTimestamp
                            });
                        }
                    });
                });

                return Array.from(productMap.values()).sort((a, b) =>
                    b.mostRecentOrderDate - a.mostRecentOrderDate
                );
            } catch (fallbackError) {
                console.error('❌ Fallback also failed:', fallbackError);
                return [];
            }
        }
    };

    // Use React.useState and useEffect for async data fetching
    const [preparationItems, setPreparationItems] = React.useState<PreparationItem[]>([]);
    const [isLoadingPreparationItems, setIsLoadingPreparationItems] = React.useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    React.useEffect(() => {
        const loadPreparationItems = async () => {
            setIsLoadingPreparationItems(true);
            try {
                const items = await getPreparationItems();
                if (isMounted.current) {
                    setPreparationItems(items);
                }
            } catch (error) {
                console.error('Error loading preparation items:', error);
                if (isMounted.current) {
                    setPreparationItems([]);
                }
            } finally {
                if (isMounted.current) {
                    setIsLoadingPreparationItems(false);
                }
            }
        };

        loadPreparationItems();
    }, [orderStore.orders.length, orderStore.orders]);

    // Add effect to monitor order changes
    useEffect(() => {
    }, [orderStore.orders.length, orderStore.orders]);

    // Filter preparation items based on search query
    const filteredPreparationItems = React.useMemo(() => {
        if (!searchQuery.trim()) {
            return preparationItems;
        }

        const query = searchQuery.toLowerCase().trim();
        return preparationItems.filter(item => {
            // Search in product name
            if (item.productName.toLowerCase().includes(query)) {
                return true;
            }

            // Search in product ID/SKU
            if (item.productId && item.productId.toLowerCase().includes(query)) {
                return true;
            }

            // Search in order numbers
            if (item.orders.some(order => order.orderNumber.toLowerCase().includes(query))) {
                return true;
            }

            // Search in customer names
            if (item.orders.some(order => order.customerName.toLowerCase().includes(query))) {
                return true;
            }

            // Search in product options
            if (item.descriptionLines && item.descriptionLines.some(line => {
                const nameMatch = line.name?.original?.toLowerCase().includes(query);
                const colorMatch = line.color?.toLowerCase().includes(query);
                const textMatch = line.plainText?.original?.toLowerCase().includes(query);
                return nameMatch || colorMatch || textMatch;
            })) {
                return true;
            }

            return false;
        });
    }, [preparationItems, searchQuery]);

    // Search handlers
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    };

    const handleSearchClear = () => {
        setSearchQuery('');
    };

    // Function to download packing list as PDF
    const handleDownloadPackingList = async () => {
        try {
            console.log('Generating packing list PDF...');

            // Helper function to convert Wix image URLs to accessible URLs
            const convertWixImageUrl = (imageUrl: string): string => {
                if (!imageUrl) return '';

                // Handle wix:image:// URLs
                if (imageUrl.startsWith('wix:image://v1/')) {
                    // Extract the image ID from the wix:image URL
                    const imageId = imageUrl.replace('wix:image://v1/', '').split('#')[0];
                    return `https://static.wixstatic.com/media/${imageId}/v1/fill/w_100,h_100,al_c,q_80,usm_0.66_1.00_0.01,enc_auto/${imageId}.jpg`;
                }

                // Handle static.wixstatic.com URLs
                if (imageUrl.includes('static.wixstatic.com')) {
                    try {
                        const url = new URL(imageUrl);
                        // Add image optimization parameters
                        url.searchParams.set('w', '100');
                        url.searchParams.set('h', '100');
                        url.searchParams.set('fit', 'fill');
                        url.searchParams.set('f', 'jpg');
                        return url.toString();
                    } catch (error) {
                        console.warn('Invalid URL format:', imageUrl);
                        return imageUrl;
                    }
                }

                // For any other URL format, try to add parameters if it's a valid URL
                try {
                    const url = new URL(imageUrl);
                    url.searchParams.set('w', '100');
                    url.searchParams.set('h', '100');
                    url.searchParams.set('fit', 'fill');
                    url.searchParams.set('f', 'jpg');
                    return url.toString();
                } catch (error) {
                    // If it's not a valid URL, return as is
                    return imageUrl;
                }
            };

            // Helper function to convert image to base64 with multiple fallbacks
            const convertImageToBase64 = async (imageUrl: string): Promise<string> => {
                try {
                    if (!imageUrl || imageUrl.trim() === '') {
                        console.log('No image URL provided');
                        return '';
                    }

                    console.log('Original image URL:', imageUrl);

                    // Convert Wix image URL to accessible format
                    const accessibleUrl = convertWixImageUrl(imageUrl);
                    console.log('Converted image URL:', accessibleUrl);

                    // Try multiple fallback URLs
                    const urlsToTry = [
                        accessibleUrl,
                        // Fallback 1: Basic static.wixstatic.com URL
                        imageUrl.startsWith('wix:image://v1/')
                            ? `https://static.wixstatic.com/media/${imageUrl.replace('wix:image://v1/', '').split('#')[0]}`
                            : null,
                        // Fallback 2: With different parameters
                        imageUrl.startsWith('wix:image://v1/')
                            ? `https://static.wixstatic.com/media/${imageUrl.replace('wix:image://v1/', '').split('#')[0]}/v1/fit/w_100,h_100,al_c,q_80/${imageUrl.replace('wix:image://v1/', '').split('#')[0].split('~')[0]}.jpg`
                            : null
                    ].filter(Boolean);

                    for (const urlToTry of urlsToTry) {
                        try {
                            console.log('Trying URL:', urlToTry);

                            const response = await fetch(urlToTry as string, {
                                mode: 'cors',
                                headers: {
                                    'Accept': 'image/*'
                                }
                            });

                            if (!response.ok) {
                                console.warn(`HTTP error for ${urlToTry}! status: ${response.status}`);
                                continue;
                            }

                            const blob = await response.blob();
                            console.log('Image blob size:', blob.size, 'bytes');

                            if (blob.size === 0) {
                                console.warn('Empty blob received');
                                continue;
                            }

                            return new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = () => {
                                    const result = reader.result as string;
                                    console.log('Base64 conversion successful, length:', result.length);
                                    resolve(result);
                                };
                                reader.onerror = () => reject(new Error('Failed to convert image to base64'));
                                reader.readAsDataURL(blob);
                            });
                        } catch (error) {
                            console.warn(`Failed to fetch from ${urlToTry}:`, error);
                            continue;
                        }
                    }

                    throw new Error('All image URL attempts failed');
                } catch (error) {
                    console.error('Error converting image to base64:', error);
                    return ''; // Return empty string as fallback
                }
            };

            // Convert images to base64 first with robust fallback system
            const processedItems = await Promise.all(
                preparationItems.map(async (item) => {
                    let base64Image = '';

                    if (item.rawImageUrl) {
                        try {
                            console.log(`Converting image for ${item.productName}: ${item.rawImageUrl}`);
                            base64Image = await convertImageToBase64(item.rawImageUrl);
                            console.log(`Image conversion ${base64Image ? 'successful' : 'failed'} for ${item.productName}`);
                        } catch (error) {
                            console.error(`Failed to convert image for ${item.productName}:`, error);
                        }
                    }

                    return { ...item, base64Image };
                })
            );

            // Create HTML content for PDF
            const currentDate = new Date().toLocaleDateString();
            const totalItems = preparationItems.reduce((total, item) => total + item.totalQuantity, 0);

            // Function to generate a page of items
            const generatePage = (items: any[], pageNumber: number, totalPages: number) => {
                const itemsHTML = items.map((item) => {
                    const optionsHTML = Object.keys(item.optionsDisplay).length > 0
                        ? Object.entries(item.optionsDisplay)
                            .map(([key, value]) => `<div style="color: #666; font-size: 10px; margin-top: 4px; line-height: 1.3;">${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}</div>`)
                            .join('')
                        : '<div style="color: #666; font-size: 10px; margin-top: 4px; line-height: 1.3;"></div>';

                    const imageHTML = item.base64Image
                        ? `<div style="width: 60px; height: 45px; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 4px; border: 1px solid #ddd; background: white;">
                            <img 
                                src="${item.base64Image}" 
                                style="max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain;" 
                                alt="${item.productName}" 
                                onerror="this.onerror=null; this.style.display='none'; this.parentElement.innerHTML='<div style=\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#f8f9fa;color:#999;font-size:9px;\'>No Image</div>';"
                            />
                          </div>`
                        : '<div style="width: 60px; height: 45px; background-color: #f8f9fa; border: 1px solid #ddd; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #999;">No Image</div>';

                    const ordersHTML = item.orders
                        .sort((a: any, b: any) => b.orderTimestamp - a.orderTimestamp)
                        .map((order: any) => `<div style="margin-bottom: 4px; font-size: 10px; line-height: 1.3;"><strong>#${order.orderNumber}</strong> - Qty: ${order.quantity}<br><span style="color: #666;">${order.customerName}</span></div>`)
                        .join('');

                    return `
                        <tr style="border-bottom: 1px solid #ddd;">
                            <td style="padding: 15px 12px; vertical-align: top; border-right: 1px solid #ddd;">
                                <div style="display: flex; align-items: flex-start; gap: 12px;">
                                    ${imageHTML}
                                    <div style="flex: 1;">
                                        <div style="font-weight: bold; font-size: 12px; margin-bottom: 6px; line-height: 1.4;">${item.productName}</div>
                                        ${settingsStore.showSKU && item.productId ? `<div style="color: #666; font-size: 9px; margin-bottom: 6px;">SKU: ${item.productId}</div>` : ''}
                                        ${optionsHTML}
                                    </div>
                                </div>
                            </td>
                            <td style="text-align: center; padding: 15px 12px; vertical-align: top; border-right: 1px solid #ddd;">
                                <div style="font-weight: bold; font-size: 16px; color: #2563eb;">${item.totalQuantity}</div>
                            </td>
                            <td style="padding: 15px 12px; vertical-align: top;">
                                ${ordersHTML}
                            </td>
                        </tr>
                    `;
                }).join('');

                return `
                    <div style="padding: 25px; font-family: Arial, sans-serif; color: #333; max-width: 800px; margin: 0 auto; min-height: calc(100vh - 50px); background: white;">
                        <!-- Header -->
                        <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 25px;">
                            <h1 style="margin: 0; font-size: 24px; font-weight: bold;">PACKING LIST</h1>
                            <div style="font-size: 12px; color: #666; margin-top: 8px;">
                                Generated on ${currentDate} | Total Items: ${totalItems}
                                ${totalPages > 1 ? ` | Page ${pageNumber} of ${totalPages}` : ''}
                            </div>
                        </div>

                        <!-- Products Table -->
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; border: 1px solid #ddd;">
                            <thead>
                                <tr style="background-color: #f8f9fa;">
                                    <th style="text-align: left; padding: 15px 12px; font-size: 13px; font-weight: bold; border-right: 1px solid #ddd; border-bottom: 1px solid #ddd;">Product</th>
                                    <th style="text-align: center; padding: 15px 12px; font-size: 13px; font-weight: bold; border-right: 1px solid #ddd; border-bottom: 1px solid #ddd; width: 100px;">Total Qty</th>
                                    <th style="text-align: left; padding: 15px 12px; font-size: 13px; font-weight: bold; border-bottom: 1px solid #ddd;">Orders</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHTML}
                            </tbody>
                        </table>

                        ${pageNumber === totalPages ? `
                            <!-- Summary - only on last page -->
                            <div style="margin-top: 25px; padding: 20px; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e5e7eb;">
                                <div style="font-size: 14px; font-weight: bold; margin-bottom: 12px; color: #333;">Summary:</div>
                                <div style="font-size: 12px; color: #666; line-height: 1.6;">
                                    <div style="margin-bottom: 4px;">Total unique products: <strong>${preparationItems.length}</strong></div>
                                    <div style="margin-bottom: 4px;">Total items to pack: <strong>${totalItems}</strong></div>
                                    <div>Total orders: <strong>${[...new Set(preparationItems.flatMap(item => item.orders.map(o => o.orderNumber)))].length}</strong></div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;
            };

            // Split items into pages (max 15 items per page)
            const itemsPerPage = 15;
            const totalPages = Math.ceil(processedItems.length / itemsPerPage);

            console.log(`Creating ${totalPages} page(s) for ${processedItems.length} items`);

            // Create PDF with automatic page handling
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            // Process each page separately for better quality
            for (let page = 1; page <= totalPages; page++) {
                if (page > 1) {
                    pdf.addPage();
                }

                // Create a temporary element for this page only
                const pageElement = document.createElement('div');
                const startIndex = (page - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const pageItems = processedItems.slice(startIndex, endIndex);

                pageElement.innerHTML = generatePage(pageItems, page, totalPages);
                pageElement.style.position = 'absolute';
                pageElement.style.left = '-9999px';
                pageElement.style.top = '0';
                document.body.appendChild(pageElement);

                // Convert this page to canvas
                const pageCanvas = await html2canvas(pageElement, {
                    scale: 2,
                    useCORS: true,
                    allowTaint: false,
                    backgroundColor: '#ffffff',
                    logging: false,
                    imageTimeout: 15000,
                    onclone: (clonedDoc) => {
                        const images = clonedDoc.querySelectorAll('img');
                        images.forEach((img) => {
                            if (img.src.startsWith('data:')) {
                                img.style.maxWidth = '100%';
                                img.style.maxHeight = '100%';
                                img.style.objectFit = 'cover';
                                img.style.display = 'block';
                            }
                        });
                    }
                });

                const pageImgData = pageCanvas.toDataURL('image/png');
                const imgWidth = pdfWidth;
                const imgHeight = (pageCanvas.height * pdfWidth) / pageCanvas.width;

                // Scale to fit page if needed
                if (imgHeight > pdfHeight) {
                    const scaleFactor = pdfHeight / imgHeight;
                    const scaledWidth = imgWidth * scaleFactor;
                    const scaledHeight = pdfHeight;
                    const xOffset = (pdfWidth - scaledWidth) / 2;
                    pdf.addImage(pageImgData, 'PNG', xOffset, 0, scaledWidth, scaledHeight);
                } else {
                    pdf.addImage(pageImgData, 'PNG', 0, 0, imgWidth, imgHeight);
                }

                // Clean up
                document.body.removeChild(pageElement);

                console.log(`Generated PDF page ${page}/${totalPages}`);
            }

            // Download the PDF
            const fileName = `packing-list-${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(fileName);

            console.log('Packing list PDF generated successfully');

        } catch (error) {
            console.error('Failed to generate packing list PDF:', error);
            alert('Failed to generate packing list. Please try again.');
        }
    };

    // Function to print packing list
    const handlePrintPackingList = async () => {
        try {
            console.log('Printing packing list...');

            // Helper function to convert Wix image URLs to accessible URLs
            const convertWixImageUrl = (imageUrl: string): string => {
                if (!imageUrl) return '';

                // Handle wix:image:// URLs
                if (imageUrl.startsWith('wix:image://v1/')) {
                    // Extract the image ID from the wix:image URL
                    const imageId = imageUrl.replace('wix:image://v1/', '').split('#')[0];
                    return `https://static.wixstatic.com/media/${imageId}/v1/fill/w_100,h_100,al_c,q_80,usm_0.66_1.00_0.01,enc_auto/${imageId}.jpg`;
                }

                // Handle static.wixstatic.com URLs
                if (imageUrl.includes('static.wixstatic.com')) {
                    try {
                        const url = new URL(imageUrl);
                        // Add image optimization parameters
                        url.searchParams.set('w', '100');
                        url.searchParams.set('h', '100');
                        url.searchParams.set('fit', 'fill');
                        url.searchParams.set('f', 'jpg');
                        return url.toString();
                    } catch (error) {
                        console.warn('Invalid URL format:', imageUrl);
                        return imageUrl;
                    }
                }

                // For any other URL format, try to add parameters if it's a valid URL
                try {
                    const url = new URL(imageUrl);
                    url.searchParams.set('w', '100');
                    url.searchParams.set('h', '100');
                    url.searchParams.set('fit', 'fill');
                    url.searchParams.set('f', 'jpg');
                    return url.toString();
                } catch (error) {
                    // If it's not a valid URL, return as is
                    return imageUrl;
                }
            };

            // Process items with proper image URLs
            const processedItems = preparationItems.map(item => {
                let processedImageUrl = '';

                if (item.rawImageUrl) {
                    processedImageUrl = convertWixImageUrl(item.rawImageUrl);
                } else if (item.imageUrl) {
                    processedImageUrl = item.imageUrl;
                }

                return { ...item, processedImageUrl };
            });

            // Create HTML content for printing
            const currentDate = new Date().toLocaleDateString();
            const totalItems = preparationItems.reduce((total, item) => total + item.totalQuantity, 0);

            const itemsHTML = processedItems.map((item) => {
                const optionsHTML = Object.keys(item.optionsDisplay).length > 0
                    ? Object.entries(item.optionsDisplay)
                        .map(([key, value]) => `<div style="color: #666; font-size: 9px; margin-top: 2px;">${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}</div>`)
                        .join('')
                    : '<div style="color: #666; font-size: 9px; margin-top: 2px;"></div>';

                const imageHTML = item.processedImageUrl
                    ? `<div style="width: 60px; height: 45px; display: flex; align-items: center; justify-content: center; background: #f8f9fa; border: 1px solid #eee; overflow: hidden;">
                          <img 
                              src="${item.processedImageUrl}" 
                              alt="${item.productName}" 
                              style="max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain;"
                              onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" 
                          />
                          <div style="width: 100%; height: 100%; background-color: #f0f0f0; display: none; align-items: center; justify-content: center; font-size: 8px; color: #999; position: absolute; top: 0; left: 0;">No Image</div>
                       </div>`
                    : '<div style="width: 60px; height: 45px; background-color: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #999;">No Image</div>';

                const ordersHTML = item.orders
                    .sort((a, b) => b.orderTimestamp - a.orderTimestamp)
                    .map(order => `<div style="margin-bottom: 3px; font-size: 9px;"><strong>#${order.orderNumber}</strong> - Qty: ${order.quantity} (${order.customerName})</div>`)
                    .join('');

                return `
                    <tr style="border-bottom: 1px solid #ddd; page-break-inside: avoid;">
                        <td style="padding: 12px 8px; vertical-align: top; width: 45%;">
                            <div style="display: flex; align-items: flex-start; gap: 12px;">
                                ${imageHTML}
                                <div style="flex: 1;">
                                    <div style="font-weight: bold; font-size: 11px; margin-bottom: 4px;">${item.productName}</div>
                                    ${settingsStore.showSKU && item.productId ? `<div style="color: #666; font-size: 8px; margin-bottom: 4px;">SKU: ${item.productId}</div>` : ''}
                                    ${optionsHTML}
                                </div>
                            </div>
                        </td>
                        <td style="text-align: center; padding: 12px 8px; vertical-align: top; width: 15%;">
                            <div style="font-weight: bold; font-size: 14px; color: #2563eb;">${item.totalQuantity}</div>
                        </td>
                        <td style="padding: 12px 8px; vertical-align: top; width: 40%;">
                            ${ordersHTML}
                        </td>
                    </tr>
                `;
            }).join('');

            // // Remove any existing print container
            // const existingPrintContainer = document.getElementById('packing-list-print-container');
            // if (existingPrintContainer) {
            //     existingPrintContainer.remove();
            // }

            // Create a hidden print container
            const printContainer = document.createElement('div');
            printContainer.id = 'packing-list-print-container';
            printContainer.innerHTML = `
                <style id="packing-list-print-styles">
                    @media screen {
                        #packing-list-print-container {
                            position: absolute;
                            left: -9999px;
                            top: 0;
                            width: 210mm;
                            background: white;
                        }
                    }
                    
                    @media print {
                        body * {
                            visibility: hidden;
                        }
                        
                        #packing-list-print-container,
                        #packing-list-print-container * {
                            visibility: visible;
                        }
                        
                        #packing-list-print-container {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100%;
                            font-family: Arial, sans-serif;
                            color: #333;
                            margin: 0;
                            padding: 20px;
                            box-sizing: border-box;
                        }
                        
                        #packing-list-print-container table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 20px;
                        }
                        
                        #packing-list-print-container th,
                        #packing-list-print-container td {
                            border: 1px solid #ddd;
                            text-align: left;
                        }
                        
                        #packing-list-print-container th {
                            background-color: #f8f9fa;
                            font-weight: bold;
                        }
                        
                        #packing-list-print-container tr {
                            page-break-inside: avoid;
                        }
                        
                        #packing-list-print-container img {
                            max-width: 100%;
                            max-height: 100%;
                            width: auto;
                            height: auto;
                            object-fit: contain;
                            object-position: center;
                        }
                    }
                </style>
                
                <div style="text-align: center; border-bottom: 1px solid #999; padding-bottom: 12px; margin-bottom: 20px;">
                    <h1 style="margin: 0; font-size: 22px; font-weight: bold;">PACKING LIST</h1>
                    <div style="font-size: 11px; color: #666; margin-top: 6px;">
                        Generated on ${currentDate} | Total Items: ${totalItems}
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="padding: 12px 8px; font-size: 12px;">Product</th>
                            <th style="padding: 12px 8px; font-size: 12px; text-align: center;">Total Qty</th>
                            <th style="padding: 12px 8px; font-size: 12px;">Orders</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHTML}
                    </tbody>
                </table>

                <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 6px;">
                    <div style="font-size: 12px; font-weight: bold; margin-bottom: 8px;">Summary:</div>
                    <div style="font-size: 11px; color: #666;">
                        <div>Total unique products: ${preparationItems.length}</div>
                        <div>Total items to pack: ${totalItems}</div>
                        <div>Total orders: ${[...new Set(preparationItems.flatMap(item => item.orders.map(o => o.orderNumber)))].length}</div>
                    </div>
                </div>
            `;

            // Add the print container to the document
            document.body.appendChild(printContainer);

            // Wait a moment for images to load, then print
            setTimeout(() => {
                window.print();

                // Clean up after printing
                setTimeout(() => {
                    printContainer.remove();
                }, 1000);
            }, 500);

            console.log('Print dialog opened successfully');

        } catch (error) {
            console.error('Failed to print packing list:', error);
            alert('Failed to print packing list. Please try again.');
        }
    };


    const preparationColumns = [
        {
            title: 'Product',
            render: (item: PreparationItem) => (
                <Box direction="horizontal" gap="16px" align="left">
                    {/* Product Image - using EXACT same approach as ProductImages component */}
                    {item.imageUrl ? (
                        <img
                            src={item.imageUrl}
                            alt={item.productName}
                            style={{
                                width: '80px',
                                height: '60px',
                                objectFit: 'cover',
                                borderRadius: '4px',
                                border: '1px solid #e5e7eb',
                                backgroundColor: '#F0F0F0',
                                flexShrink: 0,
                                alignSelf: 'flex-start'
                            }}
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                const altUrl = `https://static.wixstatic.com/media/${item.rawImageUrl?.replace('wix:image://v1/', '').split('#')[0]}`;
                                if (target.src !== altUrl) {
                                    target.src = altUrl;
                                } else {
                                }
                            }}
                        />
                    ) : (
                        <div style={{
                            width: '80px',
                            height: '60px',
                            backgroundColor: '#e5e7eb',
                            borderRadius: '4px',
                            border: '1px solid #d1d5db',
                            display: 'block',
                            flexShrink: 0,
                            alignSelf: 'flex-start'
                        }} />
                    )}

                    {/* Product Details */}
                    <Box direction="vertical" gap="4px" style={{ flex: 1 }}>
                        <Text size="small" weight="normal">{item.productName}</Text>
                        {settingsStore.showSKU && item.productId && (
                            <Text size="tiny" secondary style={{ marginTop: '2px' }}>
                                SKU: {item.productId}
                            </Text>
                        )}
                        {item.descriptionLines?.map((line, index) => {
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
                            } else if (line.name?.original && line.plainText?.original) {
                                // Fallback for any other line types with both name and text
                                return (
                                    <Text key={`${index}-other`} size="tiny" secondary>
                                        {line.name.original}: {line.plainText.original}
                                    </Text>
                                );
                            }
                            return null;
                        }) || null}
                    </Box>
                </Box>
            ),
            width: '35%',
            minWidth: '200px'
        },
        {
            title: 'Quantity',
            render: (item: PreparationItem) => (
                <Box align="left" paddingLeft="18px" style={{ width: '100%', display: 'flex' }}>
                    <Text size="small">{item.totalQuantity}</Text>
                </Box>
            ),
            width: '20%',
            minWidth: '140px'
        },
        {
            title: 'Orders',
            render: (item: PreparationItem) => (
                <Box direction="vertical" gap="4px" align="left" style={{ width: '100%' }}>
                    {/* Sort orders by most recent first */}
                    {item.orders
                        .sort((a, b) => b.orderTimestamp - a.orderTimestamp)
                        .map((order, index) => (
                            <Box key={index} direction="horizontal" gap="8px" align="center" style={{ justifyContent: 'flex-start' }}>
                                <div
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleOrderTagClick(order.orderId);
                                    }}
                                >
                                    <Tag
                                        id={`order-tag-${order.orderId}-${order.orderNumber}`}
                                        removable={false}
                                        size="tiny"
                                        theme="standard"
                                    >
                                        #{order.orderNumber}
                                    </Tag>
                                </div>
                                <Box style={{ display: 'flex', alignItems: 'center' }}>
                                    <Text size="tiny" secondary>
                                        Qty: {order.quantity}
                                    </Text>
                                </Box>
                            </Box>
                        ))}
                </Box>
            ),
            width: '25%',
            minWidth: '180px'
        },
        {
            title: 'Customers',
            render: (item: PreparationItem) => (
                <Box direction="vertical" gap="2px">
                    {/* Sort customers by most recent order first */}
                    {item.orders
                        .sort((a, b) => b.orderTimestamp - a.orderTimestamp)
                        .map((order, index) => (
                            <Text key={index} size="small">
                                {order.customerName}
                            </Text>
                        ))}
                </Box>
            ),
            width: '20%',
            minWidth: '120px'
        }
    ];

    const renderOrdersTab = () => (
        <OrdersTable />
    );

    const renderPreparationTab = () => (
        <Box direction="vertical" gap="0" style={{ backgroundColor: '#ffffff', borderRadius: '8px' }}>
            {/* TableToolbar */}
            <TableToolbar>
                <TableToolbar.ItemGroup position="start">
                    <TableToolbar.Item>
                        <Box direction="horizontal" gap="8px" align="center" verticalAlign="middle">
                            <Box>
                                <Text weight="normal" size="medium">
                                    Products to Pack ({filteredPreparationItems.reduce((total, item) => total + item.totalQuantity, 0)})
                                    {searchQuery && ` of ${preparationItems.reduce((total, item) => total + item.totalQuantity, 0)}`}
                                </Text>
                            </Box>
                            <Box>
                                <Tooltip content="Quickly identify products that need fulfillment to accelerate your inventory preparation process">
                                    <div
                                        onClick={(e: React.MouseEvent) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                        }}
                                        style={{ display: 'flex', alignItems: 'center' }}
                                    >
                                        <Icons.InfoCircle size="22px" style={{ color: '#326bf6', marginTop: '2px' }} />
                                    </div>
                                </Tooltip>
                            </Box>
                        </Box>
                    </TableToolbar.Item>
                </TableToolbar.ItemGroup>
                <TableToolbar.ItemGroup position="end">
                    <TableToolbar.Item>
                        <Tooltip content="Download PDF">
                            <IconButton
                                size="small"
                                priority="secondary"
                                onClick={handleDownloadPackingList}
                                disabled={preparationItems.length === 0}
                            >
                                <Icons.Download />
                            </IconButton>
                        </Tooltip>
                    </TableToolbar.Item>
                    <TableToolbar.Item>
                        <div style={{ width: '280px' }}>
                            <Search
                                value={searchQuery}
                                onChange={handleSearchChange}
                                onClear={handleSearchClear}
                                placeholder="Search products, orders, customers..."
                                expandable={false}
                                size="small"
                            />
                        </div>
                    </TableToolbar.Item>
                </TableToolbar.ItemGroup>
            </TableToolbar>

            {/* Table Content */}
            <div style={{
                width: '100%',
                borderBottomLeftRadius: '8px',
                borderBottomRightRadius: '8px',
                overflowX: 'auto',
                minHeight: 'calc(100vh - 276px)'
            }}>
                {isLoadingPreparationItems ? (
                    <Box
                        align="center"
                        paddingTop="40px"
                        paddingBottom="40px"
                        gap="8px"
                        direction="vertical"
                        style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderBottom: 'none'
                        }}
                    >
                        <Loader size="small" />
                        <Text size="small">Loading preparation items...</Text>
                    </Box>
                ) : filteredPreparationItems.length === 0 && preparationItems.length === 0 ? (
                    <Box
                        align="center"
                        paddingTop="40px"
                        paddingBottom="40px"
                        gap="8px"
                        direction="vertical"
                        style={{
                            backgroundColor: '#ffffff',
                            minHeight: 'calc(100vh - 328px)',
                            border: '1px solid #e5e7eb',
                            borderBottom: 'none'
                        }}
                    >
                        <Icons.Check size="48px" style={{ color: '#4caf50' }} />
                        <Text size="medium" weight="normal">All orders fulfilled!</Text>
                        <Text secondary size="small" align="center">
                            No products need preparation at this time
                        </Text>
                    </Box>
                ) : filteredPreparationItems.length === 0 && searchQuery ? (
                    <Box
                        align="center"
                        paddingTop="40px"
                        paddingBottom="40px"
                        gap="8px"
                        direction="vertical"
                        style={{
                            backgroundColor: '#ffffff',
                            minHeight: 'calc(100vh - 328px)',
                            border: '1px solid #e5e7eb',
                            borderBottom: 'none'
                        }}
                    >
                        <Icons.Search size="48px" style={{ color: '#999' }} />
                        <Text size="medium" weight="normal">No products found</Text>
                        <Text secondary size="small" align="center">
                            Try adjusting your search query or clear the search to see all products
                        </Text>
                    </Box>
                ) : (
                    <Table
                        data={filteredPreparationItems}
                        columns={preparationColumns}
                        rowVerticalPadding="medium"
                        horizontalScroll
                    >
                        <Table.Titlebar />
                        <div
                            className="preparation-table-container"
                            style={{
                                maxHeight: 'calc(100vh - 318px)',
                                overflowY: 'auto',
                                overflowX: 'hidden'
                            }}
                        >
                            <Table.Content titleBarVisible={false} />
                        </div>
                    </Table>
                )}
            </div>
        </Box>
    );

    return (
        <Box gap="16px" direction="vertical">
            {/* Tabs */}
            <Tabs
                items={tabItems}
                type="compactSide"
                activeId={activeTabId}
                onClick={(tab) => setActiveTabId(tab.id as number)}
            />

            {/* Tab Content */}
            {activeTabId === 1 && renderOrdersTab()}
            {activeTabId === 2 && renderPreparationTab()}
        </Box>
    );
});