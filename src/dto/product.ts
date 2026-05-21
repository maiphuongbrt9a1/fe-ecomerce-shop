// Product DTOs aligned with backend OpenAPI schema

/**
 * Media entity from API
 */
export interface MediaEntity {
  id: number;
  url: string;
  type: "IMAGE" | "VIDEO" | "DOCUMENT";
  reviewId: number | null;
  userId: number | null;
  productVariantId: number | null;
  isShopLogo: boolean;
  isShopBanner: boolean;
  isCategoryFile: boolean;
  isAvatarFile: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Product variant with media (from ProductWithVariantsAndMediaEntity)
 */
export interface ProductVariantWithMediaEntity {
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
  media: MediaEntity[];
}

/**
 * Product DTO with full details from GET /products endpoint
 * Matches ProductWithVariantsAndMediaEntity schema
 */
export interface ProductVoucherSummary {
  id: number;
  isActive: boolean;
  validFrom: string;
  validTo: string;
}

export interface ProductDto {
  id: number;
  name: string;
  description: string | null;
  price: number;
  currencyUnit: string;
  stockKeepingUnit: string;
  stock: number;
  categoryId: number | null;
  createByUserId: number;
  voucherId: number | null;
  voucher?: ProductVoucherSummary | null;
  createdAt: string;
  updatedAt: string;
  media: MediaEntity[];
  productVariants: ProductVariantWithMediaEntity[];
}

/**
 * Paginated response metadata
 */
export interface PaginationMeta {
  total: number;
  lastPage: number;
  currentPage: number;
  perPage: number;
  prev: number | null;
  next: number | null;
}

/**
 * Paginated products response
 */
export interface PaginatedProductsResponse {
  data: ProductDto[];
  meta: PaginationMeta;
}

/**
 * Parameters for getting all products
 */
export interface GetProductsParams {
  page?: number;
  perPage?: number;
  search?: string;
  categoryId?: number;
  inStock?: boolean;
  onSale?: boolean;
}

/**
 * Parameters for the /products/filter endpoint
 */
export interface GetFilterParams {
  page?: number;
  perPage?: number;
  searchText?: string;
  categories?: string[];
  colors?: string[];
  sizes?: string[];
  priceRange?: [number, number];
  conditions?: string[];
  features?: string[];
  accessToken?: string;
}

/**
 * DTO for creating a new product (multipart/form-data)
 */
export interface CreateProductDto {
  name: string;
  description: string;
  price: number;
  currencyUnit: string;
  stockKeepingUnit: string;
  stock: number;
  createByUserId: number;
  categoryId: number;
  voucherId?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO for updating an existing product
 */
export interface UpdateProductDto {
  name?: string;
  description?: string;
  price?: number;
  currencyUnit?: string;
  stockKeepingUnit?: string;
  stock?: number;
  createByUserId?: number;
  categoryId?: number;
  voucherId?: number;
  mediaIdsToDelete?: string[];
}
