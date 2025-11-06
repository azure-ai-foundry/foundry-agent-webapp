import React, { Component, type ReactNode } from 'react';
import { makeStyles, tokens, Text, Button } from '@fluentui/react-components';
import { ErrorCircleRegular } from '@fluentui/react-icons';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: tokens.spacingVerticalXXL,
    gap: tokens.spacingVerticalL,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  icon: {
    fontSize: '48px',
    color: tokens.colorPaletteRedForeground1,
  },
  title: {
    fontSize: tokens.fontSizeHero800,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  message: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground2,
    textAlign: 'center',
    maxWidth: '600px',
  },
  details: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
    backgroundColor: tokens.colorNeutralBackground3,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    maxWidth: '800px',
    width: '100%',
    overflowX: 'auto',
  },
  errorText: {
    marginBottom: tokens.spacingVerticalS,
  },
  stackTrace: {
    margin: 0,
    fontSize: tokens.fontSizeBase100,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalM,
  },
});

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Optional fallback UI to render on error
   */
  fallback?: (error: Error, resetError: () => void) => ReactNode;
  /**
   * Optional callback when error occurs
   */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary catches React errors and displays fallback UI
 * Prevents entire app from crashing due to component errors
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
    
    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError);
      }

      // Default error UI
      return <DefaultErrorFallback error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

/**
 * Default fallback UI for ErrorBoundary
 */
function DefaultErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  const styles = useStyles();

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className={styles.container}>
      <ErrorCircleRegular className={styles.icon} />
      <Text className={styles.title}>Something went wrong</Text>
      <Text className={styles.message}>
        An unexpected error occurred. You can try refreshing the page or starting a new chat.
      </Text>
      
      {import.meta.env.DEV && error.stack && (
        <div className={styles.details}>
          <div className={styles.errorText}>
            <strong>Error:</strong> {error.message}
          </div>
          <pre className={styles.stackTrace}>
            {error.stack}
          </pre>
        </div>
      )}

      <div className={styles.actions}>
        <Button appearance="primary" onClick={handleReload}>
          Reload Page
        </Button>
        <Button appearance="secondary" onClick={resetError}>
          Try Again
        </Button>
      </div>
    </div>
  );
}
