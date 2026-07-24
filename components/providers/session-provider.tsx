"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/types";
import { PUBLIC_MEMBERS, type PublicMember } from "@/lib/config/members";

interface SessionValue {
  user: SessionUser;
  member: PublicMember;
  /** The other two — the whole point of the product. */
  others: PublicMember[];
  isMe: (memberId: string) => boolean;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  const member =
    PUBLIC_MEMBERS.find((m) => m.id === user.id) ?? PUBLIC_MEMBERS[0];
  const others = PUBLIC_MEMBERS.filter((m) => m.id !== user.id);

  return (
    <SessionContext.Provider
      value={{
        user,
        member,
        others,
        isMe: (memberId: string) => memberId === user.id,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
