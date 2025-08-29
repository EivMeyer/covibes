# CoVibe Client

A modern React TypeScript frontend for the CoVibe collaborative coding platform.

## Features

- 🚀 **Modern Stack**: React 18+ with TypeScript and Vite for fast development
- 🎨 **Tailwind CSS**: Utility-first styling with custom design system
- 🔌 **Real-time Communication**: Socket.io integration for live collaboration
- 🔒 **Type Safety**: Strict TypeScript configuration with comprehensive type definitions
- 📦 **Modular Architecture**: Well-organized component structure
- 🪝 **Custom Hooks**: Reusable hooks for auth, socket management, and data fetching

## Project Structure

```
src/
├── components/          # React components
│   ├── ui/             # Reusable UI components
│   ├── features/       # Feature-specific components
│   └── layout/         # Layout components
├── context/            # React Context providers
├── hooks/              # Custom React hooks
├── services/           # API and external service integrations
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── pages/              # Page-level components
└── assets/             # Static assets
```

## Getting Started

### Prerequisites

- Node.js 16.x or higher
- npm or yarn
- CoVibe backend server running on port 3001

### Installation

1. Navigate to the client directory:
```bash
cd client
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000` with API calls automatically proxied to the backend at `http://localhost:3001`.

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build production bundle
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint for code quality checks
- `npm run lint:fix` - Run ESLint and fix automatically fixable issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check if code is formatted correctly
- `npm run type-check` - Run TypeScript compiler without emitting files
- `npm test` - Run tests in watch mode
- `npm run test:run` - Run tests once
- `npm run test:ui` - Open Vitest UI for interactive testing
- `npm run test:coverage` - Generate test coverage report

## Configuration

### Environment Setup

The Vite development server is configured to:
- Run on port 3000
- Proxy API calls to `http://localhost:3001/api`
- Proxy WebSocket connections to `http://localhost:3001/socket.io`

### TypeScript Configuration

The project uses strict TypeScript settings including:
- Strict mode enabled
- Path aliases configured (`@/*` maps to `src/*`)
- Additional strict checks for better type safety

### Tailwind CSS

Custom design system with:
- Primary color palette (blue tones)
- Secondary color palette (gray tones)  
- Utility classes for buttons, forms, and cards
- Responsive design support

## API Integration

### Authentication

The app handles authentication through:
- JWT tokens stored in localStorage
- Automatic token injection in API requests
- Redirect to login on 401 responses

### Real-time Features

WebSocket integration provides:
- Team collaboration features
- Live agent output streaming
- Chat messaging
- User presence indicators

## Type Definitions

Comprehensive TypeScript interfaces for:
- **User & Team Management**: User profiles, team data, permissions
- **Agent System**: Agent types, statuses, commands, and output
- **Real-time Communication**: WebSocket events, chat messages
- **API Responses**: Structured response types with error handling

## Development Guidelines

### Component Organization

- **UI Components**: Reusable, generic components in `src/components/ui/`
- **Feature Components**: Business logic components in `src/components/features/`
- **Layout Components**: Page structure components in `src/components/layout/`

### State Management

- **React Context**: Global app state via `AppContext`
- **Custom Hooks**: Encapsulated logic for auth, socket, agents
- **Local State**: Component-specific state with `useState`

### Styling

- Use Tailwind utility classes for styling
- Custom component classes defined in `src/index.css`
- Responsive design with mobile-first approach

## Testing

This project includes comprehensive test coverage using Vitest and React Testing Library:

### Test Structure

```
src/
├── components/ui/__tests__/    # UI component tests
├── hooks/__tests__/            # Hook tests
├── test/                       # Test utilities and integration tests
│   ├── setup.ts               # Test setup configuration
│   ├── utils.tsx              # Custom render functions
│   └── mocks/                 # API and service mocks
└── **/*.test.ts(x)            # Test files alongside source code
```

### Running Tests

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run tests with coverage report
npm run test:coverage

# Open interactive test UI
npm run test:ui
```

### Test Coverage

Current test coverage includes:
- **UI Components**: 100% coverage for Button, Card, Input, Modal, LoadingSpinner, ErrorBoundary
- **Hooks**: Comprehensive tests for useAuth hook with mocked API services
- **API Integration**: Service interface validation and type safety tests
- **WebSocket**: Basic connection and event handling tests

Coverage targets:
- **Statements**: >70% overall, 100% for critical UI components
- **Branches**: >80% for business logic
- **Functions**: >85% for public APIs

### Writing Tests

Use the provided test utilities:

```typescript
import { render, screen } from '@/test/utils'
import { MyComponent } from '../MyComponent'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Expected text')).toBeInTheDocument()
  })
})
```

## Contributing

When adding new features:

1. Create TypeScript interfaces in `src/types/`
2. Add API methods to `src/services/api.ts`
3. Create custom hooks for complex state logic
4. Build reusable UI components
5. Follow the established naming conventions
6. Ensure type safety throughout
7. **Write tests** for all new functionality
8. **Maintain >80% test coverage** for critical components
9. **Run `npm run type-check`** to ensure no TypeScript errors
10. **Format code** with `npm run format` before committing

## Integration with Backend

This client is designed to work with the CoVibe backend server. Ensure the backend is running on port 3001 with the following endpoints:

- **Authentication**: `/api/auth/*`
- **Team Management**: `/api/team/*`
- **Agent Operations**: `/api/agents/*`
- **VM Configuration**: `/api/vm/*`
- **WebSocket**: `/socket.io`

## Next Steps

This foundation provides:
- ✅ Complete project setup and configuration
- ✅ Type-safe API integration layer
- ✅ Real-time WebSocket communication
- ✅ Authentication and state management
- ✅ Modern development tooling

Ready for implementation of:
- 🔲 Authentication UI components (login/register forms)
- 🔲 Main dashboard and agent management
- 🔲 Chat interface and real-time features
- 🔲 Settings and team configuration
- 🔲 Mobile-responsive design
