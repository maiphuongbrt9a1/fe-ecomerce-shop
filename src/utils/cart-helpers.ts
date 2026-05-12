import { cartService } from "@/services/cart";
import { ApiError } from "@/utils/api-error";

/**
 * Resolves the user's cart id. Some users have never created a cart (brand-new
 * accounts, or first add-to-cart). Backend returns 404, but its own catch block
 * re-wraps that as 400, so we handle both.
 */
export async function getOrCreateCartId(userId: number, accessToken: string): Promise<number> {
  try {
    const cartResponse = await cartService.getCartById(userId, accessToken);
    console.log("[CartHelpers] Using existing cart:", cartResponse.data!.id);
    return cartResponse.data!.id;
  } catch (err) {
    if (err instanceof ApiError && (err.statusCode === 404 || err.statusCode === 400)) {
      console.log("[CartHelpers] No cart found, creating new cart for user", userId);
      const createCartResponse = await cartService.createCart(userId, { userId }, accessToken);
      if (!createCartResponse.data?.id) throw new Error("Failed to create cart");
      console.log("[CartHelpers] Cart created:", createCartResponse.data.id);
      return createCartResponse.data.id;
    }
    throw err;
  }
}
