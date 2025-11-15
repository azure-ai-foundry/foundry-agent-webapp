import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsalAuthentication } from "@azure/msal-react";
import { Spinner } from '@fluentui/react-components';
import { useAppState } from './hooks/useAppState';
import { InteractionType } from "@azure/msal-browser";
import { ErrorBoundary } from "./components/core/ErrorBoundary";
import { AgentPreview } from "./components/AgentPreview";
import { loginRequest } from "./config/authConfig";
import { useState, useEffect } from "react";
import { useAuth } from "./hooks/useAuth";
import type { IAgentMetadata } from "./types/chat";
import "./App.css";

export interface ChatInterfaceRef {
  clearChat: () => void;
  loadConversation: (conversationId: string) => Promise<void>;
}

function App() {
  // This hook handles authentication automatically - redirects if not authenticated
  useMsalAuthentication(InteractionType.Redirect, loginRequest);
  const { auth } = useAppState();
  const { getAccessToken } = useAuth();
  const [agentMetadata, setAgentMetadata] = useState<IAgentMetadata | null>(null);
  const [isLoadingAgent, setIsLoadingAgent] = useState(true);

  useEffect(() => {
    const fetchAgentMetadata = async () => {
      if (auth.status !== 'authenticated') return;

      try {
        const token = await getAccessToken();
        const apiUrl = import.meta.env.VITE_API_URL || '/api';
        
        const response = await fetch(`${apiUrl}/agent`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        setAgentMetadata(data);
        
        // Update document title with agent name
        document.title = data.name ? `${data.name} - Azure AI Agent` : 'Azure AI Agent';
      } catch (error) {
        console.error('Error fetching agent metadata:', error);
        // Fallback data keeps UI functional on error
        setAgentMetadata({
          id: 'fallback-agent',
          object: 'agent',
          createdAt: Date.now() / 1000,
          name: 'Azure AI Agent',
          description: 'Your intelligent conversational partner powered by Azure AI',
          model: 'gpt-4o-mini',
          metadata: { logo: 'Avatar_Default.svg' }
        });
        document.title = 'Azure AI Agent';
      } finally {
        setIsLoadingAgent(false);
      }
    };

    fetchAgentMetadata();
  }, [auth.status]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ErrorBoundary>
      {auth.status === 'initializing' || isLoadingAgent ? (
        <div className="app-container" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh', 
          flexDirection: 'column', 
          gap: '1rem' 
        }}>
          <Spinner size="large" />
          <p style={{ margin: 0 }}>
            {auth.status === 'initializing' ? 'Preparing your session...' : 'Loading agent...'}
          </p>
        </div>
      ) : (
        <>
          <AuthenticatedTemplate>
            {agentMetadata && (
              <div className="app-container">
                <AgentPreview 
                  agentId={agentMetadata.id}
                  agentName={agentMetadata.name}
                  agentDescription={agentMetadata.description || undefined}
                  agentLogo={agentMetadata.metadata?.logo}
                />
              </div>
            )}
          </AuthenticatedTemplate>
          <UnauthenticatedTemplate>
            <div className="app-container" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '100vh'
            }}>
              <p>Signing in...</p>
            </div>
          </UnauthenticatedTemplate>
        </>
      )}
    </ErrorBoundary>
  );
}

export default App;
