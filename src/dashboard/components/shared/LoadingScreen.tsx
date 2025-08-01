// components/shared/LoadingScreen.tsx
import React, { useState, useEffect } from 'react';
import { Page, Box, Text, WixDesignSystemProvider } from '@wix/design-system';
import styled, { keyframes } from 'styled-components';

const progressAnimation = keyframes`
  0% {
    width: 0%;
  }
  100% {
    width: 75%;
  }
`;

const shimmerAnimation = keyframes`
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(400px);
  }
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background-color: #f5f5f5;
  font-family: 'HelveticaNeueW01-45Ligh', 'HelveticaNeueW02-45Ligh', 'HelveticaNeueW10-45Ligh', 'Helvetica Neue', Helvetica, Arial, sans-serif;
`;

const BrandingContainer = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 32px;
`;

const BrandText = styled.div`
  font-size: 19px;
  font-weight: bold;
  font-family: 'HelveticaNeueW01-65Medi', 'HelveticaNeueW02-65Medi', 'HelveticaNeueW10-65Medi', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  letter-spacing: 1px;
  color: #212529;
`;


const ProgressContainer = styled.div`
  width: 350px;
  margin-bottom: 24px;
`;

const ProgressTrack = styled.div`
  width: 100%;
  height: 6px;
  background-color: #e8e8e8;
  border-radius: 30px;
  overflow: hidden;
`;

const ProgressBar = styled.div<{ $animate: boolean }>`
  height: 100%;
  background: #697e99;
  border-radius: 0px;
  position: relative;
  overflow: hidden;
  transition: width 0.3s ease;
  animation: ${props => props.$animate ? progressAnimation : 'none'} 2s ease-out forwards;
  
  &::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 200px;
  background: linear-gradient(90deg, transparent 0%, #9bb0c7 20%, #b8cce0 35%, #d0e0f0 50%, #b8cce0 65%, #9bb0c7 80%, transparent 100%);
  animation: ${shimmerAnimation} 1.5s infinite ease-in-out;
  animation-delay: 0.5s;
}
`;

const LoadingText = styled.div`
  font-size: 14px;
  color: #333333;
  font-weight: 400;
  text-align: center;
  font-family: 'Helvetica', 'Helvetica Neue', Arial, sans-serif;
`;

export const LoadingScreen: React.FC = () => {
  const [showProgress, setShowProgress] = useState(false);

  useEffect(() => {
    // Start the progress animation after a brief delay
    const timer = setTimeout(() => {
      setShowProgress(true);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      <LoadingContainer>
        <BrandingContainer>
          <BrandText>
            KARPO STUDIO
          </BrandText>
        </BrandingContainer>

        <ProgressContainer>
          <ProgressTrack>
            <ProgressBar $animate={showProgress} />
          </ProgressTrack>
        </ProgressContainer>

        <LoadingText>
          Loading Unified Orders Dashboard...
        </LoadingText>
      </LoadingContainer>
    </WixDesignSystemProvider>
  );
};