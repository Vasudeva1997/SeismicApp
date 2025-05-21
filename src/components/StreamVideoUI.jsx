// StreamVideoUI.jsx
import React, { useRef, useState } from "react";
import {
  useCall,
  ParticipantView,
  useCallStateHooks,
} from "@stream-io/video-react-sdk";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
  FaPhoneSlash,
  FaStop,
} from "react-icons/fa";

import html2canvas from "html2canvas";

const BACKEND_LINK =
  "https://seismic-backend-04272025-bjbxatgnadguabg9.centralus-01.azurewebsites.net";
// const BACKEND_LINK = "http://localhost:8080";

const getFormattedDate = () => {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(
    now.getMinutes()
  ).padStart(2, "0")}`;
};
const DATETIME = getFormattedDate();

const StreamVideoUI = ({ role, userName }) => {
  const call = useCall();
  const { useLocalParticipant, useRemoteParticipants, useParticipantCount } =
    useCallStateHooks();
  const localParticipant = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const participantCount = useParticipantCount();
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showWaitingForHost, setShowWaitingForHost] = useState(false);

  React.useEffect(() => {
    if (participantCount === 1 && role === "patient") {
      setShowWaitingForHost(true);
    } else {
      setShowWaitingForHost(false);
    }
  }, [participantCount, role]);

  const toggleMicrophone = async () => {
    if (call?.microphone) {
      await call.microphone.toggle();
    }
    setIsAudioMuted(!isAudioMuted);
  };

  const toggleCamera = async () => {
    if (call?.camera) {
      await call.camera.toggle();
    }
    setIsVideoOff(!isVideoOff);
  };

  const divRef = useRef(null);
  const canvasRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const intervalRef = useRef(null);
  const canvasDrawIntervalRef = useRef(null);
  const streamRef = useRef(null);
  const chunkIndex = useRef(0);

  const startRecording = async () => {
    if (!divRef.current || !canvasRef.current) return;

    const { offsetWidth, offsetHeight } = divRef.current;
    canvasRef.current.width = offsetWidth;
    canvasRef.current.height = offsetHeight;

    canvasDrawIntervalRef.current = setInterval(() => {
      html2canvas(divRef.current).then((canvasImage) => {
        const ctx = canvasRef.current.getContext("2d");
        ctx.clearRect(0, 0, offsetWidth, offsetHeight);
        ctx.drawImage(canvasImage, 0, 0, offsetWidth, offsetHeight);
      });
    }, 100);

    const canvasStream = canvasRef.current.captureStream(30);
    const audioStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioStream.getAudioTracks(),
    ]);
    streamRef.current = combinedStream;

    startMediaRecorder(combinedStream);

    intervalRef.current = setInterval(() => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
        startMediaRecorder(combinedStream);
      }
    }, 5000);

    setRecording(true);
  };

  const startMediaRecorder = (stream) => {
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    chunksRef.current = [];

    recorder.ondataavailable = async (e) => {
      if (e.data.size > 0) {
        const blob = new Blob([e.data], { type: "video/webm" });
        const formData = new FormData();
        const index = chunkIndex.current++;
        formData.append("chunk", blob, `recording-${index}.webm`);

        try {
          await fetch(
            `${BACKEND_LINK}/upload-chunk/Guest-${DATETIME}/${index}`,
            {
              method: "POST",
              body: formData,
            }
          );
        } catch (err) {
          console.error("Upload error:", err);
        }
      }
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
  };

  const stopRecording = () => {
    clearInterval(intervalRef.current);
    clearInterval(canvasDrawIntervalRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setRecording(false);
  };

  return (
    <div className="rounded-lg border bg-white shadow-sm w-full mt-6">
      <div className="bg-blue-600 p-4">
        <h2 className="text-2xl font-semibold text-white mb-2">
          Call with {userName}
        </h2>
      </div>
      <div
        ref={divRef}
        className="flex justify-center p-6 video-container gap-4"
      >
        {/* {callAccepted && !callEnded && ( */}
        <div className="relative h-80 bg-gray-200 rounded-lg overflow-hidden flex-1">
          {showWaitingForHost && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
              <div className="text-center p-4 bg-white bg-opacity-90 rounded-lg">
                <p className="text-xl font-medium text-gray-800">
                  Waiting for Doctor
                </p>
                <p className="text-gray-600">
                  The consultation will begin when the doctor joins
                </p>
              </div>
            </div>
          )}
          {remoteParticipants.map((p) => (
            <ParticipantView
              key={p.sessionId}
              participant={p}
              className="w-full h-full object-contain"
            />
          ))}
          <p className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded">
            {role}
          </p>
        </div>
        {/* )} */}
        <div className="relative h-80 bg-gray-200 rounded-lg overflow-hidden flex-1">
          {localParticipant && (
            <ParticipantView
              key={localParticipant.sessionId}
              participant={localParticipant}
              className="w-full h-full object-contain"
            />
          )}
          <p className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded">
            {userName || "You"}
          </p>
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <div className="text-center mb-4">
        {!recording ? (
          <button
            onClick={startRecording}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 mr-2"
          >
            <FaVideo className="inline-block mr-2" />
            Start Recording
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 mr-2"
          >
            <FaStop className="inline-block mr-2" />
            Stop Recording
          </button>
        )}
        <button
          onClick={() => call.leave()}
          className="bg-red-500 text-white rounded-lg py-2 px-4 hover:bg-red-600 focus:outline-none"
        >
          <FaPhoneSlash className="inline-block mr-2" />
          End Call
        </button>
        <button
          onClick={toggleMicrophone}
          className={`px-4 py-2 rounded-lg mr-2 ${
            isAudioMuted
              ? "bg-yellow-500 hover:bg-yellow-600"
              : "bg-blue-500 hover:bg-blue-600"
          } text-white`}
        >
          {isAudioMuted ? "Unmute" : "Mute"}
        </button>

        <button
          onClick={toggleCamera}
          className={`px-4 py-2 rounded-lg mr-2 ${
            isVideoOff
              ? "bg-yellow-500 hover:bg-yellow-600"
              : "bg-blue-500 hover:bg-blue-600"
          } text-white`}
        >
          {isVideoOff ? "Turn On Video" : "Turn Off Video"}
        </button>
      </div>
    </div>
  );
};

export default StreamVideoUI;
