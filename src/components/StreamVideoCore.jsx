import { useEffect } from "react";
import {
  StreamVideoClient,
  StreamCall,
  useStreamVideoClient,
  StreamVideoProvider,
} from "@stream-io/video-react-sdk";
import StreamVideoUI from "./StreamVideoUI";

const apiKey = "mmhfdzb5evj2";
const userToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3Byb250by5nZXRzdHJlYW0uaW8iLCJzdWIiOiJ1c2VyL1lvZGEiLCJ1c2VyX2lkIjoiWW9kYSIsInZhbGlkaXR5X2luX3NlY29uZHMiOjYwNDgwMCwiaWF0IjoxNzQ3NzkxNTA4LCJleHAiOjE3NDgzOTYzMDh9.Qr8axoKCbQT06x01cllnKE3mYNYqeYvUZReUhNkUeok";
const userId = "Yoda";
const callId = "R3JIvvak1W0W";

const client = new StreamVideoClient({
  apiKey,
  user: {
    id: userId,
    name: "Guest User",
  },
  token: userToken,
});

const StreamVideoCore = () => {
  const queryParams = new URLSearchParams(window.location.search);
  const role = queryParams.get("role");
  const roomId = queryParams.get("roomId");
  const nickname = queryParams.get("name");

  return (
    <StreamVideoProvider client={client}>
      <CallComponent role={role} roomId={roomId} nickname={nickname} />
    </StreamVideoProvider>
  );
};

const CallComponent = ({ role, roomId, nickname }) => {
  const videoClient = useStreamVideoClient();
  const call = videoClient.call("default", callId);

  useEffect(() => {
    call.join({ create: true });
    return () => call.leave();
  }, [call]);

  return (
    <StreamCall call={call}>
      <StreamVideoUI role={role} userName={nickname} />
    </StreamCall>
  );
};

export default StreamVideoCore;
