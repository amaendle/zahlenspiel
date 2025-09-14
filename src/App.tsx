import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function KinderZahlenSpiel() {
  // --- STATE ---
  const [selected, setSelected] = useState<number | null>(null);
  const [displayedCount, setDisplayedCount] = useState(0);
  const [target, setTarget] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(250); // ms zwischen Symbol-Einblendungen
  const [emoji, setEmoji] = useState("🎈");
  const [isBusy, setIsBusy] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [ttsRate, setTtsRate] = useState(0.95);
  const [ttsVolume, setTtsVolume] = useState(1.0);
  const [theme, setTheme] = useState<"sky" | "pink" | "green" | "purple">("sky");
  const [gameMode, setGameMode] = useState(false);
  const [taskNumber, setTaskNumber] = useState<number | null>(null);
  const [gameTaskType, setGameTaskType] = useState<"number" | "objects">("number");
  const [gameEmoji, setGameEmoji] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"richtig" | "falsch" | null>(null);
  const [objectOptions, setObjectOptions] = useState<Array<{ n: number; e: string; correct: boolean }>>([]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef = useRef(0);
  const liveRef = useRef<HTMLDivElement | null>(null);

  // --- DATA ---
  const deWords = ["Null", "Eins", "Zwei", "Drei", "Vier", "Fünf", "Sechs", "Sieben", "Acht", "Neun"];

  const objectNames: Record<string, { singular: string; plural: string; gender: "m" | "f" | "n" }> = {
    "🎈": { singular: "Ballon", plural: "Ballons", gender: "m" },
    "⭐": { singular: "Stern", plural: "Sterne", gender: "m" },
    "🍎": { singular: "Apfel", plural: "Äpfel", gender: "m" },
    "🧩": { singular: "Puzzleteil", plural: "Puzzleteile", gender: "n" },
    "🐞": { singular: "Marienkäfer", plural: "Marienkäfer", gender: "m" },
    "🟢": { singular: "Punkt", plural: "Punkte", gender: "m" },
    "🌸": { singular: "Blume", plural: "Blumen", gender: "f" },
    "🏠": { singular: "Haus", plural: "Häuser", gender: "n" },
  };

  const emojiOptions = ["🎈", "⭐", "🍎", "🧩", "🐞", "🟢", "🌸", "🏠"] as const;

  const themes = {
    sky: { from: "from-sky-50", to: "to-white", primary: "sky" },
    pink: { from: "from-pink-50", to: "to-white", primary: "pink" },
    green: { from: "from-green-50", to: "to-white", primary: "green" },
    purple: { from: "from-purple-50", to: "to-white", primary: "purple" },
  } as const;

  const themeConfig = themes[theme]; // ✅ vorher fehlend → verursacht ReferenceError

  // --- VOICES (TTS) ---
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string | null>(null);
  const loadVoices = () => {
    const vs = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    setVoices(vs);
    const deVoice = vs.find((v) => v.lang?.toLowerCase().startsWith("de"));
    if (deVoice) setVoiceURI((prev) => prev ?? deVoice.voiceURI);
    else if (vs[0]) setVoiceURI((prev) => prev ?? vs[0].voiceURI);
  };

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    loadVoices();
    (window as any).speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      (window as any).speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const germanVoices = useMemo(() => voices.filter((v) => v.lang?.toLowerCase().startsWith("de")), [voices]);

  // --- HELPERS ---
  const articleFor = (gender: "m" | "f" | "n") => (gender === "f" ? "eine" : "ein");
  const finalTextFor = (n: number, emojiKey: string) => {
    const obj = objectNames[emojiKey];
    return n === 1 ? `${articleFor(obj.gender)} ${obj.singular}` : `${n} ${obj.plural}`;
  };
  const countNounText = (n: number, emojiKey: string) => {
    const obj = objectNames[emojiKey];
    return n === 1 ? `1 ${obj.singular}` : `${n} ${obj.plural}`;
  };

  const shuffle = <T,>(arr: T[]) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const pickDifferent = <T,>(list: T[], not: T) => list.filter((x) => x !== not)[Math.floor(Math.random() * (list.length - 1))];

  const speakAsync = (text: string, { cancelBefore = false } = {}) => {
    return new Promise<void>((resolve) => {
      if (muted || !("speechSynthesis" in window)) return resolve();
      try {
        if (cancelBefore) window.speechSynthesis.cancel();
        const ut = new SpeechSynthesisUtterance(text);
        const v = voices.find((vv) => vv.voiceURI === voiceURI!);
        if (v) ut.voice = v;
        ut.lang = v?.lang || "de-DE";
        ut.rate = ttsRate;
        ut.pitch = 1.05;
        ut.volume = ttsVolume;
        ut.onend = () => resolve();
        ut.onerror = () => resolve();
        window.speechSynthesis.speak(ut);
      } catch {
        resolve();
      }
    });
  };

  const stopAll = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if ("speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
  };

  // --- MAIN ACTIONS ---
  const handlePress = async (n: number) => {
    if (gameMode) {
      if (taskNumber === null) return;

      if (gameTaskType === "number") {
        if (n === taskNumber) {
          setFeedback("richtig");
          await speakAsync(`Richtig! ${deWords[n]}`, { cancelBefore: true });
          setTimeout(() => newTask(), 1200);
        } else {
          setFeedback("falsch");
          await speakAsync("Versuch es nochmal!", { cancelBefore: true });
        }
        return;
      }

      // Im Objekte-Modus wird nicht die Zahl gedrückt, sondern eine der 4 Kacheln
      return;
    }

    // Normalmodus (Zählen-Animation)
    sessionRef.current += 1;
    const mySession = sessionRef.current;
    stopAll();
    setIsBusy(true);
    setSelected(n);
    setTarget(n);
    setDisplayedCount(0);

    await speakAsync(deWords[n], { cancelBefore: true });
    if (mySession !== sessionRef.current) return;

    const countPromise = new Promise<void>((resolve) => {
      if (n === 0) { setDisplayedCount(0); resolve(); return; }
      let i = 0;
      intervalRef.current = setInterval(() => {
        i += 1;
        setDisplayedCount(i);
        if (i >= n) { clearInterval(intervalRef.current!); intervalRef.current = null; resolve(); }
      }, Math.max(100, speed));
    });

    await countPromise;
    if (mySession !== sessionRef.current) return;
    await speakFinal(n);
    if (mySession === sessionRef.current) setIsBusy(false);
  };

  const speakFinal = async (n: number) => {
    const text = finalTextFor(n, emoji);
    if (liveRef.current) { liveRef.current.textContent = text; }
    await speakAsync(text, { cancelBefore: false });
    try { if (navigator.vibrate) navigator.vibrate(60); } catch {}
  };

  // Beim Symbolwechsel Endansage wiederholen, falls schon gezählt wurde
  useEffect(() => {
    if (selected !== null && target === selected) { speakFinal(selected); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emoji]);

  useEffect(() => () => { stopAll(); }, []);

  const newTask = () => {
    stopAll();
    setSelected(null);
    setDisplayedCount(0);
    setTarget(0);
    setIsBusy(false);
    setFeedback(null);

    const type: "number" | "objects" = Math.random() < 0.5 ? "number" : "objects";
    setGameTaskType(type);

    const rndNum = type === "number" ? Math.floor(Math.random() * 10) : Math.max(1, Math.floor(Math.random() * 10));
    setTaskNumber(rndNum);

    if (type === "objects") {
      const correctEmoji = emojiOptions[Math.floor(Math.random() * emojiOptions.length)];
      const otherEmoji = pickDifferent([...emojiOptions], correctEmoji) as string;
      setGameEmoji(correctEmoji);

      // abweichende falsche Anzahl (1..9) ≠ rndNum
      let altNum = Math.max(1, Math.floor(Math.random() * 10));
      if (altNum === rndNum) altNum = ((altNum % 9) + 1);

      const opts = shuffle([
        { n: rndNum, e: correctEmoji, correct: true },
        { n: rndNum, e: otherEmoji, correct: false },
        { n: altNum, e: correctEmoji, correct: false },
        { n: altNum, e: otherEmoji, correct: false },
      ]);
      setObjectOptions(opts);

      speakAsync(`Finde ${countNounText(rndNum, correctEmoji)}`, { cancelBefore: true });
    } else {
      setGameEmoji(null);
      setObjectOptions([]);
      speakAsync(`Finde die ${deWords[rndNum]}`, { cancelBefore: true });
    }
  };

  // Tastatur: im Objekte-Spielmodus ignorieren (Kind soll Kachel wählen)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        if (gameMode && gameTaskType === "objects") return;
        handlePress(Number(e.key));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gameMode, gameTaskType, handlePress]);

  const handleObjectOptionClick = async (opt: { n: number; e: string; correct: boolean }) => {
    if (!gameMode || gameTaskType !== "objects") return;
    setSelected(null); // keine Nummer markieren
    setDisplayedCount(opt.n);
    setTarget(opt.n);

    if (opt.correct) {
      setFeedback("richtig");
      await speakAsync(`Richtig! ${countNounText(opt.n, opt.e)}`, { cancelBefore: true });
      setTimeout(() => newTask(), 1400);
    } else {
      setFeedback("falsch");
      await speakAsync("Nicht ganz. Schau genau hin!", { cancelBefore: true });
    }
  };

  // --- DERIVED ---
  const countArray = useMemo(() => Array.from({ length: displayedCount }, (_, i) => i), [displayedCount]);

  // --- DEV TESTS (Grammatik) ---
  const testCases = useMemo(
    () => [
      // Basisfälle
      { n: 1, e: "🍎", expect: "ein Apfel" },
      { n: 1, e: "🌸", expect: "eine Blume" },
      { n: 1, e: "🧩", expect: "ein Puzzleteil" },
      { n: 0, e: "🎈", expect: "0 Ballons" },
      { n: 5, e: "🏠", expect: "5 Häuser" },
      { n: 2, e: "⭐", expect: "2 Sterne" },
      // Zusatzfälle
      { n: 1, e: "🎈", expect: "ein Ballon" },
      { n: 3, e: "🐞", expect: "3 Marienkäfer" },
      { n: 0, e: "🍎", expect: "0 Äpfel" },
      { n: 9, e: "🟢", expect: "9 Punkte" },
      { n: 0, e: "🌸", expect: "0 Blumen" },
      { n: 7, e: "🧩", expect: "7 Puzzleteile" },
      // Mehr Tests hinzugefügt
      { n: 1, e: "⭐", expect: "ein Stern" },
      { n: 4, e: "🎈", expect: "4 Ballons" },
    ],
    []
  );

  const grammarTests = useMemo(
    () => testCases.map((t) => ({ ...t, got: finalTextFor(t.n, t.e), pass: finalTextFor(t.n, t.e) === t.expect })),
    [testCases]
  );

  // --- RENDER ---
  return (
    <div className={`min-h-screen w-full bg-gradient-to-b ${themeConfig.from} ${themeConfig.to} flex flex-col items-center p-4 sm:p-6`}>
      <header className="w-full max-w-4xl">
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-2">Zahlen drücken &amp; mitzählen</h1>
        <p className="text-center text-gray-600 mb-4">
          {gameMode
            ? "Spielmodus: Finde die richtige Zahl oder die richtige Anzahl Objekte!"
            : `Tippe auf eine Zahl (0–9). Die Zahl wird gesagt und ${emoji} erscheinen nacheinander.`}
        </p>

        {!gameMode && (
          <div className="w-full flex justify-center mb-4">
            {/* 2-zeilige, responsive Symbolleiste */}
            <div className="grid gap-2 grid-cols-4 sm:grid-cols-8" style={{ alignItems: "stretch" }}>
              {emojiOptions.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  aria-pressed={emoji === e}
                  aria-label={`${e} ${objectNames[e].singular}`}
                  className={`rounded-2xl px-5 py-4 text-4xl transition shadow-sm select-none ${
                    emoji === e ? "bg-yellow-200 border-4 border-yellow-400" : "bg-white hover:bg-gray-100"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}

        {!("speechSynthesis" in window) && (
          <p className="text-center text-rose-600 mt-2">⚠️ Dein Browser unterstützt keine Sprachausgabe.</p>
        )}
      </header>

      <main className="w-full max-w-4xl mt-6 grid gap-4">
        {/* AUFGABE (immer oben anzeigen, wenn Spielmodus aktiv) */}
        {gameMode && taskNumber !== null && (
          <div className="text-center">
            {gameTaskType === "number" ? (
              <p className="text-lg font-semibold">
                Welche Zahl ist <span className="underline">{deWords[taskNumber]}</span>?
              </p>
            ) : (
              <p className="text-lg font-semibold flex items-center justify-center gap-2">
                Finde <span className="underline">{countNounText(taskNumber, gameEmoji || emoji)}</span>
                <span className="text-2xl" aria-hidden={true}>{gameEmoji || emoji}</span>
              </p>
            )}
            {feedback === "richtig" && <p className="text-green-600 mt-2">✅ Richtig!</p>}
            {feedback === "falsch" && <p className="text-red-600 mt-2">❌ Falsch, versuch es nochmal.</p>}
          </div>
        )}

        {/* ZAHLENREIHE – im Objekte-Spielmodus ausblenden */}
        {(!gameMode || gameTaskType === "number") && (
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {Array.from({ length: 10 }, (_, i) => i).map((n) => (
              <button
                key={n}
                className={`rounded-2xl px-4 py-4 sm:py-6 text-2xl font-bold shadow transition active:scale-95 ${
                  selected === n ? "bg-yellow-200 border-4 border-yellow-400" : "bg-white text-gray-800 hover:bg-gray-100"
                } ${isBusy ? "opacity-90" : ""}`}
                onClick={() => handlePress(n)}
              >
                {n}
              </button>
            ))}
          </div>
        )}

        {/* Normalmodus: Zähl-Animation */}
        {!gameMode && (
          <div className="bg-white rounded-3xl shadow p-4 sm:p-6 min-h-[180px]">
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg">
                Gewählt: <span className="font-bold">{selected ?? "–"}</span>
              </div>
              <div className="text-lg">
                Gezählt: <span className="font-bold">{displayedCount}</span> / <span className="font-bold">{target}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {countArray.map((i) => (
                <motion.div
                  key={`${emoji}-${target}-${i}`}
                  initial={{ scale: 0, opacity: 0, rotate: -10 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18, delay: i * Math.max(0.06, (speed / 1000) * 0.25) }}
                  className="text-4xl sm:text-5xl select-none"
                  aria-hidden={true}
                >
                  {emoji}
                </motion.div>
              ))}
            </div>
            <div ref={liveRef} aria-live="polite" className="sr-only" />
          </div>
        )}

        {/* Spielmodus Objekte: 4 Antwortkacheln anzeigen (Zahlenreihe ist oben ausgeblendet) */}
        {gameMode && taskNumber !== null && gameTaskType === "objects" && (
          <div className="grid grid-cols-2 gap-3 justify-center">
            {objectOptions.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => handleObjectOptionClick(opt)}
                className="rounded-2xl bg-white px-4 py-3 text-3xl shadow hover:bg-gray-100"
                aria-label={`${countNounText(opt.n, opt.e)}`}
              >
                {Array.from({ length: opt.n }, () => opt.e).join(" ")}
              </button>
            ))}
          </div>
        )}
      </main>

      <footer className="mt-6 text-center text-sm text-gray-500 w-full">
        <div className="w-full flex flex-col items-center gap-2">
          <button
            onClick={() => {
              setGameMode(!gameMode);
              setFeedback(null);
              if (!gameMode) newTask();
            }}
            className={`px-4 py-2 rounded-xl text-white bg-${themeConfig.primary}-500 hover:bg-${themeConfig.primary}-600`}
          >
            {gameMode ? "🔙 Normaler Modus" : "🎮 Spielmodus starten"}
          </button>

          {!gameMode && <p>Tipp: Du kannst auch die Zifferntasten 0–9 auf deiner Tastatur benutzen.</p>}

          <button onClick={() => setShowOptions(!showOptions)} className="text-sm text-sky-600 underline">
            {showOptions ? "Einstellungen ausblenden" : "Einstellungen anzeigen"}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {showOptions && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center justify-center gap-3 mt-3">
                <label className="flex items-center gap-2 bg-white shadow px-3 py-2 rounded-2xl">
                  <span className="text-sm text-gray-600">Tempo</span>
                  <input
                    type="range"
                    min="120"
                    max="600"
                    step="20"
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                  />
                  <span className="text-xs text-gray-500 w-10 text-right">{speed} ms</span>
                </label>

                <label className="flex items-center gap-2 bg-white shadow px-3 py-2 rounded-2xl">
                  <input
                    type="checkbox"
                    checked={muted}
                    onChange={(e) => setMuted(e.target.checked)}
                  />
                  <span className="text-sm">{muted ? "Stumm" : "Ton an"}</span>
                </label>

                <label className="flex items-center gap-2 bg-white shadow px-3 py-2 rounded-2xl">
                  <span className="text-sm text-gray-600">Stimme</span>
                  <select
                    value={voiceURI || ""}
                    onChange={(e) => setVoiceURI(e.target.value)}
                    className="outline-none bg-transparent"
                  >
                    {germanVoices.length > 0
                      ? germanVoices.map((v) => (
                          <option key={v.voiceURI} value={v.voiceURI}>
                            {v.name} ({v.lang})
                          </option>
                        ))
                      : voices.map((v) => (
                          <option key={v.voiceURI} value={v.voiceURI}>
                            {v.name} ({v.lang})
                          </option>
                        ))}
                  </select>
                </label>

                <label className="flex items-center gap-2 bg-white shadow px-3 py-2 rounded-2xl">
                  <span className="text-sm text-gray-600">Sprechgeschwindigkeit</span>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.05"
                    value={ttsRate}
                    onChange={(e) => setTtsRate(Number(e.target.value))}
                  />
                  <span className="text-xs text-gray-500 w-10 text-right">{ttsRate.toFixed(2)}x</span>
                </label>

                <label className="flex items-center gap-2 bg-white shadow px-3 py-2 rounded-2xl">
                  <span className="text-sm text-gray-600">Lautstärke</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={ttsVolume}
                    onChange={(e) => setTtsVolume(Number(e.target.value))}
                  />
                  <span className="text-xs text-gray-500 w-10 text-right">{Math.round(ttsVolume * 100)}%</span>
                </label>

                <label className="flex items-center gap-2 bg-white shadow px-3 py-2 rounded-2xl">
                  <span className="text-sm text-gray-600">Farbschema</span>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as any)}
                    className="outline-none bg-transparent"
                  >
                    <option value="sky">Himmelblau</option>
                    <option value="pink">Rosa</option>
                    <option value="green">Grün</option>
                    <option value="purple">Lila</option>
                  </select>
                </label>

                {/* DEV: Grammatik-Tests */}
                <div className="w-full">
                  <details className="bg-white rounded-2xl shadow px-3 py-2">
                    <summary className="cursor-pointer text-sm font-semibold">DEV: Grammatik-Tests</summary>
                    <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      {grammarTests.map((t, idx) => (
                        <li
                          key={idx}
                          className={`rounded-xl px-3 py-2 border ${t.pass ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}
                        >
                          <div>
                            <span className="font-mono">{t.n}</span> {objectNames[t.e].singular} → <span className="font-semibold">{t.got}</span>
                          </div>
                          <div className="text-xs text-gray-500">Erwartet: {t.expect} {t.pass ? "✅" : "❌"}</div>
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </footer>
    </div>
  );
}
