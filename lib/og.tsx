import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

const C = { bg: "#0e0f11", surface: "#141619", border: "#272b31", text: "#ece8e1", muted: "#a19d94", faint: "#6e6b65", accent: "#e8a23b", dir: "#7aa2c8" };

export function shareCard(card: { eyebrow: string; title: string; subtitle: string; prompt: string; footer: string }) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: C.bg, padding: 56 }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, border: `1px solid ${C.border}`, borderRadius: 16, background: C.surface }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 24px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ width: 14, height: 14, borderRadius: 7, background: "#d7826b" }} />
            <div style={{ width: 14, height: 14, borderRadius: 7, background: "#c9b46b" }} />
            <div style={{ width: 14, height: 14, borderRadius: 7, background: "#78b39a" }} />
            <div style={{ marginLeft: 16, color: C.faint, fontSize: 22 }}>kernel — ~</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", padding: "40px 48px", flex: 1 }}>
            <div style={{ color: C.accent, fontSize: 26, letterSpacing: 2 }}>{card.eyebrow}</div>
            <div style={{ color: C.text, fontSize: 68, fontWeight: 700, marginTop: 18 }}>{card.title}</div>
            <div style={{ color: C.muted, fontSize: 32, marginTop: 14 }}>{card.subtitle}</div>
            <div style={{ display: "flex", marginTop: "auto", fontSize: 28 }}>
              <span style={{ color: C.accent }}>kernel</span>
              <span style={{ color: C.dir, marginLeft: 12 }}>~</span>
              <span style={{ color: C.faint, marginLeft: 12 }}>$</span>
              <span style={{ color: C.text, marginLeft: 12 }}>{card.prompt}</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", color: C.faint, fontSize: 22, marginTop: 20 }}>
          <span>{card.footer}</span>
          <span>KERNEL</span>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
