import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "소개 | promppy",
  description: "promppy — 한국 AI 실무자를 위한 실시간 AI 뉴스 터미널 소개",
};

export default function AboutPage() {
  return (
    <LegalPage title="promppy 소개" effectiveDate="2026년 7월">
      <p>
        <strong>promppy</strong>는 한국 AI 실무자 — Cursor, Claude, Copilot과 주요 모델 API를 매일 쓰는
        개발자 — 를 위한 실시간 AI 뉴스 터미널입니다. 전 세계 AI 소식을 한국어 한 줄 요약과 함께,
        중요한 것부터 빠르게 전합니다.
      </p>

      <h2>어떻게 동작하나요</h2>
      <ul>
        <li>
          <strong>자동 수집</strong> — OpenAI·Anthropic·Google 등 공식 블로그, 주요 테크 미디어, Hacker
          News, Reddit의 AI 커뮤니티, 국내 매체까지 25개 이상의 출처를 매시간 수집합니다.
        </li>
        <li>
          <strong>AI 분류·요약</strong> — 각 소식에 중요도 등급(<strong>속보·중요·참고</strong>)을
          부여하고, 단순 번역이 아니라 &ldquo;한국 AI 실무자에게 왜 중요한가&rdquo;를 한 줄로 정리합니다.
        </li>
        <li>
          <strong>중복 제거</strong> — 같은 사건을 다룬 여러 출처의 기사(외신과 국내 재보도 포함)는
          하나로 정리합니다.
        </li>
      </ul>

      <h2>등급의 의미</h2>
      <ul>
        <li>
          <strong style={{ color: "#ff4d4f" }}>속보</strong> — 지금 바로 알아야 할 소식. 주요 모델 출시,
          대형 업계 사건, 서비스 장애, 즉시 발효되는 규제.
        </li>
        <li>
          <strong style={{ color: "#ffb020" }}>중요</strong> — 오늘 읽을 가치가 있는 소식. 이번 주 업무
          방식에 영향을 줄 수 있는 도구 업데이트, 벤치마크, 업계 동향.
        </li>
        <li>
          <strong>참고</strong> — 알아두면 좋은 소식. 화제의 논문, 분석 기사, 커뮤니티의 유용한 팁.
        </li>
      </ul>

      <h2>알려드립니다</h2>
      <p>
        요약과 등급은 AI가 자동 생성하며 부정확할 수 있습니다. 중요한 판단 전에는 반드시 원문을
        확인해 주세요. 모든 항목에는 원문 링크가 함께 제공됩니다.
      </p>

      <h2>문의</h2>
      <p>
        제안, 출처 추가 요청, 오류 제보는 <strong>admin@promppy.com</strong>으로 보내주세요.
      </p>
    </LegalPage>
  );
}
