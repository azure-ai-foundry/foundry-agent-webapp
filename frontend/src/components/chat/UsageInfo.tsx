import { Body1, Text, Divider } from '@fluentui/react-components';
import { InfoRegular } from '@fluentui/react-icons';
import type { IUsageInfo } from '../../types/chat';
import styles from './UsageInfo.module.css';

interface UsageInfoProps {
  info: IUsageInfo;
  duration?: number;
}

export const UsageInfo: React.FC<UsageInfoProps> = ({ info, duration }) => {
  const durationMs = duration ?? info.duration;
  const totalTokens = info.totalTokens ?? (info.promptTokens + info.completionTokens);
  
  return (
    <div className={styles.usageInfoContainer}>
      <div className={styles.usageSummary}>
        {durationMs !== undefined && (
          <>
            <span>{durationMs.toFixed(0)}ms</span>
            <span className={styles.divider}>|</span>
          </>
        )}
        <span>{totalTokens} tokens</span>
        <button 
          className={styles.infoButton}
          title="Usage information"
          aria-label="Show token usage details"
          type="button"
        >
          <InfoRegular className={styles.infoIcon} />
        </button>
      </div>
      <div className={styles.usageDetails}>
        <Text weight="semibold" size={200}>Usage Information</Text>
        <Divider className={styles.detailsDivider} />
        <div className={styles.detailsList}>
          <div className={styles.detailsItem}>
            <Body1 className={styles.detailLabel}>Input</Body1>
            <Body1 className={styles.detailValue}>{info.promptTokens} tokens</Body1>
          </div>
          <div className={styles.detailsItem}>
            <Body1 className={styles.detailLabel}>Output</Body1>
            <Body1 className={styles.detailValue}>{info.completionTokens} tokens</Body1>
          </div>
        </div>
      </div>
    </div>
  );
};
