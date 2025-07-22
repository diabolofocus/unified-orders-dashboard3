// types/Support.ts
export interface SystemInfo {
    appVersion: string;
    timestamp: string;
    userAgent: string;
    language: string;
    platform: string;
    cookieEnabled: boolean;
    onLine: boolean;
    screenResolution: string;
    timeZone: string;
    referrer: string;
    currentUrl: string;
}

export interface UserInfo {
    email?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    siteId?: string;
    userId?: string;
}

export interface SupportFormData {
    title: string;
    description: string;
    type: 'bug' | 'feature';
}

export interface SubmissionData {
    title: string;
    description: string;
    userEmail?: string;
    userName?: string;
    siteId?: string;
    systemInfo: SystemInfo;
    metadata?: Record<string, any>;
}

export interface SupportApiResponse {
    success: boolean;
    message?: string;
    error?: string;
    submissionId?: string;
    timestamp?: string;
}

export interface CollectionItem {
    _id?: string;
    title: string;
    description: string;
    userEmail?: string;
    userName?: string;
    siteId?: string;
    appVersion: string;
    browserInfo: string;
    status: 'pending' | 'in-progress' | 'completed' | 'rejected';
    priority?: 'low' | 'medium' | 'high' | 'critical';
    submittedAt: string;
    _createdDate?: string;
    _updatedDate?: string;
}

export interface FeatureRequestItem extends CollectionItem {
    category?: string;
    estimatedEffort?: 'small' | 'medium' | 'large';
    businessValue?: 'low' | 'medium' | 'high';
}

export interface BugReportItem extends CollectionItem {
    severity: 'low' | 'medium' | 'high' | 'critical';
    currentPage?: string;
    errorLog?: string;
    reproductionSteps?: string;
    environment?: string;
    deviceType?: 'desktop' | 'mobile' | 'tablet';
}

export interface SupportFormState {
    feature: SupportFormData;
    bug: SupportFormData;
    isSubmitted: {
        feature: boolean;
        bug: boolean;
    };
    isLoading: {
        feature: boolean;
        bug: boolean;
    };
    errors: {
        feature: string[];
        bug: string[];
    };
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}