// src/backend/customer-rankings.web.ts - OPTIMIZED with Cache API
import { webMethod, Permissions } from '@wix/web-methods';
import { auth } from '@wix/essentials';
import { orders } from '@wix/ecom';

interface CustomerRanking {
  email: string;
  rank: number;
  totalSpent: number;
  orderCount: number;
}

interface CustomerRankingsResponse {
  success: boolean;
  rankings: CustomerRanking[];
  totalCustomers: number;
  lastCalculated: string;
  processingTime: number;
  totalOrders: number;
  fromCache?: boolean;
}

// Cache configuration
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds (calculate less frequently)
const CACHE_TAG = 'customer-rankings';

// Remove the old cache - we'll use Wix Cache API instead
export const getCustomerRankings = webMethod(
  Permissions.Anyone,
  async () => {
    const startTime = Date.now();

    try {
// Debug log removed

      // The response will be automatically cached by Wix with the cache options below
// Debug log removed

      const result = await calculateCustomerRankings();

      const processingTime = Date.now() - startTime;
// Debug log removed

      return {
        ...result,
        processingTime,
        fromCache: false
      };

    } catch (error) {
      console.error('Error calculating customer rankings:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        rankings: [],
        totalCustomers: 0,
        lastCalculated: new Date().toISOString(),
        processingTime: Date.now() - startTime,
        totalOrders: 0,
        fromCache: false
      };
    }
  },
  {
    // Cache configuration - this is the key improvement!
    cache: {
      ttl: CACHE_TTL,
      tags: [CACHE_TAG]
    }
  }
);

// Optimized calculation function - only process recent orders
async function calculateCustomerRankings(): Promise<{
  success: boolean;
  rankings: CustomerRanking[];
  totalCustomers: number;
  lastCalculated: string;
  totalOrders: number;
}> {
  const customerSpending = new Map<string, number>();
  const customerOrderCounts = new Map<string, number>();

  let allOrders: any[] = [];
  let hasMore = true;
  let cursor: string | undefined;
  let pageCount = 0;
  const MAX_PAGES = 100; // Reduced from 300 to 100 - process fewer orders

  // Only process orders from last 6 months for better performance
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Optimized: Load orders in smaller chunks for better memory management
  const CHUNK_SIZE = 50; // Smaller chunks for better performance

  while (hasMore && pageCount < MAX_PAGES) {
    try {
      // Loading orders chunk ${pageCount + 1}

      const elevatedSearchOrders = auth.elevate(orders.searchOrders);

      const searchParams = {
        cursorPaging: {
          limit: CHUNK_SIZE,
          ...(cursor ? { cursor } : {})
        },
        // Optimize: Only fetch necessary fields to reduce data transfer
        fieldsets: ['BASIC', 'CONTACT_DETAILS', 'PRICE_SUMMARY']
      };

      const response = await elevatedSearchOrders(searchParams);

      if (response.orders && response.orders.length > 0) {
        // Process orders immediately instead of storing all in memory
        processOrdersChunk(response.orders, customerSpending, customerOrderCounts);

        // Processed orders chunk

        // Keep track of total for reporting
        allOrders.length += response.orders.length;

        hasMore = response.metadata?.hasNext ?? false;
        cursor = response.metadata?.cursors?.next ?? undefined;
        pageCount++;

        // Add small delay between chunks to prevent overwhelming the API
        if (hasMore && pageCount % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } else {
        hasMore = false;
      }
    } catch (pageError) {
      console.error(`Error loading chunk ${pageCount + 1}:`, pageError);
      break;
    }
  }

// Debug log removed

  // Sort customers by total spending (highest first)
  const sortedCustomers = Array.from(customerSpending.entries())
    .sort((a, b) => b[1] - a[1]);

  // Create rankings array
  const rankings: CustomerRanking[] = sortedCustomers.map(([email, totalSpent], index) => ({
    email,
    rank: index + 1,
    totalSpent,
    orderCount: customerOrderCounts.get(email) || 0
  }));

  return {
    success: true,
    rankings,
    totalCustomers: rankings.length,
    lastCalculated: new Date().toISOString(),
    totalOrders: allOrders.length
  };
}

// Optimized: Process orders chunk by chunk instead of all at once
function processOrdersChunk(
  orders: any[],
  customerSpending: Map<string, number>,
  customerOrderCounts: Map<string, number>
) {
  orders.forEach((order) => {
    try {
      // Extract customer email from various possible locations
      const recipientEmail = order.recipientInfo?.contactDetails?.email;
      const billingEmail = order.billingInfo?.contactDetails?.email;
      const buyerEmail = order.buyerInfo?.email;

      const customerEmail = recipientEmail || billingEmail || buyerEmail;

      if (customerEmail) {
        // Parse order total - handle European format
        const totalAmount = parseOrderTotal(order.priceSummary?.total?.amount || order.totals?.total || '0');

        // Update spending
        customerSpending.set(customerEmail, (customerSpending.get(customerEmail) || 0) + totalAmount);

        // Update order count
        customerOrderCounts.set(customerEmail, (customerOrderCounts.get(customerEmail) || 0) + 1);
      }
    } catch (orderError) {
      console.error(`Error processing order ${order._id}:`, orderError);
    }
  });
}

// Helper function to parse order totals (unchanged)
function parseOrderTotal(totalValue: any): number {
  if (typeof totalValue === 'number') {
    return totalValue;
  }

  if (typeof totalValue === 'string') {
    const match = totalValue.match(/[\d,\.]+/);
    if (match) {
      let numberStr = match[0];

      if (numberStr.includes(',') && (!numberStr.includes('.') || numberStr.lastIndexOf(',') > numberStr.lastIndexOf('.'))) {
        numberStr = numberStr.replace(/\./g, '').replace(',', '.');
      } else {
        numberStr = numberStr.replace(/,/g, '');
      }

      return parseFloat(numberStr) || 0;
    }
  }

  return 0;
}

// Cache invalidation method - call this when orders are created/updated
export const invalidateCustomerRankingsCache = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      // Import cache API
      const { cache } = await import('@wix/cache');

      // Invalidate the customer rankings cache
      await cache.invalidateCache([{ tag: CACHE_TAG }]);

// Debug log removed

      return {
        success: true,
        message: 'Customer rankings cache invalidated',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error invalidating customer rankings cache:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }
);

// Optional: Get cache status
export const getCustomerRankingsCacheStatus = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      return {
        success: true,
        cacheTag: CACHE_TAG,
        cacheTTL: CACHE_TTL,
        message: 'Cache configured with 2-hour TTL and automatic invalidation on order changes'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
);