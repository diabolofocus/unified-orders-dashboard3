import React from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Text, IconButton, Card } from '@wix/design-system';
import * as Icons from '@wix/wix-ui-icons-common';

interface TabItem {
    id: string;
    label: string;
    description: string;
}

interface TabOrderSettingsProps {
    tabs: TabItem[];
    onReorder: (newOrder: TabItem[]) => void;
}

export const TabOrderSettings: React.FC<TabOrderSettingsProps> = observer(({ tabs, onReorder }) => {
    const moveUp = (index: number) => {
        if (index === 0) return;
        const newTabs = [...tabs];
        [newTabs[index - 1], newTabs[index]] = [newTabs[index], newTabs[index - 1]];
        onReorder(newTabs);
    };

    const moveDown = (index: number) => {
        if (index === tabs.length - 1) return;
        const newTabs = [...tabs];
        [newTabs[index], newTabs[index + 1]] = [newTabs[index + 1], newTabs[index]];
        onReorder(newTabs);
    };

    return (
        <Box direction="vertical" gap="12px">
            <Box direction="vertical" gap="4px">
                <Text weight="normal">Tab Order</Text>
                <Text secondary size="small">
                    Reorder the tabs to change which tab appears first
                </Text>
            </Box>

            <Box direction="vertical" gap="8px">
                {tabs.map((tab, index) => (
                    <Box
                        key={tab.id}
                        direction="horizontal"
                        align="space-between"
                        verticalAlign="middle"
                        padding="12px"
                        borderRadius="8px"
                        backgroundColor={index === 0 ? '#fafafa' : '#fafafa'}
                        border={index === 0 ? '1px solid #16a4f5' : '1px solid #d9d9d9'}
                    >
                        <Box direction="vertical" gap="2px" width="100%">
                            <Box direction="horizontal" gap="8px" verticalAlign="middle">
                                <Text weight="normal">{tab.label}</Text>
                                {index === 0 && (
                                    <Box
                                        padding="2px 8px"
                                        borderRadius="4px"
                                        backgroundColor="#1890ff"
                                    >
                                        <Text size="tiny" light style={{ color: 'white' }}>
                                            First
                                        </Text>
                                    </Box>
                                )}
                            </Box>
                            <Text secondary size="small">
                                {tab.description}
                            </Text>
                        </Box>

                        <Box direction="horizontal" gap="4px">
                            <IconButton
                                size="small"
                                priority="secondary"
                                disabled={index === 0}
                                onClick={() => moveUp(index)}
                            >
                                <Icons.ChevronUp />
                            </IconButton>
                            <IconButton
                                size="small"
                                priority="secondary"
                                disabled={index === tabs.length - 1}
                                onClick={() => moveDown(index)}
                            >
                                <Icons.ChevronDown />
                            </IconButton>
                        </Box>
                    </Box>
                ))}
            </Box>
        </Box>
    );
});
