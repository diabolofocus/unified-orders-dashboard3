// Enhanced SidePanel.tsx with real SKU extraction and filtering
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { SidePanel as WixSidePanel, Text, Box, Button, Search, Checkbox, IconButton, DatePicker, FormField, FieldSet, Radio, TagList } from '@wix/design-system';
import * as Icons from '@wix/wix-ui-icons-common';
import type { Order } from '../../types/Order';
import { ProductsApiService, ProductSearchResult } from '../../services/ProductsApiService';




// Helper function to convert Wix image URLs to accessible URLs
const convertWixImageUrl = (imageUrl: string): string => {
  if (!imageUrl) return '';

  // Handle wix:image:// URLs
  if (imageUrl.startsWith('wix:image://v1/')) {
    // Extract the image ID from the wix:image URL
    const imageId = imageUrl.replace('wix:image://v1/', '').split('#')[0];
    return `https://static.wixstatic.com/media/${imageId}/v1/fill/w_40,h_40,al_c,q_80,usm_0.66_1.00_0.01,enc_auto/${imageId}.jpg`;
  }

  // Handle static.wixstatic.com URLs
  if (imageUrl.includes('static.wixstatic.com')) {
    try {
      const url = new URL(imageUrl);
      // Add image optimization parameters for small thumbnails
      url.searchParams.set('w', '40');
      url.searchParams.set('h', '40');
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
    url.searchParams.set('w', '40');
    url.searchParams.set('h', '40');
    url.searchParams.set('fit', 'fill');
    url.searchParams.set('f', 'jpg');
    return url.toString();
  } catch (error) {
    // If it's not a valid URL, return as is
    return imageUrl;
  }
};

// Extract image URL from various possible locations in line items
const extractImageUrl = (item: any): string => {
  // Try different possible locations for the image URL
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

  return '';
};

// THEN YOUR INTERFACES START HERE:
interface SKUInfo {
  sku: string;
  productName: string;
  orderCount: number;
  totalQuantity: number;
  imageUrl: string; // ADD THIS LINE TOO
}

interface SidePanelProps {
  onClose: () => void;
  onSkusChange?: (skus: string[]) => void;
  selectedSkus?: string[];
  orders?: Order[];
  onFulfillmentStatusChange?: (status: string | null) => void;
  selectedFulfillmentStatus?: string | null;
  onPaymentStatusChange?: (status: string | null) => void;
  selectedPaymentStatus?: string | null;
  onArchiveStatusChange?: (status: string | null) => void;
  selectedArchiveStatus?: string | null;
  isFulfillmentStatusLoading?: boolean;
  isPaymentStatusLoading?: boolean;
  onDateChange?: (date: string | null) => void;
  selectedDate?: string | null;
  customDateRange?: { from: Date | null; to: Date | null };
  onCustomDateRangeChange?: (range: { from: Date | null; to: Date | null }) => void;
  onProductsApiFilterChange?: (productIds: string[]) => void;
  selectedProductsApiFilter?: string[];
}

export const SidePanel: React.FC<SidePanelProps> = ({
  onClose,
  onSkusChange,
  selectedSkus = [],
  orders = [],
  onFulfillmentStatusChange,
  selectedFulfillmentStatus = null,
  onPaymentStatusChange,
  selectedPaymentStatus = null,
  onArchiveStatusChange,
  selectedArchiveStatus = null,
  isFulfillmentStatusLoading = false,
  isPaymentStatusLoading = false,
  onDateChange,
  selectedDate = null,
  customDateRange = { from: null, to: null },
  onCustomDateRangeChange,
  onProductsApiFilterChange,
  selectedProductsApiFilter = []
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDateExpanded, setIsDateExpanded] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [selectedSkuSet, setSelectedSkuSet] = useState<Set<string>>(new Set(selectedSkus));
  const [isFulfillmentStatusExpanded, setIsFulfillmentStatusExpanded] = useState(false);
  const [isPaymentStatusExpanded, setIsPaymentStatusExpanded] = useState(false);
  const [selectedFulfillmentStatusSet, setSelectedFulfillmentStatusSet] = useState<Set<string>>(new Set(selectedFulfillmentStatus ? [selectedFulfillmentStatus] : []));
  const [selectedPaymentStatusSet, setSelectedPaymentStatusSet] = useState<Set<string>>(new Set(selectedPaymentStatus ? [selectedPaymentStatus] : []));
  const [selectedArchiveStatusSet, setSelectedArchiveStatusSet] = useState<Set<string>>(new Set(selectedArchiveStatus ? [selectedArchiveStatus] : [])); const [isArchiveStatusExpanded, setIsArchiveStatusExpanded] = useState(false);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(selectedDate); const [localCustomDateRange, setLocalCustomDateRange] = useState(customDateRange);

  // Products API filter state
  const [isProductsApiExpanded, setIsProductsApiExpanded] = useState(false);
  const [productsApiSearchValue, setProductsApiSearchValue] = useState('');
  const [selectedProductsApiSet, setSelectedProductsApiSet] = useState<Set<string>>(new Set(selectedProductsApiFilter));
  const [productsApiResults, setProductsApiResults] = useState<ProductSearchResult[]>([]);
  const [isProductsApiLoading, setIsProductsApiLoading] = useState(false);
  const [productsApiError, setProductsApiError] = useState<string | null>(null);

  const fulfillmentStatusOptions = [
    { id: 'unfulfilled', value: 'Unfulfilled' },
    { id: 'fulfilled', value: 'Fulfilled' },
    { id: 'partially_fulfilled', value: 'Partially fulfilled' },
    { id: 'canceled', value: 'Canceled' }
  ];

  const paymentStatusOptions = [
    { id: 'paid', value: 'Paid' },
    { id: 'unpaid', value: 'Unpaid' },
    { id: 'refunded', value: 'Refunded' },
    { id: 'partially_refunded', value: 'Partially refunded' },
    { id: 'partially_paid', value: 'Partially paid' },
    { id: 'authorized', value: 'Authorized' },
    { id: 'pending', value: 'Pending' },
    { id: 'declined', value: 'Declined' },
    { id: 'canceled', value: 'Canceled' },
    { id: 'pending_refund', value: 'Pending refund' }
  ];

  const archiveStatusOptions = [
    { id: 'archived', value: 'Archived' }
  ];

  const dateFilterOptions = [
    { id: 'all', value: 'All' },
    { id: 'last7days', value: 'Last 7 days' },
    { id: 'last14days', value: 'Last 14 days' },
    { id: 'lastmonth', value: 'Last month' },
    { id: 'custom', value: 'Custom' }
  ];

  // Handle date filter changes
  const handleDateFilterChange = (dateId: string) => {
    setSelectedDateFilter(dateId);
    if (onDateChange) {
      onDateChange(dateId === 'all' ? null : dateId);
    }
  };

  // Handle custom date range changes
  const handleCustomDateChange = (field: 'from' | 'to', date: Date | null) => {
    const newRange = { ...localCustomDateRange, [field]: date };
    setLocalCustomDateRange(newRange);
    if (onCustomDateRangeChange) {
      onCustomDateRangeChange(newRange);
    }
  };

  // Extract unique SKUs from orders
  const availableSkus = useMemo((): SKUInfo[] => {
    const skuMap = new Map<string, SKUInfo>();

    orders.forEach(order => {
      const lineItems = order.rawOrder?.lineItems || order.lineItems || order.items || [];

      lineItems.forEach((item: any) => {
        // Extract SKU from various possible locations
        let sku: string | undefined;
        let productName = 'Unknown Product';

        // Try different SKU sources in order of preference
        if (item.physicalProperties?.sku) {
          sku = item.physicalProperties.sku;
        } else if (item.catalogReference?.catalogItemId) {
          sku = item.catalogReference.catalogItemId;
        } else if (item.sku) {
          sku = item.sku;
        } else if (item.productId) {
          sku = item.productId;
        }

        // Extract product name
        // Extract product name
        if (typeof item.productName === 'string') {
          productName = item.productName;
        } else if (typeof item.productName === 'object' && item.productName?.original) {
          productName = item.productName.original;
        } else if (item.name) {
          productName = item.name;
        }

        // Extract image URL
        const imageUrl = extractImageUrl(item);

        // Only add if we found a valid SKU
        if (sku && sku.trim() !== '') {
          const quantity = item.quantity || 1;

          if (skuMap.has(sku)) {
            const existing = skuMap.get(sku)!;
            existing.orderCount += 1;
            existing.totalQuantity += quantity;
            // Update product name if current one is more descriptive
            if (productName !== 'Unknown Product' && existing.productName === 'Unknown Product') {
              existing.productName = productName;
            }
            // Update image if current one is empty and we have a new one
            if (!existing.imageUrl && imageUrl) {
              existing.imageUrl = imageUrl;
            }
          } else {
            skuMap.set(sku, {
              sku,
              productName,
              orderCount: 1,
              totalQuantity: quantity,
              imageUrl: imageUrl || '' // ADD THIS LINE
            });
          }
        }
      });
    });

    // Convert to array and sort by total quantity (most popular first)
    return Array.from(skuMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
  }, [orders]);

  // Filter SKUs based on search
  const filteredSkus = useMemo(() => {
    if (!searchValue.trim()) {
      return availableSkus;
    }

    const searchTerm = searchValue.toLowerCase();
    return availableSkus.filter(skuInfo =>
      skuInfo.sku.toLowerCase().includes(searchTerm) ||
      skuInfo.productName.toLowerCase().includes(searchTerm)
    );
  }, [availableSkus, searchValue]);

  // Generate tags for selected filters
  const selectedFilterTags = useMemo(() => {
    const tags = [];

    // Add date filter tag
    if (selectedDate && selectedDate !== 'all') {
      const dateOption = dateFilterOptions.find(opt => opt.id === selectedDate);
      tags.push({
        id: `date-${selectedDate}`,
        children: `Date: ${dateOption?.value || selectedDate}`,
        filterType: 'date',
        filterValue: selectedDate
      });
    }

    // Add selected SKUs as tags (show first few product names)
    selectedSkus.slice(0, 3).forEach(sku => {
      const skuInfo = availableSkus.find(s => s.sku === sku);
      tags.push({
        id: `sku-${sku}`,
        children: skuInfo?.productName || sku,
        filterType: 'sku',
        filterValue: sku
      });
    });

    // If more SKUs are selected, add a summary tag
    if (selectedSkus.length > 3) {
      tags.push({
        id: 'sku-more',
        children: `+${selectedSkus.length - 3} more products`,
        filterType: 'sku-summary',
        filterValue: undefined
      });
    }

    // Add Products API filter tags
    Array.from(selectedProductsApiSet).slice(0, 3).forEach(productId => {
      const product = productsApiResults.find(p => p.id === productId);
      tags.push({
        id: `products-api-${productId}`,
        children: product?.name || `Product ${productId}`,
        filterType: 'products-api',
        filterValue: productId
      });
    });

    // If more Products API items are selected, add a summary tag
    if (selectedProductsApiSet.size > 3) {
      tags.push({
        id: 'products-api-more',
        children: `+${selectedProductsApiSet.size - 3} more API products`,
        filterType: 'products-api-summary',
        filterValue: undefined
      });
    }

    // If more SKUs are selected, add a summary tag
    if (selectedSkus.length > 3) {
      tags.push({
        id: 'sku-more',
        children: `+${selectedSkus.length - 3} more products`,
        filterType: 'sku-summary',
        filterValue: undefined
      });
    }

    // Add fulfillment status tags
    Array.from(selectedFulfillmentStatusSet).forEach(status => {
      const statusOption = fulfillmentStatusOptions.find(opt => opt.id === status);
      tags.push({
        id: `fulfillment-${status}`,
        children: `Fulfillment: ${statusOption?.value || status}`,
        filterType: 'fulfillment',
        filterValue: status
      });
    });

    // Add payment status tags
    Array.from(selectedPaymentStatusSet).forEach(status => {
      const statusOption = paymentStatusOptions.find(opt => opt.id === status);
      tags.push({
        id: `payment-${status}`,
        children: `Payment: ${statusOption?.value || status}`,
        filterType: 'payment',
        filterValue: status
      });
    });

    // Add archive status tags
    Array.from(selectedArchiveStatusSet).forEach(status => {
      const statusOption = archiveStatusOptions.find(opt => opt.id === status);
      tags.push({
        id: `archive-${status}`,
        children: `Archive: ${statusOption?.value || status}`,
        filterType: 'archive',
        filterValue: status
      });
    });

    return tags;
  }, [selectedSkus, selectedFulfillmentStatusSet, selectedPaymentStatusSet, selectedArchiveStatusSet, selectedDate, availableSkus]);
  // Handle tag removal
  const handleTagRemove = (tagId: string) => {
    const tag = selectedFilterTags.find(t => t.id === tagId);
    if (!tag) return;

    switch (tag.filterType) {
      case 'date':
        setSelectedDateFilter('all');
        setLocalCustomDateRange({ from: null, to: null });
        if (onDateChange) onDateChange(null);
        if (onCustomDateRangeChange) onCustomDateRangeChange({ from: null, to: null });
        break;

      case 'sku':
        if (tag.filterValue) {
          const newSelectedSkus = new Set(selectedSkuSet);
          newSelectedSkus.delete(tag.filterValue);
          setSelectedSkuSet(newSelectedSkus);
          if (onSkusChange) onSkusChange(Array.from(newSelectedSkus));
        }
        break;

      case 'sku-summary':
        // Clear all SKUs
        setSelectedSkuSet(new Set());
        if (onSkusChange) onSkusChange([]);
        break;

      case 'products-api':
        if (tag.filterValue) {
          const newSelectedProducts = new Set(selectedProductsApiSet);
          newSelectedProducts.delete(tag.filterValue);
          setSelectedProductsApiSet(newSelectedProducts);
          if (onProductsApiFilterChange) onProductsApiFilterChange(Array.from(newSelectedProducts));
        }
        break;

      case 'products-api-summary':
        // Clear all Products API selections
        setSelectedProductsApiSet(new Set());
        if (onProductsApiFilterChange) onProductsApiFilterChange([]);
        break;

      case 'fulfillment':
        if (tag.filterValue) {
          const newStatuses = new Set(selectedFulfillmentStatusSet);
          newStatuses.delete(tag.filterValue);
          setSelectedFulfillmentStatusSet(newStatuses);
          if (onFulfillmentStatusChange) {
            const statusArray = Array.from(newStatuses);
            onFulfillmentStatusChange(statusArray.length > 0 ? statusArray[0] : null);
          }
        }
        break;

      case 'payment':
        if (tag.filterValue) {
          const newStatuses = new Set(selectedPaymentStatusSet);
          newStatuses.delete(tag.filterValue);
          setSelectedPaymentStatusSet(newStatuses);
          if (onPaymentStatusChange) {
            const statusArray = Array.from(newStatuses);
            onPaymentStatusChange(statusArray.length > 0 ? statusArray[0] : null);
          }
        }
        break;

      case 'archive':
        if (tag.filterValue) {
          const newStatuses = new Set(selectedArchiveStatusSet);
          newStatuses.delete(tag.filterValue);
          setSelectedArchiveStatusSet(newStatuses);
        }
        break;
    }
  };

  // Handle Products API search
  const handleProductsApiSearch = async (query: string) => {
    setProductsApiSearchValue(query);

    if (!query.trim() || query.trim().length < 2) {
      setProductsApiResults([]);
      setProductsApiError(null);
      return;
    }

    setIsProductsApiLoading(true);
    setProductsApiError(null);

    try {
      const results = await ProductsApiService.searchProducts(query.trim(), 20);
      setProductsApiResults(results);
    } catch (error) {
      setProductsApiError(error instanceof Error ? error.message : 'Failed to search products');
      setProductsApiResults([]);
    } finally {
      setIsProductsApiLoading(false);
    }
  };

  // Handle Products API selection
  const handleProductsApiToggle = (productId: string) => {
    const newSelectedProducts = new Set(selectedProductsApiSet);

    if (newSelectedProducts.has(productId)) {
      newSelectedProducts.delete(productId);
    } else {
      newSelectedProducts.add(productId);
    }

    setSelectedProductsApiSet(newSelectedProducts);

    if (onProductsApiFilterChange) {
      onProductsApiFilterChange(Array.from(newSelectedProducts));
    }
  };

  // Toggle more button configuration
  const toggleMoreButton = (amountOfHiddenTags: number, isExpanded: boolean) => ({
    label: isExpanded ? 'Show Less' : `+${amountOfHiddenTags} More`,
    tooltipContent: !isExpanded ? 'Show More Filters' : undefined,
  });

  // Handle checkbox changes
  const handleSkuToggle = (sku: string) => {
    const newSelectedSkus = new Set(selectedSkuSet);

    if (newSelectedSkus.has(sku)) {
      newSelectedSkus.delete(sku);
    } else {
      newSelectedSkus.add(sku);
    }

    setSelectedSkuSet(newSelectedSkus);

    // Notify parent component
    if (onSkusChange) {
      onSkusChange(Array.from(newSelectedSkus));
    }
  };

  // Handle select all/none
  const handleSelectAll = () => {
    const allVisible = filteredSkus.map(skuInfo => skuInfo.sku);
    const newSelectedSkus = new Set(selectedSkuSet);

    const allSelected = allVisible.every(sku => newSelectedSkus.has(sku));

    if (allSelected) {
      // Deselect all visible
      allVisible.forEach(sku => newSelectedSkus.delete(sku));
    } else {
      // Select all visible
      allVisible.forEach(sku => newSelectedSkus.add(sku));
    }

    setSelectedSkuSet(newSelectedSkus);

    if (onSkusChange) {
      onSkusChange(Array.from(newSelectedSkus));
    }
  };

  // Handle fulfillment status checkbox changes
  const handleFulfillmentStatusToggle = (status: string) => {
    const newSelectedStatuses = new Set(selectedFulfillmentStatusSet);

    if (newSelectedStatuses.has(status)) {
      newSelectedStatuses.delete(status);
    } else {
      newSelectedStatuses.add(status);
    }

    setSelectedFulfillmentStatusSet(newSelectedStatuses);

    if (onFulfillmentStatusChange) {
      const statusArray = Array.from(newSelectedStatuses);
      onFulfillmentStatusChange(statusArray.length > 0 ? statusArray[0] : null);
    }
  };

  // Handle payment status checkbox changes
  const handlePaymentStatusToggle = (status: string) => {
    const newSelectedStatuses = new Set(selectedPaymentStatusSet);

    if (newSelectedStatuses.has(status)) {
      newSelectedStatuses.delete(status);
    } else {
      newSelectedStatuses.add(status);
    }

    setSelectedPaymentStatusSet(newSelectedStatuses);

    if (onPaymentStatusChange) {
      const statusArray = Array.from(newSelectedStatuses);
      onPaymentStatusChange(statusArray.length > 0 ? statusArray[0] : null);
    }
  };

  // Handle archive status checkbox changes
  const handleArchiveStatusToggle = (status: string) => {
    const newSelectedStatuses = new Set(selectedArchiveStatusSet);

    if (newSelectedStatuses.has(status)) {
      newSelectedStatuses.delete(status);
    } else {
      newSelectedStatuses.add(status);
    }

    setSelectedArchiveStatusSet(newSelectedStatuses);

    if (onArchiveStatusChange) {
      const statusArray = Array.from(newSelectedStatuses);
      onArchiveStatusChange(statusArray.length > 0 ? statusArray[0] : null);
    }
  };

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Focus trap - focus the panel when it opens
    if (panelRef.current) {
      panelRef.current.focus();
    }

    // Prevent body scroll when panel is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  // Update selected SKUs when prop changes
  useEffect(() => {
    setSelectedSkuSet(new Set(selectedSkus));
  }, [selectedSkus]);

  useEffect(() => {
    setSelectedFulfillmentStatusSet(new Set(selectedFulfillmentStatus ? [selectedFulfillmentStatus] : []));
  }, [selectedFulfillmentStatus]);

  useEffect(() => {
    setSelectedPaymentStatusSet(new Set(selectedPaymentStatus ? [selectedPaymentStatus] : []));
  }, [selectedPaymentStatus]);

  useEffect(() => {
    setSelectedArchiveStatusSet(new Set(selectedArchiveStatus ? [selectedArchiveStatus] : []));
  }, [selectedArchiveStatus]);

  const selectedCount = selectedSkuSet.size;
  const visibleSelectedCount = filteredSkus.filter(skuInfo => selectedSkuSet.has(skuInfo.sku)).length;
  const allVisibleSelected = filteredSkus.length > 0 && visibleSelectedCount === filteredSkus.length;

  const portalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 30, 60, 0.5)',
        zIndex: 999999,
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="SKU filter panel"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        style={{
          backgroundColor: 'white',
          boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.15)',
          height: '100vh',
          overflow: 'auto',
          animation: 'slideInRight 0.3s ease-out',
          outline: 'none',
          zIndex: 1000000
        }}
      >
        <WixSidePanel
          width="400px"
          dataHook="sku-filter-side-panel"
          skin="standard"
        >
          <WixSidePanel.Header
            title={`Filter your orders ${selectedCount > 0 ? `(${selectedCount} selected)` : ''}`}
            suffix={
              <IconButton
                size="medium"
                skin="dark"
                priority="tertiary"
                onClick={onClose}
              >
                <Icons.X />
              </IconButton>
            }
          />
          <WixSidePanel.Content>
            <Box
              height="calc(100vh - 208px)"
              width="100%"
              direction="vertical"
              style={{
                overflow: 'auto',
                scrollBehavior: 'smooth'
              }}
              padding="0px"
            >
              {availableSkus.length > 0 ? (
                <Box
                  direction="vertical"
                  width="100%"
                  height="100%"
                  gap="0px"
                  style={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  {/* DATE FILTER SECTION */}
                  <div
                    style={{
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                    onClick={() => setIsDateExpanded(!isDateExpanded)}
                  >
                    <Box
                      style={{
                        padding: '16px'
                      }}
                    >
                      <Box
                        align="space-between"
                        verticalAlign="middle"
                        width="100%"
                        padding="16px 0px 16px 0px"
                      >
                        <Text size="medium" weight="normal">
                          Date Created {selectedDate && selectedDate !== 'all' ? `(${dateFilterOptions.find(opt => opt.id === selectedDate)?.value})` : ''}
                        </Text>
                        <IconButton
                          size="medium"
                          skin="dark"
                          priority="tertiary"
                        >
                          {isDateExpanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
                        </IconButton>
                      </Box>
                    </Box>
                  </div>
                  {/* Date Filter Content */}
                  {isDateExpanded && (
                    <Box
                      direction="vertical"
                      gap="16px"
                      style={{
                        animation: 'slideDown 0.2s ease-out',
                        padding: '0 0 16px 0',
                        flexShrink: 0
                      }}
                      padding="0 0 24px 0"
                    >
                      {/* Date Options */}
                      <Box direction="vertical" gap="8px" style={{ maxHeight: '200px', overflow: 'auto' }}>
                        {dateFilterOptions.map((option) => (
                          <Box key={option.id} direction="vertical" gap="2px">
                            <Radio
                              checked={selectedDateFilter === option.id || (option.id === 'all' && !selectedDateFilter)}
                              onChange={() => handleDateFilterChange(option.id)}
                              size="medium"
                              label={
                                <Text size="medium">
                                  {option.value}
                                </Text>
                              }
                            />
                          </Box>
                        ))}
                      </Box>

                      {/* Custom Date Range */}
                      {selectedDateFilter === 'custom' && (
                        <Box direction="vertical" gap="12px" style={{
                          padding: '12px',
                          borderRadius: '4px',
                          border: '1px solid #e5e7eb'
                        }}>
                          <FieldSet
                            legend="Custom Date Range"
                            direction="horizontal"
                            legendPlacement="none"
                            alignment="center"
                          >
                            <FormField label="From">
                              <DatePicker
                                size="small"
                                width="auto"
                                placeholderText="Date"
                                value={localCustomDateRange.from || undefined}
                                onChange={(date: Date | null) => handleCustomDateChange('from', date)}
                                popoverProps={{
                                  appendTo: 'window',
                                  zIndex: 1000001
                                }}
                                zIndex={1000001}
                              />
                            </FormField>
                            <FormField label="To">
                              <DatePicker
                                size="small"
                                width="auto"
                                placeholderText="Date"
                                value={localCustomDateRange.to || undefined}
                                onChange={(date: Date | null) => handleCustomDateChange('to', date)}
                                popoverProps={{
                                  appendTo: 'window',
                                  zIndex: 1000001
                                }}
                                zIndex={1000001}
                              />
                            </FormField>
                          </FieldSet>
                        </Box>
                      )}
                    </Box>
                  )}

                  {/* SKU FILTER SECTION */}
                  <div
                    style={{
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                    onClick={(e) => {
                      // Don't toggle if clicking on interactive elements
                      const target = e.target as HTMLElement;
                      if (target.tagName === 'INPUT' ||
                        target.closest('input') ||
                        target.closest('[role="searchbox"]') ||
                        target.closest('.wsr-search') ||
                        target.closest('[data-hook]')?.getAttribute('data-hook')?.includes('search') ||
                        target.closest('.wsr-input') ||
                        target.closest('.wsr-text-button')) {
                        e.stopPropagation();
                        return;
                      }
                      setIsExpanded(!isExpanded);
                    }}
                  >
                    <Box
                      style={{
                        padding: '12px'
                      }}
                    >
                      <Box
                        align="space-between"
                        verticalAlign="middle"
                        width="100%"
                        padding="16px 0px 16px 0px"
                        borderTop="1px solid #e5e7eb"
                      >
                        <Text size="medium" weight="normal">
                          Product or SKU
                        </Text>
                        <IconButton
                          size="medium"
                          skin="dark"
                          priority="tertiary"
                        >
                          {isExpanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
                        </IconButton>
                      </Box>
                    </Box>
                  </div>

                  {/* Collapsible Content */}
                  {isExpanded && (
                    <Box
                      direction="vertical"
                      style={{
                        animation: 'slideDown 0.2s ease-out',
                        minHeight: '200px',
                        maxHeight: '300px',
                        flexShrink: 0
                      }}
                      padding="0 0 24px 0"
                    >
                      {/* Search Bar */}
                      <div
                        style={{
                          padding: '0 12px 12px 12px',
                          paddingBottom: '12px',
                          flexShrink: 0
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Search
                          value={searchValue}
                          onChange={(e) => setSearchValue(e.target.value)}
                          onClear={() => setSearchValue('')}
                          placeholder="Search SKUs or product names..."
                          size="small"
                        />
                      </div>

                      {/* SKU List */}
                      <Box
                        direction="vertical"
                        gap="12px"
                        style={{
                          minHeight: '150px',
                          maxHeight: '320px',
                          overflow: 'auto',
                          padding: '0 12px 12px 12px',
                          scrollBehavior: 'smooth',
                          flexShrink: 0
                        }}
                      >
                        {filteredSkus.length > 0 ? (
                          filteredSkus.map((skuInfo) => (
                            <Box key={skuInfo.sku} direction="vertical" gap="2px">
                              <Checkbox
                                checked={selectedSkuSet.has(skuInfo.sku)}
                                onChange={() => handleSkuToggle(skuInfo.sku)}
                                size="small"
                              >
                                <Box direction="horizontal" align="center" gap="8px" WebkitAlignItems="center">
                                  <div style={{
                                    width: '32px',
                                    height: '32px',
                                    backgroundColor: '#f0f0f0',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden',
                                    flexShrink: 0
                                  }}>
                                    {(() => {
                                      const accessibleUrl = convertWixImageUrl(skuInfo.imageUrl);

                                      return accessibleUrl ? (
                                        <img
                                          src={accessibleUrl}
                                          alt={skuInfo.productName}
                                          style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover'
                                          }}
                                          onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            e.currentTarget.parentElement!.innerHTML = '<span style="font-size: 10px; color: #999;">No Image</span>';
                                          }}
                                        />
                                      ) : (
                                        <span style={{ fontSize: '10px', color: '#999' }}>No Image</span>
                                      );
                                    })()}
                                  </div>
                                  <Box direction="vertical" gap="2px" style={{ flex: 1, minWidth: 0 }}>
                                    <Text size="small" weight="normal" ellipsis>
                                      {skuInfo.productName}
                                    </Text>
                                    <Text size="tiny" secondary ellipsis>
                                      {skuInfo.sku}
                                    </Text>
                                    <Text size="tiny" secondary>
                                      {skuInfo.orderCount} order{skuInfo.orderCount !== 1 ? 's' : ''} • {skuInfo.totalQuantity} item{skuInfo.totalQuantity !== 1 ? 's' : ''}
                                    </Text>
                                  </Box>
                                </Box>
                              </Checkbox>
                            </Box>
                          ))
                        ) : (
                          <Box padding="20px" align="center">
                            <Text size="small" secondary>
                              {searchValue ? `No SKUs found matching "${searchValue}"` : 'No SKUs available'}
                            </Text>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  )}

                  {/* PRODUCTS API FILTER SECTION */}
                  <div
                    style={{
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                    onClick={(e) => {
                      // Don't toggle if clicking on interactive elements or search areas
                      const target = e.target as HTMLElement;

                      // Check if click is inside search container
                      const isInsideSearchContainer = target.closest('[data-search-container="products-api"]');

                      if (isInsideSearchContainer ||
                        target.tagName === 'INPUT' ||
                        target.closest('input') ||
                        target.closest('[role="searchbox"]') ||
                        target.closest('.wsr-search') ||
                        target.closest('.wsr-input-wrapper') ||
                        target.closest('.wsr-input') ||
                        target.closest('.wsr-text-button') ||
                        target.closest('button') ||
                        (target.closest('[data-hook]')?.getAttribute('data-hook')?.includes('search'))) {
                        e.stopPropagation();
                        return;
                      }
                      setIsProductsApiExpanded(!isProductsApiExpanded);
                    }}
                  >
                    <Box
                      style={{
                        padding: '12px'
                      }}
                    >
                      <Box
                        align="space-between"
                        verticalAlign="middle"
                        width="100%"
                        padding="16px 0px 16px 0px"
                        borderTop="1px solid #e5e7eb"
                      >
                        <Text size="medium" weight="normal">
                          Products API {selectedProductsApiSet.size > 0 ? `(${selectedProductsApiSet.size} selected)` : ''}
                        </Text>
                        <IconButton
                          size="medium"
                          skin="dark"
                          priority="tertiary"
                        >
                          {isProductsApiExpanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
                        </IconButton>
                      </Box>
                    </Box>
                  </div>

                  {/* Products API Filter Content */}
                  {isProductsApiExpanded && (
                    <Box
                      direction="vertical"
                      style={{
                        animation: 'slideDown 0.2s ease-out',
                        minHeight: '200px',
                        maxHeight: '300px',
                        flexShrink: 0
                      }}
                      padding="0 0 24px 0"
                    >
                      {/* Search Bar */}
                      <div
                        style={{
                          padding: '0 12px 12px 12px',
                          paddingBottom: '12px',
                          flexShrink: 0
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Search
                          value={productsApiSearchValue}
                          onChange={(e) => handleProductsApiSearch(e.target.value)}
                          onClear={() => {
                            setProductsApiSearchValue('');
                            setProductsApiResults([]);
                            setProductsApiError(null);
                          }}
                          placeholder="Search products by name (min 2 chars)..."
                          size="small"
                        />
                      </div>

                      {/* Products List */}
                      <Box
                        direction="vertical"
                        gap="12px"
                        style={{
                          minHeight: '150px',
                          maxHeight: '320px',
                          overflow: 'auto',
                          padding: '0 12px 12px 12px',
                          scrollBehavior: 'smooth',
                          flexShrink: 0
                        }}
                      >
                        {isProductsApiLoading ? (
                          <Box padding="20px" align="center">
                            <Text size="small" secondary>Searching products...</Text>
                          </Box>
                        ) : productsApiError ? (
                          <Box padding="20px" align="center">
                            <Text size="small" secondary>{productsApiError}</Text>
                          </Box>
                        ) : productsApiResults.length > 0 ? (
                          productsApiResults.map((product) => (
                            <Box key={product.id} direction="vertical" gap="2px">
                              <Checkbox
                                checked={selectedProductsApiSet.has(product.id)}
                                onChange={() => handleProductsApiToggle(product.id)}
                                size="small"
                              >
                                <Box direction="vertical" gap="2px" style={{ flex: 1, minWidth: 0 }}>
                                  <Text size="small" weight="normal" ellipsis>
                                    {product.name}
                                  </Text>
                                  <Text size="tiny" secondary ellipsis>
                                    ID: {product.productId}
                                  </Text>
                                  {product.variants && product.variants.length > 0 && (
                                    <Text size="tiny" secondary>
                                      {product.variants.length} variant{product.variants.length !== 1 ? 's' : ''}
                                    </Text>
                                  )}
                                </Box>
                              </Checkbox>
                            </Box>
                          ))
                        ) : productsApiSearchValue.trim().length >= 2 ? (
                          <Box padding="20px" align="center">
                            <Text size="small" secondary>
                              No products found matching "{productsApiSearchValue}"
                            </Text>
                          </Box>
                        ) : (
                          <Box padding="20px" align="center">
                            <Text size="small" secondary>
                              Enter at least 2 characters to search products
                            </Text>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  )}

                  {/* FULFILLMENT STATUS FILTER SECTION */}
                  <div
                    style={{
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                    onClick={() => setIsFulfillmentStatusExpanded(!isFulfillmentStatusExpanded)}
                  >
                    <Box
                      style={{
                        paddingTop: '12px'
                      }}
                    >
                      <Box
                        align="space-between"
                        verticalAlign="middle"
                        width="100%"
                        padding="16px 0px 16px 0px"
                        borderTop="1px solid #e5e7eb"
                      >
                        <Text size="medium" weight="normal">
                          Fulfillment Status {selectedFulfillmentStatus ? `(${fulfillmentStatusOptions.find(opt => opt.id === selectedFulfillmentStatus)?.value})` : ''}
                        </Text>
                        <IconButton
                          size="medium"
                          skin="dark"
                          priority="tertiary"
                        >
                          {isFulfillmentStatusExpanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
                        </IconButton>
                      </Box>
                    </Box>
                  </div>

                  {/* Fulfillment Status Filter Content */}
                  {isFulfillmentStatusExpanded && (
                    <Box
                      direction="vertical"
                      gap="16px"
                      style={{
                        animation: 'slideDown 0.2s ease-out',
                        flexShrink: 0
                      }}
                      padding="0 0 24px 0"
                    >
                      <Box
                        direction="vertical"
                        gap="16px"
                        style={{
                          animation: 'slideDown 0.2s ease-out',
                          display: 'flex',
                          flex: '1 1 0',
                          minHeight: '0'
                        }}
                      >
                        {fulfillmentStatusOptions.map((option) => (
                          <Box key={option.id} direction="vertical" gap="2px">
                            <Checkbox
                              checked={selectedFulfillmentStatusSet.has(option.id)}
                              onChange={() => handleFulfillmentStatusToggle(option.id)}
                              size="medium"
                              disabled={isFulfillmentStatusLoading}
                            >
                              <Text size="medium">
                                {option.value}
                              </Text>
                            </Checkbox>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* PAYMENT STATUS FILTER SECTION */}
                  <div
                    style={{
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                    onClick={() => setIsPaymentStatusExpanded(!isPaymentStatusExpanded)}
                  >
                    <Box
                      style={{
                        paddingTop: '12px'
                      }}
                    >
                      <Box
                        align="space-between"
                        verticalAlign="middle"
                        width="100%"
                        padding="16px 0px 16px 0px"
                        borderTop="1px solid #e5e7eb"
                      >
                        <Text size="medium" weight="normal">
                          Payment Status {selectedPaymentStatus ? `(${paymentStatusOptions.find(opt => opt.id === selectedPaymentStatus)?.value})` : ''}
                        </Text>
                        <IconButton
                          size="medium"
                          skin="dark"
                          priority="tertiary"
                        >
                          {isPaymentStatusExpanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
                        </IconButton>
                      </Box>
                    </Box>
                  </div>

                  {/* Payment Status Filter Content */}
                  {isPaymentStatusExpanded && (
                    <Box
                      direction="vertical"
                      gap="16px"
                      style={{
                        animation: 'slideDown 0.2s ease-out',
                        flexShrink: 0
                      }}
                      padding="0 0 24px 0"
                    >
                      <Box
                        direction="vertical"
                        gap="16px"
                        style={{
                          animation: 'slideDown 0.2s ease-out',
                          display: 'flex',
                          flex: '1 1 0',
                          minHeight: '0'
                        }}
                      >
                        {paymentStatusOptions.map((option) => (
                          <Box key={option.id} direction="vertical" gap="2px">
                            <Checkbox
                              checked={selectedPaymentStatusSet.has(option.id)}
                              onChange={() => handlePaymentStatusToggle(option.id)}
                              size="medium"
                              disabled={isPaymentStatusLoading}
                            >
                              <Text size="medium">
                                {option.value}
                              </Text>
                            </Checkbox>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* ARCHIVE STATUS FILTER SECTION */}
                  <div
                    style={{
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                    onClick={() => setIsArchiveStatusExpanded(!isArchiveStatusExpanded)}
                  >
                    <Box
                      style={{
                        paddingTop: '12px'
                      }}
                    >
                      <Box
                        align="space-between"
                        verticalAlign="middle"
                        width="100%"
                        padding="16px 0px 16px 0px"
                        borderTop="1px solid #e5e7eb"
                      >
                        <Text size="medium" weight="normal">
                          Archive Status {selectedArchiveStatusSet.size > 0 ? `(${Array.from(selectedArchiveStatusSet).map(id => archiveStatusOptions.find(opt => opt.id === id)?.value).join(', ')})` : ''}
                        </Text>
                        <IconButton
                          size="medium"
                          skin="dark"
                          priority="tertiary"
                        >
                          {isArchiveStatusExpanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
                        </IconButton>
                      </Box>
                    </Box>
                  </div>

                  {/* Archive Status Filter Content */}
                  {isArchiveStatusExpanded && (
                    <Box
                      direction="vertical"
                      gap="16px"
                      style={{
                        animation: 'slideDown 0.2s ease-out',
                        flexShrink: 0
                      }}
                      padding="0 0 24px 0"
                    >
                      <Box
                        direction="vertical"
                        gap="16px"
                        style={{
                          animation: 'slideDown 0.2s ease-out',
                          display: 'flex',
                          flex: '1 1 0',
                          minHeight: '0'
                        }}
                      >
                        {archiveStatusOptions.map((option) => (
                          <Box key={option.id} direction="vertical" gap="2px">
                            <Checkbox
                              checked={selectedArchiveStatusSet.has(option.id)}
                              onChange={() => handleArchiveStatusToggle(option.id)}
                              size="medium"
                            >
                              <Text size="medium">
                                {option.value}
                              </Text>
                            </Checkbox>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}

                </Box>
              ) : (
                <Box
                  padding="40px 20px"
                  align="center"
                  direction="vertical"
                  gap="12px"
                >
                  <Icons.Search size="48px" style={{ color: '#ccc' }} />
                  <Text size="medium" weight="bold">No SKUs Found</Text>
                  <Text size="small" secondary align="center">
                    No orders with SKU information were found in the current dataset.
                  </Text>
                </Box>
              )}
            </Box>
          </WixSidePanel.Content>
          <WixSidePanel.Footer>
            <Box
              direction="vertical"
              gap="12px"
              style={{
                padding: '16px'
              }}
            >
              {/* TagList for selected filters */}
              {selectedFilterTags.length > 0 && (
                <Box direction="vertical" gap="8px">
                  <Text size="small" weight="normal">Selected Filters:</Text>
                  <TagList
                    tags={selectedFilterTags}
                    size="small"
                    maxVisibleTags={3}
                    initiallyExpanded={false}
                    toggleMoreButton={toggleMoreButton}
                    onTagRemove={handleTagRemove}
                    dataHook="selected-filters-taglist"
                  />
                </Box>
              )}

              {/* Footer actions */}
              <Box
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <Text size="small" secondary>
                  {selectedFilterTags.length > 0 ? (
                    `${selectedFilterTags.length} filter${selectedFilterTags.length !== 1 ? 's' : ''} applied`
                  ) : (
                    'No filters selected'
                  )}
                </Text>
                <Box gap="8px">
                  {selectedFilterTags.length > 0 && (
                    <Button
                      size="small"
                      priority="primary"
                      onClick={() => {
                        setSelectedSkuSet(new Set());
                        setSelectedFulfillmentStatusSet(new Set());
                        setSelectedPaymentStatusSet(new Set());
                        setSelectedArchiveStatusSet(new Set());
                        setSelectedDateFilter('all');
                        setLocalCustomDateRange({ from: null, to: null });
                        setSelectedProductsApiSet(new Set());
                        if (onSkusChange) onSkusChange([]);
                        if (onFulfillmentStatusChange) onFulfillmentStatusChange(null);
                        if (onPaymentStatusChange) onPaymentStatusChange(null);
                        if (onArchiveStatusChange) onArchiveStatusChange(null);
                        if (onDateChange) onDateChange(null);
                        if (onCustomDateRangeChange) onCustomDateRangeChange({ from: null, to: null });
                        if (onProductsApiFilterChange) onProductsApiFilterChange([]);
                      }}
                    >
                      Clear All
                    </Button>
                  )}
                </Box>
              </Box>
            </Box>
          </WixSidePanel.Footer>
        </WixSidePanel>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        
        @keyframes slideDown {
          from { 
            opacity: 0;
            transform: translateY(-10px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(portalContent, document.body)
    : null;
};

export default SidePanel;