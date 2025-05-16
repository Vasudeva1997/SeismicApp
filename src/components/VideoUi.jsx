import html2canvas from "html2canvas";
import React, { useEffect, useRef, useState } from "react";
import { FaPhoneSlash, FaStop, FaVideo } from "react-icons/fa";

function VideoUi({
  myStream,
  socket,
  setStatus,
  userVideo,
  myVideo,
  callAccepted,
  BACKEND_LINK,
  me,
  waitingForHost,
  role,
  userName,
}) {
  const chunkIndexRef = useRef(0);

  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const removeMyStream = () => {
    myStream.current?.getTracks().forEach((track) => track.stop());
  };

  const leaveCall = () => {
    removeMyStream();
    socket.disconnect();
    setStatus("Call ended.");
    window.location.reload();
  };

  const toggleMute = () => {
    if (!myStream.current) return;
    const audioTrack = myStream.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioMuted(!audioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    if (!myStream.current) return;
    const videoTrack = myStream.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    }
  };

  const divRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const videoBlob = useState(null)[0];
  const mediaStream = useRef(null);
  const recorder = useRef(null);
  const chunks = useRef([]);

  const startCanvasUpdates = (canvas, sourceDiv) => {
    const ctx = canvas.getContext("2d");
    setInterval(async () => {
      try {
        const snapshot = await html2canvas(sourceDiv);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(snapshot, 0, 0, canvas.width, canvas.height);
      } catch (error) {
        console.error("Error capturing canvas snapshot:", error);
      }
    }, 1000 / 30);
  };

  const captureDivWithAudio = async () => {
    const sourceDiv = divRef.current;
    const { width, height } = sourceDiv.getBoundingClientRect();

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    startCanvasUpdates(canvas, sourceDiv);

    const canvasStream = canvas.captureStream(30);

    // Get the local audio stream
    const localAudioStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    // Prepare AudioContext for mixing
    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();

    // Add local audio to the AudioContext
    const localAudioSource = audioContext.createMediaStreamSource(
      localAudioStream
    );
    localAudioSource.connect(destination);

    // Add remote audio to the AudioContext
    if (callAccepted && userVideo.current?.srcObject) {
      const remoteAudioStream = userVideo.current.srcObject;
      const remoteAudioSource = audioContext.createMediaStreamSource(
        remoteAudioStream
      );
      remoteAudioSource.connect(destination);
    }

    // Create a combined stream
    const combinedStream = new MediaStream();

    // Add canvas video track to the combined stream
    canvasStream
      .getVideoTracks()
      .forEach((track) => combinedStream.addTrack(track));

    // Add mixed audio track to the combined stream
    destination.stream
      .getAudioTracks()
      .forEach((track) => combinedStream.addTrack(track));

    mediaStream.current = localAudioStream; // Store the local audio stream to stop later

    return combinedStream;
  };

  // Add these state variables
  const [recordingInterval, setRecordingInterval] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Modified startRecording function
  const startRecording = async () => {
    try {
      const stream = await captureDivWithAudio();
      mediaStream.current = stream;
      chunks.current = [];

      recorder.current = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9,opus",
      });

      // Upload chunks every 5 seconds (adjust as needed)
      const interval = setInterval(() => {
        if (chunks.current.length > 0 && !isUploading) {
          uploadChunks();
        }
      }, 5000);

      setRecordingInterval(interval);

      recorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.current.push(e.data);
        }
      };

      recorder.current.start(5000); // Collect 30-second chunks
      setRecording(true);
    } catch (error) {
      console.error("Recording start failed:", error);
    }
  };

  // New function to upload chunks
  const uploadChunks = async () => {
    if (chunks.current.length === 0 || isUploading) return;

    setIsUploading(true);
    const chunkToUpload = chunks.current.shift();

    try {
      const formData = new FormData();
      formData.append("chunk", chunkToUpload);
      const index = chunkIndexRef.current++;

      await fetch(`${BACKEND_LINK}/upload-chunk/${me}/${index}`, {
        method: "POST",
        body: formData,
      });

      console.log("Chunk uploaded successfully");
    } catch (error) {
      console.error("Chunk upload failed:", error);
      // Requeue failed chunk
      chunks.current.unshift(chunkToUpload);
    } finally {
      setIsUploading(false);
    }
  };

  // Modified stopRecording function
  const stopRecording = () => {
    if (recorder.current && recorder.current.state === "recording") {
      recorder.current.stop();
    }
    if (recordingInterval) {
      clearInterval(recordingInterval);
    }

    // Upload any remaining chunks
    if (chunks.current.length > 0) {
      uploadChunks();
    }

    setRecording(false);
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (recordingInterval) {
        clearInterval(recordingInterval);
      }
    };
  }, [recordingInterval]);

  return (
    <div>
      <div
        ref={divRef}
        className="flex justify-center p-6 video-container gap-4"
      >
        {/* {callAccepted && !callEnded && ( */}
        <div className="relative h-80 bg-gray-200 rounded-lg overflow-hidden flex-2">
          {waitingForHost && (
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
          <video
            playsInline
            ref={userVideo}
            autoPlay
            className="w-full h-full object-cover"
          />
          <p className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded">
            {role}
          </p>
        </div>
        {/* )} */}
        <div className="relative h-80 bg-gray-200 rounded-lg overflow-hidden flex-1">
          <video
            playsInline
            muted
            ref={myVideo}
            autoPlay
            className="w-full h-full object-cover"
          />
          <p className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded">
            {userName || "You"}
          </p>
          <button
            onClick={toggleMute}
            className={`px-4 py-2 rounded-lg mr-2 ${
              isAudioMuted
                ? "bg-yellow-500 hover:bg-yellow-600"
                : "bg-blue-500 hover:bg-blue-600"
            } text-white`}
          >
            {isAudioMuted ? "Unmute" : "Mute"}
          </button>

          <button
            onClick={toggleVideo}
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
          onClick={leaveCall}
          className="bg-red-500 text-white rounded-lg py-2 px-4 hover:bg-red-600 focus:outline-none"
        >
          <FaPhoneSlash className="inline-block mr-2" />
          End Call
        </button>
        <button
          onClick={toggleMute}
          className={`px-4 py-2 rounded-lg mr-2 ${
            isAudioMuted
              ? "bg-yellow-500 hover:bg-yellow-600"
              : "bg-blue-500 hover:bg-blue-600"
          } text-white`}
        >
          {isAudioMuted ? "Unmute" : "Mute"}
        </button>

        <button
          onClick={toggleVideo}
          className={`px-4 py-2 rounded-lg mr-2 ${
            isVideoOff
              ? "bg-yellow-500 hover:bg-yellow-600"
              : "bg-blue-500 hover:bg-blue-600"
          } text-white`}
        >
          {isVideoOff ? "Turn On Video" : "Turn Off Video"}
        </button>
      </div>
      {videoBlob && (
        <div className="flex flex-col items-center mt-6">
          <h3 className="mb-2 text-lg font-medium">Recorded Video:</h3>
          <video
            controls
            className="w-full max-w-lg border border-gray-300 rounded-lg"
            src={URL.createObjectURL(videoBlob)}
          />
        </div>
      )}
    </div>
  );
}

export default VideoUi;
