import React, { useState, useMemo } from 'react';
import { ChatInterface } from './ChatInterface';
import { SettingsPanel } from './core/SettingsPanel';
import { BuiltWithBadge } from './core/BuiltWithBadge';
import { useAppState } from '../hooks/useAppState';
import { useAuth } from '../hooks/useAuth';
import { ChatService } from '../services/chatService';
import { useAppContext } from '../contexts/AppContext';
import styles from './AgentPreview.module.css';

interface AgentPreviewProps {
  agentId: string;
  agentName: string;
  agentDescription?: string;
  agentLogo?: string;
}

export const AgentPreview: React.FC<AgentPreviewProps> = ({ agentName, agentDescription, agentLogo }) => {
  const { chat } = useAppState();
  const { dispatch } = useAppContext();
  const { getAccessToken } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Create service instances
  const apiUrl = import.meta.env.VITE_API_URL || '/api';
  
  const chatService = useMemo(() => {
    return new ChatService(apiUrl, getAccessToken, dispatch);
  }, [apiUrl, getAccessToken, dispatch]);

  const handleSendMessage = async (text: string, files?: File[]) => {
    await chatService.sendMessage(text, chat.currentConversationId, files);
  };

  const handleClearError = () => {
    chatService.clearError();
  };

  const handleNewChat = () => {
    chatService.clearChat();
  };

  const handleCancelStream = () => {
    chatService.cancelStream();
  };

  return (
    <div className={styles.content}>
      <div className={styles.mainContent}>
        <ChatInterface 
          messages={chat.messages}
          status={chat.status}
          error={chat.error}
          streamingMessageId={chat.streamingMessageId}
          onSendMessage={handleSendMessage}
          onClearError={handleClearError}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onNewChat={handleNewChat}
          onCancelStream={handleCancelStream}
          hasMessages={chat.messages.length > 0}
          disabled={false}
          agentName={agentName}
          agentDescription={agentDescription}
          agentLogo={agentLogo}
        />
        
        <BuiltWithBadge className={styles.builtWithBadge} />
      </div>
      
      <SettingsPanel
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />
    </div>
  );
};
