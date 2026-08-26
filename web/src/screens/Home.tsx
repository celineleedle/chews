import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createRoom } from "../lib/api";
import { getSavedName, saveName } from "../lib/identity";
import { GhostButton, PrimaryButton, Screen, TextField } from "../components/ui";

export default function Home() {
  const navigate = useNavigate();
  const [name, setName] = useState(getSavedName());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = name.trim().length > 0;

  async function startRoom() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      saveName(name.trim());
      const code = await createRoom();
      navigate(`/room/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  function goJoin() {
    if (!ready) return;
    saveName(name.trim());
    navigate("/join");
  }

  return (
    <Screen className="justify-center gap-10">
      <div className="text-center">
        <div className="mb-3 text-7xl">🍜</div>
        <h1 className="font-display text-6xl font-black tracking-tight text-ink">chews</h1>
        <p className="mt-3 text-lg text-ink-soft">
          Swipe on restaurants with your crew.
          <br />
          First one everyone loves wins.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <label className="text-sm font-semibold text-ink-soft" htmlFor="name">
          What should we call you?
        </label>
        <TextField value={name} onChange={setName} placeholder="Your name" maxLength={24} />
        <div className="mt-2 flex flex-col gap-3">
          <PrimaryButton onClick={startRoom} disabled={!ready || busy}>
            {busy ? "Setting the table…" : "Start a room"}
          </PrimaryButton>
          <GhostButton onClick={goJoin} disabled={!ready}>
            I have a code
          </GhostButton>
        </div>
        {error && <p className="text-center text-sm font-medium text-primary-deep">{error}</p>}
      </div>
    </Screen>
  );
}
