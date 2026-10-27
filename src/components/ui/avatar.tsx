import { cn } from "./status";

// Paleta do protótipo para os avatares (fundo, texto).
const PALETTE: Array<[string, string]> = [
  ["#DCE9F7", "#0062C4"],
  ["#F6E3D3", "#9A4A12"],
  ["#E6E1F7", "#5B3FC4"],
  ["#DDF0E6", "#1E7A4C"],
  ["#F7E1E6", "#A3324F"],
  ["#E5E8EC", "#3D4656"],
  ["#FBEFD0", "#8A6100"],
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

export function Avatar({
  name,
  size = 46,
  online,
  ring = "#FFFFFF",
}: {
  name: string;
  size?: number;
  online?: boolean;
  ring?: string;
}) {
  const hash = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const [bg, fg] = PALETTE[hash % PALETTE.length] ?? PALETTE[0]!;
  return (
    <span
      className={cn("relative flex shrink-0 items-center justify-center rounded-full font-semibold")}
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.34 }}
    >
      {initialsOf(name)}
      {online && (
        <span
          className="bg-success absolute right-0 bottom-0 rounded-full"
          style={{ width: size * 0.24, height: size * 0.24, boxShadow: `0 0 0 2px ${ring}` }}
        />
      )}
    </span>
  );
}
