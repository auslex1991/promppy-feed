import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 104,
          fontWeight: 700,
        }}
      >
        p<span style={{ color: "#ffb020" }}>_</span>
      </div>
    ),
    { ...size }
  );
}
