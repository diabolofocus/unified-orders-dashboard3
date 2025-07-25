import { orders } from '@wix/ecom';
import { products } from '@wix/stores';

export interface ProductSearchResult {
    id: string;
    name: string;
    productId: string;
    catalogItemId: string;
    variants?: Array<{
        id: string;
        sku?: string;
        choices?: Record<string, any>;
    }>;
}

export interface ProductOrdersResponse {
    success: boolean;
    orders: any[];
    totalCount: number;
    error?: string;
}

export class ProductsApiService {

    /**
     * Search products by name using the Products API
     */
    static async searchProducts(query: string, limit: number = 20): Promise<ProductSearchResult[]> {
        try {
            if (!query || query.trim().length < 2) {
                return [];
            }

            const response = await products.queryProducts()
                .hasSome('name', [query.trim()])
                .limit(limit)
                .find();

            return response.items?.map((item: any) => ({
                id: item._id || '',
                name: item.name || 'Unknown Product',
                productId: item._id || '',
                catalogItemId: item._id || '',
                variants: item.variants?.map((variant: any) => ({
                    id: variant._id || '',
                    sku: variant.stock?.sku,
                    choices: variant.choices
                })) || []
            })) || [];

        } catch (error) {
            console.error('Error searching products:', error);
            throw new Error('Failed to search products');
        }
    }

    /**
     * Search orders by product using catalog item ID
     */
    static async searchOrdersByProduct(productId: string, limit: number = 100): Promise<ProductOrdersResponse> {
        try {
            if (!productId) {
                return {
                    success: false,
                    orders: [],
                    totalCount: 0,
                    error: 'Product ID is required'
                };
            }

            const response = await orders.searchOrders({
                filter: {
                    "lineItems.catalogReference.catalogItemId": {
                        "$hasSome": [productId]
                    }
                },
                sort: [{ fieldName: "_createdDate", order: "DESC" }],
                cursorPaging: { limit }
            });

            return {
                success: true,
                orders: response.orders || [],
                totalCount: response.orders?.length || 0
            };

        } catch (error) {
            console.error('Error searching orders by product:', error);
            return {
                success: false,
                orders: [],
                totalCount: 0,
                error: error instanceof Error ? error.message : 'Failed to search orders'
            };
        }
    }

    /**
     * Search orders by multiple products
     */
    static async searchOrdersByMultipleProducts(productIds: string[], limit: number = 100): Promise<ProductOrdersResponse> {
        try {
            if (!productIds || productIds.length === 0) {
                return {
                    success: false,
                    orders: [],
                    totalCount: 0,
                    error: 'At least one product ID is required'
                };
            }

            const response = await orders.searchOrders({
                filter: {
                    "lineItems.catalogReference.catalogItemId": {
                        "$hasSome": productIds
                    }
                },
                sort: [{ fieldName: "_createdDate", order: "DESC" }],
                cursorPaging: { limit }
            });

            return {
                success: true,
                orders: response.orders || [],
                totalCount: response.orders?.length || 0
            };
        } catch (error) {
            console.error('Error searching orders by multiple products:', error);
            return {
                success: false,
                orders: [],
                totalCount: 0,
                error: error instanceof Error ? error.message : 'Failed to search orders'
            };
        }
    }
}