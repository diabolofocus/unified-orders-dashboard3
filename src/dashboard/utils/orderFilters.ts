import type { Order } from '../types/Order';

/**
 * Checks if an order contains a product with a name matching the filter (case-insensitive)
 */
export const orderContainsProduct = (order: Order, productFilter: string): boolean => {
  if (!productFilter || productFilter.trim() === '') {
    return false;
  }

  const filterLower = productFilter.toLowerCase().trim();
  
  // Check line items in the raw order
  if (order.rawOrder?.lineItems) {
    return order.rawOrder.lineItems.some((item: any) => {
      const productName = item.productName?.original || item.name || '';
      return productName.toLowerCase().includes(filterLower);
    });
  }

  return false;
};
