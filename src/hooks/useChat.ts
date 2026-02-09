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
  const sendMessage = useCallback(async (content: string, files?: File[] | Record<string, any>) => {
    // Determine if files is actually files or context
    const isFileArray = Array.isArray(files) && files.length > 0 && files[0] instanceof File;
    let contextData: Record<string, any> | undefined = isFileArray ? undefined : files as Record<string, any> | undefined;
    const uploadedFiles = isFileArray ? files as File[] : undefined;

    // Process uploaded files (Vision & Env)
    if (uploadedFiles && uploadedFiles.length > 0) {
      contextData = contextData || {};

      // 1. Process Images for Vision Debugging
      const imageFiles = uploadedFiles.filter(f => f.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        const images = await Promise.all(imageFiles.map(file => new Promise<{ data: string, mime_type: string }>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            // Reader result is data:image/png;base64,...
            const base64 = (reader.result as string).split(',')[1];
            resolve({
              data: base64,
              mime_type: file.type
            });
          };
          reader.readAsDataURL(file);
        })));
        contextData.images = images;
      }

      // 2. Process .env files
      const envFiles = uploadedFiles.filter(f => f.name.endsWith('.env') || f.name === '.env');
      if (envFiles.length > 0) {
        // Read first .env file and parse it
        // Basic parsing: split by newlines, ignore #
        const text = await envFiles[0].text();
        const envVars: Record<string, string> = {};
        text.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [key, ...values] = trimmed.split('=');
            envVars[key.trim()] = values.join('=').trim().replace(/^["']|["']$/g, '');
          }
        });
        contextData.env_vars = envVars;
      }
    }

    // Add user message to global UI state
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      role: 'user',
      content: uploadedFiles && uploadedFiles.length > 0
        ? `${content}\n\n📎 Attached: ${uploadedFiles.map(f => f.name).join(', ')}`
        : content,
      timestamp: new Date(),
      // Store images in metadata for local preview if needed
      metadata: contextData?.images ? { images: contextData.images } : undefined
    };

    // ✅ Naming Interception Logic
    const deployKeywords = ['deploy', 'do it', 'go', 'start', 'proceed', 'retry', 'try again'];
    const autoNaming = localStorage.getItem('devgem_param_auto_naming') !== 'false';
    const isDeployIntent = deployKeywords.some(kw => content.toLowerCase().includes(kw));

    if (isDeployIntent && !autoNaming && !contextData?.images) { // Skip naming prompt if focusing on vision debugging
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

    // 🧠 GEMINI BRAIN: Vision Debugging - detect image uploads
    if (contextData?.images && contextData.images.length > 0) {
      // Send as vision_debug message for AI-powered screenshot analysis
      const imageObj = contextData.images[0]; // Use first image
      const base64Data = imageObj.data.split(',')[1]; // Remove data:image/png;base64, prefix

      wsSendMessage({
        type: 'vision_debug' as any,
        image_base64: base64Data,
        description: content || 'Please analyze this screenshot for UI issues',
      } as any);
      return;
    }

    // Send to backend (regular message)
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

    // ✅ FAANG-LEVEL FIX: Automatically inject repo_url from context if available
    // This bridges the gap between session resets and backend orientation
    const repoUrl = messages.find(m => m.content.includes('github.com'))?.content.match(/https:\/\/github\.com\/[^\s)\]]+/)?.[0] || '';

    // ✅ FAANG-LEVEL FIX: Send structured message directly, NOT wrapped in 'message' type
    // This ensures the backend handles it as a specific event (e.g. env_vars_uploaded)
    // instead of treating it as chat text which causes LLM hallucinations.
    wsSendMessage({
      type: type as any,
      ...data,
      // Deterministic propagation
      repo_url: data.repo_url || repoUrl
    } as any);
  }, [isConnected, wsSendMessage, messages]);

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
      sendMessage(action.action, action.payload);
    } else if (action.url) {
      window.open(action.url, '_blank');
    }
  }, [messages, sendMessage, setMessages]);

  return {
    messages,
    setMessages, // ✅ Expose setter
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
