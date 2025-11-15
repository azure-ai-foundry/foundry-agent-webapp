import { makeStyles, tokens, Button, Text, MessageBar, MessageBarBody, MessageBarActions } from '@fluentui/react-components';
import { DismissRegular, ArrowClockwiseRegular } from '@fluentui/react-icons';

const useStyles = makeStyles({
  container: {
    marginBottom: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
    backgroundColor: tokens.colorPaletteRedBackground2,
    borderLeftWidth: '4px',
    borderLeftStyle: 'solid',
    borderLeftColor: tokens.colorPaletteRedBorder2,
  },
  messageText: {
    color: tokens.colorNeutralForeground1,
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
  },
});

export interface ErrorMessageProps {
  /**
   * Error message to display
   */
  message: string;
  
  /**
   * Whether the error is recoverable (shows retry button)
   */
  recoverable?: boolean;
  
  /**
   * Optional retry handler
   */
  onRetry?: () => void;
  
  /**
   * Optional dismiss handler
   */
  onDismiss?: () => void;
  
  /**
   * Optional custom action button
   */
  customAction?: {
    label: string;
    handler: () => void;
  };
}

/**
 * ErrorMessage component displays error messages with optional recovery actions
 * Used throughout the app for consistent error presentation
 */
export function ErrorMessage({ 
  message, 
  recoverable = false, 
  onRetry, 
  onDismiss,
  customAction 
}: ErrorMessageProps) {
  const styles = useStyles();
  
  // Defensive: ensure message is always a string
  const displayMessage = typeof message === 'string' 
    ? message 
    : 'An error occurred. Please try again.';

  return (
    <MessageBar
      intent="error"
      className={styles.container}
    >
      <MessageBarBody>
        <Text className={styles.messageText}>{displayMessage}</Text>
      </MessageBarBody>
      <MessageBarActions
        containerAction={
          onDismiss ? (
            <Button
              onClick={onDismiss}
              appearance="transparent"
              icon={<DismissRegular />}
              size="small"
              aria-label="Dismiss error"
            />
          ) : undefined
        }
      >
        {recoverable && onRetry && (
          <Button
            onClick={onRetry}
            appearance="primary"
            icon={<ArrowClockwiseRegular />}
            size="small"
          >
            Retry
          </Button>
        )}
        {customAction && (
          <Button
            onClick={customAction.handler}
            appearance="secondary"
            size="small"
          >
            {customAction.label}
          </Button>
        )}
      </MessageBarActions>
    </MessageBar>
  );
}
