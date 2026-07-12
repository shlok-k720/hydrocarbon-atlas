import { normalizeUsername } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type AuthAction = "login" | "signup";

interface AuthPayload {
  action: AuthAction;
  username: string;
  passwordHash: string;
  browserId: string;
}

function isAuthPayload(value: unknown): value is AuthPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    (candidate.action === "login" || candidate.action === "signup") &&
    typeof candidate.username === "string" &&
    typeof candidate.passwordHash === "string" &&
    typeof candidate.browserId === "string"
  );
}

function validateUsername(username: string) {
  return /^[a-z0-9._-]{3,32}$/.test(username);
}

function validatePasswordHash(passwordHash: string) {
  return /^[a-f0-9]{64}$/.test(passwordHash);
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!isAuthPayload(payload)) {
    return Response.json({ error: "Missing login or sign-up fields." }, { status: 400 });
  }

  const username = normalizeUsername(payload.username);

  if (!validateUsername(username)) {
    return Response.json(
      { error: "User ID must be 3 to 32 characters using letters, numbers, dots, hyphens, or underscores." },
      { status: 400 },
    );
  }

  if (!validatePasswordHash(payload.passwordHash)) {
    return Response.json({ error: "Password hash is not valid." }, { status: 400 });
  }

  if (payload.action === "signup") {
    const existingUser = await prisma.userAccount.findUnique({
      where: { username },
      select: { id: true },
    });

    if (existingUser) {
      return Response.json({ error: "That user ID already exists." }, { status: 409 });
    }

    const account = await prisma.$transaction(async (transaction) => {
      const createdUser = await transaction.userAccount.create({
        data: {
          username,
          passwordHash: payload.passwordHash,
        },
      });

      await transaction.learnerProfile.create({
        data: {
          userId: createdUser.id,
        },
      });

      return createdUser;
    });

    return Response.json({
      session: {
        profileMode: "account",
        browserId: payload.browserId,
        username: account.username,
      },
    });
  }

  const account = await prisma.userAccount.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      passwordHash: true,
    },
  });

  if (!account || account.passwordHash !== payload.passwordHash) {
    return Response.json({ error: "Incorrect user ID or password." }, { status: 401 });
  }

  await prisma.learnerProfile.upsert({
    where: { userId: account.id },
    create: { userId: account.id },
    update: {},
  });

  return Response.json({
    session: {
      profileMode: "account",
      browserId: payload.browserId,
      username: account.username,
    },
  });
}