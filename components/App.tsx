"use client";

import { useCallback, useRef, useState } from "react";
import DropScreen from "@/components/DropScreen";
import Editor from "@/components/Editor";
import Splash from "@/components/Splash";
import { getFFmpeg } from "@/lib/convert";

type Step = "splash" | "drop" | "editor";

export default function App() {
  const [step, setStep] = useState<Step>("splash");
  const [file, setFile] = useState<File | null>(null);
  const warmed = useRef(false);

  // Start downloading the converter as early as possible so the first export feels instant.
  const warmEngine = useCallback(() => {
    if (warmed.current) return;
    warmed.current = true;
    getFFmpeg().catch(() => { warmed.current = false; });
  }, []);

  if (step === "splash") {
    return (
      <Splash
        onStart={() => {
          warmEngine();
          setStep("drop");
        }}
      />
    );
  }

  if (step === "drop" || !file) {
    return (
      <DropScreen
        onBack={() => setStep("splash")}
        onFile={(f) => {
          setFile(f);
          setStep("editor");
        }}
      />
    );
  }

  return (
    <Editor
      key={`${file.name}-${file.size}-${file.lastModified}`}
      file={file}
      onReplace={() => {
        setFile(null);
        setStep("drop");
      }}
    />
  );
}
