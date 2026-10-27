"use client";

import { ArrowUp, LoaderCircle } from "lucide-react";
import { forwardRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/components/ui/status";

type ComposerProps = {
  disabled: boolean;
  busy: boolean;
  placeholder: string;
  counter: string | null;
  onSend: (text: string) => void;
  /** Teclas 1–4 com o campo vazio escolhem uma opção rápida. */
  onShortcut?: (key: string) => boolean;
};

export const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(function Composer(
  { disabled, busy, placeholder, counter, onSend, onShortcut },
  ref,
) {
  const [text, setText] = useState("");

  function submit() {
    const value = text.trim();
    if (!value || disabled || busy) return;
    onSend(value);
    setText("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      submit();
      return;
    }
    if (!text && /^[1-4]$/.test(event.key) && onShortcut?.(event.key)) event.preventDefault();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          "border-line bg-paper focus-within:border-cta flex min-h-12 items-end gap-2 rounded-xl border py-1.5 pr-1.5 pl-4",
          disabled && "opacity-60",
        )}
      >
        <textarea
          ref={ref}
          rows={1}
          value={text}
          disabled={disabled}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="text-ink placeholder:text-ink-3 [field-sizing:content] max-h-32 min-h-9 flex-1 resize-none self-center bg-transparent py-1.5 text-[14.5px] outline-none"
        />
        <button
          onClick={submit}
          disabled={disabled || busy || !text.trim()}
          className="bg-cta hover:bg-cta-hover flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-[13.5px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? <LoaderCircle size={14} className="animate-spin" /> : <ArrowUp size={14} />}
          Enviar
        </button>
      </div>
      {counter && <p className="text-ink-3 text-right text-[12.5px]">{counter}</p>}
    </div>
  );
});
