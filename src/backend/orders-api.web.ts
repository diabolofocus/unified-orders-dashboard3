// src/backend/orders-api.web.ts - ENHANCED with per-item fulfillment support

import { webMethod, Permissions } from '@wix/web-methods';
import { auth } from '@wix/essentials';
import { orderFulfillments, orders } from '@wix/ecom';
import { smartFulfillOrderElevated } from './fulfillment-elevated.web';

interface EmailInfo {
  emailRequested: boolean;
  emailSentAutomatically: boolean;
  emailSent?: boolean;
  customerEmail?: string;
  note: string;
  isTrackingUpdate?: boolean;
}

const safeGetItemQuantity = (item: any): number => {
  return item?.quantity || 1;
};

const safeGetFulfilledQuantity = (item: any): number => {
  return item?.fulfilledQuantity ||
    item?.fulfillmentDetails?.totalFulfilled ||
    item?.totalFulfilledQuantity ||
    0;
};

const safeGetRemainingQuantity = (item: any): number => {
  const total = safeGetItemQuantity(item);
  const fulfilled = safeGetFulfilledQuantity(item);
  return Math.max(0, total - fulfilled);
};

const safeGetItemId = (item: any): string => {
  return item?._id || item?.id || item?.lineItemId || '';
};

const safeGetProductName = (item: any): string => {
  if (typeof item?.productName === 'string') {
    return item.productName;
  }
  if (typeof item?.productName === 'object' && item?.productName?.original) {
    return item.productName.original;
  }
  if (item?.name) {
    return item.name;
  }
  return 'Unknown Product';
};

interface ItemFulfillment {
  id: string;
  quantity: number;
}

interface PerItemFulfillmentParams {
  orderId: string;
  trackingNumber: string;
  shippingProvider: string;
  orderNumber: string;
  sendShippingEmail?: boolean;
  selectedItems: ItemFulfillment[];
  editMode?: boolean;
  existingFulfillmentId?: string;
  trackingUrl?: string;
  customCarrierName?: string;
}

/**
 * Create fulfillment for specific items
 */
export const createPerItemFulfillment = webMethod(
  Permissions.Anyone,
  async (params: PerItemFulfillmentParams) => {
    try {
      const elevatedGetOrder = auth.elevate(orders.getOrder);
      const orderDetails = await elevatedGetOrder(params.orderId);

      if (!orderDetails || !orderDetails.lineItems?.length) {
        throw new Error(`Order ${params.orderNumber} not found or has no line items`);
      }

      // Enhanced carrier mapping
      const carrierMapping: Record<string, string> = {
        'dhl': 'dhl',
        'ups': 'ups',
        'fedex': 'fedex',
        'usps': 'usps',
        'canada-post': 'canadaPost',
        'royal-mail': 'royalMail',
        'other': 'other'
      };

      const mappedCarrier = carrierMapping[params.shippingProvider.toLowerCase()] || 'other';

      // Validate and prepare line items for fulfillment
      const orderItemMap = new Map();
      orderDetails.lineItems.forEach((item: any) => {
        const itemId = safeGetItemId(item);
        orderItemMap.set(itemId, item);
      });

      const fulfillmentLineItems: Array<{ _id: string; quantity: number }> = [];
      const invalidItems: string[] = [];

      for (const selectedItem of params.selectedItems) {
        const orderItem = orderItemMap.get(selectedItem.id);

        if (!orderItem) {
          invalidItems.push(`Item ${selectedItem.id} not found in order`);
          continue;
        }

        const remainingQuantity = safeGetRemainingQuantity(orderItem);

        if (selectedItem.quantity > remainingQuantity) {
          invalidItems.push(`Item ${selectedItem.id}: requested ${selectedItem.quantity} but only ${remainingQuantity} remaining`);
          continue;
        }

        fulfillmentLineItems.push({
          _id: selectedItem.id,
          quantity: selectedItem.quantity
        });
      }

      if (invalidItems.length > 0) {
        throw new Error(`Invalid items: ${invalidItems.join(', ')}`);
      }

      if (fulfillmentLineItems.length === 0) {
        throw new Error(`No valid items to fulfill`);
      }

      // Build tracking info object
      const trackingInfo: any = {
        trackingNumber: params.trackingNumber,
        shippingProvider: params.customCarrierName || mappedCarrier
      };

      // Add tracking link if provided
      if (params.trackingUrl) {
        trackingInfo.trackingLink = params.trackingUrl;
      }

      const fulfillmentData = {
        lineItems: fulfillmentLineItems,
        trackingInfo: trackingInfo,
        status: 'Fulfilled'
      };

      let fulfillmentResult;
      if (params.sendShippingEmail) {
        const elevatedCreateFulfillment = auth.elevate(orderFulfillments.createFulfillment);
        fulfillmentResult = await elevatedCreateFulfillment(params.orderId, fulfillmentData);
      } else {
        fulfillmentResult = await orderFulfillments.createFulfillment(params.orderId, fulfillmentData);
      }

      const isPartialFulfillment = fulfillmentLineItems.length < orderDetails.lineItems.length;

      return {
        success: true,
        method: 'createPerItemFulfillment',
        fulfillmentId: fulfillmentResult.fulfillmentId,
        message: isPartialFulfillment
          ? `Order ${params.orderNumber} partially fulfilled (${fulfillmentLineItems.length} items)`
          : `Order ${params.orderNumber} fulfilled successfully`,
        emailSent: !!params.sendShippingEmail,
        isPartialFulfillment,
        result: fulfillmentResult
      };

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ PER-ITEM: createPerItemFulfillment failed:`, error);

      return {
        success: false,
        error: errorMsg,
        message: `Failed to create per-item fulfillment for order ${params.orderNumber}: ${errorMsg}`,
        method: 'createPerItemFulfillment'
      };
    }
  }
);

/**
 * Update tracking for specific items
 */
export const updatePerItemTracking = webMethod(
  Permissions.Anyone,
  async ({
    orderId,
    fulfillmentId,
    trackingNumber,
    shippingProvider,
    orderNumber,
    sendShippingEmail = false,
    itemId
  }: {
    orderId: string;
    fulfillmentId?: string;
    trackingNumber: string;
    shippingProvider: string;
    orderNumber: string;
    sendShippingEmail?: boolean;
    itemId?: string;
  }) => {
    try {
      const carrierMapping: Record<string, string> = {
        'dhl': 'dhl',
        'ups': 'ups',
        'fedex': 'fedex',
        'usps': 'usps',
        'canada-post': 'canadaPost',
        'royal-mail': 'royalMail',
        'other': 'other'
      };

      const mappedCarrier = carrierMapping[shippingProvider.toLowerCase()] || 'other';

      if (fulfillmentId) {
        // Update existing fulfillment
        const identifiers = {
          orderId: orderId,
          fulfillmentId: fulfillmentId
        };

        const options = {
          fulfillment: {
            trackingInfo: {
              trackingNumber: trackingNumber,
              shippingProvider: mappedCarrier
            }
          }
        };

        let updateResult;
        if (sendShippingEmail) {
          const elevatedUpdateFulfillment = auth.elevate(orderFulfillments.updateFulfillment);
          updateResult = await elevatedUpdateFulfillment(identifiers, options);
        } else {
          updateResult = await orderFulfillments.updateFulfillment(identifiers, options);
        }

        return {
          success: true,
          method: 'updatePerItemTracking',
          message: `Tracking updated for order ${orderNumber}: ${trackingNumber}`,
          emailSent: !!sendShippingEmail,
          result: updateResult
        };
      } else {
        return await createPerItemFulfillment({
          orderId,
          trackingNumber,
          shippingProvider,
          orderNumber,
          sendShippingEmail,
          selectedItems: itemId ? [{ id: itemId, quantity: 1 }] : []
        });
      }

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ PER-ITEM: updatePerItemTracking failed:`, error);

      return {
        success: false,
        error: errorMsg,
        message: `Failed to update per-item tracking for order ${orderNumber}: ${errorMsg}`,
        method: 'updatePerItemTracking'
      };
    }
  }
);

/**
 * Get detailed fulfillment information
 */
export const getOrderFulfillmentDetails = webMethod(
  Permissions.Anyone,
  async ({
    orderId,
    orderNumber
  }: {
    orderId: string;
    orderNumber: string;
  }) => {
    try {
      const elevatedGetOrder = auth.elevate(orders.getOrder);
      const orderDetails = await elevatedGetOrder(orderId);

      if (!orderDetails) {
        throw new Error(`Order ${orderNumber} not found`);
      }

      // Get fulfillments
      const elevatedListFulfillments = auth.elevate(orderFulfillments.listFulfillmentsForSingleOrder);
      const fulfillmentsResponse = await elevatedListFulfillments(orderId);

      const fulfillments = fulfillmentsResponse?.orderWithFulfillments?.fulfillments || [];

      // Process line items with fulfillment details
      const lineItemsWithFulfillment = orderDetails.lineItems?.map((item: any) => {
        const itemId = safeGetItemId(item);
        const totalQuantity = safeGetItemQuantity(item);
        const fulfilledQuantity = safeGetFulfilledQuantity(item);
        const remainingQuantity = safeGetRemainingQuantity(item);

        return {
          ...item,
          itemId,
          totalQuantity,
          fulfilledQuantity,
          remainingQuantity,
          fulfillmentStatus: fulfilledQuantity >= totalQuantity ? 'FULFILLED' :
            fulfilledQuantity > 0 ? 'PARTIALLY_FULFILLED' : 'NOT_FULFILLED',
          canBeFulfilled: remainingQuantity > 0
        };
      }) || [];

      // Calculate overall order fulfillment status
      const totalItems = lineItemsWithFulfillment.reduce((sum, item) => sum + item.totalQuantity, 0);
      const totalFulfilled = lineItemsWithFulfillment.reduce((sum, item) => sum + item.fulfilledQuantity, 0);

      const overallStatus = totalFulfilled >= totalItems ? 'FULFILLED' :
        totalFulfilled > 0 ? 'PARTIALLY_FULFILLED' : 'NOT_FULFILLED';

      return {
        success: true,
        method: 'getOrderFulfillmentDetails',
        orderDetails: {
          orderId,
          orderNumber,
          overallFulfillmentStatus: overallStatus,
          totalItems,
          totalFulfilled,
          totalRemaining: totalItems - totalFulfilled,
          lineItems: lineItemsWithFulfillment,
          fulfillments: fulfillments
        }
      };

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ PER-ITEM: getOrderFulfillmentDetails failed:`, error);

      return {
        success: false,
        error: errorMsg,
        message: `Failed to get fulfillment details for order ${orderNumber}: ${errorMsg}`,
        method: 'getOrderFulfillmentDetails'
      };
    }
  }
);

/**
 * Validate items before fulfillment
 */
export const validateItemsForFulfillment = webMethod(
  Permissions.Anyone,
  async ({
    orderId,
    selectedItems
  }: {
    orderId: string;
    selectedItems: ItemFulfillment[];
  }) => {
    try {
      const elevatedGetOrder = auth.elevate(orders.getOrder);
      const orderDetails = await elevatedGetOrder(orderId);

      if (!orderDetails || !orderDetails.lineItems) {
        return {
          success: false,
          error: 'Order not found or has no line items'
        };
      }

      const orderItemMap = new Map();
      orderDetails.lineItems.forEach((item: any) => {
        const itemId = safeGetItemId(item);
        orderItemMap.set(itemId, item);
      });

      const validation = selectedItems.map(selectedItem => {
        const orderItem = orderItemMap.get(selectedItem.id);

        if (!orderItem) {
          return {
            itemId: selectedItem.id,
            valid: false,
            error: 'Item not found in order',
            requestedQuantity: selectedItem.quantity,
            availableQuantity: 0,
            fulfilledQuantity: 0,
            remainingQuantity: 0
          };
        }

        const totalQuantity = safeGetItemQuantity(orderItem);
        const fulfilledQuantity = safeGetFulfilledQuantity(orderItem);
        const remainingQuantity = safeGetRemainingQuantity(orderItem);

        return {
          itemId: selectedItem.id,
          valid: selectedItem.quantity <= remainingQuantity,
          error: selectedItem.quantity > remainingQuantity ?
            `Requested ${selectedItem.quantity} but only ${remainingQuantity} remaining` : null,
          requestedQuantity: selectedItem.quantity,
          availableQuantity: totalQuantity,
          fulfilledQuantity: fulfilledQuantity,
          remainingQuantity: remainingQuantity
        };
      });

      const validItems = validation.filter(item => item.valid);
      const invalidItems = validation.filter(item => !item.valid);

      return {
        success: true,
        validation,
        validItems,
        invalidItems,
        canProceed: invalidItems.length === 0,
        summary: {
          totalRequested: selectedItems.length,
          validCount: validItems.length,
          invalidCount: invalidItems.length
        }
      };

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMsg
      };
    }
  }
);

export const fulfillOrderInWix = webMethod(
  Permissions.Anyone,
  async ({
    orderId,
    trackingNumber,
    shippingProvider,
    orderNumber,
    sendShippingEmail = true,
    lineItems = [],
    trackingUrl,
    customCarrierName
  }: {
    orderId: string;
    trackingNumber: string;
    shippingProvider: string;
    orderNumber: string;
    sendShippingEmail?: boolean;
    lineItems?: Array<{ id: string; quantity: number }>;
    trackingUrl?: string;
    customCarrierName?: string;
  }) => {
    try {
      const rawResult = await smartFulfillOrderElevated({
        orderId,
        trackingNumber,
        shippingProvider,
        orderNumber,
        sendShippingEmail,
        lineItems,
        trackingUrl,
        customCarrierName
      });

      const result = rawResult as any;

      if (result.success) {
        return {
          success: true,
          method: result.method || 'fulfillOrderInWix',
          message: result.message || `Order ${orderNumber} processed successfully`,
          fulfillmentId: result.fulfillmentId || undefined,
          emailSent: result.emailSent || false,
          isPartialFulfillment: result.isPartialFulfillment || false,
          isTrackingUpdate: false,
          result: result.result || result,
          emailInfo: {
            emailRequested: sendShippingEmail,
            emailSentAutomatically: result.emailSent || false,
            customerEmail: 'Available in order details',
            note: result.emailSent ? 'Email sent automatically by Wix' : 'No email sent'
          }
        };
      } else {
        return {
          success: false,
          error: result.error || 'Fulfillment failed',
          message: result.message || `Failed to fulfill order ${orderNumber}`,
          method: 'fulfillOrderInWix',
          emailInfo: {
            emailRequested: sendShippingEmail,
            emailSentAutomatically: false,
            note: 'Email not sent due to fulfillment failure'
          }
        };
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMsg,
        message: `Failed to fulfill order ${orderNumber}: ${errorMsg}`,
        method: 'fulfillOrderInWix',
        emailInfo: {
          emailRequested: sendShippingEmail,
          emailSentAutomatically: false,
          note: 'Email not sent due to fulfillment failure'
        }
      };
    }
  }
);

export const testOrdersConnection = webMethod(
  Permissions.Anyone,
  async ({ limit = 3, cursor = '' }: { limit?: number; cursor?: string } = {}) => {
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const ecom = await Promise.race([
          import('@wix/ecom'),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Initialization timeout')), 10000)
          )
        ]) as any;

        if (!ecom || !ecom.orders) {
          throw new Error('ecom.orders not available after initialization');
        }

        const searchPromise = ecom.orders.searchOrders({
          filter: {
            status: { "$ne": "INITIALIZED" }
          },
          cursorPaging: {
            limit: limit,
            cursor: cursor || undefined
          }
        });

        const result = await Promise.race([
          searchPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Search operation timeout')), 15000)
          )
        ]);

        const parsedOrders = result.orders?.map((order: any) => {
          const recipientContact = order.recipientInfo?.contactDetails;
          const billingContact = order.billingInfo?.contactDetails;
          const buyerInfo = order.buyerInfo;

          const firstName = recipientContact?.firstName || billingContact?.firstName || 'Unknown';
          const lastName = recipientContact?.lastName || billingContact?.lastName || 'Customer';
          const phone = recipientContact?.phone || billingContact?.phone || '';
          const company = recipientContact?.company || billingContact?.company || '';
          const email = buyerInfo?.email || recipientContact?.email || billingContact?.email || 'no-email@example.com';

          // Extract shipping address
          let shippingAddress = null;
          if (order.recipientInfo?.address) {
            const addr = order.recipientInfo.address;
            shippingAddress = {
              streetAddress: addr.streetAddress ? {
                name: addr.streetAddress.name || '',
                number: addr.streetAddress.number || '',
                apt: addr.streetAddress.apt || ''
              } : null,
              city: addr.city || '',
              postalCode: addr.postalCode || '',
              country: addr.country || '',
              countryFullname: addr.countryFullname || addr.country || '',
              subdivision: addr.subdivision || '',
              subdivisionFullname: addr.subdivisionFullname || '',
              addressLine1: addr.addressLine1 || (addr.streetAddress ? `${addr.streetAddress.name || ''} ${addr.streetAddress.number || ''}`.trim() : ''),
              addressLine2: addr.addressLine2 || (addr.streetAddress?.apt || '')
            };
          } else if (order.billingInfo?.address) {
            const addr = order.billingInfo.address;
            shippingAddress = {
              streetAddress: addr.streetAddress ? {
                name: addr.streetAddress.name || '',
                number: addr.streetAddress.number || '',
                apt: addr.streetAddress.apt || ''
              } : null,
              city: addr.city || '',
              postalCode: addr.postalCode || '',
              country: addr.country || '',
              countryFullname: addr.countryFullname || addr.country || '',
              subdivision: addr.subdivision || '',
              subdivisionFullname: addr.subdivisionFullname || '',
              addressLine1: addr.addressLine1 || (addr.streetAddress ? `${addr.streetAddress.name || ''} ${addr.streetAddress.number || ''}`.trim() : ''),
              addressLine2: addr.addressLine2 || (addr.streetAddress?.apt || '')
            };
          }

          const processedItems = order.lineItems?.map((item: any) => {
            let imageUrl = '';

            if (item.image && typeof item.image === 'string') {
              if (item.image.startsWith('wix:image://v1/')) {
                const imageId = item.image
                  .replace('wix:image://v1/', '')
                  .split('#')[0]
                  .split('~')[0];
                imageUrl = `https://static.wixstatic.com/media/${imageId}`;
              } else if (item.image.startsWith('wix:image://')) {
                const imageId = item.image.replace(/^wix:image:\/\/[^\/]*\//, '').split('#')[0].split('~')[0];
                imageUrl = `https://static.wixstatic.com/media/${imageId}`;
              } else if (item.image.startsWith('http')) {
                imageUrl = item.image;
              } else {
                imageUrl = `https://static.wixstatic.com/media/${item.image}`;
              }
            }

            const lineItemId = safeGetItemId(item);
            const totalQuantity = safeGetItemQuantity(item);
            const fulfilledQuantity = safeGetFulfilledQuantity(item);
            const remainingQuantity = safeGetRemainingQuantity(item);
            let fulfillmentStatus: 'FULFILLED' | 'PARTIALLY_FULFILLED' | 'NOT_FULFILLED' = 'NOT_FULFILLED';
            if (fulfilledQuantity > 0) {
              fulfillmentStatus = fulfilledQuantity >= totalQuantity ? 'FULFILLED' : 'PARTIALLY_FULFILLED';
            }

            const fulfillments = order.fulfillments || [];
            const lineItemFulfillments: any[] = [];
            const trackingInfos: any[] = [];

            const trackingMap = new Map<string, {
              quantity: number;
              trackingUrl?: string;
              carrier?: string;
              fulfillmentId?: string;
              fulfillmentDate?: string;
            }>();

            fulfillments.forEach((fulfillment: any) => {
              const lineItem = fulfillment.lineItems?.find((li: any) =>
                (li.lineItemId === lineItemId) || (li._id === lineItemId)
              );

              if (lineItem) {
                // Add to line item fulfillments
                lineItemFulfillments.push({
                  quantity: lineItem.quantity,
                  fulfillmentId: fulfillment._id,
                  trackingNumber: fulfillment.trackingInfo?.trackingNumber,
                  trackingUrl: fulfillment.trackingInfo?.trackingLink,
                  carrier: fulfillment.trackingInfo?.shippingProvider,
                  fulfillmentDate: fulfillment._createdDate
                });

                // Track unique tracking numbers
                const trackingNumber = fulfillment.trackingInfo?.trackingNumber;
                if (trackingNumber) {
                  const existing = trackingMap.get(trackingNumber) || { quantity: 0 };
                  trackingMap.set(trackingNumber, {
                    quantity: existing.quantity + lineItem.quantity,
                    trackingUrl: fulfillment.trackingInfo?.trackingLink,
                    carrier: fulfillment.trackingInfo?.shippingProvider,
                    fulfillmentId: fulfillment._id,
                    fulfillmentDate: fulfillment._createdDate
                  });
                }
              }
            });

            const trackingInfoArray: any[] = [];
            trackingMap.forEach((value, trackingNumber) => {
              trackingInfoArray.push({
                trackingNumber,
                trackingUrl: value.trackingUrl,
                carrier: value.carrier,
                quantity: value.quantity,
                fulfillmentId: value.fulfillmentId,
                fulfillmentDate: value.fulfillmentDate
              });
            });

            return {
              name: safeGetProductName(item),
              quantity: totalQuantity,
              price: item.price?.formattedAmount || '$0.00',
              image: imageUrl,
              weight: item.physicalProperties?.weight || 0,
              options: item.catalogReference?.options || {},
              fulfilledQuantity: fulfilledQuantity,
              remainingQuantity: remainingQuantity,
              fulfillmentStatus: fulfillmentStatus,
              _id: lineItemId,
              fulfillmentDetails: {
                lineItemFulfillment: lineItemFulfillments.length > 0 ? lineItemFulfillments : undefined,
                trackingInfo: trackingInfoArray.length > 0 ? trackingInfoArray : undefined,
                totalFulfilled: fulfilledQuantity
              }
            };
          }) || [];

          // Status logic
          const rawStatus = order.status;
          const fulfillmentStatus = order.fulfillmentStatus;
          const rawOrderFulfillmentStatus = order.rawOrder?.fulfillmentStatus;

          let orderStatus = 'NOT_FULFILLED';

          if (rawStatus === 'CANCELED' || rawStatus === 'CANCELLED') {
            orderStatus = 'CANCELED';
          } else {
            const actualFulfillmentStatus = fulfillmentStatus || rawOrderFulfillmentStatus || 'NOT_FULFILLED';
            orderStatus = actualFulfillmentStatus;
          }

          // Enhanced payment status mapping
          let paymentStatus = order.paymentStatus || 'UNKNOWN';
          if (order.paymentStatus === 'FULLY_REFUNDED') {
            paymentStatus = 'FULLY_REFUNDED';
          } else if (order.paymentStatus === 'PARTIALLY_REFUNDED') {
            paymentStatus = 'PARTIALLY_REFUNDED';
          }

          // Calculate total weight safely
          const totalWeight = order.lineItems?.reduce((total: number, item: any) => {
            const itemWeight = item.physicalProperties?.weight || 0;
            const quantity = safeGetItemQuantity(item);
            return total + (itemWeight * quantity);
          }, 0) || 0;

          return {
            _id: order._id,
            number: order.number,
            _createdDate: order._createdDate,
            customer: {
              firstName: firstName,
              lastName: lastName,
              email: email,
              phone: phone,
              company: company
            },
            items: processedItems,
            lineItems: processedItems,
            totalWeight: totalWeight,
            total: order.priceSummary?.total?.formattedAmount || '$0.00',
            status: orderStatus,
            paymentStatus: paymentStatus,
            shippingInfo: {
              carrierId: order.shippingInfo?.carrierId || '',
              title: order.shippingInfo?.title || 'No shipping method',
              cost: order.shippingInfo?.cost?.formattedAmount || '$0.00'
            },
            weightUnit: order.weightUnit || 'KG',
            shippingAddress: shippingAddress,
            billingInfo: order.billingInfo,
            recipientInfo: order.recipientInfo,
            rawOrder: order,
            fulfillmentStatus: order.fulfillmentStatus || 'NOT_FULFILLED'
          };
        }) || [];

        return {
          success: true,
          method: '@wix/ecom',
          orders: parsedOrders,
          orderCount: parsedOrders.length,
          pagination: {
            hasNext: result.metadata?.hasNext || false,
            nextCursor: result.metadata?.cursors?.next || '',
            prevCursor: result.metadata?.cursors?.prev || ''
          },
          message: `Successfully parsed ${parsedOrders.length} orders from your store with enhanced fulfillment details! (Limit: ${limit})`
        };

      } catch (currentError: unknown) {
        lastError = currentError;
        const errorMsg = currentError instanceof Error ? currentError.message : String(currentError);

        console.error(`❌ Attempt ${attempt}/${maxRetries} failed:`, errorMsg);

        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    const finalErrorMsg = lastError instanceof Error ? lastError.message : String(lastError);

    return {
      success: false,
      error: 'eCommerce API not accessible',
      ecomError: finalErrorMsg,
      orders: [],
      orderCount: 0,
      pagination: {
        hasNext: false,
        nextCursor: '',
        prevCursor: ''
      },
      message: `Could not access @wix/ecom orders API after ${maxRetries} attempts. Check permissions and app setup. Last error: ${finalErrorMsg}`
    };
  }
);

export const getSingleOrder = webMethod(
  Permissions.Anyone,
  async (orderId: string) => {
    try {
      const { orders } = await import('@wix/ecom');

      const order = await orders.getOrder(orderId);

      if (!order) {
        return {
          success: false,
          error: `Order with ID ${orderId} not found`
        };
      }

      const recipientContact = order.recipientInfo?.contactDetails;
      const billingContact = order.billingInfo?.contactDetails;
      const buyerInfo = order.buyerInfo;

      const firstName = recipientContact?.firstName || billingContact?.firstName || 'Unknown';
      const lastName = recipientContact?.lastName || billingContact?.lastName || 'Customer';
      const phone = recipientContact?.phone || billingContact?.phone || '';
      const company = recipientContact?.company || billingContact?.company || '';
      const email = buyerInfo?.email || 'no-email@example.com';

      let shippingAddress = null;
      if (order.recipientInfo?.address) {
        const addr = order.recipientInfo.address;
        shippingAddress = {
          streetAddress: addr.streetAddress ? {
            name: addr.streetAddress.name || '',
            number: addr.streetAddress.number || '',
          } : null,
          city: addr.city || '',
          postalCode: addr.postalCode || '',
          country: addr.country || '',
          countryFullname: addr.countryFullname || addr.country || '',
          subdivision: addr.subdivision || '',
          subdivisionFullname: addr.subdivisionFullname || '',
          addressLine1: addr.addressLine1 || (addr.streetAddress ? `${addr.streetAddress.name || ''} ${addr.streetAddress.number || ''}`.trim() : ''),
          addressLine2: addr.addressLine2 || (addr.streetAddress?.name || '')
        };
      }

      const processedItems = order.lineItems?.map((item: any) => {
        let imageUrl = '';
        if (item.image && typeof item.image === 'string') {
          if (item.image.startsWith('wix:image://v1/')) {
            const imageId = item.image
              .replace('wix:image://v1/', '')
              .split('#')[0]
              .split('~')[0];
            imageUrl = `https://static.wixstatic.com/media/${imageId}`;
          } else if (item.image.startsWith('wix:image://')) {
            const imageId = item.image.replace(/^wix:image:\/\/[^\/]*\//, '').split('#')[0].split('~')[0];
            imageUrl = `https://static.wixstatic.com/media/${imageId}`;
          } else if (item.image.startsWith('http')) {
            imageUrl = item.image;
          } else {
            imageUrl = `https://static.wixstatic.com/media/${item.image}`;
          }
        }

        const lineItemId = safeGetItemId(item);
        const totalQuantity = safeGetItemQuantity(item);
        const fulfilledQuantity = safeGetFulfilledQuantity(item);
        const remainingQuantity = safeGetRemainingQuantity(item);
        let fulfillmentStatus: 'FULFILLED' | 'PARTIALLY_FULFILLED' | 'NOT_FULFILLED' = 'NOT_FULFILLED';
        if (fulfilledQuantity > 0) {
          fulfillmentStatus = fulfilledQuantity >= totalQuantity ? 'FULFILLED' : 'PARTIALLY_FULFILLED';
        }

        const fulfillments = (order as any).rawOrder?.fulfillments || (order as any).fulfillments || [];
        const lineItemFulfillments: any[] = [];
        const trackingInfos: any[] = [];

        const trackingMap = new Map<string, {
          quantity: number;
          trackingUrl?: string;
          carrier?: string;
          fulfillmentId?: string;
          fulfillmentDate?: string;
        }>();

        fulfillments.forEach((fulfillment: any) => {
          const lineItem = fulfillment.lineItems?.find((li: any) =>
            (li.lineItemId === lineItemId) || (li._id === lineItemId)
          );

          if (lineItem) {
            lineItemFulfillments.push({
              quantity: lineItem.quantity,
              fulfillmentId: fulfillment._id,
              trackingNumber: fulfillment.trackingInfo?.trackingNumber,
              trackingUrl: fulfillment.trackingInfo?.trackingLink,
              carrier: fulfillment.trackingInfo?.shippingProvider,
              fulfillmentDate: fulfillment._createdDate
            });

            // Track unique tracking numbers
            const trackingNumber = fulfillment.trackingInfo?.trackingNumber;
            if (trackingNumber) {
              const existing = trackingMap.get(trackingNumber) || { quantity: 0 };
              trackingMap.set(trackingNumber, {
                quantity: existing.quantity + lineItem.quantity,
                trackingUrl: fulfillment.trackingInfo?.trackingLink,
                carrier: fulfillment.trackingInfo?.shippingProvider,
                fulfillmentId: fulfillment._id,
                fulfillmentDate: fulfillment._createdDate
              });
            }
          }
        });

        // Convert tracking map to array
        const trackingInfoArray: any[] = [];
        trackingMap.forEach((value, trackingNumber) => {
          trackingInfoArray.push({
            trackingNumber,
            trackingUrl: value.trackingUrl,
            carrier: value.carrier,
            quantity: value.quantity,
            fulfillmentId: value.fulfillmentId,
            fulfillmentDate: value.fulfillmentDate
          });
        });

        return {
          name: safeGetProductName(item),
          quantity: totalQuantity,
          price: item.price?.formattedAmount || '$0.00',
          image: imageUrl,
          weight: item.physicalProperties?.weight || 0,
          options: item.catalogReference?.options || {},
          fulfilledQuantity: fulfilledQuantity,
          remainingQuantity: remainingQuantity,
          fulfillmentStatus: fulfillmentStatus,
          _id: lineItemId,
          fulfillmentDetails: {
            lineItemFulfillment: lineItemFulfillments.length > 0 ? lineItemFulfillments : undefined,
            trackingInfo: trackingInfoArray.length > 0 ? trackingInfoArray : undefined,
            totalFulfilled: fulfilledQuantity
          }
        };
      }) || [];

      const rawStatus = order.status;
      const fulfillmentStatus = order.fulfillmentStatus;

      let orderStatus = 'NOT_FULFILLED';

      if (rawStatus === 'CANCELED') {
        orderStatus = 'CANCELED';
      } else {
        orderStatus = fulfillmentStatus || 'NOT_FULFILLED';
      }

      const totalWeight = order.lineItems?.reduce((total: number, item: any) => {
        const itemWeight = item.physicalProperties?.weight || 0;
        const quantity = safeGetItemQuantity(item);
        return total + (itemWeight * quantity);
      }, 0) || 0;

      const parsedOrder = {
        _id: order._id,
        number: order.number,
        _createdDate: order._createdDate,
        customer: {
          firstName,
          lastName,
          email,
          phone,
          company
        },
        items: processedItems,
        lineItems: processedItems,
        totalWeight: totalWeight,
        total: order.priceSummary?.total?.formattedAmount || '$0.00',
        status: orderStatus,
        paymentStatus: order.paymentStatus || 'UNKNOWN',
        shippingInfo: {
          carrierId: order.shippingInfo?.carrierId || '',
          title: order.shippingInfo?.title || 'No shipping method',
          cost: order.shippingInfo?.cost?.price?.formattedAmount || '$0.00'
        },
        weightUnit: order.weightUnit || 'KG',
        shippingAddress,
        billingInfo: order.billingInfo,
        recipientInfo: order.recipientInfo,
        rawOrder: order,
        buyerNote: order.buyerNote,
        fulfillmentStatus: order.fulfillmentStatus || 'NOT_FULFILLED'
      };

      return {
        success: true,
        order: parsedOrder
      };

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ getSingleOrder error:', errorMsg);

      return {
        success: false,
        error: errorMsg
      };
    }
  }
);

export const multiply = webMethod(
  Permissions.Anyone,
  (a: number, b: number) => {
    return a * b;
  }
);