import React from 'react';
import { Box, Card, Text, Button, Heading } from '@wix/design-system';
import * as Icons from '@wix/wix-ui-icons-common';
import KarpoStudioLogo from '../../assets/Karpo Studio.svg';

export const PromoBanner: React.FC = () => {
  const handleContactUs = () => {
    window.open('mailto:info@karpo.studio?subject=Custom App Development Inquiry', '_blank');
  };

  return (
    <Card>
      <Box
        direction="vertical"
        padding="24px"
        gap="16px"
        backgroundColor="#ffffff"
        borderRadius="8px"
        align="left"
      >
        {/* Header Section */}
        <Box direction="horizontal" gap="12px" align="center">
          <Box
            width="48px"
            height="48px"
            borderRadius="50%"
            backgroundColor="#eceeef"
            align="center"
            verticalAlign="middle"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <img
              src={KarpoStudioLogo}
              alt="Karpo Studio Logo"
              style={{ width: '32px', height: '32px', objectFit: 'contain' }}
            />
          </Box>
          <Box direction="vertical" gap="4px" align="left">
            <Heading size="small" appearance="H4" style={{ color: '#000000' }}>
              Need Custom Development?
            </Heading>
            <Text size="small" weight="thin" style={{ color: '#000000' }}>
              Tailored solutions for your business
            </Text>
          </Box>
        </Box>

        {/* Content Section */}
        <Box direction="vertical" gap="12px" align="left">
          <Text size="medium" style={{ color: '#000000' }}>
            Looking for personalized features or a custom dashboard tailored to your specific workflow?
          </Text>

          {/* Feature Highlights */}
          <Box direction="vertical" gap="8px" paddingTop="8px" align="left">
            <Box direction="horizontal" gap="8px" align="center">
              <Icons.Confirm style={{ color: '#00c851', fontSize: '16px', flexShrink: 0 }} />
              <Text size="small" style={{ color: '#000000' }}>Custom dashboards and order management workflows</Text>
            </Box>
            <Box direction="horizontal" gap="8px" align="center">
              <Icons.Confirm style={{ color: '#00c851', fontSize: '16px', flexShrink: 0 }} />
              <Text size="small" style={{ color: '#000000' }}>Integration with third-party services and APIs</Text>
            </Box>
            <Box direction="horizontal" gap="8px" align="center">
              <Icons.Confirm style={{ color: '#00c851', fontSize: '16px', flexShrink: 0 }} />
              <Text size="small" style={{ color: '#000000' }}>Automation tools and custom reporting solutions</Text>
            </Box>
            <Box direction="horizontal" gap="8px" align="center">
              <Icons.Confirm style={{ color: '#00c851', fontSize: '16px', flexShrink: 0 }} />
              <Text size="small" style={{ color: '#000000' }}>Ongoing support and maintenance</Text>
            </Box>
          </Box>

          {/* CTA Section */}
          <Box
            direction="horizontal"
            gap="12px"
            paddingTop="16px"
            align="center"
          >
            <Text size="medium" weight="thin" style={{ color: '#666666' }}>
              Contact us at info@karpo.studio
            </Text>
          </Box>
        </Box>

        {/* Bottom Note */}
        <Box
          paddingTop="12px"
          borderTop="1px solid #d9e1e8"
          style={{ marginTop: '8px' }}
          align="left"
        >
          <Text size="tiny" style={{ color: '#000000' }}>
            Whether you need a small feature addition or a complete custom application, we're here to help make your store management more efficient.
          </Text>
        </Box>
      </Box>
    </Card>
  );
};
