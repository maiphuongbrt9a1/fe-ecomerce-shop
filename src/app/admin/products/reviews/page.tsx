"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search, Loader2, Star, ImageIcon } from "lucide-react";
import { reviewService } from "@/services/review";
import type { AdminReviewDto } from "@/dto/review";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import ReviewDetailSheet from "./_components/ReviewDetailSheet";
import RowImage from "@/components/RowImage";

const ROW_HEIGHT = 64;
const PER_PAGE = 10;
const COLS = "48px 80px 2fr 1.5fr 130px 2fr 60px 130px";

type FilterTab = "all" | "5" | "4" | "3" | "2" | "1";

const formatDate = (dateStr: string) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export default function AdminProductsReviewsPage() {
  const { data: session } = useSession();
  const accessToken = session?.user?.access_token || "";

  const [reviews, setReviews] = useState<AdminReviewDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReview, setSelectedReview] = useState<AdminReviewDto | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setReviews([]);
      const all: AdminReviewDto[] = [];
      let page = 1;
      try {
        while (!cancelled) {
          console.log("[ReviewsPage] Fetching page:", page);
          const res = await reviewService.getAllReviews(page, PER_PAGE, undefined, accessToken);
          const data = Array.isArray(res.data) ? res.data : [];
          console.log("[ReviewsPage] Page", page, "→", data.length, "items");
          if (data.length === 0) break;
          all.push(...data);
          if (cancelled) return;
          if (page === 1) {
            setReviews(all.slice());
            setLoading(false);
            setLoadingMore(true);
          } else {
            setReviews(all.slice());
          }
          if (data.length < PER_PAGE) break;
          page += 1;
        }
        if (!cancelled) console.log("[ReviewsPage] Done. Total:", all.length);
      } catch (err) {
        console.error("[ReviewsPage] Fetch error:", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [accessToken]);

  const filteredReviews = useMemo(() => {
    let result = reviews;
    if (activeTab !== "all") {
      const rating = Number(activeTab);
      result = result.filter((r) => r.rating === rating);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((r) => {
        const productName = r.product?.name?.toLowerCase() ?? "";
        const userName = [r.user?.lastName, r.user?.firstName].filter(Boolean).join(" ").toLowerCase();
        const userEmail = r.user?.email?.toLowerCase() ?? "";
        const comment = r.comment?.toLowerCase() ?? "";
        return productName.includes(q) || userName.includes(q) || userEmail.includes(q) || comment.includes(q) || String(r.id).includes(q);
      });
    }
    return result;
  }, [reviews, activeTab, searchQuery]);

  const rowVirtualizer = useVirtualizer({
    count: filteredReviews.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const handleDeleted = (reviewId: number) => {
    setReviews((prev) => prev.filter((r) => r.id !== reviewId));
  };

  // Aggregate counters for tab labels (just from currently-loaded data)
  const ratingCounts = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => {
      if (r.rating >= 1 && r.rating <= 5) {
        counts[r.rating as 1 | 2 | 3 | 4 | 5]++;
      }
    });
    return counts;
  }, [reviews]);

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
            <TabsTrigger value="all" className="cursor-pointer">
              Tất cả
            </TabsTrigger>
            <TabsTrigger value="5" className="cursor-pointer">
              5★ {activeTab === "all" && ratingCounts[5] > 0 && `(${ratingCounts[5]})`}
            </TabsTrigger>
            <TabsTrigger value="4" className="cursor-pointer">
              4★ {activeTab === "all" && ratingCounts[4] > 0 && `(${ratingCounts[4]})`}
            </TabsTrigger>
            <TabsTrigger value="3" className="cursor-pointer">
              3★ {activeTab === "all" && ratingCounts[3] > 0 && `(${ratingCounts[3]})`}
            </TabsTrigger>
            <TabsTrigger value="2" className="cursor-pointer">
              2★ {activeTab === "all" && ratingCounts[2] > 0 && `(${ratingCounts[2]})`}
            </TabsTrigger>
            <TabsTrigger value="1" className="cursor-pointer">
              1★ {activeTab === "all" && ratingCounts[1] > 0 && `(${ratingCounts[1]})`}
            </TabsTrigger>
          </TabsList>
        </div>
      </Tabs>

      {/* Search */}
      <div className="relative w-full max-w-2xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Tìm theo tên sản phẩm, người dùng, email hoặc nội dung..."
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
      ) : filteredReviews.length === 0 ? (
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
              const review = filteredReviews[vi.index];
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
