import { Permissions, webMethod } from '@wix/web-methods';
import { orders } from '@wix/ecom';

export const generateOrderPrintUrl = webMethod(Permissions.Admin, async (orderId) => {
    try {
        const retrievedOrder = await orders.getOrder(orderId);

        return {
            success: true,
            order: retrievedOrder,
        };
    } catch (error) {
        console.error('Error retrieving order for print:', error);
        return {
            success: false,
            error: error.message
        };
    }
});