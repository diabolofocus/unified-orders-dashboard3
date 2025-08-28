import React, { useEffect, useState, useCallback } from 'react';
import { Text, Box, Tooltip } from '@wix/design-system';
import type { TableColumn } from '@wix/design-system';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../hooks/useStores';
import { processWixImageUrl } from '../../utils/image-processor';
import { inventoryItemsV3, catalogVersioning, inventory, products, productsV3 } from '@wix/stores';
import { dashboard } from '@wix/dashboard';
import { Hint } from '@wix/wix-ui-icons-common';

interface InventoryItem {
    id: string;
    name: string;
    sku?: string;
    quantity: number;
    image?: string;
    variantId?: string;
    variantName?: string;
    productId?: string;
}

type CatalogVersion = 'V1_CATALOG' | 'V3_CATALOG' | 'STORES_NOT_INSTALLED';

// Using TableColumn from @wix/design-system

const LowInventoryItems: React.FC = observer(() => {
    const { settingsStore } = useStores();
    const [lowInventoryItems, setLowInventoryItems] = useState<InventoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [loadingStage, setLoadingStage] = useState('');
    const [showScrollIndicator, setShowScrollIndicator] = useState(false);
    const showLowInventoryItems = settingsStore.settings.showLowInventoryItems;
    const LOW_STOCK_THRESHOLD = 10; // Items with quantity below this will be considered low stock

    // Memoized click handler to prevent unnecessary re-renders
    const handleProductImageClick = useCallback((item: InventoryItem) => {
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
    }, []);

    useEffect(() => {
        if (!showLowInventoryItems) return;

        const fetchLowInventoryItems = async () => {
            setIsLoading(true);
            setLoadingProgress(0);
            setLoadingStage('Initializing...');

            // Start smooth progress animation
            let currentProgress = 0;
            const progressInterval = setInterval(() => {
                currentProgress += Math.random() * 2 + 0.5; // Random increment between 0.5-2.5
                if (currentProgress < 95) { // Never reach 100% until actually done
                    setLoadingProgress(Math.min(currentProgress, 95));
                }
            }, 100); // Update every 100ms for smooth animation

            try {
                // First, determine the catalog version
                setLoadingStage('Checking catalog version...');
                const versionResponse = await catalogVersioning.getCatalogVersion();
                const catalogVersion = versionResponse.catalogVersion;

                let transformedItems: InventoryItem[] = [];

                if (catalogVersion === 'V3_CATALOG') {
                    // Use V3 API
                    setLoadingStage('Fetching inventory data...');
                    await fetchLowInventoryItemsV3(transformedItems);
                } else if (catalogVersion === 'V1_CATALOG') {
                    // Use V1 API
                    setLoadingStage('Fetching inventory data...');
                    await fetchLowInventoryItemsV1(transformedItems);
                } else {
                    console.warn('Stores not installed or unknown catalog version:', catalogVersion);
                    setLowInventoryItems([]);
                    clearInterval(progressInterval);
                    return;
                }

                // Complete the progress
                clearInterval(progressInterval);
                setLoadingStage('Finalizing...');
                setLoadingProgress(100);
                setLowInventoryItems(transformedItems);

                // Small delay to show 100% completion
                await new Promise(resolve => setTimeout(resolve, 300));

            } catch (error) {
                console.error('Error fetching low inventory items:', error);
                setLowInventoryItems([]);
                clearInterval(progressInterval);
            } finally {
                setIsLoading(false);
                setLoadingProgress(0);
                setLoadingStage('');
            }
        };

        const fetchLowInventoryItemsV3 = async (transformedItems: InventoryItem[]) => {
            const response = await inventoryItemsV3.searchInventoryItems({
                filter: {
                    quantity: { $lt: LOW_STOCK_THRESHOLD },
                    trackQuantity: { $eq: true }
                },
                sort: [
                    { fieldName: "quantity", order: "ASC" }
                ],
                cursorPaging: {
                    limit: 50
                }
            });

            if (!response.inventoryItems || response.inventoryItems.length === 0) {
                return;
            }

            setLoadingStage('Fetching product details...');

            // Get unique product IDs to fetch product details and check visibility
            const uniqueProductIds = [...new Set(response.inventoryItems.map(item => item.productId).filter(Boolean))];
            const productDetailsMap = new Map();

            // Fetch product details to check visibility
            if (uniqueProductIds.length > 0) {
                try {
                    const productsResponse = await productsV3.queryProducts()
                        .in('_id', uniqueProductIds)
                        .find();

                    productsResponse.items?.forEach(product => {
                        productDetailsMap.set(product._id, product);
                    });
                } catch (productError) {
                    console.warn('Could not fetch product details for visibility check:', productError);
                }
            }

            // Filter and transform items, only including visible products
            const items = response.inventoryItems
                .filter(item => {
                    const product = productDetailsMap.get(item.productId);
                    return product?.visible !== false; // Include if visible or visibility unknown
                })
                .map(item => {
                    const product = productDetailsMap.get(item.productId);
                    const imageUrl = product?.media?.[0]?.url || '';

                    return {
                        id: item._id || '',
                        name: item.product?.name || product?.name || 'Unknown Product',
                        sku: item.product?.variantSku || '',
                        quantity: item.quantity || 0,
                        image: imageUrl,
                        variantId: item.variantId || '',
                        variantName: item.product?.variantName || item.variantId || '',
                        productId: item.productId || ''
                    };
                });

            transformedItems.push(...items);
        };

        const fetchLowInventoryItemsV1 = async (transformedItems: InventoryItem[]) => {
            // Get all inventory items (no filter to avoid syntax issues)
            const inventoryResponse = await inventory.queryInventory({
                query: {
                    paging: { limit: 100, offset: 0 }
                    // Removed filter and sort to avoid V1 syntax issues
                }
            });

            setLoadingStage('Processing inventory data...');

            // Filter for low stock items and collect product IDs
            const lowStockItems: Array<{
                inventoryId: string;
                productId: string;
                variantId: string;
                quantity: number;
                sku?: string;
            }> = [];

            inventoryResponse.inventoryItems?.forEach(inventoryItem => {
                // Only process items that track quantity
                if (inventoryItem.trackQuantity) {
                    inventoryItem.variants?.forEach(variant => {
                        if (variant.quantity !== undefined && variant.quantity !== null && variant.quantity < LOW_STOCK_THRESHOLD) {
                            lowStockItems.push({
                                inventoryId: inventoryItem._id || '',
                                productId: inventoryItem.productId || '',
                                variantId: variant.variantId || '',
                                quantity: variant.quantity,
                                sku: '' // Will be filled from product data
                            });
                        }
                    });
                }
            });

            // Sort by quantity (lowest first)
            lowStockItems.sort((a, b) => a.quantity - b.quantity);

            if (lowStockItems.length === 0) {
                return;
            }

            // Limit to first 50 items to avoid too many API calls
            const limitedLowStockItems = lowStockItems.slice(0, 50);

            setLoadingStage('Fetching product details...');

            // Get unique product IDs and fetch product details
            const uniqueProductIds = [...new Set(limitedLowStockItems.map(item => item.productId))];
            const productDetailsMap = new Map();

            // Fetch product details in batches
            for (const productId of uniqueProductIds) {
                try {
                    const productResponse = await products.getProduct(productId);
                    productDetailsMap.set(productId, productResponse.product);
                } catch (productError) {
                    console.warn(`Could not fetch product ${productId}:`, productError);
                }
            }

            // Transform to our interface and filter out hidden products
            const items = limitedLowStockItems
                .filter(item => {
                    const product = productDetailsMap.get(item.productId);
                    return product?.visible !== false; // Filter out hidden products first
                })
                .map(item => {
                    const product = productDetailsMap.get(item.productId);

                    // Find the variant data for V1
                    const variant = product?.variants?.find((v: any) => v._id === item.variantId);

                    // Get image URL from media
                    const imageUrl = product?.media?.items?.[0]?.image?.url ||
                        product?.media?.mainMedia?.image?.url || '';

                    return {
                        id: item.inventoryId,
                        name: product?.name || 'Unknown Product',
                        sku: variant?.variant?.sku || product?.sku || '',
                        quantity: item.quantity,
                        image: imageUrl,
                        variantId: item.variantId,
                        variantName: variant?.variant?.formattedOptionValues || '',
                        productId: item.productId
                    };
                });

            transformedItems.push(...items);
        };

        fetchLowInventoryItems();

        // Set up polling every 5 minutes
        const intervalId = setInterval(fetchLowInventoryItems, 5 * 60 * 1000);

        return () => clearInterval(intervalId);
    }, [showLowInventoryItems]);

    const columns: TableColumn<InventoryItem>[] = [
        {
            title: 'Product',
            render: (item: InventoryItem) => (
                <Box direction="horizontal" align="center" gap="12px">
                    <Box width="40px" height="40px" borderRadius="4px" overflow="hidden">
                        {item.image ? (
                            <img
                                src={item.image ? processWixImageUrl(item.image) : ''}
                                alt={item.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                }}
                            />
                        ) : (
                            <Box
                                width="100%"
                                height="100%"
                                backgroundColor="#F5F5F5"
                                display="flex"
                                align="center"
                                verticalAlign="middle"
                            >
                                <Text size="tiny" color="#999">No Image</Text>
                            </Box>
                        )}
                    </Box>
                    <Box>
                        <Text size="small" weight="normal">{item.name}</Text>
                        {item.sku && (
                            <Text size="tiny" color="#666">SKU: {item.sku}</Text>
                        )}
                    </Box>
                </Box>
            ),
            width: '60%',
        },
        {
            title: 'In Stock',
            render: (item: InventoryItem) => (
                <Text
                    size="small"
                    weight="bold"
                    color={item.quantity <= 3 ? '#D82C0D' : '#4A4A4A'}
                >
                    {item.quantity}
                </Text>
            ),
            width: '20%',
        },
        {
            title: 'Status',
            render: (item: InventoryItem) => (
                <Box
                    padding="3px 8px"
                    borderRadius="4px"
                    backgroundColor={
                        item.quantity === 0 ? '#FFEDEC' :
                            item.quantity <= 3 ? '#FFF4E6' :
                                '#F0F5FF'
                    }
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '80px'
                    }}
                >
                    <Text
                        size="small"
                        weight="bold"
                        color={
                            item.quantity === 0 ? '#D82C0D' :
                                item.quantity <= 3 ? '#D97706' :
                                    '#2B6BEA'
                        }
                    >
                        {item.quantity}
                    </Text>
                </Box>
            ),
            width: '20%',
        },
    ];

    if (isLoading) {
        return (
            <Box direction="vertical" gap="8px">
                <Text size="small" weight="normal" tagName="h3">
                    Low Inventory Items
                </Text>
                <Box
                    marginTop="-8px"
                    border="1px solid #e0e0e0"
                    borderRadius="8px"
                    width="350px"
                    height="145px"
                    maxHeight="145px"
                    display="flex"
                    direction="vertical"
                    align="center"
                    verticalAlign="middle"
                    gap="12px"
                    padding="20px"
                    boxSizing="border-box"
                >
                    <Text size="small" color="#999">{loadingStage || 'Loading...'}</Text>

                    {/* Progress Bar */}
                    <Box width="200px" direction="vertical" gap="4px" align="center">
                        <Box
                            width="200px"
                            height="2px"
                            backgroundColor="#f0f0f0"
                            borderRadius="2px"
                            style={{ overflow: 'hidden' }}
                        >
                            <div
                                style={{
                                    width: `${loadingProgress}%`,
                                    backgroundColor: '#000000',
                                    borderRadius: '2px',
                                    transition: 'width 0.1s ease'
                                }}
                            />
                        </Box>
                        <Text size="tiny" color="#666" align="center">
                            {Math.round(loadingProgress)}%
                        </Text>
                    </Box>
                </Box>
            </Box>
        );
    }

    if (!showLowInventoryItems) {
        return null;
    }

    if (lowInventoryItems.length === 0) {
        return (
            <Box direction="vertical" gap="8px">
                <Text size="small" weight="normal" tagName="h3">
                    Low Inventory Items
                </Text>
                <Box
                    border="1px solid #e0e0e0"
                    borderRadius="8px"
                    width="350px"
                    maxHeight="145px"
                    display="flex"
                    align="center"
                    verticalAlign="middle"
                >
                    <Text size="small" color="#999">No low inventory items found</Text>
                </Box>
            </Box>
        );
    }

    return (
        <Box direction="vertical">
            <Box width="100%" paddingBottom="0px">
                <Box direction="horizontal" align="center" gap="6px" style={{ alignItems: 'baseline' }}>
                    <Text size="small" weight="normal" tagName="h3">
                        Low Inventory Items
                    </Text>
                    <Tooltip content="Activate Pre-Sales for products running low in stock">
                        <Box style={{ display: 'flex', alignItems: 'center', height: '24px' }}>
                            <Hint style={{ color: '#000' }} size="16px" />
                        </Box>
                    </Tooltip>
                </Box>
            </Box>
            <Box
                border="1px solid #e0e0e0"
                borderRadius="8px"
                height="145px"
                maxHeight="145px"
                width="350px"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                {showScrollIndicator && (
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: '20px',
                            background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.8) 100%)',
                            pointerEvents: 'none',
                            zIndex: 1
                        }}
                    />
                )}
                {lowInventoryItems.length > 0 ? (
                    <div
                        style={{
                            overflowY: 'auto',
                            flex: 1,
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none',
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
                                const isScrollable = ref.scrollHeight > ref.clientHeight;
                                const isAtBottom = Math.abs(ref.scrollHeight - ref.clientHeight - ref.scrollTop) < 1;
                                setShowScrollIndicator(isScrollable && !isAtBottom);
                            }
                        }}
                    >
                        {lowInventoryItems.map((item, index) => (
                            <Box
                                key={`${item.id}-${item.variantId || index}`}
                                direction="horizontal"
                                align="left"
                                paddingTop="6px"
                                paddingBottom="6px"
                                paddingLeft="12px"
                                paddingRight="12px"
                                style={{
                                    borderBottom: index < lowInventoryItems.length - 1 ? '1px solid #e0e0e0' : 'none',
                                    minHeight: '50px'
                                }}
                            >
                                <Box direction="horizontal" align="left" gap="8px" style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
                                    <div
                                        style={{
                                            width: '40px',
                                            height: '30px',
                                            borderRadius: '4px',
                                            overflow: 'hidden',
                                            cursor: 'pointer',
                                            transition: 'transform 0.2s ease'
                                        }}
                                        onClick={() => handleProductImageClick(item)}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'scale(1.1)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'scale(1)';
                                        }}
                                        title="Edit product"
                                    >
                                        {item.image ? (
                                            <img
                                                src={processWixImageUrl(item.image)}
                                                alt={item.name}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.style.display = 'none';
                                                }}
                                            />
                                        ) : (
                                            <Box
                                                width="100%"
                                                height="100%"
                                                backgroundColor="#F5F5F5"
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                <Text size="tiny" color="#999">📦</Text>
                                            </Box>
                                        )}
                                    </div>
                                    <Box direction="vertical" gap="4px" style={{ flex: 1, minWidth: 0 }}>
                                        <Text ellipsis title={item.name} size="small" style={{ lineHeight: 1.2 }}>
                                            {item.name}
                                        </Text>
                                        <Box direction="horizontal" gap="8px" align="left">
                                            {item.variantName && item.variantId && (
                                                <Text
                                                    ellipsis
                                                    title={item.variantName}
                                                    size="tiny"
                                                    secondary
                                                    style={{
                                                        lineHeight: '1.1',
                                                        color: '#6C6C6C',
                                                        backgroundColor: '#F5F5F5',
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        maxWidth: 'fit-content'
                                                    }}
                                                >
                                                    {item.variantName}
                                                </Text>
                                            )}
                                            {item.sku && (
                                                <Text
                                                    ellipsis
                                                    title={`SKU: ${item.sku}`}
                                                    size="tiny"
                                                    secondary
                                                    style={{
                                                        lineHeight: '1.1',
                                                        color: '#6C6C6C',
                                                        backgroundColor: '#F0F0F0',
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        fontFamily: 'monospace',
                                                        maxWidth: 'fit-content'
                                                    }}
                                                >
                                                    {item.sku}
                                                </Text>
                                            )}
                                        </Box>
                                    </Box>
                                    <Box
                                        padding="3px 8px"
                                        borderRadius="4px"
                                        backgroundColor={
                                            item.quantity === 0 ? '#FFEDEC' :
                                                item.quantity <= 3 ? '#FFF4E6' :
                                                    '#F0F5FF'
                                        }
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            minWidth: '80px',
                                            marginLeft: '8px'
                                        }}
                                    >
                                        <Text size="small">
                                            {item.quantity}
                                        </Text>
                                    </Box>
                                </Box>
                            </Box>
                        ))}
                    </div>
                ) : (
                    <Box padding="18px" align="center" minHeight="200px" verticalAlign="middle">
                        <Text size="small">No low inventory items found</Text>
                    </Box>
                )}
            </Box>
        </Box>
    );
});

export default LowInventoryItems;