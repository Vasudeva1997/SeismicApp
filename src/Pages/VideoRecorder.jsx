import React, { useState, useRef, useEffect } from "react";
import { io } from "socket.io-client";
import { FaPhoneSlash, FaVideo, FaStop, FaCopy } from "react-icons/fa";
import VideoCore from "../components/VideoCore";

// const BACKEND_LINK = "https://seismic-backend-04272025-bjbxatgnadguabg9.centralus-01.azurewebsites.net"
const BACKEND_LINK = "http://localhost:8080";

const socket = io(BACKEND_LINK);

const VideoCallPage = () => {
  const [userName, setUserName] = useState("");
  const [room, setRoom] = useState("");
  const [isHost, setIsHost] = useState(true);
  const [showShareLink, setShowShareLink] = useState(false);
  const [joinLink, setJoinLink] = useState("");

  const [activeTab, setActiveTab] = useState("upcoming");
  const [appointmentId, setAppointmentId] = useState("");
  const [appointmentType, setAppointmentType] = useState("online");
  const isLoadingUpcoming = useState(false)[0];

  // Mock data - replace with your actual data
  const upcomingAppointments = [
    {
      appointmentId: "demo-appointment-1",
      patientName: "John Doe",
      date: "2025-04-30",
      time: "10:00 AM",
      reason: "Follow-up consultation",
    },
    {
      appointmentId: "demo-appointment-2",
      patientName: "Jane Smith",
      date: "2025-04-30",
      time: "2:30 PM",
      reason: "Initial consultation",
    },
  ];

  const selectedAppointment =
    upcomingAppointments.find((app) => app.appointmentId === appointmentId) ||
    null;
  const patient = selectedAppointment
    ? {
        firstName: selectedAppointment.patientName.split(" ")[0],
        lastName: selectedAppointment.patientName.split(" ")[1],
      }
    : null;

  // Add these new states at the top of the component
  const [invalidMeetingId, setInvalidMeetingId] = useState(false);
  const [meetingExpired, setMeetingExpired] = useState(false);
  const [appointmentDetails, setAppointmentDetails] = useState(null);

  // Add this helper function
  const validateAppointmentTime = (appointment) => {
    const appointmentDateTime = new Date(
      `${appointment.date}T${appointment.time}`
    );
    const now = new Date();

    const canJoinFrom = new Date(appointmentDateTime.getTime() - 15 * 60000);
    const canJoinUntil = new Date(appointmentDateTime.getTime() + 60 * 60000);

    if (now < canJoinFrom) {
      alert(
        "Meeting is not available yet. Please try again at the scheduled time."
      );
      setMeetingExpired(true);
      return false;
    }

    if (now > canJoinUntil) {
      alert("This meeting has expired. Please schedule a new appointment.");
      setMeetingExpired(true);
      return false;
    }

    return true;
  };

  // Initialize and handle URL parameters
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const roomParam = queryParams.get("room");
    // const hostParam = queryParams.get("host");

    if (roomParam) {
      setRoom(roomParam);
      setActiveTab("join");
      // Find appointment details
      const appointment = upcomingAppointments.find(
        (app) => app.appointmentId === roomParam
      );

      if (appointment) {
        setAppointmentDetails(appointment);
        validateAppointmentTime(appointment);
      } else {
        setInvalidMeetingId(true);
      }
    }
    // if (hostParam) {
    //   setUserName(hostParam);
    // }
  }, []);

  const nickname = "Guest";

  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");

  const createRoom = (roomId) => {
    if (!roomId) return alert("Enter a room ID");
    socket.emit("create-room", { roomId, appointmentDetails: {} });

    if (!roomId || !nickname) {
      console.log("Both Room ID and Nickname are required.");
      return;
    }

    socket.emit("createRoom", { roomId, nickname });

    socket.once("roomCreated", (data) => {
      console.log("");
      console.log("Room created:", data.roomId);
      generateJoinLink(data.roomId);
    });

    socket.once("roomExists", () => {
      console.log("Room already exists. Please choose another Room ID.");
    });
  };

  const handleAppointmentSelect = (selectedAppointmentId) => {
    const appointment = upcomingAppointments.find(
      (app) => app.appointmentId === selectedAppointmentId
    );

    if (!appointment) {
      setInvalidMeetingId(true);
      return;
    }

    setAppointmentId(selectedAppointmentId);
    const meetingId = selectedAppointmentId; // Use appointment ID as meeting ID
    setRoom(meetingId);
    setUserName("Mike");
    setAppointmentDetails(appointment);

    if (!validateAppointmentTime(appointment)) {
      return;
    }

    createRoom(selectedAppointmentId);
  };

  const generateJoinLink = (room) => {
    const currentUrl = window.location.href.split("?")[0];
    const link = `${currentUrl}?room=${encodeURIComponent(room)}`;
    setJoinLink(link);
    setShowShareLink(true);
    return link;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(joinLink);
    alert("Link copied to clipboard!");
  };

  return (
    <div className="bg-gray-50 flex flex-col justify-center items-center min-h-screen p-4">
      <div className="rounded-lg border bg-white shadow-sm w-full">
        <div className="flex flex-col space-y-1.5 p-6">
          <h3 className="text-2xl font-semibold leading-none tracking-tight">
            Seismic Video Call
          </h3>
          <p className="text-sm text-gray-500">
            Connect with patients through secure video consultations
          </p>
        </div>

        <div className="p-6 pt-0">
          <div className="space-y-4">
            <div className="inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1 text-gray-500 mb-4">
              <button
                onClick={() => setActiveTab("upcoming")}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all ${
                  activeTab === "upcoming"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "hover:text-gray-900"
                }`}
              >
                Upcoming Calls
              </button>
              <button
                onClick={() => setActiveTab("join")}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all ${
                  activeTab === "join"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "hover:text-gray-900"
                }`}
              >
                Join by ID
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all ${
                  activeTab === "history"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "hover:text-gray-900"
                }`}
              >
                Call History
              </button>
            </div>

            {activeTab === "upcoming" && (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <label
                    htmlFor="appointment"
                    className="text-sm font-medium text-gray-700"
                  >
                    Select an appointment
                  </label>
                  <div className="relative">
                    <select
                      value={appointmentId}
                      onChange={(e) => handleAppointmentSelect(e.target.value)}
                      className="flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Select an appointment</option>
                      {isLoadingUpcoming ? (
                        <option value="loading" disabled>
                          Loading appointments...
                        </option>
                      ) : upcomingAppointments.length > 0 ? (
                        upcomingAppointments.map((appointment) => (
                          <option
                            key={appointment.appointmentId}
                            value={appointment.appointmentId}
                          >
                            {appointment.patientName} - {appointment.date}{" "}
                            {appointment.time}
                          </option>
                        ))
                      ) : (
                        <option value="no-appointments" disabled>
                          No upcoming video calls
                        </option>
                      )}
                    </select>
                  </div>
                </div>

                {appointmentId && (
                  <div className="mt-4">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Appointment Type
                    </label>
                    <div className="flex space-x-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="online"
                          name="appointmentType"
                          value="online"
                          checked={appointmentType === "online"}
                          onChange={() => setAppointmentType("online")}
                          className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label
                          htmlFor="online"
                          className="text-sm font-medium text-gray-700 cursor-pointer"
                        >
                          Online
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="in-person"
                          name="appointmentType"
                          value="in-person"
                          checked={appointmentType === "in-person"}
                          onChange={() => setAppointmentType("in-person")}
                          className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label
                          htmlFor="in-person"
                          className="text-sm font-medium text-gray-700 cursor-pointer"
                        >
                          In-Person
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {appointmentId && selectedAppointment && patient && (
                  <div className="bg-gray-50 p-4 rounded-md mt-4">
                    <h3 className="font-medium mb-2">Appointment Details</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">Patient:</span>
                        <span className="ml-2 font-medium">
                          {patient.firstName} {patient.lastName}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Appointment ID:</span>
                        <span className="ml-2 font-medium">
                          {selectedAppointment.appointmentId}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Date & Time:</span>
                        <span className="ml-2 font-medium">
                          {selectedAppointment.date} at{" "}
                          {selectedAppointment.time}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Reason:</span>
                        <span className="ml-2 font-medium">
                          {selectedAppointment.reason || "Not specified"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="w-full mb-6">
                  <div className="flex flex-row justify-between w-full gap-4">
                    <label className="block text-gray-700 mb-2 flex-1">
                      Your Name
                      <input
                        type="text"
                        placeholder="Enter your name"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        className="border border-gray-300 rounded-lg px-4 w-full py-2 mb-4"
                      />
                    </label>
                    <label className="block text-gray-700 mb-2 flex-1">
                      {isHost ? "Meeting ID" : "Meeting ID (from invite link)"}
                      <input
                        placeholder="Meeting ID"
                        value={room}
                        onChange={(e) => setRoom(e.target.value)}
                        className="border border-gray-300 rounded-lg px-4 w-full py-2 mb-4"
                      />
                    </label>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 mt-4">
                  <button
                    onClick={() => {
                      if (!room) {
                        alert("Please select an appointment first");
                        return;
                      }
                      // joinAsDoctor(room, userName);
                    }}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white h-10 px-4 py-2"
                  >
                    <FaVideo className="mr-2" />
                    Start Video Call
                  </button>
                </div>
              </div>
            )}

            {activeTab === "join" && (
              <div className="space-y-4">
                <div className="w-full mb-6">
                  <div className="flex flex-row justify-between w-full gap-4">
                    <label className="block text-gray-700 mb-2 flex-1">
                      Your Name
                      <input
                        type="text"
                        placeholder="Enter your name"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        className="border border-gray-300 rounded-lg px-4 w-full py-2 mb-4"
                      />
                    </label>
                    <label className="block text-gray-700 mb-2 flex-1">
                      Meeting ID (from invite link)
                      <input
                        placeholder="Meeting ID"
                        value={room}
                        onChange={(e) => setRoom(e.target.value)}
                        className="border border-gray-300 rounded-lg px-4 w-full py-2 mb-4"
                      />
                    </label>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    // onClick={() => joinAsParticipant(room, userName)}
                    disabled={!room || !userName}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white h-10 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Join Call
                  </button>
                </div>
              </div>
            )}

            {activeTab === "history" && (
              <div className="space-y-4">
                <div className="text-center py-8 text-gray-500">
                  <h3 className="text-lg font-medium mb-2">Call History</h3>
                  <p>Your recent video call history will appear here.</p>
                </div>
              </div>
            )}
          </div>
        </div>
        {invalidMeetingId && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
            <p>Invalid meeting ID. Please check your meeting link.</p>
          </div>
        )}

        {meetingExpired && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4">
            <p>This meeting is not available at this time.</p>
          </div>
        )}

        {status && (
          <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-4">
            <p>{status}</p>
          </div>
        )}
        {showShareLink && (
          <div className="mt-6 p-4 bg-gray-100 rounded-lg">
            <h3 className="font-medium text-gray-800 mb-2">
              Invite others to join
            </h3>
            <div className="flex items-center">
              <input
                type="text"
                value={joinLink}
                readOnly
                className="border border-gray-300 rounded-l-lg px-4 py-2 flex-grow"
              />
              <button
                onClick={copyToClipboard}
                className="bg-blue-500 text-white px-4 py-2 rounded-r-lg hover:bg-blue-600"
              >
                <FaCopy className="inline-block mr-1" /> Copy
              </button>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Share this link with participants to join your meeting
            </p>
          </div>
        )}
      </div>
      <div className="rounded-lg border bg-white shadow-sm w-full mt-6">
        <div className="bg-blue-600 p-4">
          <h2 className="text-2xl font-semibold text-white mb-2">
            Call with {userName}
          </h2>
        </div>
        {/* <div className="flex flex-col items-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">
            {isHost ? "Host Meeting" : "Join Meeting"}
          </h1>
        </div> */}
        <VideoCore />
      </div>
    </div>
  );
};

export default VideoCallPage;
