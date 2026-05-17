// Product Variant DTOs aligned with backend OpenAPI schema

import type { MediaEntity } from "./product";

/**
 * Minimal parent product fields the variants list endpoint returns nested.
 */
export interface ProductSummary {
  id: number;
  name: string;
  stockKeepingUnit: string;
  categoryId: number | null;
}

/**
 * Shape returned by GET /product-variants — variant + its media + nested parent product.
 * Backend: product-variants.service.findAll() uses include: { media: true, product: true }.
 */
export interface ProductVariantWithMediaAndProductEntity extends ProductVariantEntity {
  media: MediaEntity[];
  product: ProductSummary;
}

/**
 * ProductVariantEntity from API
 */
export interface ProductVariantEntity {
  id: number;
  productId: number;
  createByUserId: number;
  variantName: string;
  variantColor: string;
  variantSize: string;
  variantWeight: number;
  variantHeight: number;
  variantWidth: number;
  variantLength: number;
  colorId: number;
  price: number;
  currencyUnit: string;
  stock: number;
  stockKeepingUnit: string;
  voucherId: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO for creating a new product variant (multipart/form-data)
 */
export interface CreateProductVariantDto {
  productId: number;
  createByUserId: number;
  variantName: string;
  variantColor: string;
  variantSize: string;
  variantWeight: number;
  variantHeight: number;
  variantLength: number;
  variantWidth: number;
  colorId: number;
  price: number;
  stock: number;
  stockKeepingUnit: string;
  createdAt: string;
  voucherId?: number;
}

/**
 * DTO for updating a product variant (application/json)
 */
export interface UpdateProductVariantDto {
  productId?: number;
  createByUserId?: number;
  variantName?: string;
  variantColor?: string;
  variantSize?: string;
  variantWeight?: number;
  variantHeight?: number;
  variantWidth?: number;
  variantLength?: number;
  colorId?: number;
  price?: number;
  currencyUnit?: string;
  stock?: number;
  stockKeepingUnit?: string;
  voucherId?: number;
  mediaIdsToDelete?: string[];
}
