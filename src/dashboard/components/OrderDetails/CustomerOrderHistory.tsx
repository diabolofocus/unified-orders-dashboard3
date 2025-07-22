import React from 'react';
import { Box, Text } from '@wix/design-system';
import { Check } from '@wix/wix-ui-icons-common';

// Define types for the order data
interface CustomerOrder {
    _id: string;
    number: string;
    _createdDate: string;
    status: string;
    totals?: {
        total?: number;
    };
}

interface CustomerOrderHistoryProps {
    orders: CustomerOrder[];
    onOrderClick: (orderId: string) => void;
}

// Simple date formatter
const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse' as const,
    margin: '16px 0',
    '& th, & td': {
        padding: '12px 16px',
        textAlign: 'left',
        borderBottom: '1px solid #e0e0e0',
    },
    '& th': {
        backgroundColor: '#f5f5f5',
        fontWeight: 500,
    },
    '& tr:hover': {
        backgroundColor: '#f9f9f9',
    },
};

export const CustomerOrderHistory: React.FC<CustomerOrderHistoryProps> = ({ orders, onOrderClick }) => {
    if (!orders?.length) {
        return (
            <Box padding="24px" align="center">
                <Text>No previous orders found for this customer.</Text>
            </Box>
        );
    }

    return (
        <div style={{ width: '100%', overflowX: 'auto' }}>
            <Box width="100%" height="100%" maxHeight="calc(100vh - 216px)" overflowY="auto" background="white">

                <table style={tableStyle}>
                    <thead>
                        <tr>
                            <th>Order #</th>
                            <th>Date</th>
                            <th>Total</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.map((order: CustomerOrder) => (
                            <tr key={order._id}>
                                <td>{order.number || 'N/A'}</td>
                                <td>{formatDate(order._createdDate)}</td>
                                <td>${order.totals?.total?.toFixed(2) || '0.00'}</td>
                                <td>
                                    <Box direction="horizontal" gap="8px" align="center">
                                        <Check size="12px" />
                                        <Text>{order.status || 'N/A'}</Text>
                                    </Box>
                                </td>
                                <td>
                                    <button
                                        onClick={() => onOrderClick(order._id)}
                                        aria-label={`View order ${order.number || ''}`}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '4px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                                        </svg>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Box>
        </div>
    );
};
