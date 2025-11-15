import React from 'react';
import {
  Drawer,
  DrawerHeader,
  DrawerHeaderTitle,
  DrawerBody,
  Button,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { ThemePicker } from './ThemePicker';

interface SettingsPanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const useStyles = makeStyles({
  drawer: {
    width: '320px',
  },
  section: {
    marginBottom: tokens.spacingVerticalXXL,
  },
  sectionTitle: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    marginBottom: tokens.spacingVerticalM,
    color: tokens.colorNeutralForeground1,
  },
});

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onOpenChange }) => {
  const styles = useStyles();

  return (
    <Drawer
      open={isOpen}
      onOpenChange={(_, { open }) => onOpenChange(open)}
      position="end"
      className={styles.drawer}
    >
      <DrawerHeader>
        <DrawerHeaderTitle
          action={
            <Button
              appearance="subtle"
              aria-label="Close"
              icon={<Dismiss24Regular />}
              onClick={() => onOpenChange(false)}
            />
          }
        >
          Settings
        </DrawerHeaderTitle>
      </DrawerHeader>

      <DrawerBody>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Appearance</div>
          <ThemePicker />
        </div>
      </DrawerBody>
    </Drawer>
  );
};