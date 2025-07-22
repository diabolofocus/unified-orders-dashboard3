// types/UI.ts
export interface UIState {
    loading: boolean;
    refreshing: boolean;
    loadingMore: boolean;
    submitting: boolean;
    trackingNumber: string;
    selectedCarrier: string;
    trackingUrl: string;
}

export interface ShippingCarrier {
    id: string;
    value: string;
    urlTemplate?: string; // For custom carriers
}

// Add these to your existing types/UI.ts file

export interface SupportUIState extends UIState {
    activeTab: 'help' | 'about' | 'features';
    expandedFaq: number | null;
    systemInfoCollected: boolean;
    formInitialized: boolean;
}

export interface ToastConfig {
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    duration?: number;
}

export interface SupportTabItem {
    id: string;
    title: React.ReactNode;
    content: React.ReactNode;
}