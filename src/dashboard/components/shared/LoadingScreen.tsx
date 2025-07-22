// components/shared/LoadingScreen.tsx
import React from 'react';
import { Page, Box, WixDesignSystemProvider } from '@wix/design-system';
import styled, { keyframes } from 'styled-components';

const shimmer = keyframes`
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
`;

const SkeletonBase = styled.div`
  background: #f0f1f3;
  border-radius: 8px;
  position: relative;
  overflow: hidden;
  
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.8) 50%,
      transparent
    );
    animation: ${shimmer} 1.8s infinite ease-in-out;
    background-size: 1000px 100%;
  }
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const SearchBar = styled(SkeletonBase)`
  width: 280px;
  height: 36px;
  border-radius: 18px;
`;

const PrimaryButton = styled.div`
  width: 183px;
  height: 36px;
  border-radius: 18px;
  background:rgb(166, 191, 251);
`;

const SummaryCard = styled.div`
  height: 75px;
  width: 100%;
  border-radius: 8px;
  background: #ffffff;
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SummaryContent = styled.div`
  display: flex;
  align-items: center;
  gap: 60px;
`;

const SummaryItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SummaryLabel = styled(SkeletonBase)`
  height: 14px;
  width: 80px;
  border-radius: 4px;
`;

const SummaryValue = styled(SkeletonBase)`
  height: 28px;
  width: 120px;
  border-radius: 4px;
`;

const SummarySubtext = styled(SkeletonBase)`
  height: 12px;
  width: 140px;
  border-radius: 4px;
`;

const SummaryDropdown = styled(SkeletonBase)`
  height: 32px;
  width: 120px;
  border-radius: 4px;
`;

const SidebarCard = styled.div`
  width: 100%;
  border-radius: 8px;
  background: #ffffff;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const SidebarSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SidebarTitle = styled(SkeletonBase)`
  height: 24px;
  width: 120px;
  border-radius: 4px;
`;

const SidebarSubtitle = styled(SkeletonBase)`
  height: 14px;
  width: 100px;
  border-radius: 4px;
`;

const StatusBadgesSkeleton = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
`;

const BadgeSkeleton = styled(SkeletonBase)`
  height: 18px;
  width: 80px;
  border-radius: 3px;
`;

const InfoLine = styled(SkeletonBase) <{ width?: string }>`
  height: 14px;
  width: ${props => props.width || '150px'};
  border-radius: 4px;
  margin-bottom: 4px;
`;

const ProductItem = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
`;

const ProductImage = styled(SkeletonBase)`
  width: 50px;
  height: 50px;
  border-radius: 4px;
  flex-shrink: 0;
`;

const ProductInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Divider = styled.div`
  height: 1px;
  background: #f0f0f0;
  margin: 4px 0;
`;

const TableContainer = styled.div`
  background: #ffffff;
  border-radius: 8px;
  overflow: hidden;
  height: 600px;
`;

const TableHeader = styled.div`
  height: 80px;
  width: 100%;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  padding: 0 24px;
`;

const TableSubHeader = styled.div`
  height: 45px;
  width: 100%;
  background:rgb(235, 240, 253);
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  padding: 0 24px;
`;

const ColumnHeader = styled(SkeletonBase)`
  height: 14px;
  border-radius: 4px;
  flex-shrink: 0;
`;

const TableTitle = styled(SkeletonBase)`
  height: 20px;
  width: 140px;
  border-radius: 4px;
`;

const TableRow = styled.div`
  height: 72px;
  width: 100%;
  background: #ffffff;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  padding: 0 24px;
  
  &:last-child {
    border-bottom: none;
  }
`;

const TableCell = styled(SkeletonBase)`
  height: 16px;
  border-radius: 4px;
  flex-shrink: 0;
`;

const ContentWrapper = styled.div`
  display: flex;
  gap: 24px;
  align-items: flex-start;
`;

const MainContent = styled.div`
  width: 66%;
  min-width: 0;
`;

const Sidebar = styled.div`
  width: 28.2%;
  flex-shrink: 0;
`;

export const LoadingScreen: React.FC = () => (
  <WixDesignSystemProvider features={{ newColorsBranding: true }}>
    <Page>
      <Page.Header
        title="Orders"
        actionsBar={
          <HeaderActions>
            <SearchBar />
            <PrimaryButton />
          </HeaderActions>
        }
      />
      <Page.Content>
        {/* Top Full Width Card */}
        <Box marginBottom="100px">
          <SummaryCard>
            <SummaryContent>
              <SummaryItem>
                <SummaryLabel />
                <SummaryValue />
                <SummarySubtext />
              </SummaryItem>
              <SummaryItem>
                <SummaryLabel />
                <SummaryValue />
                <SummarySubtext />
              </SummaryItem>
              <SummaryItem>
                <SummaryLabel />
                <SummaryValue />
                <SummarySubtext />
              </SummaryItem>
            </SummaryContent>
            <SummaryDropdown />
          </SummaryCard>
        </Box>

        {/* Main content and Sidebar */}
        <ContentWrapper>
          <MainContent>
            <TableContainer>
              <TableHeader>
                <TableTitle />
              </TableHeader>
              <TableSubHeader>
                <ColumnHeader style={{ width: '70px', marginRight: '36px' }} />
                <ColumnHeader style={{ width: '90px', marginRight: '36px' }} />
                <ColumnHeader style={{ width: '140px', marginRight: '36px' }} />
                <ColumnHeader style={{ width: '80px', marginRight: '36px' }} />
                <ColumnHeader style={{ width: '100px', marginRight: '36px' }} />
                <ColumnHeader style={{ width: '70px', marginRight: '36px' }} />
                <ColumnHeader style={{ width: '80px' }} />
              </TableSubHeader>

              {/* Table rows with shimmer */}
              {[...Array(6)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell style={{ width: '70px', marginRight: '36px' }} />
                  <TableCell style={{ width: '90px', marginRight: '36px' }} />
                  <TableCell style={{ width: '140px', marginRight: '36px' }} />
                  <TableCell style={{ width: '80px', marginRight: '36px' }} />
                  <TableCell style={{ width: '100px', marginRight: '36px' }} />
                  <TableCell style={{ width: '70px', marginRight: '36px' }} />
                  <TableCell style={{ width: '80px' }} />
                </TableRow>
              ))}
            </TableContainer>
          </MainContent>

          <Sidebar>
            <SidebarCard>
              {/* Order Header */}
              <div>
                <SidebarTitle />
                <div style={{ marginTop: '4px', marginBottom: '4px' }}>
                  <InfoLine width="90px" />
                </div>
                <StatusBadgesSkeleton>
                  <BadgeSkeleton />
                  <BadgeSkeleton />
                </StatusBadgesSkeleton>
              </div>
              <Divider />

              {/* Contact Details */}
              <SidebarSection>
                <SidebarSubtitle />
                <InfoLine width="180px" />
                <InfoLine width="200px" />
              </SidebarSection>

              <Divider />

              {/* Shipping Address */}
              <SidebarSection>
                <SidebarSubtitle />
                <InfoLine width="140px" />
                <InfoLine width="120px" />
                <InfoLine width="100px" />
                <InfoLine width="80px" />
                <div style={{ marginTop: '8px' }}>
                  <InfoLine width="60px" />
                </div>
              </SidebarSection>

              <Divider />

              {/* Billing Address */}
              <SidebarSection>
                <SidebarSubtitle />
                <InfoLine width="140px" />
              </SidebarSection>

              <Divider />

              {/* Products */}
              <SidebarSection>
                <SidebarSubtitle />
                <ProductItem>
                  <ProductImage />
                  <ProductInfo>
                    <InfoLine width="120px" />
                    <InfoLine width="80px" />
                    <InfoLine width="60px" />
                  </ProductInfo>
                  <InfoLine width="50px" />
                </ProductItem>
                <div style={{ marginTop: '12px' }}>
                  <InfoLine width="100px" />
                </div>
              </SidebarSection>
            </SidebarCard>
          </Sidebar>
        </ContentWrapper>
      </Page.Content>
    </Page>
  </WixDesignSystemProvider>
);