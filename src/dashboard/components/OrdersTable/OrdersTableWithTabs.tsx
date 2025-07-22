// components/OrdersTable/OrdersTableWithTabs.tsx
import React, { useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Tabs, Text, Table, TableToolbar, Heading, Tag, Button, Tooltip } from '@wix/design-system';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { settingsStore } from '../../stores/SettingsStore';
import * as Icons from '@wix/wix-ui-icons-common';
import { useStores } from '../../hooks/useStores';
import { OrdersTable } from './OrdersTable';
import { processWixImageUrl } from '../../utils/image-processor';
import { canItemBeFulfilled, getItemName, getItemQuantity, getRemainingQuantity as getRemainingQty, hasItemTracking as hasItemTrackingUtil } from '../../types/Order';

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

// Define the structure for a preparation item
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

    // Function to check if an item has any tracking info
    const hasItemTracking = (item: any): boolean => {
        // First check if the utility function exists
        if (typeof hasItemTrackingUtil === 'function') {
            return hasItemTrackingUtil(item);
        }

        if (item.fulfillmentDetails?.trackingInfo?.length > 0) {
            return true;
        }

        // Check lineItemFulfillment array
        if (item.fulfillmentDetails?.lineItemFulfillment?.some(
            (fulfillment: any) => fulfillment.trackingNumber?.trim()
        )) {
            return true;
        }

        return false;
    };

    // Function to get remaining quantity for an item
    const getRemainingQuantity = (item: any): number => {
        // First check if the utility function exists
        if (typeof getRemainingQty === 'function') {
            return getRemainingQty(item);
        }

        // Fallback implementation if utility function is not available
        const quantity = item.quantity || 0;
        const fulfilled = item.fulfilledQuantity || 0;
        return Math.max(0, quantity - fulfilled);
    };

    // Function to extract preparation items from unfulfilled orders
    const getPreparationItems = (): PreparationItem[] => {
        if (!isMounted.current) return [];

        try {

            // Log all order statuses to debug
            const orderStatusBreakdown = orderStore.orders.reduce((acc, order) => {
                const status = order.status || 'UNKNOWN';
                acc[status] = (acc[status] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            // Filter only unfulfilled or partially fulfilled orders
            const unfulfilledOrders = orderStore.orders.filter(order => {
                return order.status === 'NOT_FULFILLED' || order.status === 'PARTIALLY_FULFILLED';
            });

            const productMap = new Map<string, PreparationItem>();

            unfulfilledOrders.forEach(order => {
                const items = order.rawOrder?.lineItems || [];
                const orderTimestamp = new Date(order._createdDate).getTime();

                items.forEach((item: any) => {
                    const productName = item.productName?.original || 'Unknown Product';
                    const totalQuantity = item.quantity || 1;
                    const remainingQty = getRemainingQuantity(item);
                    const hasTracking = hasItemTracking(item);

                    // Skip items with tracking or no remaining quantity
                    if (hasTracking || remainingQty <= 0) {
                        console.log(`⏭️ Skipping item: ${productName} - ` +
                            `Has tracking: ${hasTracking}, ` +
                            `Remaining: ${remainingQty}/${totalQuantity}`);
                        return;
                    }

                    const optionsKey = getProductOptionsKey(item);
                    const mapKey = `${item.catalogReference?.catalogItemId || 'unknown'}-${optionsKey}`;

                    // Get customer name
                    const recipientContact = order.rawOrder?.recipientInfo?.contactDetails;
                    const billingContact = order.rawOrder?.billingInfo?.contactDetails;
                    const customerName = `${recipientContact?.firstName || billingContact?.firstName || ''} ${recipientContact?.lastName || billingContact?.lastName || ''}`.trim() || 'Unknown Customer';

                    if (productMap.has(mapKey)) {
                        // Add to existing product
                        const existing = productMap.get(mapKey)!;
                        existing.totalQuantity += remainingQty;
                        existing.orders.push({
                            orderNumber: order.number,
                            orderId: order._id,
                            quantity: remainingQty,
                            customerName,
                            orderTimestamp
                        });
                        // Update most recent order date if this order is newer
                        if (orderTimestamp > existing.mostRecentOrderDate) {
                            existing.mostRecentOrderDate = orderTimestamp;
                        }
                    } else {
                        // Create new product entry
                        productMap.set(mapKey, {
                            id: mapKey,
                            productId: item.catalogReference?.catalogItemId,
                            productName,
                            productOptions: optionsKey,
                            imageUrl: extractImageUrl(item),
                            rawImageUrl: extractImageUrl(item, true),
                            totalQuantity: remainingQty,
                            orders: [{
                                orderNumber: order.number,
                                orderId: order._id,
                                quantity: remainingQty,
                                customerName,
                                orderTimestamp
                            }],
                            optionsDisplay: optionsKey ? JSON.parse(optionsKey) : {},
                            descriptionLines: item.descriptionLines || [],
                            mostRecentOrderDate: orderTimestamp
                        });
                    }
                });
            });

            // Convert map to array and sort by most recent order date
            const result = Array.from(productMap.values()).sort((a, b) =>
                b.mostRecentOrderDate - a.mostRecentOrderDate
            );
            return result;

        } catch (error) {
            console.error('❌ Error in getPreparationItems:', error);
            return [];
        }
    };

    // Use React.useMemo to make the calculation reactive and add debugging
    const preparationItems = React.useMemo(() => {
        const items = getPreparationItems();
        return items;
    }, [orderStore.orders.length, orderStore.orders]);

    // Add effect to monitor order changes
    useEffect(() => {
    }, [orderStore.orders.length, orderStore.orders]);

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
                        : '<div style="color: #666; font-size: 10px; margin-top: 4px; line-height: 1.3;">Standard item</div>';

                    const imageHTML = item.base64Image
                        ? `<img src="${item.base64Image}" style="width: 60px; height: 45px; object-fit: cover; border-radius: 4px; border: 1px solid #ddd; display: block;" alt="${item.productName}" />`
                        : '<div style="width: 60px; height: 45px; background-color: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #999;">No Image</div>';

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
                    : '<div style="color: #666; font-size: 9px; margin-top: 2px;">Standard item</div>';

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
                                <Tag id={`order-tag-${order.orderId}-${order.orderNumber}`} removable={false} size="tiny" theme="standard">
                                    #{order.orderNumber}
                                </Tag>
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
        <Box direction="vertical" gap="0" paddingBottom="10px" style={{ backgroundColor: '#ffffff', borderRadius: '8px' }}>
            {/* TableToolbar */}
            <TableToolbar>
                <TableToolbar.ItemGroup position="start">
                    <TableToolbar.Item>
                        <Box direction="horizontal" gap="8px" align="center" verticalAlign="middle">
                            <Box>
                                <Text weight="normal" size="medium">
                                    Products to Pack ({preparationItems.reduce((total, item) => total + item.totalQuantity, 0)})
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
                    {/* <TableToolbar.Item>
                        <Button
                            size="small"
                            priority="secondary"
                            prefixIcon={<Icons.Print />}
                            onClick={handlePrintPackingList}
                            disabled={preparationItems.length === 0}
                        >
                            Print
                        </Button>
                    </TableToolbar.Item> */}
                    <TableToolbar.Item>
                        <Button
                            size="small"
                            priority="secondary"
                            prefixIcon={<Icons.Download />}
                            onClick={handleDownloadPackingList}
                            disabled={preparationItems.length === 0}
                        >
                            Download PDF
                        </Button>
                    </TableToolbar.Item>
                </TableToolbar.ItemGroup>
            </TableToolbar>

            {/* Table Content */}
            <div style={{ width: '100%', overflowX: 'auto' }}>
                {preparationItems.length === 0 ? (
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
                        <Icons.Check size="48px" style={{ color: '#4caf50' }} />
                        <Text size="medium" weight="bold">All orders fulfilled!</Text>
                        <Text secondary size="small" align="center">
                            No products need preparation at this time
                        </Text>
                    </Box>
                ) : (
                    <Table
                        data={preparationItems}
                        columns={preparationColumns}
                        rowVerticalPadding="medium"
                        horizontalScroll
                    >
                        <Table.Titlebar />
                        <div
                            className="preparation-table-container"
                            style={{
                                maxHeight: 'calc(100vh - 328px)',
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