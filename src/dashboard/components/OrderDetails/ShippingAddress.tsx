// components/OrderDetails/ShippingAddress.tsx
import React from 'react';
import { Box, Text, TextButton, Divider } from '@wix/design-system';
import { useOrderController } from '../../hooks/useOrderController';
import { settingsStore } from '../../stores/SettingsStore';
import { getCountryName } from '../../utils/country-mapper';
import type { Order, ShippingAddress as ShippingAddressType } from '../../types/Order';

interface ShippingAddressProps {
  order: Order;
}

const getShippingAddress = (order: Order): ShippingAddressType | null => {
  if (order.shippingAddress) return order.shippingAddress;
  if (order.rawOrder?.shippingInfo?.shipmentDetails?.address) return order.rawOrder.shippingInfo.shipmentDetails.address;
  if (order.rawOrder?.recipientInfo?.contactDetails?.address) return order.rawOrder.recipientInfo.contactDetails.address;
  if (order.billingInfo?.address) return order.billingInfo.address;
  return null;
};

export const ShippingAddress: React.FC<ShippingAddressProps> = ({ order }) => {
  const orderController = useOrderController();
  const shippingAddress = getShippingAddress(order);

  if (!shippingAddress) {
    return (
      <Box gap="6px" direction="vertical">
        <Text size="small" className="section-title">Shipping Address:</Text>
        <Text size="tiny" secondary>No shipping address available</Text>
      </Box>
    );
  }

  return (
    <Box gap="6px" direction="vertical">


      <Text size="small" className="section-title">Shipping Address:</Text>

      {/* Recipient Name */}
      {(order.rawOrder?.recipientInfo?.contactDetails?.firstName || order.rawOrder?.recipientInfo?.contactDetails?.lastName) && (
        <Text
          size="small"
          className={settingsStore.clickToCopyEnabled ? 'clickable-info' : ''}
          style={{
            cursor: settingsStore.clickToCopyEnabled ? 'pointer' : 'default',
            color: settingsStore.clickToCopyEnabled ? 'inherit' : 'var(--text-color, #2B2B2B)'
          }}
          onClick={() => {
            if (!settingsStore.clickToCopyEnabled) return;
            const recipientName = `${order.rawOrder?.recipientInfo?.contactDetails?.firstName || ''} ${order.rawOrder?.recipientInfo?.contactDetails?.lastName || ''}`.trim();
            orderController.copyToClipboard(recipientName, 'Recipient Name', false);
          }}
        >
          {`${order.rawOrder?.recipientInfo?.contactDetails?.firstName || ''} ${order.rawOrder?.recipientInfo?.contactDetails?.lastName || ''}`.trim()}
        </Text>
      )}

      {/* Street Name and Number */}
      {(shippingAddress.streetAddress?.name || shippingAddress.streetAddress?.number) && (
        <Text
          size="small"
          className={settingsStore.clickToCopyEnabled ? 'clickable-info' : ''}
          style={{
            cursor: settingsStore.clickToCopyEnabled ? 'pointer' : 'default',
            color: settingsStore.clickToCopyEnabled ? 'inherit' : 'var(--text-color, #2B2B2B)'
          }}
          onClick={() => {
            if (!settingsStore.clickToCopyEnabled) return;
            const streetAddress = `${shippingAddress.streetAddress?.name || ''} ${shippingAddress.streetAddress?.number || ''}`.trim();
            orderController.copyToClipboard(streetAddress, 'Street Address', false);
          }}
        >
          {`${shippingAddress.streetAddress?.name || ''} ${shippingAddress.streetAddress?.number || ''}`.trim()}
        </Text>
      )}

      {/* Apartment/Unit Number */}
      {shippingAddress.streetAddress?.apt && (
        <Text
          size="small"
          className={settingsStore.clickToCopyEnabled ? 'clickable-info' : ''}
          style={{
            cursor: settingsStore.clickToCopyEnabled ? 'pointer' : 'default',
            color: settingsStore.clickToCopyEnabled ? 'inherit' : 'var(--text-color, #2B2B2B)'
          }}
          onClick={() => {
            if (!settingsStore.clickToCopyEnabled) return;
            orderController.copyToClipboard(shippingAddress.streetAddress!.apt, 'Apartment/Unit', false);
          }}
        >
          {shippingAddress.streetAddress.apt}
        </Text>
      )}

      {/* Fallback to addressLine1/addressLine2 for older structure */}
      {!shippingAddress.streetAddress?.name && shippingAddress.addressLine1 && (
        <Text
          size="small"
          className={settingsStore.clickToCopyEnabled ? 'clickable-info' : ''}
          style={{
            cursor: settingsStore.clickToCopyEnabled ? 'pointer' : 'default',
            color: settingsStore.clickToCopyEnabled ? 'inherit' : 'var(--text-color, #2B2B2B)'
          }}
          onClick={() => {
            if (!settingsStore.clickToCopyEnabled) return;
            orderController.copyToClipboard(shippingAddress.addressLine1, 'Street Address', false);
          }}
        >
          {shippingAddress.addressLine1}
        </Text>
      )}

      {shippingAddress.addressLine2 && (
        <Text
          size="small"
          className={settingsStore.clickToCopyEnabled ? 'clickable-info' : ''}
          style={{
            cursor: settingsStore.clickToCopyEnabled ? 'pointer' : 'default',
            color: settingsStore.clickToCopyEnabled ? 'inherit' : 'var(--text-color, #2B2B2B)'
          }}
          onClick={() => {
            if (!settingsStore.clickToCopyEnabled) return;
            orderController.copyToClipboard(shippingAddress.addressLine2, 'Address Line 2', false);
          }}
        >
          {shippingAddress.addressLine2}
        </Text>
      )}

      {/* City and Postal Code */}
      {(shippingAddress.city || shippingAddress.postalCode) && (
        <Box direction="horizontal" gap="8px" align="left">
          {shippingAddress.postalCode && (
            <Text
              size="small"
              className={settingsStore.clickToCopyEnabled ? 'clickable-info' : ''}
              style={{
                cursor: settingsStore.clickToCopyEnabled ? 'pointer' : 'default',
                color: settingsStore.clickToCopyEnabled ? 'inherit' : 'var(--text-color, #2B2B2B)'
              }}
              onClick={() => orderController.copyToClipboard(shippingAddress.postalCode, 'Postal Code', false)}
            >
              {shippingAddress.postalCode}
            </Text>
          )}

          {shippingAddress.city && (
            <Text
              size="small"
              className={settingsStore.clickToCopyEnabled ? 'clickable-info' : ''}
              style={{
                cursor: settingsStore.clickToCopyEnabled ? 'pointer' : 'default',
                color: settingsStore.clickToCopyEnabled ? 'inherit' : 'var(--text-color, #2B2B2B)'
              }}
              onClick={() => orderController.copyToClipboard(shippingAddress.city, 'City', false)}
            >
              {shippingAddress.city}
            </Text>
          )}
        </Box>
      )}

      {/* State/Province */}
      {(shippingAddress.subdivision || shippingAddress.subdivisionFullname) && (
        <Text
          size="small"
          className={settingsStore.clickToCopyEnabled ? 'clickable-info' : ''}
          style={{
            cursor: settingsStore.clickToCopyEnabled ? 'pointer' : 'default',
            color: settingsStore.clickToCopyEnabled ? 'inherit' : 'var(--text-color, #2B2B2B)'
          }}
          onClick={() => {
            if (!settingsStore.clickToCopyEnabled) return;
            const subdivision = shippingAddress.subdivisionFullname || shippingAddress.subdivision;
            orderController.copyToClipboard(subdivision, 'State/Province', false);
          }}
        >
          {shippingAddress.subdivisionFullname || shippingAddress.subdivision}
        </Text>
      )}

      {/* Country */}
      {shippingAddress.country && (
        <Text
          size="small"
          className={settingsStore.clickToCopyEnabled ? 'clickable-info' : ''}
          style={{
            cursor: settingsStore.clickToCopyEnabled ? 'pointer' : 'default',
            color: settingsStore.clickToCopyEnabled ? 'inherit' : 'var(--text-color, #2B2B2B)'
          }}
          onClick={() => {
            if (!settingsStore.clickToCopyEnabled) return;
            const countryName = shippingAddress.countryFullname || getCountryName(shippingAddress.country);
            orderController.copyToClipboard(countryName, 'Country', false);
          }}
        >
          {shippingAddress.countryFullname || getCountryName(shippingAddress.country)}
        </Text>
      )}

      {/* View Map Button */}
      {(shippingAddress.city && shippingAddress.postalCode && (shippingAddress.streetAddress?.name || shippingAddress.addressLine1)) && (
        <Box marginTop={0}>
          <TextButton
            as="a"
            href={`https://www.google.com/maps?q=${encodeURIComponent(
              [
                shippingAddress.city,
                shippingAddress.postalCode,
                shippingAddress.streetAddress?.name || shippingAddress.addressLine1,
                shippingAddress.streetAddress?.number
              ].filter(Boolean).join('+')
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            underline="none"
            style={{
              color: '#2B7FF2',
              padding: '4px 0',
              textDecoration: 'none',
              display: 'inline-block'
            }}
          >
            View Map
          </TextButton>
        </Box>
      )}
    </Box>
  );
};