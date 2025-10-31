import { useState, useEffect } from 'react';

interface ProductSku {
    id: string;
    sku: string;
    name: string;
    productId: string;
}

/**
 * Custom hook to fetch and manage SKUs from Wix Stores
 * @returns An object containing SKUs, loading state, error state, and a refresh function
 */
export const useSkus = () => {
    const [skus, setSkus] = useState<ProductSku[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    /**
     * Fetches SKUs from the backend
     */
    const fetchSkus = async () => {
        try {
            setLoading(true);
            setError(null);

            // Dynamically import the backend function
            const { fetchProductSkus } = await import('../../backend/products-api.web');

            // Call the backend function
            const response = await fetchProductSkus({});

            if (response.success) {
                setSkus(response.skus);
            } else {
                throw new Error(response.error || 'Failed to fetch SKUs');
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
            console.error('Error fetching SKUs:', errorMessage);
            setError(errorMessage);
            setSkus([]);
        } finally {
            setLoading(false);
        }
    };

    // Fetch SKUs on mount
    useEffect(() => {
        fetchSkus();
    }, []);

    return {
        skus,
        loading,
        error,
        refresh: fetchSkus
    };
};

export default useSkus;
