import { makeStyles, tokens, Button, Badge } from '@fluentui/react-components';
import { Dismiss24Regular, ImageRegular } from '@fluentui/react-icons';
import { useState, useEffect } from 'react';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    marginBottom: tokens.spacingVerticalS,
  },
  previewItem: {
    position: 'relative',
    width: '80px',
    height: '80px',
    borderRadius: tokens.borderRadiusMedium,
    overflow: 'hidden',
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  placeholderIcon: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colorNeutralForeground3,
  },
  removeButton: {
    position: 'absolute',
    top: '2px',
    right: '2px',
    minWidth: '20px',
    minHeight: '20px',
    padding: '2px',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: '50%',
    boxShadow: tokens.shadow4,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  sizeBadge: {
    position: 'absolute',
    bottom: '4px',
    left: '4px',
    fontSize: '10px',
    padding: '2px 4px',
  },
});

interface FilePreviewProps {
  files: File[];
  onRemove: (index: number) => void;
  disabled?: boolean;
}

export const FilePreview: React.FC<FilePreviewProps> = ({ files, onRemove, disabled }) => {
  const styles = useStyles();
  const [thumbnails, setThumbnails] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    files.forEach((file, index) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            setThumbnails(prev => new Map(prev).set(index, e.target!.result as string));
          }
        };
        reader.readAsDataURL(file);
      }
    });

    // Cleanup: revoke old object URLs that are no longer needed
    return () => {
      thumbnails.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [files]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 10) / 10 + sizes[i];
  };

  if (files.length === 0) return null;

  return (
    <div className={styles.container} role="list" aria-label="Attached files">
      {files.map((file, index) => (
        <div key={index} className={styles.previewItem} role="listitem">
          {thumbnails.get(index) ? (
            <img 
              src={thumbnails.get(index)} 
              alt={file.name}
              className={styles.thumbnail}
            />
          ) : (
            <div className={styles.placeholderIcon}>
              <ImageRegular fontSize={32} />
            </div>
          )}
          <Badge 
            appearance="filled" 
            size="small"
            className={styles.sizeBadge}
          >
            {formatFileSize(file.size)}
          </Badge>
          <Button
            appearance="subtle"
            size="small"
            icon={<Dismiss24Regular />}
            onClick={() => onRemove(index)}
            disabled={disabled}
            aria-label={`Remove ${file.name}`}
            className={styles.removeButton}
          />
        </div>
      ))}
    </div>
  );
};
