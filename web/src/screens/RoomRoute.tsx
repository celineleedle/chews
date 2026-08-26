import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { connectToRoom, leaveRoom } from "../lib/socket";
import { getSavedName, saveName } from "../lib/identity";
import { useRoomStore } from "../store/roomStore";
import { Logo, PrimaryButton, ReconnectBanner, Screen, TextField, Toast } from "../components/ui";
import Lobby from "./Lobby";
import Swipe from "./Swipe";
import Result from "./Result";

export default function RoomRoute() {
  const { code = "" } = useParams();
  const roomCode = code.toUpperCase();
  const navigate = useNavigate();

  const status = useRoomStore((s) => s.status);
  const fatalError = useRoomStore((s) => s.fatalError);
  const [name, setName] = useState(getSavedName());
  const [confirmed, setConfirmed] = useState(() => getSavedName().trim().length > 0);

  useEffect(() => {
    if (!confirmed || !roomCode) return;
    connectToRoom(roomCode, getSavedName() || undefined);
    return () => {
      leaveRoom();
    };
  }, [confirmed, roomCode]);

  if (fatalError) {
    const friendly: Record<string, { title: string; hint: string }> = {
      ROOM_NOT_FOUND: { title: "Room not found", hint: "That code doesn't match any open room. Codes expire once everyone leaves." },
      SESSION_IN_PROGRESS: { title: "They started without you 😅", hint: "This crew is already swiping. Ask them for the verdict — or start a fresh room." },
      ROOM_FULL: { title: "Room's packed", hint: "This room hit its limit. Start another one and split the party." },
      NAME_REQUIRED: { title: "Need a name", hint: "Head back and pick a display name first." },
    };
    const copy = friendly[fatalError.code] ?? { title: "Something went wrong", hint: fatalError.message };
    return (
      <Screen className="justify-center gap-6 text-center">
        <div className="text-6xl">🫥</div>
        <h1 className="font-display text-3xl font-black text-ink">{copy.title}</h1>
        <p className="text-ink-soft">{copy.hint}</p>
        <PrimaryButton onClick={() => navigate("/")}>Back home</PrimaryButton>
      </Screen>
    );
  }

  if (!confirmed) {
    return (
      <Screen className="gap-10">
        <Logo small />
        <form
          className="flex flex-1 flex-col justify-center gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) {
              saveName(name.trim());
              setConfirmed(true);
            }
          }}
        >
          <h1 className="text-center font-display text-3xl font-black text-ink">
            Joining room {roomCode}
          </h1>
          <p className="text-center text-ink-soft">Pick a name so your crew knows it's you.</p>
          <TextField value={name} onChange={setName} placeholder="Your name" maxLength={24} autoFocus />
          <PrimaryButton type="submit" disabled={!name.trim()}>
            Let's eat
          </PrimaryButton>
        </form>
      </Screen>
    );
  }

  let body;
  if (status === "lobby") body = <Lobby />;
  else if (status === "swiping") body = <Swipe />;
  else if (status === "matched" || status === "finished") body = <Result />;
  else {
    body = (
      <Screen className="items-center justify-center gap-4">
        <div className="animate-bounce text-5xl">🍽️</div>
        <p className="font-medium text-ink-soft">Pulling up a chair…</p>
      </Screen>
    );
  }

  return (
    <>
      <ReconnectBanner />
      {body}
      <Toast />
    </>
  );
}
