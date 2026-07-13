import { act, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RefObject } from "react";
import { useAutoResize } from "#/hooks/use-auto-resize";
import type { IMessageToSend } from "#/stores/conversation-store";

const { isMobileDeviceMock } = vi.hoisted(() => ({
  isMobileDeviceMock: vi.fn(() => false),
}));

vi.mock("#/utils/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#/utils/utils")>()),
  isMobileDevice: () => isMobileDeviceMock(),
}));

interface ElementOptions {
  height?: number | null;
  scrollHeight?: number;
  text?: string;
}

function createEditableElement({
  height = 20,
  scrollHeight = 20,
  text = "content",
}: ElementOptions = {}) {
  const element = document.createElement("div");
  element.contentEditable = "true";
  element.textContent = text;
  if (height !== null) element.style.height = `${height}px`;

  let measuredScrollHeight = scrollHeight;
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    get: () => measuredScrollHeight,
  });
  Object.defineProperty(element, "offsetHeight", {
    configurable: true,
    get: () => Number.parseFloat(element.style.height) || 0,
  });
  document.body.appendChild(element);

  return {
    element,
    setScrollHeight: (nextHeight: number) => {
      measuredScrollHeight = nextHeight;
    },
  };
}

function installControlledAnimationFrames() {
  let nextId = 1;
  const frames = new Map<number, FrameRequestCallback>();
  const request = vi.fn((callback: FrameRequestCallback) => {
    const id = nextId;
    nextId += 1;
    frames.set(id, callback);
    return id;
  });
  const cancel = vi.fn((id: number) => {
    frames.delete(id);
  });

  vi.stubGlobal("requestAnimationFrame", request);
  vi.stubGlobal("cancelAnimationFrame", cancel);

  const flushNext = () => {
    const next = frames.entries().next();
    if (next.done) throw new Error("Expected a pending animation frame");
    const [id, callback] = next.value;
    frames.delete(id);
    act(() => callback(performance.now()));
    return id;
  };

  return {
    request,
    cancel,
    frames,
    flushNext,
    flushAll: () => {
      while (frames.size > 0) flushNext();
    },
  };
}

interface HookScenarioOptions extends ElementOptions {
  includeElement?: boolean;
  minHeight?: number;
  maxHeight?: number;
  enableManualResize?: boolean;
  callbacks?: boolean;
}

function createHookScenario({
  includeElement = true,
  minHeight = 20,
  maxHeight = 120,
  enableManualResize = false,
  callbacks = true,
  ...elementOptions
}: HookScenarioOptions = {}) {
  const animationFrames = installControlledAnimationFrames();
  const editable = includeElement
    ? createEditableElement(elementOptions)
    : null;
  const elementRef: RefObject<HTMLElement | null> = {
    current: editable?.element ?? null,
  };
  const onGripDragStart = vi.fn();
  const onGripDragEnd = vi.fn();
  const onHeightChange = vi.fn();
  const hook = renderHook(() =>
    useAutoResize(elementRef, {
      minHeight,
      maxHeight,
      enableManualResize,
      onGripDragStart: callbacks ? onGripDragStart : undefined,
      onGripDragEnd: callbacks ? onGripDragEnd : undefined,
      onHeightChange: callbacks ? onHeightChange : undefined,
    }),
  );

  return {
    ...hook,
    animationFrames,
    editable,
    elementRef,
    onGripDragStart,
    onGripDragEnd,
    onHeightChange,
  };
}

function startMouseDrag(
  handler: (event: React.MouseEvent) => void,
  clientY: number,
) {
  const preventDefault = vi.fn();
  act(() =>
    handler({ clientY, preventDefault } as unknown as React.MouseEvent),
  );
  expect(preventDefault).toHaveBeenCalledOnce();
}

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("automatic content-editable resizing", () => {
  it("debounces resize bursts and safely handles a missing element", () => {
    const animationFrames = installControlledAnimationFrames();
    const ref: RefObject<HTMLElement | null> = { current: null };
    const { result } = renderHook(() => useAutoResize(ref));

    expect(animationFrames.frames.size).toBe(1);
    act(() => result.current.smartResize());
    act(() => result.current.smartResize());
    expect(animationFrames.cancel).toHaveBeenCalledTimes(2);
    expect(animationFrames.frames.size).toBe(1);

    animationFrames.flushAll();
    expect(animationFrames.frames.size).toBe(0);

    act(() => {
      result.current.increaseHeightForEmptyContent();
      result.current.resetManualResize();
    });
  });

  it("shrinks fitting content to its measured height or the configured minimum", () => {
    const scenario = createHookScenario({
      height: 100,
      scrollHeight: 60,
      minHeight: 20,
    });

    scenario.animationFrames.flushAll();
    expect(scenario.editable?.element.style.height).toBe("60px");
    expect(scenario.editable?.element.style.overflowY).toBe("hidden");
    expect(scenario.onHeightChange).toHaveBeenLastCalledWith(60);

    scenario.editable!.element.style.height = "100px";
    scenario.editable!.setScrollHeight(10);
    act(() => scenario.result.current.smartResize());
    scenario.animationFrames.flushAll();

    expect(scenario.editable?.element.style.height).toBe("20px");
    expect(scenario.onHeightChange).toHaveBeenLastCalledWith(20);
  });

  it("grows with content up to the maximum then enables scrolling", () => {
    const scenario = createHookScenario({
      height: 20,
      scrollHeight: 80,
      minHeight: 20,
      maxHeight: 120,
    });

    scenario.animationFrames.flushAll();
    expect(scenario.editable?.element.style.height).toBe("80px");
    expect(scenario.editable?.element.style.overflowY).toBe("hidden");
    expect(scenario.onHeightChange).toHaveBeenLastCalledWith(80);

    scenario.editable!.setScrollHeight(200);
    act(() => scenario.result.current.smartResize());
    scenario.animationFrames.flushAll();

    expect(scenario.editable?.element.style.height).toBe("120px");
    expect(scenario.editable?.element.style.overflowY).toBe("auto");
    expect(scenario.onHeightChange).toHaveBeenLastCalledWith(120);
  });

  it("resizes without a height callback", () => {
    const scenario = createHookScenario({
      callbacks: false,
      height: 20,
      scrollHeight: 40,
    });

    scenario.animationFrames.flushAll();

    expect(scenario.editable?.element.style.height).toBe("40px");
    expect(scenario.editable?.element.style.overflowY).toBe("hidden");
  });

  it("reports drag height without entering manual mode when manual resize is disabled", () => {
    const scenario = createHookScenario({
      enableManualResize: false,
      height: 80,
      scrollHeight: 20,
    });
    startMouseDrag(scenario.result.current.handleGripMouseDown, 100);

    fireEvent.mouseMove(document, { clientY: 90 });
    fireEvent.mouseUp(document);

    expect(scenario.editable?.element.style.height).toBe("90px");
    expect(scenario.onHeightChange).toHaveBeenCalledWith(90);
    expect(scenario.onGripDragStart).not.toHaveBeenCalled();
    expect(scenario.onGripDragEnd).not.toHaveBeenCalled();
  });

  it("treats null DOM text content as empty", () => {
    const scenario = createHookScenario({
      height: 80,
      scrollHeight: 10,
    });
    Object.defineProperty(scenario.editable!.element, "textContent", {
      configurable: true,
      get: () => null,
    });

    scenario.animationFrames.flushAll();

    expect(scenario.editable?.element.style.height).toBe("20px");
  });

  it("preserves a manual height for empty and fitting content", () => {
    const scenario = createHookScenario({
      enableManualResize: true,
      height: 100,
      scrollHeight: 60,
      text: "",
    });
    startMouseDrag(scenario.result.current.handleGripMouseDown, 100);
    fireEvent.mouseMove(document, { clientY: 90 });
    fireEvent.mouseUp(document);

    expect(scenario.editable?.element.style.height).toBe("110px");
    expect(scenario.onGripDragStart).toHaveBeenCalledOnce();
    expect(scenario.onGripDragEnd).toHaveBeenCalledOnce();

    act(() => scenario.result.current.smartResize());
    scenario.animationFrames.flushAll();
    expect(scenario.editable?.element.style.height).toBe("110px");
    expect(scenario.editable?.element.style.overflowY).toBe("hidden");

    scenario.editable!.element.textContent = "short content";
    scenario.editable!.setScrollHeight(50);
    act(() => scenario.result.current.smartResize());
    scenario.animationFrames.flushAll();
    expect(scenario.editable?.element.style.height).toBe("110px");
    expect(scenario.onHeightChange).toHaveBeenLastCalledWith(110);
  });

  it("clears manual mode after dragging to the minimum height", () => {
    const scenario = createHookScenario({
      enableManualResize: true,
      height: 100,
      scrollHeight: 10,
      text: "",
    });
    startMouseDrag(scenario.result.current.handleGripMouseDown, 100);
    fireEvent.mouseMove(document, { clientY: 300 });

    act(() => scenario.result.current.smartResize());
    scenario.animationFrames.flushAll();
    expect(scenario.editable?.element.style.height).toBe("20px");

    fireEvent.mouseUp(document);
    scenario.editable!.element.style.height = "100px";
    act(() => scenario.result.current.smartResize());
    scenario.animationFrames.flushAll();

    expect(scenario.editable?.element.style.height).toBe("20px");
    expect(scenario.onGripDragEnd).toHaveBeenCalledOnce();
  });

  it("preserves the existing height when a manual drag spans a missing element", () => {
    const scenario = createHookScenario({
      includeElement: false,
      enableManualResize: true,
      callbacks: false,
    });
    startMouseDrag(scenario.result.current.handleGripMouseDown, 100);
    fireEvent.mouseMove(document, { clientY: 90 });
    fireEvent.mouseUp(document);

    const editable = createEditableElement({
      height: 80,
      scrollHeight: 40,
      text: "",
    });
    scenario.elementRef.current = editable.element;
    act(() => scenario.result.current.smartResize());
    scenario.animationFrames.flushAll();

    expect(editable.element.style.height).toBe("80px");
  });

  it("increases empty-content height, clamps it, and preserves it as manual", () => {
    const scenario = createHookScenario({
      height: 20,
      scrollHeight: 5,
      text: "",
      maxHeight: 60,
    });

    act(() => scenario.result.current.increaseHeightForEmptyContent());
    expect(scenario.editable?.element.style.height).toBe("40px");
    expect(scenario.editable?.element.style.overflowY).toBe("hidden");

    act(() => scenario.result.current.increaseHeightForEmptyContent());
    expect(scenario.editable?.element.style.height).toBe("60px");
    expect(scenario.editable?.element.style.overflowY).toBe("auto");
    expect(scenario.onHeightChange).toHaveBeenLastCalledWith(60);

    act(() => scenario.result.current.increaseHeightForEmptyContent());
    expect(scenario.onHeightChange).toHaveBeenCalledTimes(2);

    act(() => scenario.result.current.smartResize());
    scenario.animationFrames.flushAll();
    expect(scenario.editable?.element.style.height).toBe("60px");

    act(() => scenario.result.current.resetManualResize());
    scenario.editable!.element.style.height = "60px";
    act(() => scenario.result.current.smartResize());
    scenario.animationFrames.flushAll();
    expect(scenario.editable?.element.style.height).toBe("20px");
  });
});

describe("prefilled value application", () => {
  it("applies a new value immediately, focuses it, and signals consumption", () => {
    const animationFrames = installControlledAnimationFrames();
    const { element } = createEditableElement({ text: "" });
    const ref = { current: element };
    const onValueApplied = vi.fn();
    const focus = vi.spyOn(element, "focus");
    const { rerender, unmount } = renderHook(
      ({ value }: { value: IMessageToSend | undefined }) =>
        useAutoResize(ref, { value, onValueApplied }),
      {
        initialProps: {
          value: undefined as IMessageToSend | undefined,
        },
      },
    );

    rerender({ value: { text: "restored draft", timestamp: 1 } });

    expect(element.textContent).toBe("restored draft");
    expect(focus).toHaveBeenCalledOnce();
    expect(onValueApplied).toHaveBeenCalledOnce();
    animationFrames.flushAll();
    unmount();
  });

  it("applies a value when no consumption callback is supplied", () => {
    const animationFrames = installControlledAnimationFrames();
    const { element } = createEditableElement({ text: "" });
    const ref = { current: element };

    renderHook(() =>
      useAutoResize(ref, {
        value: { text: "unmanaged draft", timestamp: 2 },
      }),
    );

    expect(element.textContent).toBe("unmanaged draft");
    animationFrames.flushAll();
  });

  it("retries value application on the next frame when the ref mounts late", () => {
    const animationFrames = installControlledAnimationFrames();
    const ref: RefObject<HTMLElement | null> = { current: null };
    const onValueApplied = vi.fn();
    const { unmount } = renderHook(() =>
      useAutoResize(ref, {
        value: { text: "late draft", timestamp: 3 },
        onValueApplied,
      }),
    );
    const editable = createEditableElement({ text: "" });
    const focus = vi.spyOn(editable.element, "focus");
    ref.current = editable.element;

    animationFrames.flushNext();

    expect(editable.element.textContent).toBe("late draft");
    expect(focus).toHaveBeenCalledOnce();
    expect(onValueApplied).toHaveBeenCalledOnce();
    animationFrames.flushAll();
    unmount();
    expect(animationFrames.cancel).toHaveBeenCalled();
  });

  it("cancels a pending late-mount value retry on unmount", () => {
    const animationFrames = installControlledAnimationFrames();
    const ref: RefObject<HTMLElement | null> = { current: null };
    const { unmount } = renderHook(() =>
      useAutoResize(ref, {
        value: { text: "unused", timestamp: 4 },
      }),
    );

    unmount();

    expect(animationFrames.cancel).toHaveBeenCalledWith(1);
  });
});
