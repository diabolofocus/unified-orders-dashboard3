// utils/production-monitor.ts - Production monitoring and health checks

interface HealthCheckResult {
    name: string;
    status: 'healthy' | 'unhealthy' | 'warning';
    message: string;
    timestamp: number;
    details?: any;
}

interface PerformanceMetrics {
    loadTime: number;
    apiResponseTime: number;
    errorRate: number;
    timestamp: number;
}

class ProductionMonitor {
    private healthChecks: Map<string, HealthCheckResult> = new Map();
    private performanceMetrics: PerformanceMetrics[] = [];
    private errorLog: Array<{ error: any; timestamp: number; context: string }> = [];
    private readonly MAX_METRICS_HISTORY = 100;
    private readonly MAX_ERROR_LOG = 50;

    /**
     * Log an error with context for monitoring
     */
    logError(error: any, context: string = 'general') {
        const errorEntry = {
            error: error instanceof Error ? {
                message: error.message,
                stack: error.stack,
                name: error.name
            } : error,
            timestamp: Date.now(),
            context
        };

        this.errorLog.unshift(errorEntry);
        
        // Keep only the last MAX_ERROR_LOG entries
        if (this.errorLog.length > this.MAX_ERROR_LOG) {
            this.errorLog = this.errorLog.slice(0, this.MAX_ERROR_LOG);
        }

        // Log to console in production for external monitoring tools
        if (this.isProduction()) {
            console.error(`[PROD-MONITOR] ${context}:`, error);
        }
    }

    /**
     * Record performance metrics
     */
    recordPerformance(metrics: Omit<PerformanceMetrics, 'timestamp'>) {
        const performanceEntry = {
            ...metrics,
            timestamp: Date.now()
        };

        this.performanceMetrics.unshift(performanceEntry);
        
        // Keep only the last MAX_METRICS_HISTORY entries
        if (this.performanceMetrics.length > this.MAX_METRICS_HISTORY) {
            this.performanceMetrics = this.performanceMetrics.slice(0, this.MAX_METRICS_HISTORY);
        }
    }

    /**
     * Run a health check
     */
    async runHealthCheck(name: string, checkFunction: () => Promise<any>): Promise<HealthCheckResult> {
        const startTime = Date.now();
        let result: HealthCheckResult;

        try {
            const checkResult = await Promise.race([
                checkFunction(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Health check timeout')), 10000)
                )
            ]);

            const responseTime = Date.now() - startTime;
            
            result = {
                name,
                status: responseTime > 5000 ? 'warning' : 'healthy',
                message: responseTime > 5000 
                    ? `Slow response (${responseTime}ms)` 
                    : `Healthy (${responseTime}ms)`,
                timestamp: Date.now(),
                details: { responseTime, result: checkResult }
            };
        } catch (error) {
            result = {
                name,
                status: 'unhealthy',
                message: error instanceof Error ? error.message : String(error),
                timestamp: Date.now(),
                details: { error }
            };
            
            this.logError(error, `health-check-${name}`);
        }

        this.healthChecks.set(name, result);
        return result;
    }

    /**
     * Get current health status
     */
    getHealthStatus(): { overall: 'healthy' | 'unhealthy' | 'warning'; checks: HealthCheckResult[] } {
        const checks = Array.from(this.healthChecks.values());
        
        if (checks.length === 0) {
            return { overall: 'warning', checks: [] };
        }

        const hasUnhealthy = checks.some(check => check.status === 'unhealthy');
        const hasWarning = checks.some(check => check.status === 'warning');

        let overall: 'healthy' | 'unhealthy' | 'warning' = 'healthy';
        if (hasUnhealthy) overall = 'unhealthy';
        else if (hasWarning) overall = 'warning';

        return { overall, checks };
    }

    /**
     * Get error rate over the last period
     */
    getErrorRate(periodMs: number = 60000): number {
        const now = Date.now();
        const recentErrors = this.errorLog.filter(
            entry => now - entry.timestamp < periodMs
        );
        
        const totalRequests = this.performanceMetrics.filter(
            metric => now - metric.timestamp < periodMs
        ).length;

        if (totalRequests === 0) return 0;
        return (recentErrors.length / totalRequests) * 100;
    }

    /**
     * Get average API response time
     */
    getAverageResponseTime(periodMs: number = 60000): number {
        const now = Date.now();
        const recentMetrics = this.performanceMetrics.filter(
            metric => now - metric.timestamp < periodMs
        );

        if (recentMetrics.length === 0) return 0;
        
        const totalResponseTime = recentMetrics.reduce(
            (sum, metric) => sum + metric.apiResponseTime, 0
        );

        return totalResponseTime / recentMetrics.length;
    }

    /**
     * Check if running in production
     */
    isProduction(): boolean {
        return !window.location.hostname.includes('localhost') && 
               !window.location.hostname.includes('127.0.0.1');
    }

    /**
     * Get monitoring summary for dashboard
     */
    getSummary() {
        const health = this.getHealthStatus();
        const errorRate = this.getErrorRate();
        const avgResponseTime = this.getAverageResponseTime();
        const recentErrors = this.errorLog.slice(0, 5);

        return {
            health: health.overall,
            errorRate: Math.round(errorRate * 100) / 100,
            avgResponseTime: Math.round(avgResponseTime),
            recentErrors: recentErrors.map(entry => ({
                context: entry.context,
                message: entry.error?.message || String(entry.error),
                timestamp: entry.timestamp
            })),
            isProduction: this.isProduction(),
            timestamp: Date.now()
        };
    }

    /**
     * Start automatic health checks (call this on app startup)
     */
    startMonitoring(healthChecks: Array<{ name: string; check: () => Promise<any>; interval: number }>) {
        if (!this.isProduction()) {
            console.log('🔍 Production monitoring disabled in development');
            return;
        }

        // Starting production monitoring
        
        healthChecks.forEach(({ name, check, interval }) => {
            // Run initial check
            this.runHealthCheck(name, check);
            
            // Set up recurring checks
            setInterval(() => {
                this.runHealthCheck(name, check);
            }, interval);
        });

        // Log summary every 5 minutes
        setInterval(() => {
            const summary = this.getSummary();
            console.log('📊 Production Monitor Summary:', summary);
        }, 5 * 60 * 1000);
    }
}

// Export singleton instance
export const productionMonitor = new ProductionMonitor();

// Export utility functions for easy access
export const logProductionError = (error: any, context?: string) => {
    productionMonitor.logError(error, context);
};

export const recordPerformanceMetrics = (metrics: Omit<PerformanceMetrics, 'timestamp'>) => {
    productionMonitor.recordPerformance(metrics);
};

export const getProductionHealth = () => {
    return productionMonitor.getSummary();
};