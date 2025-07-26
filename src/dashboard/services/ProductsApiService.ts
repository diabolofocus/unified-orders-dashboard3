import { orders } from '@wix/ecom';
import { products } from '@wix/stores';
import { productsV3 } from '@wix/stores';

export interface ProductSearchResult {
    id: string;
    name: string;
    productId: string;
    catalogItemId: string;
    media?: {
        items?: Array<{
            id: string;
            mediaType: string;
            title: string;
            image?: {
                url: string;
                width: number;
                height: number;
            };
            thumbnail?: {
                url: string;
                width: number;
                height: number;
            };
        }>;
        mainMedia?: {
            id: string;
            mediaType: string;
            title: string;
            image?: {
                url: string;
                width: number;
                height: number;
            };
            thumbnail?: {
                url: string;
                width: number;
                height: number;
            };
        };
    };
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

            // Get ALL products first, then filter by contains logic
            let allResults: any[] = [];

            // Search with startsWith for the full query
            const response = await products.queryProducts()
                .startsWith('name', query.trim())
                .limit(100) // Get more results to filter from
                .find();

            allResults.push(...(response.items || []));

            // Search by individual words using startsWith
            const searchWords = query.trim().toLowerCase().split(' ').filter(word => word.length > 1);

            for (const word of searchWords) {
                try {
                    const wordResponse = await products.queryProducts()
                        .startsWith('name', word)
                        .limit(100)
                        .find();

                    allResults.push(...(wordResponse.items || []));
                } catch (wordError) {
                    console.warn(`Error searching for word "${word}":`, wordError);
                }
            }

            // Also try searching where each letter of each word could start a word in the product name
            for (const word of searchWords) {
                // Get all products and we'll filter them
                try {
                    const allProductsResponse = await products.queryProducts()
                        .limit(100)
                        .find();

                    const matchingProducts = (allProductsResponse.items || []).filter((item: any) => {
                        const productName = (item.name || '').toLowerCase();
                        return productName.includes(word.toLowerCase());
                    });

                    allResults.push(...matchingProducts);
                } catch (error) {
                    console.warn(`Error in contains search for word "${word}":`, error);
                }
            }

            // Remove duplicates
            const uniqueResults = allResults.filter((item, index, self) =>
                index === self.findIndex(i => i._id === item._id)
            );

            // Convert to our result format
            const formattedResults = uniqueResults.map((item: any) => ({
                id: item._id || '',
                name: item.name || 'Unknown Product',
                productId: item._id || '',
                catalogItemId: item._id || '',
                media: item.media || undefined,
                variants: item.variants?.map((variant: any) => ({
                    id: variant._id || '',
                    sku: variant.stock?.sku,
                    choices: variant.choices
                })) || []
            }));

            // Filter results to only include items that actually contain the search query anywhere
            const filteredResults = formattedResults.filter(item =>
                item.name.toLowerCase().includes(query.toLowerCase())
            );

            return filteredResults.slice(0, limit);

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