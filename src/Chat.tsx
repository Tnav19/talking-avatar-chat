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
  
  // Refs
  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const userMessageRef = useRef<HTMLTextAreaElement>(null);
  
  let avatarSynthesizer: SpeechSDK.AvatarSynthesizer | undefined;
  let speechRecognizer: SpeechSDK.SpeechRecognizer | undefined;

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
    // Implementation for handling user queries
    console.log("Handling user query:", userQuery);
  };

  const disconnectAvatar = () => {
    if (avatarSynthesizer) {
      avatarSynthesizer.close();
      avatarSynthesizer = undefined;
    }
    if (speechRecognizer) {
      speechRecognizer.close();
      speechRecognizer = undefined;
    }
    setSessionActive(false);
  };

  const handleMicrophoneClick = () => {
    if (!speechRecognizer) return;
    
    if (microphoneText === 'Stop Microphone') {
      setIsMicrophoneDisabled(true);
      speechRecognizer.stopContinuousRecognitionAsync(
        () => {
          setMicrophoneText('Start Microphone');
          setIsMicrophoneDisabled(false);
        },
        (err) => {
          console.log("Failed to stop continuous recognition:", err);
          setIsMicrophoneDisabled(false);
        }
      );
      return;
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
    
    speechRecognizer.recognized = async (s: any, e: SpeechSDK.SpeechRecognitionEventArgs) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
        let userQuery = e.result.text.trim();
        if (userQuery === '') return;

        if (!continuousConversation) {
          setIsMicrophoneDisabled(true);
          speechRecognizer.stopContinuousRecognitionAsync(
            () => {
              setMicrophoneText('Start Microphone');
              setIsMicrophoneDisabled(false);
            },
            (err) => {
              console.log("Failed to stop continuous recognition:", err);
              setIsMicrophoneDisabled(false);
            }
          );
        }

        handleUserQuery(userQuery, "", "");
      }
    };

    speechRecognizer.startContinuousRecognitionAsync(
      () => {
        setMicrophoneText('Stop Microphone');
        setIsMicrophoneDisabled(false);
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
        handleUserQuery(userQuery.trim(), "", imgUrl);
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
      ? SpeechSDK.SpeechConfig.fromEndpoint(new URL(`wss://${privateEndpoint}/tts/cognitiveservices/websocket/v1?enableTalkingAvatar=true`), apiKey)
      : SpeechSDK.SpeechConfig.fromSubscription(apiKey, region);

    speechSynthesisConfig.endpointId = customVoiceEndpointId;

    const avatarConfig = new SpeechSDK.AvatarConfig(
      talkingAvatarCharacter,
      talkingAvatarStyle,
      SpeechSDK.AvatarVideoFormat.WebM
    );
    avatarConfig.customized = customizedAvatar;

    avatarSynthesizer = new SpeechSDK.AvatarSynthesizer(speechSynthesisConfig, avatarConfig);

    avatarSynthesizer.avatarEventReceived = (s: any, e: SpeechSDK.AvatarEventArgs) => {
      console.log(`Event received: ${e.description}`);
    };

    const speechRecognitionConfig = SpeechSDK.SpeechConfig.fromEndpoint(new URL(`wss://${region}.stt.speech.microsoft.com/speech/universal/v2`), apiKey);
    speechRecognitionConfig.setProperty(SpeechSDK.PropertyId.SpeechServiceConnection_LanguageIdMode, 'Continuous');

    const autoDetectSourceLanguageConfig = SpeechSDK.AutoDetectSourceLanguageConfig.fromLanguages(sttLocales.split(','));
    speechRecognizer = SpeechSDK.SpeechRecognizer.FromConfig(speechRecognitionConfig, autoDetectSourceLanguageConfig, SpeechSDK.AudioConfig.fromDefaultMicrophoneInput());

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

  const setupWebRTC = (iceServerUrl: string, iceServerUsername: string, iceServerCredential: string): void => {
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: [iceServerUrl], username: iceServerUsername, credential: iceServerCredential }],
    });

    peerConnection.ontrack = (event: RTCTrackEvent) => {
      if (event.track.kind === 'video') {
        handleVideoTrack(event);
      }
    };

    peerConnection.addTransceiver('video', { direction: 'sendrecv' });
    peerConnection.addTransceiver('audio', { direction: 'sendrecv' });

    avatarSynthesizer?.startAvatarAsync(peerConnection).then((result) => {
      if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
        console.log(`Avatar started. Result ID: ${result.resultId}`);
      } else {
        console.error(`Error starting avatar: ${result.resultId}`);
      }
    });
  };

  const handleVideoTrack = (event: RTCTrackEvent): void => {
    let videoElement = document.createElement('video');
    videoElement.srcObject = event.streams[0];
    videoElement.autoplay = true;
    videoElement.playsInline = true;

    const remoteVideo = document.getElementById('remoteVideo');
    if (remoteVideo) {
      remoteVideo.appendChild(videoElement);
    }
  };

  const stopSpeaking = (): void => {
    avatarSynthesizer?.stopSpeakingAsync().then(() => {
      setIsSpeaking(false);
    });
  };

  const startSession = (): void => {
    connectAvatar();
    setSessionActive(true);
  };

  const stopSession = (): void => {
    if (avatarSynthesizer) avatarSynthesizer.close();
    if (speechRecognizer) {
      speechRecognizer.stopContinuousRecognitionAsync(() => {
        if (speechRecognizer) speechRecognizer.close();
      });
    }

    setSessionActive(false);
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
                  id="prompt"
                  value="You are an AI assistant that helps people find information."
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