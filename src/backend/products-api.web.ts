// src/backend/products-api.web.ts

import { webMethod, Permissions } from '@wix/web-methods';
import { products } from '@wix/stores';

type Product = any;

interface ProductVariant {
  _id: string;
  sku?: string;
  variantOptions?: Array<{ option: string; value: string }>;
  [key: string]: any;
}

interface WixProduct extends Product {
  _id: string;
  sku?: string;
  name?: string;
  variants?: ProductVariant[];
  [key: string]: any;
}

// Define the structure of a SKU
interface ProductSku {
  id: string;
  sku: string;
  name: string;
  productId: string;
}

/**
 * Fetches all unique SKUs from the store's products and variants
 */
export const fetchProductSkus = webMethod(
  Permissions.Anyone,
  async (): Promise<{ success: boolean; skus: ProductSku[]; error?: string }> => {
    try {
      const { queryProducts } = products;

      if (!queryProducts) {
        throw new Error('Products API not available');
      }

      const result = await queryProducts()
        .limit(1000)
        .find();

      if (!result || !result.items) {
        throw new Error('No products found or invalid response');
      }

      const items = result.items.map(product => {
        const wixProduct = product as unknown as WixProduct;

        if (wixProduct.variants) {
          wixProduct.variants = wixProduct.variants.map(variant => ({
            ...variant,
            _id: variant._id || `${wixProduct._id}_${Math.random().toString(36).substr(2, 9)}`,
            sku: variant.sku || ''
          }));
        } else {
          wixProduct.variants = [{
            _id: `${wixProduct._id}_default`,
            sku: wixProduct.sku || '',
            variantOptions: []
          }];
        }

        return wixProduct;
      });

      const validItems = items.filter(Boolean) as WixProduct[];

      const skus: ProductSku[] = [];
      const skuSet = new Set<string>();

      for (const product of validItems) {
        try {
          if (product.sku && !skuSet.has(product.sku)) {
            skuSet.add(product.sku);
            skus.push({
              id: product._id,
              sku: product.sku,
              name: product.name || `Product ${product._id}`,
              productId: product._id
            });
          }

          if (product.variants) {
            for (const variant of product.variants) {
              try {
                if (variant.sku && !skuSet.has(variant.sku)) {
                  skuSet.add(variant.sku);
                  skus.push({
                    id: variant._id,
                    sku: variant.sku,
                    name: product.name
                      ? `${product.name} ${variant.variantOptions?.map(opt => opt.value).join(' / ') || ''}`.trim()
                      : `Variant ${variant._id}`,
                    productId: product._id
                  });
                }
              } catch (variantError) {
                console.error(`Error processing variant ${variant._id} for product ${product._id}:`, variantError);
              }
            }
          }
        } catch (productError) {
          console.error(`Error processing product ${product._id}:`, productError);
        }
      }

      return {
        success: true,
        skus,
      };
    } catch (error) {
      return {
        success: false,
        skus: [],
        error: error instanceof Error ? error.message : 'Unknown error fetching SKUs',
      };
    }
  }
);

// Export all product-related methods
export default {
  fetchProductSkus
};
