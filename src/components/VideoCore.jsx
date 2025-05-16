import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { Row, Col } from "antd";
import VideoUi from "./VideoUi";

const socket = io("http://localhost:8080");

const VideoCore = ({
  waitingForHost,
  userName,
  me,
  callAccepted,
  setStatus,
}) => {
  const roomId = "123456";
  const queryParams = new URLSearchParams(window.location.search);
  const role = queryParams.get("role");
  const nickname = "Guest";
  const hasInitialized = useRef(false);

  const [otherUserNickname, setOtherUserNickname] = useState(undefined);
  const [incomingCall, setIncomingCall] = useState({
    show: false,
    name: "",
    socketId: null,
  });

  const [modal, setModal] = useState({
    show: false,
    title: "",
    message: "",
    onConfirm: null,
  });

  const [logs, setLogs] = useState({
    myNickname: nickname,
    roomId,
    callerSocketId: undefined,
    mySocketId: undefined,
    answeredSocketId: undefined,
    localDescription: undefined,
    remoteDescription: undefined,
    receivedOffers: [],
    sentOffers: [],
    receivedAnswers: [],
    sentAnswers: [],
    sentICECandidates: [],
    receivedICECandidates: [],
  });

  const myVideo = useRef(null);
  const partnerVideo = useRef(null);
  const peerRef = useRef(null);
  const otherUserId = useRef(null);
  const myStream = useRef(null);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (myVideo.current) myVideo.current.srcObject = stream;
        myStream.current = stream;
        rtcPeerLogic();
      } catch (err) {
        console.error(err);
      }
    })();

    return removeMyStream;
  }, []);

  const rtcPeerLogic = () => {
    setLogs((prev) => ({ ...prev, mySocketId: socket.id }));
    socket.emit("joinRoom", { roomId, nickname });

    socket.on("otherUserId", ({ otherUserNickname, otherUserSocketId }) => {
      setModal({
        show: true,
        title: "Connected",
        message: `Successfully accepted: ${otherUserNickname}`,
        onConfirm: () => setModal({ show: false }),
      });
      setLogs((prev) => ({ ...prev, callerSocketId: otherUserSocketId }));
      otherUserId.current = otherUserSocketId;
      peerRef.current = createPeer(otherUserSocketId);
      myStream.current
        .getTracks()
        .forEach((track) => peerRef.current.addTrack(track, myStream.current));
    });

    socket.on("userJoined", ({ otherUserSocketId, otherUserNickname }) => {
      setIncomingCall({
        show: true,
        name: otherUserNickname,
        socketId: otherUserSocketId,
      });
      setLogs((prev) => ({ ...prev, answeredSocketId: otherUserSocketId }));
      otherUserId.current = otherUserSocketId;
    });

    socket.on("acceptedBy", (name) => {
      setModal({
        show: true,
        title: "Call Accepted",
        message: `Successfully accepted by user: ${name}`,
        onConfirm: () => {
          setOtherUserNickname(name);
          setModal({ show: false });
        },
      });
    });

    socket.on("waitingToBeAcceptedBy", (name) => {
      setModal({
        show: true,
        title: "Waiting for Acceptance",
        message: `Waiting to be accepted by ${name}`,
        onConfirm: () => setModal({ show: false }),
      });
    });

    socket.on("callRejected", (name) => {
      setModal({
        show: true,
        title: "Call Rejected",
        message: `User ${name} did not accept your call!`,
        onConfirm: () => setModal({ show: false }),
      });
    });

    socket.on("otherUserDisconnected", (name) => {
      setModal({
        show: true,
        title: "Disconnected",
        message: `${name} just disconnected!`,
        onConfirm: () => setModal({ show: false }),
      });
      if (partnerVideo.current) partnerVideo.current.srcObject = null;
    });

    socket.on("offer", async (offer) => {
      try {
        setLogs((prev) => ({
          ...prev,
          receivedOffers: [...prev.receivedOffers, offer],
        }));
        peerRef.current = createPeer();
        const description = new RTCSessionDescription(offer.sdp);
        await peerRef.current.setRemoteDescription(description);
        setLogs((prev) => ({
          ...prev,
          remoteDescription: JSON.parse(JSON.stringify(description)),
        }));
        myStream.current
          .getTracks()
          .forEach((track) =>
            peerRef.current.addTrack(track, myStream.current)
          );
        const answer = await peerRef.current.createAnswer();
        await peerRef.current.setLocalDescription(answer);
        setLogs((prev) => ({
          ...prev,
          localDescription: JSON.parse(JSON.stringify(answer)),
        }));
        socket.emit("answer", {
          target: offer.caller,
          caller: socket.id,
          sdp: peerRef.current.localDescription,
        });
      } catch (err) {
        console.error(err);
      }
    });

    socket.on("answer", async (answer) => {
      try {
        setLogs((prev) => ({
          ...prev,
          receivedAnswers: [...prev.receivedAnswers, answer],
        }));
        const description = new RTCSessionDescription(answer.sdp);
        await peerRef.current.setRemoteDescription(description);
        setLogs((prev) => ({
          ...prev,
          remoteDescription: JSON.parse(JSON.stringify(description)),
        }));
      } catch (err) {
        console.error(err);
      }
    });

    socket.on("ICECandidate", async (ICECandidate) => {
      try {
        setLogs((prev) => ({
          ...prev,
          receivedICECandidates: [...prev.receivedICECandidates, ICECandidate],
        }));
        const candidate = new RTCIceCandidate(ICECandidate);
        await peerRef.current.addIceCandidate(candidate);
      } catch (err) {
        console.error(err);
      }
    });
  };

  const createPeer = (otherUserSocketId) => {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ICECandidate", {
          target: otherUserId.current,
          candidate: event.candidate,
        });
        setLogs((prev) => ({
          ...prev,
          sentICECandidates: [...prev.sentICECandidates, event.candidate],
        }));
      }
    };

    peer.ontrack = (event) => {
      if (!partnerVideo.current?.srcObject) {
        partnerVideo.current.srcObject = event.streams[0];
      }
    };

    peer.onnegotiationneeded = async () => {
      try {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit("offer", {
          target: otherUserSocketId,
          caller: socket.id,
          sdp: peer.localDescription,
        });
        setLogs((prev) => ({
          ...prev,
          sentOffers: [
            ...prev.sentOffers,
            { target: otherUserSocketId, caller: socket.id, sdp: offer },
          ],
        }));
      } catch (err) {
        console.error(err);
      }
    };

    return peer;
  };

  const removeMyStream = () => {
    myStream.current?.getTracks().forEach((track) => track.stop());
  };

  const handleAccept = () => {
    socket.emit("callAccepted", { roomId, nickname });
    setOtherUserNickname(incomingCall.name);
    setIncomingCall({ show: false, name: "", socketId: null });
  };

  const handleReject = () => {
    socket.emit("callRejected", { roomId, nickname });
    setIncomingCall({ show: false, name: "", socketId: null });
  };

  const onCallHangUp = () => {
    removeMyStream();
    socket.disconnect();
  };

  window.addEventListener("beforeunload", (ev) => {
    ev.preventDefault();
    removeMyStream();
    return true;
  });

  return (
    <>
      {/* Incoming call modal */}
      {incomingCall.show && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-96">
            <h2 className="text-lg font-semibold mb-4">
              {incomingCall.name} wants to connect.
            </h2>
            <div className="flex justify-end gap-4">
              <button
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                onClick={handleReject}
              >
                Reject
              </button>
              <button
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                onClick={handleAccept}
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generic message modal */}
      {modal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-lg w-96">
            <h3 className="text-xl font-semibold mb-2">{modal.title}</h3>
            <p className="mb-4">{modal.message}</p>
            <div className="flex justify-end">
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={modal.onConfirm}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video containers */}
      <VideoUi
        myStream={myStream}
        socket={socket}
        setStatus={setStatus}
        userVideo={partnerVideo}
        myVideo={myVideo}
        callAccepted={callAccepted}
        BACKEND_LINK={"http://localhost:8080"}
        me={nickname}
        waitingForHost={waitingForHost}
        role={role}
        userName={userName}
      />
    </>
  );
};

export default VideoCore;
