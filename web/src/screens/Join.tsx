import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { checkRoom } from "../lib/api";
import { Logo, PrimaryButton, Screen, TextField } from "../components/ui";

export default function Join() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleaned = code.toUpperCase().replace(/[^A-Z0-9]/g, "");

  async function join() {
    if (cleaned.length < 5 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { exists, status } = await checkRoom(cleaned);
      if (!exists) {
        setError("Hmm, that room doesn't exist. Double-check the code?");
        setBusy(false);
        return;
      }
      if (status === "swiping") {
        setError("That crew already started swiping — ask them to start a new room.");
        setBusy(false);
        return;
      }
      navigate(`/room/${cleaned}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <Screen className="gap-10">
      <Logo small />
      <form
        className="flex flex-1 flex-col justify-center gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void join();
        }}
      >
        <h1 className="text-center font-display text-3xl font-black text-ink">Join a room</h1>
        <p className="text-center text-ink-soft">Type the 5-letter code your friend shared.</p>
        <TextField value={code} onChange={setCode} placeholder="ABCDE" maxLength={7} autoFocus center />
        <PrimaryButton type="submit" disabled={cleaned.length < 5 || busy}>
          {busy ? "Checking…" : "Join"}
        </PrimaryButton>
        {error && <p className="text-center text-sm font-medium text-primary-deep">{error}</p>}
      </form>
    </Screen>
  );
}
