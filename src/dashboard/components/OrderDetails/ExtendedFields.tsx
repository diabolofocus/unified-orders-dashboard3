// components/OrderDetails/ExtendedFields.tsx - SIMPLE VERSION
import React from 'react';
import { Box, Divider, Text } from '@wix/design-system';
import { useOrderController } from '../../hooks/useOrderController';
import { settingsStore } from '../../stores/SettingsStore';
import type { Order } from '../../types/Order';

interface ExtendedFieldsProps {
    order: Order;
}

const getExtendedFieldsData = (order: Order) => {

    let customFields = null;

    if (Array.isArray(order.customFields) && order.customFields.length > 0) {
        customFields = order.customFields;
    } else if (Array.isArray(order.rawOrder?.customFields) && order.rawOrder.customFields.length > 0) {
        customFields = order.rawOrder.customFields;
    }

    // Get extended fields - focus on namespaces structure
    let extendedFields = null;
    if (order.extendedFields?.namespaces) {
        extendedFields = order.extendedFields;
    } else if (order.rawOrder?.extendedFields?.namespaces) {
        extendedFields = order.rawOrder.extendedFields;
    }

    return {
        customFields,
        extendedFields
    };
};

// Simple static mapping for your field names - UPDATE THIS WITH YOUR FIELDS
const getFieldDisplayName = (fieldKey: string): string => {
    // Add your known field mappings here
    const fieldNameMappings: Record<string, string> = {
        'form_field_e391': 'Invoice',
        'form_field_e392': 'Delivery Notes',
        'form_field_e393': 'Special Instructions',
        // Add more mappings as you discover them from console logs
    };

    if (fieldNameMappings[fieldKey]) {
        return fieldNameMappings[fieldKey];
    }

    // Fallback: Convert field key to readable format
    return fieldKey
        .replace(/^form_field_/i, '')
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, l => l.toUpperCase());
};

// Function to translate values to user-friendly format
const translateFieldValue = (value: any, fieldKey?: string): string => {
    if (value === null || value === undefined) {
        return 'N/A';
    }

    // Handle boolean values - THIS FIXES YOUR true/false ISSUE
    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }

    // Handle numbers
    if (typeof value === 'number') {
        return String(value);
    }

    // Handle dates
    if (value instanceof Date) {
        return value.toLocaleDateString();
    }

    // Handle strings
    if (typeof value === 'string') {
        return value;
    }

    // Handle objects/arrays
    if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
    }

    return String(value);
};

export const ExtendedFields: React.FC<ExtendedFieldsProps> = ({ order }) => {
    const orderController = useOrderController();
    const { customFields, extendedFields } = getExtendedFieldsData(order);

    // Debug custom fields - remove this after testing
    console.log('ExtendedFields Debug - Custom Fields:', {
        orderCustomFields: order.customFields,
        rawOrderCustomFields: order.rawOrder?.customFields,
        extractedCustomFields: customFields,
        hasArrayCustomFields: Array.isArray(customFields) && customFields.length > 0
    });

    const hasArrayCustomFields = Array.isArray(customFields) && customFields.length > 0;
    const hasExtendedFields = extendedFields?.namespaces && Object.keys(extendedFields.namespaces).length > 0;
    const hasBuyerNote = !!(order.buyerNote || order.rawOrder?.buyerNote);

    // Show the section if we have any kind of additional info
    if (!hasArrayCustomFields && !hasExtendedFields && !hasBuyerNote) {
        return null;
    }

    const handleCustomFieldClick = (fieldName: string, fieldValue: any) => {
        if (!settingsStore.clickToCopyEnabled) return;
        const translatedValue = translateFieldValue(fieldValue);
        orderController.copyToClipboard(translatedValue, fieldName);
    };

    const handleArrayCustomFieldClick = (field: any) => {
        if (!settingsStore.clickToCopyEnabled) return;
        const fieldTitle = field.translatedTitle || field.title || 'Custom Field';
        let displayValue = '';

        // Handle direct string value (common case)
        if (typeof field.value === 'string') {
            displayValue = field.value;
        } else if (field.value?.stringValue !== undefined) {
            displayValue = field.value.stringValue;
        } else if (field.value?.numberValue !== undefined) {
            displayValue = String(field.value.numberValue);
        } else if (field.value?.booleanValue !== undefined) {
            displayValue = field.value.booleanValue ? 'Yes' : 'No';
        } else if (field.value?.dateValue !== undefined) {
            displayValue = field.value.dateValue;
        } else {
            displayValue = translateFieldValue(field.value);
        }

        orderController.copyToClipboard(displayValue, fieldTitle);
    };

    return (
        <Box gap="8px" direction="vertical">
            <Divider />
            {/* <Text size="small" className="section-title">Additional Info:</Text> */}

            {/* Buyer Note */}
            {hasBuyerNote && (
                <Box gap="4px" direction="vertical" marginTop="8px">
                    <Text size="small" className="section-title">
                        Buyer Note:
                    </Text>
                    <Text
                        size="small"
                        className={settingsStore.clickToCopyEnabled ? 'clickable-info' : ''}
                        onClick={() => {
                            if (settingsStore.clickToCopyEnabled) {
                                const buyerNoteText = order.buyerNote || order.rawOrder?.buyerNote || '';
                                orderController.copyToClipboard(buyerNoteText, 'Buyer Note');
                            }
                        }}
                        style={{
                            paddingLeft: '8px',
                            borderLeft: '2px solid #3b82f6',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            cursor: settingsStore.clickToCopyEnabled ? 'pointer' : 'default',
                            color: settingsStore.clickToCopyEnabled ? 'inherit' : 'var(--text-color, #2B2B2B)'
                        }}
                    >
                        {order.buyerNote || order.rawOrder?.buyerNote}
                    </Text>
                </Box>
            )}

            {/* Array-style Custom Fields (ecom orders structure) */}
            {hasArrayCustomFields && (
                <Box gap="12px" direction="vertical" marginTop="8px">
                    {/* <Text size="small" underline secondary>Custom Fields:</Text> */}
                    {customFields.map((field: any, index: number) => {
                        console.log(`Custom Field ${index}:`, field);

                        const fieldTitle = field.translatedTitle || field.title || `Field ${index + 1}`;

                        let displayValue = '';
                        // Handle direct string value (common case)
                        if (typeof field.value === 'string') {
                            displayValue = field.value;
                        } else if (field.value?.stringValue !== undefined) {
                            displayValue = field.value.stringValue;
                        } else if (field.value?.numberValue !== undefined) {
                            displayValue = String(field.value.numberValue);
                        } else if (field.value?.booleanValue !== undefined) {
                            displayValue = field.value.booleanValue ? 'Yes' : 'No';
                        } else if (field.value?.dateValue !== undefined) {
                            displayValue = field.value.dateValue;
                        } else {
                            displayValue = translateFieldValue(field.value);
                        }

                        // Skip empty fields
                        if (!displayValue || displayValue.trim() === '') {
                            return null;
                        }

                        return (
                            <Box key={`custom-field-${index}`} gap="4px" direction="vertical">
                                <Text size="small" className="section-title">
                                    {fieldTitle}:
                                </Text>
                                <Text
                                    size="small"
                                    className={settingsStore.clickToCopyEnabled ? 'clickable-info' : ''}
                                    onClick={() => handleArrayCustomFieldClick(field)}
                                    style={{
                                        paddingLeft: '8px',
                                        borderLeft: '2px solid #3b82f6',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        cursor: settingsStore.clickToCopyEnabled ? 'pointer' : 'default',
                                        color: settingsStore.clickToCopyEnabled ? 'inherit' : 'var(--text-color, #2B2B2B)'
                                    }}
                                >
                                    {displayValue}
                                </Text>
                            </Box>
                        );
                    })}
                </Box>
            )}

            {/* Extended Fields Namespaces */}
            {hasExtendedFields && (
                <Box direction="vertical" gap="8px" marginTop="8px">
                    {Object.entries(extendedFields.namespaces).map(([namespace, fields]) => {

                        return (
                            <Box key={namespace} direction="vertical" gap="6px">
                                {typeof fields === 'object' && fields !== null && (
                                    <Box direction="vertical" gap="4px">
                                        {Object.entries(fields).map(([fieldKey, fieldValue]) => {

                                            // Use static mapping for field name
                                            const displayName = getFieldDisplayName(fieldKey);

                                            // Get the translated field value
                                            const translatedValue = translateFieldValue(fieldValue, fieldKey);


                                            return (
                                                <Box key={fieldKey} direction="vertical" gap="4px">
                                                    <Text size="small" className="section-title">
                                                        {displayName}:
                                                    </Text>
                                                    <Text
                                                        size="small"
                                                        className={settingsStore.clickToCopyEnabled ? 'clickable-info' : ''}
                                                        onClick={() => handleCustomFieldClick(displayName, fieldValue)}
                                                        style={{
                                                            paddingLeft: '8px',
                                                            whiteSpace: 'pre-wrap',
                                                            wordBreak: 'break-word',
                                                            cursor: settingsStore.clickToCopyEnabled ? 'pointer' : 'default',
                                                            color: settingsStore.clickToCopyEnabled ? 'inherit' : 'var(--text-color, #2B2B2B)'
                                                        }}
                                                    >
                                                        {translatedValue}
                                                    </Text>
                                                </Box>
                                            );
                                        })}
                                    </Box>
                                )}
                            </Box>
                        );
                    })}
                </Box>
            )}
        </Box>
    );
};