import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// promppy_ mark: amber terminal cursor on the site's dark background.
export default function Icon() {
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
          borderRadius: 6,
          color: "#ffffff",
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        p<span style={{ color: "#ffb020" }}>_</span>
      </div>
    ),
    { ...size }
  );
}
