import { useCallback, useEffect, useRef } from "react";
import { AgentState } from "#/types/agent-state";
import { useSettings } from "#/hooks/query/use-settings";
import { useEventStore } from "#/stores/use-event-store";
import {
  isActionEvent,
  isCanvasUIActionEvent,
  isMessageEvent,
  isObservationEvent,
  isStreamingDeltaEvent,
  isUserMessageEvent,
} from "#/types/agent-server/type-guards";
import type {
  ActionEvent,
  ImageContent,
  OpenHandsEvent,
  TextContent,
} from "#/types/agent-server/core";

const NOTIFICATION_STATES: AgentState[] = [
  AgentState.AWAITING_USER_INPUT,
  AgentState.FINISHED,
  AgentState.AWAITING_USER_CONFIRMATION,
];

const joinTextBlocks = (blocks: (TextContent | ImageContent)[]): string =>
  blocks
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

const TTS_CONTROL_STREAM_PATH = "/tts-control/stream";

const MAX_TTS_WORDS = 200;
const MAX_TTS_CHUNK_WORDS = 40;
const MAX_TTS_CHUNKS = 6;
const MAX_TTS_STEP_WORDS = 20;
const HOLD_MUSIC_URL = "https://assets.mixkit.co/music/443/443.mp3";
const HOLD_MUSIC_VOLUME = 0.2;
const HOLD_MUSIC_MAX_MS = 15000;
const DEBUG_TTS = true;

const logTts = (...args: unknown[]) => {
  if (DEBUG_TTS) {
    console.log("[TTS]", ...args);
  }
};

const splitIntoSentences = (input: string): string[] => {
  const matches = input.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  if (!matches) {
    return [];
  }
  return matches.map((sentence) => sentence.trim()).filter(Boolean);
};

const splitIntoChunks = (input: string): string[] => {
  const sentences = splitIntoSentences(input);
  if (sentences.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  const flush = () => {
    if (current.length === 0) {
      return;
    }
    chunks.push(current.join(" ").trim());
    current = [];
    currentWords = 0;
  };

  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      continue;
    }
    if (words.length > MAX_TTS_CHUNK_WORDS) {
      flush();
      for (let i = 0; i < words.length; i += MAX_TTS_CHUNK_WORDS) {
        chunks.push(words.slice(i, i + MAX_TTS_CHUNK_WORDS).join(" "));
        if (chunks.length >= MAX_TTS_CHUNKS) {
          return chunks.slice(0, MAX_TTS_CHUNKS);
        }
      }
      continue;
    }
    if (
      currentWords + words.length > MAX_TTS_CHUNK_WORDS &&
      current.length > 0
    ) {
      flush();
      if (chunks.length >= MAX_TTS_CHUNKS) {
        return chunks.slice(0, MAX_TTS_CHUNKS);
      }
    }
    current.push(sentence.trim());
    currentWords += words.length;
    if (chunks.length >= MAX_TTS_CHUNKS) {
      return chunks.slice(0, MAX_TTS_CHUNKS);
    }
  }

  flush();
  return chunks.slice(0, MAX_TTS_CHUNKS);
};

const stripMarkdown = (input: string): string => {
  let text = input;
  text = text.replace(/```[\s\S]*?```/g, " ");
  text = text.replace(/`{1,3}([^`]+)`{1,3}/g, "$1");
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/^\s*>+\s?/gm, "");
  text = text.replace(/^\s*[-*+]\s+/gm, "");
  text = text.replace(/^\s*\d+\.\s+/gm, "");
  text = text.replace(/[*_~]/g, "");
  text = text.replace(/\r?\n+/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text;
};

const limitWords = (text: string, limit: number): string => {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= limit) {
    return text;
  }
  return words.slice(0, limit).join(" ");
};

const stripEmojis = (input: string): string =>
  input
    .replace(/[\p{Extended_Pictographic}]/gu, "")
    .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, "")
    .replace(/\u200D/g, "")
    .replace(/\uFE0F/g, "");

const stripUrls = (input: string): string =>
  input.replace(/\bhttps?:\/\/[^\s)]+/gi, "").replace(/\bwww\.[^\s)]+/gi, "");

const sanitizeTtsText = (input: string): string =>
  limitWords(stripEmojis(stripUrls(stripMarkdown(input))), MAX_TTS_WORDS);

const sanitizeStepText = (input: string): string =>
  limitWords(stripEmojis(stripUrls(stripMarkdown(input))), MAX_TTS_STEP_WORDS);

const findLatestUserMessageKey = (
  events: OpenHandsEvent[],
): string | number | null => {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (isUserMessageEvent(event)) {
      return getEventKey(event) ?? event.id;
    }
  }
  return null;
};

const getEventKey = (event: OpenHandsEvent): string | number | null => {
  if (
    "id" in event &&
    (typeof event.id === "string" || typeof event.id === "number")
  ) {
    return event.id;
  }
  if ("timestamp" in event && typeof event.timestamp === "string") {
    return event.timestamp;
  }
  return null;
};

const getAgentText = (event: OpenHandsEvent): string | null => {
  if (isActionEvent(event) && event.action.kind === "FinishAction") {
    return event.action.message || null;
  }

  if (isMessageEvent(event) && event.source === "agent") {
    return joinTextBlocks(event.llm_message.content) || null;
  }

  if (isStreamingDeltaEvent(event)) {
    return event.content || null;
  }

  return null;
};

const describeAction = (event: ActionEvent): string | null => {
  if (
    event.action.kind === "FinishAction" ||
    event.action.kind === "ThinkAction"
  ) {
    return null;
  }

  if (event.summary?.trim()) {
    return event.summary;
  }

  switch (event.action.kind) {
    case "ExecuteBashAction":
    case "TerminalAction":
      return "Running a command";
    case "FileEditorAction":
    case "StrReplaceEditorAction":
    case "PlanningFileEditorAction":
      if ("command" in event.action) {
        switch (event.action.command) {
          case "view":
            return "Viewing a file";
          case "create":
            return "Creating a file";
          case "insert":
          case "str_replace":
            return "Editing a file";
          case "undo_edit":
            return "Reverting a file";
          default:
            return "Editing files";
        }
      }
      return "Editing files";
    case "BrowserNavigateAction":
      return "Opening a web page";
    case "BrowserClickAction":
      return "Clicking on the page";
    case "BrowserTypeAction":
      return "Typing on the page";
    case "BrowserGetStateAction":
    case "BrowserGetContentAction":
      return "Reading a page";
    case "BrowserScrollAction":
      return "Scrolling the page";
    case "BrowserGoBackAction":
      return "Going back in the browser";
    case "BrowserListTabsAction":
      return "Checking browser tabs";
    case "BrowserSwitchTabAction":
      return "Switching browser tabs";
    case "BrowserCloseTabAction":
      return "Closing a browser tab";
    case "TaskTrackerAction":
      return "Updating the task list";
    case "GlobAction":
    case "GrepAction":
      return "Searching files";
    case "InvokeSkillAction":
      return "Using a skill";
    case "SwitchLLMAction":
      return "Switching model";
    case "MCPToolAction":
      return "Calling a tool";
    case "TaskAction":
      return "Updating tasks";
    default:
      if (event.tool_name) {
        return `Using ${event.tool_name}`;
      }
      return "Working";
  }
};

const findLatestAgentText = (
  events: OpenHandsEvent[],
): { text: string; key: string | number | null } | null => {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    const text = getAgentText(event);
    if (text && text.trim().length > 0) {
      return { text, key: getEventKey(event) };
    }
  }
  return null;
};

type ResolvedAudio = {
  url: string;
  shouldRevoke: boolean;
};

const resolveAudioUrl = async (
  response: Response,
): Promise<ResolvedAudio | null> => {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = await response.json();
    if (typeof payload?.audio_url === "string") {
      return { url: payload.audio_url, shouldRevoke: false };
    }
    if (typeof payload?.audio_base64 === "string") {
      const binary = atob(payload.audio_base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "audio/wav" });
      return { url: URL.createObjectURL(blob), shouldRevoke: true };
    }
    return null;
  }

  const blob = await response.blob();
  if (!blob.size) {
    return null;
  }
  return { url: URL.createObjectURL(blob), shouldRevoke: true };
};

const fetchTtsAudio = async (
  endpoint: string,
  text: string,
  signal?: AbortSignal,
): Promise<ResolvedAudio | null> => {
  let response: Response;
  try {
    logTts("fetchTtsAudio: request", { endpoint, textLength: text.length });
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
      signal,
    });
  } catch (error) {
    logTts("fetchTtsAudio: request failed", error);
    return null;
  }

  if (!response.ok || signal?.aborted) {
    logTts("fetchTtsAudio: bad response", {
      status: response.status,
      aborted: Boolean(signal?.aborted),
    });
    return null;
  }

  const resolved = await resolveAudioUrl(response);
  logTts("fetchTtsAudio: resolved", {
    ok: Boolean(resolved),
    url: resolved?.url,
  });
  return resolved;
};

const playResolvedAudio = async (
  audio: HTMLAudioElement,
  resolved: ResolvedAudio,
  signal?: AbortSignal,
  onPlaybackStart?: () => void,
  onPlaybackEnd?: () => void,
): Promise<void> => {
  if (signal?.aborted) {
    return;
  }

  const audioElement = audio;
  const { url, shouldRevoke } = resolved;
  const previousOnEnded = audioElement.onended;

  let cleanupListeners = () => {};
  let cleanupAbort = () => {};
  let resolvePlayback: (() => void) | null = null;

  const waitForEnd = new Promise<void>((resolve) => {
    resolvePlayback = resolve;
    const onEnd = () => resolve();
    const onError = () => resolve();
    audioElement.addEventListener("ended", onEnd, { once: true });
    audioElement.addEventListener("error", onError, { once: true });
    cleanupListeners = () => {
      audioElement.removeEventListener("ended", onEnd);
      audioElement.removeEventListener("error", onError);
    };
  });

  let didStop = false;
  const abortPlayback = () => {
    if (didStop) {
      return;
    }
    didStop = true;
    audioElement.pause();
    audioElement.removeAttribute("src");
    audioElement.load();
    if (shouldRevoke) {
      URL.revokeObjectURL(url);
    }
    resolvePlayback?.();
  };

  if (signal) {
    if (signal.aborted) {
      abortPlayback();
      cleanupListeners();
      return;
    }
    signal.addEventListener("abort", abortPlayback, { once: true });
    cleanupAbort = () => signal.removeEventListener("abort", abortPlayback);
  }

  if (signal?.aborted) {
    abortPlayback();
    cleanupListeners();
    cleanupAbort();
    return;
  }

  audioElement.pause();
  audioElement.src = url;
  audioElement.currentTime = 0;
  if (shouldRevoke) {
    audioElement.onended = () => {
      URL.revokeObjectURL(url);
      if (previousOnEnded) {
        previousOnEnded.call(audioElement, new Event("ended"));
      }
    };
  }

  let didStart = false;
  try {
    await audioElement.play();
    didStart = true;
    logTts("playResolvedAudio: started", url);
    onPlaybackStart?.();
  } catch (error) {
    logTts("playResolvedAudio: failed", error);
    if (shouldRevoke) {
      URL.revokeObjectURL(url);
    }
    cleanupListeners();
    cleanupAbort();
    return;
  }

  await waitForEnd;
  if (didStart) {
    logTts("playResolvedAudio: ended", url);
    onPlaybackEnd?.();
  }
  cleanupListeners();
  cleanupAbort();
};

type TtsRequest = {
  audio: HTMLAudioElement;
  endpoint: string;
  text: string;
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
};

const createTtsQueue = () => {
  let isBusy = false;
  let pending: {
    request: TtsRequest;
    controller: AbortController;
    resolved: Promise<ResolvedAudio | null> | null;
  }[] = [];
  let activeController: AbortController | null = null;
  let generation = 0;

  const run = async (runGeneration: number) => {
    if (isBusy) {
      return;
    }
    isBusy = true;
    logTts("queue: run start", {
      generation: runGeneration,
      pending: pending.length,
    });

    while (pending.length > 0) {
      const item = pending[0];
      if (!item) {
        break;
      }
      activeController = item.controller;
      if (!item.resolved) {
        logTts("queue: fetch start", { textLength: item.request.text.length });
        item.resolved = fetchTtsAudio(
          item.request.endpoint,
          item.request.text,
          item.controller.signal,
        );
      }
      const resolved = await item.resolved;
      if (generation !== runGeneration) {
        break;
      }
      if (!resolved || item.controller.signal.aborted) {
        logTts("queue: fetch failed or aborted");
        pending.shift();
        continue;
      }
      const next = pending[1];
      if (next && !next.resolved && !next.controller.signal.aborted) {
        logTts("queue: prefetch next", {
          textLength: next.request.text.length,
        });
        next.resolved = fetchTtsAudio(
          next.request.endpoint,
          next.request.text,
          next.controller.signal,
        );
      }
      await playResolvedAudio(
        item.request.audio,
        resolved,
        item.controller.signal,
        item.request.onPlaybackStart,
        item.request.onPlaybackEnd,
      );
      if (generation !== runGeneration) {
        break;
      }
      pending.shift();
      logTts("queue: item complete", { remaining: pending.length });
    }

    if (generation === runGeneration) {
      activeController = null;
      isBusy = false;
      logTts("queue: run end", { pending: pending.length });
      if (pending.length > 0) {
        void run(generation);
      }
      return;
    }

    activeController = null;
    isBusy = false;
    logTts("queue: run cancelled", { generation });
  };

  return {
    enqueue(request: TtsRequest) {
      const controller = new AbortController();
      pending.push({ request, controller, resolved: null });
      logTts("queue: enqueue", {
        textLength: request.text.length,
        pending: pending.length,
      });
      if (!isBusy) {
        void run(generation);
      }
    },
    stop() {
      logTts("queue: stop", { pending: pending.length });
      generation += 1;
      for (const item of pending) {
        item.controller.abort();
      }
      pending = [];
      if (activeController) {
        activeController.abort();
        activeController = null;
      }
    },
  };
};

const ttsQueue = createTtsQueue();

/**
 * Speaks the latest agent response when the agent becomes ready for user input.
 */
export function useAgentTts(curAgentState: AgentState) {
  const { data: settings } = useSettings();
  const uiEvents = useEventStore((state) => state.uiEvents);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const holdAudioRef = useRef<HTMLAudioElement | null>(null);
  const holdPlayingRef = useRef(false);
  const holdTimeoutRef = useRef<number | null>(null);
  const spokenActionKeysRef = useRef<Set<string | number>>(new Set());
  const pendingActionKeysRef = useRef<Set<string | number>>(new Set());
  const completedActionKeysRef = useRef<Set<string | number>>(new Set());
  const prevStateRef = useRef<AgentState | undefined>(undefined);
  const lastSpokenKeyRef = useRef<string | number | null>(null);
  const lastUserMessageKeyRef = useRef<string | number | null>(null);
  const shouldSpeakRef = useRef(false);
  const ttsEndpoint = import.meta.env.VITE_TTS_ENDPOINT;
  const isEnabled =
    Boolean(ttsEndpoint) && !!settings?.enable_sound_notifications;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = 1;
    }
    if (!holdAudioRef.current) {
      const holdAudio = new Audio();
      holdAudio.loop = true;
      holdAudio.preload = "auto";
      holdAudio.volume = HOLD_MUSIC_VOLUME;
      holdAudioRef.current = holdAudio;
    }
  }, []);

  const stopHoldMusic = useCallback(() => {
    if (typeof window !== "undefined" && holdTimeoutRef.current !== null) {
      window.clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    const audio = holdAudioRef.current;
    if (!audio) {
      logTts("stopHoldMusic: no audio element");
      return;
    }
    if (!holdPlayingRef.current) {
      logTts("stopHoldMusic: not playing");
      return;
    }
    holdPlayingRef.current = false;
    audio.pause();
    audio.currentTime = 0;
    logTts("stopHoldMusic: stopped");
  }, []);

  const startHoldMusic = useCallback(() => {
    const audio = holdAudioRef.current;
    if (!audio) {
      logTts("startHoldMusic: no audio element");
      return;
    }
    if (holdPlayingRef.current) {
      logTts("startHoldMusic: already playing");
      return;
    }
    if (!audio.src) {
      audio.src = HOLD_MUSIC_URL;
    }
    audio.loop = true;
    audio.volume = HOLD_MUSIC_VOLUME;
    audio.currentTime = 0;
    holdPlayingRef.current = true;
    logTts("startHoldMusic: playing", HOLD_MUSIC_URL);
    audio.play().catch((error) => {
      holdPlayingRef.current = false;
      logTts("startHoldMusic: play failed", error);
    });
    if (typeof window !== "undefined") {
      if (holdTimeoutRef.current !== null) {
        window.clearTimeout(holdTimeoutRef.current);
      }
      holdTimeoutRef.current = window.setTimeout(() => {
        logTts("startHoldMusic: max duration reached");
        stopHoldMusic();
      }, HOLD_MUSIC_MAX_MS);
    }
  }, [stopHoldMusic]);

  useEffect(() => {
    logTts("init", {
      endpoint: ttsEndpoint,
      isEnabled,
      uiEvents: uiEvents.length,
      soundSetting: settings?.enable_sound_notifications,
    });
  }, [
    ttsEndpoint,
    isEnabled,
    uiEvents.length,
    settings?.enable_sound_notifications,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const source = new EventSource(TTS_CONTROL_STREAM_PATH);
    const handleStop = () => {
      logTts("sse: stop event");
      ttsQueue.stop();
      stopHoldMusic();
    };
    source.addEventListener("stop", handleStop);
    source.onmessage = (event) => {
      if (event.data === "stop") {
        handleStop();
      }
    };
    return () => {
      source.close();
    };
  }, [stopHoldMusic]);

  useEffect(() => {
    const latestUserKey = findLatestUserMessageKey(uiEvents);
    if (!latestUserKey) {
      return;
    }
    if (lastUserMessageKeyRef.current === null) {
      lastUserMessageKeyRef.current = latestUserKey;
      return;
    }
    if (lastUserMessageKeyRef.current !== latestUserKey) {
      logTts("user: new message", latestUserKey);
      lastUserMessageKeyRef.current = latestUserKey;
      ttsQueue.stop();
      stopHoldMusic();
      pendingActionKeysRef.current.clear();
      completedActionKeysRef.current.clear();
    }
  }, [uiEvents, stopHoldMusic]);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }
    let didChange = false;
    for (const event of uiEvents) {
      if (!isObservationEvent(event)) {
        continue;
      }
      const actionId = event.action_id;
      if (completedActionKeysRef.current.has(actionId)) {
        continue;
      }
      completedActionKeysRef.current.add(actionId);
      if (pendingActionKeysRef.current.delete(actionId)) {
        didChange = true;
      }
    }
    if (didChange) {
      logTts("observation: completed", {
        pending: pendingActionKeysRef.current.size,
      });
    }
    if (didChange && pendingActionKeysRef.current.size === 0) {
      stopHoldMusic();
    }
  }, [uiEvents, isEnabled, stopHoldMusic]);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }
    const audio = audioRef.current;
    if (!audio || !ttsEndpoint) {
      return;
    }

    const newActions: { event: ActionEvent; key: string | number | null }[] =
      [];

    for (const event of uiEvents) {
      if (!isActionEvent(event) || isCanvasUIActionEvent(event)) {
        continue;
      }
      const key = getEventKey(event) ?? event.id;
      if (!key || spokenActionKeysRef.current.has(key)) {
        continue;
      }
      spokenActionKeysRef.current.add(key);
      if (
        event.action.kind === "FinishAction" ||
        event.action.kind === "ThinkAction"
      ) {
        continue;
      }
      newActions.push({ event, key });
    }

    if (newActions.length === 0) {
      return;
    }

    logTts("actions: new", {
      count: newActions.length,
      kinds: newActions.map(({ event }) => event.action.kind),
    });

    for (const { event, key } of newActions) {
      if (key) {
        pendingActionKeysRef.current.add(key);
      }
      const stepText = describeAction(event);
      if (!stepText) {
        logTts("actions: skipped", {
          kind: event.action.kind,
          reason: "no text",
        });
        continue;
      }
      const sanitizedStep = sanitizeStepText(stepText);
      if (!sanitizedStep) {
        logTts("actions: skipped", {
          kind: event.action.kind,
          reason: "sanitized empty",
        });
        continue;
      }
      logTts("actions: enqueue", { text: sanitizedStep });
      ttsQueue.enqueue({
        audio,
        endpoint: ttsEndpoint,
        text: sanitizedStep,
        onPlaybackStart: stopHoldMusic,
        onPlaybackEnd: () => {
          if (key && pendingActionKeysRef.current.has(key)) {
            startHoldMusic();
          }
        },
      });
    }
  }, [uiEvents, isEnabled, ttsEndpoint, startHoldMusic, stopHoldMusic]);

  useEffect(() => {
    if (!isEnabled) {
      logTts("final: disabled", { endpoint: ttsEndpoint });
      return;
    }

    const hasStateChanged = prevStateRef.current !== curAgentState;
    if (hasStateChanged) {
      prevStateRef.current = curAgentState;
      if (NOTIFICATION_STATES.includes(curAgentState)) {
        shouldSpeakRef.current = true;
        logTts("final: state notification", curAgentState);
      }
    }

    if (!shouldSpeakRef.current) {
      return;
    }

    const latest = findLatestAgentText(uiEvents);
    if (!latest) {
      logTts("final: no agent text");
      return;
    }

    const sanitizedText = sanitizeTtsText(latest.text);
    if (!sanitizedText) {
      logTts("final: sanitized empty");
      return;
    }

    const key = latest.key ?? sanitizedText;
    if (lastSpokenKeyRef.current === key) {
      shouldSpeakRef.current = false;
      logTts("final: duplicate", key);
      return;
    }

    lastSpokenKeyRef.current = key;
    shouldSpeakRef.current = false;

    const audio = audioRef.current;
    if (!audio || !ttsEndpoint) {
      logTts("final: missing audio or endpoint", {
        audio: Boolean(audio),
        endpoint: ttsEndpoint,
      });
      return;
    }

    const chunks = splitIntoChunks(sanitizedText);
    if (chunks.length === 0) {
      logTts("final: no chunks");
      return;
    }

    logTts("final: enqueue", {
      chunks: chunks.length,
      textLength: sanitizedText.length,
    });
    startHoldMusic();
    chunks.forEach((chunk, index) => {
      ttsQueue.enqueue({
        audio,
        endpoint: ttsEndpoint,
        text: chunk,
        onPlaybackStart: index === 0 ? stopHoldMusic : undefined,
      });
    });
  }, [
    curAgentState,
    uiEvents,
    isEnabled,
    ttsEndpoint,
    startHoldMusic,
    stopHoldMusic,
  ]);
}
