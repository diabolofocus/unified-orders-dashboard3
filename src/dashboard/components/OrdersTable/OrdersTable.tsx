// components/OrdersTable/OrdersTable.tsx - UPDATED with Advanced Search + Print & Archive
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import styled, { keyframes } from 'styled-components';
import {
    Card,
    Text,
    Search,
    Button,
    Loader,
    Table,
    TableActionCell,
    TableToolbar,
    Box,
    TagList,
    Checkbox,
    TextButton,
    Badge,
    Tooltip,
} from '@wix/design-system';
import { SidePanel } from './SidePanel';
import * as Icons from '@wix/wix-ui-icons-common';
import { useStores } from '../../hooks/useStores';
import { settingsStore } from '../../stores/SettingsStore';
import NoOrdersSvg from '../../assets/no-orders-found.svg';
import { useOrderController } from '../../hooks/useOrderController';
import { useOrderUpdates } from '../../hooks/useOrderUpdates';
import { StatusBadge } from '../shared/StatusBadge';
import { CustomerBadge } from '../shared/CustomerBadge';
import { formatDate } from '../../utils/formatters';
import { orderContainsProduct } from '../../utils/orderFilters';
import type { Order } from '../../types/Order';
import { dashboard } from '@wix/dashboard';
import { pages } from '@wix/ecom/dashboard';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { orders } from '@wix/ecom';
import { orderTransactions } from '@wix/ecom';
import { orderFulfillments } from '@wix/ecom';
import { SkuFilter } from '../Filters/SkuFilter';
import { FulfillmentController } from '../../controllers/FulfillmentController';
import { BulkFulfillmentModal } from '../BulkFulfillmentModal/BulkFulfillmentModal';
import { ProductsApiService } from '../../services/ProductsApiService';



const shimmer = keyframes`
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(calc(100vw + 100%));
  }
`;

const ShimmerOverlay = styled.div<{ $visible: boolean }>`
  display: ${props => props.$visible ? 'block' : 'none'};
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 5;
  overflow: hidden;
  
  &::after {
    content: '';
    position: absolute;
    top: 120px; /* Skip the toolbar and filter tags area */
    left: 0;
    width: 200px;
    bottom: 0;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0.2) 20%,
      rgba(255, 255, 255, 0.4) 35%,
      rgba(255, 255, 255, 0.5) 50%,
      rgba(255, 255, 255, 0.4) 65%,
      rgba(255, 255, 255, 0.2) 80%,
      rgba(255, 255, 255, 0) 100%
    );
    animation: ${shimmer} 2.5s infinite ease-in-out;
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
  }
`;

const TableContainer = styled.div`
  position: relative;
`;

const OrdersTable = observer(() => {
    const [showSidePanel, setShowSidePanel] = useState(false);
    const { orderStore, uiStore, settingsStore } = useStores();
    const { refreshing } = uiStore;
    const orderController = useOrderController();
    const highlightColor = settingsStore?.productHighlightColor || '#e9f0fe';
    const customStyles = `
    .canceled-row {
        opacity: 0.6;
    }
    .canceled-row * {
        color: #9ca3af !important;
    }
    tr[data-selected-order] {
        background-color: #e9f0fe !important;
    }
    .orders-table-container::-webkit-scrollbar {
        display: none; /* Chrome, Safari, Opera */
    }
        .orders-table-titlebar {
    position: sticky;
    top: 0;
    background: white;
    z-index: 5;
    
}

.orders-table-container {
    position: relative;
}
    .highlighted-row {
        background-image: linear-gradient(to right, ${highlightColor} 0px, ${highlightColor} 4px, transparent 4px) !important;
    }
    .highlighted-row:hover {
        background-image: linear-gradient(to right, ${highlightColor} 0px, ${highlightColor} 4px, transparent 4px) !important;
    }
`;

    const [selectedStatusFilter, setSelectedStatusFilter] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const batchSize = settingsStore?.initialOrderLimit || 30; // Default to 30 if not set

    const [orderTrackingCache, setOrderTrackingCache] = useState<Record<string, { trackingNumber?: string; trackingLink?: string } | null>>({});
    const [skuFilter, setSkuFilter] = useState<string[]>([]);
    const [fulfillmentStatusFilter, setFulfillmentStatusFilter] = useState<string | null>(null);
    const [paymentStatusFilter, setPaymentStatusFilter] = useState<string | null>(null);
    const [archiveStatusFilter, setArchiveStatusFilter] = useState<string | null>(null);
    const [dateFilter, setDateFilter] = useState<string | null>(null); const [customDateRange, setCustomDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
    const [selectedFulfillmentStatusFilter, setSelectedFulfillmentStatusFilter] = useState<string | null>(null);
    const [selectedPaymentStatusFilter, setSelectedPaymentStatusFilter] = useState<string | null>(null);
    const [isFulfillmentStatusLoading, setIsFulfillmentStatusLoading] = useState(false);
    const [isPaymentStatusLoading, setIsPaymentStatusLoading] = useState(false);
    const [productsApiFilter, setProductsApiFilter] = useState<string[]>([]);
    const [selectedProductsWithNames, setSelectedProductsWithNames] = useState<Array<{ id: string, name: string }>>([]);
    const [isProductsApiFiltering, setIsProductsApiFiltering] = useState(false);
    const [orderSeenCache, setOrderSeenCache] = useState<Record<string, boolean>>({});
    const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
    const fulfillmentController = new FulfillmentController(orderStore, uiStore, orderController.getOrderService());
    const [isBulkFulfillmentModalOpen, setIsBulkFulfillmentModalOpen] = useState(false);
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);
    const [printingOrders, setPrintingOrders] = useState<Record<string, boolean>>({});
    const [isPrinting, setIsPrinting] = useState(false);

    // Customer badge loading state - RE-ENABLED with stable implementation
    const [badgeLoadingProgress, setBadgeLoadingProgress] = useState<{
        isLoading: boolean;
        completed: number;
        total: number;
        currentEmail?: string;
    }>({ isLoading: false, completed: 0, total: 0 });

    // Track which customers have been processed to avoid duplicates
    const processedCustomersRef = useRef<Set<string>>(new Set());

    // Customer counts loading state - TEMPORARILY DISABLED
    // const [customerCountsLoaded, setCustomerCountsLoaded] = useState<Set<string>>(new Set());

    useOrderUpdates(orderStore.orders);

    const [searchValue, setSearchValue] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [isStatusFilterLoading, setIsStatusFilterLoading] = useState(false);

    const loadMoreOrders = useCallback(async () => {
        // Check if we're displaying search results
        const isDisplayingSearchResults = orderStore.searchQuery && orderStore.searchQuery.length > 0;

        if (isDisplayingSearchResults && orderStore.searchHasMore) {
            await orderController.loadMoreSearchResults();
        } else if (!orderStore.isLoadingMore && orderStore.hasMoreOrders && !isDisplayingSearchResults) {
            // Regular load more orders if not in search mode
            await orderController.loadMoreOrders();
        }
    }, [orderStore, orderController]);

    // Add this method to force refresh after creating a new order
    const refreshOrdersAfterNewOrder = useCallback(async () => {
        // Clear the cache for fresh data
        setOrderSeenCache({});
        // Reload orders
        await orderController.loadOrders();
    }, [orderController]);

    // Expose this globally so it can be called after order creation
    useEffect(() => {
        (window as any).refreshOrdersAfterNewOrder = refreshOrdersAfterNewOrder;
        return () => {
            delete (window as any).refreshOrdersAfterNewOrder;
        };
    }, [refreshOrdersAfterNewOrder]);



    useEffect(() => {
        setSearchValue(orderStore.searchQuery);
    }, [orderStore.searchQuery]);
    useEffect(() => {
        setIsSearching(uiStore.searching);
    }, [uiStore.searching]);

    const getTrackingInfo = async (orderId: string) => {
        if (orderTrackingCache[orderId] !== undefined) {
            return orderTrackingCache[orderId];
        }

        try {
            const response = await orderFulfillments.listFulfillmentsForSingleOrder(orderId);
            const fulfillments = response.orderWithFulfillments?.fulfillments || [];

            const withTracking = fulfillments
                .filter(f => f.trackingInfo?.trackingNumber)
                .sort((a, b) => {
                    const dateA = a._createdDate ? new Date(a._createdDate).getTime() : 0;
                    const dateB = b._createdDate ? new Date(b._createdDate).getTime() : 0;
                    return dateB - dateA;
                })[0];

            const trackingInfo = withTracking?.trackingInfo || null;

            setOrderTrackingCache(prev => ({
                ...prev,
                [orderId]: trackingInfo ? {
                    trackingNumber: trackingInfo.trackingNumber || undefined,
                    trackingLink: trackingInfo.trackingLink || undefined
                } : null
            }));

            return trackingInfo;
        } catch (error) {
            console.error('Error fetching tracking info for order:', orderId, error);
            setOrderTrackingCache(prev => ({
                ...prev,
                [orderId]: null
            }));
            return null;
        }
    };


    const checkOrderSeenStatus = async (orderId: string): Promise<boolean> => {
        // Return cached value if available
        if (orderSeenCache[orderId] !== undefined) {
            return orderSeenCache[orderId];
        }

        try {
            // Use the Wix eCommerce Orders API to get the actual seenByAHuman status
            const orderResponse = await orders.getOrder(orderId);
            const seenByAHuman = orderResponse.seenByAHuman;

            // If seenByAHuman is undefined or null, treat as NOT seen (new order)
            const isSeenByHuman = seenByAHuman === true;

            // Update cache
            setOrderSeenCache(prev => ({
                ...prev,
                [orderId]: isSeenByHuman
            }));

            return isSeenByHuman;
        } catch (error) {
            console.warn(`Failed to check order seen status for ${orderId}:`, error);
            // For new orders, default to NOT seen so they show as NEW
            setOrderSeenCache(prev => ({
                ...prev,
                [orderId]: false
            }));
            return false;
        }
    };

    const markOrderAsSeen = async (orderId: string) => {
        // Immediately update the local cache for instant UI feedback
        setOrderSeenCache(prev => ({
            ...prev,
            [orderId]: true
        }));

        try {
            // Update the seenByAHuman property in the Wix database
            await orders.bulkUpdateOrders([
                {
                    order: {
                        _id: orderId,
                        seenByAHuman: true
                    }
                }
            ]);

            // Debug log removed
        } catch (error) {
            console.error(`Failed to mark order ${orderId} as seen:`, error);
            // If the API call fails, revert the local cache
            setOrderSeenCache(prev => ({
                ...prev,
                [orderId]: false
            }));
        }
    };

    const handleAddNewOrder = () => {
        dashboard.navigate(
            pages.newOrder()
        );
    };

    const handleBulkFulfillment = async (params: {
        trackingNumber?: string;
        shippingProvider?: string;
        sendShippingEmail: boolean;
    }) => {
        setIsBulkProcessing(true);

        try {
            await fulfillmentController.bulkMarkOrdersAsFulfilled({
                orderIds: selectedOrderIds,
                trackingNumber: params.trackingNumber,
                shippingProvider: params.shippingProvider,
                sendShippingEmail: params.sendShippingEmail
            });

            // Clear selected orders
            setSelectedOrderIds([]);

            // Refresh orders silently (same as refresh button but without shimmer)
            try {
                const result = await orderController.getOrderService().fetchOrders({
                    limit: 50,
                    cursor: undefined
                });

                if (result.success && result.orders && result.orders.length > 0) {
                    orderStore.setOrders(result.orders);
                    orderStore.setPagination({
                        hasNext: result.pagination?.hasNext || false,
                        nextCursor: result.pagination?.nextCursor || '',
                        prevCursor: result.pagination?.prevCursor || ''
                    });
                    orderStore.setConnectionStatus('connected');
                }
            } catch (refreshError) {
                console.warn('Silent refresh after bulk fulfillment failed:', refreshError);
            }

        } catch (error) {
            console.error('Bulk fulfillment failed:', error);
        } finally {
            setIsBulkProcessing(false);
        }
    };

    const handleTrackOrder = async (order: Order) => {
        const trackingInfo = await getTrackingInfo(order._id);
        if (trackingInfo?.trackingLink) {
            window.open(trackingInfo.trackingLink, '_blank', 'noopener,noreferrer');
        }
    };

    const convertWixImageUrl = (imageUrl: string): string => {
        if (!imageUrl) return '';

        if (imageUrl.startsWith('wix:image://v1/')) {
            const imageId = imageUrl.replace('wix:image://v1/', '').split('#')[0];
            return `https://static.wixstatic.com/media/${imageId}/v1/fill/w_100,h_100,al_c,q_80,usm_0.66_1.00_0.01,enc_auto/${imageId}.jpg`;
        }

        if (imageUrl.includes('static.wixstatic.com')) {
            try {
                const url = new URL(imageUrl);
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

        try {
            const url = new URL(imageUrl);
            url.searchParams.set('w', '100');
            url.searchParams.set('h', '100');
            url.searchParams.set('fit', 'fill');
            url.searchParams.set('f', 'jpg');
            return url.toString();
        } catch (error) {
            return imageUrl;
        }
    };

    const convertImageToBase64 = async (imageUrl: string): Promise<string> => {
        try {
            if (!imageUrl || imageUrl.trim() === '') {
                return '';
            }

            // Debug log removed
            const accessibleUrl = convertWixImageUrl(imageUrl);
            // Debug log removed

            const urlsToTry = [
                accessibleUrl,
                imageUrl.startsWith('wix:image://v1/')
                    ? `https://static.wixstatic.com/media/${imageUrl.replace('wix:image://v1/', '').split('#')[0]}`
                    : null,
                imageUrl.startsWith('wix:image://v1/')
                    ? `https://static.wixstatic.com/media/${imageUrl.replace('wix:image://v1/', '').split('#')[0]}/v1/fit/w_100,h_100,al_c,q_80/${imageUrl.replace('wix:image://v1/', '').split('#')[0].split('~')[0]}.jpg`
                    : null
            ].filter(Boolean);

            for (const urlToTry of urlsToTry) {
                try {
                    // Debug log removed

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
                    // Debug log removed

                    if (blob.size === 0) {
                        console.warn('Empty blob received');
                        continue;
                    }

                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => {
                            const result = reader.result as string;
                            // Debug log removed
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

    const extractImageUrl = (item: any): string => {
        const possibleImagePaths = [
            item.image,
            item.imageUrl,
            item.mediaUrl,
            item.thumbnail,
            item.catalogReference?.options?.image,
            item.productSnapshot?.image,
            item.productSnapshot?.media?.[0]?.url,
            item.catalogReference?.catalogItemId // Sometimes the image is linked via catalog item
        ];

        for (const path of possibleImagePaths) {
            if (path && typeof path === 'string' && path.trim() !== '') {
                return path;
            }
        }

        // Debug log removed
        return '';
    };

    /**
     * Helper function to get proper discount display text (matching ProductImages logic)
     */
    const getDiscountDisplayText = (order: Order): string => {
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

    /**
     * Helper function to get shipping address (matching ShippingAddress component logic)
     */
    const getShippingAddress = (order: Order) => {
        if (order.shippingAddress) return order.shippingAddress;
        // Check for the actual shipping destination address first
        if (order.rawOrder?.shippingInfo?.logistics?.shippingDestination?.address) return order.rawOrder.shippingInfo.logistics.shippingDestination.address;
        if (order.rawOrder?.shippingInfo?.shipmentDetails?.address) return order.rawOrder.shippingInfo.shipmentDetails.address;
        if (order.rawOrder?.recipientInfo?.contactDetails?.address) return order.rawOrder.recipientInfo.contactDetails.address;
        // Only fall back to billing address as last resort
        if (order.billingInfo?.address) return order.billingInfo.address;
        return null;
    };

    /**
     * Helper function to get billing info (matching BillingAddress component logic)
     */
    const getBillingInfo = (order: Order) => {
        if (order.billingInfo) return order.billingInfo;
        if (order.rawOrder?.billingInfo) return order.rawOrder.billingInfo;
        return null;
    };

    /**
     * Helper function to compare addresses for "Same as shipping" logic
     */
    const compareAddresses = (billingAddress: any, shippingAddress: any): boolean => {
        if (!billingAddress || !shippingAddress) return false;

        const normalize = (str: string | undefined | null): string => {
            return (str || '').toLowerCase().trim().replace(/\s+/g, ' ');
        };

        const getStreetString = (address: any): string => {
            if (address.streetAddress?.name || address.streetAddress?.number) {
                return normalize(`${address.streetAddress?.name || ''} ${address.streetAddress?.number || ''}`);
            }
            return normalize(address.addressLine1 || '');
        };

        const getApartmentString = (address: any): string => {
            if (address.streetAddress?.apt) {
                return normalize(address.streetAddress.apt);
            }
            return normalize(address.addressLine2 || '');
        };

        const billingStreet = getStreetString(billingAddress);
        const shippingStreet = getStreetString(shippingAddress);

        const billingApartment = getApartmentString(billingAddress);
        const shippingApartment = getApartmentString(shippingAddress);

        const billingCity = normalize(billingAddress.city);
        const shippingCity = normalize(shippingAddress.city);

        const billingPostal = normalize(billingAddress.postalCode);
        const shippingPostal = normalize(shippingAddress.postalCode);

        const billingCountry = normalize(billingAddress.country);
        const shippingCountry = normalize(shippingAddress.country);

        const streetsMatch = billingStreet === shippingStreet && billingStreet !== '';
        const apartmentsMatch = billingApartment === shippingApartment;
        const citiesMatch = billingCity === shippingCity && billingCity !== '';
        const postalMatch = billingPostal === shippingPostal && billingPostal !== '';
        const countriesMatch = billingCountry === shippingCountry && billingCountry !== '';

        return streetsMatch && apartmentsMatch && citiesMatch && postalMatch && countriesMatch;
    };

    /**
     * Handles the print order functionality with loading state in the title
     * Shows "Getting ready to Print..." in the browser tab while preparing the order for printing
     */
    const handlePrintOrder = async (order: Order) => {
        try {
            // Debug log removed
            setIsPrinting(true);

            // Get customer info from multiple sources
            const recipientContact = order.rawOrder?.recipientInfo?.contactDetails;
            const billingContact = order.rawOrder?.billingInfo?.contactDetails;
            const customerFirstName = recipientContact?.firstName || billingContact?.firstName || order.customer.firstName || 'Unknown';
            const customerLastName = recipientContact?.lastName || billingContact?.lastName || order.customer.lastName || 'Customer';
            const customerEmail = recipientContact?.email || billingContact?.email || order.customer.email || '';
            const customerPhone = recipientContact?.phone || billingContact?.phone || order.customer.phone || '';

            // Shipping method for display (keeping this as it's still used)
            const shippingMethod = order.rawOrder?.shippingInfo?.title || 'Standard Shipping';

            // Fetch payment method from order transactions
            let paymentMethod = 'Credit Card'; // Default fallback
            try {
                // Debug log removed
                const transactionResponse = await orderTransactions.listTransactionsForSingleOrder(order._id);
                const payments = transactionResponse.orderTransactions?.payments || [];

                if (payments.length > 0) {
                    const firstPayment = payments[0];
                    const rawPaymentMethod = firstPayment.regularPaymentDetails?.paymentMethod ||
                        (firstPayment.giftcardPaymentDetails ? 'Gift Card' : null);

                    // Format payment method for display
                    if (rawPaymentMethod) {
                        switch (rawPaymentMethod) {
                            case 'CreditCard':
                                paymentMethod = 'Credit Card';
                                break;
                            case 'PayPal':
                                paymentMethod = 'PayPal';
                                break;
                            case 'Cash':
                                paymentMethod = 'Cash';
                                break;
                            case 'Offline':
                                paymentMethod = 'Offline Payment';
                                break;
                            case 'InPerson':
                                paymentMethod = 'In Person';
                                break;
                            case 'PointOfSale':
                                paymentMethod = 'Point of Sale';
                                break;
                            case 'Gift Card':
                                paymentMethod = 'Gift Card';
                                break;
                            default:
                                paymentMethod = rawPaymentMethod;
                        }
                    }
                    // Debug log removed
                } else {
                    // Debug log removed
                }
            } catch (error) {
                console.error('Error fetching payment method:', error);
                // Keep default fallback value
            }

            // STEP 1: Process all images first (convert to base64) with improved Wix URL handling
            const processedLineItems = await Promise.all(
                (order.rawOrder?.lineItems || []).map(async (item: any) => {
                    let base64Image = '';

                    // Extract image URL from various possible locations
                    const imageUrl = extractImageUrl(item);

                    if (imageUrl) {
                        try {
                            // Debug log removed
                            base64Image = await convertImageToBase64(imageUrl);
                            // Debug log removed
                        } catch (error) {
                            console.error(`Failed to convert image for ${item.productName?.original}:`, error);
                        }
                    }

                    return {
                        ...item,
                        base64Image,
                        originalImageUrl: imageUrl
                    };
                })
            );

            // STEP 2: Generate line items HTML with base64 images and options instead of SKU
            const lineItemsHTML = processedLineItems.map((item: any) => {
                const productName = item.productName?.original || 'Unknown Product';
                const quantity = item.quantity || 1;
                const price = parseFloat(item.price?.amount) || 0;
                const total = parseFloat(item.totalPriceAfterTax?.amount) || (price * quantity);
                const currency = item.price?.currency || '€';

                // Get product options - improved extraction
                let optionsHTML = '';
                if (item.catalogReference?.options?.options) {
                    optionsHTML = Object.entries(item.catalogReference.options.options)
                        .map(([key, value]: [string, any]) => `<div style="color: #666; font-size: 8px;">${key}: ${value}</div>`)
                        .join('');
                } else if (item.options) {
                    // Alternative location for options
                    optionsHTML = Object.entries(item.options)
                        .map(([key, value]: [string, any]) => `<div style="color: #666; font-size: 8px;">${key}: ${value}</div>`)
                        .join('');
                } else if (item.productName?.translated && item.productName.translated !== item.productName.original) {
                    // Show translated name as an option if different
                    optionsHTML = `<div style="color: #666; font-size: 8px;">Variant: ${item.productName.translated}</div>`;
                }

                // Use base64 image if available, otherwise show placeholder
                const imageHTML = item.base64Image
                    ? `<img src="${item.base64Image}" style="max-width: 100%; max-height: 100%; object-fit: cover; border-radius: 2px;" alt="${productName}" />`
                    : '<span style="font-size: 8px; color: #999; text-align: center; display: block;">No Image</span>';

                return `
        <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 8px 0; vertical-align: top; width: 60%;">
                <div style="display: flex; align-items: flex-start;">
                    <div style="width: 50px; height: 40px; background-color: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; margin-right: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                        ${imageHTML}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: bold; margin-bottom: 3px; font-size: 10px;">${productName}</div>
                        ${optionsHTML || '<div style="color: #666; font-size: 8px;"></div>'}
                    </div>
                </div>
            </td>
            <td style="text-align: right; padding: 8px 40px 8px 0; vertical-align: top; width: 15%;">
                <div style="font-size: 10px;">${price.toFixed(2)} ${currency}</div>
            </td>
            <td style="text-align: right; padding: 8px 40px 8px 0; vertical-align: top; width: 10%;">
                <div style="font-size: 10px;">x ${quantity}</div>
            </td>
            <td style="text-align: right; padding: 8px 0; vertical-align: top; width: 15%;">
                <div style="font-weight: bold; font-size: 10px;">${total.toFixed(2)} ${currency}</div>
            </td>
        </tr>
    `;
            }).join('');

            // STEP 3: Create the complete print HTML with improved pricing layout
            const printElement = document.createElement('div');
            printElement.innerHTML = `
    <div style="padding: 35px; font-family: Arial, sans-serif; color: #333; max-width: 800px; margin: 0 auto;">
        <!-- Header -->
        <div style="border-bottom: 1px solid #333; padding-bottom: 8px; margin-bottom: 15px;">
            <h1 style="margin: 0; font-size: 18px; font-weight: bold;">Order #${order.number} (${order.rawOrder?.lineItems?.length || 0} items)</h1>
            <div style="font-size: 9px; color: #666; margin-top: 4px;">
                Placed on ${formatDate(order._createdDate)}
            </div>
            <div style="font-size: 9px; margin-top: 2px;">
                ${customerFirstName} ${customerLastName} | ${customerEmail} | ${customerPhone}
            </div>
        </div>

        <!-- Products -->
        <table style="width: 100%; border-collapse: collapse;">
            ${lineItemsHTML}
        </table>

        <!-- Pricing Summary -->
        <div style="margin-bottom: 15px;">
            <div style="padding-top: 8px; margin-top: 15px;">
                <div style="display: flex; justify-content: flex-end;">
                    <table style="border-collapse: collapse; width: 210px;">
                        <tr>
                            <td style="text-align: left; padding: 1px 4px 1px 0;">
                                <span style="font-size: 11px;">Subtotal</span>
                            </td>
                            <td style="text-align: right; padding: 1px 0;">
                                <span style="font-size: 11px;">${order.rawOrder?.priceSummary?.subtotal?.formattedAmount || '0,00 €'}</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align: left; padding: 1px 4px 1px 0;">
                                <span style="font-size: 11px;">Shipping</span>
                            </td>
                            <td style="text-align: right; padding: 1px 0;">
                                <span style="font-size: 11px;">${order.rawOrder?.priceSummary?.shipping?.formattedAmount || '0,00 €'}</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align: left; padding: 1px 4px 1px 0;">
                                <span style="font-size: 11px;">Tax</span>
                            </td>
                            <td style="text-align: right; padding: 1px 0;">
                                <span style="font-size: 11px;">${order.rawOrder?.priceSummary?.tax?.formattedAmount || '0,00 €'}</span>
                            </td>
                        </tr>
                        ${order.rawOrder?.priceSummary?.discount?.amount && order.rawOrder.priceSummary.discount.amount > 0 ? `
                        <tr>
                            <td style="text-align: left; padding: 1px 4px 1px 0;">
                                <span style="font-size: 11px;">${getDiscountDisplayText(order)}</span>
                            </td>
                            <td style="text-align: right; padding: 1px 0;">
                                <span style="font-size: 11px;">-${order.rawOrder.priceSummary.discount.formattedAmount || `${order.rawOrder.priceSummary.discount.amount} ${order.rawOrder.priceSummary.discount.currency || ''}`}</span>
                            </td>
                        </tr>
                        ` : ''}
                        <tr>
                            <td style="text-align: left; padding: 3px 4px 1px 0; border-top: 1px solid #333;">
                                <span style="font-size: 12px; font-weight: bold;">Total</span>
                            </td>
                            <td style="text-align: right; padding: 3px 0 1px 0; border-top: 1px solid #333;">
                                <span style="font-size: 12px; font-weight: bold;">${order.rawOrder?.priceSummary?.total?.formattedAmount || order.total}</span>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
        </div>

        <!-- Customer Info Section -->
        <div style="margin-top: 15px;">
            <h2 style="font-size: 14px; margin-bottom: 12px; border-bottom: 1px solid #ddd; padding-bottom: 4px;">Customer Info</h2>
            
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <!-- Shipping Address -->
                <div style="width: 45%;">
                    <h3 style="font-size: 11px; margin-bottom: 6px; font-weight: bold;">Shipping Address:</h3>
                    <div style="line-height: 1.4; font-size: 9px;">
                        ${(() => {
                    const shipAddr = getShippingAddress(order);
                    const recipientInfo = order.rawOrder?.recipientInfo?.contactDetails;
                    const billingInfo = order.rawOrder?.billingInfo?.contactDetails;

                    let html = '';

                    // Recipient Name
                    const firstName = recipientInfo?.firstName || billingInfo?.firstName || customerFirstName || '';
                    const lastName = recipientInfo?.lastName || billingInfo?.lastName || customerLastName || '';
                    if (firstName || lastName) {
                        html += `<div>${firstName} ${lastName}</div>`;
                    }

                    // Company Name (ONLY from shipping/recipient info, NOT from billing)
                    if (recipientInfo?.company) {
                        html += `<div>${recipientInfo.company}</div>`;
                    }

                    if (shipAddr) {
                        // Street Address (streetAddress.name + number OR addressLine1)
                        if (shipAddr.streetAddress?.name || shipAddr.streetAddress?.number) {
                            const street = `${shipAddr.streetAddress?.name || ''} ${shipAddr.streetAddress?.number || ''}`.trim();
                            if (street) html += `<div>${street}</div>`;
                        } else if (shipAddr.addressLine1) {
                            html += `<div>${shipAddr.addressLine1}</div>`;
                        }

                        // Apartment/Unit (streetAddress.apt OR addressLine2)
                        if (shipAddr.streetAddress?.apt) {
                            html += `<div>${shipAddr.streetAddress.apt}</div>`;
                        } else if (shipAddr.addressLine2) {
                            html += `<div>${shipAddr.addressLine2}</div>`;
                        }

                        // Postal Code
                        if (shipAddr.postalCode) {
                            html += `<div>${shipAddr.postalCode}</div>`;
                        }

                        // City
                        if (shipAddr.city) {
                            html += `<div>${shipAddr.city}</div>`;
                        }

                        // State/Province
                        if (shipAddr.subdivisionFullname || shipAddr.subdivision) {
                            html += `<div>${shipAddr.subdivisionFullname || shipAddr.subdivision}</div>`;
                        }

                        // Country
                        if (shipAddr.country) {
                            html += `<div>${shipAddr.countryFullname || shipAddr.country}</div>`;
                        }
                    }

                    // Add shipping method at the end
                    html += `<div style="margin-top: 6px; font-weight: bold; color: #333;">${shippingMethod}</div>`;

                    return html;
                })()}
                    </div>
                </div>

                <!-- Billing Address -->
                <div style="width: 45%;">
                    <h3 style="font-size: 11px; margin-bottom: 6px; font-weight: bold;">Billing Address:</h3>
                    <div style="line-height: 1.4; font-size: 9px;">
                        ${(() => {
                    const billingInfo = getBillingInfo(order);
                    const shipAddr = getShippingAddress(order);

                    if (!billingInfo || !billingInfo.address) {
                        return '<div style="font-style: italic; color: #666;">No billing address available</div>';
                    }

                    const billingAddr = billingInfo.address;
                    const isSameAsShipping = compareAddresses(billingAddr, shipAddr);

                    if (isSameAsShipping) {
                        return '<div style="font-style: italic; color: #666;">Same as shipping</div>';
                    }

                    let html = '';
                    const contactDetails = billingInfo.contactDetails;

                    // Contact Name
                    if (contactDetails?.firstName || contactDetails?.lastName) {
                        html += `<div>${contactDetails.firstName || ''} ${contactDetails.lastName || ''}</div>`;
                    }

                    // Street Address (streetAddress.name + number OR addressLine1)
                    if (billingAddr.streetAddress?.name || billingAddr.streetAddress?.number) {
                        const street = `${billingAddr.streetAddress?.name || ''} ${billingAddr.streetAddress?.number || ''}`.trim();
                        if (street) html += `<div>${street}</div>`;
                    } else if (billingAddr.addressLine1) {
                        html += `<div>${billingAddr.addressLine1}</div>`;
                    }

                    // Apartment/Unit (streetAddress.apt OR addressLine2)
                    if (billingAddr.streetAddress?.apt) {
                        html += `<div>${billingAddr.streetAddress.apt}</div>`;
                    } else if (billingAddr.addressLine2) {
                        html += `<div>${billingAddr.addressLine2}</div>`;
                    }

                    // Postal Code
                    if (billingAddr.postalCode) {
                        html += `<div>${billingAddr.postalCode}</div>`;
                    }

                    // City
                    if (billingAddr.city) {
                        html += `<div>${billingAddr.city}</div>`;
                    }

                    // State/Province
                    if (billingAddr.subdivisionFullname || billingAddr.subdivision) {
                        html += `<div>${billingAddr.subdivisionFullname || billingAddr.subdivision}</div>`;
                    }

                    // Country
                    if (billingAddr.country) {
                        html += `<div>${billingAddr.countryFullname || billingAddr.country}</div>`;
                    }

                    return html;
                })()}
                        <div style="margin-top: 6px; font-weight: bold; color: #333;">Paid with ${paymentMethod}</div>
                    </div>
                </div>
            </div>

            <!-- Additional Info -->
            ${order.rawOrder?.customFields && order.rawOrder.customFields.length > 0 ? `
                <div>
                    <h3 style="font-size: 11px; margin-bottom: 6px; font-weight: bold;">Additional Info</h3>
                    <div style="line-height: 1.2; font-size: 9px;">
                        ${order.rawOrder.customFields.map((field: any) =>
                    `<div>${field.translatedTitle || field.title}: ${field.value}</div>`
                ).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    </div>
`;

            // Add to document temporarily
            printElement.style.position = 'absolute';
            printElement.style.left = '-9999px';
            printElement.style.top = '0';
            document.body.appendChild(printElement);

            // Convert to canvas then PDF with better settings for images
            const canvas = await html2canvas(printElement, {
                scale: 2,
                useCORS: true,
                allowTaint: false,
                backgroundColor: '#ffffff',
                logging: true,
                imageTimeout: 15000, // Increased timeout for image loading
                onclone: (clonedDoc) => {
                    // Ensure all images are properly loaded in cloned document
                    const images = clonedDoc.querySelectorAll('img');
                    images.forEach((img, index) => {
                        if (img.src.startsWith('data:')) {
                            img.style.maxWidth = '100%';
                            img.style.maxHeight = '100%';
                            img.style.objectFit = 'cover';
                            img.style.display = 'block';
                        }
                    });
                }
            });

            const imgData = canvas.toDataURL('image/png');

            // Create PDF with single page
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = pdfWidth;
            const imgHeight = (canvas.height * pdfWidth) / canvas.width;

            // Scale down if image is too tall for one page
            if (imgHeight > pdfHeight) {
                const scaleFactor = pdfHeight / imgHeight;
                const scaledWidth = imgWidth * scaleFactor;
                const scaledHeight = pdfHeight;
                const xOffset = (pdfWidth - scaledWidth) / 2;

                pdf.addImage(imgData, 'PNG', xOffset, 0, scaledWidth, scaledHeight);
            } else {
                pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            }

            // Create blob URL and open
            const pdfBlob = pdf.output('blob');
            const blobUrl = URL.createObjectURL(pdfBlob);
            window.open(blobUrl, '_blank');

            // Clean up
            document.body.removeChild(printElement);

            // Debug log removed

        } catch (error) {
            console.error('Failed to generate PDF:', error);
            alert('Failed to generate PDF. Please try again.');
        } finally {
            setIsPrinting(false);
        }
    };

    const handleArchiveOrder = async (order: Order) => {
        try {
            const ordersToUpdate = [
                {
                    order: {
                        _id: String(order._id),
                        archived: true
                    }
                }
            ];

            const options = {
                returnEntity: false
            };

            const response = await orders.bulkUpdateOrders(ordersToUpdate, options);

            // Show success toast
            dashboard.showToast({
                message: `Order #${order.number} has been archived successfully!`,
                type: 'success'
            });

            // Remove the archived order from the current list instead of reloading all orders
            orderStore.removeOrder(order._id);

        } catch (error) {
            console.error("Error archiving order:", error);
            dashboard.showToast({
                message: `Failed to archive order #${order.number}. Please try again.`,
                type: 'error'
            });
        }
    };

    const statusFilterOptions = [
        { id: 'unfulfilled', value: 'Unfulfilled' },
        { id: 'fulfilled', value: 'Fulfilled' },
        { id: 'unpaid', value: 'Unpaid' },
        { id: 'refunded', value: 'Refunded' },
        { id: 'canceled', value: 'Canceled' },
        { id: 'archived', value: 'Archived' }
    ];

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setSearchValue(newValue);

        orderController.updateSearchQuery(newValue, selectedStatusFilter ? [selectedStatusFilter] : undefined);
    };

    const handleSearchClear = () => {
        setSearchValue('');
        orderController.clearSearch();
    };

    const handleFulfillmentStatusFilterChange = async (status: string | null) => {
        setIsFulfillmentStatusLoading(true);
        setSelectedFulfillmentStatusFilter(status);

        try {
            if (status) {
                await orderController.performFulfillmentStatusFilter(status);
                // Debug log removed
            } else {
                orderController.clearStatusFilter();
                // Debug log removed
            }
        } finally {
            setIsFulfillmentStatusLoading(false);
        }
    };

    const handlePaymentStatusFilterChange = async (status: string | null) => {
        setIsPaymentStatusLoading(true);
        setSelectedPaymentStatusFilter(status);

        try {
            if (status) {
                await orderController.performPaymentStatusFilter(status);
                // Debug log removed
            } else {
                orderController.clearStatusFilter();
                // Debug log removed
            }
        } finally {
            setIsPaymentStatusLoading(false);
        }
    };

    const handleArchiveStatusFilterChange = (status: string | null) => {
        setArchiveStatusFilter(status);
        // Debug log removed
    };

    const handleProductsApiFilterChange = async (productIds: string[], selectedProducts: Array<{ id: string, name: string }> = []) => {
        setSelectedProductsWithNames(selectedProducts);
        setProductsApiFilter(productIds);

        if (productIds.length > 0) {
            setIsProductsApiFiltering(true);
            try {
                // Search orders using the Products API service
                const response = await ProductsApiService.searchOrdersByMultipleProducts(productIds, 100);

                if (response.success) {
                    // Transform the API response to match our Order interface
                    const transformedOrders = response.orders.map(apiOrder => ({
                        _id: apiOrder._id,
                        number: apiOrder.number,
                        _createdDate: apiOrder._createdDate,
                        customer: {
                            firstName: apiOrder.buyerInfo?.firstName || 'Unknown',
                            lastName: apiOrder.buyerInfo?.lastName || 'Customer',
                            email: apiOrder.buyerInfo?.email || '',
                            phone: apiOrder.buyerInfo?.phone || '',
                            company: apiOrder.buyerInfo?.company || ''
                        },
                        totalWeight: apiOrder.totalWeight || 0,
                        total: apiOrder.priceSummary?.total?.formattedAmount || '0',
                        status: apiOrder.fulfillmentStatus || 'NOT_FULFILLED',
                        paymentStatus: apiOrder.paymentStatus || 'UNPAID',
                        shippingInfo: {
                            carrierId: apiOrder.shippingInfo?.carrierId || '',
                            title: apiOrder.shippingInfo?.title || 'Standard Shipping',
                            cost: apiOrder.shippingInfo?.cost?.formattedAmount || '0'
                        },
                        weightUnit: apiOrder.weightUnit || 'kg',
                        shippingAddress: apiOrder.shippingInfo?.logistics?.shippingDestination?.address || apiOrder.shippingInfo?.shipmentDetails?.address,
                        billingInfo: apiOrder.billingInfo,
                        recipientInfo: apiOrder.recipientInfo,
                        buyerNote: apiOrder.buyerNote,
                        rawOrder: apiOrder,
                        customFields: apiOrder.customFields,
                        extendedFields: apiOrder.extendedFields,
                        lineItems: apiOrder.lineItems
                    }));

                    // Replace the current orders with API search results
                    orderStore.setFilteredOrders(transformedOrders);
                    // Debug log removed
                } else {
                    console.error('Products API search failed:', response.error);
                    // Clear results on error
                    orderStore.setFilteredOrders([]);
                }
            } catch (error) {
                console.error('Error searching orders by products:', error);
                // Clear results on error  
                orderStore.setFilteredOrders([]);
            } finally {
                setIsProductsApiFiltering(false);
            }
        } else {
            // Clear Products API filter - restore original orders
            orderStore.clearProductsApiFilter();
            // Debug log removed
        }
    };

    const handleViewOrder = (order: Order) => {
        try {
            if (!order?._id) {
                console.error('Order ID is missing');
                return;
            }

            const orderId = String(order._id).trim();

            dashboard.navigate(
                pages.orderDetails({
                    id: orderId
                })
            );

        } catch (error) {
            console.error('Navigation failed:', error);
        }
    };

    const handleRowClick = async (order: Order, event?: any) => {


        // Remove all previous selections
        document.querySelectorAll('[data-selected-order]').forEach(row => {
            row.removeAttribute('data-selected-order');
        });

        // Get the clicked row element and mark it as selected
        const clickedRow = event?.currentTarget?.closest('tr');
        if (clickedRow) {
            clickedRow.setAttribute('data-selected-order', order._id);
        }

        // Mark order as seen when clicked (both locally and in database)
        await markOrderAsSeen(order._id);

        // Update store for other functionality (OrderDetails panel)
        orderController.selectOrder(order);
    };

    const handleSelectionChange = (selectedIds: string[]) => {
        setSelectedOrderIds(selectedIds);
        // Debug log removed
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = finalFilteredOrders.map(order => order._id);
            setSelectedOrderIds(allIds);
        } else {
            setSelectedOrderIds([]);
        }
    };

    const statusFilteredOrders = orderStore.filteredOrders;

    // Memoized filtering function for better performance
    const getFilteredOrders = useCallback(() => {
        let orders = statusFilteredOrders;

        // Handle archive status filter
        if (archiveStatusFilter === 'archived') {
            orders = orders.filter(order => {
                return order.rawOrder?.archived === true || order.archived === true;
            });
        } else {
            orders = orders.filter(order => {
                return !order.rawOrder?.archived && !order.archived;
            });
        }

        if (dateFilter && dateFilter !== 'all') {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            orders = orders.filter(order => {
                const orderDate = new Date(order._createdDate);

                switch (dateFilter) {
                    case 'last7days':
                        const sevenDaysAgo = new Date(today);
                        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                        return orderDate >= sevenDaysAgo;

                    case 'last14days':
                        const fourteenDaysAgo = new Date(today);
                        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
                        return orderDate >= fourteenDaysAgo;

                    case 'lastmonth':
                        const lastMonth = new Date(today);
                        lastMonth.setMonth(lastMonth.getMonth() - 1);
                        return orderDate >= lastMonth;

                    case 'custom':
                        if (customDateRange.from && customDateRange.to) {
                            const fromDate = new Date(customDateRange.from);
                            fromDate.setHours(0, 0, 0, 0);
                            const toDate = new Date(customDateRange.to);
                            toDate.setHours(23, 59, 59, 999);
                            return orderDate >= fromDate && orderDate <= toDate;
                        } else if (customDateRange.from) {
                            const fromDate = new Date(customDateRange.from);
                            fromDate.setHours(0, 0, 0, 0);
                            return orderDate >= fromDate;
                        } else if (customDateRange.to) {
                            const toDate = new Date(customDateRange.to);
                            toDate.setHours(23, 59, 59, 999);
                            return orderDate <= toDate;
                        }
                        return true;

                    default:
                        return true;
                }
            });
        }

        if (fulfillmentStatusFilter) {
            orders = orders.filter(order => {
                const fulfillmentStatus = order.status ||
                    order.rawOrder?.fulfillmentStatus ||
                    order.rawOrder?.status ||
                    'NOT_FULFILLED';

                switch (fulfillmentStatusFilter) {
                    case 'unfulfilled':
                        return fulfillmentStatus === 'NOT_FULFILLED';
                    case 'fulfilled':
                        return fulfillmentStatus === 'FULFILLED';
                    case 'partially_fulfilled':
                        return fulfillmentStatus === 'PARTIALLY_FULFILLED';
                    case 'canceled':
                        return fulfillmentStatus === 'CANCELED' ||
                            order.rawOrder?.status === 'CANCELED';
                    case 'archived':
                        return order.rawOrder?.archived === true || order.archived === true;
                    default:
                        return true;
                }
            });
        }

        if (paymentStatusFilter) {
            orders = orders.filter(order => {
                const paymentStatus = order.paymentStatus ||
                    order.rawOrder?.paymentStatus ||
                    order.rawOrder?.priceSummary?.paymentStatus ||
                    'UNKNOWN';

                switch (paymentStatusFilter) {
                    case 'paid':
                        return paymentStatus === 'PAID';
                    case 'unpaid':
                        return paymentStatus === 'UNPAID';
                    case 'refunded':
                        return paymentStatus === 'FULLY_REFUNDED';
                    case 'partially_refunded':
                        return paymentStatus === 'PARTIALLY_REFUNDED';
                    case 'partially_paid':
                        return paymentStatus === 'PARTIALLY_PAID';
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
            });
        }

        // Optimize SKU filtering with Set for O(1) lookups
        if (skuFilter.length > 0) {
            const skuSet = new Set(skuFilter);
            orders = orders.filter(order => {
                const lineItems = order.rawOrder?.lineItems || order.lineItems || order.items || [];

                return lineItems.some((item: any) => {
                    const itemSku = item.physicalProperties?.sku ||
                        item.catalogReference?.catalogItemId ||
                        item.sku ||
                        item.productId;

                    return itemSku && skuSet.has(itemSku);
                });
            });
        }

        return orders;
    }, [statusFilteredOrders, archiveStatusFilter, dateFilter, customDateRange, fulfillmentStatusFilter, paymentStatusFilter, skuFilter]);

    // Memoized filtered orders computation
    const finalFilteredOrders = useMemo(() => {
        return getFilteredOrders();
    }, [
        getFilteredOrders,
        orderStore.updateTrigger
    ]);

    // Memoized table data transformation
    const tableData = useMemo(() =>
        finalFilteredOrders.map(order => ({
            id: order._id,
            ...order
        })),
        [finalFilteredOrders]
    );

    // Memoized customer emails extraction
    const visibleCustomerEmails = useMemo(() => {
        if (!settingsStore.settings.showCustomerBadges || finalFilteredOrders.length === 0) {
            return [];
        }

        return Array.from(new Set(
            finalFilteredOrders.slice(0, 50).map(order => {
                const recipientContact = order.rawOrder?.recipientInfo?.contactDetails;
                const billingContact = order.rawOrder?.billingInfo?.contactDetails;
                const buyerEmail = order.rawOrder?.buyerInfo?.email;
                return recipientContact?.email || billingContact?.email || buyerEmail || order.customer.email;
            }).filter(email => email && email.trim() !== '')
        ));
    }, [finalFilteredOrders, settingsStore.settings.showCustomerBadges]);

    // Customer badge loading logic - RE-ENABLED with safer implementation
    useEffect(() => {
        if (!settingsStore.settings.showCustomerBadges) {
            setBadgeLoadingProgress({ isLoading: false, completed: 0, total: 0 });
            return;
        }

        // Only process if we have customer emails
        if (visibleCustomerEmails.length === 0) {
            return;
        }

        // Only process customers we haven't processed AND don't have cached counts
        const newCustomers = visibleCustomerEmails.filter(email => {
            const isNotProcessed = !processedCustomersRef.current.has(email);
            const hasNoCache = orderStore.getCachedCustomerOrderCount(email) === 0;
            return isNotProcessed && hasNoCache;
        });

        if (newCustomers.length === 0) {
            // All customers already have cached counts
            return;
        }

        // Mark these customers as being processed
        newCustomers.forEach(email => processedCustomersRef.current.add(email));

        // Start batch processing (your sequential approach)
        const processBadgeData = async () => {
            // Don't skip if we have customers to process
            if (newCustomers.length === 0) {
                return;
            }

            setBadgeLoadingProgress({
                isLoading: true,
                completed: 0,
                total: newCustomers.length
            });

            try {
                // Sequential processing (your approach) - one customer at a time
                for (let i = 0; i < newCustomers.length; i++) {
                    const email = newCustomers[i];

                    try {
                        setBadgeLoadingProgress(prev => ({
                            ...prev,
                            currentEmail: email,
                            completed: i
                        }));

                        // Mark as processed immediately to prevent duplicates
                        processedCustomersRef.current.add(email);

                        // Get count for this customer
                        const count = await orderStore.getCustomerOrderCount(email);

                        // Update progress
                        setBadgeLoadingProgress(prev => ({
                            ...prev,
                            completed: i + 1
                        }));

                        // Delay between customers to prevent API overload
                        if (i < newCustomers.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 300));
                        }

                    } catch (error) {
                        console.error(`❌ Failed to process ${email}:`, error);
                    }
                }

                // Debug log removed
            } catch (error) {
                console.error('❌ Badge processing failed:', error);
            } finally {
                setBadgeLoadingProgress({
                    isLoading: false,
                    completed: newCustomers.length,
                    total: newCustomers.length
                });
            }
        };
        // Debounce the processing to prevent rapid fire calls
        const timeoutId = setTimeout(processBadgeData, 500);

        return () => {
            clearTimeout(timeoutId);
        };

    }, [settingsStore.settings.showCustomerBadges]); // Remove finalFilteredOrders dependency
    const columns = [
        {
            title: (
                <Checkbox
                    checked={selectedOrderIds.length === finalFilteredOrders.length && finalFilteredOrders.length > 0}
                    indeterminate={selectedOrderIds.length > 0 && selectedOrderIds.length < finalFilteredOrders.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                />
            ),
            render: (order: Order) => (
                <Checkbox
                    checked={selectedOrderIds.includes(order._id)}
                    onChange={(e) => {
                        e.stopPropagation();
                        const isChecked = e.target.checked;
                        if (isChecked) {
                            setSelectedOrderIds(prev => [...prev, order._id]);
                        } else {
                            setSelectedOrderIds(prev => prev.filter(id => id !== order._id));
                        }
                    }}
                />
            ),
            width: '20px',
            align: 'start' as const,
            overflow: 'hidden'
        },
        {
            title: 'Order',
            render: (order: Order) => {
                const isNewOrder = orderSeenCache[order._id] === false;

                return (
                    <Box direction="vertical" verticalAlign="middle" gap="2px">
                        <Text size="small" weight="normal">
                            #{order.number}
                        </Text>
                        {isNewOrder && (
                            <Badge
                                skin="standard"
                                size="tiny"
                                uppercase={true}
                            >
                                NEW
                            </Badge>
                        )}
                    </Box>
                );
            },
            width: '50px',
            align: 'start' as const,
            overflow: 'hidden'
        },
        {
            title: 'Date Created',
            render: (order: Order) => (
                <Text size="small">
                    {formatDate(order._createdDate, settingsStore.showTimeInDates)}
                </Text>
            ),
            width: '90px',
            align: 'start' as const,
            overflow: 'hidden'
        },
        {
            title: 'Customer',
            render: (order: Order) => {
                const recipientContact = order.rawOrder?.recipientInfo?.contactDetails;
                const billingContact = order.rawOrder?.billingInfo?.contactDetails;

                const firstName = recipientContact?.firstName || billingContact?.firstName || order.customer.firstName || 'Unknown';
                const lastName = recipientContact?.lastName || billingContact?.lastName || order.customer.lastName || 'Customer';
                const customerName = `${firstName} ${lastName}`;
                const company = recipientContact?.company || billingContact?.company || order.customer.company;

                // TEMPORARILY DISABLED: Just show customer info without badges
                // const customerOrderCount = customerEmail ? orderStore.getCachedCustomerOrderCount(customerEmail) : 0;

                return (
                    <Box direction="vertical" gap="4px">
                        <Box direction="vertical" gap="2px">
                            <Box direction="horizontal" gap="6px" align="left">
                                <Text size="small" ellipsis>{customerName}</Text>
                                {(order.buyerNote || order.rawOrder?.buyerNote) && (
                                    <Tooltip
                                        content={order.buyerNote || order.rawOrder?.buyerNote}
                                        placement="top"
                                        maxWidth="300px"
                                    >
                                        <Icons.Chat
                                            size="16px"
                                            style={{
                                                color: '#3b82f6',
                                                cursor: 'pointer',
                                                flexShrink: 0
                                            }}
                                        />
                                    </Tooltip>
                                )}
                            </Box>
                            {company && (
                                <Text size="tiny" secondary ellipsis>{company}</Text>
                            )}
                        </Box>

                        {/* RE-ENABLED: Customer badges */}
                        {settingsStore.settings.showCustomerBadges && (() => {
                            const customerEmail = recipientContact?.email || billingContact?.email || order.customer.email;
                            const customerOrderCount = customerEmail ? orderStore.getCachedCustomerOrderCount(customerEmail) : 0;

                            return customerOrderCount >= 1 ? (
                                <CustomerBadge orderCount={customerOrderCount} />
                            ) : null;
                        })()}
                    </Box>
                );
            },
            width: '140px',
            align: 'start' as const,
            overflow: 'hidden'
        },
        {
            title: 'Payment',
            render: (order: Order) => (
                <StatusBadge status={order.paymentStatus} type="payment" />
            ),
            width: '80px',
            align: 'start' as const,
            overflow: 'hidden'
        },
        {
            title: 'Fulfillment',
            render: (order: Order) => (
                <StatusBadge status={order.status} type="order" />
            ),
            width: '100px',
            align: 'start' as const,
            overflow: 'hidden'
        },
        {
            title: 'Total',
            render: (order: Order) => (
                <Text size="small">{order.total}</Text>
            ),
            width: '70px',
            align: 'start' as const,
            overflow: 'hidden'
        },
        {
            title: 'Actions',
            render: (order: Order) => {
                const cachedTracking = orderTrackingCache[order._id];
                const hasTracking = cachedTracking?.trackingNumber;

                const secondaryActions = [];

                secondaryActions.push({
                    key: `view-${order._id}`,
                    text: "View Order",
                    icon: <Icons.Order />,
                    onClick: () => handleViewOrder(order)
                });

                // Add Print Order action with loading state
                const isPrinting = printingOrders[order._id] || false;
                secondaryActions.push({
                    key: `print-${order._id}`,
                    text: isPrinting ? "Loading..." : "Print Order",
                    icon: <Icons.Print />,
                    disabled: isPrinting,
                    onClick: async () => {
                        setPrintingOrders(prev => ({ ...prev, [order._id]: true }));
                        try {
                            await handlePrintOrder(order);
                        } finally {
                            setPrintingOrders(prev => {
                                const newState = { ...prev };
                                delete newState[order._id];
                                return newState;
                            });
                        }
                    }
                });

                // Add divider
                secondaryActions.push({ key: `divider-${order._id}`, divider: true } as any);
                // Add Archive Order action
                secondaryActions.push({
                    key: `archive-${order._id}`,
                    text: "Archive Order",
                    icon: <Icons.Archive />,
                    onClick: () => handleArchiveOrder(order)
                });

                return (
                    <TableActionCell
                        size="small"
                        popoverMenuProps={{
                            zIndex: 1000,
                            appendTo: "window",
                            onShow: () => {
                                if (orderTrackingCache[order._id] === undefined) {
                                    getTrackingInfo(order._id);
                                }
                            }
                        }}
                        secondaryActions={secondaryActions}
                        numOfVisibleSecondaryActions={0}
                        alwaysShowSecondaryActions={false}
                    />
                );
            },
            width: 'auto',
            align: 'start' as const,
            stickyActionCell: true,
            overflow: 'hidden'
        }
    ];

    useEffect(() => {
        if (orderStore.selectedOrder) {
            setTimeout(() => {
                document.querySelectorAll('[data-selected-order]').forEach(row => {
                    row.removeAttribute('data-selected-order');
                });

                const rows = document.querySelectorAll('tbody tr');
                rows.forEach((row, index) => {
                    const orderData = finalFilteredOrders[index]; // UPDATED: Use finalFilteredOrders
                    if (orderData && orderData._id === orderStore.selectedOrder?._id) {
                        row.setAttribute('data-selected-order', orderData._id);
                    }
                });
            }, 100);
        }
    }, [orderStore.selectedOrder, finalFilteredOrders]); // UPDATED: Depend on finalFilteredOrders

    useEffect(() => {
        if (finalFilteredOrders.length > 0) { // UPDATED: Use finalFilteredOrders
            setTimeout(() => {
                const tableRows = document.querySelectorAll('.orders-table-container tbody tr');
                tableRows.forEach((row: any, index) => {
                    const orderData = finalFilteredOrders[index]; // UPDATED: Use finalFilteredOrders
                    if (orderData && settingsStore.productHighlightFilter) {
                        const shouldHighlight = orderContainsProduct(orderData, settingsStore.productHighlightFilter);
                        if (shouldHighlight) {
                            row.classList.add('highlighted-row');
                        } else {
                            row.classList.remove('highlighted-row');
                        }
                    } else {
                        row.classList.remove('highlighted-row');
                    }
                });
            }, 100);
        }
    }, [finalFilteredOrders, settingsStore.productHighlightFilter]); // UPDATED: Depend on finalFilteredOrders

    useEffect(() => {
        const checkVisibleOrders = async () => {
            const ordersToCheck = finalFilteredOrders.slice(0, 50); // Check first 50 visible orders

            for (const order of ordersToCheck) {
                if (orderSeenCache[order._id] === undefined) {
                    checkOrderSeenStatus(order._id);
                }
            }
        };

        if (finalFilteredOrders.length > 0) {
            checkVisibleOrders();
        }
    }, [finalFilteredOrders]);

    const searchStats = orderStore.searchStats;
    const hasActiveSearch = orderStore.hasActiveSearch;
    const isDisplayingSearchResults = orderStore.isDisplayingSearchResults;
    const [selectedSkus, setSelectedSkus] = useState<string[]>([]);

    // Helper to clear processed customers cache when needed
    const clearProcessedCustomers = useCallback(() => {
        processedCustomersRef.current.clear();
    }, []);

    // Expose clear function globally for settings button
    useEffect(() => {
        (window as any).clearProcessedCustomersRef = clearProcessedCustomers;
        return () => {
            delete (window as any).clearProcessedCustomersRef;
        };
    }, [clearProcessedCustomers]);

    // Clear processed customers when settings change or cache is cleared
    useEffect(() => {
        if (!settingsStore.settings.showCustomerBadges) {
            clearProcessedCustomers();
        }
    }, [settingsStore.settings.showCustomerBadges, clearProcessedCustomers]);

    // Clear processed customers when orders change significantly
    useEffect(() => {
        if (finalFilteredOrders.length > 0) {
            // Clear ref every time we have a fresh batch of orders
            processedCustomersRef.current.clear();
        }
    }, [finalFilteredOrders.length > 0]); // Only when we go from 0 to >0 orders

    // Auto-select oldest unfulfilled order from filtered results when filters change
    useEffect(() => {
        if (finalFilteredOrders.length === 0) return;

        const currentSelectedOrder = orderStore.selectedOrder;
        const selectedOrderInResults = currentSelectedOrder && finalFilteredOrders.find(order => order._id === currentSelectedOrder._id);

        // Only auto-select when the currently selected order is not in the filtered results
        // This handles the case where filters are applied and the selected order is no longer visible
        if (currentSelectedOrder && !selectedOrderInResults) {
            // Find the oldest unfulfilled order in the filtered results
            const unfulfilledOrders = finalFilteredOrders.filter(order =>
                order.status === 'NOT_FULFILLED' || order.status === 'PARTIALLY_FULFILLED'
            );

            if (unfulfilledOrders.length > 0) {
                // Sort by creation date (oldest first)
                const oldestUnfulfilled = unfulfilledOrders.sort((a, b) =>
                    new Date(a._createdDate).getTime() - new Date(b._createdDate).getTime()
                )[0];

                orderController.selectOrder(oldestUnfulfilled);

                // Update visual selection in the table
                setTimeout(() => {
                    document.querySelectorAll('[data-selected-order]').forEach(row => {
                        row.removeAttribute('data-selected-order');
                    });

                    const rows = document.querySelectorAll('tbody tr');
                    rows.forEach((row, index) => {
                        const orderData = finalFilteredOrders[index];
                        if (orderData && orderData._id === oldestUnfulfilled._id) {
                            row.setAttribute('data-selected-order', orderData._id);
                        }
                    });
                }, 100);
            }
        }
    }, [finalFilteredOrders]); // Only re-run when filtered orders change

    return (
        <Card className="relative">
            <ShimmerOverlay $visible={refreshing} />
            <TableToolbar>
                {selectedOrderIds.length > 0 ? (
                    // Selection mode toolbar
                    <>
                        <TableToolbar.ItemGroup position="start">
                            <TableToolbar.Item>
                                <TableToolbar.Title>
                                    <Text weight="bold">
                                        {selectedOrderIds.length} order{selectedOrderIds.length !== 1 ? 's' : ''} selected
                                    </Text>
                                </TableToolbar.Title>
                            </TableToolbar.Item>
                            <TableToolbar.Item>
                                <TextButton
                                    size="small"
                                    onClick={() => {
                                        if (selectedOrderIds.length === finalFilteredOrders.length && finalFilteredOrders.length > 0) {
                                            setSelectedOrderIds([]);
                                        } else {
                                            handleSelectAll(true);
                                        }
                                    }}
                                >
                                    {selectedOrderIds.length === finalFilteredOrders.length && finalFilteredOrders.length > 0 ? 'Deselect All' : 'Select All'}
                                </TextButton>
                            </TableToolbar.Item>
                            <TableToolbar.Item>
                                <Button
                                    prefixIcon={<Icons.Check />}
                                    size="small"
                                    priority="secondary"
                                    onClick={() => setIsBulkFulfillmentModalOpen(true)}
                                    disabled={selectedOrderIds.length === 0 || uiStore.submitting || isBulkProcessing}
                                >
                                    Mark as Fulfilled
                                </Button>
                            </TableToolbar.Item>
                        </TableToolbar.ItemGroup>
                        <TableToolbar.ItemGroup position="end">
                            <TableToolbar.Item>
                                <Button
                                    size="small"
                                    priority="secondary"
                                    onClick={() => setSelectedOrderIds([])}
                                >
                                    Clear Selection
                                </Button>
                            </TableToolbar.Item>
                        </TableToolbar.ItemGroup>
                    </>
                ) : (
                    // Normal mode toolbar
                    <>
                        <TableToolbar.ItemGroup position="start">
                            <TableToolbar.Item>
                                <TableToolbar.Title>
                                    <Text weight="normal">
                                        {isPrinting
                                            ? 'Getting ready to Print...'
                                            : searchValue || skuFilter.length > 0 || selectedFulfillmentStatusFilter || selectedPaymentStatusFilter || (dateFilter && dateFilter !== 'all')
                                                ? `Found Orders (${finalFilteredOrders.length})`
                                                : `Recent Orders (${orderStore.orders.length})`}
                                    </Text>
                                </TableToolbar.Title>
                            </TableToolbar.Item>
                            {orderStore.loadingStatus && (
                                <TableToolbar.Item>
                                    <TableToolbar.Label>
                                        <Text size="tiny" style={{ paddingTop: '20px' }}>{orderStore.loadingStatus}</Text>
                                    </TableToolbar.Label>
                                </TableToolbar.Item>
                            )}
                        </TableToolbar.ItemGroup>
                        <TableToolbar.ItemGroup position="end">
                            <TableToolbar.Item>
                                <Button size="small" gap="24px" priority="secondary" prefixIcon={<Icons.ContentFilterSmall />} onClick={() => setShowSidePanel(true)}>
                                    Filter
                                </Button>
                            </TableToolbar.Item>
                            <TableToolbar.Item>
                                <div style={{ width: '320px' }}>
                                    <Search
                                        value={searchValue}
                                        onChange={handleSearchChange}
                                        onClear={handleSearchClear}
                                        placeholder="Search Orders by number, name or email.."
                                        expandable={false}
                                        size="small"
                                    />
                                </div>
                            </TableToolbar.Item>
                        </TableToolbar.ItemGroup>
                    </>
                )}
            </TableToolbar>

            {/* Add the modal at the end */}
            <BulkFulfillmentModal
                isOpen={isBulkFulfillmentModalOpen}
                onClose={() => setIsBulkFulfillmentModalOpen(false)}
                orderIds={selectedOrderIds}
                orderCount={selectedOrderIds.length}
                onConfirm={handleBulkFulfillment}
                isProcessing={isBulkProcessing}
            />


            {/* Filter Tags Section - Only show when filters are active */}
            {(skuFilter.length > 0 || selectedFulfillmentStatusFilter || selectedPaymentStatusFilter || archiveStatusFilter || (dateFilter && dateFilter !== 'all') || productsApiFilter.length > 0) && (
                <Box
                    style={{
                        backgroundColor: '#ffffff',
                        borderTop: '1px solid #e5e7eb',
                        borderBottom: '1px solid #e5e7eb',
                        minHeight: '50px',
                        display: 'flex',
                        alignItems: 'center',
                        position: 'sticky',
                        top: '60px',
                        zIndex: 999
                    }}
                    padding="8px 24px"
                >
                    <Box direction="horizontal" align="space-between" verticalAlign="middle" width="100%">
                        <Box direction="horizontal" verticalAlign="middle" gap="12px" style={{ flex: 1 }}>
                            <TagList
                                tags={[
                                    // Date filter tag
                                    ...(dateFilter && dateFilter !== 'all' ? [{
                                        id: `date-${dateFilter}`,
                                        children: dateFilter === 'custom' ? 'Custom Range' : dateFilter,
                                        maxWidth: 150,
                                    }] : []),

                                    // SKU tags (show all, let TagList handle the "more" display)
                                    ...skuFilter.map(sku => ({
                                        id: `sku-${sku}`,
                                        children: sku,
                                        maxWidth: 150,
                                    })),

                                    // Products API tags (show all, let TagList handle the "more" display)
                                    ...productsApiFilter.map(productId => {
                                        const productInfo = selectedProductsWithNames.find(p => p.id === productId);
                                        return {
                                            id: `products-api-${productId}`,
                                            children: productInfo?.name || `Product ${productId}`,
                                            maxWidth: 150,
                                        };
                                    }),
                                    // Fulfillment status tag
                                    ...(selectedFulfillmentStatusFilter ? [{
                                        id: `fulfillment-${selectedFulfillmentStatusFilter}`,
                                        children: selectedFulfillmentStatusFilter.charAt(0).toUpperCase() + selectedFulfillmentStatusFilter.slice(1).replace(/_/g, ' '),
                                        maxWidth: 150,
                                    }] : []),

                                    // Payment status tag
                                    ...(selectedPaymentStatusFilter ? [{
                                        id: `payment-${selectedPaymentStatusFilter}`,
                                        children: selectedPaymentStatusFilter.charAt(0).toUpperCase() + selectedPaymentStatusFilter.slice(1).replace(/_/g, ' '),
                                        maxWidth: 150,
                                    }] : []),

                                    // Archive status tag
                                    ...(archiveStatusFilter ? [{
                                        id: `archive-${archiveStatusFilter}`,
                                        children: archiveStatusFilter.charAt(0).toUpperCase() + archiveStatusFilter.slice(1).replace(/_/g, ' '),
                                        maxWidth: 150,
                                    }] : []),
                                ]}
                                size="small"
                                maxVisibleTags={3}
                                initiallyExpanded={false}
                                toggleMoreButton={(amountOfHiddenTags, isExpanded) => ({
                                    label: isExpanded ? 'Show Less' : `+${amountOfHiddenTags} More`,
                                    tooltipContent: !isExpanded ? 'Show More Filters' : undefined,
                                    skin: 'standard',
                                    priority: 'secondary',
                                })}
                                onTagRemove={(tagId) => {
                                    // Handle tag removal based on tag ID
                                    if (tagId.startsWith('date-')) {
                                        setDateFilter(null);
                                        setCustomDateRange({ from: null, to: null });
                                    } else if (tagId.startsWith('sku-')) {
                                        if (tagId === 'sku-more') {
                                            setSkuFilter([]);
                                        } else {
                                            const skuToRemove = tagId.replace('sku-', '');
                                            setSkuFilter(skuFilter.filter(sku => sku !== skuToRemove));
                                        }
                                    } else if (tagId.startsWith('products-api-')) {
                                        if (tagId === 'products-api-more') {
                                            handleProductsApiFilterChange([]);
                                        } else {
                                            const productToRemove = tagId.replace('products-api-', '');
                                            handleProductsApiFilterChange(productsApiFilter.filter(id => id !== productToRemove));
                                        }
                                    } else if (tagId.startsWith('fulfillment-')) {
                                        handleFulfillmentStatusFilterChange(null);
                                    } else if (tagId.startsWith('payment-')) {
                                        handlePaymentStatusFilterChange(null);
                                    } else if (tagId.startsWith('archive-')) {
                                        handleArchiveStatusFilterChange(null);
                                    }
                                }}
                                dataHook="orders-table-filter-tags"
                            />
                        </Box>
                        <Button
                            size="tiny"
                            priority="secondary"
                            onClick={() => {
                                setSkuFilter([]);
                                handleFulfillmentStatusFilterChange(null);
                                handlePaymentStatusFilterChange(null);
                                handleArchiveStatusFilterChange(null);
                                handleProductsApiFilterChange([]);
                                setDateFilter(null);
                                setCustomDateRange({ from: null, to: null });
                            }}
                        >
                            Clear All
                        </Button>
                    </Box>
                </Box>
            )}

            <div style={{
                maxHeight: 'calc(100vh - 276px)', borderBottomLeftRadius: '8px',
                borderBottomRightRadius: '8px', overflowY: 'scroll'
            }} ref={containerRef}>
                <Table
                    data={tableData}
                    columns={columns}
                    onRowClick={(rowData, event) => handleRowClick(rowData as Order, event)}
                    hasMore={orderStore.searchHasMore || orderStore.hasMoreOrders}
                    itemsPerPage={batchSize}
                    scrollElement={containerRef.current || undefined}
                    loader={
                        <Box align="center" padding="24px 0px">
                            <Loader size="small" />
                        </Box>
                    }
                    infiniteScroll
                    loadMore={loadMoreOrders}
                >
                    <div className="orders-table-titlebar">
                        <Table.Titlebar />
                    </div>
                    <div
                        ref={containerRef}
                        className="orders-table-container"
                        style={{
                            height: 'auto',
                            minHeight: finalFilteredOrders.length === 0 ? 'calc(100vh - 320px)' : 'auto',
                            maxHeight: 'calc(100vh - 280px)', // Adjust this value based on your layout
                            overflowY: 'auto',
                            overflowX: 'hidden'
                        }}
                    >
                        {finalFilteredOrders.length === 0 ? (
                            <Box align="center" paddingTop="40px" paddingBottom="40px" direction="vertical" gap="12px">
                                <img src={NoOrdersSvg} alt="No orders" style={{ width: '152px', height: '152px' }} />
                                <Text secondary>
                                    {skuFilter.length > 0 || fulfillmentStatusFilter || paymentStatusFilter || (dateFilter && dateFilter !== 'all')
                                        ? `No orders found with current filters${skuFilter.length > 0 ? ` (${skuFilter.length} SKU${skuFilter.length !== 1 ? 's' : ''})` : ''}${fulfillmentStatusFilter ? ` (Fulfillment: ${fulfillmentStatusFilter})` : ''}${paymentStatusFilter ? ` (Payment: ${paymentStatusFilter})` : ''}${archiveStatusFilter ? ` (Archive: ${archiveStatusFilter})` : ''}${dateFilter && dateFilter !== 'all' ? ` (Date: ${dateFilter === 'custom' ? 'Custom Range' : dateFilter})` : ''}` : hasActiveSearch
                                            ? `No orders found matching "${orderStore.searchQuery}"`
                                            : 'No orders found'
                                    }
                                </Text>
                                {/* NEW: Show appropriate clear buttons */}
                                <Box direction="horizontal" gap="8px">
                                    {dateFilter && dateFilter !== 'all' && (
                                        <Button
                                            priority="secondary"
                                            size="small"
                                            onClick={() => {
                                                setDateFilter(null);
                                                setCustomDateRange({ from: null, to: null });
                                            }}
                                        >
                                            Clear date filter
                                        </Button>
                                    )}
                                    {skuFilter.length > 0 && (
                                        <Button
                                            priority="secondary"
                                            size="small"
                                            onClick={() => setSkuFilter([])}
                                        >
                                            Clear SKU filter
                                        </Button>
                                    )}
                                    {productsApiFilter.length > 0 && (
                                        <Button
                                            priority="secondary"
                                            size="small"
                                            onClick={() => handleProductsApiFilterChange([])}
                                        >
                                            Clear Products API filter
                                        </Button>
                                    )}
                                    {fulfillmentStatusFilter && (
                                        <Button
                                            priority="secondary"
                                            size="small"
                                            onClick={() => setFulfillmentStatusFilter(null)}
                                        >
                                            Clear fulfillment filter
                                        </Button>
                                    )}
                                    {paymentStatusFilter && (
                                        <Button
                                            priority="secondary"
                                            size="small"
                                            onClick={() => setPaymentStatusFilter(null)}
                                        >
                                            Clear payment filter
                                        </Button>
                                    )}
                                    {archiveStatusFilter && (
                                        <Button
                                            priority="secondary"
                                            size="small"
                                            onClick={() => handleArchiveStatusFilterChange(null)}
                                        >
                                            Clear archive filter
                                        </Button>
                                    )}
                                    {hasActiveSearch && (
                                        <Button
                                            priority="secondary"
                                            size="small"
                                            onClick={handleSearchClear}
                                        >
                                            Clear search
                                        </Button>
                                    )}
                                </Box>
                                {/* Add New Order button - only show when there are truly no orders, not just filtered */}
                                {orderStore.orders.length === 0 && !hasActiveSearch &&
                                    !dateFilter && skuFilter.length === 0 && !fulfillmentStatusFilter &&
                                    !paymentStatusFilter && !archiveStatusFilter && productsApiFilter.length === 0 && (
                                        <Box>
                                            <TextButton
                                                size="small"
                                                prefixIcon={<Icons.Add />}
                                                onClick={handleAddNewOrder}
                                            >
                                                Add New Order
                                            </TextButton>
                                        </Box>
                                    )}
                            </Box>
                        ) : (
                            <Table.Content titleBarVisible={false} />
                        )}
                    </div>
                </Table>
            </div>


            {/* Add some CSS styles for better visual feedback */}
            <style>{`
                ${customStyles}
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>

            {showSidePanel && (
                <SidePanel
                    onClose={() => setShowSidePanel(false)}
                    orders={orderStore.orders}
                    selectedSkus={skuFilter}
                    onSkusChange={(skus) => {
                        setSkuFilter(skus);

                        if (skus.length > 0) {
                            // Debug log removed
                            console.log(`Showing ${getFilteredOrders().length} orders out of ${statusFilteredOrders.length} total`);
                        } else {
                            // Debug log removed
                        }
                    }}
                    selectedFulfillmentStatus={selectedFulfillmentStatusFilter}
                    onFulfillmentStatusChange={handleFulfillmentStatusFilterChange}
                    selectedPaymentStatus={selectedPaymentStatusFilter}
                    onPaymentStatusChange={handlePaymentStatusFilterChange}
                    selectedArchiveStatus={archiveStatusFilter}
                    onArchiveStatusChange={handleArchiveStatusFilterChange}
                    selectedDate={dateFilter}
                    onDateChange={(date) => {
                        setDateFilter(date);
                        if (date !== 'custom') {
                            setCustomDateRange({ from: null, to: null });
                        }
                        // Debug log removed
                    }}
                    customDateRange={customDateRange}
                    onCustomDateRangeChange={(range) => {
                        setCustomDateRange(range);
                        // Debug log removed
                    }}
                    isFulfillmentStatusLoading={isFulfillmentStatusLoading}
                    isPaymentStatusLoading={isPaymentStatusLoading}
                    selectedProductsApiFilter={productsApiFilter}
                    onProductsApiFilterChange={(productIds, selectedProducts) => handleProductsApiFilterChange(productIds, selectedProducts)}
                />
            )}
        </Card>
    );
});

export { OrdersTable };