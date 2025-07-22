// src/backend/field-service.js
import { extendedFields } from '@wix/crm';

// Backend function to get all custom field definitions
export async function getCustomFieldDefinitions() {
    try {

        const queryResults = await extendedFields.queryExtendedFields().find();

        // Filter for user-defined custom fields and map to useful format
        const fieldDefinitions = queryResults.items
            .filter((field) => field.fieldType === 'USER_DEFINED')
            .map((field) => ({
                key: field.key,
                displayName: field.displayName || field.key,
                fieldType: field.fieldType,
                namespace: field.namespace || '_user_fields',
                description: field.description
            }));
        return {
            success: true,
            fieldDefinitions,
            count: fieldDefinitions.length
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            fieldDefinitions: []
        };
    }
}

// Backend function to get specific field definition by key
export async function getFieldDefinitionByKey(fieldKey: string) {
    try {
        const queryResults = await extendedFields
            .queryExtendedFields()
            .eq('key', fieldKey)
            .find();

        if (queryResults.items.length > 0) {
            const field = queryResults.items[0];
            return {
                success: true,
                fieldDefinition: {
                    key: field.key,
                    displayName: field.displayName || field.key,
                    fieldType: field.fieldType,
                    namespace: field.namespace || '_user_fields',
                    description: field.description
                }
            };
        }

        return {
            success: false,
            error: 'Field not found',
            fieldDefinition: null
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            fieldDefinition: null
        };
    }
}