import { ImageResponse } from "next/og";

const SIZES = new Set([192, 512]);

// PWA manifest icons (192/512) generated on demand — same p_ mark as icon.tsx.
export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size: sizeParam } = await ctx.params;
  const size = Number(sizeParam);
  if (!SIZES.has(size)) return new Response("not found", { status: 404 });
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0e14",
          color: "#ffffff",
          fontSize: size * 0.55,
          fontWeight: 700,
        }}
      >
        p<span style={{ color: "#ffb020" }}>_</span>
      </div>
    ),
    { width: size, height: size }
  );
}
