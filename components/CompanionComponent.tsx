"use client";

import { useEffect, useRef, useState } from "react";
import { cn, configureAssistant, getSubjectColor } from "@/lib/utils";
import { vapi } from "@/lib/vapi.sdk";
import Image from "next/image";
import Lottie, { LottieRefCurrentProps } from "lottie-react";
import soundwaves from "@/constants/soundwaves.json";
import { addToSessionHistory } from "@/lib/actions/companion.action";

enum CallStatus {
  INACTIVE = "INACTIVE",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
  FINISHED = "FINISHED",
}

const NON_ERROR_ENDED_REASONS = new Set([
  "assistant-ended-call",
  "assistant-ended-call-after-message-spoken",
  "assistant-said-end-call-phrase",
  "customer-ended-call",
  "exceeded-max-duration",
  "manually-canceled",
]);

const getEndedReasonMessage = (endedReason?: string) => {
  if (!endedReason || NON_ERROR_ENDED_REASONS.has(endedReason)) return null;

  if (
    endedReason === "assistant-did-not-receive-customer-audio" ||
    endedReason === "customer-did-not-give-microphone-permission"
  ) {
    return "Microphone access took too long or was blocked. Allow the mic and try again.";
  }

  if (
    endedReason.includes("eleven-labs") ||
    endedReason.includes("voice-failed") ||
    endedReason.includes("voice-not-found") ||
    endedReason.includes("voice-disabled")
  ) {
    return "The tutor voice could not start. Please try again.";
  }

  if (
    endedReason.includes("model-access-denied") ||
    endedReason.includes("llm-failed") ||
    endedReason.includes("openai")
  ) {
    return "The AI model could not start this session. Please try again in a moment.";
  }

  if (endedReason === "assistant-not-valid" || endedReason === "assistant-not-found") {
    return "This companion configuration is no longer valid. Please update it and try again.";
  }

  return `The session ended before it could start (${endedReason}).`;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Microphone access is required to start the session.";
    }

    if (error.name === "NotFoundError") {
      return "No microphone was found on this device.";
    }
  }

  if (!error || typeof error !== "object") {
    return "We couldn't start the session. Please try again.";
  }

  const errorRecord = error as {
    error?: {
      errorMsg?: string;
      message?: { msg?: string };
      error?: { msg?: string };
    };
    message?: string;
  };

  const rawMessage =
    errorRecord.error?.errorMsg ||
    errorRecord.error?.message?.msg ||
    errorRecord.error?.error?.msg ||
    errorRecord.message;

  if (rawMessage === "Meeting has ended") {
    return "The session room closed before audio finished connecting. Allow the mic prompt quickly and try again.";
  }

  if (typeof rawMessage === "string" && rawMessage.trim().length > 0) {
    return rawMessage;
  }

  return "We couldn't start the session. Please try again.";
};

const CompanionComponent = ({
  companionId,
  subject,
  topic,
  name,
  userName,
  userImage,
  style,
  voice,
}: CompanionComponentProps) => {
  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const callStartedRef = useRef(false);

  useEffect(() => {
    if (lottieRef) {
      if (isSpeaking) {
        lottieRef.current?.play();
      } else {
        lottieRef.current?.stop();
      }
    }
  }, [isSpeaking, lottieRef]);

  useEffect(() => {
    const onCallStart = () => {
      callStartedRef.current = true;
      setErrorMessage(null);
      setCallStatus(CallStatus.ACTIVE);
    };

    const onCallEnd = () => {
      setIsSpeaking(false);
      setIsMuted(false);
      setCallStatus(
        callStartedRef.current ? CallStatus.FINISHED : CallStatus.INACTIVE,
      );

      if (callStartedRef.current) {
        void addToSessionHistory(companionId).catch((historyError) => {
          console.error("Failed to save session history", historyError);
        });
      }

      callStartedRef.current = false;
    };

    const onMessage = (message: Message) => {
      if (message.type === "transcript" && message.transcriptType === "final") {
        const newMessage = { role: message.role, content: message.transcript };
        setMessages((prev) => [newMessage, ...prev]);
      }

      if (message.type === "status-update" && message.status === "ended") {
        const endedReasonMessage = getEndedReasonMessage(message.endedReason);

        if (endedReasonMessage) {
          setErrorMessage(endedReasonMessage);
        }
      }
    };

    const onSpeechStart = () => setIsSpeaking(true);
    const onSpeechEnd = () => setIsSpeaking(false);

    const onError = (error: Error) => {
      console.log("Error", error);
      setIsSpeaking(false);

      if (!callStartedRef.current) {
        setCallStatus(CallStatus.INACTIVE);
      }

      setErrorMessage(getErrorMessage(error));
    };

    vapi.on("call-start", onCallStart);
    vapi.on("call-end", onCallEnd);
    vapi.on("message", onMessage);
    vapi.on("error", onError);
    vapi.on("speech-start", onSpeechStart);
    vapi.on("speech-end", onSpeechEnd);

    return () => {
      vapi.off("call-start", onCallStart);
      vapi.off("call-end", onCallEnd);
      vapi.off("message", onMessage);
      vapi.off("error", onError);
      vapi.off("speech-start", onSpeechStart);
      vapi.off("speech-end", onSpeechEnd);
    };
  }, [companionId]);

  const toggleMicrophone = () => {
    const isMuted = vapi.isMuted();
    vapi.setMuted(!isMuted);
    setIsMuted(!isMuted);
  };

  const handleCall = async () => {
    if (callStatus === CallStatus.CONNECTING || callStatus === CallStatus.ACTIVE) {
      return;
    }

    callStartedRef.current = false;
    setMessages([]);
    setErrorMessage(null);
    setCallStatus(CallStatus.CONNECTING);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());

      const assistantOverrides = {
        variableValues: { subject, topic, style },
        clientMessages: ["transcript", "status-update"],
        serverMessages: [],
      };

      // @ts-expect-error - Need to fix types in vapi sdk
      await vapi.start(configureAssistant(voice, style), assistantOverrides);
    } catch (error) {
      setCallStatus(CallStatus.INACTIVE);
      setErrorMessage(getErrorMessage(error));
      console.error("Failed to start session", error);
    }
  };

  const handleDisconnect = () => {
    setErrorMessage(null);
    setCallStatus(CallStatus.FINISHED);
    void vapi.stop();
  };

  return (
    <section className="flex flex-col h-[70vh]">
      <section className="flex gap-8 max-sm:flex-col">
        <div className="companion-section">
          <div
            className="companion-avatar"
            style={{ backgroundColor: getSubjectColor(subject) }}
          >
            <div
              className={cn(
                "absolute transition-opacity duration-1000",
                callStatus === CallStatus.FINISHED ||
                  callStatus === CallStatus.INACTIVE
                  ? "opacity-1001"
                  : "opacity-0",
                callStatus === CallStatus.CONNECTING &&
                  "opacity-100 animate-pulse",
              )}
            >
              <Image
                src={`/icons/${subject}.svg`}
                alt={subject}
                width={150}
                height={150}
                className="max-sm:w-fit"
              />
            </div>

            <div
              className={cn(
                "absolute transition-opacity duration-1000",
                callStatus === CallStatus.ACTIVE ? "opacity-100" : "opacity-0",
              )}
            >
              <Lottie
                lottieRef={lottieRef}
                animationData={soundwaves}
                autoplay={false}
                className="companion-lottie"
              />
            </div>
          </div>
          <p className="font-bold text-2xl">{name}</p>
        </div>

        <div className="user-section">
          <div className="user-avatar">
            <Image
              src={userImage}
              alt={userName}
              width={130}
              height={130}
              className="rounded-lg"
            />
            <p className="font-bold text-2xl">{userName}</p>
          </div>
          <button
            className="btn-mic"
            onClick={toggleMicrophone}
            disabled={callStatus !== CallStatus.ACTIVE}
          >
            <Image
              src={isMuted ? "/icons/mic-off.svg" : "/icons/mic-on.svg"}
              alt="mic"
              width={36}
              height={36}
            />
            <p className="max-sm:hidden">
              {isMuted ? "Turn on microphone" : "Turn off microphone"}
            </p>
          </button>
          <button
            className={cn(
              "rounded-lg py-2 cursor-pointer transition-colors w-full text-white disabled:cursor-not-allowed disabled:opacity-70",
              callStatus === CallStatus.ACTIVE ? "bg-red-700" : "bg-primary",
              callStatus === CallStatus.CONNECTING && "animate-pulse",
            )}
            onClick={
              callStatus === CallStatus.ACTIVE ? handleDisconnect : handleCall
            }
            disabled={callStatus === CallStatus.CONNECTING}
          >
            {callStatus === CallStatus.ACTIVE
              ? "End Session"
              : callStatus === CallStatus.CONNECTING
                ? "Connecting..."
                : "Start Session"}
          </button>
          {errorMessage ? (
            <p className="text-center text-sm text-red-500">{errorMessage}</p>
          ) : null}
        </div>
      </section>

      <section className="transcript">
        <div className="transcript-message no-scrollbar">
          {messages.map((message, index) => {
            if (message.role === "assistant") {
              return (
                <p key={index} className="max-sm:text-sm">
                  {name.split(" ")[0].replace("/[.,]/g, ", "")}:{" "}
                  {message.content}
                </p>
              );
            } else {
              return (
                <p key={index} className="text-primary max-sm:text-sm">
                  {userName}: {message.content}
                </p>
              );
            }
          })}
        </div>

        <div className="transcript-fade" />
      </section>
    </section>
  );
};

export default CompanionComponent;
