"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search, Loader2, Star, ImageIcon } from "lucide-react";
import { reviewService } from "@/services/review";
import type { AdminReviewDto } from "@/dto/review";
import { useDebounce } from "@/hooks/useDebounce";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import ReviewDetailSheet from "@/components/admin/reviews/ReviewDetailSheet";
import RowImage from "@/components/RowImage";

const ROW_HEIGHT = 64;
const PER_PAGE = 20;
const COLS = "48px 80px 2fr 1.5fr 130px 2fr 60px 130px";

type FilterTab = "all" | "5" | "4" | "3" | "2" | "1";

const tabToRating = (tab: FilterTab): number | undefined =>
  tab === "all" ? undefined : Number(tab);

const formatDate = (dateStr: string) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export default function ReviewsClient() {
  const { data: session } = useSession();
  const accessToken = session?.user?.access_token || "";

  const [reviews, setReviews] = useState<AdminReviewDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef         = useRef(1);
  const requestTokenRef = useRef(0);
  // Snapshot of the filters that started the current set — fetchMore uses
  // these so the next page always lines up, even mid-typing or mid-tab-switch.
  const activeFiltersRef = useRef<{ search: string; rating: number | undefined }>({
    search: "",
    rating: undefined,
  });

  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  const [selectedReview, setSelectedReview] = useState<AdminReviewDto | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  const resetAndFetch = useCallback(
    async (search: string, rating: number | undefined) => {
      if (!accessToken) return;
      const token = ++requestTokenRef.current;
      activeFiltersRef.current = { search, rating };
      setLoading(true);
      setLoadingMore(false);
      setReviews([]);
      pageRef.current = 1;
      setHasMore(true);
      try {
        const res = await reviewService.getAllReviews(1, PER_PAGE, rating, accessToken, search);
        if (token !== requestTokenRef.current) return;
        const data = Array.isArray(res.data) ? res.data : [];
        setReviews(data);
        setHasMore(data.length > 0);
      } catch (err) {
        console.error("[ReviewsClient] reset fetch error:", err);
      } finally {
        if (token === requestTokenRef.current) setLoading(false);
      }
    },
    [accessToken],
  );

  const fetchMore = useCallback(async () => {
    if (!accessToken) return;
    const token = requestTokenRef.current;
    const nextPage = pageRef.current + 1;
    const { search, rating } = activeFiltersRef.current;
    setLoadingMore(true);
    try {
      const res = await reviewService.getAllReviews(nextPage, PER_PAGE, rating, accessToken, search);
      if (token !== requestTokenRef.current) return;
      const data = Array.isArray(res.data) ? res.data : [];
      if (data.length > 0) {
        setReviews((prev) => [...prev, ...data]);
        pageRef.current = nextPage;
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("[ReviewsClient] fetchMore error:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [accessToken]);

  // Any filter change → reset to page 1 server-side.
  useEffect(() => {
    if (!accessToken) return;
    resetAndFetch(debouncedSearch, tabToRating(activeTab));
  }, [accessToken, debouncedSearch, activeTab, resetAndFetch]);

  const rowVirtualizer = useVirtualizer({
    count: reviews.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    getItemKey: (index) => reviews[index]?.id ?? index,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1];
    if (!last) return;
    if (last.index >= reviews.length - 5 && hasMore && !loadingMore && !loading) {
      fetchMore();
    }
  }, [virtualItems, reviews.length, hasMore, loadingMore, loading, fetchMore]);

  const handleDeleted = (reviewId: number) => {
    setReviews((prev) => prev.filter((r) => r.id !== reviewId));
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 flex flex-col gap-4 h-full min-h-0">
      <h1 className="text-xl sm:text-2xl font-bold text-[var(--admin-green-dark)]">
        Đánh giá sản phẩm
      </h1>

      {/* Filter tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as FilterTab)}
      >
        <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="bg-[var(--admin-green-light)] w-max">
            <TabsTrigger value="all" className="cursor-pointer">Tất cả</TabsTrigger>
            <TabsTrigger value="5" className="cursor-pointer">5★</TabsTrigger>
            <TabsTrigger value="4" className="cursor-pointer">4★</TabsTrigger>
            <TabsTrigger value="3" className="cursor-pointer">3★</TabsTrigger>
            <TabsTrigger value="2" className="cursor-pointer">2★</TabsTrigger>
            <TabsTrigger value="1" className="cursor-pointer">1★</TabsTrigger>
          </TabsList>
        </div>
      </Tabs>

      {/* Search */}
      <div className="relative w-full max-w-2xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Tìm theo tên sản phẩm, người dùng, email, nội dung hoặc ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-x-auto">
        <div className="min-w-[1080px] flex flex-col flex-1 min-h-0">
      {/* Table header */}
      <div
        style={{ display: "grid", gridTemplateColumns: COLS }}
        className="bg-[var(--admin-green-light)] rounded-lg px-4 py-2 text-sm font-semibold text-[var(--admin-green-dark)] flex-shrink-0"
      >
        <div className="flex items-center">#</div>
        <div className="flex items-center">Ảnh</div>
        <div className="flex items-center">Sản phẩm</div>
        <div className="flex items-center">Người dùng</div>
        <div className="flex items-center">Đánh giá</div>
        <div className="flex items-center">Nội dung</div>
        <div className="flex items-center">Hình</div>
        <div className="flex items-center">Ngày</div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-[var(--admin-green-dark)] w-8 h-8" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          {searchQuery
            ? "Không tìm thấy đánh giá phù hợp."
            : "Chưa có đánh giá nào trong mục này."}
        </div>
      ) : (
        <div
          ref={tableContainerRef}
          className="overflow-y-auto flex-1 relative border border-gray-200 rounded-lg min-h-0 mt-2"
        >
          <div
            style={{
              height: rowVirtualizer.getTotalSize(),
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((vi) => {
              const review = reviews[vi.index];
              const thumbUrl = review.media?.[0]?.url;
              const productName = review.product?.name ?? `Product #${review.productId}`;
              const variantLabel = review.productVariant
                ? `${review.productVariant.variantSize} • ${review.productVariant.variantColor}`
                : "";
              const userName =
                [review.user?.lastName, review.user?.firstName]
                  .filter(Boolean)
                  .join(" ") || review.user?.email || `User #${review.userId}`;
              const userEmail = review.user?.email ?? "";
              const photoCount = review.media?.length ?? 0;

              return (
                <div
                  key={review.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    transform: `translateY(${vi.start}px)`,
                    display: "grid",
                    gridTemplateColumns: COLS,
                    width: "100%",
                    height: ROW_HEIGHT,
                  }}
                  onClick={() => setSelectedReview(review)}
                  className="cursor-pointer hover:bg-gray-50 border-b border-gray-100 px-4 items-center text-sm"
                >
                  {/* # */}
                  <div className="text-gray-400 text-xs">{vi.index + 1}</div>

                  {/* First photo */}
                  <div className="flex items-center justify-center">
                    {thumbUrl ? (
                      <div className="w-12 h-12 rounded overflow-hidden">
                        <RowImage src={thumbUrl} alt="" size={48} />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-gray-300">
                        <ImageIcon size={18} />
                      </div>
                    )}
                  </div>

                  {/* Product */}
                  <div className="flex flex-col overflow-hidden pr-2">
                    <span className="truncate text-gray-800 font-medium">
                      {productName}
                    </span>
                    {variantLabel && (
                      <span className="truncate text-xs text-gray-500">
                        {variantLabel}
                      </span>
                    )}
                  </div>

                  {/* User */}
                  <div className="flex flex-col overflow-hidden pr-2">
                    <span className="truncate text-gray-800">{userName}</span>
                    {userEmail && (
                      <span className="truncate text-xs text-gray-500">
                        {userEmail}
                      </span>
                    )}
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-1">
                    <Star
                      size={14}
                      className="fill-yellow-400 stroke-yellow-400"
                    />
                    <span className="font-medium text-gray-800">
                      {review.rating}
                    </span>
                    <span className="text-xs text-gray-500">/5</span>
                  </div>

                  {/* Comment */}
                  <div className="text-gray-600 truncate pr-2">
                    {review.comment || (
                      <span className="text-gray-400 italic">— Không có nội dung —</span>
                    )}
                  </div>

                  {/* Photo count */}
                  <div className="text-gray-600 text-xs flex items-center gap-1">
                    {photoCount > 0 ? (
                      <>
                        <ImageIcon size={12} className="text-gray-500" />
                        {photoCount}
                      </>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </div>

                  {/* Date */}
                  <div className="text-gray-600 text-xs">
                    {formatDate(review.createdAt)}
                  </div>
                </div>
              );
            })}
          </div>

          {loadingMore && (
            <div className="sticky bottom-0 bg-white py-2 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
              <Loader2 className="animate-spin w-4 h-4" />
              Đang tải thêm...
            </div>
          )}
        </div>
      )}
        </div>
      </div>

      <ReviewDetailSheet
        review={selectedReview}
        open={selectedReview !== null}
        onClose={() => setSelectedReview(null)}
        onDeleted={handleDeleted}
        accessToken={accessToken}
      />
    </div>
  );
}
