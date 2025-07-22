// src/backend/api/extended-fields/api.ts
import { extendedFields } from '@wix/crm';

// Helper function to get CORS headers for production and development
function getCorsHeaders(request: Request) {
    const origin = request.headers.get('origin');

    // For development: allow localhost origins
    if (origin?.includes('localhost') || origin?.includes('127.0.0.1')) {
        return {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Credentials': 'true',
            'Content-Type': 'application/json'
        };
    }

    // For production: allow specific Wix origins
    if (origin?.includes('.wix.run') || origin?.includes('wixstudio.io') || origin?.includes('.wixsite.com')) {
        return {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Credentials': 'true',
            'Content-Type': 'application/json'
        };
    }

    // Default fallback (should handle most Wix cases)
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };
}

export async function POST(request: Request) {
    const corsHeaders = getCorsHeaders(request);

    try {
        const { fieldKeys } = await request.json();

        if (!fieldKeys || !Array.isArray(fieldKeys)) {
            return new Response(
                JSON.stringify({ error: 'Invalid fieldKeys parameter' }),
                {
                    status: 400,
                    headers: corsHeaders
                }
            );
        }

        // Query all extended fields
        const queryResults = await extendedFields.queryExtendedFields()
            .limit(200)
            .find();

        const allFields = queryResults.items;

        const relevantFields = allFields.filter(field => {
            return fieldKeys.some(requestedKey => {
                // Exact match
                if (field?.key === requestedKey) return true;

                // Match the end part (e.g., 'form_field_e391' matches 'e391')
                const fieldKeyEnd = field?.key?.split('.').pop() || '';
                if (requestedKey.endsWith(fieldKeyEnd) && fieldKeyEnd.length > 0) return true;

                // Match if the field key ends with the requested key
                if (field?.key?.endsWith(requestedKey)) return true;

                // Match if the requested key contains the field key
                if (requestedKey.includes(field?.key)) return true;

                // Special handling for form fields
                if (requestedKey.includes('form_field_') && field?.key?.includes(requestedKey.replace('form_field_', ''))) return true;

                return false;
            });
        });

        const result = {
            items: relevantFields,
            requestedKeys: fieldKeys,
            foundKeys: relevantFields.map(field => field.key),
            totalAvailable: allFields.length,
            debug: {
                origin: request.headers.get('origin'),
                userAgent: request.headers.get('user-agent'),
                corsHeadersApplied: Object.keys(corsHeaders)
            }
        };

        return new Response(
            JSON.stringify(result),
            {
                status: 200,
                headers: corsHeaders
            }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({
                error: 'Failed to fetch extended field definitions',
                details: error instanceof Error ? error.message : 'Unknown error',
                debug: {
                    origin: request.headers.get('origin'),
                    corsHeadersApplied: Object.keys(corsHeaders)
                }
            }),
            {
                status: 500,
                headers: corsHeaders
            }
        );
    }
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS(request: Request) {
    const corsHeaders = getCorsHeaders(request);

    return new Response(null, {
        status: 200,
        headers: {
            ...corsHeaders,
            'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
        },
    });
}