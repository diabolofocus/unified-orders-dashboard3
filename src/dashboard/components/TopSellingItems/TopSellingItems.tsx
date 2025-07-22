import React, { useEffect, useState } from 'react';
import { Text, Box, Table, TableColumn, Divider, Tooltip, IconButton } from '@wix/design-system';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../hooks/useStores';
import { Order, OrderLineItem, OrderItem } from '../../types/Order';
import { processWixImageUrl } from '../../utils/image-processor';
import { dashboard } from '@wix/dashboard';
import { Hint } from '@wix/wix-ui-icons-common';


type TopSellingItem = {
    id: string;
    name: string;
    itemsSold: number;
    revenue: number;
    image?: string;
    ordersCount: number;
    sku?: string;
    productId?: string;
};

const parsePrice = (priceString: string): number => {
    if (!priceString || typeof priceString !== 'string') return 0;
    const cleanPrice = priceString.replace(/[^\d,.-]/g, '');

    // Handle different decimal separators
    if (cleanPrice.includes(',') && cleanPrice.includes('.')) {
        const lastComma = cleanPrice.lastIndexOf(',');
        const lastDot = cleanPrice.lastIndexOf('.');

        if (lastComma > lastDot) {
            // Comma is decimal separator
            return parseFloat(cleanPrice.replace(/\./g, '').replace(',', '.'));
        } else {
            // Dot is decimal separator
            return parseFloat(cleanPrice.replace(/,/g, ''));
        }
    } else if (cleanPrice.includes(',')) {
        // Handle European format (1.234,56)
        return parseFloat(cleanPrice.replace(/\./g, '').replace(',', '.'));
    }

    return parseFloat(cleanPrice) || 0;
};

// Helper function to get product name from an order item
const getItemName = (item: OrderLineItem | OrderItem): string => {
    if ('name' in item && item.name) return item.name;
    if (typeof item.productName === 'string') return item.productName;
    if (item.productName?.original) return item.productName.original;
    return 'Unnamed Product';
};

// Helper function to get product ID from an order item
const getItemId = (item: OrderLineItem | OrderItem): string => {
    if ('id' in item) return item.id || '';
    if ('_id' in item) return item._id || '';
    return '';
};

// Helper function to get product image - EXACT same as ProductImages
const getItemImage = (item: OrderLineItem | OrderItem): string | undefined => {
    // Use exactly the same logic as ProductImages: just return item.image
    return (item as any).image;
};

// Helper function to get product price from an order item
const getItemPrice = (item: OrderLineItem | OrderItem): number => {
    // Try to get formatted amount first (like in ProductImages)
    if ('price' in item && item.price && typeof item.price === 'object') {
        const priceObj = item.price as any;
        if (priceObj.formattedAmount) {
            // Parse the formatted amount (e.g., "$37.00" -> 37.00)
            const numericValue = parseFloat(priceObj.formattedAmount.replace(/[^0-9.-]+/g, ''));
            if (!isNaN(numericValue)) {
                return numericValue;
            }
        }
    }

    // Fallback to other price fields
    let price = 0;

    if ('price' in item && item.price) {
        if (typeof item.price === 'string') {
            price = parseFloat(item.price.replace(/[^0-9.-]+/g, '')) || 0;
        } else if (typeof item.price === 'number') {
            price = item.price;
        }
    }

    // Handle price in priceData
    if (price === 0 && 'priceData' in item && item.priceData) {
        if (typeof item.priceData === 'object' && 'price' in item.priceData) {
            price = typeof item.priceData.price === 'number'
                ? item.priceData.price
                : parseFloat(String(item.priceData.price).replace(/[^0-9.-]+/g, '')) || 0;
        }
    }

    // ALWAYS divide by 100 since Wix stores prices in cents
    return price / 100;
};

// Helper function to get product quantity from an order item
const getItemQuantity = (item: OrderLineItem | OrderItem): number => {
    return item.quantity || 1;
};

const TopSellingItems: React.FC = observer(() => {
    const { settingsStore, orderStore } = useStores();

    const handleProductImageClick = (item: TopSellingItem) => {
        try {
            const productId = item.productId || item.id;

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
    const [topSellingItems, setTopSellingItems] = useState<TopSellingItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showScrollIndicator, setShowScrollIndicator] = useState(false);
    const { showTopSellingItems } = settingsStore.settings;

    useEffect(() => {
        if (!showTopSellingItems) return;

        const calculateTopSellingItems = async () => {
            if (orderStore.connectionStatus !== 'connected') {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                // Get date range based on selected analytics period
                const getDateRange = () => {
                    const now = new Date();
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                    switch (orderStore.selectedAnalyticsPeriod) {
                        case 'today':
                            return today;
                        case 'yesterday':
                            const yesterday = new Date(today);
                            yesterday.setDate(yesterday.getDate() - 1);
                            return yesterday;
                        case '7days':
                            const sevenDaysAgo = new Date(today);
                            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                            return sevenDaysAgo;
                        case '30days':
                            const thirtyDaysAgo = new Date(today);
                            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                            return thirtyDaysAgo;
                        case 'thisweek':
                            const startOfWeek = new Date(today);
                            const dayOfWeek = startOfWeek.getDay();
                            const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                            startOfWeek.setDate(startOfWeek.getDate() - daysFromMonday);
                            return startOfWeek;
                        case 'thismonth':
                            return new Date(now.getFullYear(), now.getMonth(), 1);
                        default:
                            const defaultThirtyDaysAgo = new Date(today);
                            defaultThirtyDaysAgo.setDate(defaultThirtyDaysAgo.getDate() - 30);
                            return defaultThirtyDaysAgo;
                    }
                };

                const startDate = getDateRange();

                // Use Wix Orders API to get ALL orders for selected period
                const { orders } = await import('@wix/ecom');
                let allOrders: any[] = [];
                let hasMore = true;
                let cursor: string | null | undefined;

                // Fetch all orders in batches
                while (hasMore) {
                    const searchParams: any = {
                        filter: {
                            "_createdDate": { "$gte": startDate },
                            "status": { "$eq": "APPROVED" },
                            "paymentStatus": { "$in": ["PAID", "PARTIALLY_PAID"] }
                        },
                        sort: [{ "fieldName": "_createdDate", "order": "DESC" }],
                        cursorPaging: { "limit": 100 }
                    };

                    if (cursor) {
                        searchParams.cursorPaging.cursor = cursor;
                    }

                    const result = await orders.searchOrders(searchParams);

                    if (result.orders && result.orders.length > 0) {
                        allOrders = allOrders.concat(result.orders);
                        hasMore = result.metadata?.hasNext || false;
                        cursor = result.metadata?.cursors?.next;

                        if (allOrders.length >= 1000) {
                            hasMore = false;
                        }
                    } else {
                        hasMore = false;
                    }
                }

                console.log(`Processing ${allOrders.length} approved paid orders from ${orderStore.selectedAnalyticsPeriod}`);

                // Enhanced object to track quantities, orders, and revenue by product name
                const productData: {
                    [productName: string]: {
                        totalQuantity: number;
                        totalRevenue: number;
                        orderIds: Set<string>;
                        productId: string;
                        image?: string;
                        sku?: string;
                    }
                } = {};

                // Process each order
                allOrders.forEach(order => {
                    const lineItems = order.lineItems || [];

                    lineItems.forEach((item: any) => {
                        const productName = item.productName?.original || item.productName || 'Unknown Product';
                        const quantity = item.quantity || 0;
                        const productId = item._id || item.catalogReference?.catalogItemId || '';
                        const image = item.image;
                        const sku = item.physicalProperties?.sku || item.catalogReference?.catalogItemId || '';

                        // Get price from API structure
                        let itemPrice = 0;
                        if (item.price?.amount) {
                            itemPrice = parseFloat(item.price.amount);
                        }

                        // Calculate line item revenue (quantity × unit price)
                        const lineRevenue = quantity * itemPrice;

                        if (quantity > 0 && productName !== 'Unknown Product' && itemPrice > 0) {
                            if (productData[productName]) {
                                productData[productName].totalQuantity += quantity;
                                productData[productName].totalRevenue += lineRevenue;
                                productData[productName].orderIds.add(order._id); // Track unique orders
                            } else {
                                productData[productName] = {
                                    totalQuantity: quantity,
                                    totalRevenue: lineRevenue,
                                    orderIds: new Set([order._id]), // Initialize with current order
                                    productId: productId,
                                    image: image,
                                    sku: sku
                                };
                            }
                        }
                    });
                });

                // Convert to array and sort by quantity (highest first)
                const sortedByQuantity = Object.entries(productData)
                    .map(([name, data], index) => ({
                        id: `${data.productId || 'item'}-${data.sku || index}`,
                        name: name,
                        itemsSold: data.totalQuantity,
                        revenue: data.totalRevenue,
                        ordersCount: data.orderIds.size, // Count of unique orders
                        image: data.image,
                        sku: data.sku,
                        productId: data.productId
                    }))
                    .sort((a, b) => b.itemsSold - a.itemsSold)
                    .slice(0, 10);

                console.log('Top 10 by quantity:', sortedByQuantity.map(item => ({
                    name: item.name,
                    quantity: item.itemsSold,
                    orders: item.ordersCount,
                    revenue: `€${item.revenue.toFixed(2)}`
                })));

                setTopSellingItems(sortedByQuantity);
            } catch (error) {
                console.error('Error calculating top selling items:', error);
                setTopSellingItems([]);
            } finally {
                setIsLoading(false);
            }
        };

        calculateTopSellingItems();
    }, [
        showTopSellingItems,
        orderStore.orders,
        orderStore.connectionStatus,
        orderStore.selectedAnalyticsPeriod,
    ]);

    if (!showTopSellingItems) {
        return null;
    }

    // Format currency consistently with OrderAnalytics
    const formatCurrency = (amount: number): string => {
        const currencySymbol = orderStore.formattedAnalytics?.currency || '€';
        return `${currencySymbol}${amount.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    };

    if (isLoading) {
        return (
            <Box direction="vertical" gap="8px">
                <Text size="small" weight="normal" tagName="h3">
                    Most Sold Items
                </Text>
                <Box
                    marginTop="-8px"
                    border="1px solid #E6E9EF"
                    borderRadius="8px"
                    width="350px"
                    height="145px"
                    display="flex"
                    align="center"
                    verticalAlign="middle"
                >
                    <Text size="small" color="#999">Loading...</Text>
                </Box>
            </Box>
        );
    }

    if (topSellingItems.length === 0) {
        return (
            <Box align="left" verticalAlign="middle" direction="vertical" >
                <Text size="small" weight="normal" tagName="h3">
                    Most Sold Items ({orderStore.selectedAnalyticsPeriod === '30days' ? 'Last 30 days' :
                        orderStore.selectedAnalyticsPeriod === '7days' ? 'Last 7 days' :
                            orderStore.selectedAnalyticsPeriod === 'today' ? 'Today' :
                                orderStore.selectedAnalyticsPeriod === 'yesterday' ? 'Yesterday' :
                                    orderStore.selectedAnalyticsPeriod === 'thisweek' ? 'This week' :
                                        orderStore.selectedAnalyticsPeriod === 'thismonth' ? 'This month' : 'Selected period'})
                </Text>
                <Text size="tiny">No items found for the selected period.</Text>
            </Box>
        );
    }
    const ItemImage: React.FC<{ item: TopSellingItem; onClick: (item: TopSellingItem) => void }> = ({ item, onClick }) => {
        const [imageError, setImageError] = React.useState(false);
        const [currentImageIndex, setCurrentImageIndex] = React.useState(0);

        // Create multiple fallback URLs
        const getImageUrls = (imageString: string): string[] => {
            if (!imageString) return [];

            if (imageString.startsWith('wix:image://v1/')) {
                const imageId = imageString.replace('wix:image://v1/', '').split('#')[0];
                return [
                    `https://static.wixstatic.com/media/${imageId}?w=100&h=100&fit=fill&f=jpg`,
                    `https://static.wixstatic.com/media/${imageId}`,
                    `https://static.wixstatic.com/media/${imageId.split('~')[0]}`
                ];
            }

            return [processWixImageUrl(imageString)];
        };

        const imageUrls = item.image ? getImageUrls(item.image) : [];
        const currentImageUrl = imageUrls[currentImageIndex];

        const handleImageError = () => {
            // Try next URL if available
            if (currentImageIndex < imageUrls.length - 1) {
                setCurrentImageIndex(prev => prev + 1);
            } else {
                setImageError(true);
            }
        };

        if (!currentImageUrl || imageError) {
            return (
                <div
                    style={{
                        width: '40px',
                        height: '30px',
                        backgroundColor: '#F5F5F5',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease'
                    }}
                    onClick={() => onClick(item)}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                    }}
                    title="Edit product"
                >
                    <span style={{ color: '#999', fontSize: '12px' }}>📦</span>
                </div>
            );
        }

        return (
            <div
                style={{
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease'
                }}
                onClick={() => onClick(item)}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                }}
                title="Edit product"
            >
                <img
                    src={currentImageUrl}
                    alt={item.name}
                    style={{
                        width: '40px',
                        height: '30px',
                        objectFit: 'cover',
                        borderRadius: '4px',
                        flexShrink: 0
                    }}
                    onError={handleImageError}
                    loading="lazy"
                />
            </div>
        );
    };

    return (

        <Box direction="vertical">
            <Box width="100%" paddingBottom="0px">
                <Box direction="horizontal" align="center" gap="6px" style={{ alignItems: 'baseline' }}>
                    <Text size="small" weight="normal" tagName="h3" style={{ lineHeight: '24px' }}>
                        Most Sold Items
                    </Text>
                    <Tooltip content="Add a 'Best Seller' ribbon to the most sold products">
                        <Box style={{ display: 'flex', alignItems: 'center', height: '24px' }}>
                            <Hint style={{ color: '#000' }} size="16px" />
                        </Box>
                    </Tooltip>
                </Box>
            </Box>
            <Box
                border="1px solid #e0e0e0"
                borderRadius="8px"
                height="auto"
                maxHeight="145px"
                width="350px"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                {topSellingItems.length > 0 ? (
                    <div
                        style={{
                            overflowY: 'auto',
                            flex: 1,
                            /* Hide scrollbar */
                            scrollbarWidth: 'none', /* Firefox */
                            msOverflowStyle: 'none', /* IE and Edge */
                        }}
                        className="scroll-container"
                        onScroll={(e) => {
                            const element = e.currentTarget;
                            const isScrollable = element.scrollHeight > element.clientHeight;
                            const isAtBottom = Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop) < 1;
                            setShowScrollIndicator(isScrollable && !isAtBottom);
                        }}
                        ref={(ref) => {
                            if (ref) {
                                // Check if scrollable on mount/update and if we're not at bottom
                                const isScrollable = ref.scrollHeight > ref.clientHeight;
                                const isAtBottom = Math.abs(ref.scrollHeight - ref.clientHeight - ref.scrollTop) < 1;
                                setShowScrollIndicator(isScrollable && !isAtBottom);
                            }
                        }}
                    >

                        {/* Items */}
                        {topSellingItems.map((item, index) => (
                            <Box
                                key={item.id}
                                direction="horizontal"
                                align="center"
                                paddingTop="6px"
                                paddingBottom="6px"
                                paddingLeft="12px"
                                paddingRight="12px"
                                style={{
                                    borderBottom: index < topSellingItems.length - 1 ? '1px solid #f0f0f0' : 'none',
                                    minHeight: '50px'
                                }}
                            >
                                {/* Product column with image, name, and SKU */}
                                <Box direction="horizontal" align="center" gap="8px" style={{ flex: 1, minWidth: 0 }}>
                                    <ItemImage item={item} onClick={handleProductImageClick} />
                                    <Box direction="vertical" gap="2px" style={{ flex: 1, minWidth: 0 }}>
                                        <Text ellipsis title={item.name} size="small" style={{ lineHeight: 1.2 }}>
                                            {item.name}
                                        </Text>
                                        {settingsStore.showSKU && item.sku && (
                                            <Text ellipsis title={item.sku} size="tiny" secondary style={{ lineHeight: 1.1 }}>
                                                {item.sku}
                                            </Text>
                                        )}
                                        <Text size="tiny" secondary>
                                            {item.ordersCount.toLocaleString()} order{item.ordersCount !== 1 ? 's' : ''} • {formatCurrency(item.revenue)}
                                        </Text>
                                    </Box>
                                </Box>

                                {/* Quantity sold */}
                                <Text size="small" style={{ width: '80px', textAlign: 'center' }}>
                                    {item.itemsSold.toLocaleString()}
                                </Text>
                            </Box>
                        ))}
                    </div>
                ) : (
                    <Box padding="18px" align="center" minHeight="200px" verticalAlign="middle">
                        <Text secondary>No sales data available for the selected period</Text>
                    </Box>
                )}

                {/* Scroll indicator */}
                {showScrollIndicator && (
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: '20px',
                            background: 'linear-gradient(to top, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 50%, rgba(255,255,255,0) 100%)',
                            pointerEvents: 'none',
                            borderRadius: '0 0 8px 8px'
                        }}
                    />
                )}
            </Box>

            {/* CSS to hide scrollbars */}
            <style>{`
                .scroll-container::-webkit-scrollbar {
                    display: none; /* Chrome, Safari, Opera */
                }
            `}</style>
        </Box>
    );
});

export default TopSellingItems;
