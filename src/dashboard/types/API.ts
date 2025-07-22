// types/API.ts

// Base API response structure
export interface BaseApiResponse {
    success: boolean;
    message: string;
    error?: string;
}

// Pagination metadata
export interface PaginationMeta {
    hasNext: boolean;
    nextCursor: string;
    prevCursor: string;
    total?: number;
    limit?: number;
}

// API request parameters
export interface PaginatedRequest {
    limit?: number;
    cursor?: string;
}

// Wix API specific types
export interface WixOrdersApiResponse extends BaseApiResponse {
    method?: string;
    orders?: any[];
    orderCount?: number;
    pagination?: PaginationMeta;
    debugInfo?: {
        rawOrdersCount: number;
        firstRawOrder?: any;
        processedItemsWithImages: number;
    };
}

export interface WixFulfillmentApiResponse extends BaseApiResponse {
    method?: 'createFulfillment' | 'updateFulfillment';
    result?: any;
}

// Error response types
export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, any>;
}

export interface DetailedApiResponse extends BaseApiResponse {
    error?: string;
    errorCode?: string;
    errorDetails?: ApiError;
}

// Request/Response types for specific endpoints
export interface OrdersListRequest extends PaginatedRequest {
    status?: string[];
    dateFrom?: string;
    dateTo?: string;
    searchQuery?: string;
}

export interface FulfillOrderRequest {
    orderId: string;
    trackingNumber: string;
    shippingProvider: string;
    orderNumber: string;
    lineItems?: Array<{
        id: string;
        quantity: number;
    }>;
}

// Connection status for UI
export interface ConnectionStatus {
    success: boolean;
    message: string;
    lastUpdate?: Date;
    retryCount?: number;
}

// API configuration
export interface ApiConfig {
    timeout: number;
    retries: number;
    retryDelay: number;
    baseUrl?: string;
}

// Rate limiting
export interface RateLimitInfo {
    limit: number;
    remaining: number;
    resetTime: Date;
}

// API method signature helpers
export type BackendMethod<TParams = any, TResponse = any> = (params: TParams) => Promise<TResponse>;

export type ApiMethodCall<TParams, TResponse> = {
    method: string;
    params: TParams;
    response: TResponse;
};

// Common API operation types
export type ApiOperation = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'LIST';

export interface ApiMetrics {
    operation: ApiOperation;
    method: string;
    duration: number;
    success: boolean;
    timestamp: Date;
}

// Add these to your existing types/API.ts file

export interface SupportApiRequest {
    collectionId: string;
    dataItem: Record<string, any>;
}

export interface WixDataApiResponse extends BaseApiResponse {
    item?: any;
    items?: any[];
    _id?: string;
    _createdDate?: string;
    _updatedDate?: string;
}

export interface CollectionCreateRequest {
    collection: {
        id: string;
        displayName: string;
        fields: Array<{
            key: string;
            displayName: string;
            type: string;
            required?: boolean;
        }>;
        permissions: {
            insert: string;
            update: string;
            remove: string;
            read: string;
        };
    };
}

export interface SitePropertiesResponse extends BaseApiResponse {
    namespace?: string;
    properties?: Record<string, any>;
    siteId?: string;
}