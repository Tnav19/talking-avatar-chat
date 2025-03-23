import React, { useState, useEffect, useRef } from 'react';
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckedState } from "@radix-ui/react-checkbox";

interface ChatProps {}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const Chat: React.FC<ChatProps> = () => {

  const [region, setRegion] = useState<string>('westus2');
  const [apiKey, setApiKey] = useState<string>('');
  const [privateEndpointEnabled, setPrivateEndpointEnabled] = useState<boolean>(false);
  const [privateEndpoint, setPrivateEndpoint] = useState<string>('');
  const [azureOpenAIEndpoint, setAzureOpenAIEndpoint] = useState<string>('');
  const [azureOpenAIApiKey, setAzureOpenAIApiKey] = useState<string>('');
  const [azureOpenAIDeploymentName, setAzureOpenAIDeploymentName] = useState<string>('');
  const [sessionActive, setSessionActive] = useState<boolean>(false);
  const [sttLocales, setSttLocales] = useState<string>('en-US,de-DE,es-ES,fr-FR,it-IT,ja-JP,ko-KR,zh-CN');
  const [ttsVoice, setTtsVoice] = useState<string>('en-US-AvaMultilingualNeural');
  const [customVoiceEndpointId, setCustomVoiceEndpointId] = useState<string>('');
  const [personalVoiceSpeakerProfileID, setPersonalVoiceSpeakerProfileID] = useState<string>('');
  const [talkingAvatarCharacter, setTalkingAvatarCharacter] = useState<string>('lisa');
  const [talkingAvatarStyle, setTalkingAvatarStyle] = useState<string>('casual-sitting');
  const [useLocalVideoForIdle, setUseLocalVideoForIdle] = useState<boolean>(false);
  const [showSubtitles, setShowSubtitles] = useState<boolean>(false);
  const [showTypeMessage, setShowTypeMessage] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [continuousConversation, setContinuousConversation] = useState<boolean>(false);
  const [customizedAvatar, setCustomizedAvatar] = useState<boolean>(false);
  const [autoReconnectAvatar, setAutoReconnectAvatar] = useState<boolean>(false);
  const [lastSpeakTime, setLastSpeakTime] = useState<Date | undefined>();
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [userClosedSession, setUserClosedSession] = useState<boolean>(false);
  const [imgUrl, setImgUrl] = useState<string>("");
  const [microphoneText, setMicrophoneText] = useState<string>("Start Microphone");
  const [isMicrophoneDisabled, setIsMicrophoneDisabled] = useState<boolean>(false);
  const [userMessage, setUserMessage] = useState<string>("");
  const [showImageUpload, setShowImageUpload] = useState<boolean>(false);
  const [showLocalVideo, setShowLocalVideo] = useState<boolean>(false);
  const [showRemoteVideo, setShowRemoteVideo] = useState<boolean>(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [systemPrompt, setSystemPrompt] = useState<string>("You are an AI assistant that helps people find information.");
  const [speakingText, setSpeakingText] = useState<string>("");
  const [spokenTextQueue, setSpokenTextQueue] = useState<string[]>([]);
  const [repeatSpeakingSentenceAfterReconnection, setRepeatSpeakingSentenceAfterReconnection] = useState<boolean>(true);
  const [currentRecognizedText, setCurrentRecognizedText] = useState<string>("");
  
  // Refs
  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const userMessageRef = useRef<HTMLTextAreaElement>(null);
  const avatarSynthesizerRef = useRef<SpeechSDK.AvatarSynthesizer | null>(null);
  const speechRecognizerRef = useRef<SpeechSDK.SpeechRecognizer | null>(null);

  useEffect(() => {
    const intervalId = setInterval(() => {
      checkHung();
      checkLastSpeak();
    }, 2000);
    return () => clearInterval(intervalId);
  }, [sessionActive, userClosedSession, autoReconnectAvatar, useLocalVideoForIdle, isSpeaking, lastSpeakTime]);

  const handleCheckboxChange = (setter: React.Dispatch<React.SetStateAction<boolean>>) => (checked: CheckedState) => {
    setter(checked === true);
  };

  const handleUserQuery = async (userQuery: string, userQueryHTML: string, imgUrl: string) => {
    if (!azureOpenAIEndpoint || !azureOpenAIApiKey || !azureOpenAIDeploymentName) {
      alert('Please fill in all Azure OpenAI configuration fields.');
      return;
    }

    // Stop any ongoing speech before processing new query
    if (isSpeaking) {
      await stopSpeaking();
    }

    // Add user message to chat
    const userMessage: ChatMessage = {
      role: 'user',
      content: userQuery,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      // Call Azure OpenAI API
      const response = await fetch(`${azureOpenAIEndpoint}/openai/deployments/${azureOpenAIDeploymentName}/chat/completions?api-version=2023-05-15`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': azureOpenAIApiKey
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map(msg => ({ role: msg.role, content: msg.content })),
            { role: 'user', content: userQuery }
          ],
          max_tokens: 800,
          temperature: 0.7,
          top_p: 0.95,
          frequency_penalty: 0,
          presence_penalty: 0
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response from OpenAI');
      }

      const data = await response.json();
      const assistantMessage = data.choices[0].message.content;

      // Add assistant message to chat
      const assistantChatMessage: ChatMessage = {
        role: 'assistant',
        content: assistantMessage,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantChatMessage]);

      // Update chat history display
      if (chatHistoryRef.current) {
        const userDiv = document.createElement('div');
        userDiv.className = 'mb-4 text-right';
        userDiv.innerHTML = `<div class="inline-block bg-blue-100 dark:bg-blue-900 rounded-lg px-4 py-2">${userQuery}</div>`;
        chatHistoryRef.current.appendChild(userDiv);

        const assistantDiv = document.createElement('div');
        assistantDiv.className = 'mb-4';
        assistantDiv.innerHTML = `<div class="inline-block bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2">${assistantMessage}</div>`;
        chatHistoryRef.current.appendChild(assistantDiv);
        chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
      }

      // Make avatar speak the response
      if (avatarSynthesizerRef.current) {
        // Clear any previous speech queue
        setSpokenTextQueue([]);
        setSpeakingText("");
        
        setIsSpeaking(true);
        const ssml = `
          <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="en-US">
            <voice name="${ttsVoice}">
              <mstts:express-as style="chat">
                ${assistantMessage.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
              </mstts:express-as>
            </voice>
          </speak>`;

        try {
          await avatarSynthesizerRef.current.speakSsmlAsync(ssml);
          setIsSpeaking(false);
          setLastSpeakTime(new Date());
        } catch (error) {
          console.error('Error speaking:', error);
          setIsSpeaking(false);
        }
      }
    } catch (error) {
      console.error('Error handling user query:', error);
      alert('Failed to get response from OpenAI. Please check your configuration.');
    }
  };

  const disconnectAvatar = () => {
    if (avatarSynthesizerRef.current) {
      avatarSynthesizerRef.current.close();
      avatarSynthesizerRef.current = null;
    }
    if (speechRecognizerRef.current) {
      speechRecognizerRef.current.close();
      speechRecognizerRef.current = null;
    }
    setSessionActive(false);
  };

  const handleMicrophoneClick = async () => {
    if (!speechRecognizerRef.current) return;
    
    if (microphoneText === 'Stop Microphone') {
      setIsMicrophoneDisabled(true);
      speechRecognizerRef.current.stopContinuousRecognitionAsync(
        () => {
          setMicrophoneText('Start Microphone');
          setIsMicrophoneDisabled(false);
          // When stopping microphone, ensure the type message is shown and populated
          if (currentRecognizedText.trim()) {
            setShowTypeMessage(true);
            setUserMessage(currentRecognizedText);
            // Focus the text area
            if (userMessageRef.current) {
              userMessageRef.current.focus();
            }
          }
        },
        (err) => {
          console.log("Failed to stop continuous recognition:", err);
          setIsMicrophoneDisabled(false);
        }
      );
      return;
    }

    // Stop avatar speaking if it's currently speaking
    if (isSpeaking) {
      await stopSpeaking();
    }

    if (useLocalVideoForIdle) {
      if (!sessionActive) {
        connectAvatar();
      }
      setTimeout(() => {
        audioPlayerRef.current?.play();
      }, 5000);
    } else {
      audioPlayerRef.current?.play();
    }

    setIsMicrophoneDisabled(true);
    setCurrentRecognizedText("");
    // Clear the message input when starting microphone
    setUserMessage("");
    
    // Handle recognizing event for real-time transcription
    speechRecognizerRef.current.recognizing = (s: any, e: SpeechSDK.SpeechRecognitionEventArgs) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizingSpeech) {
        const text = e.result.text;
        if (text.trim() !== '') {
          // Update real-time transcription
          setCurrentRecognizedText(text);
          // Always show and update the type message during recognition
          setShowTypeMessage(true);
          setUserMessage(text);
        }
      }
    };
    
    // Handle recognized event for final results
    speechRecognizerRef.current.recognized = async (s: any, e: SpeechSDK.SpeechRecognitionEventArgs) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
        let userQuery = e.result.text.trim();
        if (userQuery === '') return;

        setCurrentRecognizedText(userQuery);
        setShowTypeMessage(true);
        setUserMessage(userQuery);

        if (!continuousConversation) {
          setIsMicrophoneDisabled(true);
          if (speechRecognizerRef.current) {
            speechRecognizerRef.current.stopContinuousRecognitionAsync(
              () => {
                setMicrophoneText('Start Microphone');
                setIsMicrophoneDisabled(false);
                // Focus the text area after recognition stops
                if (userMessageRef.current) {
                  userMessageRef.current.focus();
                }
              },
              (err) => {
                console.log("Failed to stop continuous recognition:", err);
                setIsMicrophoneDisabled(false);
              }
            );
          }
        }

        handleUserQuery(userQuery, "", "");
      }
    };

    speechRecognizerRef.current.startContinuousRecognitionAsync(
      () => {
        setMicrophoneText('Stop Microphone');
        setIsMicrophoneDisabled(false);
        // Show the type message area when starting recognition
        setShowTypeMessage(true);
      },
      (err) => {
        console.log("Failed to start continuous recognition:", err);
        setIsMicrophoneDisabled(false);
      }
    );
  };

  const handleImageUpload = () => {
    setImgUrl("https://wallpaperaccess.com/full/528436.jpg");
    setShowImageUpload(true);
  };

  const handleMessageBoxKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      const userQuery = e.currentTarget.value;
      if (userQuery !== '') {
        // Stop any ongoing speech before sending new message
        if (isSpeaking) {
          stopSpeaking().then(() => {
            handleUserQuery(userQuery.trim(), "", imgUrl);
          });
        } else {
          handleUserQuery(userQuery.trim(), "", imgUrl);
        }
        setUserMessage('');
        setImgUrl("");
      }
    }
  };

  const checkHung = (): void => {
    if (!sessionActive || userClosedSession) return;
    
    if (!remoteVideoRef.current || remoteVideoRef.current.children.length === 0) {
      if (autoReconnectAvatar) {
        console.log(`[${new Date().toISOString()}] The video stream got disconnected, need reconnect.`);
        setIsReconnecting(true);
        disconnectAvatar();
        connectAvatar();
      }
    }
  };

  const checkLastSpeak = (): void => {
    if (!lastSpeakTime) return;
    
    const currentTime = new Date();
    if (currentTime.getTime() - lastSpeakTime.getTime() > 15000) {
      if (useLocalVideoForIdle && sessionActive && !isSpeaking) {
        disconnectAvatar();
        setShowLocalVideo(true);
        setShowRemoteVideo(false);
        setSessionActive(false);
      }
    }
  };

  const connectAvatar = (): void => {
    if (!apiKey) {
      alert('Please fill in the API key of your speech resource.');
      return;
    }
    
    const speechSynthesisConfig = privateEndpointEnabled
      ? SpeechSDK.SpeechConfig.fromEndpoint(new URL(`wss://${privateEndpoint}tts/cognitiveservices/websocket/v1?enableTalkingAvatar=true`), apiKey)
      : SpeechSDK.SpeechConfig.fromSubscription(apiKey, region);

    speechSynthesisConfig.endpointId = customVoiceEndpointId;

    const avatarConfig = new SpeechSDK.AvatarConfig(
      talkingAvatarCharacter,
      talkingAvatarStyle,
      "H264" as unknown as SpeechSDK.AvatarVideoFormat
    );
    avatarConfig.customized = customizedAvatar;

    avatarSynthesizerRef.current = new SpeechSDK.AvatarSynthesizer(speechSynthesisConfig, avatarConfig);

    avatarSynthesizerRef.current.avatarEventReceived = (s: any, e: SpeechSDK.AvatarEventArgs) => {
      console.log(`Event received: ${e.description}`);
    };

    const speechRecognitionConfig = SpeechSDK.SpeechConfig.fromEndpoint(new URL(`wss://${region}.stt.speech.microsoft.com/speech/universal/v2`), apiKey);
    speechRecognitionConfig.setProperty(SpeechSDK.PropertyId.SpeechServiceConnection_LanguageIdMode, 'Continuous');

    const autoDetectSourceLanguageConfig = SpeechSDK.AutoDetectSourceLanguageConfig.fromLanguages(sttLocales.split(','));
    speechRecognizerRef.current = SpeechSDK.SpeechRecognizer.FromConfig(speechRecognitionConfig, autoDetectSourceLanguageConfig, SpeechSDK.AudioConfig.fromDefaultMicrophoneInput());

    fetchWebRTCToken();
  };

  const fetchWebRTCToken = (): void => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", `https://${region}.tts.speech.microsoft.com/cognitiveservices/avatar/relay/token/v1`);
    xhr.setRequestHeader("Ocp-Apim-Subscription-Key", apiKey);
    xhr.addEventListener("readystatechange", function () {
      if (this.readyState === 4) {
        const responseData = JSON.parse(this.responseText);
        const iceServerUrl = responseData.Urls[0];
        const iceServerUsername = responseData.Username;
        const iceServerCredential = responseData.Password;
        setupWebRTC(iceServerUrl, iceServerUsername, iceServerCredential);
      }
    });
    xhr.send();
  };

  const handleVideoTrack = (event: RTCTrackEvent): void => {
    if (event.track.kind === 'audio') {
      let audioElement = document.createElement('audio');
      audioElement.id = 'audioPlayer';
      audioElement.srcObject = event.streams[0];
      audioElement.autoplay = true;

      audioElement.onplaying = () => {
        console.log(`WebRTC ${event.track.kind} channel connected.`);
      };

      // Clean up existing audio element if there is any
      const remoteVideo = document.getElementById('remoteVideo');
      if (remoteVideo) {
        for (let i = 0; i < remoteVideo.childNodes.length; i++) {
          if ((remoteVideo.childNodes[i] as HTMLElement).localName === event.track.kind) {
            remoteVideo.removeChild(remoteVideo.childNodes[i]);
          }
        }
        remoteVideo.appendChild(audioElement);
      }
    }

    if (event.track.kind === 'video') {
      let videoElement = document.createElement('video');
      videoElement.id = 'videoPlayer';
      videoElement.srcObject = event.streams[0];
      videoElement.autoplay = true;
      videoElement.playsInline = true;

      videoElement.onplaying = () => {
        // Clean up existing video element if there is any
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo) {
          for (let i = 0; i < remoteVideo.childNodes.length; i++) {
            if ((remoteVideo.childNodes[i] as HTMLElement).localName === event.track.kind) {
              remoteVideo.removeChild(remoteVideo.childNodes[i]);
            }
          }
          remoteVideo.appendChild(videoElement);
        }

        console.log(`WebRTC ${event.track.kind} channel connected.`);
        setIsMicrophoneDisabled(false);
        setSessionActive(true);
        
        if (useLocalVideoForIdle) {
          setShowLocalVideo(false);
          if (!lastSpeakTime) {
            setLastSpeakTime(new Date());
          }
        }

        setIsReconnecting(false);
        // Set session active after 5 seconds
        setTimeout(() => {
          setSessionActive(true);
        }, 5000);

        // Continue speaking if there are unfinished sentences
        if (repeatSpeakingSentenceAfterReconnection) {
          if (speakingText !== '') {
            speakNext(speakingText, 0, true);
          }
        } else {
          if (spokenTextQueue.length > 0) {
            speakNext(spokenTextQueue[0]);
          }
        }
      };
    }
  };

  const setupWebRTC = (iceServerUrl: string, iceServerUsername: string, iceServerCredential: string): void => {
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: [iceServerUrl], username: iceServerUsername, credential: iceServerCredential }],
    });

    peerConnection.ontrack = handleVideoTrack;

    // Listen to data channel, to get the event from the server
    peerConnection.addEventListener("datachannel", (event) => {
      const dataChannel = event.channel;
      dataChannel.onmessage = (e) => {
        const webRTCEvent = JSON.parse(e.data);
        if (webRTCEvent.event.eventType === 'EVENT_TYPE_TURN_START' && showSubtitles) {
          // Handle subtitles
          const subtitles = document.getElementById('subtitles');
          if (subtitles) {
            subtitles.hidden = false;
            // We should maintain speaking text state if needed
            // subtitles.innerHTML = speakingText;
          }
        } else if (webRTCEvent.event.eventType === 'EVENT_TYPE_SESSION_END' || webRTCEvent.event.eventType === 'EVENT_TYPE_SWITCH_TO_IDLE') {
          const subtitles = document.getElementById('subtitles');
          if (subtitles) {
            subtitles.hidden = true;
          }
          
          if (webRTCEvent.event.eventType === 'EVENT_TYPE_SESSION_END') {
            if (autoReconnectAvatar && !userClosedSession && !isReconnecting) {
              // Session disconnected unexpectedly, need reconnect
              console.log(`[${new Date().toISOString()}] The WebSockets got disconnected, need reconnect.`);
              setIsReconnecting(true);

              // Release the existing avatar connection
              if (avatarSynthesizerRef.current) {
                avatarSynthesizerRef.current.close();
              }

              // Setup a new avatar connection
              connectAvatar();
            }
          }
        }

        console.log(`[${new Date().toISOString()}] WebRTC event received: ${e.data}`);
      };
    });

    peerConnection.addTransceiver('video', { direction: 'sendrecv' });
    peerConnection.addTransceiver('audio', { direction: 'sendrecv' });

    avatarSynthesizerRef.current?.startAvatarAsync(peerConnection).then((result) => {
      if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
        console.log(`Avatar started. Result ID: ${result.resultId}`);
      } else {
        console.error(`Error starting avatar: ${result.resultId}`);
      }
    });
  };

  const speakNext = async (text: string, index: number = 0, isReconnect: boolean = false) => {
    if (!avatarSynthesizerRef.current) return;

    setSpeakingText(text);
    setIsSpeaking(true);

    try {
      const ssml = `
        <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="en-US">
          <voice name="${ttsVoice}">
            <mstts:express-as style="chat">
              ${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
            </mstts:express-as>
          </voice>
        </speak>`;

      await avatarSynthesizerRef.current.speakSsmlAsync(ssml);
      
      if (!isReconnect) {
        setSpokenTextQueue(prev => [...prev, text]);
      }
      
      setIsSpeaking(false);
      setSpeakingText("");
      setLastSpeakTime(new Date());

      // If there are more items in the queue, speak the next one
      if (spokenTextQueue.length > index + 1) {
        speakNext(spokenTextQueue[index + 1], index + 1);
      }
    } catch (error) {
      console.error('Error speaking:', error);
      setIsSpeaking(false);
      setSpeakingText("");
    }
  };

  const stopSpeaking = async (): Promise<void> => {
    if (!avatarSynthesizerRef.current) return;
    
    try {
      await avatarSynthesizerRef.current.stopSpeakingAsync();
      setIsSpeaking(false);
      setSpeakingText("");
      // Clear the queue when stopping
      setSpokenTextQueue([]);
      // Reset last speak time
      setLastSpeakTime(new Date());
    } catch (error) {
      console.error('Error stopping speech:', error);
      // Even if there's an error, reset the states
      setIsSpeaking(false);
      setSpeakingText("");
      setSpokenTextQueue([]);
    }
  };

  const startSession = (): void => {
    // Reset session states before starting
    setUserClosedSession(false);
    setShowRemoteVideo(true);
    setShowLocalVideo(false);
    
    // Ensure video container is visible and empty
    const remoteVideo = document.getElementById('remoteVideo');
    if (remoteVideo) {
      remoteVideo.style.display = 'block';
      while (remoteVideo.firstChild) {
        remoteVideo.removeChild(remoteVideo.firstChild);
      }
    }

    connectAvatar();
    setSessionActive(true);
  };

  const stopSession = (): void => {
    // Stop any ongoing speech
    if (avatarSynthesizerRef.current) {
      avatarSynthesizerRef.current.stopSpeakingAsync().then(() => {
        avatarSynthesizerRef.current?.close();
      });
    }

    // Stop and close speech recognizer
    if (speechRecognizerRef.current) {
      speechRecognizerRef.current.stopContinuousRecognitionAsync(() => {
        if (speechRecognizerRef.current) {
          speechRecognizerRef.current.close();
        }
      });
    }

    // Clear video elements and hide containers
    const remoteVideo = document.getElementById('remoteVideo');
    if (remoteVideo) {
      // Stop all media tracks
      const videos = remoteVideo.getElementsByTagName('video');
      const audios = remoteVideo.getElementsByTagName('audio');
      
      Array.from(videos).forEach(video => {
        const stream = (video as HTMLVideoElement).srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        video.srcObject = null;
      });

      Array.from(audios).forEach(audio => {
        const stream = (audio as HTMLAudioElement).srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        audio.srcObject = null;
      });

      // Remove elements
      while (remoteVideo.firstChild) {
        remoteVideo.removeChild(remoteVideo.firstChild);
      }
      
      // Hide the container
      remoteVideo.style.display = 'none';
    }

    // Clear chat history
    if (chatHistoryRef.current) {
      chatHistoryRef.current.innerHTML = '';
    }

    // Reset all states
    setSessionActive(false);
    setShowRemoteVideo(false);
    setShowLocalVideo(false);
    setIsSpeaking(false);
    setSpeakingText("");
    setSpokenTextQueue([]);
    setUserMessage("");
    setCurrentRecognizedText("");
    setMessages([]);
    setMicrophoneText("Start Microphone");
    setIsMicrophoneDisabled(false);
    setShowTypeMessage(false);
    setUserClosedSession(true);
    setIsReconnecting(false);
    setLastSpeakTime(undefined);

    // Reset refs
    avatarSynthesizerRef.current = null;
    speechRecognizerRef.current = null;
  };

  const clearChatHistory = () => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.innerHTML = '';
    }
  };

  return (
    <div className="container py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Configuration Section */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-semibold">Azure Speech Resource</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="input-group">
                <Label>Region:</Label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="westus2">West US 2</SelectItem>
                    <SelectItem value="westeurope">West Europe</SelectItem>
                    <SelectItem value="southeastasia">Southeast Asia</SelectItem>
                    <SelectItem value="southcentralus">South Central US</SelectItem>
                    <SelectItem value="northeurope">North Europe</SelectItem>
                    <SelectItem value="swedencentral">Sweden Central</SelectItem>
                    <SelectItem value="eastus2">East US 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="input-group">
                <Label>API Key:</Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)}
                  placeholder="Enter your Azure Speech API key"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="enablePrivateEndpoint"
                  checked={privateEndpointEnabled}
                  onCheckedChange={handleCheckboxChange(setPrivateEndpointEnabled)}
                />
                <Label htmlFor="enablePrivateEndpoint">
                  Enable Private Endpoint
                </Label>
              </div>

              {privateEndpointEnabled && (
                <div className="input-group">
                  <Label>Private Endpoint:</Label>
                  <Input
                    value={privateEndpoint}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrivateEndpoint(e.target.value)}
                    placeholder="https://{your custom name}.cognitiveservices.azure.com/"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-semibold">Azure OpenAI Resource</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="input-group">
                <Label>Endpoint:</Label>
                <Input
                  value={azureOpenAIEndpoint}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAzureOpenAIEndpoint(e.target.value)}
                  placeholder="Enter your Azure OpenAI endpoint"
                />
              </div>

              <div className="input-group">
                <Label>API Key:</Label>
                <Input
                  type="password"
                  value={azureOpenAIApiKey}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAzureOpenAIApiKey(e.target.value)}
                  placeholder="Enter your Azure OpenAI API key"
                />
              </div>

              <div className="input-group">
                <Label>Deployment Name:</Label>
                <Input
                  value={azureOpenAIDeploymentName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAzureOpenAIDeploymentName(e.target.value)}
                  placeholder="Enter your deployment name"
                />
              </div>

              <div className="input-group">
                <Label>System Prompt:</Label>
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Enter your system prompt"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-semibold">STT / TTS Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="input-group">
                <Label>STT Locale(s):</Label>
                <Input
                  value={sttLocales}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSttLocales(e.target.value)}
                  placeholder="en-US,de-DE,es-ES,fr-FR,it-IT,ja-JP,ko-KR,zh-CN"
                />
              </div>

              <div className="input-group">
                <Label>TTS Voice:</Label>
                <Input
                  value={ttsVoice}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTtsVoice(e.target.value)}
                  placeholder="en-US-AvaMultilingualNeural"
                />
              </div>

              <div className="input-group">
                <Label>Custom Voice Deployment ID:</Label>
                <Input
                  value={customVoiceEndpointId}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomVoiceEndpointId(e.target.value)}
                  placeholder="Enter your custom voice deployment ID"
                />
              </div>

              <div className="input-group">
                <Label>Personal Voice Speaker Profile ID:</Label>
                <Input
                  value={personalVoiceSpeakerProfileID}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPersonalVoiceSpeakerProfileID(e.target.value)}
                  placeholder="Enter your personal voice speaker profile ID"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="continuousConversation"
                  checked={continuousConversation}
                  onCheckedChange={handleCheckboxChange(setContinuousConversation)}
                />
                <Label htmlFor="continuousConversation">
                  Continuous Conversation
                </Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-semibold">Avatar Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="input-group">
                <Label>Avatar Character:</Label>
                <Input
                  value={talkingAvatarCharacter}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTalkingAvatarCharacter(e.target.value)}
                  placeholder="lisa"
                />
              </div>

              <div className="input-group">
                <Label>Avatar Style:</Label>
                <Input
                  value={talkingAvatarStyle}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTalkingAvatarStyle(e.target.value)}
                  placeholder="casual-sitting"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="customizedAvatar"
                  checked={customizedAvatar}
                  onCheckedChange={handleCheckboxChange(setCustomizedAvatar)}
                />
                <Label htmlFor="customizedAvatar">
                  Custom Avatar
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="autoReconnectAvatar"
                  checked={autoReconnectAvatar}
                  onCheckedChange={handleCheckboxChange(setAutoReconnectAvatar)}
                />
                <Label htmlFor="autoReconnectAvatar">
                  Auto Reconnect
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="useLocalVideoForIdle"
                  checked={useLocalVideoForIdle}
                  onCheckedChange={handleCheckboxChange(setUseLocalVideoForIdle)}
                />
                <Label htmlFor="useLocalVideoForIdle">
                  Use Local Video for Idle
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showSubtitles"
                  checked={showSubtitles}
                  onCheckedChange={handleCheckboxChange(setShowSubtitles)}
                />
                <Label htmlFor="showSubtitles">
                  Show Subtitles
                </Label>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Video and Chat Section */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-semibold">Video</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="video-container">
                <div id="remoteVideo" ref={remoteVideoRef} className={showRemoteVideo ? '' : 'hidden'} />
                <div id="localVideo" ref={localVideoRef} className={showLocalVideo ? '' : 'hidden'} />
              </div>
              <div className="button-group">
                <Button
                  onClick={startSession}
                  disabled={sessionActive}
                >
                  Start Session
                </Button>
                <Button
                  onClick={stopSession}
                  disabled={!sessionActive}
                >
                  Stop Session
                </Button>
                <Button
                  onClick={handleMicrophoneClick}
                  disabled={isMicrophoneDisabled || !sessionActive}
                >
                  {microphoneText}
                </Button>
                <Button
                  onClick={clearChatHistory}
                  disabled={!sessionActive}
                >
                  Clear Chat
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-semibold">Chat</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showTypeMessage"
                    checked={showTypeMessage}
                    onCheckedChange={handleCheckboxChange(setShowTypeMessage)}
                    disabled={!sessionActive}
                  />
                  <Label htmlFor="showTypeMessage">
                    Type Message
                  </Label>
                </div>

                {showTypeMessage && (
                  <div className="space-y-2">
                    <Textarea
                      ref={userMessageRef}
                      value={userMessage}
                      onChange={(e) => setUserMessage(e.target.value)}
                      onKeyUp={handleMessageBoxKeyUp}
                      placeholder="Type your message and press Enter..."
                    />
                    <Button onClick={handleImageUpload}>
                      Upload Image
                    </Button>
                  </div>
                )}

                <div
                  ref={chatHistoryRef}
                  className="h-[300px] overflow-y-auto p-4 border rounded-md"
                >
                  {/* Chat history content */}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <audio ref={audioPlayerRef} src="audio/start.wav" />
    </div>
  );
};

export default Chat; 