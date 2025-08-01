# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Wix unified orders dashboard application built with React, TypeScript, and MobX. It provides comprehensive order management capabilities including fulfillment, tracking, analytics, and real-time order updates for e-commerce stores.

## Development Commands

```bash
# Start development server
npm run dev

# Build the application
npm run build

# Type checking
npm run typecheck

# Release to production
npm run release

# Preview the application
npm run preview

# Generate new components/pages
npm run generate

# View application logs
npm run logs
```

## Architecture Overview

### Core Structure
- **Frontend**: React 16.14.0 with @wix/design-system components
- **State Management**: MobX with centralized stores (RootStore pattern)
- **Backend**: Wix web methods for API endpoints
- **Styling**: Styled-components with Wix design system

### Key Directories

#### `/src/dashboard/` - Frontend Application
- **`stores/`** - MobX stores for state management
  - `RootStore.ts` - Main store container
  - `OrderStore.ts` - Order data and state
  - `UIStore.ts` - UI state and form management  
  - `SettingsStore.ts` - Application settings
- **`controllers/`** - Business logic controllers
  - `OrderController.ts` - Main order management logic with real-time updates
  - `FulfillmentController.ts` - Order fulfillment operations
- **`services/`** - API and utility services
  - `OrderService.ts` - Core order API integration with per-item fulfillment support
  - `RealtimeOrderService.ts` - Real-time order polling
  - `AnalyticsService.ts` - Analytics data fetching
  - `AdvancedSearchService.ts` - Advanced order search functionality
- **`components/`** - React components organized by feature
- **`pages/`** - Top-level page components
- **`hooks/`** - Custom React hooks
- **`types/`** - TypeScript type definitions

#### `/src/backend/` - Wix Web Methods (Server-side)
- **`orders-api.web.ts`** - Main orders API with enhanced fulfillment support
- **`fulfillment-elevated.web.ts`** - Advanced fulfillment methods
- **`fulfillment-per-item.web.ts`** - Per-item fulfillment capabilities
- **`services/`** - Backend service utilities
- **`utils/`** - Backend utility functions

### Key Architectural Patterns

#### MobX State Management
The application uses a centralized store pattern with `RootStore` containing all sub-stores. State mutations happen through store methods, and React components observe state changes.

#### Controller Pattern
Controllers like `OrderController` orchestrate business logic between stores, services, and UI components. They handle complex operations like search, fulfillment, and real-time updates.

#### Service Layer
Services abstract API calls and external integrations. The `OrderService` handles all order-related API operations with comprehensive error handling and retry logic.

#### Real-time Architecture
The application implements real-time order updates through polling (`RealtimeOrderService`) with smart duplicate detection and user notification management.

## Key Features

### Order Management
- Advanced search with caching and API fallback
- Per-item fulfillment with tracking support
- Bulk operations (fulfillment, status updates)
- Real-time order notifications with sound alerts
- Comprehensive order status tracking

### Fulfillment System
- Traditional full-order fulfillment
- Per-item fulfillment with quantity tracking
- Multiple shipping carrier support
- Custom tracking URL support
- Email notification management

### Analytics Integration
- Wix Analytics API integration with fallback calculations
- Period-based analytics with comparison data
- Order-based metrics calculation
- Real-time visitor tracking

## Development Guidelines

### State Management
- Use MobX stores for all state mutations
- Access stores through controllers when possible
- Keep components as observers of store state

### API Integration
- All backend calls go through web methods in `/src/backend/`
- Use elevated permissions for sensitive operations
- Implement comprehensive error handling with retries

### Real-time Updates
- Real-time polling is handled by `RealtimeOrderService`
- Duplicate detection prevents notification spam
- Sound notifications require user interaction to enable

### Fulfillment Operations
- Use `OrderService.fulfillOrder()` for all fulfillment operations
- Support both full-order and per-item fulfillment modes
- Validate items before fulfillment operations
- Handle tracking information and email notifications

### Search Functionality
- `AdvancedSearchService` provides cached search with API fallback
- Search includes customer info, order numbers, and product details
- Debounced search input with real-time UI feedback

## Wix Integration Specifics

- Built for Wix platform using @wix/cli-app
- Uses @wix/ecom for order management
- Integrates with @wix/dashboard for UI components
- Web methods require proper permission configuration
- CORS handling for API endpoints

## Common Issues & Solutions

### Order Loading
- If orders fail to load, check `testOrdersConnection` in orders-api.web.ts
- Implement exponential backoff for retry logic
- Handle initialization timeouts for @wix/ecom imports

### Fulfillment Problems
- Validate item quantities before fulfillment
- Check carrier mapping in fulfillment methods
- Ensure proper elevated permissions for email sending

### Real-time Updates
- Sound notifications require user interaction
- Duplicate order detection uses Set-based tracking
- Initial load orders don't trigger notifications

### Search Performance
- Advanced search uses local cache first, then API
- Implement proper debouncing for search inputs
- Handle search timeouts and fallback to basic search