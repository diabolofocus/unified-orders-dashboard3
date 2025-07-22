// src/hooks/useFieldDefinitions.ts
import { useState, useEffect, useRef } from 'react';
import { getCustomFieldDefinitions } from '../../backend/field-service';

interface FieldDefinition {
    key: string;
    displayName: string;
    fieldType: string;
    namespace: string;
    description?: string;
    type?: string;
    options?: any[];
}

interface UseFieldDefinitionsResult {
    fieldDefinitions: FieldDefinition[];
    loading: boolean;
    error: string | null;
    getFieldDisplayName: (fieldKey: string) => string;
    refreshDefinitions: () => Promise<void>;
}

// Cache for field definitions to avoid repeated API calls
let cachedDefinitions: FieldDefinition[] | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useFieldDefinitions = (): UseFieldDefinitionsResult => {
    const [fieldDefinitions, setFieldDefinitions] = useState<FieldDefinition[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const hasInitialized = useRef(false);

    const fetchFieldDefinitions = async () => {
        // Check cache first
        const now = Date.now();
        if (cachedDefinitions && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
            console.log('📋 Using cached field definitions');
            setFieldDefinitions(cachedDefinitions);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            console.log('📋 Fetching field definitions from backend...');
            const result = await getCustomFieldDefinitions();

            if (result.success) {
                const definitions = result.fieldDefinitions || [];
                setFieldDefinitions(definitions);

                // Update cache
                cachedDefinitions = definitions;
                cacheTimestamp = now;
            } else {
                const errorMsg = result.error || 'Failed to fetch field definitions';
                setError(errorMsg);
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    // Initialize on mount
    useEffect(() => {
        if (!hasInitialized.current) {
            hasInitialized.current = true;
            fetchFieldDefinitions();
        }
    }, []);

    // Function to get display name for a field key
    const getFieldDisplayName = (fieldKey: string): string => {
        const definition = fieldDefinitions.find(def => def.key === fieldKey);

        if (definition?.displayName) {
            return definition.displayName;
        }

        // Fallback: Convert field key to readable format
        return fieldKey
            .replace(/^form_field_/i, '')
            .replace(/_/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/\b\w/g, l => l.toUpperCase());
    };

    const refreshDefinitions = async () => {
        // Clear cache and refetch
        cachedDefinitions = null;
        cacheTimestamp = null;
        await fetchFieldDefinitions();
    };

    return {
        fieldDefinitions,
        loading,
        error,
        getFieldDisplayName,
        refreshDefinitions
    };
};