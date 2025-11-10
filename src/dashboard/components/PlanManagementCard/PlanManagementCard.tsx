import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
    Card,
    Box,
    Text,
    Button,
    Heading,
    Badge,
    Collapse,
    Divider,
    IconButton
} from '@wix/design-system';
import * as Icons from '@wix/wix-ui-icons-common';
import { settingsStore } from '../../stores/SettingsStore';

export const PlanManagementCard: React.FC = observer(() => {
    const { planType, trialDaysLeft } = settingsStore;
    const isPremium = planType === 'premium';

    // If premium, collapse by default. If trial, expand by default.
    const [isExpanded, setIsExpanded] = useState(!isPremium);

    const handleToggleCollapse = () => {
        setIsExpanded(!isExpanded);
    };

    const handleManagePlan = () => {
        // Navigate to plan management page
        window.open('https://www.wix.com/my-account/premium/', '_blank');
    };

    return (
        <Card stretchVertically>
            <Card.Header
                title={
                    <Box direction="horizontal" gap="8px" verticalAlign="middle">
                        <Icons.PaidPlans />
                        <Heading size="medium">Plan Management</Heading>
                        <Badge
                            skin={isPremium ? 'success' : 'neutralStandard'}
                            size="small"
                        >
                            {isPremium ? 'PREMIUM' : 'TRIAL'}
                        </Badge>

                    </Box>
                }
                subtitle={isPremium
                    ? "You're on the Premium plan with full access to all features"
                    : `Your trial includes all premium features.`
                }
                suffix={
                    <IconButton
                        size="small"
                        priority="secondary"
                        onClick={handleToggleCollapse}
                    >
                        {isExpanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
                    </IconButton>
                }
            />
            <Collapse open={isExpanded}>
                <Card.Divider />
                <Card.Content>
                    <Box direction="vertical" gap="16px" width="100%">
                        {isPremium ? (
                            <>
                                <Box direction="vertical" gap="12px" width="100%">
                                    <Text weight="bold">Premium Features Included:</Text>
                                    <Box direction="vertical" gap="8px" width="100%">
                                        <Box direction="horizontal" gap="8px" verticalAlign="middle">
                                            <Icons.Confirm style={{ color: '#00c851', fontSize: '16px', flexShrink: 0 }} />
                                            <Text size="small">Centralized Modular Orders Dashboard</Text>
                                        </Box>
                                        <Box direction="horizontal" gap="8px" verticalAlign="middle">
                                            <Icons.Confirm style={{ color: '#00c851', fontSize: '16px', flexShrink: 0 }} />
                                            <Text size="small">Add Tracking to Custom Items</Text>
                                        </Box>
                                        <Box direction="horizontal" gap="8px" verticalAlign="middle">
                                            <Icons.Confirm style={{ color: '#00c851', fontSize: '16px', flexShrink: 0 }} />
                                            <Text size="small">Packing list and Order History</Text>
                                        </Box>
                                        <Box direction="horizontal" gap="8px" verticalAlign="middle">
                                            <Icons.Confirm style={{ color: '#00c851', fontSize: '16px', flexShrink: 0 }} />
                                            <Text size="small">Modular Analytics</Text>
                                        </Box>
                                        <Box direction="horizontal" gap="8px" verticalAlign="middle">
                                            <Icons.Confirm style={{ color: '#00c851', fontSize: '16px', flexShrink: 0 }} />
                                            <Text size="small">Priority Support</Text>
                                        </Box>
                                    </Box>
                                </Box>

                                <Divider />

                                <Box direction="horizontal" gap="12px" width="100%">
                                    <Button
                                        priority="secondary"
                                        size="small"
                                        prefixIcon={<Icons.Settings />}
                                        onClick={handleManagePlan}
                                    >
                                        Manage Plan
                                    </Button>
                                </Box>
                            </>
                        ) : (
                            <>
                                <Box direction="vertical" gap="12px" width="100%">
                                    <Text weight="normal">Features (Full Access):</Text>
                                    <Box direction="vertical" gap="8px" width="100%">
                                        <Box direction="horizontal" gap="8px" verticalAlign="middle">
                                            <Icons.Confirm style={{ color: '#00c851', fontSize: '16px', flexShrink: 0 }} />
                                            <Text size="small">Centralized Modular Orders Dashboard</Text>
                                        </Box>
                                        <Box direction="horizontal" gap="8px" verticalAlign="middle">
                                            <Icons.Confirm style={{ color: '#00c851', fontSize: '16px', flexShrink: 0 }} />
                                            <Text size="small">Add Tracking to Custom Items</Text>
                                        </Box>
                                        <Box direction="horizontal" gap="8px" verticalAlign="middle">
                                            <Icons.Confirm style={{ color: '#00c851', fontSize: '16px', flexShrink: 0 }} />
                                            <Text size="small">Packing list and Order History</Text>
                                        </Box>
                                        <Box direction="horizontal" gap="8px" verticalAlign="middle">
                                            <Icons.Confirm style={{ color: '#00c851', fontSize: '16px', flexShrink: 0 }} />
                                            <Text size="small">Modular Analytics</Text>
                                        </Box>
                                    </Box>
                                </Box>

                                {trialDaysLeft !== null && (
                                    <Box
                                        width="auto"
                                        padding="12px 16px"
                                        backgroundColor={trialDaysLeft <= 3 ? "#fff4e6" : "#f0f4f8"}
                                        borderRadius="8px"
                                        style={{
                                            display: 'inline-block',
                                            alignSelf: 'flex-start'
                                        }}
                                    >
                                        <Box direction="vertical" gap="4px">
                                            <Text size="small" weight="bold" style={{ color: trialDaysLeft <= 3 ? '#f57c00' : '#5b6987' }}>
                                                {trialDaysLeft === 0
                                                    ? 'Your plan switches to Premium tomorrow'
                                                    : trialDaysLeft === 1
                                                        ? 'Your plan switches to Premium in 1 day'
                                                        : `Your plan switches to Premium in ${trialDaysLeft} days`
                                                }
                                            </Text>
                                            <Text size="tiny" style={{ color: '#666666' }}>
                                                You'll continue to have full access to all premium features.
                                            </Text>
                                        </Box>
                                    </Box>
                                )}
                            </>
                        )}
                    </Box>
                </Card.Content>
            </Collapse>
        </Card>
    );
});
