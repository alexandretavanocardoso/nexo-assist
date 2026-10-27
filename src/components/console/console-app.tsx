"use client";

import { LogOut, MessageCircle, MessagesSquare, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { NexoMark } from "@/components/ui/nexo-mark";
import { useLogout } from "@/components/use-logout";
import { requestJson } from "@/lib/sse-client";
import type { ConsoleFilter, ConsoleList } from "@/server/console/console-service";
import type { ConversationView } from "@/services/conversations/types";
import type { TicketView } from "@/services/tickets/types";
import { ConversationList } from "./conversation-list";
import { ConversationPane, type PaneAction } from "./conversation-pane";
import { TicketsPanel } from "./tickets-panel";

type Detail = { conversation: ConversationView; tickets: TicketView[] | null; ticketsError: string | null };

const LIST_POLL_MS = 5000;
const DETAIL_POLL_MS = 3000;

export function ConsoleApp({
  analyst,
  initialList,
  initialSelectedId,
}: {
  analyst: { id: string; name: string; initials: string; level: string | null };
  initialList: ConsoleList;
  initialSelectedId: string | null;
}) {
  const logout = useLogout(useRouter());
  const [filter, setFilter] = useState<ConsoleFilter>("todas");
  const [query, setQuery] = useState("");
  const [list, setList] = useState<ConsoleList | null>(initialList);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Lista de conversas (atualiza sozinha).
  useEffect(() => {
    let active = true;
    const load = () =>
      requestJson<ConsoleList>(`/api/console/conversations?filter=${filter}&q=${encodeURIComponent(query)}`)
        .then((data) => active && setList(data))
        .catch(() => active && setNotice("Sem conexão com o servidor. Tentando de novo…"));
    void load();
    const timer = setInterval(load, LIST_POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [filter, query]);

  const loadDetail = useCallback(async (id: string) => {
    const data = await requestJson<Detail>(`/api/console/conversations/${id}`);
    setDetail(data);
    setNotice(null);
  }, []);

  // Conversa selecionada (atualiza sozinha para ver as novas mensagens do funcionário).
  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    const load = () =>
      loadDetail(selectedId).catch(() => active && setNotice("Não foi possível atualizar a conversa."));
    void load();
    const timer = setInterval(load, DETAIL_POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selectedId, loadDetail]);

  function select(id: string) {
    setSelectedId(id);
    setDetail((d) => (d?.conversation.id === id ? d : null));
    setError(null);
    window.history.replaceState(null, "", `/console?c=${id}`);
  }

  async function post(body: { action: PaneAction } | { action: "message"; text: string }): Promise<boolean> {
    if (!selectedId) return false;
    setBusy(true);
    setError(null);
    try {
      await requestJson(`/api/console/conversations/${selectedId}`, { method: "POST", body: JSON.stringify(body) });
      await loadDetail(selectedId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir a ação.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function simulateOutage() {
    try {
      await requestJson("/api/demo/outage", { method: "POST" });
      setNotice(
        "Sistema de chamados fora do ar por 10 s (simulação). O agent vai tentar de novo e avisar o funcionário.",
      );
      setTimeout(() => setNotice(null), 10_000);
    } catch {
      setNotice("Não foi possível simular a queda.");
    }
  }

  const selected = detail?.conversation.id === selectedId ? detail : null;

  return (
    <div className="bg-paper flex h-screen overflow-hidden">
      <nav className="border-rule bg-desk flex w-16 shrink-0 flex-col items-center gap-1.5 border-r py-4">
        <span className="flex size-10 items-center justify-center pb-2">
          <NexoMark size={22} />
        </span>
        <span
          className="bg-paper text-ink relative flex size-10 items-center justify-center rounded-xl"
          title="Conversas"
        >
          <MessageCircle size={18} />
          {(list?.counts.para_voce ?? 0) > 0 && (
            <span className="bg-cta ring-desk absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-[5px] text-[10px] font-bold text-white ring-2">
              {list?.counts.para_voce}
            </span>
          )}
        </span>
        <span className="flex-1" />
        <button
          onClick={simulateOutage}
          title="Simular queda do sistema de chamados (10 s)"
          className="text-ink-3 hover:bg-paper hover:text-warning-text flex size-10 items-center justify-center rounded-xl"
        >
          <Zap size={18} />
        </button>
        <button
          onClick={logout}
          title="Sair"
          className="text-ink-3 hover:bg-paper flex size-10 items-center justify-center rounded-xl"
        >
          <LogOut size={17} />
        </button>
        <span
          className="bg-primary-soft text-primary-text relative flex size-9 items-center justify-center rounded-full text-[12.5px] font-bold"
          title={`${analyst.name}${analyst.level ? ` · Suporte ${analyst.level}` : ""}`}
        >
          {analyst.initials}
          <span className="bg-success ring-desk absolute right-0 bottom-0 size-2.5 rounded-full ring-2" />
        </span>
      </nav>

      <ConversationList
        list={list}
        filter={filter}
        query={query}
        selectedId={selectedId}
        analystId={analyst.id}
        onFilter={setFilter}
        onQuery={setQuery}
        onSelect={select}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {notice && <p className="bg-warning-soft text-warning-text px-4 py-2 text-[13px]">{notice}</p>}
        <div className="flex min-h-0 flex-1">
          {selected ? (
            <>
              <ConversationPane
                conversation={selected.conversation}
                analystId={analyst.id}
                busy={busy}
                error={error}
                onAction={(action) => void post({ action })}
                onSend={(text) => post({ action: "message", text })}
              />
              {panelOpen && (
                <TicketsPanel
                  employeeName={selected.conversation.employee.name}
                  tickets={selected.tickets}
                  error={selected.ticketsError}
                  currentNumber={selected.conversation.handoff?.ticketNumber ?? null}
                  onClose={() => setPanelOpen(false)}
                />
              )}
            </>
          ) : (
            <div className="bg-canvas text-ink-3 flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <MessagesSquare size={32} />
              <p className="max-w-xs text-[14px]">
                {selectedId
                  ? "Carregando conversa…"
                  : "Selecione uma conversa. As que precisam de você aparecem em “Para você”."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
