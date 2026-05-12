import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ProductAttachment } from "@/utils/chat-product";

const STORAGE_KEY = "authIntent";
const TTL_MS = 10 * 60 * 1000;

export interface BuyNowSnapshot {
  productVariantId: number;
  quantity: number;
  price: number;
  productName: string;
  variantSize: string | null;
  variantColor: string | null;
  imageUrl: string | null;
}

export type AuthIntent =
  | {
      kind: "addToCart";
      productId: number;
      variantId: number;
      quantity: number;
      createdAt: number;
    }
  | {
      kind: "addAllToCart";
      productId: number;
      variantIds: number[];
      createdAt: number;
    }
  | {
      kind: "buyNow";
      productId: number;
      variantId: number;
      quantity: number;
      createdAt: number;
      buyNow: BuyNowSnapshot;
    }
  | {
      kind: "sendToChat";
      productId: number;
      variantId: number;
      quantity: number;
      createdAt: number;
      attachment: ProductAttachment;
    };

export type AuthIntentInput = AuthIntent extends infer T
  ? T extends AuthIntent
    ? Omit<T, "createdAt">
    : never
  : never;

export function saveAuthIntent(intent: AuthIntentInput): void {
  if (typeof window === "undefined") return;
  const payload = { ...intent, createdAt: Date.now() } as AuthIntent;
  console.log("[AuthIntent] Saving intent:", payload);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function readAuthIntent(): AuthIntent | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthIntent;
    if (Date.now() - parsed.createdAt > TTL_MS) {
      console.log("[AuthIntent] Intent expired, clearing");
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearAuthIntent(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}

function isSafeRelativePath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

export function buildLoginUrl(returnPath: string): string {
  if (!isSafeRelativePath(returnPath)) return "/auth/login";
  return `/auth/login?callbackUrl=${encodeURIComponent(returnPath)}`;
}

export function redirectToLoginWithIntent(
  router: AppRouterInstance,
  intent: AuthIntentInput,
  returnPath: string,
): void {
  saveAuthIntent(intent);
  const url = buildLoginUrl(returnPath);
  console.log("[AuthIntent] Redirecting to login with callbackUrl:", returnPath);
  router.push(url);
}

export function sanitizeCallbackUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  return isSafeRelativePath(value) ? value : null;
}
