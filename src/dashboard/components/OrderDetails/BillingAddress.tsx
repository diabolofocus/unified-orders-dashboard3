// components/OrderDetails/BillingAddress.tsx
import React from 'react';
import { Box, Text } from '@wix/design-system';
import { useOrderController } from '../../hooks/useOrderController';
import { settingsStore } from '../../stores/SettingsStore';
import { getCountryName } from '../../utils/country-mapper';
import type { Order } from '../../types/Order';

interface BillingAddressProps {
    order: Order;
}

const getBillingInfo = (order: Order) => {
    // Try to get billing info from different possible locations
    if (order.billingInfo) return order.billingInfo;
    if (order.rawOrder?.billingInfo) return order.rawOrder.billingInfo;
    return null;
};

const getShippingAddress = (order: Order) => {
    // Try to get shipping address from different possible locations
    if (order.shippingAddress) return order.shippingAddress;
    if (order.rawOrder?.shippingInfo?.shipmentDetails?.address) return order.rawOrder.shippingInfo.shipmentDetails.address;
    if (order.rawOrder?.recipientInfo?.address) return order.rawOrder.recipientInfo.address;
    if (order.rawOrder?.recipientInfo?.contactDetails?.address) return order.rawOrder.recipientInfo.contactDetails.address;
    return null;
};

// Function to normalize and compare addresses
const compareAddresses = (billingAddress: any, shippingAddress: any): boolean => {
    if (!billingAddress || !shippingAddress) return false;

    // Helper function to normalize string values for comparison
    const normalize = (str: string | undefined | null): string => {
        return (str || '').toLowerCase().trim().replace(/\s+/g, ' ');
    };

    // Helper function to get street address string
    const getStreetString = (address: any): string => {
        if (address.streetAddress?.name || address.streetAddress?.number) {
            return normalize(`${address.streetAddress?.name || ''} ${address.streetAddress?.number || ''}`);
        }
        return normalize(address.addressLine1 || '');
    };

    // Helper function to get apartment/unit string
    const getApartmentString = (address: any): string => {
        if (address.streetAddress?.apt) {
            return normalize(address.streetAddress.apt);
        }
        return normalize(address.addressLine2 || '');
    };

    // Compare key address components
    const billingStreet = getStreetString(billingAddress);
    const shippingStreet = getStreetString(shippingAddress);

    const billingApartment = getApartmentString(billingAddress);
    const shippingApartment = getApartmentString(shippingAddress);

    const billingCity = normalize(billingAddress.city);
    const shippingCity = normalize(shippingAddress.city);

    const billingPostal = normalize(billingAddress.postalCode);
    const shippingPostal = normalize(shippingAddress.postalCode);

    const billingCountry = normalize(billingAddress.country);
    const shippingCountry = normalize(shippingAddress.country);

    const streetsMatch = billingStreet === shippingStreet && billingStreet !== '';
    const apartmentsMatch = billingApartment === shippingApartment;
    const citiesMatch = billingCity === shippingCity && billingCity !== '';
    const postalMatch = billingPostal === shippingPostal && billingPostal !== '';
    const countriesMatch = billingCountry === shippingCountry && billingCountry !== '';

    const isMatch = streetsMatch && apartmentsMatch && citiesMatch && postalMatch && countriesMatch;

    return isMatch;
};

export const BillingAddress: React.FC<BillingAddressProps> = ({ order }) => {
    const orderController = useOrderController();
    const billingInfo = getBillingInfo(order);
    const shippingAddress = getShippingAddress(order);

    if (!billingInfo || !billingInfo.address) {
        return (
            <Box gap="6px" direction="vertical">
                <Text size="small" className="section-title">Billing Address:</Text>
                <Text size="tiny" secondary>No billing address available</Text>
            </Box>
        );
    }

    const address = billingInfo.address;
    const contactDetails = billingInfo.contactDetails;

    // Check if billing address is the same as shipping address
    const isSameAsShipping = compareAddresses(address, shippingAddress);

    return (
        <Box gap="6px" direction="vertical">
            <Text size="small" className="section-title">Billing Address:</Text>

            {/* Show "Same as shipping" if addresses match */}
            {isSameAsShipping ? (
                <Box gap="4px" direction="vertical">
                    <Text
                        size="small"
                        style={{
                            fontStyle: 'italic',
                            color: '#666666',
                            cursor: settingsStore.clickToCopyEnabled ? 'pointer' : 'default'
                        }}
                        className={settingsStore.clickToCopyEnabled ? 'clickable-info' : ''}
                        onClick={() => {
                            if (!settingsStore.clickToCopyEnabled) return;

                            const fullAddress = [
                                contactDetails?.firstName && contactDetails?.lastName ?
                                    `${contactDetails.firstName} ${contactDetails.lastName}` : '',
                                address.streetAddress?.name && address.streetAddress?.number ?
                                    `${address.streetAddress.name} ${address.streetAddress.number}` : address.addressLine1,
                                address.streetAddress?.apt || address.addressLine2,
                                `${address.postalCode || ''} ${address.city || ''}`.trim(),
                                address.subdivisionFullname || address.subdivision,
                                address.countryFullname || getCountryName(address.country)
                            ].filter(Boolean).join(', ');

                            orderController.copyToClipboard(fullAddress, 'Billing Address (Same as Shipping)');
                        }}
                    >
                        Same as shipping
                    </Text>
                </Box>
            ) : (
                /* Show full billing address if different from shipping */
                <Box gap="8px" direction="vertical">
                    {/* Contact Details */}
                    {contactDetails && (
                        <Box gap="8px" direction="vertical">
                            {/* Name */}
                            {(contactDetails.firstName || contactDetails.lastName) && (
                                <Text
                                    size="small"
                                    className="clickable-info"
                                    onClick={() => {
                                        const fullName = `${contactDetails.firstName || ''} ${contactDetails.lastName || ''}`.trim();
                                        if (settingsStore.clickToCopyEnabled) {
                                            orderController.copyToClipboard(fullName, 'Billing Name');
                                        }
                                    }}
                                >
                                    {`${contactDetails.firstName || ''} ${contactDetails.lastName || ''}`.trim()}
                                </Text>
                            )}

                            {/* Company */}
                            {contactDetails.company && (
                                <Text
                                    size="small"
                                    className={settingsStore.clickToCopyEnabled ? 'clickable-info' : ''}
                                    onClick={() => {
                                        if (settingsStore.clickToCopyEnabled) {
                                            orderController.copyToClipboard(contactDetails.company, 'Billing Company');
                                        }
                                    }}
                                    style={{
                                        cursor: settingsStore.clickToCopyEnabled ? 'pointer' : 'default',
                                        color: settingsStore.clickToCopyEnabled ? 'inherit' : 'var(--text-color, #2B2B2B)'
                                    }}
                                >
                                    {contactDetails.company}
                                </Text>
                            )}

                            {/* Phone */}
                            {contactDetails.phone && (
                                <Text
                                    size="small"
                                    className={settingsStore.clickToCopyEnabled ? 'clickable-info' : ''}
                                    onClick={() => {
                                        if (settingsStore.clickToCopyEnabled) {
                                            orderController.copyToClipboard(contactDetails.phone, 'Billing Phone');
                                        }
                                    }}
                                    style={{
                                        cursor: settingsStore.clickToCopyEnabled ? 'pointer' : 'default',
                                        color: settingsStore.clickToCopyEnabled ? 'inherit' : 'var(--text-color, #2B2B2B)'
                                    }}
                                >
                                    {contactDetails.phone}
                                </Text>
                            )}

                            {/* VAT ID (for Brazil) */}
                            {contactDetails.vatId && (
                                <Text
                                    size="small"
                                    className={settingsStore.clickToCopyEnabled ? 'clickable-info' : ''}
                                    onClick={() => {
                                        if (settingsStore.clickToCopyEnabled) {
                                            orderController.copyToClipboard(contactDetails.vatId._id, 'VAT ID');
                                        }
                                    }}
                                    style={{
                                        cursor: settingsStore.clickToCopyEnabled ? 'pointer' : 'default',
                                        color: settingsStore.clickToCopyEnabled ? 'inherit' : 'var(--text-color, #2B2B2B)'
                                    }}
                                >
                                    VAT ID: {contactDetails.vatId._id} ({contactDetails.vatId.type})
                                </Text>
                            )}
                        </Box>
                    )}

                    {/* Street Name and Number */}
                    {(address.streetAddress?.name || address.streetAddress?.number) && (
                        <Text
                            size="small"
                            className="clickable-info"
                            onClick={() => {
                                const streetAddress = `${address.streetAddress?.name || ''} ${address.streetAddress?.number || ''}`.trim();
                                if (settingsStore.clickToCopyEnabled) {
                                    orderController.copyToClipboard(streetAddress, 'Billing Street Address');
                                }
                            }}
                        >
                            {`${address.streetAddress?.name || ''} ${address.streetAddress?.number || ''}`.trim()}
                        </Text>
                    )}

                    {/* Apartment/Unit Number */}
                    {address.streetAddress?.apt && (
                        <Text
                            size="small"
                            className={settingsStore.clickToCopyEnabled ? 'clickable-info' : ''}
                            onClick={() => {
                                if (settingsStore.clickToCopyEnabled) {
                                    orderController.copyToClipboard(address.streetAddress!.apt, 'Billing Apartment/Unit');
                                }
                            }}
                            style={{
                                cursor: settingsStore.clickToCopyEnabled ? 'pointer' : 'default',
                                color: settingsStore.clickToCopyEnabled ? 'inherit' : 'var(--text-color, #2B2B2B)'
                            }}
                        >
                            {address.streetAddress.apt}
                        </Text>
                    )}

                    {/* Fallback to addressLine1/addressLine2 for older structure */}
                    {!address.streetAddress?.name && address.addressLine1 && (
                        <Text
                            size="small"
                            className={settingsStore.clickToCopyEnabled ? 'clickable-info' : ''}
                            onClick={() => {
                                if (settingsStore.clickToCopyEnabled) {
                                    orderController.copyToClipboard(address.addressLine1, 'Billing Street Address');
                                }
                            }}
                            style={{
                                cursor: settingsStore.clickToCopyEnabled ? 'pointer' : 'default',
                                color: settingsStore.clickToCopyEnabled ? 'inherit' : 'var(--text-color, #2B2B2B)'
                            }}
                        >
                            {address.addressLine1}
                        </Text>
                    )}

                    {address.addressLine2 && (
                        <Text
                            size="small"
                            className={settingsStore.clickToCopyEnabled ? 'clickable-info' : ''}
                            onClick={() => {
                                if (settingsStore.clickToCopyEnabled) {
                                    orderController.copyToClipboard(address.addressLine2, 'Billing Address Line 2');
                                }
                            }}
                            style={{
                                cursor: settingsStore.clickToCopyEnabled ? 'pointer' : 'default',
                                color: settingsStore.clickToCopyEnabled ? 'inherit' : 'var(--text-color, #2B2B2B)'
                            }}
                        >
                            {address.addressLine2}
                        </Text>
                    )}

                    {/* City and Postal Code */}
                    {(address.city || address.postalCode) && (
                        <Box direction="horizontal" gap="8px" align="left">
                            {address.postalCode && (
                                <Text
                                    size="small"
                                    className={settingsStore.clickToCopyEnabled ? 'clickable-info' : ''}
                                    onClick={() => {
                                        if (settingsStore.clickToCopyEnabled) {
                                            orderController.copyToClipboard(address.postalCode, 'Billing Postal Code');
                                        }
                                    }}
                                    style={{
                                        cursor: settingsStore.clickToCopyEnabled ? 'pointer' : 'default',
                                        color: settingsStore.clickToCopyEnabled ? 'inherit' : 'var(--text-color, #2B2B2B)'
                                    }}
                                >
                                    {address.postalCode}
                                </Text>
                            )}

                            {address.city && (
                                <Text
                                    size="small"
                                    className={settingsStore.clickToCopyEnabled ? 'clickable-info' : ''}
                                    onClick={() => {
                                        if (settingsStore.clickToCopyEnabled) {
                                            orderController.copyToClipboard(address.city, 'Billing City');
                                        }
                                    }}
                                    style={{
                                        cursor: settingsStore.clickToCopyEnabled ? 'pointer' : 'default',
                                        color: settingsStore.clickToCopyEnabled ? 'inherit' : 'var(--text-color, #2B2B2B)'
                                    }}
                                >
                                    {address.city}
                                </Text>
                            )}
                        </Box>
                    )}

                    {/* State/Province */}
                    {(address.subdivision || address.subdivisionFullname) && (
                        <Text
                            size="small"
                            className="clickable-info"
                            onClick={() => {
                                const subdivision = address.subdivisionFullname || address.subdivision;
                                if (settingsStore.clickToCopyEnabled) {
                                    orderController.copyToClipboard(subdivision, 'Billing State/Province');
                                }
                            }}
                        >
                            {address.subdivisionFullname || address.subdivision}
                        </Text>
                    )}

                    {/* Country */}
                    {address.country && (
                        <Text
                            size="small"
                            className="clickable-info"
                            onClick={() => {
                                const countryName = address.countryFullname || getCountryName(address.country);
                                if (settingsStore.clickToCopyEnabled) {
                                    orderController.copyToClipboard(countryName, 'Billing Country');
                                }
                            }}
                        >
                            {address.countryFullname || getCountryName(address.country)}
                        </Text>
                    )}
                </Box>
            )}
        </Box>
    );
};