/**
 * High-level Chat Hook
 * Abstracts WebSocket complexity for chat UI
 * Optimized for Phase 6: Eternal Session (consumes global context)
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
import { UseChatReturn, ChatMessage, MessageAction } from '@/types/websocket';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook for chat functionality
 * Now a thin wrapper around aggregate WebSocketContext state
 */
export const useChat = (): UseChatReturn => {
  const navigate = useNavigate();
  const {
    connectionStatus,
    isConnected,
    sessionId,
    sendMessage: wsSendMessage,
    messages,
    setMessages,
    isTyping,
    setIsTyping,
    activeDeployment,
    thoughtBuffer,
    resetSession,
    switchSession
  } = useWebSocketContext();

  const { toast } = useToast();

  /**
   * Send a standard chat message
   */
  const sendMessage = useCallback((content: string, files?: File[] | Record<string, any>) => {
    // Determine if files is actually files or context
    const isFileArray = Array.isArray(files) && files.length > 0 && files[0] instanceof File;
    const contextData = isFileArray ? undefined : files as Record<string, any> | undefined;
    const uploadedFiles = isFileArray ? files as File[] : undefined;

    // Add user message to global UI state
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      role: 'user',
      content: uploadedFiles && uploadedFiles.length > 0
        ? `${content}\n\n📎 Attached: ${uploadedFiles.map(f => f.name).join(', ')}`
        : content,
      timestamp: new Date(),
    };

    // ✅ Naming Interception Logic
    const deployKeywords = ['deploy', 'do it', 'go', 'start', 'proceed', 'retry', 'try again'];
    const autoNaming = localStorage.getItem('devgem_param_auto_naming') !== 'false';
    const isDeployIntent = deployKeywords.some(kw => content.toLowerCase().includes(kw));

    if (isDeployIntent && !autoNaming) {
      setMessages(prev => [...prev, userMessage]);

      const repoUrl = messages.find(m => m.content.includes('github.com'))?.content.match(/https:\/\/github\.com\/[^\s)\]]+/)?.[0] || content.match(/https:\/\/github\.com\/[^\s)\]]+/)?.[0] || '';
      const globalDefault = localStorage.getItem('devgem_param_custom_name');
      const defaultName = globalDefault || (repoUrl ? repoUrl.split('/').pop()?.replace('.git', '').toLowerCase().replace(/[^a-z0-9-]/g, '-') : 'servergem-app');

      const promptMessage: ChatMessage = {
        id: `msg_prompt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        role: 'assistant',
        content: "Strategic naming required: Please confirm the service identity before we proceed to Cloud Run deployment.",
        timestamp: new Date(),
        metadata: {
          type: 'request_service_name',
          default_name: defaultName,
          repo_url: repoUrl
        }
      };

      setTimeout(() => {
        setMessages(prev => [...prev, promptMessage]);
      }, 100);
      return;
    }

    setMessages(prev => [...prev, userMessage]);

    // Send to backend
    const success = wsSendMessage({
      type: 'message',
      message: content,
      context: contextData,
    });

    if (!success) {
      toast({
        title: 'Message Queued',
        description: 'Your message will be sent when connection is restored.',
      });
    }
  }, [wsSendMessage, toast, setMessages, messages]);

  /**
   * Send structured data to backend (for env vars, etc.)
   */
  const sendStructuredMessage = useCallback((type: string, data: any) => {
    if (!isConnected) {
      console.warn('[useChat] Not connected, cannot send structured message');
      return;
    }

    wsSendMessage({
      type: 'message' as any,
      message: JSON.stringify({ type, ...data }),
    } as any);
  }, [isConnected, wsSendMessage]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, [setMessages]);

  /**
   * Centralized Action Handler
   */
  const handleActionClick = useCallback((action: MessageAction) => {
    if (action.action === 'deploy_to_cloudrun') {
      const autoNaming = localStorage.getItem('devgem_param_auto_naming') !== 'false';

      if (!autoNaming) {
        const repoUrl = messages.find(m => m.content.includes('github.com'))?.content.match(/https:\/\/github\.com\/[^\s)\]]+/)?.[0] || '';
        const globalDefault = localStorage.getItem('devgem_param_custom_name');
        const defaultName = globalDefault || (repoUrl ? repoUrl.split('/').pop()?.replace('.git', '').toLowerCase().replace(/[^a-z0-9-]/g, '-') : 'servergem-app');

        const promptMessage: ChatMessage = {
          id: `msg_prompt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          role: 'assistant',
          content: "Elevating deployment configuration: Please specify the service identity for this Cloud Run instance.",
          timestamp: new Date(),
          metadata: {
            type: 'request_service_name',
            default_name: defaultName
          }
        };
        setMessages(prev => [...prev, promptMessage]);
        return;
      }
    }

    // Default behavior
    if (action.action) {
      sendMessage(action.action);
    } else if (action.url) {
      window.open(action.url, '_blank');
    }
  }, [messages, sendMessage, setMessages]);

  return {
    messages,
    isConnected,
    isTyping,
    sendMessage,
    clearMessages,
    resetSession,
    connectionStatus,
    sendStructuredMessage,
    activeDeployment,
    thoughtBuffer,
    handleActionClick,
    connect: () => { }, // Handled by provider
    disconnect: () => { }, // Handled by provider
  };
};
