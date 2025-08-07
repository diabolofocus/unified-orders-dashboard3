import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Text, Card } from '@wix/design-system';
import * as Icons from '@wix/wix-ui-icons-common';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class SafeErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log SVG-related errors to help with debugging
        if (error.message.includes('attribute width') || 
            error.message.includes('attribute height') || 
            error.message.includes('NaN') ||
            error.message.includes('negative value')) {
            console.error('SVG Rendering Error:', error.message, errorInfo);
        }
        
        // Call optional onError callback
        this.props.onError?.(error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            // You can render any custom fallback UI
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <Card>
                    <Card.Content>
                        <Box 
                            direction="horizontal" 
                            align="center" 
                            gap="8px"
                            paddingTop="12px"
                            paddingBottom="12px"
                            paddingLeft="16px"
                            paddingRight="16px"
                        >
                            <Box
                                width="32px"
                                height="32px"
                                borderRadius="50%"
                                backgroundColor="#fef2f2"
                                align="center"
                                verticalAlign="middle"
                            >
                                <Icons.StatusAlert size="16px" style={{ color: '#dc2626' }} />
                            </Box>
                            <Box direction="vertical" gap="2px">
                                <Text size="small" weight="normal">Component Error</Text>
                                <Text size="tiny" secondary>
                                    Unable to render component. Please refresh the page.
                                </Text>
                            </Box>
                        </Box>
                    </Card.Content>
                </Card>
            );
        }

        return this.props.children;
    }
}

export default SafeErrorBoundary;