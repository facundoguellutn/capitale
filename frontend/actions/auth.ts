"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/session";
import { requireUser } from "@/lib/auth";
import User from "@/models/User";

export type AuthFormState = { error?: string; success?: string } | undefined;

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});

const registerSchema = z.object({
  name: z.string().min(1, "Ingresá tu nombre"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export async function login(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  await dbConnect();
  const user = await User.findOne({ email: parsed.data.email });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return { error: "Email o contraseña incorrectos" };
  }

  await createSession(user._id.toString());
  redirect("/dashboard");
}

// Solo permite registrar al primer usuario (app personal de un solo usuario)
export async function register(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  await dbConnect();
  const existing = await User.countDocuments();
  if (existing > 0) {
    return { error: "Ya existe un usuario registrado. Iniciá sesión." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await User.create({
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash,
  });

  await createSession(user._id.toString());
  redirect("/dashboard");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Ingresá tu contraseña actual"),
  newPassword: z
    .string()
    .min(8, "La nueva contraseña debe tener al menos 8 caracteres"),
});

export async function changePassword(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const session = await requireUser();
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  await dbConnect();
  const user = await User.findById(session.userId);
  if (!user || !(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
    return { error: "La contraseña actual es incorrecta" };
  }

  user.passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await user.save();
  return { success: "Contraseña actualizada" };
}
