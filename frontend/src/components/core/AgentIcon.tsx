import { Avatar } from '@fluentui/react-components';
import { Bot24Regular } from '@fluentui/react-icons';

interface AgentIconProps {
  alt?: string;
  size?: 'small' | 'medium' | 'large';
}

export function AgentIcon({ 
  alt = "AI Assistant", 
  size = 'medium' 
}: AgentIconProps) {
  const sizeMap: Record<string, number> = {
    small: 32,
    medium: 40,
    large: 48,
  };

  return (
    <Avatar
      aria-label={alt}
      icon={<Bot24Regular />}
      size={sizeMap[size] as any}
      color="brand"
    />
  );
}
