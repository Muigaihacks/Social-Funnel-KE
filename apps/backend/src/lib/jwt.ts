import jwt, { type SignOptions } from "jsonwebtoken";

const ISS = "acquisition-os";

export type StaffJwtPayload = {
  sub: string;
  email: string;
  permissions: string[];
  roleKey: string;
};

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error("JWT_SECRET must be set (min 16 characters) for staff auth");
  }
  return s;
}

export function signStaffToken(payload: StaffJwtPayload, expiresIn: SignOptions["expiresIn"] = "7d"): string {
  const options: SignOptions = { expiresIn, issuer: ISS };
  return jwt.sign(
    {
      sub: payload.sub,
      email: payload.email,
      permissions: payload.permissions,
      roleKey: payload.roleKey,
    },
    secret(),
    options
  );
}

export function verifyStaffToken(token: string): StaffJwtPayload {
  const decoded = jwt.verify(token, secret(), { issuer: ISS });
  if (typeof decoded === "string" || decoded === null) throw new Error("Invalid token");
  const o = decoded as Record<string, unknown>;
  if (
    typeof o.sub !== "string" ||
    typeof o.email !== "string" ||
    !Array.isArray(o.permissions) ||
    !o.permissions.every((x) => typeof x === "string") ||
    typeof o.roleKey !== "string"
  ) {
    throw new Error("Invalid token payload");
  }
  return {
    sub: o.sub,
    email: o.email,
    permissions: o.permissions as string[],
    roleKey: o.roleKey,
  };
}
