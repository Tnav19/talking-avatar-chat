// Chat.jsx
import React, { useState, useEffect, useRef } from 'react';
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

const Chat = () => {
  // State management
  const [region, setRegion] = useState('westus2');
  const [apiKey, setApiKey] = useState('');
  const [privateEndpointEnabled, setPrivateEndpointEnabled] = useState(false);
  const [privateEndpoint, setPrivateEndpoint] = useState('');
  const [azureOpenAIEndpoint, setAzureOpenAIEndpoint] = useState('');
  const [azureOpenAIApiKey, setAzureOpenAIApiKey] = useState('');
  const [azureOpenAIDeploymentName, setAzureOpenAIDeploymentName] = useState('');
  const [sessionActive, setSessionActive] = useState(false);
  const [sttLocales, setSttLocales] = useState('en-US,de-DE,es-ES,fr-FR,it-IT,ja-JP,ko-KR,zh-CN');
  const [ttsVoice, setTtsVoice] = useState('en-US-AvaMultilingualNeural');
  const [customVoiceEndpointId, setCustomVoiceEndpointId] = useState('');
  const [personalVoiceSpeakerProfileID, setPersonalVoiceSpeakerProfileID] = useState('');
  const [talkingAvatarCharacter, setTalkingAvatarCharacter] = useState('lisa');
  const [talkingAvatarStyle, setTalkingAvatarStyle] = useState('casual-sitting');
  const [useLocalVideoForIdle, setUseLocalVideoForIdle] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [showTypeMessage, setShowTypeMessage] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const chatHistoryRef = useRef(null);
  let avatarSynthesizer;
  let speechRecognizer;

  useEffect(() => {
    const intervalId = setInterval(() => {
      checkHung();
      checkLastSpeak();
    }, 2000);
    return () => clearInterval(intervalId);
  }, []);

  const connectAvatar = () => {
    if (!apiKey) {
      alert('Please fill in the API key of your speech resource.');
      return;
    }
    
    const speechSynthesisConfig = privateEndpointEnabled
      ? SpeechSDK.SpeechConfig.fromEndpoint(new URL(`wss://${privateEndpoint}/tts/cognitiveservices/websocket/v1?enableTalkingAvatar=true`), apiKey)
      : SpeechSDK.SpeechConfig.fromSubscription(apiKey, region);

    speechSynthesisConfig.endpointId = customVoiceEndpointId;

    const avatarConfig = new SpeechSDK.AvatarConfig(talkingAvatarCharacter, talkingAvatarStyle);
    avatarConfig.customized = true;

    avatarSynthesizer = new SpeechSDK.AvatarSynthesizer(speechSynthesisConfig, avatarConfig);

    avatarSynthesizer.avatarEventReceived = (s, e) => {
      console.log(`Event received: ${e.description}`);
    };

    const speechRecognitionConfig = SpeechSDK.SpeechConfig.fromEndpoint(new URL(`wss://${region}.stt.speech.microsoft.com/speech/universal/v2`), apiKey);
    speechRecognitionConfig.setProperty(SpeechSDK.PropertyId.SpeechServiceConnection_LanguageIdMode, 'Continuous');

    const autoDetectSourceLanguageConfig = SpeechSDK.AutoDetectSourceLanguageConfig.fromLanguages(sttLocales.split(','));
    speechRecognizer = SpeechSDK.SpeechRecognizer.FromConfig(speechRecognitionConfig, autoDetectSourceLanguageConfig, SpeechSDK.AudioConfig.fromDefaultMicrophoneInput());

    fetchWebRTCToken();
  };

  const fetchWebRTCToken = () => {
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

  const setupWebRTC = (iceServerUrl, iceServerUsername, iceServerCredential) => {
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: [iceServerUrl], username: iceServerUsername, credential: iceServerCredential }],
    });

    peerConnection.ontrack = (event) => {
      if (event.track.kind === 'video') {
        handleVideoTrack(event);
      }
    };

    peerConnection.addTransceiver('video', { direction: 'sendrecv' });
    peerConnection.addTransceiver('audio', { direction: 'sendrecv' });

    avatarSynthesizer.startAvatarAsync(peerConnection).then((result) => {
      if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
        console.log(`Avatar started. Result ID: ${result.resultId}`);
      } else {
        console.error(`Error starting avatar: ${result.resultId}`);
      }
    });
  };

  const handleVideoTrack = (event) => {
    let videoElement = document.createElement('video');
    videoElement.srcObject = event.streams[0];
    videoElement.autoplay = true;
    videoElement.playsInline = true;

    document.getElementById('remoteVideo').appendChild(videoElement);
  };

  const stopSpeaking = () => {
    avatarSynthesizer.stopSpeakingAsync().then(() => {
      setIsSpeaking(false);
    });
  };

  const startSession = () => {
    connectAvatar();
    setSessionActive(true);
  };

  const stopSession = () => {
    if (avatarSynthesizer) avatarSynthesizer.close();
    if (speechRecognizer) speechRecognizer.stopContinuousRecognitionAsync(() => speechRecognizer.close());

    setSessionActive(false);
  };

  const checkHung = () => {
    // Logic to check if avatar video stream is stuck
  };

  const checkLastSpeak = () => {
    // Logic to check last speaking time
  };

  return (
    <div>
      <div id="configuration">
        <h2>Azure Speech Resource</h2>
        <label htmlFor="region">Region:</label>
        <select value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="westus2">West US 2</option>
          <option value="westeurope">West Europe</option>
          <option value="southeastasia">Southeast Asia</option>
          <option value="southcentralus">South Central US</option>
          <option value="northeurope">North Europe</option>
          <option value="swedencentral">Sweden Central</option>
          <option value="eastus2">East US 2</option>
        </select>
        <label htmlFor="APIKey">API Key:</label>
        <input
          id="APIKey"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <div>
          <input
            type="checkbox"
            id="enablePrivateEndpoint"
            checked={privateEndpointEnabled}
            onChange={() => setPrivateEndpointEnabled(!privateEndpointEnabled)}
          />
          <label htmlFor="enablePrivateEndpoint">Enable Private Endpoint</label>
        </div>
        {privateEndpointEnabled && (
          <div>
            <label htmlFor="privateEndpoint">Private Endpoint:</label>
            <input
              id="privateEndpoint"
              type="text"
              value={privateEndpoint}
              onChange={(e) => setPrivateEndpoint(e.target.value)}
              placeholder="https://{your custom name}.cognitiveservices.azure.com/"
            />
          </div>
        )}

        <h2>Azure OpenAI Resource</h2>
        <label htmlFor="azureOpenAIEndpoint">Endpoint:</label>
        <input
          id="azureOpenAIEndpoint"
          type="text"
          value={azureOpenAIEndpoint}
          onChange={(e) => setAzureOpenAIEndpoint(e.target.value)}
        />
        <label htmlFor="azureOpenAIApiKey">API Key:</label>
        <input
          id="azureOpenAIApiKey"
          type="password"
          value={azureOpenAIApiKey}
          onChange={(e) => setAzureOpenAIApiKey(e.target.value)}
        />
        <label htmlFor="azureOpenAIDeploymentName">Deployment Name:</label>
        <input
          id="azureOpenAIDeploymentName"
          type="text"
          value={azureOpenAIDeploymentName}
          onChange={(e) => setAzureOpenAIDeploymentName(e.target.value)}
        />
        <label htmlFor="prompt">System Prompt:</label>
        <textarea id="prompt" value="You are an AI assistant that helps people find information." />
      </div>

      <div id="videoContainer" style={{ position: "relative", width: "960px" }}>
        <div id="overlayArea" style={{ position: "absolute" }}>
          <div
            id="chatHistory"
            ref={chatHistoryRef}
            style={{
              width: "360px",
              height: "480px",
              fontSize: "medium",
              border: "none",
              resize: "none",
              backgroundColor: "transparent",
              overflow: "hidden",
            }}
            contentEditable="true"
            hidden
          ></div>
        </div>
        <div id="localVideo" hidden>
          <video
            src="video/lisa-casual-sitting-idle.mp4"
            autoPlay
            loop
            muted
          ></video>
        </div>
        <div id="remoteVideo"></div>
        <div
          id="subtitles"
          style={{
            width: "100%",
            textAlign: "center",
            color: "white",
            textShadow:
              "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
            fontSize: "22px",
            position: "absolute",
            bottom: "5%",
            zIndex: "999",
          }}
          hidden={!showSubtitles}
        ></div>
      </div>

      <div>
        <button id="startSession" onClick={startSession}>
          Open Avatar Session
        </button>
        <button id="microphone" disabled={!sessionActive}>
          Start Microphone
        </button>
        <button id="stopSpeaking" onClick={stopSpeaking} disabled={!isSpeaking}>
          Stop Speaking
        </button>
        <button
          id="clearChatHistory"
          onClick={() => {
            chatHistoryRef.current.innerHTML = '';
          }}
        >
          Clear Chat History
        </button>
        <button id="stopSession" onClick={stopSession} disabled={!sessionActive}>
          Close Avatar Session
        </button>
      </div>

      <div id="showTypeMessageCheckbox">
        <input
          type="checkbox"
          id="showTypeMessage"
          checked={showTypeMessage}
          onChange={() => setShowTypeMessage(!showTypeMessage)}
          disabled={!sessionActive}
        />
        <label htmlFor="showTypeMessage">Type Message</label>
      </div>
      {showTypeMessage && (
        <div
          id="userMessageBox"
          contentEditable="true"
          style={{
            width: "940px",
            minHeight: "150px",
            maxHeight: "200px",
            border: "1px solid",
            overflowY: "scroll",
            padding: "10px",
          }}
        ></div>
      )}

      <div>
        <img
          id="uploadImgIcon"
          src="./image/attachment.jpg"
          alt="Button"
          style={{ cursor: "pointer" }}
          hidden={!showTypeMessage}
        />
      </div>
    </div>
  );
};

export default Chat;

