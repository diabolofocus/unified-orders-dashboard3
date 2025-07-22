// services/ApiClient.ts
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message: string;
    error?: string;
}

export interface ApiRequestOptions {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
}

export class ApiClient {
    private readonly defaultTimeout = 30000; // 30 seconds
    private readonly defaultRetries = 3;
    private readonly defaultRetryDelay = 1000; // 1 second

    /**
     * Call a backend web method with error handling and retries
     */
    async callBackendMethod<T = any>(
        methodPath: string,
        methodName: string,
        params: any = {},
        options: ApiRequestOptions = {}
    ): Promise<ApiResponse<T>> {
        const { timeout = this.defaultTimeout, retries = this.defaultRetries, retryDelay = this.defaultRetryDelay } = options;

        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                // Dynamic import of backend module
                const backendModule = await Promise.race([
                    import(methodPath),
                    this.createTimeoutPromise(timeout)
                ]);

                if (!backendModule[methodName] || typeof backendModule[methodName] !== 'function') {
                    throw new Error(`Method ${methodName} not found in ${methodPath}`);
                }

                // Call the backend method
                const result = await backendModule[methodName](params);

                return {
                    success: true,
                    data: result,
                    message: 'Success'
                };

            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                // Don't retry on certain errors
                if (this.shouldNotRetry(lastError)) {
                    break;
                }

                // Wait before retrying (except on last attempt)
                if (attempt < retries) {
                    await this.delay(retryDelay * (attempt + 1)); // Exponential backoff
                }
            }
        }

        return {
            success: false,
            message: `Failed after ${retries + 1} attempts: ${lastError?.message}`,
            error: lastError?.message
        };
    }

    /**
     * Get backend method with automatic error handling
     */
    async getBackendMethod<T extends (...args: any[]) => any>(
        methodPath: string,
        methodName: string
    ): Promise<T | null> {
        try {
            const backendModule = await import(methodPath);

            if (!backendModule[methodName] || typeof backendModule[methodName] !== 'function') {
                console.error(`Method ${methodName} not found in ${methodPath}`);
                return null;
            }

            return backendModule[methodName] as T;
        } catch (error) {
            console.error(`Failed to import backend method ${methodName}:`, error);
            return null;
        }
    }

    /**
     * Create a promise that rejects after a timeout
     */
    private createTimeoutPromise(timeout: number): Promise<never> {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout);
        });
    }

    /**
     * Check if error should not trigger a retry
     */
    private shouldNotRetry(error: Error): boolean {
        const noRetryMessages = [
            'not found',
            'unauthorized',
            'forbidden',
            'bad request',
            'invalid parameter'
        ];

        return noRetryMessages.some(msg =>
            error.message.toLowerCase().includes(msg)
        );
    }

    /**
     * Delay execution for specified milliseconds
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export singleton instance
export const apiClient = new ApiClient();